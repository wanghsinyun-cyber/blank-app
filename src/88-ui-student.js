/* ==========================================================================
   88-ui-student.js — 學生端：作業、作答（含手寫）、個人診斷、相似題練習
   ========================================================================== */

let QUIZ = null;    // {aid, answers:{iid:choice}, texts:{iid:string}, strokes:{iid:[]}}

/* 前測草稿。原本前測完全沒有草稿——QUIZ 只是記憶體變數，quiz-pick 與
   quiz-text 只寫進它，全庫沒有任何 localStorage 寫入點。平板一沒電，
   16 題的選項、兩題非選的文字與筆跡同時歸零；而作業卡的「寫到一半」提示
   被 (!done && a.aal) 擋在後測專用，於是重開之後那張卡印的是「尚未作答」、
   按鈕是「開始作答 →」——同一個孩子、同一台平板、同一種故障，後測救得回來、
   前測整份消失，而且畫面主動告訴他「什麼都沒有」。
   前測 θ 是 ANCOVA 的共變數與 Rasch 校準的來源，缺答一律寫成 null 不進
   Rasch，全站沒有補交路徑；一節課只有 40 分鐘，重寫一次量到的是疲勞與
   時間壓力。做法與 AAL 草稿完全一致（獨立的 key，不擠進 save()）。 */
const QUIZ_DRAFT_KEY = 'kairos-quiz-draft';

function quizDraftOf(aid, sid){
  try {
    const all = JSON.parse(localStorage.getItem(QUIZ_DRAFT_KEY) || '{}');
    return all[aid + '|' + sid] || null;
  } catch (e) { return null; }
}
/* 草稿裡已經作答幾題（選擇題有選 + 非選有字或有手寫） */
function quizDraftProgress(aid, sid){
  const d = quizDraftOf(aid, sid);
  if (!d) return 0;
  const a = getAssignment(aid);
  if (!a) return 0;
  return a.itemIds.map(getItem).filter(Boolean).filter(function(i){
    if (i.type === 'cr'){
      if (String((d.texts || {})[i.id] || '').trim()) return true;
      const sp = (d.strokes || {})[i.id];
      const lines = Array.isArray(sp) ? sp : (sp && sp.lines);
      return !!(lines && lines.length);
    }
    return (d.answers || {})[i.id] !== undefined && (d.answers || {})[i.id] !== null;
  }).length;
}
function quizSave(){
  if (isImpersonating()) return;
  if (!QUIZ) return;
  const me = currentUser();
  try {
    const all = JSON.parse(localStorage.getItem(QUIZ_DRAFT_KEY) || '{}');
    const strokes = {};
    (getAssignment(QUIZ.aid) || {itemIds:[]}).itemIds.map(getItem).filter(Boolean)
      .forEach(function(i){ if (i.type === 'cr'){ const p = padPayload(i.id); if (p) strokes[i.id] = p; } });
    /* 理由同 aalSave：兩個分頁會把對方寫過的題洗掉。 */
    const qk = QUIZ.aid + '|' + me.id;
    const merged = mergeDraftMaps(all[qk] || {},
      {answers:QUIZ.answers, texts:QUIZ.texts, strokes:strokes},
      ['answers','texts','strokes']);
    merged.savedAt = Date.now();
    all[qk] = merged;
    localStorage.setItem(QUIZ_DRAFT_KEY, JSON.stringify(all));
    QUIZ.dirty = false;
  } catch (e) {
    QUIZ.dirty = true;
    /* 與 aalSave 相同：連續兩次失敗就常駐警示，不要只 toast 一次。 */
    quizSave._fails = (quizSave._fails || 0) + 1;
    if (quizSave._fails >= 2){
      const b = document.getElementById('quizSaveWarn');
      if (b) b.hidden = false;
    }
    toast('這一題沒能存起來，先不要關掉分頁。');
  }
}
/* 打字每一鍵都寫 localStorage 會拖慢輸入，而作答速度本身是遙測變項；
   去抖 600ms，離開作答頁時由 render() 那一支結清。 */
function quizSaveSoon(){
  clearTimeout(quizSaveSoon._t);
  quizSaveSoon._t = setTimeout(function(){ if (QUIZ) quizSave(); }, 600);
}
function quizSaveFlush(){
  clearTimeout(quizSaveSoon._t);
  if (QUIZ) quizSave();
}
function quizDraftDrop(aid, sid){
  try {
    const all = JSON.parse(localStorage.getItem(QUIZ_DRAFT_KEY) || '{}');
    delete all[aid + '|' + sid];
    localStorage.setItem(QUIZ_DRAFT_KEY, JSON.stringify(all));
  } catch (e) {}
}

function viewStudent(){
  const me = currentUser();
  const k = classOfStudent(me.id);
  const inClass = !!k;
  if (!inClass) return '<div class="empty"><h3>這個帳號不在示範班級裡</h3>' +
    '<p>請用右上角的身分選單切換成班上的學生。</p></div>';
  const asgs = state.assignments.slice().sort(function(a, b){ return b.createdAt - a.createdAt; });
  /* 同上：消費端也要依班 */
  const myNotes = notesForViewer().filter(function(n){ return n.authorIds.indexOf(me.id) >= 0; }).length;
  const unread = notesForViewer().filter(isUnread).length;

  const cond = condition(k.condition);
  /* 課上完之後就不要再邀請他去補填課前問卷（見 surveyGate 的說明）——
     那是 ANCOVA 的共變數基線，事後補填量到的是處遇後的狀態。
     卡片仍然出現（老師需要知道誰漏填了），但改成中性敘述、不再是可點的主要動作。 */
  const preMissing = !surveyOf(me.id, 'pre');
  const preTooLate = preMissing && submitted('a-post', me.id);
  const needPre = preMissing;
  return sectionHead('我的作業', me.name + '　·　' + k.name) +
    (cond.id !== 'control'
      ? '<div class="card card-p" style="margin-bottom:16px;border-left:3px solid var(--' +
        (cond.cls ? cond.cls.replace('sc', 'sc-') : 'ink-4') + ')">' +
        '<div class="eyebrow">這節課陪你的夥伴</div>' +
        '<h3 style="margin-top:4px">' + esc(cond.name) + '</h3>' +
        '<p class="small cond-card-body" style="margin-top:6px">' + esc(cond.frame) + '</p>' +
        '<p class="muted small cond-card-foot">它不會告訴你答案，也不會說你對或錯。每一題最多可以跟它說 ' +
        ((state.settings && state.settings.maxTurns) || MAX_TURNS) + ' 次話。</p></div>'
      /* 四條件的卡片結構要逐項對位：同一條左邊框、eyebrow、h3、兩段 p。
         少一個 h3、少一條邊條，卡片高度就不同，底下的統計卡與作業清單
         起始位置也跟著不同——那是每個孩子每次登入的第一個畫面。
         不要用否定句定義對照組（「你這一班沒有…」等於告訴孩子他拿到的是
         缺角版本），也不要提到別班。正面描述他真正要做的事就好。 */
      : '<div class="card card-p" style="margin-bottom:16px;border-left:3px solid var(--ink-4)">' +
        '<div class="eyebrow">這節課的進行方式</div>' +
        '<h3 style="margin-top:4px">我的筆記</h3>' +
        '<p class="small cond-card-body" style="margin-top:6px">這節課你自己讀、自己想。' +
        '這一頁有一塊「我的筆記」，把想到的、卡住的地方寫下來。</p>' +
        '<p class="muted small cond-card-foot">你寫的字老師之後看得到，不會拿來打分數。' +
        '一題一頁，換題會換新的。</p></div>') +
    /* 「寫到一半」要說出來。原本兩張卡都只看送出紀錄，填了一半被叫走的
       孩子回來看到的是「還沒填」——而問卷頁自己承諾「填到哪裡會自動記住」。
       形狀與下面的作業卡一致（已寫 N / M 題、〈接著上次繼續〉）。 */
    (function(){
      const p = typeof surveyDraftProgress === 'function' ? surveyDraftProgress(me.id, 'pre') : null;
      if (!needPre) return '';
      return '<div class="card card-p" style="margin-bottom:16px;border-left:3px solid var(--warn)">' +
        '<div class="row" style="justify-content:space-between"><span class="small">' +
        (preTooLate ? '課前問卷沒有填到。這一份要在上課前填，現在先不用填，跟老師說一聲就好。'
          : p ? '課前問卷寫到一半　·　已填 ' + p.n + ' / ' + p.total + ' 題'
              : '還沒填課前問卷。') + '</span>' +
        (preTooLate ? '' : '<a class="btn sm primary" href="#/survey/pre">' +
          (p ? '接著上次繼續 →' : '去填課前問卷') + '</a>') +
        '</div></div>';
    })() +
    /* 側欄徽章在窄版看不見，這裡補一張結構相同的提醒卡。四條件都會出現。 */
    (function(){
      if (!(submitted('a-post', me.id) && !surveyOf(me.id, 'post'))) return '';
      const p = typeof surveyDraftProgress === 'function' ? surveyDraftProgress(me.id, 'post') : null;
      return '<div class="card card-p" style="margin-bottom:16px;border-left:3px solid var(--warn)">' +
        '<div class="row" style="justify-content:space-between"><span class="small">' +
        (p ? '這節課的問卷寫到一半　·　已填 ' + p.n + ' / ' + p.total + ' 題'
           : '這節課的問卷還沒填完。') + '</span>' +
        '<a class="btn sm primary" href="#/survey/post">' +
        (p ? '接著上次繼續 →' : '去填課後問卷') + '</a></div></div>';
    })() +
    /* 知識建構空間鎖著的時候，首頁不要用橘色卡片催他去一個進不去的地方。
       卡片數維持四張，只換內容與樣式。 */
    '<div class="grid g4" style="margin-bottom:16px">' +
      statCard('待作答', asgs.filter(function(a){ return !submitted(a.id, me.id); }).length, '') +
      statCard('已完成', asgs.filter(function(a){ return submitted(a.id, me.id); }).length, '') +
      /* 兩張卡都讀同一份字串表（50-kb.js 的 KB_LOCK_TEXT）。左邊那張原本
         不分原因一律寫「交完卷就可以繼續」——而 survey 與 class 兩種原因下，
         他十五分鐘前就交過卷了。 */
      (kbLocked(me)
        ? statCard('我貼的想法', myNotes, (kbLockLabel(me) || {}).hint || '交完卷就可以繼續') +
          statCard('知識建構空間',
            (kbLockLabel(me) || {}).badge || '測驗後開放',
            (kbLockLabel(me) || {}).line || '交完卷就會打開')
        : statCard('我貼的想法', myNotes, '在知識建構空間') +
          statCard('未讀貼文', unread, '同學的新想法', unread ? 'warn' : '')) +
    '</div>' +
    '<div class="col">' + asgs.map(function(a){
      const done = submitted(a.id, me.id);
      const n = a.itemIds.length;
      /* 前測也要有「寫到一半」。原本這一行把它擋在後測專用（a.aal），
         於是平板沒電重開之後，寫了十二題的孩子看到的是「尚未作答」與「開始作答」。 */
      const draftN = done ? 0 : (a.aal ? aalDraftProgress(a.id, me.id) : quizDraftProgress(a.id, me.id));
      /* 兩個不同的條件，不能共用一個旗標：
         postPending — 後測還沒交。此時前測那張卡若印「已完成 · 選擇題答對 12」
           並掛著〈看我這次讀得怎麼樣〉，等於在後測途中把同一份題本的
           逐題對錯遞給他（見 viewResult 的第三道門）。
         surveyPending — 後測交了但課後問卷還沒送出（績效回饋先於自陳依變項）。
         兩者都要藏分數，但「該按什麼」不一樣：前者要他先去把這節課做完，
         後者才是去填問卷。 */
      const postPending = !submitted('a-post', me.id);
      const surveyPending = !postPending && !surveyOf(me.id, 'post');
      const hideScore = postPending || surveyPending;
      const right = state.responses.filter(function(r){
        return r.aid === a.id && r.sid === me.id && r.correct === true; }).length;
      return '<div class="card"><div class="card-p"><div class="row" style="justify-content:space-between">' +
        '<div><h3>' + esc(a.title) + '</h3>' +
        '<div class="muted small">' + esc(a.desc || '') + '</div>' +
        '<div class="row small muted" style="margin-top:6px;gap:12px">' +
          '<span>' + n + ' 題</span>' +
          /* 沒有設定過就整格不印，不要印一個假日期。goLiveCommit 把 due 清成 null，
             而 fmtDate(null) 走 new Date(null) → 紀元：清場、正式施測開始之後，
             每個孩子的每一張作業卡都印「截止 1970-01-01」，就在「寫到一半」旁邊。
             一個已經落後的十歲孩子最合理的解讀是「我遲交了」，
             而焦慮與自我效能正是課後問卷要量的構念。 */
          (a.dueSet && a.due ? '<span>截止 ' + fmtDate(a.due) + '</span>' : '') +
          /* 三種狀態，不是兩種。原本只有「已完成／尚未作答」：
             鐘響、平板沒電、被叫走——寫到一半離開的孩子回來看到「尚未作答」，
             按鈕還寫著「開始這節課」，兩句都不是真的，而「開始」讀起來
             像要從頭來過。草稿一直都在 localStorage，只是首頁沒有講。 */
          /* 課後問卷還沒送出時，這張卡片本身就不能印分數——
             「已完成 · 選擇題答對 12」是一次績效回饋，而它就擺在
             「去填課後問卷」的旁邊（見 viewResult 的門檻說明）。 */
          (done ? (hideScore
                    ? '<span class="pill q1"><span class="dot"></span>已完成</span>'
                    : '<span class="pill q1"><span class="dot"></span>已完成 · 選擇題答對 ' + right + '</span>')
                : draftN ? '<span class="pill q4"><span class="dot"></span>寫到一半 · 已寫 ' + draftN + ' / ' + n + ' 題</span>'
                : '<span class="pill">尚未作答</span>') +
        '</div></div>' +
        /* 示範資料把 96 人的後測都交完了，於是沒有任何一條路徑走得到作答頁。
           示範模式下補一顆「再走一次」，讓人看得到這套流程長什麼樣子；
           正式施測時 demoSeed 為 false，這顆鈕不會出現。 */
        '<div class="row">' + (done
          ? (postPending
              ? ''   /* 後測還沒交：這張卡不提供任何通往結果的入口 */
              : surveyPending
                ? '<a class="btn primary" href="#/survey/post">去填課後問卷 →</a>'
                : '<a class="btn" href="#/result/' + a.id + '">看我這次讀得怎麼樣</a>') +
            (state.demoSeed !== false && a.aal && !isImpersonating()
              ? ' <button class="btn sm" data-act="redo-demo" data-id="' + a.id +
                '">再走一次（示範）</button>' : '')
          : (entryGate(a.id, me.id)
              /* 前置沒完成時不要給一顆跟《去填課前問卷》長得一模一樣的主要按鈕，
                 這兩顆就在同一張畫面上，而按錯的代價是永久的。 */
              ? '<span class="muted small">' + (surveyOf(me.id, 'pre') ? '要先做前面那一份' : '要先填課前問卷') + '</span>'
              : '<a class="btn primary" href="#/' + (a.aal ? 'aal' : 'quiz') + '/' + a.id + '">' +
                (draftN ? '接著上次繼續 →' : (a.aal ? '開始這節課 →' : '開始作答 →')) + '</a>')) + '</div>' +
        '</div></div></div>';
    }).join('') + '</div>' +
    '<div class="card" style="margin-top:16px"><div class="card-p">' +
    '<h4>作答之後會發生什麼</h4>' +
    '<p class="small" style="margin-top:6px;max-width:70ch">系統會用所有做過這份題目的同學（四個班一起）估出每題的難度與你的能力，' +
    '把「你本來應該答得出來卻答錯」的題目標出來。這些題目不會只變成一個紅色叉叉——' +
    '系統會把它整理出來變成全班的共同問題，貼到知識建構空間，讓大家一起把它想清楚。</p></div></div>';
}

/* 一份派題的前置條件還沒完成時要擋下來，並回傳一張說明卡。
   回傳空字串代表可以進去。條件用 assignment.linkedTo 推導，不寫死 'a-pre'。
   兩個門檻的理由分別寫在 viewAaL 與 viewQuiz 的呼叫點。 */
function entryGate(aid, sid){
  const a = getAssignment(aid);
  if (!a) return '';
  const needSurvey = !surveyOf(sid, 'pre');
  const prev = a.linkedTo ? getAssignment(a.linkedTo) : null;
  const needPrev = !!(prev && !submitted(prev.id, sid));
  if (!needSurvey && !needPrev) return '';
  return '<div class="empty"><h3>先完成前面這一步</h3>' +
    '<p style="max-width:60ch">' +
    (needSurvey ? '課前問卷要在上課前填，它問的是你「現在」的感覺；上完課就填不到了。'
                : '這一節要接在前面那一份測驗後面。') + '</p>' +
    '<div class="row" style="justify-content:center;margin-top:12px">' +
    (needSurvey ? '<a class="btn primary" href="#/survey/pre">去填課前問卷</a>' : '') +
    (needPrev ? '<a class="btn' + (needSurvey ? '' : ' primary') + '" href="#/' +
                (prev.aal ? 'aal' : 'quiz') + '/' + prev.id + '">去做' + esc(prev.title) + '</a>' : '') +
    '<a class="btn" href="#/student">回我的作業</a>' +
    '</div></div>';
}

/* 「交過卷」——純存在檢查。流程與統計用這個就夠了。 */
function submitted(aid, sid){
  return state.submissions.some(function(s){ return s.aid === aid && s.sid === sid; });
}

/* 這份派題他實際作答了幾題（選擇題有選、建構反應題有寫）。
   手寫也算：不算的話，只用手寫作答的孩子在 keyUnlocked 的「實際作答比例」
   門檻上永遠達不到，成績頁與答案卡對他一直是鎖著的——而他其實整份都寫完了。 */
function answeredCount(aid, sid){
  return state.responses.filter(function(r){
    return r.aid === aid && r.sid === sid &&
           (r.choice != null || (r.text && String(r.text).trim()) || respHasInk(r));
  }).length;
}

/* 已落地的那一筆作答裡有沒有手寫。相容兩種格式：新的 {w,h,lines}
   與早期直接存陣列的。 */
function respHasInk(r){
  const sp = r && r.strokes;
  if (!sp) return false;
  if (Array.isArray(sp)) return sp.length > 0;
  return !!(sp.lines && sp.lines.length);
}

/* 可以打開答案卡了嗎。
   `submitted()` 是純存在檢查——只要有一筆 submission，即使 0 題作答，
   前測與後測的完整正解都會攤開。而前後測是同一份題本、教室裡的平板螢幕
   是公開的，所以這是測驗安全問題，不是體驗問題。
   門檻用「實際作答比例」而不是「有沒有那一筆紀錄」。 */
function keyUnlocked(aid, sid){
  const a = getAssignment(aid);
  if (!a) return false;
  if (!submitted(aid, sid)) return false;
  const total = a.itemIds.length;
  if (!total) return false;
  const ratio = (state.settings && state.settings.keyUnlockRatio != null)
    ? state.settings.keyUnlockRatio : 0.5;
  if (answeredCount(aid, sid) / total < ratio) return false;
  return classKeyReleased(aid, sid);
}

/* 答案卡的班級層級釋出條件。
   原本只看學生自己：第一個交卷的孩子按下按鈕的當下，同教室還有 23 人
   在同一份題本上作答，而他接下來十分鐘沒事做、螢幕朝著旁邊。
   函式上方的註解自己寫著「教室裡的平板螢幕是公開的」，但實作只擋住
   「0 題作答」那一種情形。洩題方向是先做完的流向還在做的，
   會讓 θ 與班級（＝條件）綁在一起。
   規則：同班每一位都交了才開。有人缺席就永遠開不了，所以再給一個
   不需要人工介入的出口——過了這份派題的截止時間也開。
   （跨班仍共用同一份題本，四個班若不同天施測，班與班之間的口耳相傳
     不是軟體擋得住的；這裡守的是同一間教室裡的當下。） */
function classKeyReleased(aid, sid){
  const a = getAssignment(aid);
  if (!a) return false;
  /* 教師明確按下的釋出開關。這是**在分開的裝置上唯一真的會成立**的那條路——
     見下面 every() 的說明。 */
  const rel = (state.settings && state.settings.keyReleased) || {};
  if (rel[aid] === true) return true;
  /* 截止時間只有在教師真的設定過時才算數。
     原本寫成 `a.due && Date.now() > a.due`，而示範資料的 due 是
     buildSeedState 在「這台裝置第一次載入那天」＋3 天算出來、之後凍在
     localStorage，go-live 也沒有重設它——裝機或彩排若在後測日的三天前，
     這個條件恆為真：第一個交卷的孩子一進逐題檢視就拿到全部 14 題的正解。
     實際唯一生效的那條路是示範資料的副產品，不是任何人設定過的施測時程。
     a-pre 的 due 更是恆為過去（now − 9 天）。 */
  if (a.dueSet && a.due && Date.now() > a.due) return true;
  const k = classOfStudent(sid);
  if (!k || !k.studentIds || !k.studentIds.length) return true;
  /* 「同班都交完才開」是使用者選定的自動釋出規則，在單機／共用狀態下成立
     （示範資料、以及所有人用同一個瀏覽器的情境）。
     但正式施測是每個孩子一台平板、而這個平台沒有伺服器——
     每台裝置的 state.submissions 只有自己那一筆，這個條件永遠不會成立。
     所以它保留為自動路徑，真正在教室裡生效的是上面那顆教師開關；
     等待文案也必須講得出這件事，不能承諾一個架構上不可能達成的條件。 */
  return k.studentIds.every(function(x){ return submitted(aid, x); });
}
/* 還沒開的話，是差在誰身上——文案要講得出真正的條件 */
function classKeyPending(aid, sid){
  const k = classOfStudent(sid);
  if (!k) return 0;
  return k.studentIds.filter(function(x){ return !submitted(aid, x); }).length;
}

/* --- 作答 --- */
function viewQuiz(aid){
  const a = getAssignment(aid);
  const me = currentUser();
  if (!a) return '<div class="empty"><h3>找不到這份作業</h3><a class="btn" href="#/student">回我的作業</a></div>';
  /* 交完卷再走回作答頁：轉去成績頁，而且要用 rerouteInRender()。
     為什麼不能用 go() 或 replaceHash()，見該函式上方的註解。 */
  if (submitted(aid, me.id)){
    rerouteInRender('#/result/' + aid);
    return viewResult(aid);
  }
  /* 前置門檻，理由與 viewAaL 相同：課前問卷一旦錯過就補不回來。 */
  const gate = entryGate(aid, me.id);
  if (gate) return gate;
  /* 進來時先把草稿接回來。沒接的話，重載＝整份歸零（見 QUIZ_DRAFT_KEY）。 */
  /* 還要比對學生。原本只比 aid，而 QUIZ 是模組層全域：
     換人之後（或跨分頁同步把身分換掉之後），下一個孩子打開同一份前測，
     條件 QUIZ.aid !== aid 不成立，上一個孩子的答案整份留在畫面上，
     交卷時就成了他的作答。AAL 那一支早就比了 AAL.me。 */
  if (!QUIZ || QUIZ.aid !== aid || QUIZ.sid !== me.id){
    QUIZ = {aid:aid, sid:me.id, answers:{}, texts:{}, strokes:{}};
    const d = quizDraftOf(aid, me.id);
    if (d){
      QUIZ.answers = d.answers || {};
      QUIZ.texts   = d.texts   || {};
      /* 手寫要放回 PADS，畫布還沒建出來也沒關係：initPads 會沿用既有的
         PADS[id]，它的 size() 會依當時寬度換算座標再重畫。 */
      Object.keys(d.strokes || {}).forEach(function(iid){
        const sp = d.strokes[iid];
        const lines = Array.isArray(sp) ? sp : (sp && sp.lines);
        if (!lines || !lines.length) return;
        PADS[iid] = PADS[iid] || {strokes:[], color:'ink', width:2};
        PADS[iid].strokes = lines;
        /* 同 aalPadsRestore：還原的是書寫座標系，座標本身不動。 */
        PADS[iid].w0 = (Array.isArray(sp) ? 600 : sp.w) || PADS[iid].w0 || 600;
        PADS[iid].h0 = (Array.isArray(sp) ? 240 : sp.h) || PADS[iid].h0 || 240;
        QUIZ.strokes[iid] = lines;
        if (PADS[iid].cv) redraw(iid);
      });
    }
  }

  const items = a.itemIds.map(getItem).filter(Boolean);
  /* 進度要涵蓋兩種題型。原本分子只數選擇題、分母也只數選擇題，
     於是兩題非選全空時畫面寫「已作答 14 / 14」、進度條 100%——
     孩子被告知做完了，交出去的卻是兩題空白的建構反應題，
     而前測沒有任何補交路徑。 */
  const answered = items.filter(function(i){
    /* 手寫也算，與 quizProgressUpdate／submitQuiz 同一條判定。 */
    return i.type === 'cr'
      ? (!!String(QUIZ.texts[i.id] || '').trim() || padHasInk(i.id))
      : QUIZ.answers[i.id] !== undefined;
  }).length;
  const total = items.length;

  return sectionHead(a.title, a.desc || '', '<a class="btn" href="#/student">← 回作業列表</a>') +
    '<div class="kb-toolbar"><span class="muted small" role="status" aria-live="polite">已作答 ' +
    answered + ' / ' + total + ' 題</span>' +
    '<div class="bar" style="flex:1;max-width:280px"><i style="width:' + (100 * answered / Math.max(1, total)) + '%"></i></div>' +
    '<div class="spacer"></div><button class="btn primary sm" data-act="quiz-submit" data-id="' + aid + '">交卷</button></div>' +
    /* 存檔失敗的常駐警示，與後測那一支同一個形狀。quizSave 連續兩次失敗
       會來掀開它——沒有這個節點的話那條安全網又是死碼（後測第 5 輪踩過同一個坑）。 */
    '<div class="card card-p" id="quizSaveWarn" role="alert"' +
      (QUIZ && QUIZ.dirty ? '' : ' hidden') +
      ' style="margin-bottom:12px;border-left:3px solid var(--crit)">' +
      '<p class="small" style="margin:0"><strong>你寫的東西沒能存起來。</strong>' +
      '這台平板的儲存空間可能滿了。先不要關掉這個分頁——畫面上的內容還在，' +
      '請舉手告訴老師。</p></div>' +
    /* 前測（以及任何非 AAL 的派題）走這一支，而這一支從來沒有渲染文章。
       16 題全部是文本依賴題——「小昀第一次發現柚子樹位置不對，是在什麼時候？」
       在沒有文章的畫面上只能用猜的。實測：畫面印得出全部題幹，
       卻找不到兩篇文章的任何一段；後測的 AAL 版面則兩篇都在。
       前測 θ 是 ANCOVA 的共變數——量到的若是猜測而不是理解，
       整個組間比較的基線就不成立。
       題目已經依文本分組（見 30-data.js 的 allIds），所以在每一組前面
       放它自己的文章即可。這裡刻意不做逐句標記：那是 AAL 的操弄成分，
       前測四個條件必須一致，不能把處遇帶進基線。 */
    '<div class="col">' + (function(){
      const out = [];
      let curUnit = null;
      items.forEach(function(it, idx){
        if (it.unit !== curUnit){
          curUnit = it.unit;
          const tx = getText(curUnit);
          if (tx){
            out.push('<div class="card"><div class="card-h">' +
              '<h3>' + esc(tx.title) + '</h3>' +
              '<span class="pill">' + esc(tx.genre) + '</span></div>' +
              '<div class="card-p">' +
              (tx.intro ? '<p class="muted small">' + esc(tx.intro) + '</p>' : '') +
              tx.paras.map(function(p){ return '<p>' + esc(p) + '</p>'; }).join('') +
              '</div></div>');
          }
        }
        out.push(renderQuizItem(it, idx));
      });
      return out.join('');
    })() + '</div>' +
    '<div class="row" style="margin-top:16px;justify-content:flex-end">' +
    '<button class="btn primary" data-act="quiz-submit" data-id="' + aid + '">交卷</button></div>';

  function renderQuizItem(it, idx){
      if (it.type === 'cr'){
        /* 題號那一列要包成 .card-h。缺答救援唯一的文字線索寫在
           .card.missing .card-h::after，而前測兩種題卡原本都是
           .card > .card-p、整張卡沒有 .card-h——那行「還沒寫完」永遠不會
           被建立，被〈回去寫完〉帶回來的孩子只看到一圈紅框（純顏色，1.4.1）。
           175% 字級下一張題卡本身就比 768px 的螢幕高，scrollIntoView 之後
           紅框的上下緣都在視窗外，他只看得到左右兩條紅線。
           前測 θ 是 ANCOVA 的共變數，交卷不可逆，也沒有補交路徑——
           這是最後一道救援。後測的 #aalAnswer 有 .card-h，同一條 CSS
           在那裡一直是生效的。 */
        return '<div class="card"><div class="card-h">' +
          '<b>第 ' + (idx + 1) + ' 題　非選題</b><span class="spacer"></span>' +
          '<span class="row">' + itemPillsStudent(it) + '</span></div>' +
          '<div class="card-p">' +
          '<div class="stem" id="qStem-' + esc(it.id) + '">' + esc(it.stem) + '</div>' +
          /* label 要有 for、控制項要有 id。原本七個 label 全是裸的：
             報讀器唸到輸入框只說「編輯，空白」，唸到色票只說「色彩選擇器」，
             孩子不知道那一格要放什麼。前測是 ANCOVA 的共變數，這裡量到的
             差異會被當成起點能力帶進整個分析。
             同一頁有兩題非選，id 一律綴上題號，否則兩題的 label 會同時
             指向第一題的控制項——點第二題的「筆寬」會跳到第一題去。
             後測（92-ui-aal.js 的 cr 分支）已經是這個形狀，這裡補齊。 */
          /* 題幹要接進可及名稱，理由同後測的 cr 分支。 */
          '<div class="field"><label id="qLbl-' + esc(it.id) + '" for="qText-' + esc(it.id) + '">請寫出你的解題過程與說明</label>' +
          '<textarea id="qText-' + esc(it.id) + '" aria-labelledby="qStem-' + esc(it.id) + ' qLbl-' + esc(it.id) + '" rows="6" style="min-height:9rem" data-act="quiz-text" data-id="' + it.id + '">' + esc(QUIZ.texts[it.id] || '') + '</textarea></div>' +
          '<div class="field" style="margin-top:10px">' +
          '<label for="qPad-' + esc(it.id) + '">也可以手寫：先按下面的〈開始手寫〉，再用手指或筆寫（老師評閱時看得到）</label>' +
          '<canvas class="pad" id="qPad-' + esc(it.id) + '" data-pad="' + it.id + '" height="240"></canvas>' +
          '<div class="row" style="margin-top:6px">' +
            '<label class="small muted" for="qPadC-' + esc(it.id) + '">筆色</label>' +
            '<input id="qPadC-' + esc(it.id) + '" type="color" value="#12161c" data-act="pad-color" data-id="' + it.id + '" style="width:2.2rem;padding:2px">' +
            '<label class="small muted" for="qPadW-' + esc(it.id) + '">筆寬</label>' +
            '<input id="qPadW-' + esc(it.id) + '" type="range" min="1" max="8" value="2" data-act="pad-width" data-id="' + it.id + '" style="width:5rem">' +
            '<button class="btn sm" data-act="pad-touch" aria-pressed="false" data-id="' + it.id + '">開始手寫</button>' +
            '<button class="btn sm" data-act="pad-undo" data-id="' + it.id + '">復原</button>' +
            '<button class="btn sm" data-act="pad-clear" data-id="' + it.id + '">清空</button>' +
          '</div></div>' +
          '</div></div>';
      }
      const chosen = QUIZ.answers[it.id];
      /* 一組單選要有群組名。原本只是一個裸的 <div class="opts">：
         報讀器唸「單選按鈕，一之四」，題幹在群組外面，沒有任何東西把
         題目與選項綁在一起——用報讀器作答的孩子必須先把題幹背下來，
         再進到選項裡。這是作答負荷，不是閱讀理解負荷，而它會直接算進
         前測 θ。問卷（surveyGate 那一頁）早就是 radiogroup，這裡補齊。 */
      const sid = 'qs-' + esc(it.id);
      /* 題號列包成 .card-h，理由同上面那張非選題卡。 */
      return '<div class="card"><div class="card-h">' +
        '<b>第 ' + (idx + 1) + ' 題</b><span class="spacer"></span>' +
        '<span class="row">' + itemPillsStudent(it) + '</span></div>' +
        '<div class="card-p">' +
        '<div class="stem" id="' + sid + '">' + esc(it.stem) + '</div>' +
        '<div class="opts" role="radiogroup" aria-labelledby="' + sid + '">' + it.options.map(function(o, k){
          /* 選中態的 ✓ 佔位記號，與後測逐字相同：.opt.chosen 的底色
             --q4-bg 對 --card 只有約 1.2:1（高對比更低），實際只剩 3px 的
             inset 色條與原生 radio 圓點——顏色單獨傳達訊息（1.4.1）。
             前後測的「我選了哪一個」要是同一套線索。 */
          return '<label class="opt' + (chosen === k ? ' chosen' : '') + '">' +
            '<input type="radio" name="q-' + it.id + '" data-act="quiz-pick" data-id="' + it.id + '" data-k="' + k + '"' +
            (chosen === k ? ' checked' : '') + '>' +
            '<b aria-hidden="true">' + String.fromCharCode(65 + k) +
            '<span class="tick' + (chosen === k ? ' on' : '') + '">✓</span>' +
            '</b><span>' + esc(o) + '</span></label>';
        }).join('') + '</div>' +
        /* 三個 radiogroup 介面只修了兩個。後測作答頁與問卷頁都印了這一句，
           理由寫在 92-ui-aal.js：原生 radiogroup 在一顆都沒選時，Tab 進來
           會把焦點停在第一顆但不勾選它－－這個缺陷只吃掉 A 的作答，
           是只打在鍵盤使用者身上的系統性失分。而前測 θ 是 ANCOVA 的共變數，
           又沒有補交路徑。逐字用同一句，三處就一致了。 */
        '<p class="muted small" style="margin-top:6px">直接點你要的答案就可以。' +
        '用鍵盤的話，Tab 進到這一組，上下方向鍵移到哪一格就是選哪一格；想換答案再按方向鍵移過去就好。</p>' +
        '</div></div>';
  }
}

/* θ 是 logit，對十歲孩子沒有意義。轉成「和班上比起來」的五顆星，
   純呈現層——原始 θ 只留在 data-theta 與匯出裡，計算完全不動。 */
function readingStars(theta, mean){
  const d = theta - (mean || 0);
  const n = d >= 1 ? 5 : d >= 0.35 ? 4 : d >= -0.35 ? 3 : d >= -1 ? 2 : 1;
  /* role="img" + aria-label：沒有 role 的 <span> 是 generic，
     ARIA 禁止替它命名，報讀器只會唸出五個星星符號。
     暗星原本只靠 inline opacity:.25（對比 1.73:1，而且高對比模式覆寫不到），
     改用實心／空心的形狀差異，不只靠顏色（1.4.1）。 */
  return '<span role="img" data-theta="' + fx(theta) + '" aria-label="五顆星裡的第 ' + n + ' 顆">' +
    '<span aria-hidden="true">' + '★★★★★'.slice(0, n) +
    '<span class="star-dim">' + '☆☆☆☆☆'.slice(n) + '</span></span></span>';
}

/* --- 個人診斷 --- */
function viewResult(aid){
  const me = currentUser();
  const a = getAssignment(aid);
  if (!a) return '<div class="empty"><h3>找不到這份作業</h3></div>';
  /* 沒交卷就看不到這一頁。學生交完卷本來就會被導到 #/result/<aid>，
     所以這個網址的樣式他一定看過——沒有這道門檻，作答到一半改網址
     就拿到整份正解。用空狀態不要用 go()：go() 會 push 歷史，
     並與 viewAaL 的「已交卷 → 導向 result」反向導向對撞。 */
  if (!isTeacher() && !submitted(aid, me.id)){
    return '<div class="empty"><h3>這一份還沒交</h3>' +
      '<p style="max-width:60ch">交出去之後，這裡會告訴你哪幾題讀得很穩、哪幾題值得回去再讀一次。</p>' +
      '<div class="row" style="margin-top:14px">' +
      '<a class="btn primary" href="#/' + (a.aal ? 'aal' : 'quiz') + '/' + a.id + '">' +
      (a.aal ? '回去把這節課做完 →' : '回去作答 →') + '</a>' +
      '<a class="btn" href="#/student">回我的作業</a></div></div>';
  }
  /* 後測還沒交之前，前測的診斷頁一律不開。
     原本只有兩道門（沒交卷、以及「已交 a-post 但課後問卷未送出」），
     而後測作答中 submitted('a-post') 為 false，兩道門都不成立。
     keyLocked 確實藏住了選項與正解，但逐題卡片仍印出題號、題幹與狀態
     （答對／答錯／「你穩穩答對」／「可惜，你其實讀得懂」），
     上面還列著「有 N 題很可惜：第 8 題…回去把題目再讀一次」。
     前後測是同一份題本、displayNo 同源——「第 8 題」兩邊指同一道題。
     四選一「上次這題錯了」等於刪掉一個選項，「穩穩答對」等於照抄，
     效果與看到正解同類；而會不會繞這一趟由孩子自選，與作答節奏、
     投入程度、進而與條件共變，四組被污染的比例不對等。
     crResultBlock 早就為前測作文設了這道門，選擇題那一半沒有。 */
  if (!isTeacher() && aid === 'a-pre' && !submitted('a-post', me.id)){
    return '<div class="empty"><h3>等這節課做完</h3>' +
      '<p style="max-width:60ch">課前那一份的逐題結果，要等這節課也做完才會打開。' +
      '兩次用的是同一份題目——先看前一次的對錯，這一次就不算你自己讀出來的了。</p>' +
      '<div class="row" style="margin-top:14px">' +
      (submitted('a-post', me.id) ? '' :
        '<a class="btn primary" href="#/aal/a-post">回去把這節課做完 →</a>') +
      '<a class="btn" href="#/student">回我的作業</a></div></div>';
  }
  /* 課後問卷還沒送出之前，這一頁不能開。
     surveyGate() 只擋了一個方向（沒交卷不能填問卷），反方向完全沒有門檻：
     孩子從問卷任何一段按側欄回「我的作業」，同一畫面上「去填課後問卷」旁邊
     就是「看我這次讀得怎麼樣」，點進去拿到「選擇題答對 12 / 16　75%」、
     五顆星等與閱讀地圖，看完再回頭把問卷填完。
     而課後問卷裡的 eff（含「我相信我可以在這次閱讀測驗拿到不錯的成績」）、
     anx、mot_in／mot_ex 是 phase:'both' 的前後測配對依變項——
     先看到分數再作答，量到的是績效回饋不是介入效果。
     更麻煩的是「會不會繞這一趟」是孩子自選的，與能力、作答節奏、
     進而與條件共變，四組被污染的比例並不對等。 */
  if (!isTeacher() && submitted('a-post', me.id) && !surveyOf(me.id, 'post')){
    return '<div class="empty"><h3>先把這節課的問卷填完</h3>' +
      '<p style="max-width:60ch">問卷問的是你剛剛上這節課的感覺。先看到分數再回答，' +
      '你的感覺就會被分數帶著走——所以我們把這一頁先收起來。填完就會打開。</p>' +
      '<div class="row" style="margin-top:14px">' +
      '<a class="btn primary" href="#/survey/post">去填課後問卷 →</a>' +
      '<a class="btn" href="#/student">回我的作業</a></div></div>';
  }
  /* 前測診斷在後測交卷之前不給正解——後測用的是同一份題本。
     前半在上面那道門檻之後看似冗餘，但它是日後放寬門檻時的第二道保險，成本為零。
     四象限、星等與「可惜的題目 → 全班正在討論這題」都保留：
     它們只需要題號，不洩題，而那正是讓孩子回去重讀的動機來源。 */
  /* 用實際作答比例當門檻，不是「有沒有那筆 submission」。
     前測的正解另外要等後測也真的作答過才開（同一份題本）。 */
  const keyLocked = !keyUnlocked(aid, me.id) ||
                    (aid === 'a-pre' && !keyUnlocked('a-post', me.id));
  const diag = diagnose(state, aid);
  const mine = state.responses.filter(function(r){ return r.aid === aid && r.sid === me.id; });
  const mc = mine.filter(function(r){ return r.correct !== null && r.correct !== undefined; });
  const right = mc.filter(function(r){ return r.correct; }).length;
  const ps = diag && diag.ready ? diag.perStudent.find(function(p){ return p.sid === me.id; }) : null;

  return sectionHead('我這次讀得怎麼樣', a.title, '<a class="btn" href="#/student">← 回我的作業</a>') +
    /* 學生端不出現 θ、δ (logit)、KIDMAP、迷思象限——十歲孩子看不懂，
       而且「迷思」是個標籤。同一份資料，換一套對他說話的說法；
       底層的 ps.theta、ps.cells 與所有匯出一個字不動。 */
    '<div class="grid g4" style="margin-bottom:16px">' +
      /* 分母是他實際作答的題數（缺答現在寫 null、不進 mc）。
       不講清楚的話，只答一題的孩子會看到「1 / 1」而更困惑。 */
    /* 一題都沒作答時不要印「0 / 0　0%」，也不要餵 readingStars——
       那會憑空給出 ★★★☆☆。太少就明說太少。 */
    /* 答案卡還沒打開時，這張卡只報「參與」不報「表現」。
       聚合分數看起來安全，其實兩端就是完整揭露：「16 / 16」等於把孩子
       記得的整份答案宣告為正解，「0 / 16」等於替每一題刪掉一個選項，
       中間值也給出逐題可信度——而他記得自己每題選了什麼正是這道鎖的前提。
       這條路徑還不需要合併四班資料就成立，比逐題 pill 更容易在教室裡發生。 */
    (!mc.length
      ? statCard('選擇題答對', '—', '這一次作答的題目太少')
      : keyLocked
        ? statCard('已完成的題目', mc.length + ' / ' +
            a.itemIds.map(getItem).filter(function(i){ return i && i.type === 'mc'; }).length,
            '答對幾題要等答案打開之後才會算給你看')
        : statCard('選擇題答對', right + ' / ' + mc.length,
          (function(){
            const total = a.itemIds.map(getItem).filter(function(i){ return i && i.type === 'mc'; }).length;
            const miss = total - mc.length;
            return pct(right / Math.max(1, mc.length)) + (miss ? '　另外 ' + miss + ' 題沒有作答' : '');
          })())) +
      statCard('我這次的閱讀力', (ps && mc.length) ? readingStars(ps.theta, diag.meanTheta) : '—',
        /* 沒有 ps 的真正原因不是「人不夠多」——這台平板上本來就只有自己
           那一筆，四個班的資料要由老師合併之後才算得出來。原本寫
           「需要更多人完成」，孩子會以為再等一下就會出現。 */
        !mc.length ? '這一次作答的題目太少，畫不出來'
                   : (ps ? '和所有做過的同學比起來的位置' : '要等老師把大家的資料合起來')) +
      /* 這兩張卡與下面整張閱讀地圖也吃 keyLocked。原本只有那顆逐題 pill 與
         <div class="opts"> 被擋——而閱讀地圖把 displayNo 印在每顆圓點上、
         x 軸兩欄標籤就是「答錯」與「答對」、每顆點的 <title> 寫「第 8 題 ·
         你穩穩答對」、<desc> 再把「可惜的題目：第 8 題、第 12 題。」念給
         報讀器，下面還用 <li> 逐條列出所有 q===2 的題號與題幹；鎖定說明的
         結尾甚至主動把孩子指過去看那張圖。
         三個出口裡只修了最不顯眼的一個，等於沒修：孩子記得自己每題選了
         什麼，「第 8 題 答對」＝正解、「答錯」＝刪掉一個選項，而同教室
         二十幾人正在同一份題本上作答。前測那一份在後測釋出前同樣照印，
         Δθ 直接混入記憶效應。 */
      statCard('可惜的題目', (ps && !keyLocked) ? ps.q[2] : '—',
        keyLocked ? '答案打開之後才會算給你看' : '這幾題你其實讀得懂，只是這次沒答對') +
      statCard('厲害的題目', (ps && !keyLocked) ? ps.q[1] : '—',
        keyLocked ? '答案打開之後才會算給你看' : '這幾題比較難，你答對了',
        keyLocked ? '' : 'good') +
    '</div>' +
    ((ps && !keyLocked) ? '<div class="card" style="margin-bottom:16px"><div class="card-h"><h3>你這次的閱讀地圖</h3>' +
      '<span class="muted small">每一個圓點是一題</span></div><div class="card-p">' +
      kidmapSVG(diag, ps, true) + '<div class="row" style="margin-top:10px">' + quadLegendStudent() + '</div>' +
      (ps.q[2] ? '<div class="ai-out" style="margin-top:12px"><p><strong>有 ' + ps.q[2] +
        ' 題很可惜。</strong>看你其他題的表現，這幾題你其實讀得懂。回去把題目再讀一次，' +
        '找找看你當時是漏了哪一句。</p>' +
        '<ul>' + ps.cells.filter(function(c){ return c.q === 2; }).map(function(c){
          const it = getItem(c.iid);
          /* 只找本班的視圖。掃全站的話，c-3 的孩子會看到「全班正在討論這題 →」
             指向 c-1 的白板，點下去被守門擋掉——而那句話是對他說的。 */
          const v = viewsForViewer().find(function(v){ return v.origin && v.origin.iid === it.id; });
          return '<li>' + itemLabel(aid, it.id) + '：' + esc(shortStem(it.stem)) +
            (v ? '　<a href="#/kb/' + v.id + '">全班正在討論這題 →</a>' : '') + '</li>';
        }).join('') + '</ul></div>' : '') +
      (ps.q[1] ? '<div class="ai-out" style="margin-top:10px"><p><strong>有 ' + ps.q[1] +
        ' 題你很厲害。</strong>這幾題比較難，你答對了。' +
        '到知識建構空間把你的想法貼出來——班上有同學正卡在同一題。</p></div>' : '') +
      '</div></div>'
      /* 「等大家都交了再回來看」是一個不會兌現的承諾：這台平板上只有孩子
         自己那一筆，同班別人交不交都不會讓這裡長出東西。真正的條件是
         老師把四個班的資料合併起來跑一次共同校準——講清楚它，孩子才不會
         一直回來看一個永遠不會變的畫面。 */
      : '<div class="card card-p" style="margin-bottom:16px"><p class="muted small">' +
        (keyLocked
          ? '閱讀地圖要等答案打開之後才會出現——它會直接指出你哪幾題答錯，' +
            '而班上還有同學正在做同一份題目。'
          : '閱讀地圖要把四個班的作答放在一起才算得出來，' +
            '老師還沒把大家的資料合起來。這一頁下面的逐題檢視現在就可以看。') +
        '</p></div>') +
    '<div class="card" style="margin-bottom:16px"><div class="card-h"><h3>逐題檢視</h3>' +
    (keyLocked ? '<span class="pill"><span class="dot"></span>答案還沒打開</span>' : '') + '</div>' +
    /* 文案要講真正的條件。原本寫「這一節課上完之後」，而實際條件是
       「同班每一位都交了（或過了截止時間）」——講錯條件的等待訊息，
       孩子會以為壞掉了。 */
    (keyLocked ? '<div class="card-p"><p class="small" style="max-width:70ch;margin:0">' +
      (function(){
        /* 鎖著的時候閱讀地圖也不會出現了（見上面），所以不能再把孩子指過去。 */
        const tail = '這一頁下面的題目與你寫的字現在就可以回頭看。';
        /* 三種鎖定原因要講清楚是哪一種。原本一律說「這一節課上完之後」，
           而作答不到門檻的孩子課已經上完了、也沒有補答路徑——
           那句話對他永遠是假的，畫面卻一直承諾它會打開。 */
        const total = (getAssignment(aid) || {itemIds:[]}).itemIds.length;
        const ratio = (state.settings && state.settings.keyUnlockRatio != null)
          ? state.settings.keyUnlockRatio : 0.5;
        if (total && answeredCount(aid, me.id) / total < ratio)
          return '這一次作答的題目不到一半，所以逐題的答案沒有打開。' +
            '想看的話，跟老師說一聲。' + tail;
        const pend = classKeyPending(aid, me.id);
        /* 不要再承諾「等大家都交完」：一人一台平板時每台裝置只看得到
           自己那一筆交卷紀錄，那個條件永遠不會成立，真正會發生的是老師按那顆開關。 */
        if (pend > 0) return '等老師打開之後，' +
          '這裡就會讓你看到每一題的四個選項、正確答案和你當時選的。' + tail;
        return '等課後那一份也做完，這裡就會打開，' +
          '讓你看到每一題的四個選項、正確答案和你當時選的。' + tail;
      })() + '</p></div>' : '') +
    '<div class="card-p col">' + a.itemIds.map(getItem).filter(function(i){ return i && i.type === 'mc'; }).map(function(it){
      const r = mine.find(function(x){ return x.iid === it.id; });
      const c = diag && diag.ready && ps ? ps.cells.find(function(x){ return x.iid === it.id; }) : null;
      return '<div class="item"><div class="row" style="justify-content:space-between">' +
        '<b>' + itemLabel(aid, it.id) + '</b>' +
        /* 三態，不是兩態：沒作答不等於答錯。把缺答畫成紅色的「答錯」，
           孩子會以為自己寫了而且寫壞了。
           而 keyLocked 的時候，這一格也要跟著閉嘴——它原本只擋下面那段
           <div class="opts">，這顆 pill 完全不受控。孩子記得自己每一題選了
           什麼，「第 8 題 答對」＝正解、「答錯」＝刪掉一個選項，效果與看到
           答案卡同類；KIDMAP 的象限標籤（「你穩穩答對」「可惜，你其實讀得懂」）
           更直接。而同教室還有二十幾人正在同一份題本上作答，螢幕朝著旁邊——
           classKeyReleased、kbLocked 第三道門、a-pre 診斷門三道班級層級的鎖
           都是為了這個情境寫的，逐題狀態從三道鎖中間漏出去。
           「沒有作答」不是揭露（那是他自己的動作），照舊顯示。 */
        (!r || r.choice == null
           ? '<span class="pill"><span class="dot"></span>這一題你沒有作答</span>'
           : keyLocked
             ? '<span class="pill"><span class="dot"></span>已作答</span>'
             : (c ? '<span class="pill ' + QUAD[c.q].key + '"><span class="dot"></span>' +
                    esc(QUAD_STUDENT[c.q]) + '</span>'
                  : (r.correct ? '<span class="pill q1"><span class="dot"></span>答對</span>'
                               : '<span class="pill q2"><span class="dot"></span>答錯</span>'))) + '</div>' +
        '<div class="stem">' + esc(it.stem) + '</div>' +
        /* 前測的正解在後測交卷之前不打開：兩次測量用的是同一份題本，
           在中間逐題發答案卡，Δθ 就混入記憶效應，而記憶量與「有沒有來看
           診斷頁」相關，也就與投入程度、進而與條件相關。 */
        (keyLocked ? '' :
        '<div class="opts">' + it.options.map(function(o, k){
          const isAns = k === it.answer, isMine = r && r.choice === k;
          return '<div class="opt' + (isAns ? ' right' : (isMine ? ' wrong' : '')) + '"><b>' +
            String.fromCharCode(65 + k) + '</b><span>' + esc(o) +
            (isAns ? '　<span class="muted small">正解</span>' : '') +
            (isMine && !isAns ? '　<span class="muted small">你選的</span>' : '') + '</span></div>';
        }).join('') + '</div>') +
        '</div>';
    }).join('') + '</div></div>' +
    crResultBlock(aid, me.id, keyLocked);
}

function crResultBlock(aid, sid, keyLocked){
  const a = getAssignment(aid);
  const crs = a.itemIds.map(getItem).filter(function(i){ return i && i.type === 'cr'; });
  if (!crs.length) return '';
  return '<div class="card"><div class="card-h"><h3>非選題</h3></div><div class="card-p col">' +
    crs.map(function(it){
      const r = state.responses.find(function(x){ return x.aid === aid && x.sid === sid && x.iid === it.id; });
      return '<div class="note-full"><b>' + itemLabel(aid, it.id) + '</b>' +
        '<div class="stem">' + esc(it.stem) + '</div>' +
        /* 前測與後測是同兩題建構反應題。在後測交卷前把自己前測寫的整段
           作文讀回來，等於直接抄一次——兩題的 Δ 會歸零。
           但那個理由只適用於**前測**。孩子自己寫的字不是答案卡，
           所以不該跟著答案卡的班級釋出門檻一起鎖——同學還沒交完，
           跟他能不能讀回自己寫過的東西沒有關係。
           原本兩者共用 keyLocked，於是「答不到一半」或「全班還沒交完」時，
           他連自己的作文都讀不回來。 */
        ((aid === 'a-pre' && !submitted('a-post', sid))
          ? '<p class="muted small" style="margin-top:6px">等課後那一份也做完，這裡會打開，' +
            '讓你看到自己當時寫了什麼。</p>'
          : crAnswerHtml(r)) +
        '<div class="row" style="margin-top:8px">' +
        (r && r.score !== null && r.score !== undefined
          ? '<span class="pill q1"><span class="dot"></span>得分 ' + r.score + ' / 6</span>'
          : '<span class="pill">等待老師評閱</span>') +
        /* 老師的評語可能寫著正確答案，前測鎖著的時候一併不顯示 */
        (r && r.comment && !keyLocked ? '<span class="small muted">老師評語：' + esc(r.comment) + '</span>' : '') +
        '</div></div>';
    }).join('') + '</div></div>';
}

/* --- 相似題練習 --- */
/* 離線引擎挑出來的「相似題」是題庫裡的**現役題目**，不是新生成的。
   前後測用的是同一份 16 題，老師把它們印成隔天的練習卷就是先發答案卡，
   而他原本沒有任何線索知道自己踩到了——介面從頭到尾用「出題／生成」
   的措辭，唯一的線索藏在要另外展開的〈解題思路〉裡。 */
showSimilar._seen = {};
async function showSimilar(iid, force){
  const box = document.getElementById('sim-' + iid);
  if (!box) return;
  box.innerHTML = '<p class="muted small" style="margin-top:8px">整理中……</p>';
  if (!force) showSimilar._seen[iid] = [];
  try {
    const items = await aiSimilarItems(getItem(iid), !!force, showSimilar._seen[iid] || []);
    const exhausted = items.length === 1 && items[0].exhausted;
    (items || []).forEach(function(x){
      if (x.itemId && (showSimilar._seen[iid] || []).indexOf(x.itemId) < 0) showSimilar._seen[iid].push(x.itemId);
    });
    box.innerHTML = '<div class="col" style="margin-top:10px">' +
      (exhausted ? '' :
        '<div class="card card-p" style="border-left:3px solid var(--crit)">' +
        '<p class="small" style="margin:0"><strong>這些是題庫裡的現役題目，不是新生成的。</strong>' +
        '前測與後測用的是同一份題本——把它們印給學生練習，等於先發答案卡。' +
        '這一區只供你自己備課參考。</p></div>') +
      items.map(function(x, i){
      return '<div class="item" style="background:var(--shade)">' +
        '<div class="eyebrow">' + (x.itemId
          ? '題庫第 ' + x.itemNo + ' 題（' + esc(x.itemId) + '）' +
            (x.inUse && x.inUse.length ? '　·　目前用於：' + esc(x.inUse.join('、')) : '')
          : '參考題 ' + (i + 1)) + '</div>' +
        '<div class="stem">' + esc(x.stem) + '</div>' +
        /* 這幾顆原本是沒有內含控制項的 <label>：不在 Tab 序上、Enter 也不會
           觸發，只用鍵盤的人完全點不到參考題。label 本來就要有 for 或內含
           控制項才有意義，這裡兩者都沒有，所以直接改成 button。 */
        '<div class="opts">' + x.options.map(function(o, k){
          return '<button type="button" class="opt" data-act="sim-pick" data-i="' + i + '" data-k="' + k + '" data-ans="' + x.answer +
            '" data-iid="' + iid + '"><b>' + String.fromCharCode(65 + k) + '</b><span>' + esc(o) + '</span></button>';
        }).join('') + '</div>' +
        '<div class="small muted" id="simfb-' + iid + '-' + i + '" style="margin-top:6px"></div>' +
        '<details style="margin-top:6px"><summary class="small muted" style="cursor:pointer">命題備註</summary>' +
        '<div class="small" style="margin-top:4px">' + esc(x.hint || '') + '</div></details>' +
        '</div>';
    }).join('') + '<div class="row"><span class="muted small">引擎：' + esc(engineLabel()) + '</span>' +
    /* 一顆按不動的按鈕比一顆按了沒反應的按鈕誠實 */
    '<button class="btn sm" data-act="similar-again" data-id="' + iid + '"' +
      (exhausted ? ' disabled' : '') + '>換一批</button></div></div>';
  } catch (e) {
    box.innerHTML = '<p class="small" style="margin-top:8px"><strong>取不到題目：</strong>' + esc(e.message) + '</p>';
  }
}

/* --- 手寫板 ---
   手寫是「不會用鍵盤的孩子」寫建構反應題的唯一通道，所以它在下游必須
   跟打字完全等價：算作答、進得了草稿、老師看得到。下面三支是那份等價的
   單一來源，任何一處要問「這一題有沒有寫」都必須經過 padHasInk()。 */
const PADS = {};

/* 把所有手寫板清乾淨，連同掛在 window 上的 resize 監聽。
   換身分、施測前清場、示範的「再走一次」都要呼叫——PADS 不在 state 裡，
   那幾支清場只清了 state，手寫會原地留著跟到下一個人身上。 */
function clearPads(){
  Object.keys(PADS).forEach(function(k){
    const p = PADS[k];
    if (p && p._onResize) window.removeEventListener('resize', p._onResize);
    delete PADS[k];
  });
}

/* 只收監聽器與畫布參照，筆畫留著。離開作答頁時用——資料還要留給草稿與
   交卷，但沒有必要留著一整排指向已死節點的 resize 監聽。 */
function releasePadListeners(){
  Object.keys(PADS).forEach(function(k){
    const p = PADS[k];
    if (!p) return;
    if (p._onResize){ window.removeEventListener('resize', p._onResize); p._onResize = null; }
    p.cv = null;
  });
}

/* 這塊板子上有沒有東西。只有一個點的筆畫不算——canvas 在描邊前會剪掉
   單點子路徑，所以它畫不出任何東西，但 strokes.length 會是 1。
   而「這一題有沒有寫」現在是缺答判定、進度、answeredCount（答案卡的
   作答比例門檻）與 padPayload 的共同來源：在畫布上點一下就會讓兩題全空的
   孩子繞過缺答救援，交卷後 respHasInk 為真、評閱頁顯示「手寫作答」加一張
   全白的圖，只能給 0 分而不是標成缺答。 */
function padHasInk(padId){
  const p = PADS[padId];
  return !!(p && p.strokes && p.strokes.some(function(s){
    return s.pts && s.pts.length > 1; }));
}

/* 落地用的格式。除了筆畫本身還要記下當時的畫布寬度：筆畫存的是 CSS px
   絕對座標，沒有寬度就無法在別的寬度（老師的桌機、列印、平板轉向）
   正確重畫——而評閱畫面的寬度幾乎一定和孩子作答時不同。 */
function padPayload(padId){
  const p = PADS[padId];
  if (!padHasInk(padId)) return null;
  /* 一定要深複本。原本 lines 直接指向 PADS 裡那個「活的」陣列，交卷之後
     state.responses 與畫布共用同一份資料：畫布隨 v.innerHTML 被拆走，
     但掛在 window 上的 size() 還活著，下一次 resize（平板轉向、軟體鍵盤
     開合）時它跑在脫離文件的 canvas 上，量到寬度 0、退回 600，
     於是把每個點就地乘上 600/舊寬——已經落地的那一筆跟著被改掉，
     而它自己記的 w 是個數字、不會跟著動。評閱端於是用舊的 viewBox 去畫
     被放大過的座標，筆跡被裁掉，接著任何一次 save() 就寫死進匯出檔。
     只留有效筆畫，順便把點一下留下的單點清掉。 */
  /* w／h 要記書寫座標系（w0／h0），不是當下的畫布尺寸——座標本來就存在
     那個座標系裡，strokesSvg 的 viewBox 用它才對得起來。記成當下尺寸的話，
     孩子在 100% 寫、交卷前把字級調到 175%，viewBox 就會比座標大一圈，
     評閱端看到的字擠在左上角。 */
  /* viewBox 至少要涵蓋所有落下的墨水。size() 已經讓 w0／h0 涵蓋可寫範圍，
     這一層是保險：日後任何一條路徑讓座標跑到盒子外，交出去的那一份
     也不會把它裁掉——評閱端寧可看到一張比較空的圖，也不要看到缺一角的字。 */
  const used = p.strokes.reduce(function(m, s){
    (s.pts || []).forEach(function(pt){
      if (pt[0] > m.x) m.x = pt[0];
      if (pt[1] > m.y) m.y = pt[1];
    });
    return m;
  }, {x:0, y:0});
  return {w: Math.ceil(Math.max(p.w0 || p.w || (p.cv && p.cv.clientWidth) || 600, used.x + 4)),
    h: Math.ceil(Math.max(p.h0 || p.h || padBaseHeight(), used.y + 4)),
    lines: p.strokes.filter(function(s){ return s.pts && s.pts.length > 1; })
      .map(function(s){
        return {color:s.color, width:s.width, pts:s.pts.map(function(pt){ return pt.slice(); })};
      })};
}

/* 一筆建構反應題作答要怎麼呈現，全站只有這一支說了算。
   上一輪補讀取端時修好了教師評閱與唯讀重播、漏掉學生自己的成績頁，
   於是純手寫作答的孩子在「唯一看得到自己 CR 作答的畫面」上被告知
   兩題都是「（未作答）」——那是他整節課寫最久的兩題，而全站沒有補交
   或修改路徑；他會舉手說系統把答案弄丟，或帶著「我那兩題沒寫」的認知
   去填緊接著要量自我效能與焦慮的課後問卷。
   三個讀取端共用這一支，下一次就不會再漏掉其中一個。 */
function crAnswerHtml(r, opts){
  const o = opts || {};
  const txt = String((r && r.text) || '').trim();
  const inked = respHasInk(r);
  if (!txt && !inked){
    return '<div class="' + (o.cls || 'ai-out') + '" style="white-space:pre-wrap' +
      (o.style ? ';' + o.style : '') + '">（未作答）</div>';
  }
  return (txt ? '<div class="' + (o.cls || 'ai-out') + '" style="white-space:pre-wrap' +
                (o.style ? ';' + o.style : '') + '">' + esc(txt) + '</div>' : '') +
    (inked ? '<div class="small muted" style="margin-top:8px">手寫作答</div>' +
             strokesSvg(r.strokes) : '');
}

/* 把落地的筆跡畫成 SVG。用 SVG 不用 canvas，因為評閱頁與唯讀重播都只是
   要「看」：SVG 不需要初始化、會跟著容器縮放、也印得出來。
   色票 'ink' 是刻意的語意值而不是色碼——見 padInk() 的說明。 */
function strokesSvg(sp){
  if (!sp) return '';
  const lines = Array.isArray(sp) ? sp : (sp.lines || []);   // 舊格式：直接是陣列
  if (!lines.length) return '';
  const w = (Array.isArray(sp) ? 600 : sp.w) || 600;
  const h = (Array.isArray(sp) ? 240 : sp.h) || 240;
  const paths = lines.map(function(s){
    const pts = s.pts || [];
    if (!pts.length) return '';
    const d = pts.map(function(pt, i){
      return (i ? 'L' : 'M') + (Math.round(pt[0] * 10) / 10) + ' ' + (Math.round(pt[1] * 10) / 10);
    }).join(' ');
    const col = (!s.color || s.color === 'ink') ? 'currentColor' : s.color;
    return '<path d="' + d + '" fill="none" stroke="' + esc(col) + '" stroke-width="' +
      (+s.width || 2) + '" stroke-linecap="round" stroke-linejoin="round"/>';
  }).join('');
  return '<svg class="padview" viewBox="0 0 ' + w + ' ' + h + '" ' +
    'role="img" aria-label="學生的手寫作答" preserveAspectRatio="xMinYMin meet">' + paths + '</svg>';
}
/* 預設筆色存的是語意值 'ink'，不是色碼。原本寫死 '#12161c'（淺色主題的
   墨色），而畫布底色是 var(--card)——平板跟著系統偏好進暗色主題時，
   --card 是 #1a1f26，對比約 1.1:1，孩子等於用隱形墨水在寫，
   而且沒有任何線索告訴他要先去改「筆色」。存成 'ink' 之後，畫的時候解析成
   當下主題的 --ink，落地之後在評閱端解析成 currentColor——
   孩子與老師的主題不同也不會有一邊看不見。 */
/* 手寫板的基準高度。原本寫死 240 CSS px——手寫板是整個作答通道裡唯一
   釘在絕對 px 的輸入區（同一張卡上的打字框是 min-height:11rem，label 與
   按鈕也都吃 rem）。以孩子自己的視覺尺度算，100% 時這塊板子有 12 個行高、
   175% 時只剩 6.8 個，而需要放大字級的孩子筆跡本來就大。
   改成跟著 --fs 走，並與 #crText 的 min-height:11rem 對齊。 */
function padBaseHeight(){
  try {
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 20;
    return Math.round(rem * 11);
  } catch (e) { return 240; }
}

/* 工具列與畫布的狀態要跟 PADS 對齊。真值一直在模組記憶體的 PADS 裡
   （touchDraw／color／width／h），但畫面每次 render 都用寫死的預設值重建：
   按鈕永遠 aria-pressed="false" ＋「開始手寫」、canvas 沒有 .penmode、
   色票永遠 #12161c、筆寬永遠 2。於是：
     · 開過手寫再換題回來，touchDraw 仍是 true 但畫布回到 pan-y，
       手指想捲頁時照樣記一筆；而按鈕寫著「開始手寫」，第一次按下去
       其實是把它關掉，要按兩次才真的打開
     · 色票顯示淺色主題的墨色，孩子在深色主題下碰一次就把 'ink' 改回
       #12161c（對 --card 約 1.1:1，等於隱形墨水）
     · 換主題時已經光柵化的筆跡不會重畫
   initPads 尾端、applyA11y、applyTheme 與系統主題變更都呼叫這一支。 */
function syncPads(){
  Object.keys(PADS).forEach(function(id){
    const p = PADS[id];
    if (!p) return;
    const cv = document.querySelector('canvas.pad[data-pad="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]');
    if (!cv) return;
    p.cv = cv;
    const btn = document.querySelector('[data-act="pad-touch"][data-id="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]');
    if (btn){
      btn.setAttribute('aria-pressed', p.touchDraw ? 'true' : 'false');
      btn.textContent = p.touchDraw ? '結束手寫' : '開始手寫';
      btn.classList.toggle('primary', !!p.touchDraw);
    }
    cv.classList.toggle('penmode', !!p.touchDraw);
    const col = document.querySelector('[data-act="pad-color"][data-id="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]');
    if (col) col.value = padResolveColor(p.color);
    const wd = document.querySelector('[data-act="pad-width"][data-id="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]');
    if (wd) wd.value = String(p.width || 2);
    if (p._resize) p._resize();
    else redraw(id);
  });
}

/* 色碼正規化：#abc → #aabbcc，一律小寫。
   〈筆色〉的守門原本是字串相等，而 input[type=color].value 一律是 7 字元
   #rrggbb——高對比主題的 --ink 是三位的 #000，'#000000' === '#000' 恆為
   false，於是低視力孩子在高對比下碰一次色票並選黑，PADS 的顏色就從語意值
   'ink' 被寫成字面 #000000。'ink' 存在的唯一理由就是「孩子與老師的主題
   不同也不會有一邊看不見」（strokesSvg 存 currentColor、.padview 的 color
   是 var(--ink)）——寫死之後，評閱者用深色主題打開時筆跡是 #000000 對
   --card #1a1f26，約 1.06:1，等於隱形墨水。
   不要只把 CSS 改成六位就算了：那只修掉今天這一個主題，下一個用三位或
   大寫色碼的主題會再掉一次。 */
function normHex(s){
  let v = String(s || '').trim().toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(v)) v = '#' + v[1] + v[1] + v[2] + v[2] + v[3] + v[3];
  return v;
}
function padInk(){
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim();
    if (v) return normHex(v) || v;
  } catch (e) {}
  return '#12161c';
}
function padResolveColor(c){ return (!c || c === 'ink') ? padInk() : normHex(c) || c; }

function initPads(){
  $$('canvas[data-pad]').forEach(function(cv){
    const id = cv.dataset.pad;
    if (cv._init) return;
    cv._init = true;
    function size(){
      /* 量不到寬度時什麼都不要做。原本 `cv.clientWidth || 600` 在畫布已經
         脫離文件（交卷、換題、換頁之後）時會退回 600，然後拿它去換算座標，
         把整份筆跡就地乘掉。量不到就是量不到，不是 600。 */
      if (!cv.isConnected || !cv.clientWidth || !cv.clientHeight) return;
      const w = cv.clientWidth;
      const h = cv.clientHeight;   // 由 CSS 的 11rem 決定，跟著字級走
      const p = PADS[id];
      /* 書寫座標系。筆畫的座標一旦寫下來就不再改動，縮放只發生在畫的那一刻
         （見 padScale／redraw）。
         第 8 輪把兩軸各自換算改成單一等比因子 min(w/p.w, h/p.h)，修掉了
         非等比拉伸，但那個變換仍然是「就地改資料」而且不可逆：
         橫轉直 k=min(704/960,1)=0.733 會縮，直轉橫 k=min(960/704,1)=1 不還原，
         轉一個來回剩 73%、兩個來回 54%、三個來回 39%，筆畫還愈來愈細；
         字級 100%→175%→100% 同樣剩 57%。而平板轉向是四到六年級孩子的
         常態動作，手寫又是不會注音打字的孩子在兩題建構反應題上唯一的通道，
         縮小後的座標會由 padPayload 烘進 state.responses——評閱者看到的
         就是愈來愈小、愈來愈細的字，而他無從復原。
         改成：w0/h0 記下「這些座標是在多大的板子上寫的」，之後永遠不動。 */
      if (p && !p.w0){ p.w0 = w; p.h0 = h; }
      /* 書寫座標系必須涵蓋「現在寫得到的每一個點」。
         k = min(w/w0, h/h0) 是單一等比因子，但畫布的長寬比並不固定
         （width:100% 由版面決定、height:11rem 跟著 --fs 走），取 min 之後
         必有一軸的可寫範圍嚴格大於 w0／h0：字級 100%→175% 時寬度不變、
         k=1，y 寫得到 385 而 h0 還是 220；橫轉直 k=0.733，y 寫得到 300。
         而 padPayload 記 w0／h0、strokesSvg 的 viewBox 就是 0 0 w0 h0
         （svg 預設 overflow:hidden），那些點在教師評閱、學生成績頁、
         唯讀重播與匯出檔全部被裁掉——孩子寫的時候畫布上看得到，
         所以他不會舉手；老師拿到一張缺了下半截的圖，只能給低分。
         盒子只長不縮：長到涵蓋當下可寫範圍就停（一步到不動點），
         座標仍然永遠不動，而 k 對同一個盒子仍是可逆的。
         代價是「用過比較高的板子之後回到矮的」會整體縮小顯示——
         那是誠實的：內容確實比視窗高，縮到看得完才對，總比裁掉好。 */
      if (p && p.w0 && p.h0){
        const k0 = Math.min(w / p.w0, h / p.h0);
        if (isFinite(k0) && k0 > 0){
          p.w0 = Math.max(p.w0, w / k0);
          p.h0 = Math.max(p.h0, h / k0);
        }
      }
      /* 筆畫是 CSS px 絕對座標。原本 resize 只重設畫布尺寸就直接重畫舊座標，
         平板由橫轉直（約 1024→768）之後，寫在右半邊的字整片落在畫布外——
         資料還在、畫面沒了，而孩子最可能的反應是按〈清空〉整題重寫。
         這裡依新舊寬度比例換算，字跟著縮，不會掉出去。 */
      if (p){ p.w = w; p.h = h; }
      /* dpr 要即時讀，不能用 initPads 當下擷取的那一個。backing store 用舊值、
         redraw 的 setTransform 用新值的話（Chromebook 顯示縮放、瀏覽器頁面
         縮放、視窗換到不同 DPI 的螢幕都會觸發 resize），筆跡會以
         dprNew/dprOld 的倍率偏離筆尖，右／下緣被切掉。 */
      const dpr = window.devicePixelRatio || 1;
      cv.width = w * dpr; cv.height = h * dpr;
      /* 變換交給 redraw 每次自己算——它要跟著當下的 w0→w 比例走，
         而那個比例會隨字級與轉向改變。 */
      redraw(id);
    }
    PADS[id] = PADS[id] || {strokes:[], color:'ink', width:2, cv:cv};
    PADS[id].cv = cv;
    size();
    /* 舊的監聽器要先拆掉。原本每渲染一次 CR 題就多掛一個 window resize
       監聽且從不移除，被閉包鎖住的分離畫布（1200×480 backing store）
       也跟著累積——記憶體壓力正是平板把分頁丟掉的原因之一。 */
    if (PADS[id]._onResize) window.removeEventListener('resize', PADS[id]._onResize);
    PADS[id]._onResize = size;
    PADS[id]._resize = size;      // syncPads 要從外面叫得到
    window.addEventListener('resize', size);

    let cur = null;
    /* 觸控預設不畫。canvas.pad 原本是 touch-action:none 的全寬區塊，
       而它所在的都是長捲動頁（前測一頁 16 題、AaL 在平板上恆為單欄）——
       孩子想捲頁時手指落在畫布上，頁面不動，他會再滑幾次，
       每滑一次就在自己的作答上留一條斜線，而那些線會跟著交卷送出去。
       改成：手寫筆與滑鼠一律可畫；手指要先按〈用手指寫〉才會畫，
       沒開的時候畫布讓瀏覽器正常捲動（touch-action 由 .pad.penmode 切換）。 */
    function drawableFrom(e){
      if (e.pointerType === 'mouse') return true;      // 桌機沒有捲動衝突
      return !!PADS[id].touchDraw;                     // 手指與觸控筆都要先開手寫模式
    }
    /* 指標座標要換算回書寫座標系（除以當下的縮放因子），
       筆寬也一樣——不然在放大的板子上寫出來的字，存進去會偏大。 */
    function at(e){
      const r = cv.getBoundingClientRect();
      const k = padScale(id) || 1;
      return [(e.clientX - r.left) / k, (e.clientY - r.top) / k];
    }
    cv.addEventListener('pointerdown', function(e){
      if (!drawableFrom(e)) return;
      e.preventDefault();
      /* setPointerCapture 對某些指標會丟 NotFoundError（指標已經抬起、
         或事件不是來自真的硬體）。原本沒有防護，一丟例外整筆就沒被推進去——
         孩子按下去卻什麼都沒畫出來，而他不會知道發生什麼事。
         抓不到捕獲只是「指標離開畫布時不再收到事件」，不該連筆畫都放棄。 */
      try { cv.setPointerCapture(e.pointerId); } catch (err) {}
      cur = {color:PADS[id].color, width:PADS[id].width, pts:[at(e)]};
      PADS[id].strokes.push(cur);
    });
    cv.addEventListener('pointermove', function(e){
      if (!cur) return;
      cur.pts.push(at(e));
      redraw(id);
    });
    /* 沒有移動過的「筆畫」要丟掉。pointerdown 在還沒有任何 pointermove
       之前就先推了一筆進去，而三個收尾原本只把 cur 清掉。
       單點子路徑畫不出任何東西，却會讓「這一題有沒有寫」變成真。 */
    function dropEmptyStroke(){
      if (cur && (!cur.pts || cur.pts.length < 2)){
        const arr = PADS[id].strokes;
        const i = arr.lastIndexOf(cur);
        if (i >= 0) arr.splice(i, 1);
      }
      cur = null;
    }
    cv.addEventListener('pointerup', function(){ dropEmptyStroke(); padChanged(id); });
    cv.addEventListener('pointerleave', dropEmptyStroke);
    /* 與畫布同一個坑：手勢被瀏覽器接管時會送 pointercancel，
       不處理的話同一次捲動會在計算紙上留下一條假筆畫。 */
    cv.addEventListener('pointercancel', dropEmptyStroke);
  });
  /* 畫布建好之後把工具列與 PADS 對齊一次。 */
  if (typeof syncPads === 'function') syncPads();
}

/* 這塊板子被改動之後要做的事。三件都不能少：
   · 前測把筆畫同步進 QUIZ（交卷時從那裡讀）
   · 後測寫進草稿（不寫的話重載就整片空白，而畫面承諾「進度會保留」）
   · 解除「還沒寫完」的紅框並更新進度——原本 aalClearMissing 只掛在選項與
     textarea 上，在畫布上寫再多都消不掉那個紅字。 */
function padChanged(id){
  if (QUIZ && !/^aal-/.test(id)){ QUIZ.strokes[id] = PADS[id].strokes; quizSaveSoon(); }
  if (typeof quizProgressUpdate === 'function' && QUIZ) quizProgressUpdate();
  if (/^aal-/.test(id)){
    if (typeof AAL !== 'undefined' && AAL && typeof aalSave === 'function') aalSave();
    if (typeof aalClearMissing === 'function') aalClearMissing();
    /* 手寫也要寫一筆行為事件。'W'（書寫作答）原本只由 #crText 的 input
       產生，於是只用手寫作答的孩子在整份歷程資料裡完全沒有「作答」這個動作：
       LSA 的轉移矩陣、ENA 的 REV 判定（往前 3 格有沒有 O／W）、SDIS 序列
       全部看不到他，而他其實一直在寫。那群孩子正是不會注音打字的那一群，
       缺漏因此與打字能力共變，不是隨機的。
       節流與打字那一支同一個做法：連續筆畫不要每一筆都記。 */
    const iid = String(id).replace(/^aal-/, '');
    const it = (typeof AAL !== 'undefined' && AAL)
      ? AAL.items.find(function(x){ return x.id === iid; }) : null;
    if (it && typeof aalLog === 'function'){
      if (!padChanged._last || Date.now() - padChanged._last > 4000){
        padChanged._last = Date.now();
        aalLog('TYPE', 'W', {len:(PADS[id].strokes || []).length, ink:true}, it);
      }
    }
  } else {
    const cv = PADS[id] && PADS[id].cv;
    const card = cv && cv.closest ? cv.closest('.card') : null;
    if (card && padHasInk(id)) card.classList.remove('missing');
  }
}

/* 書寫座標系 →目前畫布的等比縮放因子。
   取兩軸較小的那一個：板子變窄就整體縮進去（不會有字掉到框外），
   板子變大（例如把字級開到 175%）就整體放大——低視力的孩子把整頁放大時，
   他自己的筆跡也應該跟著大。
   關鍵是這個因子每次都從 w0／h0 重算，不會累積：
   橫→直→橫、100%→175%→100% 都會精確回到原來的樣子。 */
function padScale(id){
  const p = PADS[id];
  if (!p || !p.cv) return 1;
  const w0 = p.w0 || p.cv.clientWidth || 1;
  const h0 = p.h0 || p.cv.clientHeight || 1;
  const w = p.cv.clientWidth || w0;
  const h = p.cv.clientHeight || h0;
  const k = Math.min(w / w0, h / h0);
  return (isFinite(k) && k > 0) ? k : 1;
}
function redraw(id){
  const p = PADS[id]; if (!p || !p.cv) return;
  const ctx = p.cv.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const k = padScale(id);
  /* setTransform 每次重設，不要靠 size() 設一次就算了——k 會變。
     dpr 與 k 一起乘進去：座標與線寬同時等比，筆畫不會變細。 */
  ctx.setTransform(dpr * k, 0, 0, dpr * k, 0, 0);
  ctx.clearRect(0, 0, p.cv.width / (dpr * k), p.cv.height / (dpr * k));
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  p.strokes.forEach(function(s){
    ctx.strokeStyle = padResolveColor(s.color); ctx.lineWidth = s.width;
    ctx.beginPath();
    s.pts.forEach(function(pt, i){ if (i) ctx.lineTo(pt[0], pt[1]); else ctx.moveTo(pt[0], pt[1]); });
    ctx.stroke();
  });
}
