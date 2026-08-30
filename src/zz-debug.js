/* 只用於除錯建置（dist/debug.html），不會進入正式版 */
(function(){
  var panel = document.createElement('div');
  panel.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:99999;background:#0b0f14;color:#7CFF9B;' +
    'font:12px/1.5 monospace;padding:10px;max-height:70vh;overflow:auto;width:460px;border:1px solid #2a3a2a';
  document.body.appendChild(panel);
  function log(s){ var d = document.createElement('div'); d.textContent = s; panel.appendChild(d); panel.scrollTop = 1e9; }
  function V(h){ document.getElementById('view').innerHTML = h; }

  var stages = [
    ['diagnose a-pre', function(){ window._pre = diagnose(state, 'a-pre'); log('   n=' + window._pre.done.length + ' ready=' + window._pre.ready); }],
    ['diagnose a-post', function(){ window._post = diagnose(state, 'a-post'); }],
    ['viewAssign whole', function(){ V(viewAssign('a-pre')); }],
    ['tabKidmap', function(){ V(viewAssign("a-pre","kidmap")); }],
    ['tabItems', function(){ V(viewAssign("a-pre","items")); }],
    ['tabBridge', function(){ V(viewAssign("a-pre","bridge")); }],
    ['tabCR', function(){ V(viewAssign("a-pre","cr")); }],
    ['tabAI', function(){ V(viewAssign("a-pre","ai")); }],
    ['viewTeacher', function(){ V(viewTeacher()); }],
    ['viewCreate', function(){ WIZ = null; V(viewCreate()); }],
    ['viewKBList', function(){ V(viewKBList()); }],
    ['viewKBCanvas v-1', function(){ V(viewKBCanvas('v-1')); }],
    ['viewNote n-5', function(){ V(viewNote('n-5')); }],
    ['viewSynth v-1', function(){ V(viewSynth('v-1')); }],
    ['discourseStats', function(){ window._ds = discourseStats(); }],
    ['dualTrack', function(){ window._dt = dualTrack(); }],
    ['dashDual', function(){ DTAB='dual'; V(viewDash()); }],
    ['dashStudents', function(){ DTAB='students'; V(viewDash()); }],
    ['dashSNA', function(){ DTAB='sna'; V(viewDash()); }],
    ['dashDiscourse', function(){ DTAB='discourse'; V(viewDash()); }],
    ['dashReport', function(){ DTAB='report'; V(viewDash()); }],
    ['viewBank', function(){ V(viewBank()); }],
    ['viewSettings', function(){ V(viewSettings()); }],
    ['viewAbout', function(){ V(viewAbout()); }],

    /* --- 評量即學習 --- */
    ['applyItemProcesses', function(){ applyItemProcesses();
      log('   R01=' + getItem('R01').process + ' C01=' + getItem('C01').process); }],
    ['buildDemoLogs', function(){ buildDemoLogs(); log('   logs=' + DEMO_LOGS.length + ' dialog=' + DEMO_DIALOG.length); }],
    ['buildDemoSurveys', function(){ log('   surveys=' + state.surveys.length); }],
    ['agentTurn x3', function(){
      ['tutor','tutee','peer'].forEach(function(c){
        var a = agentTurn(c, getItem('R13'), 2);
        log('   ' + c + '｜' + a.text.slice(0, 34) + '…  qfn=' + a.qfn + ' sub=' + a.sub);
      }); }],
    ['leakGuard', function(){
      var g = leakGuard('答案是 B，就在第 3 段第 1 句，你答對了', getItem('R01'));
      log('   blocked=' + g.blocked + ' hits=' + g.hits.join(',')); }],
    ['composePrompt', function(){ window._cp = composePrompt('tutee', 'II', 'F3'); log('   len=' + window._cp.length); }],
    ['relativeProcessCode', function(){
      log('   ' + relativeProcessCode('這個詞在哪一段', getItem('C01')) + ' / ' +
          relativeProcessCode('我覺得作者想告訴我們的是另一件事，而且他沒說清楚', getItem('R01'))); }],
    ['lsa (all)', function(){ window._l = lsa(); log('   N=' + window._l.N + ' sig=' + window._l.sig.length); }],
    ['lsa (per cond)', function(){ CONDITIONS.forEach(function(c){
      var r = lsa({cond:c.id}); log('   ' + c.id + ' N=' + r.N + ' sig=' + r.sig.length); }); }],
    ['enaAccumulate', function(){ window._acc = enaAccumulate(4);
      log('   units=' + window._acc.units.length + ' lines=' + window._acc.lines); }],
    ['enaProject', function(){ window._pr = enaProject(window._acc);
      log('   var1=' + (window._pr ? window._pr.var1.toFixed(3) : 'null') +
          ' var2=' + (window._pr ? window._pr.var2.toFixed(3) : 'null')); }],
    ['enaMeanNetworks', function(){ window._nets = enaMeanNetworks(window._acc); }],
    ['sentimentTrajectory', function(){ var t = sentimentTrajectory();
      log('   ' + CONDITIONS.map(function(c){ return c.id + '=' + (t[c.id].mean == null ? '—' : t[c.id].mean.toFixed(2)); }).join(' ')); }],
    ['analysisDataset', function(){ window._rows = analysisDataset(); log('   rows=' + window._rows.length); }],
    ['ancova theta_post', function(){
      var o = outcomeList()[0];
      var r = ancova(window._rows, o.get, o.cov);
      log(r ? '   F(' + r.df1 + ',' + r.df2 + ')=' + r.F.toFixed(2) + ' p=' + fmtP(r.p) + ' eta2=' + r.eta.toFixed(3)
            : '   null'); }],
    ['ancova all outcomes', function(){
      var n = 0; outcomeList().forEach(function(o){ if (ancova(window._rows, o.get, o.cov)) n++; });
      log('   ok=' + n + '/' + outcomeList().length); }],
    ['mediation tutee', function(){
      var meds = ['mot_in','eff','cl_ge','eng_c','anx'].map(function(id){
        var c = constructById(id); return {name:c.name, get:function(r){ return r.post[id]; }}; });
      var o = outcomeList()[0];
      var m = mediation(window._rows, 'tutee', o.get, meds, o.cov, 300);
      log(m ? '   n=' + m.n + ' total_ind=' + m.total.ind.toFixed(3) +
              ' [' + m.total.lo.toFixed(3) + ',' + m.total.hi.toFixed(3) + ']' : '   null'); }],
    ['rDesign', function(){ RTAB='design'; V(viewResearch()); }],
    ['rAssign', function(){ RTAB='assign'; V(viewResearch()); }],
    ['rLSA', function(){ RTAB='lsa'; V(viewResearch()); }],
    ['rENA', function(){ RTAB='ena'; V(viewResearch()); }],
    ['rSent', function(){ RTAB='sent'; V(viewResearch()); }],
    ['rStats', function(){ RTAB='stats'; V(viewResearch()); }],
    ['rExport', function(){ RTAB='export'; V(viewResearch()); RTAB='design'; }],

    /* --- 學生端 --- */
    ['switch to student (tutor)', function(){ state.ui.role = 'u-s3'; renderShell();
      log('   cond=' + conditionOfStudent('u-s3')); }],
    ['viewStudent', function(){ V(viewStudent()); }],
    ['viewSurvey pre', function(){ SURVEY = null; V(viewSurvey('pre')); }],
    ['viewSurvey post', function(){ SURVEY = null; V(viewSurvey('post')); }],
    ['viewAaL (unsubmitted)', function(){
      state.submissions = state.submissions.filter(function(s){ return !(s.aid === 'a-post' && s.sid === 'u-s3'); });
      AAL = null; V(viewAaL('a-post')); log('   items=' + AAL.items.length + ' cond=' + AAL.cond); }],
    ['aal interactions', function(){
      aalMark(0); aalPick(1);
      var it = aalItem();
      /* AAL.turns 已移除：對話唯一的帳本是 state.dialog */
      state.dialog = state.dialog || [];
      state.dialog.push({t:Date.now(), sid:AAL.me, cond:AAL.cond, aid:AAL.aid, iid:it.id,
        turn:1, speaker:'student', text:'我覺得作者想告訴我們的是另一件事', rel:'ABOVE'});
      var a = agentTurn(AAL.cond, it, 0);
      state.dialog.push({t:Date.now() + 1, sid:AAL.me, cond:AAL.cond, aid:AAL.aid, iid:it.id,
        turn:1, speaker:'agent', text:a.text});
      V(viewAaL('a-post'));
      log('   turns=' + aalStudentTurns(it.id) + ' logs=' + state.logs.length); }],
    ['viewAaL control cond', function(){
      state.ui.role = 'u-s75'; renderShell();
      state.submissions = state.submissions.filter(function(s){ return !(s.aid === 'a-post' && s.sid === 'u-s75'); });
      AAL = null; V(viewAaL('a-post')); log('   cond=' + AAL.cond); }],
    ['viewResult a-pre', function(){ V(viewResult('a-pre')); }],
    ['viewMyGrowth', function(){ V(viewMyGrowth()); }],

    /* --- 匯出 --- */
    ['toSDIS', function(){ log('   bytes=' + toSDIS().length); }],
    ['toENACsv', function(){ log('   bytes=' + toENACsv().length); }],
    ['toTelemetryCsv', function(){ log('   bytes=' + toTelemetryCsv().length); }],
    ['toSurveyCsv', function(){ log('   bytes=' + toSurveyCsv().length); }],
    ['responseCSV', function(){ log('   bytes=' + responseCSV().length); }],
    ['researchBundle', function(){ log('   bytes=' + JSON.stringify(researchBundle()).length); }],
    ['viewInspect (tutor)', function(){ INSPECT = null; V(viewInspect('a-post', 'u-s3')); }],
    ['viewInspect (control)', function(){ INSPECT = null; V(viewInspect('a-post', 'u-s75')); }],
    ['tabReplay', function(){ V(viewAssign("a-post","replay")); }],
    ['kb gate (未交卷學生)', function(){
      state.ui.role = 'u-s3'; renderShell();
      state.submissions = state.submissions.filter(function(s){ return s.sid !== 'u-s3'; });
      log('   locked=' + kbLocked(currentUser()) + ' pending=' + pendingAssignments('u-s3').length);
      V(viewKBList()); }],
    ['back to teacher', function(){ state.ui.role = 'u-t1'; renderShell(); }],
    ['rail: 研究者', function(){ state.ui.role = 'u-admin'; renderShell();
      log('   連結數=' + document.querySelectorAll('#rail a').length); }],
    ['rail: 教師', function(){ state.ui.role = 'u-t1'; renderShell();
      log('   連結數=' + document.querySelectorAll('#rail a').length +
          '　' + Array.prototype.map.call(document.querySelectorAll('#rail a'), function(a){ return a.textContent; }).join('｜')); }]
  ];

  var i = 0;
  function step(){
    if (i >= stages.length){ log('=== ALL STAGES DONE ==='); return; }
    var s = stages[i++];
    log('▶ ' + s[0]);
    var t0 = performance.now();
    try { s[1](); log('   ok ' + (performance.now() - t0).toFixed(0) + 'ms'); }
    catch (e){ log('   ERROR: ' + (e && e.message) + ' | ' + String(e && e.stack).split('\n').slice(0, 3).join(' << ')); }
    setTimeout(step, 20);
  }
  /* 這一輪整趟要跑三分鐘以上（toENACsv 一支就吐 3.6MB），而它一路上會改
     state.ui.role、直接把 HTML 灌進 #view、換掉 DTAB／RTAB。原本一載入就
     自動開跑，於是任何在同一頁做的驗證都在跟它搶同一份 state 與同一塊 DOM：
     實測「學生看到系統設定」「身分自己跳成 u-s75」「#aalSay 憑空消失」
     三個假故障都是它造成的，而每一個都要花時間才排除得掉——
     驗證工具自己製造假陽性，比沒有工具更糟。
     改成明講才跑：網址加 ?smoke，或在 console 打 runSmoke()。 */
  window.runSmoke = function(){ i = 0; setTimeout(step, 0); };
  if (/[?&]smoke(\b|=)/.test(location.search)) setTimeout(step, 500);
  else log('自動巡檢未啟動（網址加 ?smoke 或執行 runSmoke()）');
})();

/* ==========================================================================
   四條件文案 diff
   第 1 輪把作答頁右欄的高度量到 2px 以內，卻讓「這個網站是什麼」用 tutor 的
   台詞對四個條件說話、問卷副標依條件位移——因為只驗了幾何，沒驗文字。
   這一支把每一個學生看得到的畫面在四個條件下各渲染一次然後比對：
   卡片數要完全相同、字數落差 ≤10%、高度落差 ≤4px，並掃一遍禁字。
   每一輪收斂前必跑。console 一行：diffConditionCopy()
   ========================================================================== */
window.diffConditionCopy = function(){
  const CONDS = ['tutor', 'tutee', 'peer', 'control'];
  /* 對照組整節課不會遇到夥伴，畫面上不該出現這些字；
     三個 AI 組不該看到別的條件的夥伴名字（那會提前給角色提示，
     而課後的操弄檢核問的正是「剛剛陪我讀的那位夥伴比較像…」）。 */
  const BAN = {control: ['夥伴', '次話', '跟它說', '對話']};
  CONDS.forEach(function(c){
    if (c === 'control') return;
    BAN[c] = CONDS.filter(function(x){ return x !== c && x !== 'control'; })
                  .map(function(x){ return condition(x).name; });
  });

  /* 磁碟快照。這兩支測試會切身分並在過程中觸發 save()——
     跑完之後記憶體還原了、localStorage 卻停在最後一位受測學生身上。
     研究者只要在下一次 save() 之前重整，就靜默變成別人登入。
     施測當天跑它會污染真實受試者的資料。 */
  const SNAP = (function(){ try { return localStorage.getItem(STORE_KEY); } catch (e){ return null; } })();
  const DRAFT0 = (function(){ try { return localStorage.getItem('kairos-draft'); } catch (e){ return null; } })();
  const realRole = state.ui.role, realImp = state.ui.impersonate, realHash = location.hash;
  state.ui.impersonate = null;

  function pick(cond){
    const k = state.classes.find(function(x){ return x.condition === cond; });
    return k ? k.studentIds[0] : null;
  }
  /* 作答頁必須讓四個條件停在同一題。AAL 會從 localStorage 的草稿還原 idx，
     所以只要有人（真的學生，或先前跑過的另一支測試）在某一題離開，
     那個條件就從第 15 題開始、別的條件從第 1 題開始——
     卡片數一樣、字數差 1.6%，但高度差 48px，看起來像版面不對等。
     實際踩過一次：非選題那一題留下的草稿讓 tutor 停在 C01，
     四列全部報紅，而版面根本沒問題。
     快照與還原（DRAFT0）只保證「跑完不留痕跡」，不保證「跑之前是乾淨的」。 */
  function clearDraftFor(sid){
    try {
      const all = JSON.parse(localStorage.getItem('kairos-draft') || '{}');
      Object.keys(all).forEach(function(k){ if (k.indexOf('|' + sid) >= 0) delete all[k]; });
      localStorage.setItem('kairos-draft', JSON.stringify(all));
    } catch (e){}
  }
  function shot(sid, hash){
    state.ui.role = sid; renderShell();
    if (String(hash).indexOf('#/aal/') === 0){
      clearDraftFor(sid);
      if (typeof AAL !== 'undefined') AAL = null;
      if (typeof clearPads === 'function') clearPads();
    }
    location.hash = hash; render();
    /* 草稿是在 aalInit 時讀的，清掉之後要讓它重新開一次才會落在第 1 題 */
    /* 四個條件要停在同一題，而且標記要一樣。
       被標起來的句子帶 3px 下框線，會改變整篇文章的排版高度；
       而四位取樣學生的示範標記各不相同（筆數與位置都不同）。
       窗口窄的時候文章欄不再有 max-height，這個差異就進到總高度裡，
       實測 125～175% 下四條件差 14～16px－－而那是個別差異，
       不是條件差異。這一支要驗的是後者，所以把標記歸零再量。 */
    if (typeof AAL !== 'undefined' && AAL){
      let need = false;
      if (AAL.idx){ AAL.idx = 0; need = true; }
      if (AAL.marks && Object.keys(AAL.marks).length){ AAL.marks = {}; need = true; }
      if (need) render();
    }
    const v = document.getElementById('view');
    return {cards: v.querySelectorAll('.card').length,
            chars: v.innerText.replace(/\s/g, '').length,
            h: Math.round(v.offsetHeight),
            text: v.innerText};
  }

  /* 問卷段數依條件而異（對照組少一段操弄檢核），所以逐段比對會對不齊。
     改成比對「最後一段」與「第一段」，那是條件位移最容易露出來的兩處。 */
  const SCREENS = [
    ['我的作業',   '#/student'],
    ['這個網站是什麼', '#/about'],
    ['作答頁',     '#/aal/a-post'],
    ['問卷第 1 段', '#/survey/post/1'],
    ['問卷最後一段', null]      // 逐條件算
  ];

  const rows = [];
  const bans = [];

  /* 前置條件要對稱：作答頁需要「還沒交卷」，問卷需要「已經交卷」
     （surveyGate 會擋）。原本只對作答頁做，於是別的代理人按過
     〈再走一次（示範）〉之後，問卷那兩列就出現 0/3/3/3 的假紅字。 */
  function withSubmission(sid, want, fn){
    const had = submitted('a-post', sid);
    let removed = null;
    if (had && !want){
      removed = state.submissions.filter(function(s){ return s.aid === 'a-post' && s.sid === sid; });
      state.submissions = state.submissions.filter(function(s){ return !(s.aid === 'a-post' && s.sid === sid); });
    } else if (!had && want){
      state.submissions.push({aid:'a-post', sid:sid, at:Date.now(), _diffTmp:true});
    }
    try { return fn(); }
    finally {
      if (removed) state.submissions = state.submissions.concat(removed);
      if (!had && want) state.submissions = state.submissions.filter(function(s){ return !s._diffTmp; });
    }
  }

  if (!document.documentElement.clientWidth){
    console.warn('[KAIROS] clientWidth 為 0——這個視窗量不出版面，先把瀏覽器窗格拉開再跑。');
    return {rows:[], bans:[], pass:false, aborted:'clientWidth=0'};
  }

  /* 掃字級。四條件版面對等原本只在 100% 量過，而 125% 與 175% 是真的失敗——
     測試不掃參數空間，等於沒有測。 */
  const SCALES = [1, 1.25, 1.5, 1.75];
  const realFs = ((state.settings && state.settings.a11y) || {}).fontScale || 1;

  SCALES.forEach(function(fs){
    state.settings.a11y = Object.assign({}, state.settings.a11y, {fontScale: fs});
    if (typeof applyA11y === 'function') applyA11y();
    SCREENS.forEach(function(sc){
      const per = {};
      CONDS.forEach(function(cond){
        const sid = pick(cond); if (!sid) return;
        let hash = sc[1];
        if (!hash){
          const secs = surveySections('post', cond);
          hash = '#/survey/post/' + secs.length;
        }
        const wantSubmitted = hash.indexOf('#/aal/') !== 0;
        per[cond] = withSubmission(sid, wantSubmitted, function(){ return shot(sid, hash); });
        (BAN[cond] || []).forEach(function(w){
          if (per[cond].text.indexOf(w) >= 0) bans.push(sc[0] + ' / ' + cond + '：「' + w + '」');
        });
      });
      const vals = CONDS.map(function(c){ return per[c]; }).filter(Boolean);
      if (!vals.length) return;
      const cards = vals.map(function(x){ return x.cards; });
      const chars = vals.map(function(x){ return x.chars; });
      const hs    = vals.map(function(x){ return x.h; });
      const cardsSame = Math.max.apply(null, cards) === Math.min.apply(null, cards);
      const charPct = +(((Math.max.apply(null, chars) - Math.min.apply(null, chars)) /
                         Math.max(1, Math.min.apply(null, chars))) * 100).toFixed(1);
      const hSpread = Math.max.apply(null, hs) - Math.min.apply(null, hs);
      rows.push({字級: Math.round(fs * 100) + '%', 畫面: sc[0],
                 卡片數: cards.join('/'), 卡片數相同: cardsSame,
                 字數落差: charPct + '%', 字數過關: charPct <= 10,
                 高度落差: hSpread + 'px', 高度過關: hSpread <= 4});
    });
  });

  state.settings.a11y = Object.assign({}, state.settings.a11y, {fontScale: realFs});
  if (typeof applyA11y === 'function') applyA11y();

  state.ui.role = realRole; state.ui.impersonate = realImp; renderShell();
  /* 磁碟也要還原，而且要在記憶體還原之後 */
  try {
    if (SNAP != null) localStorage.setItem(STORE_KEY, SNAP);
    if (DRAFT0 != null) localStorage.setItem('kairos-draft', DRAFT0);
    else localStorage.removeItem('kairos-draft');
  } catch (e){}
  location.hash = realHash || '#/teacher'; render();

  const fails = rows.filter(function(r){ return !r.卡片數相同 || !r.字數過關 || !r.高度過關; });
  if (console.table) console.table(rows);
  console.log(bans.length ? '禁字命中 ' + bans.length + ' 筆：\n  ' + bans.join('\n  ') : '禁字檢查：0 筆命中');
  console.log(fails.length ? '不對等 ' + fails.length + ' 個畫面' : '四條件文案對等：全數通過');
  return {rows: rows, bans: bans, pass: fails.length === 0 && bans.length === 0};
};

/* ==========================================================================
   學生端不變量。第 1–3 輪反覆出現同一種形狀的缺陷：修了專家點名的那一處、
   沒掃同型位置——AI 通道修了 similar 漏了 ai-note／ai-thread；術語修了
   顯示端漏了產生端；θ 修了 #/result 漏了 #/mygrowth。
   這支測試把那四種形狀變成斷言，不再靠人工掃描。
   console 一行：assertStudentInvariants()
   ========================================================================== */
window.assertStudentInvariants = function(){
  /* 學生畫面上永遠不該出現的字。「反例」不在裡面——它出現在
     EPI_LABEL 與名詞說明裡是正確的研究語彙。
     「正解」也不在裡面：兩份都交完之後，個人診斷本來就該打開答案，
     那是刻意的設計。它另外用 keyLocked 的情境單獨斷言（見下面）。 */
  const BAD_TEXT = /θ|logit|Rasch|KIDMAP|迷思|象限|第\s*\d\s*級|平方根/;
  /* 學生永遠不該按得到的 AI 通道與教師工具 */
  const BAD_SEL = ['[data-act^="ai-"]', '[data-act="similar"]', '[data-act="similar-again"]',
                   '[data-act="gen-rubric"]', '[data-act="item-strategy"]',
                   '[data-act="items-from-view"]', '[data-act="new-view"]',
                   'a[href^="#/synth/"]', 'a[href^="#/assign/"]', 'a[href^="#/dash"]'];

  /* 磁碟快照。這兩支測試會切身分並在過程中觸發 save()——
     跑完之後記憶體還原了、localStorage 卻停在最後一位受測學生身上。
     研究者只要在下一次 save() 之前重整，就靜默變成別人登入。
     施測當天跑它會污染真實受試者的資料。 */
  const SNAP = (function(){ try { return localStorage.getItem(STORE_KEY); } catch (e){ return null; } })();
  const DRAFT0 = (function(){ try { return localStorage.getItem('kairos-draft'); } catch (e){ return null; } })();
  const realRole = state.ui.role, realImp = state.ui.impersonate, realHash = location.hash;
  state.ui.impersonate = null;
  const fails = [];

  state.classes.forEach(function(k){
    const sid = k.studentIds[0];
    state.ui.role = sid; renderShell();
    const routes = ['#/student', '#/about', '#/mygrowth', '#/survey/pre', '#/survey/post',
                    '#/kb', '#/result/a-pre', '#/result/a-post'];
    viewsForViewer().forEach(function(v){ routes.push('#/kb/' + v.id); });
    notesForViewer().slice(0, 5).forEach(function(n){ routes.push('#/note/' + n.id); });
    /* 直接打網址也要試——列表過濾擋不住手動輸入 */
    routes.push('#/synth/' + (state.views[0] || {}).id, '#/assign/a-post/overview', '#/dash', '#/inspect/a-post/' + sid);

    routes.forEach(function(h){
      if (!h || h.indexOf('undefined') >= 0) return;
      try {
        location.hash = h; render();
        const stage = document.getElementById('view');
        const txt = stage.innerText || '';
        const m = txt.match(BAD_TEXT);
        if (m) fails.push(k.condition + ' ' + h + ' → 出現「' + m[0] + '」');
        BAD_SEL.forEach(function(s){
          const n = stage.querySelectorAll(s).length;
          if (n) fails.push(k.condition + ' ' + h + ' → ' + n + ' 個 ' + s);
        });
      } catch (e){ fails.push(k.condition + ' ' + h + ' → ' + e.message); }
    });
  });

  /* 答案卡的門檻：後測還沒交的時候，兩份診斷都不可以出現正解。
     這是 B1-02／B1-04 的核心，用一次可還原的模擬來驗。 */
  (function(){
    const sid = state.classes[0].studentIds[0];
    const keep = state.submissions.filter(function(s){ return s.aid === 'a-post' && s.sid === sid; });
    state.submissions = state.submissions.filter(function(s){ return !(s.aid === 'a-post' && s.sid === sid); });
    state.ui.role = sid; renderShell();
    ['#/result/a-pre', '#/result/a-post'].forEach(function(h){
      try {
        location.hash = h; render();
        const t = document.getElementById('view').innerText || '';
        if (t.indexOf('正解') >= 0) fails.push('後測未交時 ' + h + ' 仍印出「正解」');
        if (document.querySelectorAll('#view .opt.right').length) fails.push('後測未交時 ' + h + ' 仍標出正確選項');
      } catch (e){ fails.push(h + ' → ' + e.message); }
    });
    state.submissions = state.submissions.concat(keep);
  })();

  state.ui.role = realRole; state.ui.impersonate = realImp; renderShell();
  /* 磁碟也要還原，而且要在記憶體還原之後 */
  try {
    if (SNAP != null) localStorage.setItem(STORE_KEY, SNAP);
    if (DRAFT0 != null) localStorage.setItem('kairos-draft', DRAFT0);
    else localStorage.removeItem('kairos-draft');
  } catch (e){}
  location.hash = realHash || '#/teacher'; render();

  /* 支架名稱只有一個真相來源：介面上不存在的舊名（「XX理論」）不可以出現 */
  const labels = SCAFFOLDS.map(function(s){ return s.label; });
  const src = [PROMPT_BACKBONE].concat(Object.keys(PROMPT_ROLE).map(function(k){ return PROMPT_ROLE[k]; }));
  src.forEach(function(t){
    const m = String(t).match(/「([^」]*理論[^」]*)」/g);
    if (m) m.forEach(function(q){
      const bare = q.slice(1, -1);
      if (labels.indexOf(bare) < 0) fails.push('提示詞用了介面上不存在的支架名：' + q);
    });
  });

  console.log(fails.length ? '學生端不變量失敗 ' + fails.length + ' 項：\n  ' + fails.join('\n  ')
                           : '學生端不變量：全數通過');
  return {pass: fails.length === 0, fails: fails};
};

/* --- 示範資料金絲雀 ---
   題本（options／answer／why）是種子契約的一部分：改動它，distractorFor()
   消耗的亂數筆數就變了，整條 mulberry32 序列往後位移，模擬作答矩陣整份重生。
   第 4 輪重排 R03／R10／R11／R12 的選項之後，ANCOVA 從
   F(3, 91) = 8.96、ηp² = .228 變成 F(3, 91) = 5.73、ηp² = .159。
   數值本身不是研究結論（CONDITION_GAIN 是理論推導的模擬參數），
   但它必須「只在我們有意改題本時才變」——所以把基準寫死在這裡。
   真正要守的是四個條件的排序：tutee > peer > tutor > control。 */
window.assertSeedCanary = function(){
  const fails = [];
  const rows = analysisDataset();
  const o = outcomeList()[0];                 // theta_post，共變數為前測 θ
  const a = ancova(rows, o.get, o.cov);
  if (!a){ return {pass:false, fails:['ancova() 回傳 null——分析資料不足']}; }

  const EXP = {df2: 91, F: 5.73, eta: 0.159};
  const near = function(x, y, tol){ return Math.abs(x - y) <= tol; };
  if (a.df2 !== EXP.df2) fails.push('自由度 df2 = ' + a.df2 + '，基準是 ' + EXP.df2);
  if (!near(a.F, EXP.F, 0.02)) fails.push('F = ' + a.F.toFixed(2) + '，基準是 ' + EXP.F);
  if (typeof a.eta !== 'number') fails.push('ancova() 沒有回傳 eta 欄位');
  else if (!near(a.eta, EXP.eta, 0.002))
    fails.push('ηp² = ' + a.eta.toFixed(3) + '，基準是 ' + EXP.eta);

  /* 排序才是實質主張：θ 增益要照 CONDITION_GAIN 的設計順序排 */
  const pre = diagnose(state, 'a-pre'), post = diagnose(state, 'a-post');
  const tp = {}, tq = {};
  pre.perStudent.forEach(function(p){ tp[p.sid] = p.theta; });
  post.perStudent.forEach(function(p){ tq[p.sid] = p.theta; });
  const d = {};
  state.classes.forEach(function(c){
    const v = c.studentIds.map(function(s){
      return (tp[s] != null && tq[s] != null) ? tq[s] - tp[s] : null;
    }).filter(function(x){ return typeof x === 'number' && isFinite(x); });
    d[c.condition] = v.length ? v.reduce(function(s, x){ return s + x; }, 0) / v.length : null;
  });
  const got = Object.keys(d).sort(function(x, y){ return d[y] - d[x]; }).join(' > ');
  const want = 'tutee > peer > tutor > control';
  if (got !== want) fails.push('條件排序 ' + got + '，設計順序是 ' + want);

  /* 作答紀錄與答案鍵必須對得起來（重排選項卻忘了加版號，就會在這裡爆） */
  let drift = 0;
  state.responses.forEach(function(r){
    if (r.choice === null || r.choice === undefined || r.correct === null) return;
    const it = getItem(r.iid);
    if (!it || it.type !== 'mc') return;
    if (r.correct !== (r.choice === it.answer)) drift++;
  });
  if (drift) fails.push(drift + ' 筆作答紀錄與現行答案鍵不符（題本改了但 STATE_VERSION 沒加？）');

  console.log(fails.length ? '示範資料金絲雀失敗 ' + fails.length + ' 項：\n  ' + fails.join('\n  ')
                           : '示範資料金絲雀：全數通過');
  return {pass: fails.length === 0, fails: fails,
          got: {df2: a.df2, F: +a.F.toFixed(2),
                eta: typeof a.eta === 'number' ? +a.eta.toFixed(3) : null,
                p: typeof a.p === 'number' ? +a.p.toFixed(4) : null, order: got}};
};

/* ==========================================================================
   窄版門檻的實測
   syncNarrow 的門檻原本是估的（1100），實測雙欄要 1144px 的容器才不溢出，
   於是 1100–1159 這一段仍走雙欄卻裝不下，孩子要左右捲才看得到對話欄。
   這一支把 .aal 放進雙欄、逐格縮小容器量出真正的下限，再與 NARROW_MIN_PX
   對照：日後改動兩欄的 minmax 下限、側欄寬或 .wrap 內距都會被驗出來。
   console 一行：assertNarrowThreshold()
   ========================================================================== */
window.assertNarrowThreshold = function(){
  const realRole = state.ui.role, realImp = state.ui.impersonate, realHash = location.hash;
  const me = state.classes[0].studentIds[0];
  const keep = state.submissions.slice();
  state.submissions = state.submissions.filter(function(s){ return !(s.aid === 'a-post' && s.sid === me); });
  AAL = null; state.ui.role = me; state.ui.impersonate = null; renderShell();
  location.hash = '#/aal/a-post'; render();

  const root = document.documentElement;
  const wasNarrow = root.hasAttribute('data-narrow');
  root.removeAttribute('data-narrow');
  const app  = document.querySelector('.app') || document.querySelector('.main').parentElement;
  const main = document.querySelector('.main');
  const aal  = document.querySelector('.aal');
  let need = null;
  if (aal){
    const prev = app.style.width;
    for (let w = 1400; w >= 900; w -= 2){
      app.style.width = w + 'px';
      void aal.offsetWidth;
      const over = aal.scrollWidth > aal.clientWidth + 1 || main.scrollWidth > main.clientWidth + 1;
      if (over) break;
      need = w;
    }
    app.style.width = prev;
  }
  if (wasNarrow) root.setAttribute('data-narrow', '');

  state.submissions = keep;
  state.ui.role = realRole; state.ui.impersonate = realImp; renderShell();
  location.hash = realHash || '#/teacher'; render();

  const sb = window.innerWidth - document.documentElement.clientWidth;
  const wantWindow = need === null ? null : need + sb;
  const pass = need !== null && NARROW_MIN_PX >= wantWindow;
  const r = {pass:pass, 容器下限:need, 加捲軸後的視窗下限:wantWindow,
             捲軸:sb, NARROW_MIN_PX:NARROW_MIN_PX,
             說明: pass ? '門檻夠寬'
                        : '門檻比實測需求小 ' + (wantWindow - NARROW_MIN_PX) + 'px，這一段會橫向溢出'};
  console.log('[assertNarrowThreshold]', r);
  return r;
};

/* ==========================================================================
   跨分頁擱置不可以回捲
   R7-P0 擋住了「施測中被另一個分頁換掉身分」，但擱置下來的那份快照若在
   離開時無條件套用，會把整節課回捲到擱置的那一刻——而 flushLogs() 每兩秒
   save() 一次，我們的版次幾乎一定比快照新。這一支把三件事一起驗：
     1. 較舊的快照在離開時必須被丟掉，交卷紀錄與 responses 要原封不動
     2. 沒在施測時，較新的外部更新仍要立刻套用
     3. 施測中收到較新的外部更新要擱著，離開後才套用
   console 一行：assertNoRollback()
   ========================================================================== */
window.assertNoRollback = function(){
  const realRole = state.ui.role, realImp = state.ui.impersonate, realHash = location.hash;
  const fails = [];
  function reset(){
    state = buildSeedState(); save();
    AAL = null; SURVEY = null; QUIZ = null;
  }

  /* 1. 較舊的快照不可以蓋掉孩子剛交出去的答案 */
  reset();
  const A = state.classes[0].studentIds[0];
  const B = state.classes[3].studentIds[0];
  state.submissions = state.submissions.filter(function(s){ return !(s.aid === 'a-post' && s.sid === A); });
  try {
    const all = JSON.parse(localStorage.getItem(AAL_DRAFT_KEY) || '{}');
    delete all['a-post|' + A]; localStorage.setItem(AAL_DRAFT_KEY, JSON.stringify(all));
  } catch (e) {}
  state.ui.role = A; state.ui.impersonate = null; renderShell();
  location.hash = '#/aal/a-post'; render();
  const stale = JSON.parse(JSON.stringify(state));
  stale.ui.role = B; stale.rev = (STATE_REV || 0) + 1; stale.writer = 'tab-other';
  window.dispatchEvent(new StorageEvent('storage', {key: STORE_KEY, newValue: JSON.stringify(stale)}));
  if (!PENDING_FOREIGN) fails.push('施測中的外部更新沒有被擱置');
  AAL.items.forEach(function(it, i){
    if (it.type === 'cr') AAL.texts[it.id] = '答案' + i; else AAL.answers[it.id] = i % 4; });
  aalSubmitCommit();
  const nResp = state.responses.filter(function(r){ return r.aid === 'a-post' && r.sid === A; }).length;
  SURVEY = null; AAL = null; QUIZ = null;
  location.hash = '#/student'; render();
  if (!submitted('a-post', A)) fails.push('回捲了：交卷紀錄不見了');
  if (state.responses.filter(function(r){ return r.aid === 'a-post' && r.sid === A; }).length !== nResp)
    fails.push('回捲了：responses 從 ' + nResp + ' 變成別的數字');
  if (state.ui.role !== A) fails.push('較舊的快照仍然把身分換走了');
  if (PENDING_FOREIGN) fails.push('離開之後擱置的快照沒有被處理掉');

  /* 2. 沒在施測時，較新的外部更新要立刻套用 */
  const fresh = JSON.parse(JSON.stringify(state));
  fresh.ui.role = B; fresh.rev = (STATE_REV || 0) + 50; fresh.writer = 'tab-other';
  window.dispatchEvent(new StorageEvent('storage', {key: STORE_KEY, newValue: JSON.stringify(fresh)}));
  if (state.ui.role !== B) fails.push('沒在施測時，較新的外部更新沒有立刻套用');

  /* 3. 施測中收到較新的外部更新，離開後才套用 */
  reset();
  const C = state.classes[0].studentIds[0];
  state.submissions = state.submissions.filter(function(s){ return !(s.aid === 'a-post' && s.sid === C); });
  try {
    const all = JSON.parse(localStorage.getItem(AAL_DRAFT_KEY) || '{}');
    delete all['a-post|' + C]; localStorage.setItem(AAL_DRAFT_KEY, JSON.stringify(all));
  } catch (e) {}
  state.ui.role = C; state.ui.impersonate = null; renderShell();
  location.hash = '#/aal/a-post'; render();
  const newer = JSON.parse(JSON.stringify(state));
  newer.ui.role = B; newer.rev = (STATE_REV || 0) + 500; newer.writer = 'tab-other';
  window.dispatchEvent(new StorageEvent('storage', {key: STORE_KEY, newValue: JSON.stringify(newer)}));
  if (state.ui.role !== C) fails.push('施測中身分被換走了');
  if (!PENDING_FOREIGN) fails.push('施測中較新的外部更新沒有被擱置');
  AAL = null; location.hash = '#/student'; render();
  if (state.ui.role !== B) fails.push('離開之後較新的外部更新沒有被套用');

  reset();
  state.ui.role = realRole; state.ui.impersonate = realImp; renderShell();
  location.hash = realHash || '#/teacher'; render();
  const r = {pass: fails.length === 0, fails: fails};
  console.log('[assertNoRollback]', r);
  return r;
};

/* ==========================================================================
   兩個分頁不可以互相蓋掉對方的資料
   施測中的分頁依設計拒絕同步外部更新，手上是舊 state；save() 原本無條件
   整份寫回去，於是 A 分頁交卷之後，B 分頁兩秒後的 flushLogs 就把
   responses／submissions／dialog／logs 一起抹掉——孩子看到「已交卷」、
   草稿也刪了，磁碟上卻是 false。這一支模擬那個時序：
     1. 兩邊都持有同一份基準
     2. 「A 分頁」直接寫磁碟（模擬另一個分頁交卷）
     3. 這一頁（B）在不同步的情況下 save()
     4. 磁碟上 A 的交卷紀錄必須還在，B 自己的東西也要在
   console 一行：assertNoClobber()
   ========================================================================== */
window.assertNoClobber = function(){
  const realRole = state.ui.role, realImp = state.ui.impersonate, realHash = location.hash;
  const fails = [];

  state = buildSeedState(); save();
  const A = state.classes[0].studentIds[0];
  const B = state.classes[1].studentIds[0];

  /* 這一頁（B 分頁）手上的基準 */
  state.ui.role = B; state.ui.impersonate = null;
  save();
  const baseRev = STATE_REV;

  /* 模擬另一個分頁：直接寫磁碟，帶更高的版次與別的 writer */
  const other = JSON.parse(localStorage.getItem(STORE_KEY));
  other.submissions = other.submissions.filter(function(s){ return !(s.aid === 'a-post' && s.sid === A); });
  other.submissions.push({aid:'a-post', sid:A, at:Date.now()});
  other.responses = other.responses.filter(function(r){ return !(r.aid === 'a-post' && r.sid === A); });
  other.responses.push({aid:'a-post', sid:A, iid:'R01', choice:1, correct:false, text:'', strokes:null});
  other.dialog = (other.dialog || []).concat([{t:Date.now(), sid:A, aid:'a-post', iid:'R01',
    turn:1, speaker:'student', text:'A 分頁講的話'}]);
  other.rev = baseRev + 1;
  other.writer = 'tab-other';
  localStorage.setItem(STORE_KEY, JSON.stringify(other));
  localStorage.setItem(REV_KEY, String(other.rev));

  /* B 分頁在不同步的情況下寫入自己的東西 */
  state.logs = state.logs || [];
  state.logs.push({t:Date.now(), sid:B, cid:'c-2', cond:'tutee', aid:'a-post', iid:'R02',
                   proc:'FR', type:'MARK', code:'M', sent:0, on:true});
  save();

  const after = JSON.parse(localStorage.getItem(STORE_KEY));
  if (!after.submissions.some(function(s){ return s.aid === 'a-post' && s.sid === A; }))
    fails.push('另一個分頁的交卷紀錄被蓋掉了');
  if (!after.responses.some(function(r){ return r.aid === 'a-post' && r.sid === A && r.iid === 'R01'; }))
    fails.push('另一個分頁的 responses 被蓋掉了');
  if (!(after.dialog || []).some(function(d){ return d.sid === A && d.text === 'A 分頁講的話'; }))
    fails.push('另一個分頁的 dialog 被蓋掉了');
  if (!(after.logs || []).some(function(e){ return e.sid === B && e.iid === 'R02' && e.code === 'M'; }))
    fails.push('本頁自己寫的事件沒有落地');
  if (!after.ui || after.ui.role !== B)
    fails.push('合併之後 ui.role 不是本機的');

  state = buildSeedState(); save();
  state.ui.role = realRole; state.ui.impersonate = realImp; renderShell();
  location.hash = realHash || '#/teacher'; render();
  const r = {pass: fails.length === 0, fails: fails};
  console.log('[assertNoClobber]', r);
  return r;
};

/* ==========================================================================
   防洩答攔截的三條不變量
   第 8 輪的效度車道指出 leakGuard 攔不住用肯定／否定講出來的對錯判斷
   （「不是 B 喔」「對耶」「再想想」），而 blocked 次數正是要拿來報告的
   實施忠實度指標——事後看會顯示「一次都沒洩」。放寬規則之後有一個新風險：
   規則引擎自己踩到自己的守門，那樣每一則夥伴發話都會被換成攔截語句，
   整場研究的對話內容一起消失。所以這三件事要一起釘住：
   (1) 內建引擎在 3 角色 × 6 回合 × 全部題目下，一次都不可以被自己攔下；
   (2) 三個角色的攔截替換文等長——它們和 frame／opener／stem 一樣是話量對等
       的一部分，而攔截頻率由孩子自己的行為決定，與投入、能力共變；
   (3) 效度車道舉的每一句都要真的攔得下來，並且分到正確的類別。
   console 一行：assertLeakGuard()
   ========================================================================== */
window.assertLeakGuard = function(){
  const fails = [];
  const roles = ['tutor', 'tutee', 'peer'];

  /* (1) 內建引擎不可自攔 */
  let selfBlocked = 0, firstSelf = null;
  roles.forEach(function(c){
    for (let turn = 0; turn < MAX_TURNS; turn++){
      ITEMS.forEach(function(it){
        const a = agentTurn(c, it, turn, function(){ return 0.5; });
        const g = leakGuard(a.text, it, c);
        if (g.blocked){ selfBlocked++; if (!firstSelf) firstSelf = c + '/' + it.id + '/t' + turn + '：' + a.text + ' → ' + g.hits.join(','); }
      });
    }
  });
  if (selfBlocked) fails.push('內建引擎被自己的守門攔下 ' + selfBlocked + ' 次（' + firstSelf + '）');

  /* (2) 三句替換文等長 */
  const lens = roles.map(function(c){ return String(GUARD_REPLY[c] || '').length; });
  if (new Set(lens).size !== 1)
    fails.push('三個角色的攔截替換文長度不一致：' + roles.map(function(c, i){ return c + '=' + lens[i]; }).join('、'));
  roles.forEach(function(c){ if (!GUARD_REPLY[c]) fails.push(c + ' 沒有自己的攔截替換文'); });

  /* (3) 該攔的要攔到，而且分對類別 */
  const mc = ITEMS.find(function(i){ return i.type === 'mc'; });
  const must = [
    ['B 我覺得不太對耶', 'verdict'], ['不是 B 喔', 'verdict'], ['對耶', 'verdict'],
    ['沒錯', 'verdict'], ['再想想', 'verdict'], ['很接近了', 'verdict'],
    ['你答對了', 'verdict'], ['答案是 B', 'verdict'],
    ['線索在第 3 段', 'leak'], ['你去看第二句', 'leak']
  ];
  must.forEach(function(p){
    const g = leakGuard(p[0], mc, 'tutee');
    if (!g.blocked) fails.push('沒攔下：「' + p[0] + '」');
    else if (g.kinds.indexOf(p[1]) < 0)
      fails.push('「' + p[0] + '」分類錯：得到 ' + g.kinds.join('+') + '，應含 ' + p[1]);
  });
  /* 攔下之後回的是自己角色的那一句 */
  roles.forEach(function(c){
    const g = leakGuard('你答對了', mc, c);
    if (g.text !== GUARD_REPLY[c]) fails.push(c + ' 攔截後回的不是自己角色的替換文');
  });

  const r = {pass: fails.length === 0, fails: fails, 自攔次數: selfBlocked, 替換文長度: lens[0]};
  console.log('[assertLeakGuard]', r);
  return r;
};

/* ==========================================================================
   對話區的絕對定位溢出
   .sr-only 是 position:absolute，包含區塊是最近的已定位祖先。.chat 是固定
   15rem 的捲動容器，.msg 原本沒有 position——每一則泡泡裡的「我說的」「系統
   訊息」於是跳過 .chat，改以 .stage 為基準停在未捲動版面中的位置，把整份
   文件撐長。這件事只發生在三個 AI 條件（對照組同一格是 textarea），長度又
   隨對話回合數單調增加，與操弄劑量共變。
   既有的對等測試量的是 #view.offsetHeight，而絕對定位的溢出不計入
   offsetHeight——所以掃四個字級都不會報紅，非得另外量 scrollHeight 不可，
   而且要先把對話填滿才量得到。
   console 一行：assertChatOverflow()
   ========================================================================== */
window.assertChatOverflow = function(){
  const realRole = state.ui.role, realHash = location.hash;
  const realDialog = (state.dialog || []).slice();
  const fails = [];
  const rows = [];

  function stageScroll(){
    const s = document.getElementById('stage');
    return s ? Math.round(s.scrollHeight) : Math.round(document.documentElement.scrollHeight);
  }
  function pick(cond){
    const k = state.classes.find(function(c){ return c.condition === cond; });
    return k ? k.studentIds[0] : null;
  }
  function open(sid){
    state.ui.role = sid; renderShell();
    if (typeof AAL !== 'undefined') AAL = null;
    try {
      const all = JSON.parse(localStorage.getItem('kairos-draft') || '{}');
      Object.keys(all).forEach(function(x){ if (x.indexOf('|' + sid) >= 0) delete all[x]; });
      localStorage.setItem('kairos-draft', JSON.stringify(all));
    } catch (e){}
    location.hash = '#/aal/a-post'; render();
  }

  ['tutor', 'tutee', 'peer'].forEach(function(cond){
    const sid = pick(cond); if (!sid) return;
    const had = submitted('a-post', sid);
    if (had) state.submissions = state.submissions.filter(function(s){ return !(s.aid === 'a-post' && s.sid === sid); });

    state.dialog = realDialog.filter(function(d){ return d.sid !== sid; });
    open(sid);
    const iid = (typeof AAL !== 'undefined' && AAL) ? AAL.items[0].id : 'R01';
    const empty = stageScroll();

    /* 填滿額度：6 個學生回合 + 6 個夥伴回合 */
    for (let n = 1; n <= MAX_TURNS; n++){
      state.dialog.push({t:Date.now() + n * 2, sid:sid, cond:cond, aid:'a-post', iid:iid,
        turn:n, speaker:'student', text:'我覺得這一段在講的是另一件事', rel:'AT'});
      state.dialog.push({t:Date.now() + n * 2 + 1, sid:sid, cond:cond, aid:'a-post', iid:iid,
        turn:n, speaker:'agent', text:'你剛剛是從哪一句看出來的？'});
    }
    render();
    const full = stageScroll();

    /* 對話卡是固定高度的捲動容器，填滿它不應該讓文件長高。 */
    const grew = full - empty;
    rows.push({條件:cond, 空:empty, 滿:full, 差:grew});
    if (grew > 4) fails.push(cond + '：對話填滿之後文件高度多了 ' + grew + 'px（.sr-only 逃出 .chat）');

    /* 直接量包含區塊。不能用 getBoundingClientRect 比對 .chat 的可視矩形——
       捲出視窗的訊息本來就落在容器矩形之外，那是正常的。要問的是
       「這個 sr-only 以誰為基準」，也就是它的 offsetParent 是不是自己的泡泡。 */
    const chat = document.getElementById('aalChat');
    if (chat){
      const out = Array.prototype.filter.call(chat.querySelectorAll('.sr-only'), function(el){
        const own = el.closest('.msg');
        return !own || el.offsetParent !== own;
      });
      if (out.length) fails.push(cond + '：有 ' + out.length + ' 個 .sr-only 的包含區塊不是自己的 .msg');
    }
    if (had) state.submissions.push({aid:'a-post', sid:sid, at:Date.now()});
  });

  state.dialog = realDialog;
  state.ui.role = realRole; renderShell();
  location.hash = realHash || '#/teacher'; render();
  const r = {pass: fails.length === 0, fails: fails, rows: rows};
  console.log('[assertChatOverflow]', r);
  return r;
};

/* ==========================================================================
   合併其他平板的資料包
   「四個班共用同一次 Rasch 校準」是本平台宣告的不變量，而作答矩陣只由這台
   裝置的 submissions／responses 組成——一人一台平板時 done.length 恆為 1。
   這一支釘住合併路徑的四件事：能把缺的補回來、同一份匯兩次不會重複、
   名單外的學生一律不收、舊版（沒有 raw 區塊）的資料包要明確報錯而不是
   無聲吃掉。第四件尤其重要：資料包上層的 surveys／logs 是分析形狀
   （帶 scores 而不是 resp、含示範資料），照著併回去會污染校準。
   console 一行：assertBundleMerge()
   ========================================================================== */
window.assertBundleMerge = function(){
  const fails = [];
  const snap = JSON.parse(JSON.stringify({
    responses: state.responses, submissions: state.submissions,
    logs: state.logs || [], dialog: state.dialog || [],
    aalNotes: state.aalNotes || [], surveys: state.surveys || []
  }));

  /* 挑一位真的有作答的學生，把他整份從本機拿掉，做成「另一台平板」的資料包 */
  const sid = (state.submissions.find(function(s){ return s.aid === 'a-post'; }) || {}).sid;
  if (!sid){ const r = {pass:false, fails:['種子裡找不到任何後測交卷紀錄']}; console.log('[assertBundleMerge]', r); return r; }
  const mine = function(arr){ return (arr || []).filter(function(x){ return x.sid === sid; }); };
  const away = {raw: JSON.parse(JSON.stringify({
    responses: mine(state.responses), submissions: mine(state.submissions),
    logs: mine(state.logs), dialog: mine(state.dialog),
    aalNotes: mine(state.aalNotes), surveys: mine(state.surveys)
  }))};
  const nAway = Object.keys(away.raw).reduce(function(a, k){ return a + away.raw[k].length; }, 0);
  if (!nAway) fails.push('取樣的學生沒有任何列可以搬走');

  ['responses','submissions','logs','dialog','aalNotes','surveys'].forEach(function(k){
    state[k] = (state[k] || []).filter(function(x){ return x.sid !== sid; });
  });
  const gone = submitted('a-post', sid);
  if (gone) fails.push('搬走之後 submitted() 仍為 true，取樣有問題');

  /* (1) 補得回來。示範問卷（demo:true）依設計不收，所以帳要這樣對：
     收下的 + 略過的示範 + 略過的名單外 = 搬走的。 */
  const r1 = mergeResearchBundle(JSON.parse(JSON.stringify(away)));
  if (r1.total + r1.demo + r1.foreign !== nAway)
    fails.push('第一次合併帳對不起來：收 ' + r1.total + ' + 示範 ' + r1.demo +
               ' + 名單外 ' + r1.foreign + ' ≠ 搬走的 ' + nAway);
  if (!r1.total) fails.push('第一次合併一列都沒收');
  if (!submitted('a-post', sid)) fails.push('合併之後 submitted() 還是 false');

  /* (2) 同一份匯兩次不重複 */
  const r2 = mergeResearchBundle(JSON.parse(JSON.stringify(away)));
  if (r2.total !== 0) fails.push('第二次合併又加了 ' + r2.total + ' 列（應該是 0）');

  /* (3) 名單外的學生不收 */
  const r3 = mergeResearchBundle({raw:{responses:[
    {aid:'a-post', sid:'u-not-in-roster', iid:'R01', choice:0, correct:true}]}});
  if (r3.total !== 0 || r3.foreign !== 1) fails.push('名單外的列沒有被擋下：' + JSON.stringify(r3));

  /* (4) 舊版資料包要報錯 */
  let threw = false;
  try { mergeResearchBundle({meta:{}, surveys:[], logs:[]}); } catch (e){ threw = true; }
  if (!threw) fails.push('沒有 raw 區塊的舊資料包被無聲接受了');

  /* 還原 */
  Object.keys(snap).forEach(function(k){ state[k] = snap[k]; });
  save();
  const r = {pass: fails.length === 0, fails: fails, 搬走的列數: nAway};
  console.log('[assertBundleMerge]', r);
  return r;
};
