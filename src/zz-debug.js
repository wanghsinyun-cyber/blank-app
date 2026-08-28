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
    ['tabKidmap', function(){ TAB='kidmap'; V(viewAssign('a-pre')); }],
    ['tabItems', function(){ TAB='items'; V(viewAssign('a-pre')); }],
    ['tabBridge', function(){ TAB='bridge'; V(viewAssign('a-pre')); }],
    ['tabCR', function(){ TAB='cr'; V(viewAssign('a-pre')); }],
    ['tabAI', function(){ TAB='ai'; V(viewAssign('a-pre')); TAB='overview'; }],
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
      aalTurns(it.id).push({speaker:'student', text:'我覺得作者想告訴我們的是另一件事', rel:'ABOVE', at:Date.now()});
      var a = agentTurn(AAL.cond, it, 0);
      aalTurns(it.id).push({speaker:'agent', text:a.text, at:Date.now()});
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
    ['tabReplay', function(){ TAB = 'replay'; V(viewAssign('a-post')); TAB = 'overview'; }],
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
  setTimeout(step, 500);
})();
