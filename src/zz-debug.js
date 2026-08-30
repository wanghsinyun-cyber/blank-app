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
    if (i >= stages.length){
      /* 跑完要把 state 還原。這一趟會刻意刪掉 u-s3 與 u-s75 的交卷紀錄
         （'viewAaL (unsubmitted)' 與 'viewAaL control cond' 兩關），而且
         那些刪除會跟著 save() 落到 localStorage——於是「跑過巡檢」這件事
         本身會讓後面每一次載入的 ANCOVA 少掉兩個受試者，assertSeedCanary
         報 df2=89、F=5.03，看起來像剛才那批改動造成的回歸。
         實際踩過兩次，每次都要花時間才排除得掉。
         這一支上面自己寫過：驗證工具製造假陽性比沒有工具更糟。 */
      try {
        state = buildSeedState(); save();
        if (typeof renderShell === 'function') renderShell();
        log('   （已還原示範資料）');
      } catch (e){ log('   還原失敗：' + (e && e.message)); }
      log('=== ALL STAGES DONE ===');
      return;
    }
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
  /* 磁碟也要一起清。只清記憶體的話，這一位在磁碟上仍然是「已交卷」，
     而 aalSubmitCommit 的第二道門正是問磁碟——本來要驗「舊快照不可以
     蓋掉剛交出去的答案」，實際上驗成了「重複交卷會被擋下」。 */
  save();
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
  /* 磁碟也要一起清。只清記憶體的話，這一位在磁碟上仍然是「已交卷」，
     而 aalSubmitCommit 的第二道門正是問磁碟——本來要驗「舊快照不可以
     蓋掉剛交出去的答案」，實際上驗成了「重複交卷會被擋下」。 */
  save();
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

  /* (1) 內建引擎不可自攔。
     這一段原本用固定的 rnd = () => 0.5 抽開場句，而 Math.floor(0.5 * 4) 恆為 2——
     四句的池子永遠只抽得到第 3 句，索引 0、1、3 從來沒被測過。
     第 9 輪就是這樣漏掉 tutee.later[0]（含「錯了」，命中 VERDICT_SOFT）：
     斷言恆綠，而每四個 tutee 回合就有一個被自己的守門換成罐頭替換文。
     固定亂數不是「涵蓋」，只是「可重現地只走同一條路」。
     改成兩層：先逐句把每一個 opener 單獨送進守門（池子有幾句就測幾句），
     再掃 agentTurn 的完整輸出，而且把每一句 opener 都輪過一次。 */
  let selfBlocked = 0, firstSelf = null;
  function note(where, text, hits){
    selfBlocked++;
    if (!firstSelf) firstSelf = where + '：' + text + ' → ' + hits.join(',');
  }
  /* 1a：每一句 opener 逐句過守門 */
  roles.forEach(function(c){
    const pool = ROLE_OPENER[c] || {first: [], later: []};
    ['first', 'later'].forEach(function(which){
      (pool[which] || []).forEach(function(s, i){
        const g = leakGuard(s, ITEMS[0], c);
        if (g.blocked) note(c + '/' + which + '[' + i + ']', s, g.hits);
      });
    });
  });
  /* 1b：完整輸出（opener + stem + body），把每一句 opener 都輪過 */
  roles.forEach(function(c){
    const pool = ROLE_OPENER[c] || {first: [''], later: ['']};
    const most = Math.max((pool.first || []).length, (pool.later || []).length, 1);
    for (let pick = 0; pick < most; pick++){
      for (let turn = 0; turn < MAX_TURNS; turn++){
        ITEMS.forEach(function(it){
          const poolNow = turn === 0 ? (pool.first || []) : (pool.later || []);
          const n = poolNow.length || 1;
          const frac = Math.min(0.999999, (pick % n) / n + 0.0001);
          const a = agentTurn(c, it, turn, function(){ return frac; });
          /* 要讀 a.blocked，不能再把 a.text 送進守門一次——agentTurn 回傳的
             已經是替換後的文字，再測一次當然永遠不會攔，這一段就成了裝飾。 */
          if (a.blocked) note(c + '/' + it.id + '/t' + turn + '/pick' + (pick % n), a.text, a.hits || []);
          /* 被攔的時候，qfn／sub 一定要一起清掉——日誌不可以宣稱問了
             一個其實沒問出來的子歷程。 */
          if (a.blocked && (a.qfn || a.sub))
            fails.push(c + '/' + it.id + '/t' + turn + '：被攔了卻還帶著 qfn=' + a.qfn + ' sub=' + a.sub);
          if (!a.blocked && a.qfn == null)
            fails.push(c + '/' + it.id + '/t' + turn + '：沒被攔卻沒有 qfn');
        });
      }
    }
  });
  if (selfBlocked) fails.push('內建引擎被自己的守門攔下 ' + selfBlocked + ' 次（' + firstSelf + '）');

  /* (1c) 提示詞裡被指定為「要講出來的字句」也不可以踩到守門。
     這一輪踩過兩次同一個形狀：tutee 的開場句含「錯了」（VERDICT_SOFT）、
     peer 的提示詞指定口頭禪「我們對一下」而『對』在 LETTER_NEAR 裡——
     骨幹又強制「第一句回應學生剛剛說的內容」，孩子報 A–D 是常態，
     於是那句話與字母同段就被攔成「選項代號＋判定語」。
     指定語氣可以，指定字句不行。這裡掃 PROMPT_ROLE 裡所有「」引號中的字句。 */
  Object.keys(PROMPT_ROLE || {}).forEach(function(c){
    const src = String(PROMPT_ROLE[c] || '');
    const quoted = src.match(/「[^」]{2,}」/g) || [];
    quoted.forEach(function(q){
      const phrase = q.slice(1, -1);
      const g = leakGuard(phrase, ITEMS.find(function(i){ return i.type === 'mc'; }), c);
      if (g.blocked)
        fails.push(c + ' 的提示詞指定了一句會被自己守門攔下的話：「' + phrase + '」→ ' + g.hits.join(','));
      /* 更狠一點：那句話與一個裸露的選項字母同段時也不可以被攔——
         那正是實際會發生的情況。 */
      const g2 = leakGuard('你覺得是 B 啊，' + phrase + '——那你怎麼看？', ITEMS.find(function(i){ return i.type === 'mc'; }), c);
      if (g2.blocked)
        fails.push(c + ' 的提示詞指定的「' + phrase + '」與選項字母同句時會被攔：' + g2.hits.join(','));
    });
  });

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

/* ==========================================================================
   手寫筆畫的等比換算
   第 7 輪把畫布高度從 JS 的固定像素改成 CSS 的 11rem 之後，寬與高就可以
   各自單獨變動：改字級只動高度、平板轉向只動寬度。舊碼用 kx=w/p.w、
   ky=h/p.h 兩個獨立比例換算，於是 100%→175% 會把已經寫好的字縱向拉長
   75%，橫轉直會把它橫向壓成 75%（筆寬還只乘 kx，跟著變細）。
   手寫是不會注音打字的孩子在兩題建構反應題上唯一的作答通道，而變形會被
   padPayload 烘進交出去的那一份——評閱者看到的就是被拉長的中文字。
   這一支畫一筆，然後掃 100%→125%→150%→175%→100% 與一次寬度變化，
   比對筆畫外接框的長寬比。
   console 一行：assertPadAspect()
   ========================================================================== */
window.assertPadAspect = function(){
  const fails = [];
  const realRole = state.ui.role, realHash = location.hash;
  const realFs = document.documentElement.style.getPropertyValue('--fs');

  /* 找一位對照組學生（版面最單純），開到有計算紙的作答頁 */
  const k = state.classes.find(function(c){ return c.condition === 'control'; });
  const sid = k ? k.studentIds[0] : state.classes[0].studentIds[0];
  const had = submitted('a-post', sid);
  if (had) state.submissions = state.submissions.filter(function(s){ return !(s.aid === 'a-post' && s.sid === sid); });
  state.ui.role = sid; renderShell();
  if (typeof AAL !== 'undefined') AAL = null;
  if (typeof clearPads === 'function') clearPads();
  location.hash = '#/aal/a-post'; render();
  /* 計算紙只長在建構反應題上，題本第一題是選擇題——要先翻到 CR 那一題。 */
  if (typeof AAL !== 'undefined' && AAL){
    const cri = AAL.items.findIndex(function(x){ return x.type === 'cr'; });
    if (cri >= 0 && AAL.idx !== cri){ AAL.idx = cri; render(); }
  }

  const cv = document.querySelector('canvas.pad[data-pad]');
  if (!cv){
    if (had) state.submissions.push({aid:'a-post', sid:sid, at:Date.now()});
    state.ui.role = realRole; renderShell(); location.hash = realHash || '#/teacher'; render();
    const r = {pass:false, fails:['作答頁上找不到計算紙']};
    console.log('[assertPadAspect]', r); return r;
  }
  const id = cv.dataset.pad;

  /* 畫一筆明確不是正方形的折線（外接框 3:1） */
  PADS[id].strokes = [{color:'ink', width:2, pts:[[20,20],[140,20],[140,60],[20,60]]}];
  PADS[id].w = cv.clientWidth; PADS[id].h = cv.clientHeight;
  PADS[id].w0 = cv.clientWidth; PADS[id].h0 = cv.clientHeight;
  function aspect(){
    const pts = PADS[id].strokes[0].pts;
    const xs = pts.map(function(p){ return p[0]; }), ys = pts.map(function(p){ return p[1]; });
    const w = Math.max.apply(null, xs) - Math.min.apply(null, xs);
    const h = Math.max.apply(null, ys) - Math.min.apply(null, ys);
    return h ? w / h : 0;
  }
  /* 要比書寫座標系（w0／h0），不是螢幕 px。改制之後這兩者不再是同一個單位，
     而字級掃描時畫布會變大——拿 clientWidth 比只會愈來愈寬鬆，
     永遠不可能抓到「座標跑到 viewBox 外」這個形狀，也就是這一輪
     對抗性覆核抓到的那個 blocker。 */
  function inside(){
    const p = PADS[id];
    return p.strokes.every(function(s){
      return (s.pts || []).every(function(pt){
        return pt[0] >= -1 && pt[1] >= -1 && pt[0] <= p.w0 + 1 && pt[1] <= p.h0 + 1;
      });
    });
  }
  /* padPayload 的 viewBox 也要涵蓋所有墨水——那是評閱端唯一看得到的框。 */
  function payloadCovers(){
    const pay = padPayload(id);
    if (!pay) return true;
    return (pay.lines || []).every(function(s){
      return (s.pts || []).every(function(pt){ return pt[0] <= pay.w + 1 && pt[1] <= pay.h + 1; });
    });
  }
  const base = aspect();
  const snap0 = JSON.stringify(PADS[id].strokes);
  const w0 = PADS[id].w0, h0 = PADS[id].h0;
  const rows = [{step:'起始', aspect:+base.toFixed(3), 在畫布內:inside(), k:+padScale(id).toFixed(3)}];

  /* 這一支現在驗的是三件事，而不只是「有沒有被拉伸」：
     (a) 座標永遠不動——縮放只發生在畫的那一刻；
     (b) 任何一連串縮放之後回到原尺寸，比例精確回到 1（可逆、不累積）；
     (c) 長寬比與「有沒有掉出畫布」照舊。
     第 8 輪的 min() 修法只滿足 (c)：它是就地改資料的變換，橫轉直縮 0.733、
     直轉橫不還原，來回三次筆跡只剩 39%——而那正是平板上最常發生的動作。 */
  /* 座標永遠不動；書寫座標系只准長大、不准縮小。
     「只長不縮」是刻意的：k = min(w/w0, h/h0) 之後必有一軸的可寫範圍
     大於 w0／h0，盒子要長到涵蓋它，否則孩子寫得到的點會落在
     padPayload 的 viewBox 外、在評閱端被裁掉。
     alsoW0：轉向模擬本來就是靠改 w0 來假裝板子變窄，那一段不查盒子。 */
  function checkFrozen(step, alsoW0){
    if (JSON.stringify(PADS[id].strokes) !== snap0)
      fails.push(step + '：座標被就地改掉了（縮放應該只發生在畫的那一刻）');
    if (alsoW0 && (PADS[id].w0 < w0 - 0.5 || PADS[id].h0 < h0 - 0.5))
      fails.push(step + '：書寫座標系縮小了（' + PADS[id].w0 + '×' + PADS[id].h0 +
        '，原本 ' + w0 + '×' + h0 + '）——盒子只准長大');
  }

  /* 字級掃描：畫布寬高都跟著 --fs 走 */
  ['1.25', '1.5', '1.75', '1'].forEach(function(fs){
    document.documentElement.style.setProperty('--fs', fs);
    if (typeof syncPads === 'function') syncPads();
    const a = aspect();
    rows.push({step:'字級 ' + fs, aspect:+a.toFixed(3), 在畫布內:inside(), k:+padScale(id).toFixed(3)});
    if (Math.abs(a - base) > 0.02) fails.push('字級 ' + fs + '：長寬比 ' + a.toFixed(3) + '，起始是 ' + base.toFixed(3));
    if (!inside()) fails.push('字級 ' + fs + '：筆畫跑到畫布外');
    checkFrozen('字級 ' + fs, true);
  });
  document.documentElement.style.setProperty('--fs', realFs || '1');
  if (typeof syncPads === 'function') syncPads();
  /* 可逆性要這樣定義：**同一個盒子、同一個畫布尺寸，k 必須一樣**。
     不能要求「回到 100% 時 k 精確是 1」——盒子在 175% 那一趟長大了，
     回到 100% 之後內容確實比視窗高，縮到看得完才是對的。
     真正要擋的是「來回一趟就少一截」的累積損失。 */
  const kBack = padScale(id);
  document.documentElement.style.setProperty('--fs', realFs || '1');
  if (typeof syncPads === 'function') syncPads();
  if (Math.abs(padScale(id) - kBack) > 0.001)
    fails.push('同一個字級量兩次，縮放因子不一樣（' + kBack.toFixed(3) + ' vs ' + padScale(id).toFixed(3) + '）');
  rows.push({step:'字級掃一圈之後', aspect:+aspect().toFixed(3), 在畫布內:inside(), k:+kBack.toFixed(3),
             盒子:PADS[id].w0 + '×' + PADS[id].h0});

  /* 模擬平板轉向來回三次：假裝這些字是在一塊比較寬的板子上寫的，再改回來。
     舊的做法（就地乘 k）在這裡會累積到只剩 39%。
     現在座標不動，所以要驗的是「第一次來回之後就進入不動點」——
     第 2、3 次的 k 與盒子都不可以再變。 */
  const seen = [];
  for (let i = 0; i < 3; i++){
    PADS[id].w0 = w0 * 1.4;                       // 橫 → 直
    if (typeof syncPads === 'function') syncPads();
    checkFrozen('轉向第 ' + (i + 1) + ' 次（變窄）');
    PADS[id].w0 = w0;                             // 直 → 橫
    if (typeof syncPads === 'function') syncPads();
    checkFrozen('轉向第 ' + (i + 1) + ' 次（還原）');
    seen.push({k:+padScale(id).toFixed(4), w0:PADS[id].w0, h0:PADS[id].h0});
  }
  rows.push({step:'轉向來回三次', aspect:+aspect().toFixed(3), 在畫布內:inside(),
             k:seen.map(function(x){ return x.k; }).join(' → ')});
  if (seen[1].k !== seen[2].k || seen[1].w0 !== seen[2].w0 || seen[1].h0 !== seen[2].h0)
    fails.push('轉向來回沒有收斂：第 2 次 k=' + seen[1].k + '、第 3 次 k=' + seen[2].k +
      '（座標不動的話，第一次來回之後就該進入不動點）');
  if (Math.abs(aspect() - base) > 0.001)
    fails.push('轉向來回三次之後長寬比變成 ' + aspect().toFixed(3) + '，起始是 ' + base.toFixed(3));

  /* 真的用指標事件寫一筆。at() 是新座標換算唯一發生的地方，而這一支原本
     從頭到尾直接把 strokes 陣列塞進 PADS——覆蓋率是零。
     在放大的板子上寫到最下緣，座標必須仍然落在書寫座標系裡，
     交出去的 viewBox 也要涵蓋它（這正是覆核抓到的 blocker 的形狀）。 */
  function penStroke(fromFrac, toFrac){
    const r = cv.getBoundingClientRect();
    function ev(type, fx, fy){
      const e = new PointerEvent(type, {bubbles:true, pointerId:99, pointerType:'mouse',
        clientX: r.left + r.width * fx, clientY: r.top + r.height * fy});
      cv.dispatchEvent(e);
    }
    ev('pointerdown', fromFrac[0], fromFrac[1]);
    ev('pointermove', (fromFrac[0] + toFrac[0]) / 2, (fromFrac[1] + toFrac[1]) / 2);
    ev('pointermove', toFrac[0], toFrac[1]);
    ev('pointerup', toFrac[0], toFrac[1]);
  }
  ['1', '1.75'].forEach(function(fs){
    document.documentElement.style.setProperty('--fs', fs);
    if (typeof syncPads === 'function') syncPads();
    const before = PADS[id].strokes.length;
    penStroke([0.05, 0.90], [0.95, 0.99]);      // 貼著最下緣寫一筆
    if (PADS[id].strokes.length === before){
      fails.push('字級 ' + fs + '：用指標事件寫不出筆畫（at() 沒有被走到）');
    } else {
      if (!inside()) fails.push('字級 ' + fs + '：貼著下緣寫的筆畫落在書寫座標系之外');
      if (!payloadCovers()) fails.push('字級 ' + fs + '：交出去的 viewBox 裁掉了剛寫的筆畫');
    }
  });
  document.documentElement.style.setProperty('--fs', realFs || '1');
  if (typeof syncPads === 'function') syncPads();
  if (!inside()) fails.push('回到 100% 之後，剛才寫的筆畫落在書寫座標系之外');
  if (!payloadCovers()) fails.push('回到 100% 之後，交出去的 viewBox 裁掉了筆畫');

  const pay = padPayload(id);
  if (!pay) fails.push('padPayload 在有筆畫時回傳 null');
  else {
    if (pay.w < PADS[id].w0 || pay.h < PADS[id].h0)
      fails.push('padPayload 的 viewBox（' + pay.w + '×' + pay.h + '）小於書寫座標系（' +
        PADS[id].w0 + '×' + PADS[id].h0 + '）');
    const flat = JSON.stringify(pay.lines[0].pts);
    if (flat !== JSON.stringify(PADS[id].strokes[0].pts))
      fails.push('padPayload 的座標與 PADS 裡的不一致');
  }

  if (typeof clearPads === 'function') clearPads();
  if (had) state.submissions.push({aid:'a-post', sid:sid, at:Date.now()});
  state.ui.role = realRole; renderShell();
  location.hash = realHash || '#/teacher'; render();
  const r = {pass: fails.length === 0, fails: fails, rows: rows};
  console.log('[assertPadAspect]', r);
  return r;
};

/* ==========================================================================
   兩件會被字級與路由默默吃掉的事
   (1) 量尺標籤是每一格裡唯一承載方向語意的文字，而它原本是全站最小的字
       （0.6rem，根字級 20px 時只有 12px），連不帶方向資訊、已經 aria-hidden
       的數字都比它大。96 位四到六年級受試者要靠它分辨六個相鄰選項，
       而這份問卷產出全部自陳依變項與中介變項。
   (2) 18 條路由原本共用「KAIROS」一個 document.title，換頁時焦點落在一個
       沒有可及名稱的 <main>——報讀器只播報「主要地標」，而好幾條路徑會在
       孩子不知情的情況下換掉目的地（WCAG 2.4.2 A 級）。
   console 一行：assertA11yCopy()
   ========================================================================== */
window.assertA11yCopy = function(){
  const fails = [];
  const realRole = state.ui.role, realHash = location.hash;
  const realFs = document.documentElement.style.getPropertyValue('--fs');

  /* (1) 量尺標籤不得小於題幹的 0.7 倍，四個字級都要成立 */
  const k = state.classes.find(function(c){ return c.condition === 'tutor'; }) || state.classes[0];
  const sid = k.studentIds[0];
  const hadSub = submitted('a-post', sid);
  if (!hadSub) state.submissions.push({aid:'a-post', sid:sid, at:Date.now(), _a11yTmp:true});
  const keptSurvey = (state.surveys || []).filter(function(s){ return s.sid === sid && s.phase === 'post'; });
  state.surveys = (state.surveys || []).filter(function(s){ return !(s.sid === sid && s.phase === 'post'); });
  state.ui.role = sid; renderShell();
  SURVEY = null; location.hash = '#/survey/post/1'; render();

  const ratios = {};
  ['1', '1.25', '1.5', '1.75'].forEach(function(fs){
    document.documentElement.style.setProperty('--fs', fs);
    const t = document.querySelector('#view .lk-t');
    const q = document.querySelector('#view .likert .q');
    if (!t || !q){ fails.push('字級 ' + fs + '：找不到量尺標籤或題幹'); return; }
    const r = parseFloat(getComputedStyle(t).fontSize) / parseFloat(getComputedStyle(q).fontSize);
    ratios[fs] = +r.toFixed(2);
    if (r < 0.7) fails.push('字級 ' + fs + '：量尺標籤只有題幹的 ' + r.toFixed(2) + ' 倍（下限 0.70）');
  });
  document.documentElement.style.setProperty('--fs', realFs || '1');
  if (!document.querySelectorAll('#view .scale-lab').length)
    fails.push('量尺底下沒有印出兩端錨點（.scale-lab）');

  /* (2) 每一條路由都要有自己的標題，而且不可以只是「KAIROS」 */
  const titles = {};
  const ROUTES = ['#/student', '#/quiz/a-pre', '#/aal/a-post', '#/survey/pre/1',
                  '#/survey/post/1', '#/result/a-pre', '#/mygrowth', '#/kb', '#/about'];
  ROUTES.forEach(function(h){
    location.hash = h; render();
    const t = document.title;
    titles[h] = t;
    if (!t || t === 'KAIROS') fails.push(h + '：標題還是「KAIROS」');
    const stage = document.getElementById('stage');
    if (stage && !stage.getAttribute('aria-label')) fails.push(h + '：#stage 沒有可及名稱');
  });
  /* 標題要等於「畫面上真正那一頁」，不是等於網址列打的那一條。
     不能改成比對九條路由兩兩不同：交過卷的學生走 #/quiz/a-pre 與
     #/aal/a-post 都會被 rerouteInRender 轉去成績頁，三條路由同時顯示
     〈我的成績〉是對的行為——而那正是這一條要保住的東西，因為那種
     轉向產生的訊號原本與正常抵達完全相同。 */
  ROUTES.forEach(function(h){
    location.hash = h; render();
    const want = pageTitleFor(ROUTE) + '｜KAIROS';
    if (document.title !== want)
      fails.push(h + '：標題是「' + document.title + '」，但畫面上是「' + want + '」');
  });

  state.surveys = (state.surveys || []).concat(keptSurvey);
  if (!hadSub) state.submissions = state.submissions.filter(function(s){ return !s._a11yTmp; });
  state.ui.role = realRole; renderShell();
  location.hash = realHash || '#/teacher'; render();
  const r = {pass: fails.length === 0, fails: fails, 標籤比例: ratios, 標題: titles};
  console.log('[assertA11yCopy]', r);
  return r;
};

/* ==========================================================================
   兩個分頁交同一份卷
   作答中的分頁因 measuringNow()==='aal' 永遠不同步外部更新，所以它的
   state.submissions 對「另一個分頁剛剛交了卷」是瞎的——而 aalSubmitCommit
   的 filter+push 是唯一會覆寫紀錄的地方。孩子開兩個分頁做同一份後測、
   或做完之後回頭把另一個還開著的分頁「順手交掉」，先交的完整作答就會被
   停在第 3 題的那個分頁覆蓋成 13 題 null，而畫面兩次都說「已交卷」。
   同一支檔案的 surveySubmitCommit 早就寫了「第二道門」的註解，但它讀的是
   記憶體裡的 surveyOf()——舊分頁正好沒有那筆紀錄，對它宣稱要擋的情境恆為
   不成立。兩道門現在都改問磁碟。
   順帶驗第三件事：施測中的分頁不可以把自己的 ui 寫回磁碟（老師換人之後，
   舊分頁一落地就會把身分寫回上一位）。
   console 一行：assertDoubleSubmit()
   ========================================================================== */
window.assertDoubleSubmit = function(){
  const realRole = state.ui.role, realHash = location.hash;
  const fails = [];
  state = buildSeedState(); save();
  AAL = null; SURVEY = null; QUIZ = null;

  const sid = state.classes[0].studentIds[0];
  const other = state.classes[3].studentIds[0];

  /* 分頁 B：先讓這一頁在「還沒交」的乾淨狀態下開起來、寫個半份、存草稿。
     不要靠「記憶體與磁碟不一致」當前置條件——save() 走不走合併分支要看
     STATE_REV，前面跑過什麼會改變它，那樣寫出來的斷言跟執行順序綁在一起。 */
  const a = getAssignment('a-post');
  const items = a.itemIds.map(getItem).filter(Boolean);
  state.responses = state.responses.filter(function(r){ return !(r.aid === 'a-post' && r.sid === sid); });
  state.submissions = state.submissions.filter(function(s){ return !(s.aid === 'a-post' && s.sid === sid); });
  save();
  state.ui.role = sid; state.ui.impersonate = null; renderShell();
  location.hash = '#/aal/a-post'; render();
  if (!AAL){ const r = {pass:false, fails:['開不到作答頁']}; console.log('[assertDoubleSubmit]', r); return r; }
  AAL.items.forEach(function(it, i){
    if (i < 3){ if (it.type === 'cr') AAL.texts[it.id] = '分頁B的半份'; else AAL.answers[it.id] = 1; }
  });
  aalSave();                 // 真的用過的分頁一定有草稿——救援材料要從這裡來

  /* 分頁 A：在這一頁開著的時候，另一個分頁交出了一份完整的後測。
     直接寫磁碟才是真的——作答中的分頁本來就不會同步這個更新。 */
  let beforeN = 0, beforeTxt = '';
  try {
    const d = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
    d.responses = (d.responses || []).filter(function(r){ return !(r.aid === 'a-post' && r.sid === sid); });
    items.forEach(function(it, i){
      d.responses.push(it.type === 'cr'
        ? {aid:'a-post', sid:sid, iid:it.id, text:'分頁A的完整作答' + i, strokes:null, score:null, comment:'', correct:null}
        : {aid:'a-post', sid:sid, iid:it.id, choice:0, correct:0 === it.answer});
    });
    d.submissions = (d.submissions || []).filter(function(s){ return !(s.aid === 'a-post' && s.sid === sid); });
    d.submissions.push({aid:'a-post', sid:sid, at:Date.now()});
    d.rev = (d.rev || 0) + 1; d.writer = 'tab-other';
    localStorage.setItem(STORE_KEY, JSON.stringify(d));
    beforeN = d.responses.filter(function(r){ return r.aid === 'a-post' && r.sid === sid; }).length;
    beforeTxt = (d.responses.find(function(r){ return r.aid === 'a-post' && r.sid === sid && r.iid === 'C01'; }) || {}).text;
  } catch (e) { fails.push('前置條件寫不進 localStorage：' + (e && e.message)); }

  aalSubmitCommit();
  closeModal();

  /* 磁碟上那一份必須原封不動 */
  let disk = {};
  try { disk = JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); } catch (e) {}
  const afterN = (disk.responses || []).filter(function(r){ return r.aid === 'a-post' && r.sid === sid; }).length;
  const afterTxt = ((disk.responses || []).find(function(r){ return r.aid === 'a-post' && r.sid === sid && r.iid === 'C01'; }) || {}).text;
  if (afterN !== beforeN) fails.push('磁碟上的作答從 ' + beforeN + ' 筆變成 ' + afterN + ' 筆');
  if (afterTxt !== beforeTxt) fails.push('磁碟上的非選作答被舊分頁蓋掉了（現在是「' + afterTxt + '」）');
  if (!(disk.submissions || []).some(function(s){ return s.aid === 'a-post' && s.sid === sid; }))
    fails.push('磁碟上的交卷紀錄不見了');
  if (AAL) fails.push('被擋下之後 AAL 沒有被釋放');
  /* 草稿要留著——那是唯一的救援材料 */
  let drafts = {};
  try { drafts = JSON.parse(localStorage.getItem(AAL_DRAFT_KEY) || '{}'); } catch (e) {}
  if (!drafts['a-post|' + sid]) fails.push('被擋下之後草稿被丟掉了（那是唯一還留著的救援材料）');

  /* 施測中的分頁不可以把自己的 ui 寫回磁碟 */
  state = buildSeedState(); save();
  AAL = null;
  state.ui.role = sid; renderShell();
  state.submissions = state.submissions.filter(function(s){ return !(s.aid === 'a-post' && s.sid === sid); });
  save();
  location.hash = '#/aal/a-post'; render();
  /* 老師在另一個分頁換成下一位（直接寫磁碟） */
  try {
    const d = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
    d.ui = Object.assign({}, d.ui, {role: other});
    d.rev = (d.rev || 0) + 1; d.writer = 'tab-teacher';
    localStorage.setItem(STORE_KEY, JSON.stringify(d));
  } catch (e) {}
  /* 舊的作答分頁再落地一次（關掉分頁時必然發生） */
  save();
  try {
    const d2 = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
    if (d2.ui && d2.ui.role !== other)
      fails.push('施測中的分頁把身分寫回磁碟了（現在是 ' + d2.ui.role + '，應該還是 ' + other + '）');
  } catch (e) {}
  /* 反方向同樣要擋。這一條原本沒驗，於是 P1 把 `out.ui = state.ui` 改成
     「施測中不寫」時全綠——而那一改讓 save() 的合併分支（state = mergeOntoDisk(disk)）
     把磁碟的 ui 吃進記憶體：孩子這一頁只要有任何一筆日誌就翻面，
     下一次 render 走到 AAL.me !== me.id 就重跑 aalInit，
     這一場的作答、標記、遙測全部被換人重建，AAL.cond 跟著翻面。 */
  if (state.ui.role !== sid)
    fails.push('施測中的分頁把磁碟的身分吃進記憶體了（state.ui.role 變成 ' + state.ui.role + '）');
  if (AAL && AAL.me !== sid)
    fails.push('施測中的 AAL 被換人了（AAL.me 變成 ' + AAL.me + '）');
  /* 再落地一次也要穩定（不可以一次比一次更歪） */
  save();
  if (state.ui.role !== sid) fails.push('第二次落地之後身分還是被換走了');

  state = buildSeedState(); save();
  AAL = null; SURVEY = null; QUIZ = null;
  state.ui.role = realRole; renderShell();
  location.hash = realHash || '#/teacher'; render();
  const r = {pass: fails.length === 0, fails: fails};
  console.log('[assertDoubleSubmit]', r);
  return r;
};

/* ==========================================================================
   答案還沒打開的時候，成績頁不可以逐題揭露對錯
   三道班級層級的鎖（classKeyReleased、kbLocked 第三道門、a-pre 診斷門）
   都是為同一個情境寫的：同教室二十幾人正在同一份題本上作答，
   而教室裡的平板螢幕是公開的。孩子記得自己每一題選了什麼，
   「第 8 題 答對」＝正解、「答錯」＝刪掉一個選項。
   第 9 輪 P1 只擋了那顆逐題 pill，而同一頁上閱讀地圖把題號印在每顆圓點上、
   x 軸兩欄就是「答錯」與「答對」、<title> 寫「第 8 題 · 你穩穩答對」、
   <desc> 把「可惜的題目：第 8 題、第 12 題」念給報讀器，下面還用 <li>
   逐條列出所有第二象限的題號與題幹——三個出口只修了最不顯眼的一個。
   聚合分數（「選擇題答對 12 / 16」）刻意保留：它不指出是哪幾題，
   而這一頁本來就叫「我的成績」。
   console 一行：assertKeyLock()
   ========================================================================== */
window.assertKeyLock = function(){
  const realRole = state.ui.role, realHash = location.hash;
  const fails = [];
  state = buildSeedState(); save();
  AAL = null; SURVEY = null; QUIZ = null;

  const k = state.classes.find(function(c){ return c.condition === 'tutor'; }) || state.classes[0];
  const sid = k.studentIds[0];
  /* 讓 classKeyReleased 為假：同班有人還沒交、沒到期、教師開關沒開 */
  state.settings.keyReleased = {};
  const a = getAssignment('a-post');
  if (a){ a.due = Date.now() + 86400000; a.dueSet = true; }
  k.studentIds.slice(1, 3).forEach(function(x){
    state.submissions = state.submissions.filter(function(s){ return !(s.aid === 'a-post' && s.sid === x); });
  });
  if (!(state.surveys || []).some(function(s){ return s.sid === sid && s.phase === 'post'; }))
    state.surveys.push({sid:sid, phase:'post', at:Date.now(), resp:{}});
  state.ui.role = sid; renderShell();

  function look(){
    location.hash = '#/result/a-post'; render();
    const v = document.getElementById('view');
    return {text: v.innerText, html: v.innerHTML,
            map: !!v.querySelector('svg.kidmap'),
            pills: (v.innerText.match(/已作答/g) || []).length};
  }

  if (keyUnlocked('a-post', sid)) fails.push('前置條件不成立：答案卡沒有鎖住');
  const locked = look();
  /* 逐題的三個出口都要閉嘴 */
  if (locked.map) fails.push('鎖著的時候還畫出閱讀地圖（圓點帶題號、x 軸就是答對／答錯）');
  if (/穩穩答對|你其實讀得懂|可惜的題目：/.test(locked.text))
    fails.push('鎖著的時候還印出象限標籤或可惜的題目清單');
  if (/題很可惜|題你很厲害/.test(locked.text))
    fails.push('鎖著的時候還逐條列出第一／第二象限的題號');
  if (!locked.pills) fails.push('鎖著的時候逐題沒有改成中性的「已作答」');
  /* 逐行掃：除了聚合分數與說明文字，不可以有任何「答對／答錯」 */
  const leaky = locked.text.split('\n').filter(function(l){
    return /答對|答錯/.test(l) && !/^選擇題答對$/.test(l.trim()) && !/閱讀地圖要等答案打開/.test(l);
  });
  if (leaky.length) fails.push('鎖著的時候仍然出現逐題對錯：' + leaky.slice(0, 3).join(' ／ '));
  /* 報讀器那一條路也要一起（kidmapSVG 的 <desc>） */
  if (/可惜的題目：/.test(locked.html)) fails.push('鎖著的時候 <desc> 仍然把可惜的題目念出來');

  /* 打開之後要真的變回去 */
  state.settings.keyReleased = {'a-post': true};
  const open = look();
  if (!open.map) fails.push('答案卡打開之後閱讀地圖沒有回來');
  if (!/答對/.test(open.text)) fails.push('答案卡打開之後逐題狀態沒有回來');

  state = buildSeedState(); save();
  state.ui.role = realRole; renderShell();
  location.hash = realHash || '#/teacher'; render();
  const r = {pass: fails.length === 0, fails: fails};
  console.log('[assertKeyLock]', r);
  return r;
};
