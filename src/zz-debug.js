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
  setTimeout(step, 500);
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

  const realRole = state.ui.role, realImp = state.ui.impersonate, realHash = location.hash;
  state.ui.impersonate = null;

  function pick(cond){
    const k = state.classes.find(function(x){ return x.condition === cond; });
    return k ? k.studentIds[0] : null;
  }
  function shot(sid, hash){
    state.ui.role = sid; renderShell();
    location.hash = hash; render();
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
  SCREENS.forEach(function(sc){
    const per = {};
    CONDS.forEach(function(cond){
      const sid = pick(cond); if (!sid) return;
      let hash = sc[1];
      if (!hash){
        const secs = surveySections('post', cond);
        hash = '#/survey/post/' + secs.length;
      }
      /* 作答頁要走得進去：暫時清掉這一位的後測交卷紀錄 */
      let restored = null;
      if (hash.indexOf('#/aal/') === 0){
        restored = state.submissions.filter(function(s){ return s.aid === 'a-post' && s.sid === sid; });
        state.submissions = state.submissions.filter(function(s){ return !(s.aid === 'a-post' && s.sid === sid); });
      }
      per[cond] = shot(sid, hash);
      if (restored && restored.length) state.submissions = state.submissions.concat(restored);
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
    rows.push({畫面: sc[0], 卡片數: cards.join('/'), 卡片數相同: cardsSame,
               字數: chars.join('/'), 字數落差: charPct + '%', 字數過關: charPct <= 10,
               高度落差: hSpread + 'px', 高度過關: hSpread <= 4});
  });

  state.ui.role = realRole; state.ui.impersonate = realImp; renderShell();
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
