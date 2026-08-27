/* ==========================================================================
   32-aal.js — 評量即學習（Assessment as Learning）核心
   ‧ 四條件：導師／學生／同儕／無代理人對照
   ‧ 認知歷程架構：TIMSS 2019 數學三認知領域 × 15 子歷程
   ‧ 模組化提示：1 系統骨幹 + 3 角色（僅社會框架）+ 3 歷程（提問功能）
   ‧ 回合上限、防洩答攔截、相對歷程編碼

   設計原則（移植自研究構想 v23 的 AaL Platform 規格）：
   提問功能跨角色恆定，僅社會框架隨角色而異；AI 之回應型態由回合排程決定，
   不讀取學童端編碼函式，也不指定學童下一步應採用何種策略。
   ========================================================================== */

/* --- 四條件 --- */
const CONDITIONS = [
  {id:'tutor',   name:'導師',   en:'AI-as-Tutor',  cls:'sc1',
   tradition:'智慧型教學系統／蘇格拉底式鷹架',
   frame:'我是陪你想的老師。我不會告訴你答案，只會一直問你「你是怎麼想的」。',
   mech:'適性鷹架與形成性提問',
   note:'指導性鷹架可能壓縮學習者自主性，故本平台限制其僅能提問、不得評價。'},
  {id:'tutee',   name:'學生',   en:'AI-as-Tutee',  cls:'sc3',
   tradition:'可教代理人／以教代學（門生效應）',
   frame:'我是剛學到這個單元的同學，很多地方還沒弄懂。你可以教我嗎？',
   mech:'學習者翻轉為施教者，須為代理人的學習負責',
   note:'評量事件中最徹底的「主動行動者」姿態。'},
  {id:'peer',    name:'同儕',   en:'AI-as-Peer',   cls:'sc5',
   tradition:'社會建構論／對等協作',
   frame:'我也在做這一題。我先說我想到哪裡，你再說你的，我們對一下。',
   mech:'分享觀點、共構理解',
   note:'處理負擔分散於人機之間。'},
  {id:'control', name:'對照',   en:'System-scaffold control', cls:'',
   tradition:'系統鷹架對照組',
   frame:'',
   mech:'相同工具與流程，不配置 AI 夥伴',
   note:'版面幾何完全相同，僅將對話區替換為同尺寸的「我的筆記」書寫區，' +
        '使四條件的外在認知負荷、捲動深度與畫面留白一致。'}
];
function condition(id){ return CONDITIONS.find(function(c){ return c.id === id; }) || CONDITIONS[3]; }

/* --- 認知歷程架構（TIMSS 2019 數學認知領域） ---
   對應研究構想中 PIRLS 四項理解歷程的位置。兩者同屬 IEA 架構家族，
   換成閱讀研究時只要替換這個常數與題目的 process 標定，程式碼不必更動。 */
const PROCESSES = [
  {id:'K', name:'知道', en:'Knowing',   cls:'sc1', order:1,
   desc:'回憶、辨識與執行例行程序——學生已學過的事實、概念與程序。'},
  {id:'A', name:'應用', en:'Applying',  cls:'sc3', order:2,
   desc:'在例行情境中選擇並執行策略、建立表徵與模型。'},
  {id:'R', name:'推理', en:'Reasoning', cls:'sc5', order:3,
   desc:'在非例行情境中分析、綜合、評估、推廣與論證。'}
];
/* 逐題的官方歷程標定。RQ4 的相對歷程編碼即以此為判定基準，
   因此架構、細目與題本三者必須同版。 */
const ITEM_PROCESS = {
  Q01:'K', Q02:'K', Q03:'R', Q04:'K', Q05:'A', Q06:'K', Q07:'K', Q08:'K',
  Q09:'A', Q10:'A', Q11:'K', Q12:'A', Q13:'A', Q14:'A', C01:'R', C02:'R'
};
function applyItemProcesses(){
  ITEMS.forEach(function(it){ it.process = ITEM_PROCESS[it.id] || 'K'; });
}

function processOf(id){ return PROCESSES.find(function(p){ return p.id === id; }); }
function processName(id){ const p = processOf(id); return p ? p.name : id; }
function processOrder(id){ const p = processOf(id); return p ? p.order : 0; }

/* --- 15 項子歷程與角色中性的代表性提問句 ---
   結構刻意對齊研究構想表 1（PIRLS 19 子歷程）：
   編號、原文、中文對照、代表性提問句、適用題型。 */
const SUBPROCESSES = [
  {id:'K-1', p:'K', en:'Recall',              zh:'回憶定義、術語、性質與公式',
   q:'這一題用到的是哪一個定義或公式？你記得它怎麼說嗎？', fit:'皆可'},
  {id:'K-2', p:'K', en:'Recognize',           zh:'辨識數學物件與等價形式',
   q:'這個式子還可以寫成別的樣子嗎？哪一種你比較看得出來？', fit:'皆可'},
  {id:'K-3', p:'K', en:'Classify / Order',    zh:'依共同性質分類或排序',
   q:'這一題屬於你學過的哪一類問題？為什麼是那一類？', fit:'皆可'},
  {id:'K-4', p:'K', en:'Compute',             zh:'執行演算程序',
   q:'你算到哪一步了？下一步打算做什麼？', fit:'計算'},
  {id:'K-5', p:'K', en:'Retrieve',            zh:'從圖表中提取訊息',
   q:'題目裡哪一個條件是你目前用到的？還有哪一個還沒用？', fit:'皆可'},
  {id:'K-6', p:'K', en:'Measure',             zh:'使用單位與工具進行測量',
   q:'這裡的單位是什麼？換算會影響答案嗎？', fit:'幾何'},

  {id:'A-1', p:'A', en:'Determine',           zh:'決定有效的策略與運算',
   q:'你打算用哪一種方法？有沒有想過另一種？為什麼選這一個？', fit:'皆可'},
  {id:'A-2', p:'A', en:'Represent / Model',   zh:'以式子、圖或表呈現關係',
   q:'如果要把題目裡的關係寫成一個式子，你會怎麼設？設誰當 x？', fit:'應用'},
  {id:'A-3', p:'A', en:'Implement',           zh:'實行策略以解決問題',
   q:'照你剛剛說的方法做下去，會得到什麼？先講你預期的樣子。', fit:'皆可'},

  {id:'R-1', p:'R', en:'Analyze',             zh:'判斷與描述元素間的關係',
   q:'題目給的兩個條件之間有什麼關係？少了其中一個還做得出來嗎？', fit:'皆可'},
  {id:'R-2', p:'R', en:'Integrate / Synthesize', zh:'連結不同元素、表徵與程序',
   q:'這一題跟你之前做過的哪一題像？像在哪裡？', fit:'皆可'},
  {id:'R-3', p:'R', en:'Evaluate',            zh:'評估不同策略與解法的優劣',
   q:'如果有人用另一種做法，你覺得會比較快還是比較容易錯？為什麼？', fit:'皆可'},
  {id:'R-4', p:'R', en:'Draw Conclusions',    zh:'依資訊與證據得出有效結論',
   q:'你怎麼確定這個結果是合理的？有沒有辦法檢查？', fit:'皆可'},
  {id:'R-5', p:'R', en:'Generalize',          zh:'把結果推及更廣的情形',
   q:'如果把題目裡的數字換掉，你的做法還會成立嗎？什麼情況下會不成立？', fit:'皆可'},
  {id:'R-6', p:'R', en:'Justify',             zh:'以數學論證支持策略或解法',
   q:'你要怎麼說服別人這個做法是對的？哪一步是關鍵？', fit:'皆可'}
];
function subprocess(id){ return SUBPROCESSES.find(function(s){ return s.id === id; }); }
function subprocessesOf(p){ return SUBPROCESSES.filter(function(s){ return s.p === p; }); }

/* --- 提問功能（question functions）：跨角色恆定 ---
   AI 的回應型態由「回合排程」決定，不由學生的回答內容決定。 */
const QFUNCTIONS = [
  {id:'F1', name:'目標澄清', desc:'請學習者說出這一題到底在問什麼。'},
  {id:'F2', name:'依據索引', desc:'請學習者指出他的判斷用到題目裡的哪一個條件。'},
  {id:'F3', name:'歷程提問', desc:'依該題官方標定歷程的子歷程提問庫提出一問。'},
  {id:'F4', name:'反向檢核', desc:'請學習者說明「什麼情況下你的做法會不成立」。'},
  {id:'F5', name:'延伸歷程', desc:'再取同一歷程的另一個子歷程提問，或往上一層歷程提問。'},
  {id:'F6', name:'收束整理', desc:'請學習者用一句話說出自己現在的想法。'}
];

/* 回合排程：第 n 次學生發話後，AI 使用第 n 個提問功能。
   同一排程套用於三種角色，因此鷹架機會、資訊量與任務目標於三條件間恆定。 */
const TURN_SCHEDULE = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6'];
const MAX_TURNS = 6;

/* --- 系統骨幹提示模組（模組 0）：任務規則與防洩答機制 --- */
const PROMPT_BACKBONE =
'【任務規則】你是一個嵌在「評量即學習」平台中的對話夥伴，陪國中學生一起想數學題。\n' +
'【嚴格禁止】(1) 說出或暗示答案；(2) 指名答案在哪一個選項或哪一句；(3) 判斷學生答對或答錯；\n' +
'(4) 說出學生缺漏了哪一個得分要素；(5) 直接示範完整解題步驟。\n' +
'【你看不到的東西】你不會讀到學生的作答欄位，也不會知道他選了哪一個選項。\n' +
'【每次回應】只做一件事：依系統指定的提問功能問一個問題。最多兩句話，' +
'第一句回應學生剛剛說的內容，第二句提問。用臺灣國中生聽得懂的口語，不要說教。\n' +
'【回合上限】這一題最多與學生對話 6 個回合。';

/* --- 角色提示模組（模組 1–3）：只有社會框架 --- */
const PROMPT_ROLE = {
  tutor: '【社會框架】你是陪學生想的老師。用「我想確認你怎麼想的」這種語氣，' +
         '把問題丟回去給學生，不要幫他整理答案。',
  tutee: '【社會框架】你是剛學到這個單元、還沒完全弄懂的同學。你想請這位學生教你，' +
         '所以你的問題都要像「我不太懂……你可以說給我聽嗎？」而不是像在考他。',
  peer:  '【社會框架】你是跟學生同時在做這一題的同學。先簡短說一句你自己卡在哪裡或想到什麼' +
         '（不可以是答案），再把同一個問題拋回去問他，語氣是對等的討論。'
};

/* --- 歷程提示模組（模組 4–6）：提問功能與子歷程提問庫 --- */
function promptProcessModule(pid){
  const p = processOf(pid);
  const subs = subprocessesOf(pid);
  return '【本題官方標定歷程】' + p.name + '（' + p.en + '）——' + p.desc + '\n' +
    '【可用的子歷程提問庫】\n' +
    subs.map(function(s){ return '  ' + s.id + ' ' + s.zh + '：' + s.q; }).join('\n');
}

/* 執行時動態組合 8 個模組中的 3 個（骨幹 + 角色 + 歷程） */
function composePrompt(conditionId, processId, qfnId){
  const f = QFUNCTIONS.find(function(x){ return x.id === qfnId; });
  return [PROMPT_BACKBONE, PROMPT_ROLE[conditionId] || '', promptProcessModule(processId),
    '【這一回合的提問功能】' + f.name + '：' + f.desc].join('\n\n');
}

/* ==========================================================================
   離線對話引擎
   角色只改社會框架，提問功能與子歷程提問庫三角色共用，
   因此不需要語言模型也能忠實產生三條件的對話。
   ========================================================================== */

const ROLE_OPENER = {
  tutor: ['這一題我們一起想。', '好，我聽你說。', '我想確認你怎麼想的。', '先不要急著算。'],
  tutee: ['我也在看這一題，可是我卡住了。', '這裡我不太懂耶。', '我剛剛好像想錯了。', '你這樣說我有一點懂了。'],
  peer:  ['我先講我想到哪裡。', '我也在做這一題。', '我的想法跟你可能不一樣。', '欸我們對一下。']
};
const ROLE_STEM = {
  tutor: function(q){ return q; },
  tutee: function(q){ return '你可以說給我聽嗎——' + q; },
  peer:  function(q){ return '那你呢？' + q; }
};

/* 依回合排程挑一個子歷程（不看學生說了什麼，只看回合數與該題的官方歷程標定） */
function pickSubprocess(processId, item, turn){
  const subs = subprocessesOf(processId).filter(function(s){
    if (s.fit === '皆可') return true;
    if (s.fit === '計算') return item.type === 'mc';
    if (s.fit === '應用') return (item.tags || []).indexOf('應用問題') >= 0;
    if (s.fit === '幾何') return (item.tags || []).indexOf('畢氏定理') >= 0;
    return true;
  });
  const pool = subs.length ? subs : subprocessesOf(processId);
  return pool[turn % pool.length];
}

/* 產生一則 AI 回應（離線引擎）。回傳含研究所需的完整中繼資料。 */
function agentTurn(conditionId, item, turn, rnd){
  const r = rnd || Math.random;
  const qfnId = TURN_SCHEDULE[Math.min(turn, TURN_SCHEDULE.length - 1)];
  const pid = item.process || 'K';
  let sub = null, body = '';

  if (qfnId === 'F1'){
    body = '這一題到底在問什麼？用你自己的話說一次。';
  } else if (qfnId === 'F2'){
    body = '你剛剛的判斷，用到題目裡的哪一個條件？';
  } else if (qfnId === 'F3'){
    sub = pickSubprocess(pid, item, turn);
    body = sub.q;
  } else if (qfnId === 'F4'){
    body = '什麼情況下你這個做法會不成立？想一個會出問題的例子。';
  } else if (qfnId === 'F5'){
    // 延伸：優先往上一層歷程取一個子歷程，沒有上一層就回到同層另一個
    const up = PROCESSES.find(function(p){ return p.order === processOrder(pid) + 1; });
    sub = pickSubprocess(up ? up.id : pid, item, turn + 2);
    body = sub.q;
  } else {
    body = '現在如果只能講一句話說你的想法，你會怎麼說？';
  }

  const openers = ROLE_OPENER[conditionId] || [''];
  const opener = openers[Math.floor(r() * openers.length)];
  const text = (opener ? opener + ' ' : '') + (ROLE_STEM[conditionId] || function(q){ return q; })(body);

  return {
    text: leakGuard(text, item).text,
    qfn: qfnId,
    sub: sub ? sub.id : null,
    process: sub ? sub.p : pid,
    engine: 'builtin'
  };
}

/* --- 防洩答攔截 ---
   規則引擎本來就不會產生答案，但外部語言模型會。輸出後一律過這一關，
   攔截次數本身就是一項可報告的忠實度指標。 */
const VERDICT_WORDS = ['答對', '答錯', '正確答案', '你錯了', '你對了', '正解是', '應該選', '答案是', '選項是'];
function leakGuard(text, item){
  let t = String(text), hits = [];
  VERDICT_WORDS.forEach(function(w){ if (t.indexOf(w) >= 0) hits.push(w); });
  if (item && item.type === 'mc' && item.options){
    const ans = item.options[item.answer];
    if (ans && t.indexOf(ans) >= 0) hits.push('正解字串');
    const letter = String.fromCharCode(65 + item.answer);
    if (new RegExp('(選|答案|正解)\\s*' + letter + '\\b').test(t)) hits.push('正解代號');
  }
  if (hits.length){
    return {text:'這個我不能說喔。換個方式問你：你剛剛是從題目的哪一句得到這個想法的？',
            blocked:true, hits:hits};
  }
  return {text:t, blocked:false, hits:[]};
}

/* ==========================================================================
   相對歷程編碼（對應研究構想 RQ4）
   以「試題官方標定之歷程」為判定基準，把學生的每一次發話編碼為
   低於（BELOW）／等於（AT）／高於（ABOVE）該題所要求的歷程層次。
   ========================================================================== */
const PROCESS_CUES = {
  K: ['公式', '定義', '怎麼算', '算式', '幾', '等於', '記得', '背', '步驟', '代入', '照著'],
  A: ['方法', '策略', '設', '列式', '模型', '應該用', '哪一種做法', '轉換', '先做', '拆成'],
  R: ['為什麼', '如果', '反例', '不成立', '證明', '推論', '一定嗎', '哪裡錯', '比較', '判斷', '通則', '任何']
};
function codeUtteranceProcess(text){
  const t = String(text || '');
  let best = 'K', bestN = 0;
  ['R', 'A', 'K'].forEach(function(p){
    let n = 0;
    PROCESS_CUES[p].forEach(function(c){ if (t.indexOf(c) >= 0) n++; });
    if (n > bestN){ bestN = n; best = p; }
  });
  if (!bestN) return t.length > 30 ? 'A' : 'K';
  return best;
}
function relativeProcessCode(utterance, item){
  const u = processOrder(codeUtteranceProcess(utterance));
  const o = processOrder(item.process || 'K');
  return u < o ? 'BELOW' : (u > o ? 'ABOVE' : 'AT');
}
const REL_LABEL = {BELOW:'低於題目歷程', AT:'等於題目歷程', ABOVE:'高於題目歷程'};
const REL_SHORT = {BELOW:'Q−', AT:'Q0', ABOVE:'Q+'};

/* ==========================================================================
   情感分析（詞典法）
   ========================================================================== */
const SENT_POS = ['懂了', '會了', '對耶', '原來', '有道理', '好像可以', '知道了', '簡單', '喜歡',
  '有趣', '成功', '沒問題', '應該可以', '想到了', '找到', '清楚', '謝謝', '哈', '耶'];
const SENT_NEG = ['不懂', '不會', '好難', '看不懂', '卡住', '亂', '煩', '討厭', '放棄', '錯',
  '不知道', '沒辦法', '好煩', '不行', '算不出', '想不到', '完蛋', '慘', '累'];
const SENT_NEG_MARK = ['不', '沒', '別', '無法'];
const SENT_INTENS = ['很', '超', '非常', '好', '真的', '完全', '太'];

function sentimentOf(text){
  const t = String(text || '');
  let score = 0, hits = [];
  SENT_POS.forEach(function(w){
    let i = t.indexOf(w);
    while (i >= 0){
      let v = 1;
      const pre = t.slice(Math.max(0, i - 2), i);
      if (SENT_NEG_MARK.some(function(n){ return pre.indexOf(n) >= 0; })) v = -1;
      if (SENT_INTENS.some(function(n){ return pre.indexOf(n) >= 0; })) v *= 1.5;
      score += v; hits.push((v > 0 ? '+' : '−') + w);
      i = t.indexOf(w, i + w.length);
    }
  });
  SENT_NEG.forEach(function(w){
    let i = t.indexOf(w);
    while (i >= 0){
      let v = -1;
      const pre = t.slice(Math.max(0, i - 2), i);
      if (SENT_INTENS.some(function(n){ return pre.indexOf(n) >= 0; })) v *= 1.5;
      score += v; hits.push('−' + w);
      i = t.indexOf(w, i + w.length);
    }
  });
  const norm = Math.max(-1, Math.min(1, score / 3));
  return {score: norm, hits: hits,
          label: norm > 0.2 ? '正向' : (norm < -0.2 ? '負向' : '中性')};
}
