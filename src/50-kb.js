/* ==========================================================================
   50-kb.js — 知識建構模型（Knowledge Forum 式）＋ 資料存取 ＋ 橋接
   橋接 = 本系統的核心：把 KIDMAP 第二象限（迷思）轉為社群的真實問題。
   ========================================================================== */

const STORE_KEY = 'kidforum.state.v1';
let state = null;

/* 代為檢視期間的落地一律擋在這裡，不再倚賴逐個呼叫點的 if。
   逐點守門補了六處，第 2 輪還是漏了 aalSay，下一個新增的寫入點還會再漏。
   守門下沉之後，逐點的 isImpersonating() 變成第二道保險而不是唯一防線。
   唯一的例外是 state.ui 本身的變更（切換身分、結束檢視），
   由 99-app.js 在呼叫前後掀開 _allowUiWrite。 */
/* --- 分頁之間的覆寫 ---
   save() 把整個 state 序列化寫出去，所以兩個分頁就是「最後寫的贏」：
   老師在 A 分頁批改非選、B 分頁開著儀表板，B 的任何一次寫入
   都會把剛打好的分數整批蓋掉，而且沒有任何提示。
   做法是每次寫出都帶上版次與分頁識別；別的分頁寫了就同步過來並說一聲。
   （這不是合併——同一秒改同一筆仍以後寫者為準；
     要守住的是「不要無聲地掉東西」。） */
const TAB_ID = 'tab-' + Math.random().toString(36).slice(2, 10) + '-' + Date.now().toString(36);
const REV_KEY = STORE_KEY + ':rev';
let STATE_REV = 0;

/* 版次要跨分頁單調遞增，所以取自磁碟而不是自己的計數器
   （兩個分頁各自 ++ 會撞號）。另存一支小鍵，免得每次寫入都要
   把整份 state 反序列化回來讀一個數字。 */
function nextRev(){
  let disk = 0;
  try { disk = parseInt(localStorage.getItem(REV_KEY) || '0', 10) || 0; } catch (e) {}
  STATE_REV = Math.max(disk, STATE_REV) + 1;
  try { localStorage.setItem(REV_KEY, String(STATE_REV)); } catch (e) {}
  return STATE_REV;
}

/* 這一頁是不是正在「量東西」。作答、問卷、前測都算：這三段期間有
   記憶體裡才有的狀態（AAL 的標記與草稿、SURVEY 的作答與頁碼、QUIZ 的
   答案與筆跡），被整份 state 換掉就無聲消失。 */
function measuringNow(){
  /* 要看「現在真的停在那一頁」，不能只看變數在不在。
     QUIZ 與 SURVEY 離開頁面時刻意保留（讓孩子回來繼續），
     所以只要他開過前測或問卷沒交就離開，這個分頁往後永久被判為
     「施測中」：跨分頁更新一律擱置，而 PENDING_FOREIGN 只在離開這三個
     畫面時才會被洗出去。作答內容現在都有草稿（三支都有），
     而且 save() 也改成合併了，所以不在那一頁時同步是安全的。 */
  const rn = (typeof ROUTE !== 'undefined' && ROUTE) ? ROUTE.name : '';
  if (typeof AAL !== 'undefined' && AAL) return 'aal';
  if (typeof SURVEY !== 'undefined' && SURVEY && rn === 'survey') return 'survey';
  if (typeof QUIZ !== 'undefined' && QUIZ && rn === 'quiz') return 'quiz';
  return null;
}

/* 施測中收到的外部更新先擱著，離開之後再看要不要套用。 */
let PENDING_FOREIGN = null;
function flushPendingForeign(){
  if (!PENDING_FOREIGN) return;
  if (measuringNow()) return;
  const next = PENDING_FOREIGN; PENDING_FOREIGN = null;
  /* 擱置期間這一頁自己一直在寫：flushLogs() 每兩秒 save() 一次，交卷與
     送出問卷也各寫一次，所以離開的時候我們的版次幾乎一定比那份快照新。
     這時候套用等於把整節課回捲到擱置的那一刻——logs、dialog、responses、
     submissions、surveys 一起消失，submitted() 變回 false，首頁又邀他重做，
     而畫面上只會出現一句「另一個分頁更新了資料，這一頁已經同步。」
     擋住施測中換身分是對的，但不能用「孩子交出去的答案」去換。
     版次不比我們新就直接丟掉：那個分頁下一次寫入時會帶著更新的版次再來，
     而它自己的 storage 監聽也會收到我們剛寫出去的這一份。 */
  if ((next.rev || 0) <= STATE_REV){
    if (typeof console !== 'undefined' && console.warn)
      console.warn('[KAIROS] 擱置期間本頁已寫入較新版次（' + STATE_REV +
                   ' ≥ ' + (next.rev || 0) + '），丟棄那份較舊的跨分頁快照。');
    return;
  }
  adoptForeignState(next);
}

/* 只搬外觀，不碰資料。施測中擱置外部更新時用它，讓字級與高對比仍然
   跨分頁同步——這兩個欄位是純呈現，不影響任何測量。 */
function adoptForeignA11y(next){
  if (!next || !next.settings) return;
  const a = next.settings.a11y;
  if (a && state.settings){
    state.settings.a11y = state.settings.a11y || {};
    state.settings.a11y.fontScale   = a.fontScale;
    state.settings.a11y.highContrast = a.highContrast;
  }
  if (next.ui && state.ui) state.ui.theme = next.ui.theme;
  if (typeof applyTheme === 'function') applyTheme();
  if (typeof applyA11y === 'function') applyA11y();
}

function adoptForeignState(next){
  if (!next || typeof next !== 'object') return;
  STATE_REV = next.rev || 0;
  const hash = location.hash;
  /* 換身分就要清手寫板。全庫有四條會改變 state.ui.role 的路徑，clearPads()
     原本只掛在其中三條（換身分下拉、施測前清場、再走一次），第四條就是這裡。
     PADS 不在 state 裡，所以整份 state 被換掉時它原封不動留著：
     老師在前景分頁把裝置交給下一個孩子，背景分頁收到 storage 事件換成新身分，
     上一個孩子寫在 aal-C01 的筆跡還在——新孩子一進作答頁，initPads 的
     `PADS[id] = PADS[id] || {…}` 會沿用舊物件，別人的字直接畫在他的答案格裡；
     padHasInk 為真所以缺答救援不會攔，交卷時寫進他的 responses[].strokes。
     兩個孩子的建構反應題資料同時作廢，而評閱端看不出那不是他寫的。 */
  const roleChanged = !!(next.ui && state && state.ui && next.ui.role !== state.ui.role);
  if (roleChanged && typeof clearPads === 'function'){ try { clearPads(); } catch (e) {} }
  state = next;
  try {
    if (typeof renderShell === 'function') renderShell();
    if (typeof render === 'function'){ location.hash = hash; render(); }
    /* 字級、高對比與外觀都存在被整批取代的那份 state 裡
       （settings.a11y 與 ui.theme），但 renderShell()／render() 都不會
       重新把它們套到 DOM 上——--fs、data-contrast、data-theme 與 #fsSel
       會停在舊分頁的值。低視力的孩子在另一台裝置上調了字級，
       這一頁同步了資料卻沒同步字級，畫面等於沒變。
       順序與 boot() 一致；applyA11y 內部會同步 #fsSel、#contrastBtn
       並呼叫 syncNarrow 與 syncTopbarHeight。 */
    if (typeof applyTheme === 'function') applyTheme();
    if (typeof applyA11y === 'function') applyA11y();
    if (typeof toast === 'function') toast('另一個分頁更新了資料，這一頁已經同步。');
  } catch (e) { /* 還沒開始渲染就收到事件：資料已換好，等首次 render 即可 */ }
}

if (typeof window !== 'undefined' && window.addEventListener){
  window.addEventListener('storage', function(e){
    if (e.key !== STORE_KEY || !e.newValue) return;
    let next = null;
    try { next = JSON.parse(e.newValue); } catch (err) { return; }
    if (!next || next.writer === TAB_ID) return;      // 自己寫的不用理
    if ((next.rev || 0) <= STATE_REV) return;         // 不是更新的版本
    /* 代為檢視中不要被外部狀態拉走身分——那會讓老師莫名其妙跳出檢視 */
    if (isImpersonating()){
      if (typeof console !== 'undefined' && console.warn)
        console.warn('[KAIROS] 代為檢視期間收到另一個分頁的更新，暫不同步。');
      return;
    }
    /* 施測中一律不換。原本只擋代為檢視，於是同一台平板開了第二個分頁、
       或兩個孩子共用一台的時候，另一邊的任何一次寫入都會在作答途中把
       整份 state 換掉——實測 tutor 條件的王品瑄在第 1 題作答中，被換成
       對照組的宋昱翔：畫面上的名字、班級、右欄（對話面板變成筆記面板）
       全部跟著變，而 viewAaL 會用新身分重建 AAL。後果有三層：
         · 他接下來寫的每一個字都記在另一個孩子的 sid 與條件底下
         · 條件操弄在一次施測中途翻面，違反班級叢集分派本身
         · 他自己這一題的標記、打到一半的話、停留時間全部消失
       擱著、等他離開作答／問卷／前測再套用。 */
    const busy = measuringNow();
    if (busy){
      PENDING_FOREIGN = next;
      /* 外觀設定可以立刻跟上，而且只有它可以。字級與高對比是純呈現，
         不碰任何測量資料；擱著不動的話，孩子在另一個分頁把字級調到 175%
         之後，這一頁兩秒內就被自己的 save() 覆蓋回去、再調再跳，
         而最需要放大字級的正是本來就看不清楚的那個孩子，
         他只會覺得「這台平板調不動」而且看不出原因。 */
      try { adoptForeignA11y(next); } catch (e) {}
      if (typeof console !== 'undefined' && console.warn)
        console.warn('[KAIROS] 施測中（' + busy + '）收到另一個分頁的更新，先擱著，離開後再同步。');
      return;
    }
    adoptForeignState(next);
  });
}

/* 一列資料的識別。用來判斷「磁碟上那一份有沒有這一筆」。 */
function rowKey(kind, r){
  if (kind === 'logs')        return [r.t, r.sid, r.type, r.code, r.iid, r.turn].join('|');
  if (kind === 'dialog')      return [r.t, r.sid, r.iid, r.turn, r.speaker].join('|');
  if (kind === 'responses')   return [r.aid, r.sid, r.iid].join('|');
  if (kind === 'submissions') return [r.aid, r.sid].join('|');
  if (kind === 'surveys')     return [r.sid, r.phase].join('|');
  /* 對照組整節課唯一的全文語料。它的地位等同三個 AI 條件的 dialog，
     卻一直不在合併清單裡——兩個分頁同時開著時，它會被無聲蓋掉，
     而這個損失只落在基準組。 */
  if (kind === 'aalNotes')    return [r.aid, r.sid, r.iid].join('|');
  /* 被擋下的那一份（重複交卷）。每人每份留最後一次。 */
  if (kind === 'orphanSubmits') return [r.aid, r.sid].join('|');
  return r.id != null ? String(r.id) : JSON.stringify(r);
}

/* 把「我們手上有、但磁碟那一份沒有」的列補回磁碟那一份上。
   施測中的分頁依設計拒絕同步外部更新（見 measuringNow），手上永遠是進入
   作答那一刻的舊 state；而 save() 原本無條件把它整份寫回去——
   rev/writer 只擋「無聲被換掉」，完全不擋「無聲蓋掉別人」。
   兩個分頁都停在作答頁時：A 分頁交卷（responses／submissions／dialog 落地），
   B 分頁兩秒後的 flushLogs 就把不含這些東西的舊 state 整份寫回去。
   孩子看到「已交卷」、草稿也被刪了，但磁碟上 submitted() 是 false——
   16 題作答、整段對話、整節課的歷程事件一起消失，而且畫面沒有任何訊號。
   同一個機制也會把已經扣掉的對話額度倒回去（第 7 輪只補了讀那一半）。
   這裡改成：磁碟比我們新時，以磁碟為底、只把我們自己多出來的列補上去。
   五個集合都是附加型或以鍵唯一，所以這個合併是安全的；
   ui 保留我們自己的（身分與路由是本機的事），settings 以磁碟為準
   （老師在另一個分頁按的答案卡開關不可以被學生分頁蓋掉），
   只有 a11y 例外——那是本機的呈現設定。 */
function mergeOntoDisk(disk){
  const out = disk;
  ['logs', 'dialog', 'aalNotes', 'orphanSubmits', 'responses', 'submissions', 'surveys', 'notes', 'views'].forEach(function(kind){
    const mine = state[kind];
    if (!Array.isArray(mine)) return;
    const theirs = Array.isArray(out[kind]) ? out[kind] : [];
    const seen = {};
    theirs.forEach(function(r){ seen[rowKey(kind, r)] = true; });
    let added = 0;
    mine.forEach(function(r){
      const k = rowKey(kind, r);
      if (!seen[k]){ theirs.push(r); seen[k] = true; added++; }
    });
    out[kind] = theirs;
    if (added && typeof console !== 'undefined' && console.info)
      console.info('[KAIROS] 合併：' + kind + ' 補回 ' + added + ' 列');
  });
  /* ui 一律以本頁為準。這一行同時做兩件事，兩件都不能少：
     (1) 不讓磁碟那一份 ui 被帶進記憶體——save() 的合併分支是
         `state = mergeOntoDisk(disk)`，整份 state 被這個回傳值取代，
         所以只要這裡不覆寫，磁碟的 ui.role 就會直接成為 state.ui.role。
         第 9 輪 P1 曾經改成「施測中不寫」，結果就是把 storage 監聽器
         擋下來的災難搬進 save()：老師在另一個分頁換成下一位之後，
         孩子這一頁只要有任何一筆日誌（logEvent → flushLogs → save）
         就翻面，而 save() 不 renderShell、不 toast，施測中身分下拉又是
         隱藏的——下一次 render 走到 AAL.me !== me.id 就重跑 aalInit，
         這一場的作答、標記、遙測全部被換人重建，AAL.cond 跟著翻面。
     (2) 「不要把自己的 ui 寫出去」是另一件事，屬於 save() 的序列化那一步
         （見 save() 裡的 payloadUi）——不能靠這一行順便達成。 */
  out.ui = state.ui;
  if (out.settings && state.settings) out.settings.a11y = state.settings.a11y;
  return out;
}

/* 磁碟上到底交了沒有。
   施測中的分頁永遠不同步外部更新，所以 state.submissions 這個記憶體副本
   對「另一個分頁剛剛交了卷」是瞎的——而覆寫紀錄的那一步就在這裡發生。
   問卷那一支的「第二道門」讀的也是記憶體，對它自己宣稱要擋的
   「舊分頁上的按鈕」恆為不成立。這一支直接問磁碟。 */
function submittedOnDisk(aid, sid){
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    return !!(d && Array.isArray(d.submissions) &&
      d.submissions.some(function(s){ return s.aid === aid && s.sid === sid; }));
  } catch (e) { return false; }
}
/* 問卷同理：磁碟上有沒有這一份。 */
function surveyOnDisk(sid, phase){
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    return !!(d && Array.isArray(d.surveys) &&
      d.surveys.some(function(s){ return s.sid === sid && s.phase === phase && !s.demo; }));
  } catch (e) { return false; }
}

/* ==========================================================================
   合併其他平板匯出的資料包
   「四個班共用同一次 Rasch 校準」是本平台宣告的不變量，而 diagnose() 的
   作答矩陣只由這台裝置的 submissions／responses 組成——一人一台平板時
   done.length 恆為 1，校準永遠跑不起來；共用平板時 n=3 也會被當成全體。
   沒有這條合併路徑，那個不變量在任何真實部署形態下都做不到。
   合併是以鍵取聯集，不覆蓋既有列：同一把鍵已經在手上的就跳過，
   所以同一個檔案匯入兩次不會產生重複，順序也不影響結果。
   ========================================================================== */
function mergeResearchBundle(bundle){
  if (!bundle || typeof bundle !== 'object') throw new Error('這不是一份 KAIROS 資料包。');
  /* 只吃 raw 區塊。資料包上層的 surveys／logs／dialogue 是給分析用的衍生形狀
     （surveys 帶 scores 而不是 resp，logs／dialogue 是 allLogs()＝示範資料
     ＋真實資料），照著併回去會把別台平板的示範事件一起收進校準。
     raw 是原樣的儲存形狀，這條路徑只認它。 */
  const raw = bundle.raw;
  if (!raw || typeof raw !== 'object')
    throw new Error('這份資料包沒有 raw 區塊，可能是舊版匯出的。請在來源平板上重新匯出一次。');
  const roster = {};
  state.users.forEach(function(u){ roster[u.id] = true; });
  const KINDS = ['responses', 'submissions', 'logs', 'dialog', 'aalNotes', 'orphanSubmits', 'surveys'];
  const added = {};
  let foreign = 0, demo = 0;
  KINDS.forEach(function(kind){
    const incoming = raw[kind];
    added[kind] = 0;
    if (!Array.isArray(incoming)) return;
    state[kind] = Array.isArray(state[kind]) ? state[kind] : [];
    const seen = {};
    state[kind].forEach(function(r){ seen[rowKey(kind, r)] = true; });
    incoming.forEach(function(r){
      if (!r || typeof r !== 'object') return;
      /* 不在本機名單裡的 sid 一律不收：匯錯檔案（別的研究、別的學校）
         會無聲地把陌生人的作答併進校準，而 δ 是全體共用的。 */
      if (r.sid && !roster[r.sid]){ foreign++; return; }
      /* 示範問卷不收——它是種子產生的，併進來只會稀釋真實樣本。 */
      if (r.demo === true){ demo++; return; }
      const k = rowKey(kind, r);
      if (seen[k]) return;
      seen[k] = true;
      state[kind].push(r);
      added[kind]++;
    });
  });
  save();
  return {added: added, foreign: foreign, demo: demo,
          total: KINDS.reduce(function(a, k){ return a + added[k]; }, 0)};
}

function save(){
  if (isImpersonating() && !save._allowUiWrite){
    if (typeof console !== 'undefined' && console.warn)
      console.warn('[KAIROS] 代為檢視期間的落地被擋下', new Error().stack);
    return true;   // 刻意不落地，不是失敗
  }
  /* 別的分頁在我們這一份之後寫過東西時，不要整份蓋回去（見 mergeOntoDisk）。
     合併結果同時套回記憶體，否則這個分頁會一直拿著舊的那一份，
     下一次存檔又把剛補回去的東西再蓋掉一次。 */
  /* 磁碟上那一份的 ui 要先留起來：施測中的分頁不可以把自己的身分寫出去
     （理由見下面 payloadUi）。合併分支與非合併分支都要拿得到，所以在這裡讀。 */
  let diskUi = null;
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw){
      const disk = JSON.parse(raw);
      if (disk && disk.ui) diskUi = disk.ui;
      if (disk && (disk.rev || 0) > STATE_REV && disk.writer !== TAB_ID){
        state = mergeOntoDisk(disk);
        STATE_REV = disk.rev || 0;
      }
    }
  } catch (e) { /* 讀不回來就照原本的路徑寫，不要因此掉資料 */ }
  /* 版次要在序列化之前掛上去，兩個分支寫出的物件才都帶得到 */
  state.rev = nextRev();
  state.writer = TAB_ID;
  try {
    /* 代為檢視是一個「模式」，不是身分變更：模式本身不能落地。
       否則老師關掉分頁、隔天開機還是學生身分，而且不知道怎麼回來。 */
    const imp = state.ui && state.ui.impersonate;
    if (imp){
      const clone = Object.assign({}, state, {ui: Object.assign({}, state.ui, {
        role: imp.realRole, impersonate: undefined})});
      localStorage.setItem(STORE_KEY, JSON.stringify(clone));
      return true;
    }
    /* 施測中的分頁不可以把自己的身分寫出去。它依設計拒絕同步外部更新
       （見 measuringNow），所以它手上的 ui 一定是進入作答那一刻的舊值；
       老師在另一個分頁用 #/unlock 換成下一位同學之後，這個還停在作答頁、
       沒關掉的舊分頁只要再落地一次（關掉它就會：beforeunload 無條件
       flushLogs → save），磁碟上的 ui.role 與 deviceUnlock 就被寫回上一位。
       活著的那個分頁不在施測狀態，收到 storage 事件立刻 adoptForeignState，
       身分整個倒退，而施測中頂列的身分下拉是隱藏的，孩子看不到自己變成誰。
       這一步只影響「寫出去的那一份」，state.ui 仍然是本頁自己的
       （mergeOntoDisk 的 out.ui = state.ui 負責那一半）。 */
    const measuring = typeof measuringNow === 'function' ? measuringNow() : null;
    if (measuring && diskUi){
      const clone2 = Object.assign({}, state, {ui: diskUi});
      localStorage.setItem(STORE_KEY, JSON.stringify(clone2));
      return true;
    }
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    /* 回傳成功與否。原本一律吞掉，於是 aalSubmit 在靜默失敗之後照樣
       刪掉草稿並說「已交卷」——作答只剩在記憶體裡，平板一闔上就全沒，
       而 submitted() 之後回傳 false。呼叫端要有辦法知道。 */
    return false;
  }
}
/* 只給「進入／離開代為檢視」這一種變更用——而且只寫 ui 這一個切片。
   舊版是把守門整個掀開再 save() 整份 state：代為檢視期間任何漏了守門的
   寫入都會累積在記憶體裡，然後被〈結束檢視〉一次帶出去永久落地。
   實測過一次真實傷害：老師代為檢視時按〈再走一次（示範）〉，
   結束檢視之後那位學生的 16 筆後測作答就永久消失了。
   改成只覆蓋 prev.ui 之後，往後任何新增的寫入點忘了守門，
   也不可能再靠離開把破壞帶出來。 */
function saveUiOnly(){
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw){ save._allowUiWrite = true; try { save(); } finally { save._allowUiWrite = false; } return; }
    const prev = JSON.parse(raw);
    const imp = state.ui && state.ui.impersonate;
    prev.ui = Object.assign({}, state.ui, imp ? {role: imp.realRole, impersonate: undefined} : {});
    /* 這也是一次寫出，版次一樣要往前推——否則別的分頁看到 rev 沒變
       就不會同步，而磁碟上的 ui 已經換人了。 */
    prev.rev = nextRev();
    prev.writer = TAB_ID;
    localStorage.setItem(STORE_KEY, JSON.stringify(prev));
  } catch (e) { /* 無痕模式等情況：僅存在記憶體 */ }
}
/* 老師正在以某位學生的視角檢視。此時一律唯讀——
   他的閱讀、貼文、註記都不可以記到學生名下（reads 是 KB 指數的原料）。 */
function isImpersonating(){ return !!(state.ui && state.ui.impersonate); }
/* 作答紀錄與題本是否還對得起來。
   responses 存的是選項「索引」，題本一旦重排選項，舊索引就指到別的選項；
   correct 旗標卻還是舊的，於是 choice === answer 的紀錄可以是「答錯」。
   這種資料不會拋錯，只會讓 KIDMAP 的第二象限、頂誘答、失誤碼、AI 的探究提示
   全部靜靜地對到錯的地方。版號忘了加的時候，這一關是最後的攔截。 */
function responsesMatchKey(s){
  if (!s || !Array.isArray(s.responses)) return true;
  return !s.responses.some(function(r){
    if (r.choice === null || r.choice === undefined || r.correct === null) return false;
    const it = getItem(r.iid);
    if (!it || it.type !== 'mc') return false;
    return r.correct !== (r.choice === it.answer);
  });
}
function loadState(){
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw){
      const s = JSON.parse(raw);
      // 版號不符（示範資料改版）→ 重新產生
      if (s && s.version === STATE_VERSION){
        if (responsesMatchKey(s)){
          /* 接上磁碟上的版次，這個分頁之後寫出的版次才會比它大 */
          STATE_REV = s.rev || 0;
          migrateState(s);
          return s;
        }
        console.warn('[KAIROS] 作答紀錄與現行題本的答案鍵不一致，已重新產生示範資料。');
      }
    }
  } catch (e) { /* 讀不到就重新產生示範資料 */ }
  return buildSeedState();
}
/* 同版次之內的就地修補。
   載入器只有兩條路：版次相同就原封不動接受，不同就整份重建示範資料。
   純文案的更正因此沒有出路——加版次會把已經收到的作答一起洗掉，
   不加版次則舊資料永遠帶著舊文字。這一支補的是後者：只改欄位、
   不動任何作答，而且必須是冪等的（每次載入都會跑一遍）。 */
function migrateState(s){
  if (!s || !Array.isArray(s.assignments)) return s;
  /* 第 9 輪：題本名稱在學生端要中性。
     「閱讀理解 前測」「閱讀理解 評量即學習事件（後測）」是存進 state 的
     字串，不是常數——只改 30-data.js 的種子，舊資料（也就是真正在用的
     那一份）永遠不會變。研究標記改掛在 rlabel，教師端與研究端照舊看得到。 */
  const NEUTRAL = {
    'a-pre':  {title:'閱讀活動（一）', rlabel:'前測'},
    'a-post': {title:'閱讀活動（二）', rlabel:'評量即學習事件（後測）'}
  };
  s.assignments.forEach(function(a){
    const n = NEUTRAL[a.id];
    if (!n) return;
    /* 老師自己改過標題就不要覆蓋回去；只補 rlabel。 */
    if (/前測|後測|評量即學習事件/.test(a.title || '')) a.title = n.title;
    if (!a.rlabel) a.rlabel = n.rlabel;
  });
  /* 示範白板上的三句「前測第 N 題」。白板是學生讀的，理由同上。
     逐字比對再換掉，不做通用的字串取代——老師自己寫的貼文不能被改。 */
  const DEMO = [
    ['從前測第 8 題長出來的共同問題：', '從第 8 題長出來的共同問題：'],
    ['前測第 8 題問「作者在前面埋了哪一個線索」，', '第 8 題問「作者在前面埋了哪一個線索」，'],
    ['前測第 9 題有不少同學選對了，', '第 9 題有不少同學選對了，']
  ];
  function scrub(t){
    let out = t;
    DEMO.forEach(function(p){ if (out.indexOf(p[0]) >= 0) out = out.split(p[0]).join(p[1]); });
    return out;
  }
  (s.views || []).forEach(function(v){ if (v.desc) v.desc = scrub(v.desc); });
  (s.notes || []).forEach(function(n){
    (n.segs || []).forEach(function(g){ if (g.text) g.text = scrub(g.text); });
  });
  return s;
}

function resetState(){
  try { localStorage.removeItem(STORE_KEY); } catch (e) {}
  state = buildSeedState(); save();
}

/* --- 查詢輔助 --- */
function getItem(id){ return ITEMS.find(function(i){ return i.id === id; }); }

/* 顯示用的題號＝這一題在這份派題裡的位置。
   題目改成依文本分組之後（見 30-data.js 的 allIds），ITEMS 宣告順序裡的
   it.no 就不再等於孩子看到的順序：R10–R14 的 it.no 是 10–14、位置是 11–15；
   兩題非選的 it.no 各自從 1 起算，位置卻是 10 與 16。
   作答畫面用的是位置（AAL.idx + 1），而診斷頁、知識建構空間、教師端與
   AI 提示詞用的是 it.no——於是從第 10 題開始整整差一號。前 9 題剛好對得上，
   所以不容易被發現。
   最痛的一條是「可惜的題目：第 12 題 → 全班正在討論這題」：那是診斷頁
   唯一要孩子採取的行動，而它會把他送去他當時看到的第 13 題；老師在課堂上
   說「我們看第 12 題」時講的也不是孩子螢幕上那一題。
   診斷 → 回去重讀 → 白板討論這條迴圈正是這個平台的主軸，題號在中間斷掉。
   一律以「位置」為顯示的單一真相來源；it.no 只留給題庫維護畫面。 */
function displayNo(aid, iid){
  const a = getAssignment(aid);
  if (a){
    const i = a.itemIds.indexOf(iid);
    if (i >= 0) return i + 1;
  }
  const it = getItem(iid);
  return it ? it.no : '?';
}
/* 「第 N 題」；非選題加註記，不要再用它自己那套從 1 起算的編號 */
function itemLabel(aid, iid){
  const it = getItem(iid);
  return '第 ' + displayNo(aid, iid) + ' 題' + (it && it.type === 'cr' ? '（非選）' : '');
}
function getUnit(id){ return UNITS.find(function(u){ return u.id === id; }); }
/* unitName() 定義在 30-data.js（本平台的「單元」＝「文本」）。
   這裡曾有一份讀 u.name 的舊定義，會蓋掉正確版本並印出 undefined，已移除。 */
function getUser(id){ return state.users.find(function(u){ return u.id === id; }); }
function userName(id){ const u = getUser(id); return u ? u.name : id; }
function getView(id){ return state.views.find(function(v){ return v.id === id; }); }
function getNote(id){ return state.notes.find(function(n){ return n.id === id; }); }
function getAssignment(id){ return state.assignments.find(function(a){ return a.id === id; }); }
function currentUser(){ return getUser(state.ui.role) || state.users[0]; }
function getClass(id){ return state.classes.find(function(c){ return c.id === id; }); }
/* 知識建構空間的示範班級（貼文只種在這一班） */
function kbClass(){ return getClass((state.settings && state.settings.kbClassId) || 'c-1') || state.classes[0]; }
/* 目前教師視角所看的班級 */
function currentClass(){
  const me = currentUser();
  if (me.role === 'student'){ const k = classOfStudent(me.id); if (k) return k; }
  return getClass(state.ui.classId) || state.classes[0];
}
/* 一份派題涵蓋的班級與名單（支援跨班共同校準） */
function assignmentClasses(a){
  if (!a) return [];
  const ids = a.classIds || (a.classId ? [a.classId] : []);
  return ids.map(getClass).filter(Boolean);
}
function assignmentRoster(a){
  const out = [];
  assignmentClasses(a).forEach(function(c){
    c.studentIds.forEach(function(s){ if (out.indexOf(s) < 0) out.push(s); });
  });
  return out;
}
function isTeacher(){ const u = currentUser(); return u.role === 'teacher' || u.role === 'admin'; }
function isResearcher(){ return currentUser().role === 'admin'; }
/* 學生走進教師頁時的統一擋板。文案是給十歲孩子看的，不解釋權限模型。 */
function studentBlocked(){
  return '<div class="empty"><h3>這一頁是老師看的</h3>' +
    '<p style="max-width:60ch">你的作業、討論與學習軌跡都在導覽選單裡。</p>' +
    '<a class="btn" href="#/student">回我的作業</a></div>';
}

/* 指派給這位學生、但還沒交卷的作業 */
function pendingAssignments(sid){
  return state.assignments.filter(function(a){
    return assignmentRoster(a).indexOf(sid) >= 0 &&
           !state.submissions.some(function(s){ return s.aid === a.id && s.sid === sid; });
  });
}
/* 知識建構空間在「測驗之後」才對學生開放。
   理由是系統迴圈的次序：先作答 → 才有 KIDMAP 診斷 → 才有值得討論的共同問題。
   若在作答前就看得到別人的討論，等於先看到答案，前測也就不成立了。
   教師與研究者不受此限（他們要在課前備課、課後分析）。 */
/* 注意：不分相位是刻意的——**任何**未交作業都鎖。
   因此同時派出前測與後測，會讓共構空間從前測交卷起一直鎖到後測交卷，
   等於把中間的共構階段整段關掉。派題時前後測要分兩次派。 */
function kbLocked(u){
  const me = u || currentUser();
  if (me.role !== 'student') return false;
  if (pendingAssignments(me.id).length > 0) return true;
  /* 課後問卷也是一道門。原本只看有沒有未交作業，於是孩子按下交卷那一瞬間
     pendingAssignments 歸零、這裡立刻為 false：側欄徽章從「測驗後開放」
     翻成未讀則數，首頁第四張統計卡變成橘色的「未讀貼文 N · 同學的新想法」，
     就擺在「去填課後問卷」那張卡旁邊。
     而這裡放的是 kbGate 自己說的「從大家的作答整理出來的全班共同問題」——
     也就是這節課哪幾題大家答錯了，一次針對本份測驗的績效回饋，
     加上同學的想法。孩子逛完 21 則貼文再回頭填 cl_ge、eng_b/e/c、SUS
     與操弄檢核，量到的是共構活動的效果而不是他被分派到的條件；
     而誰走這一趟由完課速度決定，暴露率與條件系統性共變。
     成績頁與學習軌跡早就補了這道門（第 5 輪 val5），知識建構空間沒有。 */
  if (submitted('a-post', me.id) && !surveyOf(me.id, 'post')) return true;
  /* 第三道門：班級層級。前兩道只問這個孩子自己，於是他二十分鐘走完
     交卷＋問卷之後條件立刻為假，而共構視圖的畫布最上面會把來源題的
     完整題幹與四個選項原樣印出來－－而同教室還有 23 人正在作答它，
     前後測又是同一份題本。這正是答案卡當初寫下 classKeyReleased 的
     那個情境（第一個交卷的孩子接下來十分鐘沒事做、螢幕朝著旁邊），
     同一道班級層級的門沒有裝到知識建構空間。洩題方向是先做完的
     流向還在做的，而完課速度本身與條件共變（三個 AI 組每題要花對話時間），
     KB 曝露量與貼文量也一併被完課速度決定，而那正是 KBI 與論述層次的來源。 */
  if (typeof classKeyReleased === 'function' && !classKeyReleased('a-post', me.id)) return true;
  return false;
}
/* 鎖住的原因。文案與出口要跟著原因走，不能一律說「先把作業交出來」。 */
function kbLockReason(u){
  const me = u || currentUser();
  if (me.role !== 'student') return null;
  if (pendingAssignments(me.id).length > 0) return 'pending';
  if (submitted('a-post', me.id) && !surveyOf(me.id, 'post')) return 'survey';
  if (typeof classKeyReleased === 'function' && !classKeyReleased('a-post', me.id)) return 'class';
  return null;
}
/* 同一把鎖只准有一份說法。原本三個入口各自寫死一組字串：側欄只認 'survey'
   （其餘一律「測驗後開放」）、首頁左邊那張卡不分原因一律「交完卷就可以繼續」、
   kbGate 又是第三種。交完卷也填完問卷的孩子，會在同一個畫面上讀到三種
   互相矛盾的條件——而其中兩種他早就滿足了。十歲的孩子最合理的解讀是
   「我的交卷沒有生效」，而全站沒有任何補交或改答路徑可以驗證。
   badge = 側欄與統計卡的短標；line = 副標；hint = 左邊那張卡的下一步。 */
const KB_LOCK_TEXT = {
  pending: {badge:'測驗後開放', line:'交完卷就會打開', hint:'交完卷就可以繼續'},
  survey:  {badge:'問卷後開放', line:'問卷填完就會打開', hint:'問卷填完就可以繼續'},
  class:   {badge:'全班完成後開放', line:'等老師打開之後', hint:'等老師打開之後'}
};
function kbLockLabel(u){
  return KB_LOCK_TEXT[kbLockReason(u)] || null;
}
function scaffold(id){ return SCAFFOLDS.find(function(s){ return s.id === id; }); }
function scaffoldLabel(id){ const s = scaffold(id); return s ? s.label : ''; }

function notesOfView(vid){ return state.notes.filter(function(n){ return n.viewId === vid; }); }
/* 某一群學生所屬班級的貼文。分析端的分子與分母都要用同一個範圍——
   分母用全站、分子只算本班，閱讀率會被系統性壓低。 */
function notesOfClass(ids){
  const cid = ids && ids.length ? (classOfStudent(ids[0]) || {}).id : null;
  const ok = {};
  state.views.forEach(function(v){ if ((v.classId || kbClass().id) === cid) ok[v.id] = 1; });
  return state.notes.filter(function(n){ return ok[n.viewId]; });
}
function childrenOf(nid){ return state.notes.filter(function(n){ return n.buildOn === nid; }); }
function noteText(n){
  return (n.segs || []).map(function(s){ return s.text; }).join('\n');
}
function noteFullText(n){
  return n.title + '\n' + noteText(n);
}
function noteAuthors(n){ return (n.authorIds || []).map(userName).join('、'); }
function uid(p){ return p + '-' + Math.random().toString(36).slice(2, 9); }

/* 一則貼文所屬的「想法串」（idea thread）：往上追到根 */
function threadRootOf(n){
  let cur = n, guard = 0;
  while (cur && cur.buildOn && guard++ < 50){ const p = getNote(cur.buildOn); if (!p) break; cur = p; }
  return cur;
}
function threadOf(rootId){
  const out = [];
  (function walk(id, depth){
    const n = getNote(id); if (!n) return;
    out.push({note:n, depth:depth});
    childrenOf(id).sort(function(a, b){ return a.createdAt - b.createdAt; })
      .forEach(function(c){ walk(c.id, depth + 1); });
  })(rootId, 0);
  return out;
}

/* --- 寫入操作 --- */
function createNote(o){
  if (isImpersonating()) return null;
  const n = {
    id: uid('n'), viewId: o.viewId, title: o.title || '（未命名）',
    segs: o.segs || [],
    /* 空陣列是 truthy，所以 `o.authorIds || [me]` 永遠不會補回本人——
       署名會被靜默清空，而貼文數、延伸數、KB 指數都掛在 authorIds 上。 */
    authorIds: (o.authorIds && o.authorIds.length) ? o.authorIds : [currentUser().id],
    keywords: o.keywords || [], createdAt: Date.now(), editedAt: null,
    x: o.x != null ? o.x : 60 + Math.round(Math.random() * 400),
    y: o.y != null ? o.y : 60 + Math.round(Math.random() * 300),
    kind: o.kind || 'note', buildOn: o.buildOn || null, contains: o.contains || [],
    refs: o.refs || [], itemRef: o.itemRef || null, reads: [], annotations: []
  };
  state.notes.push(n); save(); return n;
}
/* 修訂次數在知識建構理論裡是想法精進（idea improvement）的指標，本研究把它
   算進 KB 指數。只有真的改到內容才算一次修訂——按了更新但什麼都沒動不算，
   拖曳版面更不算（走 moveNote）。 */
const NOTE_TOUCH_KEYS = ['title','segs','keywords','authorIds','refs','buildOn','contains','itemRef'];
function updateNote(id, patch){
  if (isImpersonating()) return null;
  const n = getNote(id); if (!n) return null;
  const changed = Object.keys(patch).some(function(k){
    return NOTE_TOUCH_KEYS.indexOf(k) >= 0 && JSON.stringify(n[k]) !== JSON.stringify(patch[k]);
  });
  Object.keys(patch).forEach(function(k){ n[k] = patch[k]; });
  if (changed){
    n.editedAt = Date.now();
    n.revisions = (n.revisions || 0) + 1;
  }
  save(); return n;
}
/* 把畫布整理得整齊一點，不是想法精進。 */
function moveNote(id, x, y){
  if (isImpersonating()) return false;
  const n = getNote(id); if (!n) return false;
  n.x = x; n.y = y; save(); return true;
}
/* 回傳成功與否。呼叫端要依它決定 toast，否則會出現
   「確認框說無法復原、toast 說已刪除、貼文還在」這種三方矛盾。 */
function deleteNote(id){
  if (isImpersonating()) return false;
  state.notes = state.notes.filter(function(n){ return n.id !== id; });
  state.notes.forEach(function(n){
    if (n.buildOn === id) n.buildOn = null;
    n.contains = (n.contains || []).filter(function(c){ return c !== id; });
    n.refs = (n.refs || []).filter(function(r){ return r.noteId !== id; });
  });
  save(); return true;
}
function markRead(id){
  if (isImpersonating()) return;   // 代為檢視：不寫進學生的閱讀紀錄
  const n = getNote(id); const me = currentUser().id;
  if (n && n.authorIds.indexOf(me) < 0 && (n.reads || []).indexOf(me) < 0){ n.reads.push(me); save(); }
}
function isUnread(n){
  const me = currentUser().id;
  return n.authorIds.indexOf(me) < 0 && (n.reads || []).indexOf(me) < 0;
}
/* 回傳是否真的寫成功——呼叫端要據此決定 toast 說什麼，
   否則會出現「已加上註記」但註記區是空的。 */
function addAnnotation(id, text){
  if (isImpersonating()) return false;
  const n = getNote(id); if (!n || !text.trim()) return false;
  n.annotations = n.annotations || [];
  n.annotations.push({id: uid('an'), authorId: currentUser().id, text: text.trim(), at: Date.now()});
  save();
  return true;
}
function createView(o){
  /* 視圖一定屬於某一個班。條件是在班級層次操弄的，四個班共用一塊白板
     等於讓對照組讀得到 tutor 班的全部討論——教科書式的擴散污染。 */
  const v = {id: uid('v'), title: o.title, desc: o.desc || '', createdAt: Date.now(),
             classId: o.classId || (currentClass() || kbClass()).id,
             origin: o.origin || null, links: o.links || []};
  state.views.push(v); save(); return v;
}

/* 目前這位使用者看得到哪些視圖。
   沒有 classId 的舊視圖視為示範班（相容改版前存下來的資料）。
   教師與研究者看得到自己選定班級的；學生只看得到自己班的。 */
function viewsForViewer(){
  const me = currentUser();
  const k = isTeacher() ? currentClass() : classOfStudent(me.id);
  const kid = k ? k.id : null;
  return state.views.filter(function(v){
    return (v.classId || kbClass().id) === kid;
  });
}
function viewVisible(vid){
  return viewsForViewer().some(function(v){ return v.id === vid; });
}
/* 這位使用者看得到的貼文（用於未讀數與搜尋，兩者都不可以跨班） */
function notesForViewer(){
  const ok = {};
  viewsForViewer().forEach(function(v){ ok[v.id] = 1; });
  return state.notes.filter(function(n){ return ok[n.viewId]; });
}

/* ==========================================================================
   橋接：由 KIDMAP 迷思題產生知識建構視圖
   —— 這是兩個平台真正接起來的地方 ——
   ========================================================================== */
/* 這個班有沒有為這一題開過共構視圖。
   原本掃全站：c-1 先為第 5 題開了視圖，c-2 的老師就看到「進入共構視圖 →」，
   點下去被 viewVisible() 擋掉——而且〈開啟共構視圖〉的按鈕永遠不出現，
   他再也沒辦法為自己班開這一題。那不是死連結，是功能被別班鎖住。 */
function bridgeExists(aid, iid){
  return viewsForViewer().find(function(v){
    return v.origin && v.origin.aid === aid && v.origin.iid === iid;
  });
}

function buildInquiryPrompt(pi, diag, klass){
  const it = pi.item;
  const dis = pi.topDistractor != null ? it.options[pi.topDistractor] : null;
  const mis = pi.misCode ? MISCONCEPTIONS.find(function(m){ return m.id === pi.misCode; }) : null;
  /* 人數必須跟名單同一個範圍。原本 n2/n1 是四班全樣本（第 13 題 21 與 16），
     而名單已依班過濾只印 3 個名字——21+16=37 大於全班 24 人，孩子自己數得出矛盾。 */
  const inClass = {};
  ((klass || currentClass() || kbClass()).studentIds || []).forEach(function(s){ inClass[s] = 1; });
  const only = function(arr){ return (arr || []).filter(function(s){ return inClass[s]; }).length; };
  const lines = [];
  /* 這段字是貼給全班讀的貼文本文，不是教師報表。
     兩個必須避免的東西：
     (1) 寫死「前測」——函式明明收到了 diag，卻在後測的橋接上印「前測」；
     (2) 「落在迷思象限／本來應該答得出來」——那是當著全班的面
         對特定幾個孩子貼缺陷標籤，跟這個平台自己寫的知識建構原則相反。 */
  const n2 = only(pi.q2Students), n1 = only(pi.q1Students);
  /* 這一題本班沒有人讀法不同時，整句不要輸出——原本只有 n1 有守門。 */
  if (n2){
    lines.push('「' + diag.assignment.title + '」' + itemLabel(diag.assignment.id, it.id) + '（' + textTitle(it.unit) + '）有 ' +
      n2 + ' 位同學的讀法跟答案不一樣。我們一起看看，是哪一句話讓大家想得不同。');
    /* topDistractorN 同樣是全樣本，一起改成本班計數——
       只改兩個數字會留下第三個。 */
    if (dis){
      const dn = (pi.q2Students || []).filter(function(s){
        if (!inClass[s]) return false;
        const r = state.responses.find(function(x){
          return x.aid === diag.assignment.id && x.sid === s && x.iid === it.id; });
        return r && r.choice === pi.topDistractor;
      }).length;
      if (dn) lines.push('這些同學裡最多人選的是「' + dis + '」（' + dn + ' 人）。');
    }
    if (mis) lines.push('這常常跟「' + mis.name + '」有關：' + mis.desc);
  } else {
    lines.push('「' + diag.assignment.title + '」' + itemLabel(diag.assignment.id, it.id) + '（' + textTitle(it.unit) +
      '）值得我們一起再看一次。');
  }
  if (n1) lines.push('另外有 ' + n1 + ' 位同學這一題讀得很穩，請他們先把自己的想法貼出來，讓大家看得到不同的思路。');
  lines.push('請大家不要只寫答案。先說你原本怎麼想，再說你現在覺得哪裡需要修正，並且盡量舉出一個能檢驗的例子。');
  return lines.join('\n');
}

function createBridgeView(diag, pi){
  const it = pi.item;
  const exist = bridgeExists(diag.assignment.id, it.id);
  if (exist) return exist;
  const mis = pi.misCode ? MISCONCEPTIONS.find(function(m){ return m.id === pi.misCode; }) : null;
  /* 視圖屬於老師目前帶的那一班，名單也只能是那一班的。
     診斷是四班全樣本（共用同一次 Rasch 校準），但貼進單一班級白板的
     點名清單如果橫跨四個班兩所學校，孩子會被一群他不認識的名字包圍，
     而且那也是跨條件曝光。 */
  const k = currentClass() || kbClass();
  const inClass = {};
  (k.studentIds || []).forEach(function(sid){ inClass[sid] = 1; });
  const q1 = (pi.q1Students || []).filter(function(sid){ return inClass[sid]; });

  // 視圖標題刻意寫成一個「問題」而不是一個「主題」——知識建構的起點是問題。
  const v = createView({
    title: mis ? '「' + mis.name + '」什麼時候會出錯？' : (itemLabel(diag.assignment.id, it.id) + '：我們卡在哪裡？'),
    /* desc 是存下來的資料，學生在視圖列表與畫布抬頭都會直接讀到，
       isTeacher() 分岔救不了。教師需要的溯源資訊已經結構化存在 v.origin，
       顯示端要講 KIDMAP 就從 origin 現算。 */
    desc: '從「' + diag.assignment.title + '」' + itemLabel(diag.assignment.id, it.id) + '長出來的共同問題。',
    classId: k.id,
    origin: {aid: diag.assignment.id, iid: it.id, mis: pi.misCode || null}
  });
  createNote({
    viewId: v.id, kind: 'problem',
    title: '【全班共同問題】' + shortStem(it.stem),
    authorIds: [k.teacherId],
    keywords: it.tags || [],
    itemRef: {aid: diag.assignment.id, iid: it.id},
    segs: [{s: 's2', text: buildInquiryPrompt(pi, diag, k)}],
    x: 60, y: 40
  });
  // 在這一題讀得比較穩的同學，請他們先說自己怎麼想
  if (q1.length){
    createNote({
      viewId: v.id, kind: 'note',
      title: '這一題的知識資源人',
      authorIds: [k.teacherId],
      keywords: ['對稱知識進展'],
      segs: [{s: 's3', text: '這一題讀得很穩的同學：' + q1.map(userName).join('、') +
        '。請你們先貼出「我當時是怎麼想的」，不要直接寫正確答案，讓大家有東西可以比較。'}],
      x: 330, y: 40
    });
  }
  save();
  return v;
}

function shortStem(s){
  const t = String(s).replace(/\s+/g, ' ').trim();
  return t.length > 22 ? t.slice(0, 22) + '…' : t;
}

/* --- 搜尋（對應 Knowledge Forum 的 Title / Scaffold / Content / Author / Date） --- */
function searchNotes(field, q){
  const s = String(q || '').trim().toLowerCase();
  if (!s) return [];
  /* 搜尋也不可以跨班——列表過濾了、搜尋沒濾，那就是一條後門。 */
  return notesForViewer().filter(function(n){
    if (field === 'title')   return n.title.toLowerCase().indexOf(s) >= 0;
    if (field === 'content') return noteText(n).toLowerCase().indexOf(s) >= 0;
    if (field === 'author')  return (n.authorIds || []).some(function(a){ return userName(a).toLowerCase().indexOf(s) >= 0; });
    if (field === 'scaffold')return (n.segs || []).some(function(g){ return scaffoldLabel(g.s).toLowerCase().indexOf(s) >= 0; });
    if (field === 'keyword') return (n.keywords || []).some(function(k){ return k.toLowerCase().indexOf(s) >= 0; });
    if (field === 'date')    return fmtDate(n.createdAt).indexOf(s) >= 0;
    return false;
  });
}

/* --- 格式化 --- */
function fmtDate(ts){
  const d = new Date(ts);
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}
function fmtDateTime(ts){
  const d = new Date(ts);
  return fmtDate(ts) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
}
function pad2(n){ return n < 10 ? '0' + n : '' + n; }
function fx(v, d){ return (v === null || v === undefined || !isFinite(v)) ? '—' : Number(v).toFixed(d === undefined ? 2 : d); }
function pct(v){ return (v === null || v === undefined || !isFinite(v)) ? '—' : Math.round(v * 100) + '%'; }
function esc(s){
  return String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function nl2br(s){ return esc(s).replace(/\n/g, '<br>'); }
