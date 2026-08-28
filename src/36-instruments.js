/* ==========================================================================
   36-instruments.js — 五項動機性構念的前後測工具
   重要聲明：以下題項為依各構念定義「自撰」之情境化示範題項，
   目的是讓平台的施測與計分流程完整可跑，**不是**已驗證量表的中譯本。
   正式施測請改用研究構想中列出、已於臺灣學習者樣本完成信效度驗證之公開量表
   （MSLQ 中譯之內外在動機與自我效能、Leppink 三因素認知負荷、
     Fredricks 三維學習投入、MSLQ 考試焦慮分量表），並完成專家審查與認知訪談。
   ========================================================================== */

const SCALE6 = {n:6, labels:['非常不同意', '不同意', '有點不同意', '有點同意', '同意', '非常同意']};
const SCALE5 = {n:5, labels:['完全不符合', '不太符合', '普通', '有點符合', '完全符合']};

const CONSTRUCTS = [
  {id:'mot_in',  name:'內在動機',   dim:'學習動機', scale:SCALE6, phase:'both', cls:'sc3',
   src:'MSLQ 內在目標導向', items:[
    '這篇文章就算不算成績，我也想把它讀懂',
    '遇到讀不太懂的地方，我會想知道自己是哪裡讀錯了',
    '把一段話想清楚的感覺，本身就讓我覺得值得',
    '我喜歡去讀那些一開始看不太懂的文章']},
  {id:'mot_ex',  name:'外在動機',   dim:'學習動機', scale:SCALE6, phase:'both', cls:'sc2',
   src:'MSLQ 外在目標導向', items:[
    '我認真讀這篇文章，主要是因為會算成績',
    '我希望這次閱讀測驗的表現比班上多數同學好',
    '如果沒有人會看到結果，我大概不會讀得這麼仔細']},
  {id:'eff',     name:'自我效能',   dim:'自我效能', scale:SCALE6, phase:'both', cls:'sc1',
   src:'MSLQ 學習自我效能', items:[
    '我有把握讀懂這樣長度的文章',
    '就算題目換個問法，我也答得出來',
    '碰到不會的題目，我知道可以回文章的哪裡去找',
    '我可以把我為什麼這樣讀講給別人聽',
    '我相信我可以在這次閱讀測驗拿到不錯的成績',
    '就算一開始讀錯了，我也有辦法自己發現並改過來',
    '我能判斷自己的答案有沒有文章的根據',
    '這篇文章對我來說是讀得懂的']},
  {id:'cl_in',   name:'內在負荷',   dim:'認知負荷', scale:SCALE6, phase:'post', cls:'sc4',
   src:'Leppink 三因素·內在', items:[
    '這篇文章的內容對我來說很複雜',
    '要同時記住的人物、事情或訊息很多',
    '文章想講的道理本身就不容易懂']},
  {id:'cl_ex',   name:'外在負荷',   dim:'認知負荷', scale:SCALE6, phase:'post', cls:'sc4',
   src:'Leppink 三因素·外在', items:[
    '畫面上的東西讓我不容易專心在文章上',
    '我花了不少力氣在弄清楚「這個系統要我做什麼」',
    '文章和題目的呈現方式讓我覺得吃力']},
  {id:'cl_ge',   name:'增生負荷',   dim:'認知負荷', scale:SCALE6, phase:'post', cls:'sc6',
   src:'Leppink 三因素·增生', items:[
    '這節課的活動幫助我把文章的意思弄得更清楚',
    '過程中我有真的在想「作者為什麼這樣寫」，不只是在找答案',
    '這樣的做法讓我更知道要怎麼讀一篇文章']},
  {id:'eng_b',   name:'行為投入',   dim:'學習投入', scale:SCALE5, phase:'post', cls:'sc1',
   src:'Fredricks 三維·行為', items:[
    '整節課我都有跟著在讀',
    '我很少分心去做別的事',
    '該我回應的時候我都有回應',
    '我把每一題都做完了']},
  {id:'eng_e',   name:'情緒投入',   dim:'學習投入', scale:SCALE5, phase:'post', cls:'sc3',
   src:'Fredricks 三維·情緒', items:[
    '讀這篇文章的時候我覺得有興趣',
    '我還蠻喜歡這節課的進行方式',
    '過程中我覺得放鬆，不會一直緊繃',
    '我會想再讀一篇這樣的文章']},
  {id:'eng_c',   name:'認知投入',   dim:'學習投入', scale:SCALE5, phase:'post', cls:'sc5',
   src:'Fredricks 三維·認知', items:[
    '我會把文章裡的訊息跟自己知道的事連起來想',
    '我會先把整段讀完再決定答案',
    '答完之後我會回頭確認文章裡有沒有這樣說',
    '我會問自己「這樣讀說得通嗎」']},
  {id:'anx',     name:'學習焦慮',   dim:'學習焦慮', scale:SCALE6, phase:'both', cls:'sc4',
   src:'MSLQ 考試焦慮', items:[
    '做這些閱讀題的時候我覺得緊張',
    '我擔心自己讀得比別人慢或比別人差',
    '想到要被看到答案，我就有點不安',
    '我會因為怕答錯而不敢寫下來',
    '結束之後我還會一直想「我是不是讀錯了」']}
];

/* 角色知覺之操弄檢核（後測；對照組不施） */
const MANIP_CHECK = [
  {id:'mc_tutor', text:'剛剛的 AI 夥伴比較像在「教我、引導我想」'},
  {id:'mc_tutee', text:'剛剛的 AI 夥伴比較像「需要我教它的同學」'},
  {id:'mc_peer',  text:'剛剛的 AI 夥伴比較像「跟我一起做題目的同學」'}
];
/* 系統使用感受（後測；四條件皆施） */
const SUS_ITEMS = [
  {id:'sys_easy',  text:'這個系統很好操作'},
  {id:'sys_clear', text:'我清楚知道每一步要做什麼'},
  {id:'sys_again', text:'我願意再用這個系統上一次課'}
];

function constructsFor(phase){
  return CONSTRUCTS.filter(function(c){ return c.phase === 'both' || c.phase === phase; });
}
function constructById(id){ return CONSTRUCTS.find(function(c){ return c.id === id; }); }

/* 計分：回傳每個構念的平均分（未作答者為 null） */
function scoreSurvey(resp){
  const out = {};
  CONSTRUCTS.forEach(function(c){
    const vals = c.items.map(function(_, i){ return resp[c.id + '_' + i]; })
      .filter(function(v){ return typeof v === 'number'; });
    out[c.id] = vals.length ? vals.reduce(function(a, b){ return a + b; }, 0) / vals.length : null;
  });
  return out;
}

function surveyOf(sid, phase){
  return (state.surveys || []).find(function(s){ return s.sid === sid && s.phase === phase; });
}
function surveyScores(sid, phase){
  const s = surveyOf(sid, phase);
  return s ? scoreSurvey(s.resp) : null;
}

/* ==========================================================================
   示範問卷資料
   前測分數依學生的潛在特質產生；後測依條件加上理論預測的效果。
   同樣是模擬資料，用來讓 ANCOVA 與中介分析的管線可以跑完整。
   ========================================================================== */

/* 條件對各構念的預期效果（單位：量尺分數；依研究構想的理論推導） */
const DEMO_EFFECT = {
  tutor:   {mot_in: 0.10, mot_ex: 0.25, eff: 0.35, cl_in: 0.05, cl_ex: 0.45, cl_ge: 0.40, eng_b: 0.25, eng_e: 0.05, eng_c: 0.30, anx: 0.10},
  tutee:   {mot_in: 0.60, mot_ex:-0.05, eff: 0.55, cl_in: 0.05, cl_ex: 0.10, cl_ge: 0.65, eng_b: 0.30, eng_e: 0.35, eng_c: 0.45, anx:-0.15},
  peer:    {mot_in: 0.40, mot_ex: 0.00, eff: 0.30, cl_in: 0.00, cl_ex:-0.30, cl_ge: 0.35, eng_b: 0.35, eng_e: 0.55, eng_c: 0.30, anx:-0.35},
  control: {mot_in: 0.00, mot_ex: 0.00, eff: 0.00, cl_in: 0.00, cl_ex: 0.00, cl_ge: 0.00, eng_b: 0.00, eng_e: 0.00, eng_c: 0.00, anx: 0.00}
};

function buildDemoSurveys(){
  const rnd = mulberry32(20260901);
  const out = [];
  state.classes.forEach(function(k){
    k.studentIds.forEach(function(sid){
      const stu = getUser(sid);
      const a = stu.thetaTrue || 0, e = stu.engage != null ? stu.engage : 0.5;
      const trait = {};
      CONSTRUCTS.forEach(function(c){
        const mid = (c.scale.n + 1) / 2;
        let base;
        if (c.id === 'anx')        base = mid + 0.6 - a * 0.45 + (rnd() - 0.5) * 1.1;
        else if (c.id === 'cl_in') base = mid + 0.3 - a * 0.40 + (rnd() - 0.5) * 1.0;
        else if (c.id === 'cl_ex') base = mid - 0.2 - a * 0.15 + (rnd() - 0.5) * 1.0;
        else if (c.id === 'mot_ex')base = mid + 0.2 + (rnd() - 0.5) * 1.3;
        else                       base = mid + 0.25 + a * 0.30 + e * 0.7 + (rnd() - 0.5) * 1.0;
        trait[c.id] = base;
      });

      ['pre', 'post'].forEach(function(phase){
        const cs = constructsFor(phase);
        const resp = {};
        cs.forEach(function(c){
          const eff = phase === 'post' ? (DEMO_EFFECT[k.condition] || DEMO_EFFECT.control)[c.id] || 0 : 0;
          const mu = clamp(trait[c.id] + eff, 1, c.scale.n);
          c.items.forEach(function(_, i){
            resp[c.id + '_' + i] = Math.max(1, Math.min(c.scale.n,
              Math.round(mu + (rnd() - 0.5) * 1.2)));
          });
        });
        if (phase === 'post'){
          if (k.condition !== 'control'){
            MANIP_CHECK.forEach(function(m){
              const match = (m.id === 'mc_' + k.condition);
              resp[m.id] = Math.max(1, Math.min(6, Math.round((match ? 5.0 : 2.6) + (rnd() - 0.5) * 1.4)));
            });
          }
          SUS_ITEMS.forEach(function(s){
            resp[s.id] = Math.max(1, Math.min(6, Math.round(4.4 + (rnd() - 0.5) * 1.5)));
          });
        }
        out.push({sid:sid, phase:phase, at: Date.now(), resp:resp, demo:true});
      });
    });
  });
  return out;
}

function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }

/* 問卷資料匯出（長格式） */
function toSurveyCsv(){
  const rows = [['sid','name','class','grade','condition','phase','construct','dimension','mean_score','n_items']];
  (state.surveys || []).forEach(function(s){
    const k = classOfStudent(s.sid);
    const sc = scoreSurvey(s.resp);
    CONSTRUCTS.forEach(function(c){
      if (sc[c.id] == null) return;
      rows.push([s.sid, userName(s.sid), k ? k.name : '', k ? k.grade : '',
        k ? k.condition : '', s.phase, c.name, c.dim, sc[c.id].toFixed(3), c.items.length]);
    });
  });
  return rows.map(function(r){
    return r.map(function(c){ return '"' + String(c).replace(/"/g, '""') + '"'; }).join(',');
  }).join('\n');
}
