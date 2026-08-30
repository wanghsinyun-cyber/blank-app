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

function adoptForeignState(next){
  if (!next || typeof next !== 'object') return;
  STATE_REV = next.rev || 0;
  const hash = location.hash;
  state = next;
  try {
    if (typeof renderShell === 'function') renderShell();
    if (typeof render === 'function'){ location.hash = hash; render(); }
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
    adoptForeignState(next);
  });
}

function save(){
  if (isImpersonating() && !save._allowUiWrite){
    if (typeof console !== 'undefined' && console.warn)
      console.warn('[KAIROS] 代為檢視期間的落地被擋下', new Error().stack);
    return true;   // 刻意不落地，不是失敗
  }
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
          return s;
        }
        console.warn('[KAIROS] 作答紀錄與現行題本的答案鍵不一致，已重新產生示範資料。');
      }
    }
  } catch (e) { /* 讀不到就重新產生示範資料 */ }
  return buildSeedState();
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
  return pendingAssignments(me.id).length > 0;
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
