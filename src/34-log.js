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
  '我確認我用到了題目給的每一個條件',
  '我有想過另一個做法',
  '我把答案代回去檢查過',
  '我可以說出我為什麼選這個'
];

let DEMO_LOGS = [];      // 由種子重算，不持久化
let DEMO_DIALOG = [];    // 同上

function allLogs(){ return DEMO_LOGS.concat(state.logs || []); }
function allDialog(){ return DEMO_DIALOG.concat(state.dialog || []); }

function logEvent(o){
  state.logs = state.logs || [];
  state.logs.push(o);
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
const DEMO_UTTER = {
  BELOW: ['這題是不是就用公式算就好？', '我先算算看好了', '這個要代進去哪裡？',
          '答案要算到小數嗎', '我記得公式是這樣', '這步是不是先移項'],
  AT:    ['我想先設寬是 x，然後列式子', '我打算用因式分解，因為係數是小整數',
          '題目給了兩個條件，我用了面積那個', '我覺得要先把它整理成等於 0',
          '我用的是判別式那個方法', '我先確認題目在問哪一個東西'],
  ABOVE: ['如果數字換成別的，這個做法應該還是可以，除非變成負的',
          '我想不通為什麼一定要先移項，如果右邊不是 0 會怎樣',
          '我覺得另一個做法比較容易錯，因為要多算一次',
          '我可以舉一個反例：2 乘 3 等於 6，但 2 不等於 6',
          '這一題跟前面那題很像，差別只在有沒有負根',
          '我要怎麼確定兩個根都對？我把它們都代回去了']
};
const DEMO_NOTE = ['先讀題目', '設 x = 寬', '要先移項成 =0', '檢查有沒有漏根',
                   '再讀一次題目', '這題和前面那題像', '代回去檢查'];

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
      for (let i = 0; i < nMark; i++) push('MARK', 'M', {sent: Math.floor(rnd() * nSent)});

      // 對話回合（對照組改為筆記）
      const base = cond === 'tutor' ? 4.2 : cond === 'tutee' ? 3.6 : cond === 'peer' ? 3.2 : 0;
      const nTurn = cond === 'control' ? 0
        : Math.max(1, Math.min(MAX_TURNS, Math.round(base * (0.55 + eng * 0.9) + (rnd() - 0.5))));

      if (cond === 'control'){
        const nNote = 1 + Math.round(2 * eng + rnd());
        for (let i = 0; i < nNote; i++){
          push('NOTE', 'N', {text: DEMO_NOTE[Math.floor(rnd() * DEMO_NOTE.length)] + moodTail(cond, rnd)});
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
          if (rnd() < 0.35) push('MARK', 'M', {sent: Math.floor(rnd() * nSent)});
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
    });
  });

  DEMO_LOGS = logs;
  DEMO_DIALOG = dialog;
}

/* 題幹逐句切分（供逐句標記與 MARK 事件使用） */
function splitSentences(text){
  const t = String(text || '').trim();
  function cut(str, marks){
    const out = []; let buf = '';
    for (let i = 0; i < str.length; i++){
      buf += str[i];
      if (marks.indexOf(str[i]) >= 0){ out.push(buf.trim()); buf = ''; }
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
  const L = allLogs().filter(function(e){ return e.code; });
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
  const logs = allLogs().slice().sort(function(a, b){ return a.t - b.t; });
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
      fkl:'', keys:'', del:'', pause:'', marks:0, opts:0, turns:0, checks:0,
      t0:e.t, t1:e.t, sent:[], };
    r.t0 = Math.min(r.t0, e.t); r.t1 = Math.max(r.t1, e.t);
    if (e.type === 'TELEMETRY'){ r.fkl = e.firstKeyLatency; r.keys = e.keystrokes; r.del = e.deletions; r.pause = e.longPauses; }
    if (e.code === 'M') r.marks++;
    if (e.code === 'O') r.opts++;
    if (e.code === 'C') r.checks++;
    if (e.type === 'ASK'){ r.turns++; if (e.sent != null) r.sent.push(e.sent); }
  });
  Object.keys(byKey).forEach(function(k){
    const r = byKey[k], kl = classOfStudent(r.sid), it = getItem(r.iid);
    rows.push([r.sid, userName(r.sid), kl ? kl.name : '', r.cond, r.iid, r.proc,
      r.fkl, r.keys, r.del, r.pause, r.marks, r.opts, r.turns, r.checks,
      r.t1 - r.t0, r.sent.length ? (r.sent.reduce(function(a, b){ return a + b; }, 0) / r.sent.length).toFixed(3) : '']);
  });
  return rows.map(function(r){
    return r.map(function(c){ return '"' + String(c).replace(/"/g, '""') + '"'; }).join(',');
  }).join('\n');
}
