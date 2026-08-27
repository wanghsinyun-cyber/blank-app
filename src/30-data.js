/* ==========================================================================
   30-data.js — 領域內容與示範資料
   所有示範班級／作答／貼文皆為「模擬資料」，由固定亂數種子產生，
   每次載入結果一致，可重現，便於研究報告引用。
   ========================================================================== */

/* --- 固定種子亂數（mulberry32），確保示範資料可重現 --- */
function mulberry32(a){
  return function(){
    a |= 0; a = a + 0x6D2B79F5 | 0;
    var t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* --- 康軒教材單元（六冊；示範資料聚焦第三冊） --- */
const UNITS = [
  {id:'B1-1', book:1, grade:'七上', ch:'第1章', name:'整數的運算'},
  {id:'B1-2', book:1, grade:'七上', ch:'第2章', name:'分數的運算'},
  {id:'B1-3', book:1, grade:'七上', ch:'第3章', name:'一元一次方程式'},
  {id:'B1-4', book:1, grade:'七上', ch:'第4章', name:'二元一次聯立方程式'},
  {id:'B2-1', book:2, grade:'七下', ch:'第1章', name:'比例式'},
  {id:'B2-2', book:2, grade:'七下', ch:'第2章', name:'直角坐標與二元一次方程式的圖形'},
  {id:'B2-3', book:2, grade:'七下', ch:'第3章', name:'一元一次不等式'},
  {id:'B2-4', book:2, grade:'七下', ch:'第4章', name:'統計圖表'},
  {id:'B3-1', book:3, grade:'八上', ch:'第1章', name:'乘法公式與多項式'},
  {id:'B3-2', book:3, grade:'八上', ch:'第2章', name:'平方根與畢氏定理'},
  {id:'B3-3', book:3, grade:'八上', ch:'第3章', name:'因式分解'},
  {id:'B3-4', book:3, grade:'八上', ch:'第4章', name:'一元二次方程式'},
  {id:'B4-1', book:4, grade:'八下', ch:'第1章', name:'等差數列與級數'},
  {id:'B4-2', book:4, grade:'八下', ch:'第2章', name:'三角形的基本性質'},
  {id:'B4-3', book:4, grade:'八下', ch:'第3章', name:'平行與四邊形'},
  {id:'B5-1', book:5, grade:'九上', ch:'第1章', name:'相似形'},
  {id:'B5-2', book:5, grade:'九上', ch:'第2章', name:'圓形'},
  {id:'B5-3', book:5, grade:'九上', ch:'第3章', name:'幾何與證明'},
  {id:'B6-1', book:6, grade:'九下', ch:'第1章', name:'二次函數'},
  {id:'B6-2', book:6, grade:'九下', ch:'第2章', name:'統計與機率'},
  {id:'B6-3', book:6, grade:'九下', ch:'第3章', name:'立體圖形'}
];

/* --- 迷思概念代碼表：診斷不必依賴 LLM，誘答選項本身即攜帶概念標記 --- */
const MISCONCEPTIONS = [
  {id:'M1', name:'平方根只取正根',   desc:'解 x²=a 時只寫正根，忽略負根；把「平方根」與「算術平方根」混為一談。'},
  {id:'M2', name:'乘積為零未先移項', desc:'看到 A·B=k（k≠0）就直接令 A=k 或 B=k，誤用乘積為零性質。'},
  {id:'M3', name:'根號可逐項相加',   desc:'把 √a+√b 當成 √(a+b)，將根號視為線性運算。'},
  {id:'M4', name:'判別式判讀錯誤',   desc:'只看 b² 或忽略 −4ac 的符號，誤判實根個數。'},
  {id:'M5', name:'十字交乘配錯',     desc:'因式分解時交叉相乘的配對與檢驗步驟省略，常數項與一次項對不上。'},
  {id:'M6', name:'股與斜邊混淆',     desc:'套畢氏定理時未先辨認斜邊，直接把已知兩邊當兩股相加。'},
  {id:'M7', name:'根與係數符號',     desc:'兩根和寫成 b/a、兩根積符號顛倒，忽略公式中的負號。'}
];

/* --- 題庫：仿國中教育會考題型（示範用自編題，非官方原題） --- */
const ITEMS = [
  {id:'Q01', year:112, no:8,  unit:'B3-4', type:'mc', diff:'基礎',
   stem:'若 x² = 49，則下列哪一個是 x 的所有可能值？',
   options:['x = 7','x = 7 或 x = −7','x = 7 或 x = 0','x = 24.5'], answer:1,
   why:{0:'M1',2:null,3:null},
   note:'考「平方根有正負兩個」的基本認識。',
   tags:['平方根','一元二次方程式']},

  {id:'Q02', year:110, no:11, unit:'B3-4', type:'mc', diff:'基礎',
   stem:'若 (x − 3)(x + 5) = 0，則 x 的值為何？',
   options:['3 或 −5','−3 或 5','3 或 5','−3 或 −5'], answer:0,
   why:{1:'M7',2:'M7',3:'M7'},
   note:'乘積為零性質的直接應用，並檢查符號處理。',
   tags:['乘積為零','一元二次方程式']},

  {id:'Q03', year:113, no:19, unit:'B3-4', type:'mc', diff:'中等',
   stem:'小華解方程式 x(x − 4) = 5 時，寫下「x = 5 或 x − 4 = 5」，因此得到 x = 5 或 x = 9。他的做法錯在哪裡？',
   options:[
     '沒有先把方程式整理成一邊為 0，乘積為零性質才能使用',
     '沒有把括號展開，展開後才可以分解',
     '5 不是質數，所以不能拆成兩數相乘',
     '他的做法沒有錯，答案就是 5 和 9'],
   answer:0,
   why:{1:null,2:null,3:'M2'},
   note:'直指「乘積為零」的成立條件，是本單元最關鍵的程序性理解。',
   tags:['乘積為零','解題監控']},

  {id:'Q04', year:111, no:14, unit:'B3-4', type:'mc', diff:'中等',
   stem:'用配方法解 x² + 6x − 7 = 0，先把常數項移到等號右邊得 x² + 6x = 7。接下來等號兩邊要同時加上多少，左邊才會成為完全平方式？',
   options:['9','6','36','3'], answer:0,
   why:{1:null,2:null,3:null},
   note:'配方法的核心步驟：加上一次項係數一半的平方。',
   tags:['配方法']},

  {id:'Q05', year:114, no:17, unit:'B3-4', type:'mc', diff:'中等',
   stem:'關於 x 的方程式 2x² − 4x + 5 = 0，其實數根的情形為何？',
   options:['有兩相異實根','有兩相等實根','沒有實數根','無法判斷'], answer:2,
   why:{0:'M4',1:'M4',3:null},
   note:'判別式 b² − 4ac = 16 − 40 = −24 < 0。',
   tags:['判別式']},

  {id:'Q06', year:109, no:20, unit:'B3-4', type:'mc', diff:'進階',
   stem:'設 α、β 為方程式 x² − 5x + 6 = 0 的兩根，則 α + β 之值為何？',
   options:['5','−5','6','−6'], answer:0,
   why:{1:'M7',2:'M7',3:'M7'},
   note:'根與係數關係：兩根和 = −b/a。',
   tags:['根與係數']},

  {id:'Q07', year:112, no:5,  unit:'B3-2', type:'mc', diff:'基礎',
   stem:'計算 √16 + √9 之值為何？',
   options:['5','7','25','√25'], answer:1,
   why:{0:'M3',2:null,3:'M3'},
   note:'檢驗學生是否把根號當成可以逐項相加的線性運算。',
   tags:['平方根']},

  {id:'Q08', year:113, no:9,  unit:'B3-2', type:'mc', diff:'基礎',
   stem:'計算 √((−5)²) 之值為何？',
   options:['−5','5','±5','25'], answer:1,
   why:{0:'M1',2:'M1',3:null},
   note:'算術平方根恆為非負；與「x²=25 的解」是不同的問題。',
   tags:['平方根','算術平方根']},

  {id:'Q09', year:110, no:6,  unit:'B3-2', type:'mc', diff:'基礎',
   stem:'一個直角三角形的兩股長分別為 6 與 8，則斜邊長為何？',
   options:['10','14','√14','100'], answer:0,
   why:{1:'M6',2:'M6',3:null},
   note:'最基本的畢氏定理應用，作為能力錨點題。',
   tags:['畢氏定理']},

  {id:'Q10', year:111, no:16, unit:'B3-2', type:'mc', diff:'中等',
   stem:'一個直角三角形的斜邊長為 13，其中一股長為 5，則另一股長為何？',
   options:['12','√194','18','8'], answer:0,
   why:{1:'M6',2:'M6',3:null},
   note:'必須先辨認斜邊，再用 13² − 5² 求另一股。',
   tags:['畢氏定理']},

  {id:'Q11', year:109, no:7,  unit:'B3-3', type:'mc', diff:'基礎',
   stem:'將 x² − 9 因式分解，結果為何？',
   options:['(x − 3)(x + 3)','(x − 3)²','(x − 9)(x + 1)','無法因式分解'], answer:0,
   why:{1:null,2:'M5',3:null},
   note:'平方差公式的直接應用。',
   tags:['因式分解','平方差']},

  {id:'Q12', year:114, no:13, unit:'B3-3', type:'mc', diff:'中等',
   stem:'將 2x² + 7x + 3 因式分解，結果為何？',
   options:['(2x + 1)(x + 3)','(2x + 3)(x + 1)','(x + 1)(x + 3)','(2x + 7)(x + 3)'], answer:0,
   why:{1:'M5',2:'M5',3:'M5'},
   note:'十字交乘後必須回頭檢驗一次項係數。',
   tags:['因式分解','十字交乘']},

  {id:'Q13', year:113, no:22, unit:'B3-4', type:'mc', diff:'進階',
   stem:'一塊長方形花圃的長比寬多 3 公尺，面積為 40 平方公尺。若設寬為 x 公尺，下列哪一個式子與求 x 的過程一致，且 x 的值為何？',
   options:[
     'x(x + 3) = 40，x = 5',
     'x(x + 3) = 40，x = 8',
     'x + (x + 3) = 40，x = 18.5',
     '2x(x + 3) = 40，x = 4'],
   answer:0,
   why:{1:'M2',2:null,3:null},
   note:'佈題到解方程式的完整歷程，並檢查是否誤把長當成寬。',
   tags:['一元二次方程式','應用問題']},

  {id:'Q14', year:112, no:24, unit:'B3-4', type:'mc', diff:'進階',
   stem:'兩個連續正整數的乘積為 156，則較小的那一個整數為何？',
   options:['12','13','11','14'], answer:0,
   why:{1:null,2:'M5',3:null},
   note:'設 x(x+1)=156，整理為 x²+x−156=0 後分解。',
   tags:['一元二次方程式','應用問題']},

  {id:'C01', year:113, no:2, unit:'B3-4', type:'cr', diff:'中等',
   stem:'請解方程式 2x² − 7x + 3 = 0，並在過程中清楚說明你使用的方法（因式分解、配方法或公式解擇一即可），最後檢驗你的答案。',
   options:[], answer:null, why:{},
   note:'非選題：評閱重點在方法選擇的合理性、運算正確性與檢驗習慣。',
   tags:['一元二次方程式','解題表達']},

  {id:'C02', year:114, no:1, unit:'B3-2', type:'cr', diff:'中等',
   stem:'小明說：「因為 x² = 25，所以 x = 5。」請判斷他的說法是否完整，說明你的理由，並舉一個具體例子支持你的說明。',
   options:[], answer:null, why:{},
   note:'非選題：直接對應「平方根只取正根」迷思，適合作為知識建構的起點問題。',
   tags:['平方根','數學論證']}
];

/* --- 知識建構支架（Knowledge Forum scaffolds，理論建構組） --- */
const SCAFFOLDS = [
  {id:'s1', cls:'sc1', label:'我的理論',           hint:'我目前認為……'},
  {id:'s2', cls:'sc2', label:'我需要理解',         hint:'我還不清楚的是……'},
  {id:'s3', cls:'sc3', label:'新的資訊',           hint:'我找到／查到……'},
  {id:'s4', cls:'sc4', label:'這個理論無法解釋',   hint:'如果照這個說法，那……就說不通'},
  {id:'s5', cls:'sc5', label:'更好的理論',         hint:'把前面的想法改成……會更好，因為……'},
  {id:'s6', cls:'sc6', label:'綜合我們的知識',     hint:'把大家的想法放在一起看，可以說……'}
];

/* --- 領域詞彙表：用於詞彙成長與論述深度的離線計算 --- */
const DOMAIN_TERMS = [
  '平方根','算術平方根','正根','負根','根號','完全平方','配方法','判別式','公式解',
  '因式分解','十字交乘','平方差','乘積為零','移項','一次項','常數項','係數','實根',
  '重根','兩根和','兩根積','根與係數','畢氏定理','斜邊','股','驗算','反例','定義域','非負'
];

/* 論述品質線索詞（離線引擎用；對應 Knowledge Building 論述特徵） */
const EPISTEMIC_CUES = {
  causal:   ['因為','所以','由於','導致','之所以','原因是'],
  conditional:['如果','假設','若','當……時','就會','則'],
  counter:  ['反例','但是','可是','不過','然而','並不','未必','不一定'],
  evidence: ['課本','查到','資料','老師說','例子','舉例','實際算','代入','驗算','試試看'],
  revision: ['修正','改成','原本以為','後來發現','更精確','補充','重新'],
  question: ['為什麼','怎麼','是不是','會不會','？','疑問']
};

const STUDENT_NAMES = [
  '王品瑄','陳柏宇','林芷妍','張家豪','李映彤','黃冠廷','吳采庭','劉宸希',
  '蔡宜蓁','鄭皓翔','許雅筑','曾于哲','謝亦辰','洪詩涵','周廷叡','施函潔',
  '賴思妤','高睿謙','葉柏翰','莊心怡','邱奕安','潘語彤','杜宥辰','馮筱恩'
];

/* 非選題作答文字（模擬）：依學生能力與是否持有相關迷思產生不同版本 */
function crText(it, s, mode, rnd){
  const strong = s.thetaTrue > 0.4;
  const grew = mode === 'post' && s.engage > 0.45;
  if (it.id === 'C01'){
    if (strong || grew){
      return '2x²−7x+3=0\n用十字交乘：(2x−1)(x−3)=0\n所以 2x−1=0 或 x−3=0\nx=1/2 或 x=3\n檢驗：2×(1/2)²−7×(1/2)+3=0.5−3.5+3=0 ✓；2×9−21+3=0 ✓';
    }
    if (s.thetaTrue > -0.6){
      return '2x²−7x+3=0\n用公式解 x=(7±√(49−24))/4=(7±5)/4\nx=3 或 x=1/2\n（沒有檢驗）';
    }
    return '2x²−7x+3=0\n我把 3 移過去變 2x²−7x=−3\n然後 x(2x−7)=−3\n所以 x=−3 或 2x−7=−3 → x=2';
  }
  // C02
  if (s.held.indexOf('M1') >= 0 && !(mode === 'post' && s.engage > 0.5)){
    return '我覺得小明是對的，因為 5×5=25，所以 x=5。';
  }
  if (strong || grew){
    return '不完整。x²=25 是在問「哪些數的平方是 25」，(−5)²=25 也成立，所以 x=5 或 x=−5。\n例子：如果 x 代表溫度變化，−5 是有意義的，不能刪掉。\n但如果題目是化簡 √25，答案只有 5，因為 √ 被定義成取非負的那一個。';
  }
  return '不太對，應該還有 −5，因為負負得正。';
}

/* ==========================================================================
   示範資料建構
   ========================================================================== */
function buildSeedState(){
  // 亂數用固定種子 → 作答矩陣與貼文結構每次載入完全一致（可重現）；
  // 只有時間戳記跟著今天走，示範資料看起來才不會過期。
  const rnd = mulberry32(20250827);
  const today = new Date(); today.setHours(8, 0, 0, 0);
  const now = today.getTime();
  const DAY = 86400000;

  const users = [
    {id:'u-admin', name:'系統管理員', email:'admin@kidforum.tw', role:'admin'},
    {id:'u-t1',    name:'王慧敏 老師', email:'teacher@kidforum.tw', role:'teacher'}
  ];

  /* --- 四個班級：以班級為單位分派到四條件（叢集隨機分派） ---
     班級 1 沿用原本的 24 位同學，也是知識建構空間的示範班級。 */
  const CLASS_DEFS = [
    {id:'c-1', name:'114 學年 八年 3 班', grade:'八年級', code:'MTH314', condition:'tutor'},
    {id:'c-2', name:'114 學年 八年 4 班', grade:'八年級', code:'MTH425', condition:'tutee'},
    {id:'c-3', name:'114 學年 八年 5 班', grade:'八年級', code:'MTH536', condition:'peer'},
    {id:'c-4', name:'114 學年 八年 6 班', grade:'八年級', code:'MTH647', condition:'control'}
  ];
  const misPool = ['M1','M2','M3','M4','M5','M6','M7'];
  const classes = [];
  const students = [];
  let sn = 0;

  CLASS_DEFS.forEach(function(def, ci){
    const ids = [];
    for (let i = 0; i < 24; i++){
      sn++;
      const name = ci === 0 ? STUDENT_NAMES[i] : genName(rnd);
      const theta = -1.7 + 3.5 * (i + 0.5) / 24 + (rnd() - 0.5) * 0.7;
      // 七種迷思在班上輪流分配，確保每一種都有幾位持有者，且橫跨各種能力
      // —— 高能力學生也可能持有頑固迷思，這正是 KIDMAP 第二象限要抓的人。
      const held = [];
      if (i % 4 !== 3) held.push(misPool[i % misPool.length]);
      if (rnd() < 0.3){
        const m2 = misPool[(i * 3 + 2) % misPool.length];
        if (held.indexOf(m2) < 0) held.push(m2);
      }
      const s = {id:'u-s' + sn, name:name, email:'s' + sn + '@kidforum.tw', role:'student',
                 thetaTrue:theta, held:held, engage:rnd(), classId:def.id};
      students.push(s); users.push(s); ids.push(s.id);
    }
    classes.push({id:def.id, name:def.name, grade:def.grade, code:def.code,
                  condition:def.condition, teacherId:'u-t1', studentIds:ids,
                  createdAt: now - 30 * DAY});
  });
  const allClassIds = classes.map(function(c){ return c.id; });

  /* 兩次派題：同一份題本、同一次校準，四班共用 → 條件間可比 */
  const preIds = ITEMS.map(function(it){ return it.id; });
  const pre = {
    id:'a-pre', title:'八上 · 一元二次方程式與平方根 前測', desc:'先看看大家目前的想法，答錯沒關係，等一下我們一起討論。',
    classIds: allClassIds, teacherId:'u-t1', itemIds: preIds, phase:'pre',
    createdAt: now - 12 * DAY, due: now - 9 * DAY
  };
  const post = {
    id:'a-post', title:'八上 · 一元二次方程式與平方根 評量即學習事件（後測）',
    desc:'這一節你會一邊作答一邊跟你的夥伴討論。答錯沒關係，重點是把想法說出來。',
    classIds: allClassIds, teacherId:'u-t1', itemIds: preIds, phase:'post', linkedTo:'a-pre',
    aal: true, createdAt: now - 1 * DAY, due: now + 3 * DAY
  };

  /* --- 作答矩陣（依 Rasch 機率 + 迷思規則產生） --- */
  const itemB = {};   // 題目真實難度
  ITEMS.forEach(function(it){
    const base = it.diff === '基礎' ? -1.1 : (it.diff === '中等' ? 0.15 : 1.2);
    itemB[it.id] = base + (rnd() - 0.5) * 0.5;
  });

  function distractorFor(it, mis){
    if (mis){
      const hit = Object.keys(it.why || {}).filter(function(k){ return it.why[k] === mis; });
      if (hit.length) return parseInt(hit[Math.floor(rnd() * hit.length)], 10);
    }
    // 非迷思造成的錯誤：在所有非正解選項中「等機率」挑一個
    const pool = [];
    for (let k = 0; k < it.options.length; k++) if (k !== it.answer) pool.push(k);
    return pool[Math.floor(rnd() * pool.length)];
  }

  const responses = [];
  const submissions = [];

  /* 條件對後測能力的模擬效果（依研究構想的理論推導；模擬資料，非實徵結果） */
  const CONDITION_GAIN = {tutee:0.42, peer:0.30, tutor:0.26, control:0.04};
  const CONDITION_FIX  = {tutee:0.30, peer:0.22, tutor:0.20, control:0.02};

  function runAssignment(asg, mode){
    students.forEach(function(s){
      const cond = (classes.find(function(c){ return c.id === s.classId; }) || {}).condition || 'control';
      // 後測：迷思是否被討論修正，與共構參與度及所分派的條件有關
      const fixed = {};
      if (mode === 'post'){
        s.held.forEach(function(m){
          const p = 0.18 + 0.45 * s.engage + (CONDITION_FIX[cond] || 0);
          fixed[m] = rnd() < p;
        });
      }
      const gain = mode === 'post'
        ? (0.10 + 0.35 * s.engage + (CONDITION_GAIN[cond] || 0)) : 0;
      let done = 0;
      ITEMS.forEach(function(it){
        if (it.type === 'cr'){
          const txt = crText(it, s, mode, rnd);
          responses.push({aid:asg.id, sid:s.id, iid:it.id, text:txt, strokes:null,
                          score:null, comment:'', correct:null});
          return;
        }
        const relevant = s.held.filter(function(m){
          return Object.keys(it.why || {}).some(function(k){ return it.why[k] === m; });
        });
        const active = relevant.filter(function(m){ return !fixed[m]; });
        let choice, correct;
        if (active.length && rnd() < 0.9){
          choice = distractorFor(it, active[0]);
          correct = (choice === it.answer);
        } else {
          const p = 1 / (1 + Math.exp(-((s.thetaTrue + gain) - itemB[it.id])));
          correct = rnd() < p;
          if (correct) choice = it.answer;
          else choice = distractorFor(it, null);
        }
        responses.push({aid:asg.id, sid:s.id, iid:it.id, choice:choice, correct:correct});
        done++;
      });
      if (done) submissions.push({aid:asg.id, sid:s.id, at: asg.createdAt + DAY + rnd() * DAY});
    });
  }
  runAssignment(pre, 'pre');
  runAssignment(post, 'post');

  /* --- 知識建構視圖與貼文 --- */
  const views = [];
  const notes = [];
  const S = {};   // 依姓名索引學生 id（僅班級 1，知識建構的示範班級）
  const kbStudents = students.filter(function(s){ return s.classId === 'c-1'; });
  kbStudents.forEach(function(s){ S[s.name] = s.id; });

  const v1 = {
    id:'v-1', title:'x² = 25 的答案只有 5 嗎？', createdAt: now - 8 * DAY,
    desc:'從前測第 8 題與非選第 1 題長出來的共同問題：平方根到底有幾個？',
    origin:{aid:'a-pre', iid:'Q01', mis:'M1'}, links:['v-2']
  };
  const v2 = {
    id:'v-2', title:'什麼時候才可以說「其中一個是 0」？', createdAt: now - 7 * DAY,
    desc:'乘積為零性質的成立條件，以及為什麼 x(x−4)=5 不能直接拆。',
    origin:{aid:'a-pre', iid:'Q03', mis:'M2'}, links:['v-1']
  };
  const v3 = {
    id:'v-3', title:'我們班的解方程式工具箱', createdAt: now - 4 * DAY,
    desc:'把因式分解、配方法、公式解放在一起比較：什麼時候用哪一個比較省力？',
    origin:null, links:['v-1','v-2']
  };
  views.push(v1, v2, v3);

  let nSeq = 0;
  function mkNote(o){
    nSeq++;
    const n = {
      id:'n-' + nSeq,
      viewId:o.v, title:o.t,
      segs:o.segs || [],
      authorIds:o.a.map(function(nm){ return S[nm] || nm; }),
      keywords:o.k || [],
      createdAt:o.at,
      editedAt:o.ed || null,
      x:o.x, y:o.y,
      kind:o.kind || 'note',
      buildOn:o.bo || null,
      contains:o.contains || [],
      refs:o.refs || [],
      itemRef:o.item || null,
      reads:[],
      annotations:o.ann || []
    };
    notes.push(n);
    return n;
  }

  /* v-1：從迷思長出來的探究 */
  mkNote({v:'v-1', t:'【全班共同問題】為什麼有人 x²=49 只寫 7？', kind:'problem',
    a:['u-t1'], at:now - 8*DAY, x:60, y:40, k:['平方根','負根'],
    item:{aid:'a-pre', iid:'Q01'},
    segs:[{s:'s2', text:'前測第 8 題（x² = 49）有好幾位同學只寫了 x = 7。有趣的是，這些同學在比較難的題目上多半答得出來——照他們的能力，這一題本來應該會。我們一起來弄清楚：平方根到底有幾個？什麼時候要寫 ±？'}]});

  mkNote({v:'v-1', t:'我覺得就是 7 啊', a:['王品瑄'], at:now - 8*DAY + 3600e3, x:330, y:36, k:['平方根'],
    segs:[{s:'s1', text:'我算的時候是想「7 乘 7 等於 49」，所以答案就是 7。按計算機按 √49 出來也是 7，沒有出現負號。'}]});

  mkNote({v:'v-1', t:'可是 (−7)×(−7) 也是 49', a:['陳柏宇'], at:now - 8*DAY + 7200e3, x:600, y:30,
    bo:'n-2', k:['負根','反例'],
    segs:[{s:'s4', text:'如果答案只有 7，那 (−7)×(−7)=49 這件事要怎麼辦？它明明也符合「平方等於 49」。'},
          {s:'s1', text:'我的想法是：問「平方等於 49 的數」跟問「√49 是多少」根本是兩個問題。'}]});

  mkNote({v:'v-1', t:'計算機為什麼只給我一個答案？', a:['林芷妍'], at:now - 7*DAY, x:330, y:190,
    bo:'n-2', k:['算術平方根'],
    segs:[{s:'s2', text:'我需要理解的是：如果真的有兩個答案，為什麼計算機按 √49 只給 7？是計算機壞掉還是我們定義錯了？'}]});

  mkNote({v:'v-1', t:'課本上「√」有特別的規定', a:['蔡宜蓁','鄭皓翔'], at:now - 7*DAY + 5400e3, x:600, y:180,
    bo:'n-4', k:['算術平方根','定義','非負'],
    segs:[{s:'s3', text:'我回去翻課本第 2 章，上面寫「a 的算術平方根 √a 指的是非負的那一個」。所以 √49 只會是 7，這是規定，不是算錯。'},
          {s:'s1', text:'那 x²=49 是在問「哪些數平方後等於 49」，跟符號 √ 要給哪一個答案是兩回事。'}]});

  mkNote({v:'v-1', t:'那第 9 題 √((−5)²) 呢？', a:['黃冠廷'], at:now - 7*DAY + 9000e3, x:870, y:176,
    bo:'n-5', k:['算術平方根'], item:{aid:'a-pre', iid:'Q08'},
    segs:[{s:'s2', text:'照上面的說法，√((−5)²)=√25=5，不能寫 −5，因為 √ 只給非負的那個。我本來寫 −5，現在知道錯在哪了。'}]});

  mkNote({v:'v-1', t:'我把兩個問題分開寫寫看', a:['吳采庭'], at:now - 6*DAY, x:60, y:300, k:['負根','表徵'],
    bo:'n-1',
    segs:[{s:'s5', text:'我想把它整理成兩行：\n（1）x² = 49 → x = 7 或 x = −7，因為在問「所有平方後是 49 的數」。\n（2）√49 = 7，因為 √ 這個符號被規定只取非負的那個。\n兩行都對，重點是題目在問哪一件事。'}]});

  mkNote({v:'v-1', t:'用面積畫圖也說得通', a:['劉宸希'], at:now - 6*DAY + 3600e3, x:330, y:330,
    bo:'n-7', k:['表徵','幾何'],
    segs:[{s:'s3', text:'如果 x 是正方形的邊長，那 x²=49 只能取 7，因為邊長不可能是負的。'},
          {s:'s4', text:'但如果 x 只是一個數，不代表長度，那就沒有理由把 −7 丟掉。所以「有沒有負根」還要看題目的情境。'}]});

  mkNote({v:'v-1', t:'那什麼時候要寫 ±，我做了一張判斷表', a:['許雅筑','洪詩涵'], at:now - 5*DAY, x:600, y:330,
    bo:'n-7', k:['平方根','判斷準則'],
    segs:[{s:'s5', text:'我們整理出三種情況：\n・題目是「解方程式 x²=a」→ 寫 x = ±√a。\n・題目是「化簡 √a」→ 只寫非負的那個。\n・題目有實際情境（長度、時間、人數）→ 先算出 ± 兩個，再把不合理的那個刪掉並寫理由。'}]});

  mkNote({v:'v-1', t:'【躍升】平方根：我們班目前的共同理解', kind:'rise',
    a:['u-t1','吳采庭','許雅筑'], at:now - 4*DAY, x:870, y:330,
    contains:['n-3','n-5','n-7','n-9'], k:['共同理解','平方根'],
    segs:[{s:'s6', text:'把大家的想法放在一起，我們現在同意三件事：\n1. 「x²=a 的解」和「√a 的值」是兩個不同的問題，不能互相取代。\n2. √ 這個符號被定義成只取非負值，所以 √((−5)²)=5。\n3. 解方程式時先寫出 ± 兩個根，再依題目情境決定要不要捨去，捨去時一定要寫理由。'},
          {s:'s2', text:'還沒解決的是：如果 a 是負數，x²=a 有沒有解？這個問題我們留到下一個視圖。'}],
    refs:[{noteId:'n-5', quote:'a 的算術平方根 √a 指的是非負的那一個'}]});

  /* v-2：乘積為零 */
  mkNote({v:'v-2', t:'【全班共同問題】x(x−4)=5 可以直接拆嗎？', kind:'problem',
    a:['u-t1'], at:now - 7*DAY, x:60, y:40, k:['乘積為零'],
    item:{aid:'a-pre', iid:'Q03'},
    segs:[{s:'s2', text:'前測第 19 題有不少同學認為小華的做法沒問題。請大家想清楚：「兩數相乘等於 0」跟「兩數相乘等於 5」，為什麼待遇不一樣？'}]});

  mkNote({v:'v-2', t:'我本來也覺得可以拆', a:['張家豪'], at:now - 7*DAY + 3600e3, x:330, y:36,
    bo:'n-11', k:['乘積為零'],
    segs:[{s:'s1', text:'我以為只要是「兩個東西相乘等於某個數」，就可以讓其中一個等於那個數。所以我寫 x=5 或 x−4=5。'}]});

  mkNote({v:'v-2', t:'那 2×3=6，是不是 2=6？', a:['曾于哲'], at:now - 7*DAY + 6000e3, x:600, y:30,
    bo:'n-12', k:['反例'],
    segs:[{s:'s4', text:'如果照那個說法，2×3=6 就要推出 2=6 或 3=6，這明顯不對。所以「相乘等於某個數」不能亂拆。'}]});

  mkNote({v:'v-2', t:'0 有一個別人沒有的性質', a:['謝亦辰'], at:now - 6*DAY, x:600, y:170,
    bo:'n-12', k:['乘積為零','唯一性'],
    segs:[{s:'s3', text:'課本寫：若 ab=0，則 a=0 或 b=0。這只有 0 成立，因為要讓乘積變成 0，一定得有一個因數是 0。'},
          {s:'s1', text:'但 ab=5 的話，a 可以是 1、2.5、10……有無限多種組合，所以拆不出唯一結果。'}]});

  mkNote({v:'v-2', t:'我驗算了小華的答案', a:['周廷叡'], at:now - 6*DAY + 4000e3, x:330, y:190,
    bo:'n-12', k:['驗算'],
    segs:[{s:'s3', text:'把 x=5 代回去：5×(5−4)=5×1=5，居然對！但 x=9 代回去：9×(9−4)=9×5=45≠5，就錯了。'},
          {s:'s4', text:'所以那個做法有時候「碰巧」對，這反而更危險，因為會讓人以為方法是對的。'}]});

  mkNote({v:'v-2', t:'正確的做法應該是先移項', a:['施函潔','賴思妤'], at:now - 5*DAY, x:870, y:170,
    bo:'n-15', k:['移項','乘積為零'],
    segs:[{s:'s5', text:'先整理成 x²−4x−5=0，再分解成 (x−5)(x+1)=0，這時候右邊是 0，才可以說 x−5=0 或 x+1=0，得到 x=5 或 x=−1。'},
          {s:'s3', text:'把 x=−1 代回原式：(−1)×(−1−4)=(−1)×(−5)=5，正確。所以少掉的那個根是 −1。'}]});

  mkNote({v:'v-2', t:'【躍升】乘積為零性質的使用條件', kind:'rise',
    a:['u-t1','謝亦辰','施函潔'], at:now - 4*DAY, x:870, y:330,
    contains:['n-13','n-14','n-16'], k:['共同理解','乘積為零'],
    segs:[{s:'s6', text:'我們的共同結論：\n1. 乘積為零性質只在「一邊等於 0」時可以用，因為 0 是唯一「一定要有因數為 0」的乘積。\n2. 所以解方程式的第一步永遠是移項成「＝0」。\n3. 碰巧代對不代表方法對，一定要把所有根都代回去檢查。'}]});

  /* v-3：工具箱 */
  mkNote({v:'v-3', t:'三種解法什麼時候用？', kind:'problem', a:['u-t1'], at:now - 4*DAY, x:60, y:40,
    k:['因式分解','配方法','公式解'],
    segs:[{s:'s2', text:'因式分解、配方法、公式解都能解一元二次方程式。我們來整理出「看到題目時怎麼決定」的判斷流程。'}]});

  mkNote({v:'v-3', t:'我先試因式分解，不行再用公式', a:['高睿謙'], at:now - 3*DAY, x:330, y:36,
    bo:'n-18', k:['解題策略'],
    segs:[{s:'s1', text:'如果係數是小整數，通常十字交乘很快；卡住超過三十秒我就改用公式解，比較不會浪費時間。'}]});

  mkNote({v:'v-3', t:'判別式可以先幫我們過濾', a:['莊心怡'], at:now - 3*DAY + 3600e3, x:600, y:36,
    bo:'n-19', k:['判別式'], item:{aid:'a-pre', iid:'Q05'},
    segs:[{s:'s5', text:'先算 b²−4ac：小於 0 就直接寫「沒有實數根」，不用再硬解；等於 0 是重根；大於 0 且是完全平方數，因式分解一定拆得出來。'},
          {s:'s4', text:'前測判別式那一題，我只看 b²=16 是正的就選了「兩相異實根」，忘了減 4ac，這是我錯的地方。'}]});

  mkNote({v:'v-3', t:'配方法不是拿來算的，是拿來看的', a:['邱奕安'], at:now - 2*DAY, x:330, y:200,
    bo:'n-18', k:['配方法'],
    segs:[{s:'s1', text:'配方法算起來比較慢，但可以看出頂點跟最小值，下學期的二次函數會用到，所以還是要會。'}]});

  /* 閱讀紀錄（模擬）：能力越高、參與傾向越高者讀越多 */
  notes.forEach(function(n){
    kbStudents.forEach(function(s){
      const p = 0.2 + 0.65 * s.engage;
      if (n.authorIds.indexOf(s.id) < 0 && rnd() < p) n.reads.push(s.id);
    });
  });

  /* 註記（annotation）示範 */
  notes[4].annotations.push({id:'an-1', authorId:'u-t1', text:'很好的做法——你去查了定義，而不是只憑印象。請把課本頁碼也補上去。', at:now - 6*DAY});
  notes[8].annotations.push({id:'an-2', authorId:S['陳柏宇'], text:'第三種情況我想再加一個例子：時間不能是負的。', at:now - 4*DAY});

  const st = {
    version: 3,
    users: users,
    classes: classes,
    assignments: [pre, post],
    responses: responses,
    submissions: submissions,
    views: views,
    notes: notes,
    logs: [],          // 使用者自己操作產生的事件（示範日誌另由種子重算，不占儲存空間）
    dialog: [],
    surveys: [],
    assignmentLog: [{at: now - 20 * DAY, seed: 20250827, stratify:'grade',
                     map: classes.map(function(c){ return {cid:c.id, cond:c.condition}; }),
                     note:'出廠預設分派（示範）'}],
    settings: {
      engine:'builtin', provider:'openai', baseUrl:'https://api.openai.com/v1',
      apiKey:'', model:'gpt-4o-mini',
      misThreshold: 15, minN: 3, maxTurns: 6, kbClassId: 'c-1'
    },
    aiCache: {},
    ui: { role:'u-t1', classId:'c-1' },
    seededAt: now
  };
  return st;
}

/* 班級 2–4 的學生姓名（固定種子產生，僅為示範） */
const SURNAMES = ['王','陳','林','張','李','黃','吳','劉','蔡','鄭','許','曾','謝','洪','周','施',
                  '賴','高','葉','莊','邱','潘','杜','馮','宋','徐','孫','呂','盧','蕭','簡','范'];
const GIVEN = ['宇彤','家瑋','品叡','語安','宸恩','昱翔','若晴','柏睿','詩晴','承翰','宜靜','子桓',
               '亭妤','祐生','采蓁','冠霖','思穎','立宸','佳霓','允中','念慈','宥廷','曉薇','劭寧',
               '睿哲','沛蓁','品岑','翊軒','怡君','孟哲','雅涵','建霖'];
function genName(rnd){
  return SURNAMES[Math.floor(rnd() * SURNAMES.length)] + GIVEN[Math.floor(rnd() * GIVEN.length)];
}
