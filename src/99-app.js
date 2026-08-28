/* ==========================================================================
   99-app.js — 路由、事件、啟動
   ========================================================================== */

const DISCOURSE_ROUTES = {kb:1, note:1, synth:1};
const PLAIN_ROUTES = {about:1, settings:1, bank:1, survey:1};
const RESEARCHER_ONLY = {research:1, create:1, settings:1};
/* 教師端專屬。這些頁面會印出正解、誘答標記與全班診斷；
   學生走進去等於在前後測之間拿到答案，Δθ 就沒有意義了。 */
const TEACHER_ONLY = {assign:1, dash:1, inspect:1, bank:1};

/* 上一次繪製的是哪一條路由。用來判斷這次 render() 是「換頁」還是「原地重繪」：
   換頁才捲回頁首並把焦點交給主舞台；原地重繪要把捲動位置與焦點放回去，
   否則學生每標一句話、每點一顆量尺都會被彈回頁首、焦點掉回 body。 */
let LAST_ROUTE_KEY = null;

function render(){
  ROUTE = parseRoute();
  const stage = $('#stage');
  stage.className = 'stage' + (DISCOURSE_ROUTES[ROUTE.name] ? ' discourse' : (PLAIN_ROUTES[ROUTE.name] ? '' : ' measure'));
  const v = $('#view');
  let html = '';
  const a = ROUTE.args;
  /* 研究者專屬的頁面：教師從側欄看不到，直接打網址也擋下來。
     這些是研究工具（分派條件、命題、改系統設定），不是教學工具。 */
  if (RESEARCHER_ONLY[ROUTE.name] && !isResearcher()){
    stage.className = 'stage';
    $('#view').innerHTML = '<div class="empty"><h3>這一頁只有研究者看得到</h3>' +
      '<p style="max-width:60ch">條件分派、建立派題與系統設定屬於研究端的操作。' +
      '教學上需要的資料在「教師後台」「派題分析」「知識建構中心」與「雙軌評量儀表板」。</p>' +
      '<a class="btn" href="#/teacher">回教師後台</a></div>';
    renderRail();
    return;
  }
  if (TEACHER_ONLY[ROUTE.name] && !isTeacher()){
    stage.className = 'stage';
    $('#view').innerHTML = '<div class="empty"><h3>這一頁是老師看的</h3>' +
      '<p style="max-width:60ch">你的作業、討論與學習軌跡都在左邊的選單裡。</p>' +
      '<a class="btn" href="#/student">回我的作業</a></div>';
    renderRail();
    return;
  }
  switch (ROUTE.name){
    case 'teacher':   html = isTeacher() ? viewTeacher() : viewStudent(); break;
    case 'create':    html = viewCreate(); break;
    case 'assign':    html = viewAssign(a[0]); break;
    case 'kb':        html = a[0] ? viewKBCanvas(a[0]) : viewKBList(); break;
    case 'note':      html = viewNote(a[0]); break;
    case 'synth':     html = viewSynth(a[0]); break;
    case 'dash':      html = viewDash(); break;
    case 'bank':      html = viewBank(); break;
    case 'settings':  html = viewSettings(); break;
    case 'about':     html = viewAbout(); break;
    case 'research':  html = viewResearch(); break;
    case 'aal':       html = viewAaL(a[0]); break;
    case 'inspect':   html = viewInspect(a[0], a[1]); break;
    case 'survey':    html = viewSurvey(a[0] === 'pre' ? 'pre' : 'post', +a[1] || 0); break;
    case 'student':   html = viewStudent(); break;
    case 'quiz':      html = viewQuiz(a[0]); break;
    case 'result':    html = viewResult(a[0]); break;
    case 'mygrowth':  html = viewMyGrowth(); break;
    default:          html = '<div class="empty"><h3>找不到這一頁</h3><a class="btn" href="#/teacher">回首頁</a></div>';
  }
  /* 重繪之前先記下位置與焦點。焦點用 data-* 屬性組出選擇器再找回來——
     aal-mark 的 data-i、sv-pick 的 data-k+data-v、aal-check 的 data-i
     在同一頁內都唯一。 */
  const key = ROUTE.name + '/' + a.join('/');
  const samePage = (key === LAST_ROUTE_KEY);
  const prevY = window.scrollY;
  const ae = document.activeElement;
  let fk = null;
  if (samePage && ae && ae !== document.body && v.contains(ae) && ae.dataset && ae.dataset.act){
    fk = '[data-act="' + ae.dataset.act + '"]' +
      (ae.dataset.i !== undefined ? '[data-i="' + ae.dataset.i + '"]' : '') +
      (ae.dataset.k !== undefined ? '[data-k="' + ae.dataset.k + '"]' : '') +
      (ae.dataset.v !== undefined ? '[data-v="' + ae.dataset.v + '"]' : '');
  }

  v.innerHTML = html;
  renderRail();
  if (ROUTE.name === 'quiz' || ROUTE.name === 'aal') initPads();
  if (ROUTE.name === 'kb' && a[0]) initCanvasDrag();
  if (ROUTE.name === 'aal'){
    const c = document.getElementById('aalChat');
    if (c) c.scrollTop = c.scrollHeight;
  }

  if (!samePage){
    try { window.scrollTo(0, 0); } catch (e) {}
    if (stage) stage.focus({preventScroll: true});
  } else {
    if (fk){ const back = v.querySelector(fk); if (back) back.focus({preventScroll: true}); }
    try { window.scrollTo(0, prevY); } catch (e) {}
  }
  LAST_ROUTE_KEY = key;
}

/* --- 畫布拖曳 --- */
function initCanvasDrag(){
  const inner = $('#canvasInner'); if (!inner) return;
  let drag = null;
  inner.addEventListener('pointerdown', function(e){
    const el = e.target.closest('.note'); if (!el) return;
    const n = getNote(el.dataset.note); if (!n) return;
    drag = {el:el, n:n, sx:e.clientX, sy:e.clientY, ox:n.x, oy:n.y, moved:false};
    el.setPointerCapture(e.pointerId);
  });
  inner.addEventListener('pointermove', function(e){
    if (!drag) return;
    const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
    if (!drag.moved) return;
    drag.el.style.left = Math.max(0, drag.ox + dx) + 'px';
    drag.el.style.top = Math.max(0, drag.oy + dy) + 'px';
  });
  inner.addEventListener('pointerup', function(e){
    if (!drag) return;
    const d = drag; drag = null;
    if (d.moved){
      updateNote(d.n.id, {x: parseInt(d.el.style.left, 10), y: parseInt(d.el.style.top, 10)});
      render();
    } else if (KBSEL){
      if (KBPICK[d.n.id]) delete KBPICK[d.n.id]; else KBPICK[d.n.id] = true;
      render();
    } else {
      go('#/note/' + d.n.id);
    }
  });
  inner.addEventListener('keydown', function(e){
    const el = e.target.closest('.note');
    if (el && (e.key === 'Enter' || e.key === ' ')){ e.preventDefault(); go('#/note/' + el.dataset.note); }
  });
}

/* --- 匯出 --- */
function researchBundle(){
  const pre = diagnose(state, 'a-pre'), post = diagnose(state, 'a-post');
  const dt = dualTrack();
  function packDiag(d){
    if (!d) return null;
    return {
      assignment: d.assignment.id, ready: d.ready,
      persons: d.perStudent.map(function(p){
        return {sid:p.sid, name:userName(p.sid), theta:p.theta, se:p.se, infit:p.infit,
                right:p.right, n:p.n, quadrants:p.q};
      }),
      items: d.perItem.map(function(i){
        return {iid:i.item.id, no:i.item.no, unit:i.item.unit, delta:i.delta, infit:i.infit, outfit:i.outfit,
                pass:i.pass, misRate:i.misRate, quadrants:i.q, misCode:i.misCode,
                topDistractor:i.topDistractor, q2Students:i.q2Students, q1Students:i.q1Students};
      }),
      cells: d.cells.map(function(c){
        return {sid:c.sid, iid:c.iid, correct:c.correct, quadrant:c.q, choice:c.choice, expectedP:c.p};
      })
    };
  }
  return {
    meta: {system:'KAIROS', exportedAt: new Date().toISOString(),
           note:'示範資料為固定種子模擬，非真實學生資料。'},
    users: state.users.map(function(u){ return {id:u.id, name:u.name, role:u.role}; }),
    classes: state.classes, units: UNITS, items: ITEMS, misconceptions: MISCONCEPTIONS,
    scaffolds: SCAFFOLDS,
    assignments: state.assignments, responses: state.responses, submissions: state.submissions,
    views: state.views,
    notes: state.notes.map(function(n){
      return Object.assign({}, n, {epistemicLevel: epistemicLevel(n),
        domainTerms: domainTermsIn(noteFullText(n)), text: noteText(n)});
    }),
    diagnostics: {pre: packDiag(pre), post: packDiag(post)},
    discourse: discourseStats(),
    network: snaGraph(),
    community: communitySummary(),
    dualTrack: dt.rows.map(function(r){
      return {sid:r.sid, name:userName(r.sid), thetaPre:r.thetaPre, thetaPost:r.thetaPost,
              delta:r.delta, kbi:r.kbi, zone:r.zone, zoneName:DUAL_ZONE[r.zone].name};
    }),
    /* --- 評量即學習：設計、歷程與效果 --- */
    aal: {
      conditions: CONDITIONS,
      processes: PROCESSES,
      subprocesses: SUBPROCESSES,
      questionFunctions: QFUNCTIONS,
      turnSchedule: TURN_SCHEDULE,
      maxTurns: (state.settings && state.settings.maxTurns) || MAX_TURNS,
      promptModules: {
        backbone: PROMPT_BACKBONE,
        roles: PROMPT_ROLE,
        processes: PROCESSES.reduce(function(o, p){ o[p.id] = promptProcessModule(p.id); return o; }, {})
      },
      itemProcess: ITEMS.reduce(function(o, i){ o[i.id] = i.process; return o; }, {}),
      assignmentLog: state.assignmentLog,
      behaviorCodes: BEHAVIOR_CODES,
      enaCodes: ENA_CODES,
      selfChecks: SELF_CHECKS
    },
    instruments: CONSTRUCTS.map(function(c){
      return {id:c.id, name:c.name, dim:c.dim, scale:c.scale.n, phase:c.phase, source:c.src,
              items:c.items, note:'自撰示範題項，非已驗證量表'};
    }),
    surveys: (state.surveys || []).map(function(s){
      return {sid:s.sid, name:userName(s.sid), phase:s.phase,
              condition:(classOfStudent(s.sid) || {}).condition,
              raw:s.resp, scores:scoreSurvey(s.resp)};
    }),
    logs: allLogs(),
    dialogue: allDialog(),
    processAnalytics: {
      lsa: (function(){ const r = lsa(); return {codes:r.codes, F:r.F, Z:r.Z, sig:r.sig, N:r.N}; })(),
      lsaByCondition: CONDITIONS.reduce(function(o, c){
        const r = lsa({cond:c.id});
        o[c.id] = {N:r.N, sig:r.sig}; return o;
      }, {}),
      ena: (function(){
        const acc = enaAccumulate(4); const pr = enaProject(acc);
        return {codes:ENA_CODES.map(function(c){ return c.id; }), window:acc.W,
                pairs:acc.pairs, units:acc.units.map(function(u){
                  return {sid:u.sid, cond:u.cond, vector:u.norm}; }),
                projection: pr ? {var1:pr.var1, var2:pr.var2,
                  points:pr.pts} : null,
                meanNetworks: enaMeanNetworks(acc)};
      })(),
      sentiment: sentimentTrajectory(),
      relativeProcess: relativeProcessProfile()
    },
    effects: (function(){
      const rows = analysisDataset();
      const out = {};
      outcomeList().forEach(function(o){
        const r = ancova(rows, o.get, o.cov);
        if (r) out[o.id] = {name:o.name, F:r.F, df1:r.df1, df2:r.df2, p:r.p,
          partialEta2:r.eta, adjustedMeans:r.adj, descriptives:r.desc, pairwise:r.pairs};
      });
      return out;
    })(),
    dataset: analysisDataset(),
    aiOutputs: state.aiCache
  };
}

function responseCSV(){
  const rows = [['assignment','phase','student_id','student_name','item_id','item_no','unit','type','choice','correct','quadrant','theta','delta','score','text']];
  const diags = {'a-pre': diagnose(state, 'a-pre'), 'a-post': diagnose(state, 'a-post')};
  state.responses.forEach(function(r){
    const it = getItem(r.iid), a = getAssignment(r.aid);
    const d = diags[r.aid];
    const cell = d && d.ready ? d.cells.find(function(c){ return c.sid === r.sid && c.iid === r.iid; }) : null;
    rows.push([r.aid, a ? a.phase : '', r.sid, userName(r.sid), r.iid, it ? it.no : '', it ? it.unit : '',
      it ? it.type : '', r.choice === undefined ? '' : r.choice,
      r.correct === null || r.correct === undefined ? '' : (r.correct ? 1 : 0),
      cell ? cell.q : '', cell ? fx(cell.theta, 4) : '', cell ? fx(cell.delta, 4) : '',
      r.score === null || r.score === undefined ? '' : r.score,
      (r.text || '').replace(/\n/g, ' ')]);
  });
  return rows.map(function(r){
    return r.map(function(c){ return '"' + String(c).replace(/"/g, '""') + '"'; }).join(',');
  }).join('\n');
}

async function saveFile(filename, text, mime){
  try {
    if (window.claude && window.claude.use){
      const dl = await window.claude.use('downloads');
      if (dl && dl.save){ await dl.save({filename:filename, data:text}); toast('已送出下載：' + filename); return; }
    }
  } catch (e) { /* 落到瀏覽器下載 */ }
  try {
    const isCsv = /csv/.test(mime || '');
    const blob = new Blob([(isCsv ? '﻿' : '') + text], {type: mime || 'application/json;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click();
    setTimeout(function(){ URL.revokeObjectURL(url); a.remove(); }, 1000);
    toast('已下載 ' + filename);
  } catch (e) {
    toast('這個環境不允許下載檔案，請把本頁存成 HTML 後在本機開啟。');
  }
}

/* --- 事件 --- */
function bindEvents(){
  /* 作答到一半誤觸關閉／重整時攔一下。草稿已經落地，但還是要讓學生知道。 */
  window.addEventListener('beforeunload', function(e){
    if (AAL && Object.keys(AAL.answers).length){ e.preventDefault(); e.returnValue = ''; }
  });

  /* 對話輸入框按 Enter 送出。
     e.isComposing 這一行不可省——全中文的國小學童用注音選字時按 Enter
     是「確認選字」，不該把半成品送出去。 */
  document.addEventListener('keydown', function(e){
    if (e.key !== 'Enter' || e.isComposing) return;
    if (!e.target || e.target.id !== 'aalSay') return;
    e.preventDefault();
    aalSay();
  });

  /* 略過導覽：不動 hash，直接把焦點送進主舞台（#stage 有 tabindex="-1"）。 */
  const sk = document.getElementById('skipLink');
  if (sk) sk.addEventListener('click', function(){
    const s = document.getElementById('stage');
    if (s){ s.focus(); s.scrollIntoView({block:'start'}); }
  });

  document.addEventListener('click', function(e){
    const t = e.target.closest('[data-act]');
    if (!t) return;
    const act = t.dataset.act, id = t.dataset.id;

    if (act === 'modal-back' && e.target === t){ closeModal(); EDIT = null; return; }
    if (act === 'close-modal'){ closeModal(); EDIT = null; return; }
    if (act === 'asrole'){ e.preventDefault(); state.ui.role = id; save(); renderShell();
      go(isTeacher() ? '#/teacher' : '#/student'); render(); toast('已切換為 ' + userName(id)); return; }
    if (act === 'tab'){ TAB = id; render(); return; }
    if (act === 'dtab'){ DTAB = id; render(); return; }

    /* 派題精靈 */
    if (act === 'wiz-unit'){ if (WIZ.units[id]) delete WIZ.units[id]; else WIZ.units[id] = 1; render(); return; }
    if (act === 'wiz-next'){ WIZ.step++; if (WIZ.step === 3 && !WIZ.title)
      WIZ.title = uniq(Object.keys(WIZ.units)).map(function(u){ return textTitle(u); }).join('、') + ' 閱讀理解';
      render(); return; }
    if (act === 'wiz-back'){ collectWizard(); WIZ.step--; render(); return; }
    if (act === 'wiz-submit'){ submitWizard(); return; }

    /* 診斷 */
    if (act === 'kidmap-one' || act === 'kidmap-sel'){ tabKidmap.sel = id; TAB = 'kidmap'; render(); return; }
    if (act === 'item-strategy'){ openItemStrategy(id); return; }
    if (act === 'bridge'){ doBridge(id); return; }
    if (act === 'cr-sel'){ tabCR.sel = id; render(); return; }
    if (act === 'gen-rubric'){ runAI('rubric', function(f){ return aiRubric(getItem(id), true); }, true); return; }
    if (act === 'ai-class'){ runAI('ai-class', function(f){ return aiClassMisconception(diagnose(state, ROUTE.args[0]), f); }); return; }
    if (act === 'ai-note'){ runAI('ai-note', function(f){ return aiNoteFeedback(getNote(id), f); }); return; }
    if (act === 'ai-thread'){ runAI('ai-thread', function(f){ return aiThreadSynthesis(id, f); }); return; }
    if (act === 'ai-community'){ runAI('ai-community', function(f){ return aiCommunityReport(f); }); return; }
    if (act === 'items-from-view'){ showViewItems(id); return; }
    if (act.indexOf('rerun-') === 0){
      const o = act.slice(6);
      if (o === 'ai-class') runAI(o, function(){ return aiClassMisconception(diagnose(state, ROUTE.args[0]), true); }, true);
      if (o === 'ai-note') runAI(o, function(){ return aiNoteFeedback(getNote(ROUTE.args[0]), true); }, true);
      if (o === 'ai-thread') runAI(o, function(){ return aiThreadSynthesis(viewSynth.sel, true); }, true);
      if (o === 'ai-community') runAI(o, function(){ return aiCommunityReport(true); }, true);
      if (o === 'rubric') runAI(o, function(){ return aiRubric(getItem(tabCR.sel), true); }, true);
      if (o === 'strategy'){
        const dg = diagnose(state, ROUTE.args[0]);
        const p = dg.perItem.find(function(x){ return x.item.id === (openItemStrategy.cur || ''); });
        if (p) runAI(o, function(){ return aiItemStrategy(dg, p, true); }, true);
      }
      return;
    }

    /* 知識建構 */
    if (act === 'new-view'){ openNewView(); return; }
    if (act === 'new-note'){ openNoteEditor({viewId:id}); return; }
    if (act === 'buildon'){ const n = getNote(id);
      openNoteEditor({viewId:n.viewId, buildOn:id, scaffold:t.dataset.sc,
        title:'', x:(n.x || 60) + 250, y:(n.y || 60) + 140}); return; }
    if (act === 'edit-note'){ const n = getNote(id);
      openNoteEditor({id:n.id, viewId:n.viewId, title:n.title, segs:n.segs, keywords:n.keywords,
        authorIds:n.authorIds, buildOn:n.buildOn, contains:n.contains, refs:n.refs, kind:n.kind}); return; }
    if (act === 'toggle-sel'){ KBSEL = !KBSEL; if (!KBSEL) KBPICK = {}; render(); return; }
    if (act === 'make-rise'){
      const picks = Object.keys(KBPICK);
      openNoteEditor({viewId:id, kind:'rise', contains:picks,
        title:'【躍升】', segs:[{s:'s6', text:''}], x:900, y:520});
      return; }
    if (act === 'seg-add'){ collectEditor(); EDIT.segs.push({s:'s1', text:''}); renderEditor(); return; }
    if (act === 'seg-del'){ collectEditor(); EDIT.segs.splice(+t.dataset.i, 1); renderEditor(); return; }
    if (act === 'save-note'){ saveEditor(); return; }
    if (act === 'del-note'){ if (confirm('刪除這則貼文？延伸它的貼文會失去連結，這個動作無法復原。')){
      deleteNote(id); closeModal(); EDIT = null; go('#/kb'); render(); toast('已刪除。'); } return; }
    if (act === 'add-ann'){ const ta = $('#annText');
      if (ta && ta.value.trim()){ addAnnotation(id, ta.value); render(); toast('已加上註記。'); } return; }
    if (act === 'search-clear'){ KBSEARCH.q = ''; render(); return; }
    if (act === 'synth-sel'){ viewSynth.sel = id; render(); return; }

    /* 學生 */
    if (act === 'quiz-submit'){ submitQuiz(id); return; }
    if (act === 'pad-undo'){ if (PADS[id]){ PADS[id].strokes.pop(); redraw(id); } return; }
    if (act === 'pad-clear'){ if (PADS[id]){ PADS[id].strokes = []; redraw(id); } return; }
    if (act === 'similar' || act === 'similar-again'){ showSimilar(id); return; }
    if (act === 'sim-pick'){
      const ok = +t.dataset.k === +t.dataset.ans;
      const fb = document.getElementById('simfb-' + t.dataset.iid + '-' + t.dataset.i);
      if (fb) fb.innerHTML = ok ? '<span style="color:var(--good)">答對了。</span>'
        : '<span style="color:var(--crit)">再想想：正解是 ' + String.fromCharCode(65 + (+t.dataset.ans)) + '。</span>';
      return; }

    /* 研究控制台 */
    if (act === 'rtab'){ RTAB = id; render(); return; }
    if (act === 'reassign'){
      if (confirm('重新分派會改變每個班級的條件，示範日誌與示範問卷也會依新條件重算。確定嗎？')){
        doReassign(); state.surveys = buildDemoSurveys(); save(); render();
      }
      return; }

    /* 評量即學習事件 */
    if (act === 'aal-mark'){ aalMark(+t.dataset.i); return; }
    if (act === 'aal-pick'){ aalPick(+t.dataset.k); return; }
    if (act === 'aal-say'){ aalSay(); return; }
    /* 換題可能同時換掉左欄的文章（T1 十題、T2 六題）。
       文章無聲換掉會讓學生以為自己的標記不見了，所以要說一聲並把焦點帶過去。 */
    if (act === 'aal-prev' || act === 'aal-next'){
      const oldUnit = aalItem().unit;
      AAL.idx = act === 'aal-prev' ? Math.max(0, AAL.idx - 1)
                                   : Math.min(AAL.items.length - 1, AAL.idx + 1);
      aalSave();
      render();
      const nu = aalItem().unit;
      if (nu !== oldUnit){
        toast('第 ' + (AAL.idx + 1) + ' 題換了一篇文章：〈' + getText(nu).title + '〉，左邊已經換過來了。');
        const h = document.getElementById('passageTitle');
        if (h) h.focus();
      }
      return; }

    if (act === 'skip-passage'){
      const el = document.getElementById('aalAnswer');
      if (el){ el.focus(); el.scrollIntoView({block:'start'}); }
      return; }
    if (act === 'back-to-passage'){
      const h = document.getElementById('passageTitle');
      if (h){ h.focus(); h.scrollIntoView({block:'start'}); }
      return; }

    /* 教師／研究者的唯讀檢視：換題不寫任何日誌 */
    if (act === 'inspect-prev'){ INSPECT.idx = Math.max(0, INSPECT.idx - 1); render(); return; }
    if (act === 'inspect-next'){ INSPECT.idx = Math.min(INSPECT.items.length - 1, INSPECT.idx + 1); render(); return; }
    if (act === 'aal-submit'){ aalSubmit(); return; }
    if (act === 'aal-note-clear'){
      const it = aalItem();
      if ((AAL.notes[it.id] || '') && !confirm('清空這一題的筆記？')) return;
      AAL.notes[it.id] = '';
      aalSave(); render();
      return; }
    if (act === 'aal-check'){
      const it = aalItem();
      const arr = AAL.checks[it.id] = AAL.checks[it.id] || [];
      const i = +t.dataset.i, k = arr.indexOf(i);
      /* 取消勾選也要寫日誌：教師端的唯讀重播是用 CHECK 事件還原的，
         只記「勾」不記「取消」會讓老師看到學生勾了他其實已取消的項目，
         而且「勾了 N / 5」會超過 5。重播端取同一 idx 的最後一筆。 */
      if (k >= 0){ arr.splice(k, 1); aalLog('CHECK', 'C', {idx:i, off:true}); }
      else { arr.push(i); aalLog('CHECK', 'C', {idx:i, off:false}); }
      aalSave();
      return; }   // 原生 checkbox，畫面不需要重繪

    /* 問卷 */
    if (act === 'sv-page'){
      surveyDraftSave();
      go('#/survey/' + SURVEY.phase + '/' + t.dataset.v);
      return; }
    if (act === 'sv-submit'){ surveySubmit(id); return; }

    /* 設定與匯出 */
    if (act === 'test-llm'){ testLLM(); return; }
    if (act === 'export-survey'){ saveFile('kairos-surveys.csv', toSurveyCsv(), 'text/csv'); return; }
    if (act === 'export-sdis'){ saveFile('kairos-sequences.sdis', toSDIS(), 'text/plain'); return; }
    if (act === 'export-tele'){ saveFile('kairos-telemetry.csv', toTelemetryCsv(), 'text/csv'); return; }
    if (act === 'export-ena'){ saveFile('kairos-ena-lines.csv', toENACsv(), 'text/csv'); return; }
    if (act === 'export-json'){ saveFile('kairos-research-data.json',
      JSON.stringify(researchBundle(), null, 2), 'application/json'); return; }
    if (act === 'export-csv'){ saveFile('kairos-responses.csv', responseCSV(), 'text/csv'); return; }
    if (act === 'reset'){ if (confirm('重設會清除你在這台瀏覽器上新增的所有貼文與作答，回到出廠的模擬班級。確定嗎？')){
      resetState(); renderShell(); render(); toast('已重設為示範資料。'); } return; }
  });

  /* change 事件 */
  document.addEventListener('change', function(e){
    const t = e.target.closest('[data-act]');
    if (e.target.id === 'who'){ state.ui.role = e.target.value; save(); renderShell();
      go(isTeacher() ? '#/teacher' : '#/student'); render(); return; }
    if (!t) return;
    const act = t.dataset.act;
    if (act === 'wiz-item'){ const id = t.dataset.id;
      if (WIZ.items[id]) delete WIZ.items[id]; else WIZ.items[id] = 1; render(); return; }
    if (act === 'seg-sc'){ collectEditor(); EDIT.segs[+t.dataset.i].s = t.value; renderEditor(); return; }
    if (e.target.id === 'classSel'){ state.ui.classId = e.target.value; save(); render(); return; }
    /* 量尺現在是原生 radio，走 change 而不是 click——方向鍵移動也會觸發。
       只更新這一列與抬頭的計數，不重繪整段。 */
    if (act === 'sv-pick'){
      SURVEY.resp[t.dataset.k] = +t.dataset.v;
      const scale = t.closest('.scale');
      if (scale) Array.prototype.forEach.call(scale.querySelectorAll('.lk'), function(lb){
        const input = lb.querySelector('input');
        lb.classList.toggle('on', !!(input && input.checked));
      });
      const row = t.closest('.likert');
      if (row) row.classList.remove('missing');
      const d = document.getElementById('svDone');
      if (d) d.textContent = surveyKeys(SURVEY.phase, conditionOfStudent(currentUser().id))
        .filter(function(k2){ return SURVEY.resp[k2]; }).length;
      surveyDraftSave();
      return; }
    if (act === 'search-field'){ KBSEARCH.field = t.value; render(); return; }
    if (act === 'inspect-who'){ go('#/inspect/' + INSPECT.aid + '/' + t.value); return; }
    if (act === 'dg-cond'){ rDesign.sel.cond = t.value; render(); return; }
    if (act === 'dg-proc'){ rDesign.sel.proc = t.value; render(); return; }
    if (act === 'dg-qfn'){ rDesign.sel.qfn = t.value; render(); return; }
    if (act === 'lsa-cond'){ rLSA.cond = t.value; render(); return; }
    if (act === 'st-out'){ rStats.sel = t.value; render(); return; }
    if (act === 'aal-text'){ return; }
    if (act === 'bank-process'){ BANKF.process = t.value; render(); return; }
    if (act === 'bank-type'){ BANKF.type = t.value; render(); return; }
    if (act === 'bank-unit'){ BANKF.unit = t.value; render(); return; }
    if (act === 'set-unit'){ const it = getItem(t.dataset.id);
      if (it){ it.unit = t.value;
        state.unitOverrides = state.unitOverrides || {};
        state.unitOverrides[it.id] = t.value; save(); toast('已重新歸類。'); }
      return; }
    if (act === 'set-thr'){ state.settings.misThreshold = Math.max(1, Math.min(60, +t.value || 15)); save(); toast('已儲存。'); return; }
    if (act === 'set-minn'){ state.settings.minN = Math.max(3, Math.min(40, +t.value || 3)); save(); render(); return; }
    if (act === 'set-engine'){ state.settings.engine = t.value; save(); render();
      toast(t.value === 'llm' ? '已切換為外部語言模型。' : '已切換為內建規則引擎。'); return; }
    if (act === 'set-provider'){
      const map = {openai:['https://api.openai.com/v1','gpt-4o-mini'],
                   deepseek:['https://api.deepseek.com/v1','deepseek-chat'],
                   gemini:['https://generativelanguage.googleapis.com/v1beta/openai','gemini-2.0-flash']};
      state.settings.provider = t.value;
      if (map[t.value]){ state.settings.baseUrl = map[t.value][0]; state.settings.model = map[t.value][1]; }
      save(); render(); return; }
    if (act === 'set-baseurl'){ state.settings.baseUrl = t.value; save(); return; }
    if (act === 'set-model'){ state.settings.model = t.value; save(); return; }
    if (act === 'set-key'){ state.settings.apiKey = t.value; save(); render(); return; }
    if (act === 'quiz-pick'){ QUIZ.answers[t.dataset.id] = +t.dataset.k;
      $$('label.opt').forEach(function(l){ const inp = l.querySelector('input'); if (!inp) return;
        if (inp.dataset.id === t.dataset.id) l.classList.toggle('chosen', inp === t); });
      const done = Object.keys(QUIZ.answers).length;
      const bar = $('.kb-toolbar .bar i'); const lab = $('.kb-toolbar .muted');
      const total = getAssignment(QUIZ.aid).itemIds.map(getItem).filter(function(i){ return i.type === 'mc'; }).length;
      if (bar) bar.style.width = (100 * done / total) + '%';
      if (lab) lab.textContent = '已作答 ' + done + ' / ' + total + ' 題';
      return; }
    if (act === 'cr-score'){
      const r = state.responses.find(function(x){ return x.aid === t.dataset.aid && x.sid === t.dataset.sid && x.iid === t.dataset.iid; });
      if (r){ r.score = t.value === '' ? null : Math.max(0, Math.min(6, +t.value)); save(); toast('已儲存分數。'); }
      return; }
    if (act === 'cr-comment'){
      const r = state.responses.find(function(x){ return x.aid === t.dataset.aid && x.sid === t.dataset.sid && x.iid === t.dataset.iid; });
      if (r){ r.comment = t.value; save(); }
      return; }
  });

  /* input 事件 */
  let sdebounce = null;
  document.addEventListener('input', function(e){
    const t = e.target.closest('[data-act]');
    if (!t) return;
    const act = t.dataset.act;
    if (act === 'search-q'){
      KBSEARCH.q = t.value;
      clearTimeout(sdebounce);
      sdebounce = setTimeout(function(){
        render();
        const box = $('#sq'); if (box){ box.focus(); box.setSelectionRange(box.value.length, box.value.length); }
      }, 380);
      return; }
    if (act === 'quiz-text'){ QUIZ.texts[t.dataset.id] = t.value; return; }
    if (act === 'aal-text'){
      const it = aalItem();
      aalTypeTelemetry(it.id, t.value);
      if (AAL.texts[it.id] === undefined) AAL.drafts[it.id] = {first: t.value, final: t.value};
      AAL.texts[it.id] = t.value;
      if (AAL.drafts[it.id]) AAL.drafts[it.id].final = t.value;
      if (!aalTypeTelemetry._last || Date.now() - aalTypeTelemetry._last > 4000){
        aalTypeTelemetry._last = Date.now(); aalLog('TYPE', 'W', {len:t.value.length});
        aalSave();
      }
      return; }
    if (act === 'aal-note'){
      const it = aalItem();
      AAL.notes[it.id] = t.value;
      if (!aalTypeTelemetry._lastN || Date.now() - aalTypeTelemetry._lastN > 4000){
        aalTypeTelemetry._lastN = Date.now();
        aalLog('NOTE', 'N', {text:t.value.slice(-80)});
        aalSave();
      }
      return; }
    if (act === 'aalSay'){ return; }
    if (act === 'seg-text'){ EDIT.segs[+t.dataset.i].text = t.value; return; }
    if (act === 'pad-color'){ if (PADS[t.dataset.id]) PADS[t.dataset.id].color = t.value; return; }
    if (act === 'pad-width'){ if (PADS[t.dataset.id]) PADS[t.dataset.id].width = +t.value; return; }
  });

  window.addEventListener('hashchange', render);

  /* --- 無障礙控制 --- */
  $('#fsSel').addEventListener('change', function(){
    state.settings.a11y = state.settings.a11y || {};
    state.settings.a11y.fontScale = parseFloat(this.value) || 1;
    save(); applyA11y();
    toast('字級：' + Math.round(state.settings.a11y.fontScale * 100) + '%');
  });
  $('#contrastBtn').addEventListener('click', function(){
    state.settings.a11y = state.settings.a11y || {};
    state.settings.a11y.highContrast = !state.settings.a11y.highContrast;
    save(); applyA11y();
    toast(state.settings.a11y.highContrast ? '已開啟高對比模式' : '已關閉高對比模式');
  });

  $('#themeBtn').addEventListener('click', function(){
    const cur = state.ui.theme || 'system';
    const next = cur === 'system' ? 'light' : (cur === 'light' ? 'dark' : 'system');
    state.ui.theme = next; save(); applyTheme();
    toast('外觀：' + (next === 'system' ? '跟隨系統' : next === 'light' ? '淺色' : '深色'));
  });
}

/* 字級與高對比：兩者都寫進設定並持久化，換頁不會跑掉 */
function applyA11y(){
  const a = (state.settings && state.settings.a11y) || {};
  const fs = a.fontScale || 1;
  document.documentElement.style.setProperty('--fs', String(fs));
  if (a.highContrast) document.documentElement.setAttribute('data-contrast', 'high');
  else document.documentElement.removeAttribute('data-contrast');
  const sel = $('#fsSel'); if (sel) sel.value = String(fs);
  const btn = $('#contrastBtn');
  if (btn){
    btn.setAttribute('aria-pressed', a.highContrast ? 'true' : 'false');
    btn.classList.toggle('primary', !!a.highContrast);
  }
  syncNarrow();
  syncTopbarHeight();   // 字級變大時頂列會變高，sticky 的偏移量要跟著更新
}

/* 把頂列的實際高度寫進 --topbar-h。頂列是 min-height + flex-wrap，
   視窗變窄或字級放大時會換行變高；不更新的話 sticky 的側欄與文本欄
   會被壓在頂列底下（WCAG 2.4.11 焦點不被遮蔽）。 */
/* 有效寬度 = 視窗寬 ÷ 字級倍率。媒體查詢看不到 :root 的 font-size，
   所以平台自己提供的 175% 字級一開，右欄會被壓到十個中文字寬卻不觸發斷點。
   這個屬性讓 CSS 的 :root[data-narrow] 區塊接手。 */
function syncNarrow(){
  const fs = ((state && state.settings && state.settings.a11y) || {}).fontScale || 1;
  document.documentElement.toggleAttribute('data-narrow', (window.innerWidth / fs) < 900);
}

function syncTopbarHeight(){
  const t = document.querySelector('.topbar');
  if (!t) return;
  const h = Math.round(t.getBoundingClientRect().height);
  if (h > 0) document.documentElement.style.setProperty('--topbar-h', h + 'px');
}

function applyTheme(){
  const t = state.ui.theme || 'system';
  if (t === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
}

/* --- 精靈輔助 --- */
function collectWizard(){
  const t = $('#wt'); if (t) WIZ.title = t.value;
  const d = $('#wd'); if (d) WIZ.desc = d.value;
  const p = $('#wp'); if (p) WIZ.phase = p.value;
  const u = $('#wdue'); if (u) WIZ.due = u.value;
}
function submitWizard(){
  collectWizard();
  if (!WIZ.title.trim()){ toast('請填作業標題。'); return; }
  const ids = Object.keys(WIZ.items);
  if (!ids.length){ toast('至少要選一道題目。'); return; }
  const a = {id: uid('a'), title: WIZ.title.trim(), desc: WIZ.desc,
             classIds: state.classes.map(function(c){ return c.id; }),
             teacherId: state.classes[0].teacherId, itemIds: ids, phase: WIZ.phase,
             createdAt: Date.now(), due: WIZ.due ? Date.parse(WIZ.due) : Date.now() + 7 * 86400000};
  state.assignments.push(a); save();
  WIZ = null;
  toast('已派出。學生登入後就會看到。');
  go('#/assign/' + a.id);
}

/* --- 橋接 --- */
function doBridge(iid){
  const diag = diagnose(state, ROUTE.args[0]);
  const pi = diag.perItem.find(function(p){ return p.item.id === iid; });
  if (!pi) return;
  const v = createBridgeView(diag, pi);
  toast('已開啟共構視圖，並貼上探究問題與知識資源人名單。');
  go('#/kb/' + v.id);
}

/* --- 單題教學策略（彈窗） --- */
function openItemStrategy(iid){
  openItemStrategy.cur = iid;
  const diag = diagnose(state, ROUTE.args[0]);
  const pi = diag.perItem.find(function(p){ return p.item.id === iid; });
  const it = pi.item;
  modal('<div class="modal-h"><h3>第 ' + it.no + ' 題 · 教學策略</h3>' +
    '<span class="pill">' + esc(engineLabel()) + '</span>' +
    '<button class="btn sm ghost" data-act="close-modal">關閉</button></div>' +
    '<div class="modal-b"><div class="item" style="margin-bottom:12px"><div class="stem">' + esc(it.stem) + '</div>' +
    '<div class="muted small">迷思 ' + pi.q[2] + ' 人 · ' + pct(pi.misRate) + '</div></div>' +
    '<div id="out-strategy" class="muted small">分析中……</div></div>' +
    '<div class="modal-f"><button class="btn" data-act="close-modal">關閉</button></div>');
  runAI('strategy', function(f){ return aiItemStrategy(diag, pi, f); });
}

/* --- 新增視圖 --- */
function openNewView(){
  modal('<div class="modal-h"><h3>新增視圖</h3><button class="btn sm ghost" data-act="close-modal">關閉</button></div>' +
    '<div class="modal-b col">' +
    '<div class="field"><label for="vt">視圖標題</label><input id="vt" type="text" placeholder="用一個問題當標題，例如：什麼時候要寫 ±？"></div>' +
    '<div class="field"><label for="vd">說明</label><textarea id="vd" placeholder="這個視圖要一起想清楚什麼？"></textarea></div>' +
    '</div><div class="modal-f"><button class="btn" data-act="close-modal">取消</button>' +
    '<button class="btn primary" id="vcreate">建立</button></div>');
  $('#vcreate').addEventListener('click', function(){
    const t = $('#vt').value.trim();
    if (!t){ toast('請先給視圖一個標題。'); return; }
    const v = createView({title:t, desc:$('#vd').value.trim()});
    closeModal(); toast('已建立視圖。'); go('#/kb/' + v.id);
  });
}

/* --- 由討論命題 --- */
async function showViewItems(vid){
  const box = document.getElementById('out-fromview');
  if (!box) return;
  box.className = 'muted small';
  box.textContent = '命題中……';
  try {
    const items = await aiItemsFromDiscourse(getView(vid), true);
    box.className = 'col';
    box.innerHTML = items.map(function(x, i){
      return '<div class="item"><div class="eyebrow">後測題 ' + (i + 1) + '</div>' +
        '<div class="stem">' + esc(x.stem) + '</div>' +
        '<div class="opts">' + x.options.map(function(o, k){
          return '<div class="opt' + (k === x.answer ? ' right' : '') + '"><b>' + String.fromCharCode(65 + k) +
            '</b><span>' + esc(o) + (k === x.answer ? '　<span class="muted small">正解</span>' : '') + '</span></div>';
        }).join('') + '</div>' +
        (x.hint ? '<p class="muted small" style="margin-top:6px">' + esc(x.hint) + '</p>' : '') +
        (x.targets ? '<p class="muted small">' + esc(x.targets) + '</p>' : '') + '</div>';
    }).join('') + '<p class="muted small">引擎：' + esc(engineLabel()) +
      '。要正式施測，請到「建立派題」把對應單元的題目派給班級。</p>';
  } catch (e) {
    box.className = 'ai-out';
    box.innerHTML = '<p><strong>命題失敗</strong></p><p>' + esc(e.message) + '</p>';
  }
}

/* --- 交卷 --- */
function submitQuiz(aid){
  const a = getAssignment(aid), me = currentUser();
  const items = a.itemIds.map(getItem).filter(Boolean);
  const mcs = items.filter(function(i){ return i.type === 'mc'; });
  const missing = mcs.filter(function(i){ return QUIZ.answers[i.id] === undefined; });
  if (missing.length && !confirm('還有 ' + missing.length + ' 題沒作答，確定要交卷嗎？')) return;
  items.forEach(function(it){
    state.responses = state.responses.filter(function(r){
      return !(r.aid === aid && r.sid === me.id && r.iid === it.id); });
    if (it.type === 'cr'){
      state.responses.push({aid:aid, sid:me.id, iid:it.id, text:QUIZ.texts[it.id] || '',
        strokes:(PADS[it.id] && PADS[it.id].strokes.length) ? PADS[it.id].strokes : null,
        score:null, comment:'', correct:null});
    } else {
      const c = QUIZ.answers[it.id];
      state.responses.push({aid:aid, sid:me.id, iid:it.id, choice:c === undefined ? null : c,
        correct: c === it.answer});
    }
  });
  state.submissions = state.submissions.filter(function(s){ return !(s.aid === aid && s.sid === me.id); });
  state.submissions.push({aid:aid, sid:me.id, at:Date.now()});
  save(); QUIZ = null;
  toast('已交卷。往下看你的個人診斷。');
  go('#/result/' + aid);
}

/* --- 測試連線 --- */
async function testLLM(){
  const box = document.getElementById('out-testllm');
  box.textContent = '測試中……';
  try {
    const t = await llmChat([
      {role:'system', content:'你是測試助手。以最短形式回答。'},
      {role:'user', content:'請用「連線正常」四個字回答。'}
    ], {max_tokens:20, temperature:0});
    box.innerHTML = '<span style="color:var(--good)">連線正常。AI 回覆：' + esc(t.trim()) + '</span>';
  } catch (e) {
    box.innerHTML = '<span style="color:var(--crit)">連線失敗：' + esc(e.message) + '</span>';
  }
}

/* --- 啟動 --- */
function boot(){
  /* 產物是 HTML 片段（沒有自己的 <html> 標籤，這樣才能同時給 GitHub Pages
     與 Artifact 檢視器使用），所以語言宣告只能在這裡補（WCAG 3.1.1）。 */
  document.documentElement.lang = 'zh-Hant';
  syncNarrow();
  syncTopbarHeight();
  window.addEventListener('resize', function(){ syncNarrow(); syncTopbarHeight(); });
  state = loadState();
  if (!state.ui) state.ui = {role:'u-t1', classId:'c-1'};
  if (!state.ui.classId) state.ui.classId = 'c-1';
  state.logs = state.logs || [];
  state.dialog = state.dialog || [];
  applyItemProcesses();                 // 掛上逐題的官方歷程標定
  if (!state.surveys || !state.surveys.length) state.surveys = buildDemoSurveys();
  buildDemoLogs();                      // 示範日誌由種子重算，不占 localStorage
  if (state.unitOverrides){
    Object.keys(state.unitOverrides).forEach(function(k){
      const it = getItem(k); if (it) it.unit = state.unitOverrides[k];
    });
  }
  applyTheme();
  applyA11y();
  bindEvents();
  renderShell();
  if (!location.hash) location.hash = '#/teacher';
  render();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
