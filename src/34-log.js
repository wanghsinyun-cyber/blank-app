/* ==========================================================================
   34-log.js — 系統日誌：事件結構、打字遙測、示範資料生成、匯出格式
   示範日誌不寫進 localStorage，而是每次載入時由固定種子重算（可重現且不占空間）；
   使用者自己操作產生的事件才寫入 state.logs。
   ========================================================================== */

/* 行為編碼（供延宕序列分析使用） */
const BEHAVIOR_CODES = [
  {code:'M',  name:'標記題幹',   desc:'點選題幹中的一句，標記自己正在看的條件。'},
  {code:'O',  name:'選項點選',   desc:'點選或更改選項。'},
  {code:'W',  name:'書寫作答',   desc:'在作答區輸入或修改文字。'},
  {code:'Q−', name:'發話（低於）', desc:'學生發話，其歷程層次低於該題官方標定。'},
  {code:'Q0', name:'發話（等於）', desc:'學生發話，其歷程層次等於該題官方標定。'},
  {code:'Q+', name:'發話（高於）', desc:'學生發話，其歷程層次高於該題官方標定。'},
  {code:'A',  name:'代理人回應', desc:'AI 依回合排程提出一個問題。'},
  {code:'N',  name:'寫筆記',     desc:'對照組在「我的筆記」區書寫。'},
  {code:'C',  name:'自我檢核',   desc:'送出前勾選一項自我檢核。'},
  {code:'S',  name:'送出',       desc:'送出該題作答。'}
];
const BEHAVIOR_ORDER = BEHAVIOR_CODES.map(function(b){ return b.code; });
function behaviorName(c){ const b = BEHAVIOR_CODES.find(function(x){ return x.code === c; }); return b ? b.name : c; }

/* 送出前自我檢核項目（勾選與否由學生決定，勾選數記為後設認知監控指標） */
const SELF_CHECKS = [
  '我有把題目再讀過一次',
  '我有回到文章裡找依據，不是只憑印象',
  '我可以指出答案是從第幾段看出來的',
  '我有想過另一種讀法說不說得通',
  '我可以說出我為什麼選這個'
];

let DEMO_LOGS = [];      // 由種子重算，不持久化
let DEMO_DIALOG = [];    // 同上

function allLogs(){ return DEMO_LOGS.concat(state.logs || []); }
function allDialog(){ return DEMO_DIALOG.concat(state.dialog || []); }

/* 歷程事件必須自己負責落地。
   原本 logEvent 只 push 進記憶體，而作答期間唯一會 save() 的路徑是 aalSay()——
   於是 tutor／tutee／peer 每講一句話就順帶把 MARK／OPTION／CHECK 存下來，
   對照組整節課不觸發任何 save()，重整就全沒。歷程序列是依變項之一，
   這個遺失與實驗條件共變，會直接污染四條件的序列分析。
   尾緣節流（不可用前緣：前緣會掉最後一批），滿 20 筆或滿 2 秒就寫。 */
let _logFlushT = null, _logPending = 0;

function flushLogs(){
  clearTimeout(_logFlushT); _logFlushT = null; _logPending = 0;
  save();
}

function logEvent(o){
  state.logs = state.logs || [];
  state.logs.push(o);
  _logPending++;
  if (_logPending >= 20){ flushLogs(); return; }
  clearTimeout(_logFlushT);
  _logFlushT = setTimeout(flushLogs, 2000);
}

/* 切換型事件（MARK 的 on、CHECK 的 off）寫入端記的是「切換」，
   讀取端要折疊成「現在是開還是關」。兩邊各寫一次就會出現
   「勾了 7 / 5 項」這種數字。抽成共用工具，下一個切換型事件不會再犯。
   allLogs() 依時間順序串接，最後一筆自然勝出。 */
function foldToggleLog(logs, code, keyField){
  const on = {};
  logs.forEach(function(e){
    if (e.code !== code) return;
    if (e.off === true || e.on === false) delete on[e[keyField]];
    else on[e[keyField]] = 1;
  });
  return Object.keys(on);
}
/* 一批日誌裡，某一種切換型事件最後「還開著」有幾個。
   上面那條原則（寫入端記切換、讀取端必須折疊）本來只有 inspectMarks
   與唯讀重播的自我檢核兩處遵守，其餘讀取端一律數原始筆數——
   而取消標記寫的是 MARK/M 加 on:false、取消檢核寫的是 off:true，
   於是「點了又取消」被算成兩次。
   膨脹量與「反覆切換的傾向」共變，不是隨機誤差；而 checks 是
   64-stats.js 的 outcomeList 裡真的會跑 ANCOVA 的結果變項
   （每題只有 5 個檢核項，卻可能報出 9）。
   必須先依題目分組再折疊：不同題目的 sent／idx 會互相碰撞
   （每一題都有第 0 句、第 0 個檢核項）。 */
/* groupBy 決定「同一個切換的作用域」，一定要傳對：
   標記的作用域是**文本**不是題目——aalMark 寫的是 AAL.marks[it.unit]，
   句號 s.i 是整篇文本的全域序號，事件本身帶著 textId，畫面還明說
   「換題也不會消失」（T1 有十題共用一篇）。
   原本一律用 e.iid 分組：在第 1 題標了第 12 句、翻到第 5 題把它取消，
   兩筆落在不同組，取消變成 no-op，淨值恆為 1——而依 textId 折疊的
   inspectMarks 讀同一份日誌會給出另一個數字。
   而且原本完全不分學生：tutee 班某個孩子的取消動作會扣掉 tutor 班孩子的
   標記，四個實驗條件的行為污染同一個數字。 */
function foldedCount(logs, code, keyField, groupBy){
  const by = {};
  logs.forEach(function(e){
    if (e.code !== code) return;
    const k = groupBy ? groupBy(e) : ((e.sid || '_') + '|' + (e.iid || '_'));
    (by[k] = by[k] || []).push(e);
  });
  return Object.keys(by).reduce(function(n, k){
    return n + foldToggleLog(by[k], code, keyField).length;
  }, 0);
}
/* 兩種切換型事件各自的作用域。呼叫端一律用這兩支，不要自己傳 groupBy。 */
function markScope(e){ return (e.sid || '_') + '|' + (e.textId || e.iid || '_'); }
function checkScope(e){ return (e.sid || '_') + '|' + (e.iid || '_'); }
function foldedMarks(logs){ return foldedCount(logs, 'M', 'sent', markScope); }
function foldedChecks(logs){ return foldedCount(logs, 'C', 'idx', checkScope); }

/* 行為序列的共用取樣：只留真正的行為碼，並把「取消」排掉。
   62-process.js 的 enaLines 已經確立這條原則，但 lsa()、toSDIS()、
   toENACsv() 三個入口都沒有套用——取消標記／取消檢核照樣以一次完整動作
   進入轉移矩陣、GSEQ 序列檔與 rENA 寬表，M→M 的自轉移被「反覆切換」的孩子
   灌爆，單一受試者就能位移整個矩陣的調整殘差。
   RESUME 也一樣：它的 code 是 'R'，不在 BEHAVIOR_ORDER 裡，
   而那三個入口只檢查 `e.code` 有沒有值，於是它被當成一種行為，
   且只出現在中途離開再回來的人身上。 */
function behaviorSeq(logs){
  return logs.filter(function(e){
    return BEHAVIOR_ORDER.indexOf(e.code) >= 0 && !(e.on === false || e.off === true);
  });
}

/* --- 條件查詢 --- */
function conditionOfClass(cid){
  const k = state.classes.find(function(c){ return c.id === cid; });
  return k ? (k.condition || 'control') : 'control';
}
function conditionOfStudent(sid){
  const k = state.classes.find(function(c){ return c.studentIds.indexOf(sid) >= 0; });
  return k ? (k.condition || 'control') : 'control';
}
function classOfStudent(sid){
  return state.classes.find(function(c){ return c.studentIds.indexOf(sid) >= 0; });
}

/* ==========================================================================
   示範日誌生成
   四條件的行為型態依研究構想的理論預測而異：
   ‧ 導師：追問密集，學生發話多停在「等於題目歷程」
   ‧ 學生（可教代理人）：發話較長，較常出現「高於題目歷程」（要解釋就得推理）
   ‧ 同儕：發話量中等，情緒最正向，外在負荷較低（處理負擔分散）
   ‧ 對照：無對話，以筆記與重讀替代
   這些是模擬資料，用來示範分析管線，不得當成實徵結果。
   ========================================================================== */
/* 示範發話。三個池刻意寫成不同的認知層次，並且用得到 PROCESS_CUES 的線索詞，
   codeUtteranceProcess() 才抓得到訊號（BELOW≈直接提取、AT≈直接推論、
   ABOVE≈詮釋整合／比較評估）。 */
const DEMO_UTTER = {
  BELOW: ['這個答案是不是就寫在哪一句？', '我找到了，在第二段',
          '「傳播」這個詞的意思是什麼？', '文章有說他幾點出門嗎',
          '我先看看哪一段有出現這個詞', '這個要去哪裡找'],
  AT:    ['我選這個是因為前面說他每天推車', '我把兩句合起來看，所以他是想讓太太吃到柚子',
          '這裡的「它」指的是那棵柚子樹', '因為第三段說樹都在最亮的地方，所以他是在追太陽',
          '前面說陶盆很重，後面說他要停下來喘氣，這樣就接得起來',
          '我先確認題目在問哪一段'],
  ABOVE: ['我覺得作者是想告訴我們，有些奇怪的舉動背後藏著心意',
          '這裡的語氣有點難過，他停頓了一下才回答，感覺不想講',
          '如果換成不是老人家來搬，這個故事的感覺就完全不一樣了',
          '我想知道整篇的主題到底是柚子還是那個人的心情',
          '這樣寫真的可能嗎？我覺得作者沒說清楚樹是怎麼固定的',
          '比較起來，第二篇的說明有給例子，第一篇是用故事讓你自己想']
};
const DEMO_NOTE = ['先把整篇讀一次', '這句畫起來，等一下要用',
                   '「它」指的是柚子樹', '第三段講規律', '回去看第一段有沒有寫',
                   '這題問的是作者的想法，不是事情經過', '再確認一次是哪一段'];

/* 情緒語尾：讓模擬對話帶有可分析的情緒訊號。
   各條件的情緒分布依研究構想的理論預測設定（同儕最正向、對照最平淡）。 */
const MOOD_TAIL = {
  pos: ['，我好像懂了', '，這樣就對了吧', '，有道理', '，我知道了', '，原來如此'],
  neu: ['', '', '', ''],
  neg: ['，可是我不太懂', '，我卡住了', '，這題好難', '，我不知道對不對', '，有點亂']
};
const MOOD_P = {
  tutor:   {pos:0.25, neu:0.45},
  tutee:   {pos:0.35, neu:0.45},
  peer:    {pos:0.42, neu:0.43},
  control: {pos:0.16, neu:0.44}
};
function moodTail(cond, rnd){
  const p = MOOD_P[cond] || MOOD_P.control;
  const r = rnd();
  const bucket = r < p.pos ? 'pos' : (r < p.pos + p.neu ? 'neu' : 'neg');
  const pool = MOOD_TAIL[bucket];
  return pool[Math.floor(rnd() * pool.length)];
}

function buildDemoLogs(){
  const rnd = mulberry32(778899);
  const logs = [], dialog = [];
  const asg = getAssignment('a-post');
  if (!asg) { DEMO_LOGS = []; DEMO_DIALOG = []; return; }
  const items = asg.itemIds.map(getItem).filter(Boolean);

  assignmentRoster(asg).forEach(function(sid){
    const cond = conditionOfStudent(sid);
    const klass = classOfStudent(sid);
    const stu = getUser(sid);
    const ability = stu && stu.thetaTrue != null ? stu.thetaTrue : 0;
    const eng = stu && stu.engage != null ? stu.engage : 0.5;
    let t = (asg.createdAt || Date.now()) + Math.floor(rnd() * 3600e3);
    const t0 = t;

    items.forEach(function(it){
      const proc = it.process || 'FR';
      function push(type, code, extra){
        t += 900 + Math.floor(rnd() * 5200);
        const e = {t:t, rel:t - t0, sid:sid, cid:klass ? klass.id : null, cond:cond,
                   lang:'zh', aid:asg.id, iid:it.id, proc:proc, type:type, code:code};
        if (extra) Object.keys(extra).forEach(function(k){ e[k] = extra[k]; });
        logs.push(e);
        return e;
      }
      push('ENTER', null, {});
      // 逐句標記
      const nSent = splitSentences(it.stem).length;
      const nMark = 1 + Math.floor(rnd() * Math.min(3, nSent));
      /* textId 一定要帶。真實的 aalMark 帶了，示範產生器沒帶——
         而標記的折疊作用域是文本（foldedMarks 用 textId），
         少了它示範資料會退回「依題目分組」的舊行為，
         教師名單與唯讀重播因此給出兩個不同的數字。 */
      for (let i = 0; i < nMark; i++) push('MARK', 'M', {sent: Math.floor(rnd() * nSent), textId: it.unit, on: true});

      // 對話回合（對照組改為筆記）
      const base = cond === 'tutor' ? 4.2 : cond === 'tutee' ? 3.6 : cond === 'peer' ? 3.2 : 0;
      const nTurn = cond === 'control' ? 0
        : Math.max(1, Math.min(MAX_TURNS, Math.round(base * (0.55 + eng * 0.9) + (rnd() - 0.5))));

      if (cond === 'control'){
        /* NOTE 也要帶 turn，理由與 ASK 相同：sentimentTrajectory 依 turn 分桶，
           沒有這個欄位的話 `e.turn || 1` 會把對照組整條軌跡塞進第 1 回合，
           byTurn 的跨條件比較對 control 完全失效。
           筆數也比照對話回合的量級（每題最多 MAX_TURNS），
           不能讓對照組的分析單位密度高出一個數量級。 */
        const nNote = Math.min(MAX_TURNS, 1 + Math.round(2 * eng + rnd()));
        for (let i = 0; i < nNote; i++){
          push('NOTE', 'N', {text: DEMO_NOTE[Math.floor(rnd() * DEMO_NOTE.length)] + moodTail(cond, rnd),
                             turn: i + 1});
        }
      } else {
        for (let k = 0; k < nTurn; k++){
          // 相對歷程分布依條件與能力而異
          let pAbove = 0.16 + 0.30 * eng + 0.10 * Math.max(0, ability);
          if (cond === 'tutee') pAbove += 0.18;
          if (cond === 'tutor') pAbove -= 0.04;
          let pBelow = 0.34 - 0.22 * eng - 0.10 * Math.max(0, ability);
          if (cond === 'tutor') pBelow += 0.06;
          const r = rnd();
          const rel = r < pBelow ? 'BELOW' : (r < 1 - pAbove ? 'AT' : 'ABOVE');
          const pool = DEMO_UTTER[rel];
          const text = pool[Math.floor(rnd() * pool.length)] + moodTail(cond, rnd);
          const e = push('ASK', REL_SHORT[rel], {rel:rel, text:text, turn:k + 1,
                          sent: sentimentOf(text).score});
          dialog.push({t:e.t, sid:sid, cond:cond, aid:asg.id, iid:it.id, proc:proc,
                       turn:k + 1, speaker:'student', text:text, rel:rel,
                       ucode:codeUtteranceProcess(text), sent:sentimentOf(text).score});
          const a = agentTurn(cond, it, k, rnd);
          const ea = push('AI', 'A', {qfn:a.qfn, sub:a.sub, turn:k + 1, text:a.text});
          dialog.push({t:ea.t, sid:sid, cond:cond, aid:asg.id, iid:it.id, proc:proc,
                       turn:k + 1, speaker:'agent', text:a.text, qfn:a.qfn, sub:a.sub,
                       ucode:a.process, sent:0});
          if (rnd() < 0.35) push('MARK', 'M', {sent: Math.floor(rnd() * nSent), textId: it.unit, on: true});
        }
      }

      // 作答與打字遙測
      const nW = 1 + Math.floor(rnd() * 3);
      for (let i = 0; i < nW; i++) push('TYPE', 'W', {});
      const keys = 12 + Math.floor(rnd() * 60 * (it.type === 'cr' ? 3 : 1));
      push('TELEMETRY', null, {
        firstKeyLatency: Math.round(1200 + rnd() * 9000),
        keystrokes: keys,
        deletions: Math.round(keys * (0.06 + rnd() * 0.22)),
        longPauses: Math.floor(rnd() * 5)
      });
      if (it.type === 'mc'){
        const nO = 1 + (rnd() < 0.3 ? 1 : 0);
        for (let i = 0; i < nO; i++) push('OPTION', 'O', {});
      }
      // 送出前自我檢核：參與傾向越高勾越多
      const nC = Math.min(SELF_CHECKS.length, Math.round((0.4 + eng * 1.2) * (1 + rnd() * 2)));
      for (let i = 0; i < nC; i++) push('CHECK', 'C', {idx:i});
      push('SUBMIT', 'S', {selfCheck:nC});
      /* 停留時間的右邊界。示範產生器本來只寫 ENTER，
         沒有 EXIT 就配不成一次造訪，dwell 會退回 max−min 的舊算法。 */
      push('EXIT', null, {});
    });
  });

  DEMO_LOGS = logs;
  DEMO_DIALOG = dialog;
}

/* 題幹逐句切分（供逐句標記與 MARK 事件使用） */
function splitSentences(text){
  const t = String(text || '').trim();
  /* 句末標點後面如果緊跟著收尾符號（引號、括號），要一起吃進來。
     不吃的話，「……甜。」會被切成兩句，第二句的內容就只有一個「」」——
     那是一顆 aria-pressed 的按鈕，報讀器只唸得出一個標點，
     按下去還會寫一筆 MARK 事件進閱讀歷程資料。T1 因此多出 4 個標點句。 */
  const CLOSERS = '」』）》〉】"\'）)]}';
  function cut(str, marks){
    const out = []; let buf = '';
    for (let i = 0; i < str.length; i++){
      buf += str[i];
      if (marks.indexOf(str[i]) >= 0){
        while (i + 1 < str.length && CLOSERS.indexOf(str[i + 1]) >= 0){ buf += str[++i]; }
        out.push(buf.trim()); buf = '';
      }
    }
    if (buf.trim()) out.push(buf.trim());
    return out.filter(Boolean);
  }
  const parts = cut(t, '。？！；?!;');
  if (parts.length > 1) return parts;
  const alt = cut(t, '，,');
  return alt.length > 1 ? alt : [t];
}

/* ==========================================================================
   匯出格式
   ========================================================================== */

/* GSEQ SDIS：每位學生每一題一段序列，以 / 結束 */
function toSDIS(){
  /* GSEQ 序列檔同樣要走共用取樣（見 behaviorSeq） */
  const L = behaviorSeq(allLogs());
  const bySeq = {};
  L.forEach(function(e){
    const k = e.sid + '|' + e.iid;
    (bySeq[k] = bySeq[k] || []).push(e);
  });
  const out = ['Event'];
  out.push('% KAIROS AaL 事件序列（示範資料為模擬）');
  out.push('% 編碼：' + BEHAVIOR_CODES.map(function(b){ return b.code + '=' + b.name; }).join('  '));
  Object.keys(bySeq).sort().forEach(function(k){
    const p = k.split('|');
    const evs = bySeq[k].sort(function(a, b){ return a.t - b.t; });
    out.push('% sid=' + p[0] + ' cond=' + conditionOfStudent(p[0]) + ' item=' + p[1]);
    out.push(evs.map(function(e){ return sdisCode(e.code); }).join(' ') + ' /');
  });
  return out.join('\n');
}
/* SDIS 的編碼名稱不接受非 ASCII，轉為安全代號 */
const SDIS_MAP = {'M':'MARK', 'O':'OPT', 'W':'WRITE', 'Q−':'QLOW', 'Q0':'QAT', 'Q+':'QHIGH',
                  'A':'AGENT', 'N':'NOTE', 'C':'CHECK', 'S':'SUBMIT'};
function sdisCode(c){ return SDIS_MAP[c] || 'OTHER'; }

/* rENA 寬表 CSV：一列一個對話回合／事件，二元編碼欄可直接餵給 ena.accumulate.data() */
function toENACsv(){
  const rows = [['sid','name','class','grade','condition','lang','assignment','item','item_process',
                 'turn','speaker','rel_code','utterance',
                 'FR','SI','II','EE','BELOW','AT','ABOVE','POS','NEG','MARK','OPTION','WRITE','CHECK']];
  /* rENA 寬表同樣要走共用取樣（見 behaviorSeq） */
  const logs = behaviorSeq(allLogs()).slice().sort(function(a, b){ return a.t - b.t; });
  const dial = allDialog();
  const dialKey = {};
  dial.forEach(function(d){ dialKey[d.sid + '|' + d.iid + '|' + d.turn + '|' + d.speaker] = d; });

  logs.forEach(function(e){
    if (!e.code) return;
    const k = classOfStudent(e.sid);
    const d = e.turn ? dialKey[e.sid + '|' + e.iid + '|' + e.turn + '|' + (e.type === 'AI' ? 'agent' : 'student')] : null;
    const txt = (d && d.text) || e.text || '';
    const uc = d ? d.ucode : (e.code === 'A' ? (e.proc || '') : '');
    const rel = e.rel || (e.code === 'Q−' ? 'BELOW' : e.code === 'Q0' ? 'AT' : e.code === 'Q+' ? 'ABOVE' : '');
    const s = txt ? sentimentOf(txt) : {score:0};
    rows.push([
      e.sid, userName(e.sid), k ? k.name : '', k ? k.grade : '', e.cond, e.lang || 'zh',
      e.aid, e.iid, e.proc || '', e.turn || '', e.type === 'AI' ? 'agent' : (e.code === 'A' ? 'agent' : 'student'),
      rel, txt.replace(/\s+/g, ' '),
      uc === 'FR' ? 1 : 0, uc === 'SI' ? 1 : 0, uc === 'II' ? 1 : 0, uc === 'EE' ? 1 : 0,
      rel === 'BELOW' ? 1 : 0, rel === 'AT' ? 1 : 0, rel === 'ABOVE' ? 1 : 0,
      s.score > 0.2 ? 1 : 0, s.score < -0.2 ? 1 : 0,
      e.code === 'M' ? 1 : 0, e.code === 'O' ? 1 : 0, e.code === 'W' ? 1 : 0, e.code === 'C' ? 1 : 0
    ]);
  });
  return rows.map(function(r){
    return r.map(function(c){ return '"' + String(c).replace(/"/g, '""') + '"'; }).join(',');
  }).join('\n');
}

/* 每位學生每一題的遙測摘要（寬表） */
function toTelemetryCsv(){
  const rows = [['sid','name','class','condition','item','item_process',
                 'first_key_latency_ms','keystrokes','deletions','long_pauses',
                 'marks','option_clicks','turns','self_checks','dwell_ms','mean_sentiment']];
  const byKey = {};
  allLogs().forEach(function(e){
    const k = e.sid + '|' + e.iid;
    const r = byKey[k] = byKey[k] || {sid:e.sid, iid:e.iid, cond:e.cond, proc:e.proc,
      fkl:'', keys:'', del:'', pause:'', mEv:[], cEv:[], opts:0, turns:0, visits:[],
      t0:e.t, t1:e.t, sent:[], };
    r.t0 = Math.min(r.t0, e.t); r.t1 = Math.max(r.t1, e.t);
    /* 停留時間要用 ENTER→EXIT 的區間累加，不能用 max(t) − min(t)：
       aalSubmit 會在交卷的同一毫秒替每一題補寫 TELEMETRY 與 SUBMIT，
       於是第一題的 max−min 是整節課、最後一題趨近 0——量到的是題序。
       沒有邊界事件的舊資料才退回 max−min（見下面的 fallback）。 */
    if (e.type === 'ENTER') r.visits.push({in:e.t, out:null});
    if (e.type === 'EXIT'){
      const open = r.visits.filter(function(v){ return v.out === null; }).pop();
      if (open) open.out = e.t;
    }
    if (e.type === 'TELEMETRY'){ r.fkl = e.firstKeyLatency; r.keys = e.keystrokes; r.del = e.deletions; r.pause = e.longPauses; }
    /* 標記與檢核是切換型事件，取消也會寫一筆——不能在這裡 ++。
       先收起來，輸出時用 foldToggleLog 折成「最後還開著幾個」。
       這一列的鍵已經是 sid|iid，所以不需要再依題目分組。 */
    if (e.code === 'M') r.mEv.push(e);
    if (e.code === 'O') r.opts++;
    if (e.code === 'C') r.cEv.push(e);
    if (e.type === 'ASK'){ r.turns++; if (e.sent != null) r.sent.push(e.sent); }
  });
  Object.keys(byKey).forEach(function(k){
    const r = byKey[k], kl = classOfStudent(r.sid), it = getItem(r.iid);
    r.marks = foldToggleLog(r.mEv, 'M', 'sent').length;
    r.checks = foldToggleLog(r.cEv, 'C', 'idx').length;
    /* 有邊界事件就累加各次造訪；沒有（舊資料）才退回 max−min */
    const spans = r.visits.filter(function(v){ return v.out != null && v.out >= v.in; });
    r.dwell = spans.length
      ? spans.reduce(function(s, v){ return s + (v.out - v.in); }, 0)
      : (r.t1 - r.t0);
    rows.push([r.sid, userName(r.sid), kl ? kl.name : '', r.cond, r.iid, r.proc,
      r.fkl, r.keys, r.del, r.pause, r.marks, r.opts, r.turns, r.checks,
      r.dwell, r.sent.length ? (r.sent.reduce(function(a, b){ return a + b; }, 0) / r.sent.length).toFixed(3) : '']);
  });
  return rows.map(function(r){
    return r.map(function(c){ return '"' + String(c).replace(/"/g, '""') + '"'; }).join(',');
  }).join('\n');
}
