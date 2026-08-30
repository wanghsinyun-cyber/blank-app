/* ==========================================================================
   99-app.js — 路由、事件、啟動
   ========================================================================== */

const DISCOURSE_ROUTES = {kb:1, note:1, synth:1};
const PLAIN_ROUTES = {about:1, settings:1, bank:1, survey:1};
const RESEARCHER_ONLY = {research:1, create:1, settings:1};
/* 教師端專屬。這些頁面會印出正解、誘答標記與全班診斷；
   學生走進去等於在前後測之間拿到答案，Δθ 就沒有意義了。 */
/* synth（想法串綜整）在這裡，note 不在——學生必須讀得到別人的貼文才能延伸，
   但綜整頁會印出 AI 貼文草稿、未發言點名冊、KIDMAP，以及〈產生後測題〉
   （那顆鈕會把現役題本裡的題目連同正解印出來）。 */
const TEACHER_ONLY = {assign:1, dash:1, inspect:1, bank:1, synth:1};

/* 上一次繪製的是哪一條路由。用來判斷這次 render() 是「換頁」還是「原地重繪」：
   換頁才捲回頁首並把焦點交給主舞台；原地重繪要把捲動位置與焦點放回去，
   否則學生每標一句話、每點一顆量尺都會被彈回頁首、焦點掉回 body。 */
let LAST_ROUTE_KEY = null;

/* 自己捲動的容器：重繪之後要把 scrollTop 放回去。
   #aalChat 不在裡面——那一個要捲到底，不是原位。 */
const SCROLL_KEEP = ['.aal-text > .card-p', '.canvas'];

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
    /* 這一段在 TEACHER_ONLY 之前，所以學生打研究者網址也會走到這裡——
       不能整段講給老師聽。依身分分岔。 */
    $('#view').innerHTML = isTeacher()
      ? '<div class="empty"><h3>這一頁只有研究者看得到</h3>' +
        '<p style="max-width:60ch">條件分派、建立派題與系統設定屬於研究端的操作。' +
        '教學上需要的資料在' +
        '<a href="#/teacher">教師後台</a>、' +
        '<a href="#/assign/a-post/replay">派題分析</a>、' +
        '<a href="#/kb">知識建構空間</a>與' +
        '<a href="#/dash">雙軌評量儀表板</a>。</p>' +
        '<a class="btn" href="#/teacher">回教師後台</a></div>'
      : '<div class="empty"><h3>這一頁不是給你看的</h3>' +
        '<p style="max-width:60ch">你的作業、討論與學習軌跡都在導覽選單裡。</p>' +
        '<a class="btn" href="#/student">回我的作業</a></div>';
    renderRail();
    return;
  }
  if (TEACHER_ONLY[ROUTE.name] && !isTeacher()){
    stage.className = 'stage';
    $('#view').innerHTML = '<div class="empty"><h3>這一頁是老師看的</h3>' +
      '<p style="max-width:60ch">你的作業、討論與學習軌跡都在導覽選單裡。</p>' +
      '<a class="btn" href="#/student">回我的作業</a></div>';
    renderRail();
    return;
  }
  switch (ROUTE.name){
    case 'teacher':   html = isTeacher() ? viewTeacher() : viewStudent(); break;
    case 'create':    html = viewCreate(); break;
    case 'assign':    html = viewAssign(a[0], a[1]); break;
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
  /* 重繪之前先記下位置與焦點。焦點用 data-* 屬性組出選擇器再找回來。
     這套機制服務的是「同一條路由裡就地重繪」的按鈕群——分頁鈕（dtab、rtab）、
     KIDMAP 的學生清單、非選題切換、派題精靈的題目勾選。它們全都靠 data-id
     區分，少了那一段選擇器就只會回傳文件順序第一顆。
     （aal-mark／aal-pick／aal-check 在第 1 輪之後改成就地更新、不再走 render，
     不再是這裡的對象。） */
  const key = ROUTE.name + '/' + a.join('/');
  const samePage = (key === LAST_ROUTE_KEY);
  /* 換頁時關掉還開著的彈窗。留著的話，aria-modal 與焦點陷阱會掛在
     一個屬於別頁的對話框上——Tab 被鎖在裡面，而它談的東西已經不在畫面上。 */
  if (!samePage && $('#modalRoot').firstChild){ closeModal(); EDIT = null; }
  /* 離開知識建構空間就把選取模式與搜尋清掉。進 #/note、#/synth 再回來時
     殘留的狀態會與畫面脫節。 */
  if (ROUTE.name !== 'kb' && KBSEL){ KBSEL = null; KBPICK = {}; }
  if (ROUTE.name !== 'kb' && ROUTE.name !== 'note' && ROUTE.name !== 'synth') KBSEARCH.q = '';
  /* 離開作答頁就釋放 AAL。順便修掉「換身分之後舊 AAL 還在」的隱患。
     回來時會重跑 aalInit 並補寫一筆 RESUME——那是對的，確實是兩次入座。 */
  /* 離開作答頁一定要先結清待處理的去抖與節流，再釋放 AAL。
     render() 綁在 hashchange 上，所以這一行才是所有離開路徑的共同出口——
     側欄連結、瀏覽器上一頁、平板返回手勢、直接改 hash 都會經過這裡。
     只在〈交卷〉〈換題〉〈先離開〉三個按鈕上 flush 是不夠的。 */
  if (AAL && ROUTE.name !== 'aal'){
    try { flushPendingPicks(); flushLogs(); } catch (e) {}
    AAL = null; AAL_LEFT_VIA = 'nav';
  }
  const prevY = window.scrollY;
  /* 內層捲動容器的位置。window.scrollY 還原不了它們——v.innerHTML 一換，
     容器就被重建、scrollTop 歸零。同一篇文章換題時，學生每次都要重新捲回
     剛讀的段落；實驗組觸發重繪的次數更多，等於把這份額外負荷不對等地
     加在實驗組身上。新增捲動容器只要往這個陣列加一行。 */
  const innerY = {};
  SCROLL_KEEP.forEach(function(s){
    const el = v.querySelector(s); if (el) innerY[s] = el.scrollTop;
  });
  const ae = document.activeElement;
  let fk = null;
  if (samePage && ae && ae !== document.body && v.contains(ae) && ae.dataset && ae.dataset.act){
    /* 這些 data-* 的值目前都是系統產生的 uid，只含 [A-Za-z0-9_-]，
       所以不需要 CSS.escape。日後若其中任何一個可能含使用者輸入就要改。 */
    fk = '[data-act="' + ae.dataset.act + '"]' +
      (ae.dataset.i !== undefined ? '[data-i="' + ae.dataset.i + '"]' : '') +
      (ae.dataset.k !== undefined ? '[data-k="' + ae.dataset.k + '"]' : '') +
      (ae.dataset.v !== undefined ? '[data-v="' + ae.dataset.v + '"]' : '') +
      (ae.dataset.id !== undefined ? '[data-id="' + ae.dataset.id + '"]' : '') +
      (ae.dataset.sid !== undefined ? '[data-sid="' + ae.dataset.sid + '"]' : '') +
      (ae.dataset.iid !== undefined ? '[data-iid="' + ae.dataset.iid + '"]' : '');
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
    SCROLL_KEEP.forEach(function(s){
      const el = v.querySelector(s); if (el && innerY[s] != null) el.scrollTop = innerY[s];
    });
    /* 還原目標剛好變 disabled（換到頭尾的上一題／下一題、上一位／下一位）時，
       focus() 是 no-op，焦點會掉回 body——鍵盤使用者要從整頁最上面重來。
       寧可退到 #stage。 */
    if (fk){
      const back = v.querySelector(fk);
      if (back && !back.disabled) back.focus({preventScroll: true});
      else if (stage) stage.focus({preventScroll: true});
    }
    try { window.scrollTo(0, prevY); } catch (e) {}
  }
  LAST_ROUTE_KEY = key;
}

/* --- 畫布拖曳 --- */
function initCanvasDrag(){
  const inner = $('#canvasInner'); if (!inner) return;
  let drag = null;
  /* 座標存的是 viewBox 單位（100% 字級的 px），畫面上用 rem。 */
  const U = 20;
  function px2unit(v){ return Math.round(v); }

  /* 手指一開始捲動，瀏覽器會送 pointercancel 並收回 capture，
     但閉包裡的 drag 仍非 null——接下來的 pointermove/up 會把全班共用的
     貼文搬走並存檔。捲一次畫面就改掉別人的版面。 */
  function endDrag(){
    if (!drag) return;
    drag.el.style.left = (drag.ox / U) + 'rem';
    drag.el.style.top  = (drag.oy / U) + 'rem';
    drag = null;
  }
  inner.addEventListener('pointercancel', endDrag);
  inner.addEventListener('lostpointercapture', endDrag);

  inner.addEventListener('pointerdown', function(e){
    const el = e.target.closest('.note'); if (!el) return;
    const n = getNote(el.dataset.note); if (!n) return;
    /* 觸控的抖動比滑鼠大得多。曼哈頓距離 4px 會讓「右 3、下 2」的輕點
       就算成拖曳——實測輕點一下貼文位置就變了，而且詳頁沒有打開。 */
    drag = {el:el, n:n, sx:e.clientX, sy:e.clientY, ox:n.x, oy:n.y, moved:false,
            slop: e.pointerType === 'touch' ? 10 : 4};
    el.setPointerCapture(e.pointerId);
  });
  inner.addEventListener('pointermove', function(e){
    if (!drag) return;
    const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
    if (Math.hypot(dx, dy) > drag.slop) drag.moved = true;
    if (!drag.moved) return;
    drag.el.style.left = (Math.max(0, drag.ox + dx) / U) + 'rem';
    drag.el.style.top  = (Math.max(0, drag.oy + dy) / U) + 'rem';
  });
  inner.addEventListener('pointerup', function(e){
    if (!drag) return;
    const d = drag; drag = null;
    if (d.moved){
      const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
      moveNote(d.n.id, px2unit(Math.max(0, d.ox + dx)), px2unit(Math.max(0, d.oy + dy)));
      render();
    } else if (KBSEL){
      if (KBPICK[d.n.id]) delete KBPICK[d.n.id]; else KBPICK[d.n.id] = true;
      render();
    } else {
      go('#/note/' + d.n.id);
    }
  });
  /* 鍵盤要與指標對稱。原本 Enter 一律 go()，於是只用鍵盤的孩子
     完全做不到躍升——而躍升是知識建構空間的核心動作（2.1.1 無替代路徑）。 */
  inner.addEventListener('keydown', function(e){
    const el = e.target.closest('.note');
    if (!el) return;
    if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
    e.preventDefault();
    const id = el.dataset.note;
    if (KBSEL){
      if (KBPICK[id]) delete KBPICK[id]; else KBPICK[id] = true;
      render();
      /* render() 把整塊白板重建，正握有焦點的那張便利貼連同它一起被丟掉，
         焦點掉回 <body>。躍升要先選五、六則貼文，於是只用鍵盤的孩子
         每選一則就得從頭 Tab 過整片白板才能選下一則——
         上一輪補了 Enter 能選，但沒補選完之後人還在不在原地。 */
      const again = document.querySelector('.note[data-note="' + id + '"]');
      if (again) again.focus({preventScroll:true});
    } else {
      go('#/note/' + id);
    }
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
  /* 守門條件必須是「真的有沒落地的東西」，不是「模組變數還活著」。
     marks／checks／notes／texts／answers 都在草稿裡，正常狀況下關分頁
     不會掉資料；只有 aalSave() 寫失敗（配額）時 dirty 才會留著。 */
  window.addEventListener('beforeunload', function(e){
    /* 關分頁是最後一次寫入機會：待處理的選項、最後一段打字與日誌一起結清 */
    if (AAL){ try { flushPendingPicks(); } catch (e2) {} flushLogs(); }
    if (AAL && AAL.dirty){ e.preventDefault(); e.returnValue = ''; }
  });

  /* 對話輸入框按 Enter 送出。
     e.isComposing 這一行不可省——全中文的國小學童用注音選字時按 Enter
     是「確認選字」，不該把半成品送出去。 */
  document.addEventListener('keydown', function(e){
    /* Esc 關閉彈窗 */
    if (e.key === 'Escape' && document.getElementById('modalRoot').firstChild){
      e.preventDefault(); closeModal(); return;
    }
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
    /* 站內確認框。取消就只是關掉；確定交給 confirmModal 存下來的回呼。 */
    if (act === 'confirm-no'){
      closeModal();
      confirmModal._yes = null;
      const no = confirmModal._onNo; confirmModal._onNo = null;
      if (no) no();
      return; }
    if (act === 'confirm-yes'){
      const fn = confirmModal._yes; confirmModal._yes = null;
      if (fn) fn(); else closeModal();
      return; }
    /* 代為檢視：記住真實身分，畫面上方常駐一條有出口的橫幅，且全程唯讀。 */
    if (act === 'asrole'){
      e.preventDefault();
      if (!isImpersonating()) state.ui.impersonate = {realRole: state.ui.role, at: Date.now()};
      state.ui.role = id; saveUiOnly(); renderShell();
      go('#/student'); render();
      toast('以 ' + userName(id) + ' 的視角檢視（唯讀）');
      return; }
    if (act === 'exit-impersonate'){
      const real = state.ui.impersonate ? state.ui.impersonate.realRole : 'u-t1';
      state.ui.role = real; state.ui.impersonate = null; saveUiOnly(); renderShell();
      go('#/teacher'); render(); toast('已結束檢視');
      return; }
    if (act === 'dtab'){ DTAB = id; render(); return; }

    /* 派題精靈 */
    if (act === 'wiz-unit'){ if (WIZ.units[id]) delete WIZ.units[id]; else WIZ.units[id] = 1; render(); return; }
    if (act === 'wiz-next'){ WIZ.step++; if (WIZ.step === 3 && !WIZ.title)
      WIZ.title = uniq(Object.keys(WIZ.units)).map(function(u){ return textTitle(u); }).join('、') + ' 閱讀理解';
      render(); return; }
    if (act === 'wiz-back'){ collectWizard(); WIZ.step--; render(); return; }
    if (act === 'wiz-submit'){ submitWizard(); return; }

    /* 診斷 */
    if (act === 'kidmap-one' || act === 'kidmap-sel'){ tabKidmap.sel = id; go('#/assign/' + ROUTE.args[0] + '/kidmap'); render(); return; }
    if (act === 'item-strategy'){ openItemStrategy(id); return; }
    if (act === 'bridge'){ doBridge(id); return; }
    if (act === 'cr-sel'){ tabCR.sel = id; render(); return; }
    if (act === 'cr-scope'){ tabCR.scope = id; render(); return; }
    if (act === 'gen-rubric'){ runAI('rubric', function(f){ return aiRubric(getItem(id), true); }, true); return; }
    if (act === 'ai-class'){ runAI('ai-class', function(f){ return aiClassMisconception(diagnose(state, ROUTE.args[0]), f); }); return; }
    /* 路由守門是第一道，這裡是第二道。委派處理器不看 ROUTE，
       所以光把 synth 放進 TEACHER_ONLY 擋不住直接觸發的事件。
       學生端唯一的 AI 通道是 aalSay()，其餘一律只給教師。 */
    if (act === 'ai-note'){ if (!isTeacher()) return;
      runAI('ai-note', function(f){ return aiNoteFeedback(getNote(id), f); }); return; }
    if (act === 'ai-thread'){ if (!isTeacher()) return;
      runAI('ai-thread', function(f){ return aiThreadSynthesis(id, f); }); return; }
    if (act === 'ai-community'){ if (!isTeacher()) return;
      runAI('ai-community', function(f){ return aiCommunityReport(f); }); return; }
    if (act === 'items-from-view'){ if (!isTeacher()) return; showViewItems(id); return; }
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
    /* 選取模式綁在視圖上：KBSEL 存的是視圖 id，不是布林。 */
    if (act === 'toggle-sel'){ KBSEL = KBSEL ? null : id; if (!KBSEL) KBPICK = {}; render(); return; }
    if (act === 'make-rise'){
      /* 送出前用目前視圖的貼文過濾一次。躍升的結構是知識建構分析的核心，
         跨視圖的假 contains 會直接扭曲 SNA 與 KB 指數。 */
      const inView = {};
      notesOfView(id).forEach(function(n){ inView[n.id] = 1; });
      const picks = Object.keys(KBPICK).filter(function(nid){ return inView[nid]; });
      if (picks.length < 2){ toast('要先選兩則以上、而且都在同一個視圖裡的貼文。'); return; }
      openNoteEditor({viewId:id, kind:'rise', contains:picks,
        title:'【躍升】', segs:[{s:'s6', text:''}], x:900, y:520});
      return; }
    if (act === 'seg-add'){ collectEditor(); EDIT.segs.push({s:'s1', text:''});
      renderEditor({focus:'[data-act="seg-text"][data-i="' + (EDIT.segs.length - 1) + '"]'}); return; }
    if (act === 'seg-del'){ collectEditor(); const di = +t.dataset.i; EDIT.segs.splice(di, 1);
      renderEditor({focus:'[data-act="seg-text"][data-i="' + Math.max(0, di - 1) + '"]'}); return; }
    if (act === 'save-note'){ saveEditor(); return; }
    if (act === 'del-note'){ if (confirm('刪除這則貼文？延伸它的貼文會失去連結，這個動作無法復原。')){
      if (!deleteNote(id)){ toast('代為檢視時不能替學生刪貼文。'); return; }
      closeModal(); EDIT = null; replaceHash('#/kb'); toast('已刪除。'); } return; }
    if (act === 'add-ann'){ const ta = $('#annText');
      /* 空白時原本什麼都不做——沒有訊息、焦點也不回到輸入框，
         使用者只會覺得按鈕壞了。 */
      if (!ta || !ta.value.trim()){
        toast('先寫幾個字再送出。');
        if (ta) ta.focus();
        return;
      }
      const ok = addAnnotation(id, ta.value);
      render();
      toast(ok ? '已加上註記。' : '代為檢視時不能加註記。');
      return; }
    if (act === 'search-clear'){ KBSEARCH.q = ''; render(); return; }
    if (act === 'synth-sel'){ viewSynth.sel = id; render(); return; }

    /* 學生 */
    if (act === 'quiz-submit'){ submitQuiz(id); return; }
    if (act === 'pad-undo'){ if (PADS[id]){ PADS[id].strokes.pop(); redraw(id); } return; }
    if (act === 'pad-clear'){ if (PADS[id]){ PADS[id].strokes = []; redraw(id); } return; }
    /* 相似題只給教師備課用。它原本印在學生的診斷頁上、四個條件都給、
       不限次數、完全在 MAX_TURNS 之外——那會讓對照組拿到一顆無限次的 AI
       按鈕，變成第四種處理，RQ1 的組間比較失去基準。 */
    if (act === 'similar' || act === 'similar-again'){ if (!isTeacher()) return;
      showSimilar(id, act === 'similar-again'); return; }
    if (act === 'sim-pick'){
      if (!isTeacher()) return;
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
      /* 先把待處理的去抖／節流結清，再換題：否則最後一次點選與最後一段
         打字會被下一題的計時器取消，或被記到下一題的 iid 上。 */
      flushPendingPicks();
      const oldUnit = aalItem().unit;
      AAL.idx = act === 'aal-prev' ? Math.max(0, AAL.idx - 1)
                                   : Math.min(AAL.items.length - 1, AAL.idx + 1);
      aalSave();
      render();
      const nu = aalItem().unit;
      if (nu !== oldUnit){
        toast('第 ' + (AAL.idx + 1) + ' 題換了一篇文章：〈' + getText(nu).title + '〉，文章已經換過來了。');
        /* 換了文章，左欄要從頭開始——否則學生會在新文章的中段醒來 */
        const p = document.querySelector('.aal-text > .card-p');
        if (p) p.scrollTop = 0;
        const h = document.getElementById('passageTitle');
        if (h) h.focus();
      } else {
        /* 同一篇文章換題（T1 十題共用一篇，這是多數情況）：
           不移焦點的話報讀器什麼都不會唸，題幹、選項、已選答案靜默替換；
           窄版單欄的學生停在文章第 9 段，畫面看起來完全沒動，會以為按壞了
           而連按，一次跳過兩三題——那會在歷程序列裡憑空多出 idx 跳躍。 */
        const ans = document.getElementById('aalAnswer');
        if (ans){ ans.focus({preventScroll:true}); ans.scrollIntoView({block:'start'}); }
      }
      return; }

    /* 學生按了系統自己寫的「進度會保留」，就要真的把 AAL 收乾淨——
       否則 beforeunload 的守門條件（AAL 還活著）仍成立，他之後在任何一頁
       關分頁都會被警告「變更可能不會被儲存」，與那顆鈕的承諾直接打架。 */
    if (act === 'aal-leave'){
      flushPendingPicks();
      flushLogs();
      aalSave();
      AAL = null;
      go('#/student'); render();
      return; }

    if (act === 'skip-passage'){
      const el = document.getElementById('aalAnswer');
      if (el){ el.focus(); el.scrollIntoView({block:'start'}); }
      return; }
    if (act === 'back-to-passage'){
      const h = document.getElementById('passageTitle');
      if (h){ h.focus(); h.scrollIntoView({block:'start'}); }
      return; }
    if (act === 'back-to-nav'){
      const nv = document.getElementById('aalNav');
      if (nv){ nv.focus(); nv.scrollIntoView({block:'start'}); }
      return; }

    /* 教師／研究者的唯讀檢視：換題不寫任何日誌 */
    if (act === 'inspect-who-prev' || act === 'inspect-who-next'){ go('#/inspect/' + INSPECT.aid + '/' + id); return; }
    /* 與學生端的換題同一套行為：焦點落到作答卡、捲到它，
       否則教師端與學生端在同一個動作上分岔。 */
    if (act === 'inspect-prev' || act === 'inspect-next'){
      INSPECT.idx = act === 'inspect-prev'
        ? Math.max(0, INSPECT.idx - 1)
        : Math.min(INSPECT.items.length - 1, INSPECT.idx + 1);
      render();
      const ans = document.getElementById('aalAnswer');
      if (ans){ ans.focus({preventScroll:true}); ans.scrollIntoView({block:'start'}); }
      return; }
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
      /* 先更新頁碼再存草稿。原本 surveyDraftSave() 在 go() 之前跑，而
         SURVEY.page 要到 go 觸發 render → viewSurvey 才更新，於是草稿裡
         永遠是上一段——「換段但沒作答」之後回來就被退回前一段。
         先夾範圍也是必要的：越界值會被畫面夾回來，草稿卻已經存進去了。 */
      const secs = surveySections(SURVEY.phase, conditionOfStudent(currentUser().id));
      const p = Math.max(1, Math.min(secs.length, +t.dataset.v));
      SURVEY.page = p;
      surveyDraftSave();
      go('#/survey/' + SURVEY.phase + '/' + p);
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

    /* 示範模式下讓自己重走一次這節課。只清掉「我自己」這一份後測作答，
       全班的前測、Rasch 校準與其他人的資料都不動。 */
    if (act === 'redo-demo'){
      /* 代為檢視時絕對不能走這裡：它會刪掉那位學生的整份後測作答，
         而那是依變項本身。措辭與 aalSubmit 的守門對齊。 */
      if (isImpersonating()){ toast('代為檢視時不能替學生重做這節課。'); return; }
      const aid = t.dataset.id, me = currentUser();
      if (!confirm('這會清掉你自己在這份評量上的作答，重新走一次流程。班上其他人的資料不受影響。確定嗎？')) return;
      state.submissions = state.submissions.filter(function(s){ return !(s.aid === aid && s.sid === me.id); });
      state.responses   = state.responses.filter(function(r){ return !(r.aid === aid && r.sid === me.id); });
      state.dialog      = (state.dialog || []).filter(function(d){ return !(d.aid === aid && d.sid === me.id); });
      /* 「再走一次」原本只清這三樣，於是重來的其實只有一半：
         · state.logs 留著——標記、選項、打字的歷程事件全都還在，
           而標記現在是從日誌重建的（見 aalInit），孩子會看到上一次的
           畫線還亮著，卻找不到自己的作答
         · localStorage 的草稿留著——aalInit 會把他帶回離開的那一題，
           答案原封不動，而畫面說的是「重新走一次流程」 */
      state.logs = (state.logs || []).filter(function(e){ return !(e.aid === aid && e.sid === me.id); });
      /* 種出來的那一半也要一起拿掉。標記是從 allLogs() 重建的，
         而 allLogs() = DEMO_LOGS + state.logs——只清後者的話，
         孩子重新進來會看到上一次的畫線還亮著，卻一題答案都沒有。
         （DEMO_LOGS 在每次載入時重新種出來，所以這是本次工作階段內的清理；
           對「再走一次」這個示範用的按鈕來說足夠。） */
      if (typeof DEMO_LOGS !== 'undefined' && DEMO_LOGS.length)
        DEMO_LOGS = DEMO_LOGS.filter(function(e){ return !(e.aid === aid && e.sid === me.id); });
      aalDraftDrop(aid, me.id);
      AAL = null;
      save(); go('#/aal/' + aid); return;
    }

    /* 施測前的清場。
       原本刻意保留前測「與 Rasch 校準」，理由是教師端所有畫面都由它而來。
       但示範資料用的 sid 就是正式施測要用的那 96 個帳號——於是施測當天
       孩子的第一個畫面上，「閱讀理解 前測」寫著「已完成 · 選擇題答對 9」，
       點進去有星等、閱讀地圖與「可惜的題目」。那是一份他沒做過的測驗，
       也是介入前的一次績效回饋，直接壓在課前問卷的自我效能與焦慮上
       （而那兩個構念是 ANCOVA 的共變數）。
       教師端因此會暫時是空狀態——那是對的：真正的前測還沒跑，
       本來就不該有校準。寧可空著，也不要讓孩子看到別人的成績掛在自己名下。 */
    if (act === 'go-live'){
      if (!isResearcher()) return;
      if (!confirm('這會清空**前測與後測**的示範作答、示範問卷、歷程事件、作答草稿，以及知識建構空間裡所有示範的視圖與貼文，讓學生端回到「尚未作答」。\n\n教師端的 KIDMAP 與 Rasch 校準會一併變成空狀態，直到真正的前測跑完為止。\n\n這一步不可復原（要回到示範資料需按「重設」）。確定嗎？')) return;
      if (!confirm('再確認一次：清空之後，這台瀏覽器上的平台就是準備施測的狀態。')) return;
      state.demoSeed  = false;
      state.surveys   = (state.surveys || []).filter(function(s){ return !s.demo; });
      state.submissions = [];
      state.responses   = [];
      /* 白板也要清。不清的話，施測當天孩子一交卷就走進 21 則示範學童的
         貼文裡——那既是別人的內容，也會直接污染知識建構參與度這個依變項。 */
      state.views = [];
      state.notes = [];
      state.dialog = [];
      DEMO_LOGS = []; DEMO_DIALOG = [];
      /* DEMO_LOGS 是種出來的那一半，state.logs 是「真的有人在這台機器上操作」
         產生的那一半——備課、試玩、示範給同事看，全都寫在裡面。
         留著的話，施測當天的延宕序列分析與 ENA 會把那些事件一起算進去，
         而歷程序列本身就是依變項。
         兩份草稿也要清：不清的話，第一個坐下來的孩子按〈開始這節課〉
         會接到別人示範時留下的答案與問卷進度。 */
      state.logs = [];
      try {
        localStorage.removeItem('kairos-draft');
        localStorage.removeItem('kairos-survey-draft');
      } catch (e) {}
      AAL = null; SURVEY = null; QUIZ = null;
      save(); renderShell(); render();
      toast('已清空前後測示範作答、示範問卷、歷程事件與作答草稿，可以施測了。');
      return;
    }
  });

  /* change 事件 */
  document.addEventListener('change', function(e){
    const t = e.target.closest('[data-act]');
    if (e.target.id === 'who'){
      /* 用身分下拉離開代為檢視也要結束模式，否則 impersonate 旗標會留著，
         把整站對「已經回到自己身分」的老師鎖在唯讀狀態，而且沒有任何說明。 */
      /* 換身分等於離開作答頁，待處理的作答與打字要先結清 */
      /* 事件層也要守。renderShell() 已經在施測狀態把學生的身分下拉藏起來
         並改成單一選項，但那只是畫面——這裡是唯一真的會改寫 state.ui.role
         的地方，留一條沒守門的路徑等於前面的遮蔽只是裝飾。
         學生在施測狀態下不得換身分：換得掉就能變成別班的孩子（看到別的
         條件的 AI 夥伴，受試者間設計失效）、變成同班同學（讀改別人的作答）、
         或變成研究者。 */
      if (state.demoSeed === false && !isTeacher()){
        renderShell();
        toast('施測期間不能切換身分。');
        return; }
      if (AAL){ try { flushPendingPicks(); flushLogs(); } catch (e2) {} }
      state.ui.impersonate = null;
      state.ui.role = e.target.value; save(); renderShell();
      go(isTeacher() ? '#/teacher' : '#/student'); render(); return; }
    if (!t) return;
    const act = t.dataset.act;
    /* 班級下拉。原本這一段寫在 if (!t) return 之後才判 e.target.id，而 #classSel
       身上沒有 data-act，t 必為 null——這個控制項從開站起就沒有作用過，
       教師端所有「本班」永遠是 c-1。改走 data-act 就不會再犯。 */
    if (act === 'class-sel'){ state.ui.classId = t.value; save(); render(); return; }
    if (act === 'wiz-item'){ const id = t.dataset.id;
      if (WIZ.items[id]) delete WIZ.items[id]; else WIZ.items[id] = 1; render(); return; }
    if (act === 'seg-sc'){ collectEditor(); EDIT.segs[+t.dataset.i].s = t.value;
      renderEditor({focus:'[data-act="seg-sc"][data-i="' + t.dataset.i + '"]'}); return; }
    /* 量尺現在是原生 radio，走 change 而不是 click——方向鍵移動也會觸發。
       只更新這一列與抬頭的計數，不重繪整段。 */
    if (act === 'sv-pick'){
      SURVEY.resp[t.dataset.k] = +t.dataset.v;
      const scale = t.closest('.scale');
      if (scale) Array.prototype.forEach.call(scale.querySelectorAll('.lk'), function(lb){
        const input = lb.querySelector('input');
        lb.classList.toggle('on', !!(input && input.checked));
      });
      /* 標紅要跟著答案一起解除，aria-invalid 也一樣。原本只拿掉 class：
         螢幕報讀軟體會一路把這一列念成「無效」，孩子明明已經填好了。 */
      const row = t.closest('.likert');
      if (row){ row.classList.remove('missing'); row.removeAttribute('aria-invalid'); }
      /* 頁首那句「這一段還有 N 題沒有選」插進去之後就不再更新，
         數字凍在最初那一次。孩子全部補完，它還在說有 3 題沒選——
         重算剩幾題，歸零就撤掉。 */
      const svAlert = document.getElementById('svMissAlert');
      if (svAlert){
        const left = document.querySelectorAll('#view .likert.missing').length;
        if (left) svAlert.textContent = '這一段還有 ' + left + ' 題沒有選。';
        else svAlert.remove();
      }
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
    if (act === 'set-kur'){
      const v = parseFloat(t.value);
      state.settings.keyUnlockRatio = isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.5;
      save(); render(); return; }
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
      /* 靜默夾值是最糟的組合：老師習慣百分制打 85，系統存成 6、
         畫面仍顯示 85、還說「已儲存分數」——三個訊號互相矛盾，
         而唯一正確的那個是他看不到的。夾了就要說，並把欄位改成實際存的值。 */
      if (r){
        const raw = t.value === '' ? null : +t.value;
        const v = raw === null ? null : Math.max(0, Math.min(6, raw));
        r.score = v;
        t.value = (v === null ? '' : v);
        save();
        toast(raw !== null && raw !== v ? '這一題滿分 6 分，已存成 ' + v + '。' : '已儲存分數。');
      }
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
      /* 非選題有字就不算空白（見 missIdx），把「還沒寫完」解除。
         只解除、不重新加：這個標記的意思是「你剛剛被退回這一題」，
         不是即時驗證。全選重打的中途會有一瞬間是空的，
         那時候閃一下紅框只會嚇到人。 */
      if (t.value.trim()) aalClearMissing();
      /* 4 秒節流。被節流掉的那一段字要記在 _pendingW，換題或交卷時由
         flushTypeTelemetry() 補寫，否則每一題的最後一段打字都會漏。 */
      if (!aalTypeTelemetry._last || Date.now() - aalTypeTelemetry._last > 4000){
        aalTypeTelemetry._last = Date.now();
        aalTypeTelemetry._pendingW = null;
        aalLog('TYPE', 'W', {len:t.value.length}, it);
        aalSave();
      } else {
        aalTypeTelemetry._pendingW = {it:it, len:t.value.length, at:Date.now()};
        scheduleDraftSave();
      }
      return; }
    if (act === 'aal-note'){
      const it = aalItem();
      AAL.notes[it.id] = t.value;
      /* 打字期間不再寫 code:'N' 的行為事件（見 flushTypeTelemetry 的說明）：
         那會讓對照組的分析單位密度比三個 AI 組高一到兩個數量級。
         筆記在離開這一題或交卷時整筆寫一次。這裡只負責存草稿。 */
      scheduleDraftSave();
      /* 對照組的「已寫 N 字」照 turnLeft 的做法就地更新——
         每打一個字重繪整個面板，會讓對照組的互動延遲曲線與三個 AI 組不同。 */
      const nc = document.getElementById('noteCount');
      if (nc) nc.textContent = t.value.length;
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
  /* 門檻由 900 提到 1100。作答頁的兩欄現在各有下限（文章 24rem、對話 16.5rem，
     相加 40.5rem＝810px，再加側欄、內距與間隔）——1024px 的平板橫放
     若還走雙欄，兩個下限相加會超過可用寬度而讓 grid 溢出。
     教室用的正是 1024px 橫放，所以它必須落在單欄側。 */
  document.documentElement.toggleAttribute('data-narrow', (window.innerWidth / fs) < 1100);
}

/* 兩個變數，不能共用一個：
   --topbar-h  ＝ 只有頂列的高度。代為檢視的橫幅貼在它下面。
   --sticky-top ＝ 頂列 + 橫幅。側欄與作答頁的文章欄貼在這條線下面。
   共用一個的話，橫幅會把自己也往下推，跟側欄疊在同一位置。 */
function syncTopbarHeight(){
  const t = document.querySelector('.topbar');
  if (!t) return;
  const th = Math.round(t.getBoundingClientRect().height);
  const bar = document.getElementById('impBar');
  const bh = bar ? Math.round(bar.getBoundingClientRect().height) : 0;
  const rs = document.documentElement.style;
  if (th > 0) rs.setProperty('--topbar-h', th + 'px');
  rs.setProperty('--sticky-top', (th + bh) + 'px');
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
  modal('<div class="modal-h"><h3>' + itemLabel(INSPECT && INSPECT.aid ? INSPECT.aid : 'a-post', it.id) + ' · 教學策略</h3>' +
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
    }).join('') +
      /* 這些題目取自現有題庫，可能與正在施測的題本重疊——不標明的話，
         老師會以為它們是全新的題目而拿去補考。「建立派題」在 RESEARCHER_ONLY，
         教師點不進去，所以也不能叫他自己去派。 */
      '<p class="muted small">以下題目取自現有題庫，<strong>可能與本次施測的題本重疊</strong>，' +
      '請勿直接發給正在受試的班級。要另外派題，請研究者從「建立派題」派出。' +
      '引擎：' + esc(engineLabel()) + '</p>';
  } catch (e) {
    box.className = 'ai-out';
    box.innerHTML = '<p><strong>命題失敗</strong></p><p>' + esc(e.message) + '</p>';
  }
}

/* --- 交卷 --- */
function submitQuiz(aid){
  if (isImpersonating()){ toast('代為檢視時不能替學生交卷。'); return; }
  const a = getAssignment(aid), me = currentUser();
  const items = a.itemIds.map(getItem).filter(Boolean);
  const mcs = items.filter(function(i){ return i.type === 'mc'; });
  const missing = mcs.filter(function(i){ return QUIZ.answers[i.id] === undefined; });
  /* 同 aalSubmit：不可逆那句要放在前面，而且要列出題號。
     原本這一支更短——「還有 N 題沒作答，確定要交卷嗎？」，連是哪幾題都沒說，
     孩子按取消之後畫面留在原地，只能自己一題一題找。 */
  if (missing.length){
    const nos = missing.map(function(i){ return itemLabel(aid, i.id); }).join('、');
    if (!confirm('交出去之後就不能再修改。\n\n還有 ' + missing.length + ' 題沒作答：' +
                 nos + '。\n\n按「確定」直接交卷，按「取消」回去把它寫完。')) return;
  } else if (!confirm('交出去之後就不能再修改。\n\n要交卷了嗎？')) return;
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
        /* 同 aalSubmit：缺答寫 null，不要寫 false */
        correct: c === undefined ? null : (c === it.answer)});
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
  /* 預設對齊登入教師實際帶的班，不要靜默停在 c-1。 */
  if (!state.ui.classId){
    const mine = state.classes.find(function(c){ return c.teacherId === state.ui.role; });
    state.ui.classId = mine ? mine.id : 'c-1';
  }
  state.logs = state.logs || [];
  state.dialog = state.dialog || [];
  applyItemProcesses();                 // 掛上逐題的官方歷程標定
  /* demoSeed 為 false 表示已經清空、準備施測：不可以再補示範問卷回來，
     否則真的孩子進問卷會看到別人的模擬答案，按送出就變成他自己的作答。 */
  if (state.demoSeed !== false && (!state.surveys || !state.surveys.length))
    state.surveys = buildDemoSurveys();
  /* 完全同一個理由，而這一行原本沒有守門：施測狀態下不可以把示範歷程事件
     種回來。〈準備施測〉清掉的 DEMO_LOGS，下一次載入就被這一行補回
     26306 筆（96 位模擬學生），而 allLogs() = DEMO_LOGS + state.logs
     是延宕序列分析、ENA、情感軌跡、停留時間與教師端「他標記了 N 句」
     的共同來源——真孩子的歷程資料裡會混進 96 個不存在的人。
     標記更直接：aalInit 從 allLogs() 重建畫線，孩子一進作答頁
     就會看到別人標好的句子。 */
  if (state.demoSeed !== false) buildDemoLogs();   // 示範日誌由種子重算，不占 localStorage
  else { DEMO_LOGS = []; DEMO_DIALOG = []; }
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
