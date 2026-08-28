/* ==========================================================================
   50-kb.js — 知識建構模型（Knowledge Forum 式）＋ 資料存取 ＋ 橋接
   橋接 = 本系統的核心：把 KIDMAP 第二象限（迷思）轉為社群的真實問題。
   ========================================================================== */

const STORE_KEY = 'kidforum.state.v1';
let state = null;

function save(){
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* 無痕模式等情況：僅存在記憶體 */ }
}
function loadState(){
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw){
      const s = JSON.parse(raw);
      if (s && s.version === STATE_VERSION) return s;   // 版號不符（示範資料改版）→ 重新產生
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
    '<p style="max-width:60ch">你的作業、討論與學習軌跡都在左邊的選單裡。</p>' +
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
function kbLocked(u){
  const me = u || currentUser();
  if (me.role !== 'student') return false;
  return pendingAssignments(me.id).length > 0;
}
function scaffold(id){ return SCAFFOLDS.find(function(s){ return s.id === id; }); }
function scaffoldLabel(id){ const s = scaffold(id); return s ? s.label : ''; }

function notesOfView(vid){ return state.notes.filter(function(n){ return n.viewId === vid; }); }
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
  const n = {
    id: uid('n'), viewId: o.viewId, title: o.title || '（未命名）',
    segs: o.segs || [], authorIds: o.authorIds || [currentUser().id],
    keywords: o.keywords || [], createdAt: Date.now(), editedAt: null,
    x: o.x != null ? o.x : 60 + Math.round(Math.random() * 400),
    y: o.y != null ? o.y : 60 + Math.round(Math.random() * 300),
    kind: o.kind || 'note', buildOn: o.buildOn || null, contains: o.contains || [],
    refs: o.refs || [], itemRef: o.itemRef || null, reads: [], annotations: []
  };
  state.notes.push(n); save(); return n;
}
function updateNote(id, patch){
  const n = getNote(id); if (!n) return null;
  Object.keys(patch).forEach(function(k){ n[k] = patch[k]; });
  n.editedAt = Date.now();
  n.revisions = (n.revisions || 0) + 1;
  save(); return n;
}
function deleteNote(id){
  state.notes = state.notes.filter(function(n){ return n.id !== id; });
  state.notes.forEach(function(n){
    if (n.buildOn === id) n.buildOn = null;
    n.contains = (n.contains || []).filter(function(c){ return c !== id; });
    n.refs = (n.refs || []).filter(function(r){ return r.noteId !== id; });
  });
  save();
}
function markRead(id){
  const n = getNote(id); const me = currentUser().id;
  if (n && n.authorIds.indexOf(me) < 0 && (n.reads || []).indexOf(me) < 0){ n.reads.push(me); save(); }
}
function isUnread(n){
  const me = currentUser().id;
  return n.authorIds.indexOf(me) < 0 && (n.reads || []).indexOf(me) < 0;
}
function addAnnotation(id, text){
  const n = getNote(id); if (!n || !text.trim()) return;
  n.annotations = n.annotations || [];
  n.annotations.push({id: uid('an'), authorId: currentUser().id, text: text.trim(), at: Date.now()});
  save();
}
function createView(o){
  const v = {id: uid('v'), title: o.title, desc: o.desc || '', createdAt: Date.now(),
             origin: o.origin || null, links: o.links || []};
  state.views.push(v); save(); return v;
}

/* ==========================================================================
   橋接：由 KIDMAP 迷思題產生知識建構視圖
   —— 這是兩個平台真正接起來的地方 ——
   ========================================================================== */
function bridgeExists(aid, iid){
  return state.views.find(function(v){
    return v.origin && v.origin.aid === aid && v.origin.iid === iid;
  });
}

function buildInquiryPrompt(pi, diag){
  const it = pi.item;
  const n2 = pi.q[2], n1 = pi.q[1];
  const dis = pi.topDistractor != null ? it.options[pi.topDistractor] : null;
  const mis = pi.misCode ? MISCONCEPTIONS.find(function(m){ return m.id === pi.misCode; }) : null;
  const lines = [];
  lines.push('前測第 ' + it.no + ' 題（' + textTitle(it.unit) + '）有 ' + n2 + ' 位同學落在「迷思」象限——'
    + '照他們在其他題目上的表現，這一題本來應該答得出來，實際卻答錯了。');
  if (dis) lines.push('這些同學裡最多人選的是「' + dis + '」（' + pi.topDistractorN + ' 人）。');
  if (mis) lines.push('這通常和「' + mis.name + '」有關：' + mis.desc);
  if (n1) lines.push('另外有 ' + n1 + ' 位同學在這題超越預期答對，請他們先把自己的想法貼出來，讓大家看得到不同的思路。');
  lines.push('請大家不要只寫答案。先說你原本怎麼想，再說你現在覺得哪裡需要修正，並且盡量舉出一個能檢驗的例子。');
  return lines.join('\n');
}

function createBridgeView(diag, pi){
  const it = pi.item;
  const exist = bridgeExists(diag.assignment.id, it.id);
  if (exist) return exist;
  const mis = pi.misCode ? MISCONCEPTIONS.find(function(m){ return m.id === pi.misCode; }) : null;
  // 視圖標題刻意寫成一個「問題」而不是一個「主題」——知識建構的起點是問題。
  const v = createView({
    title: mis ? '「' + mis.name + '」什麼時候會出錯？' : ('第 ' + it.no + ' 題：我們卡在哪裡？'),
    desc: '由 ' + diag.assignment.title + ' 第 ' + it.no + ' 題的 KIDMAP 迷思象限自動開啟。',
    origin: {aid: diag.assignment.id, iid: it.id, mis: pi.misCode || null}
  });
  createNote({
    viewId: v.id, kind: 'problem',
    title: '【全班共同問題】' + shortStem(it.stem),
    authorIds: [kbClass().teacherId],
    keywords: it.tags || [],
    itemRef: {aid: diag.assignment.id, iid: it.id},
    segs: [{s: 's2', text: buildInquiryPrompt(pi, diag)}],
    x: 60, y: 40
  });
  // 把「優勢概念」的同學標成知識資源人，貼一張邀請卡
  if (pi.q1Students.length){
    createNote({
      viewId: v.id, kind: 'note',
      title: '這一題的知識資源人',
      authorIds: [kbClass().teacherId],
      keywords: ['對稱知識進展'],
      segs: [{s: 's3', text: '在這一題超越預期答對的同學：' +
        pi.q1Students.map(userName).join('、') +
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
  return state.notes.filter(function(n){
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
