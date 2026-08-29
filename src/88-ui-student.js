/* ==========================================================================
   88-ui-student.js — 學生端：作業、作答（含手寫）、個人診斷、相似題練習
   ========================================================================== */

let QUIZ = null;    // {aid, answers:{iid:choice}, texts:{iid:string}, strokes:{iid:[]}}

function viewStudent(){
  const me = currentUser();
  const k = classOfStudent(me.id);
  const inClass = !!k;
  if (!inClass) return '<div class="empty"><h3>這個帳號不在示範班級裡</h3>' +
    '<p>請用右上角的身分選單切換成班上的學生。</p></div>';
  const asgs = state.assignments.slice().sort(function(a, b){ return b.createdAt - a.createdAt; });
  const myNotes = state.notes.filter(function(n){ return n.authorIds.indexOf(me.id) >= 0; }).length;
  const unread = notesForViewer().filter(isUnread).length;

  const cond = condition(k.condition);
  const needPre = !surveyOf(me.id, 'pre');
  return sectionHead('我的作業', me.name + '　·　' + k.name) +
    (cond.id !== 'control'
      ? '<div class="card card-p" style="margin-bottom:16px;border-left:3px solid var(--' +
        (cond.cls ? cond.cls.replace('sc', 'sc-') : 'ink-4') + ')">' +
        '<div class="eyebrow">這節課陪你的夥伴</div>' +
        '<h3 style="margin-top:4px">' + esc(cond.name) + '</h3>' +
        '<p class="small" style="margin-top:6px">' + esc(cond.frame) + '</p>' +
        '<p class="muted small">它不會告訴你答案，也不會說你對或錯。每一題最多可以跟它說 ' +
        ((state.settings && state.settings.maxTurns) || MAX_TURNS) + ' 次話。</p></div>'
      /* 四條件的卡片結構要逐項對位：同一條左邊框、eyebrow、h3、兩段 p。
         少一個 h3、少一條邊條，卡片高度就不同，底下的統計卡與作業清單
         起始位置也跟著不同——那是每個孩子每次登入的第一個畫面。
         不要用否定句定義對照組（「你這一班沒有…」等於告訴孩子他拿到的是
         缺角版本），也不要提到別班。正面描述他真正要做的事就好。 */
      : '<div class="card card-p" style="margin-bottom:16px;border-left:3px solid var(--ink-4)">' +
        '<div class="eyebrow">這節課的進行方式</div>' +
        '<h3 style="margin-top:4px">我的筆記</h3>' +
        '<p class="small" style="margin-top:6px">這節課你自己讀、自己想。' +
        '這一頁有一塊「我的筆記」，把想到的、卡住的地方寫下來。</p>' +
        '<p class="muted small">筆記只有你和老師看得到，不會打分數。' +
        '一題一頁，換題會換新的。</p></div>') +
    (needPre ? '<div class="card card-p" style="margin-bottom:16px;border-left:3px solid var(--warn)">' +
      '<div class="row" style="justify-content:space-between"><span class="small">還沒填課前問卷。</span>' +
      '<a class="btn sm primary" href="#/survey/pre">去填課前問卷</a></div></div>' : '') +
    /* 側欄徽章在窄版看不見，這裡補一張結構相同的提醒卡。四條件都會出現。 */
    (submitted('a-post', me.id) && !surveyOf(me.id, 'post')
      ? '<div class="card card-p" style="margin-bottom:16px;border-left:3px solid var(--warn)">' +
        '<div class="row" style="justify-content:space-between"><span class="small">這節課的問卷還沒填完。</span>' +
        '<a class="btn sm primary" href="#/survey/post">去填課後問卷</a></div></div>' : '') +
    /* 知識建構空間鎖著的時候，首頁不要用橘色卡片催他去一個進不去的地方。
       卡片數維持四張，只換內容與樣式。 */
    '<div class="grid g4" style="margin-bottom:16px">' +
      statCard('待作答', asgs.filter(function(a){ return !submitted(a.id, me.id); }).length, '') +
      statCard('已完成', asgs.filter(function(a){ return submitted(a.id, me.id); }).length, '') +
      (kbLocked(me)
        ? statCard('我貼的想法', myNotes, '交完卷就可以繼續') +
          statCard('知識建構空間', '測驗後開放', '交完卷就會打開')
        : statCard('我貼的想法', myNotes, '在知識建構空間') +
          statCard('未讀貼文', unread, '同學的新想法', unread ? 'warn' : '')) +
    '</div>' +
    '<div class="col">' + asgs.map(function(a){
      const done = submitted(a.id, me.id);
      const n = a.itemIds.length;
      const right = state.responses.filter(function(r){
        return r.aid === a.id && r.sid === me.id && r.correct === true; }).length;
      return '<div class="card"><div class="card-p"><div class="row" style="justify-content:space-between">' +
        '<div><h3>' + esc(a.title) + '</h3>' +
        '<div class="muted small">' + esc(a.desc || '') + '</div>' +
        '<div class="row small muted" style="margin-top:6px;gap:12px">' +
          '<span>' + n + ' 題</span>' +
          '<span>截止 ' + fmtDate(a.due) + '</span>' +
          (done ? '<span class="pill q1"><span class="dot"></span>已完成 · 選擇題答對 ' + right + '</span>'
                : '<span class="pill">尚未作答</span>') +
        '</div></div>' +
        /* 示範資料把 96 人的後測都交完了，於是沒有任何一條路徑走得到作答頁。
           示範模式下補一顆「再走一次」，讓人看得到這套流程長什麼樣子；
           正式施測時 demoSeed 為 false，這顆鈕不會出現。 */
        '<div class="row">' + (done
          ? '<a class="btn" href="#/result/' + a.id + '">查看個人診斷</a>' +
            (state.demoSeed !== false && a.aal && !isImpersonating()
              ? ' <button class="btn sm" data-act="redo-demo" data-id="' + a.id +
                '">再走一次（示範）</button>' : '')
          : '<a class="btn primary" href="#/' + (a.aal ? 'aal' : 'quiz') + '/' + a.id + '">' +
            (a.aal ? '開始這節課 →' : '開始作答 →') + '</a>') + '</div>' +
        '</div></div></div>';
    }).join('') + '</div>' +
    '<div class="card" style="margin-top:16px"><div class="card-p">' +
    '<h4>作答之後會發生什麼</h4>' +
    '<p class="small" style="margin-top:6px;max-width:70ch">系統會用所有做過這份題目的同學（四個班一起）估出每題的難度與你的能力，' +
    '把「你本來應該答得出來卻答錯」的題目標出來。這些題目不會只變成一個紅色叉叉——' +
    '系統會把它整理出來變成全班的共同問題，貼到知識建構空間，讓大家一起把它想清楚。</p></div></div>';
}

function submitted(aid, sid){
  return state.submissions.some(function(s){ return s.aid === aid && s.sid === sid; });
}

/* --- 作答 --- */
function viewQuiz(aid){
  const a = getAssignment(aid);
  const me = currentUser();
  if (!a) return '<div class="empty"><h3>找不到這份作業</h3><a class="btn" href="#/student">回我的作業</a></div>';
  if (submitted(aid, me.id)) { go('#/result/' + aid); return ''; }
  if (!QUIZ || QUIZ.aid !== aid) QUIZ = {aid:aid, answers:{}, texts:{}, strokes:{}};

  const items = a.itemIds.map(getItem).filter(Boolean);
  const answered = Object.keys(QUIZ.answers).length;
  const mcCount = items.filter(function(i){ return i.type === 'mc'; }).length;

  return sectionHead(a.title, a.desc || '', '<a class="btn" href="#/student">← 回作業列表</a>') +
    '<div class="kb-toolbar"><span class="muted small">已作答 ' + answered + ' / ' + mcCount + ' 題</span>' +
    '<div class="bar" style="flex:1;max-width:280px"><i style="width:' + (100 * answered / Math.max(1, mcCount)) + '%"></i></div>' +
    '<div class="spacer"></div><button class="btn primary sm" data-act="quiz-submit" data-id="' + aid + '">交卷</button></div>' +
    '<div class="col">' + items.map(function(it, idx){
      if (it.type === 'cr'){
        return '<div class="card"><div class="card-p">' +
          '<div class="row" style="justify-content:space-between;margin-bottom:6px">' +
          '<b>第 ' + (idx + 1) + ' 題　非選題</b>' +
          '<span class="row">' + itemPillsStudent(it) + '</span></div>' +
          '<div class="stem">' + esc(it.stem) + '</div>' +
          '<div class="field"><label>請寫出你的解題過程與說明</label>' +
          '<textarea style="min-height:120px" data-act="quiz-text" data-id="' + it.id + '">' + esc(QUIZ.texts[it.id] || '') + '</textarea></div>' +
          '<div class="field" style="margin-top:10px"><label>也可以直接手寫（老師評閱時看得到）</label>' +
          '<canvas class="pad" data-pad="' + it.id + '" height="240"></canvas>' +
          '<div class="row" style="margin-top:6px">' +
            '<label class="small muted">筆色</label><input type="color" value="#12161c" data-act="pad-color" data-id="' + it.id + '" style="width:44px;padding:2px">' +
            '<label class="small muted">筆寬</label><input type="range" min="1" max="8" value="2" data-act="pad-width" data-id="' + it.id + '" style="width:100px">' +
            '<button class="btn sm" data-act="pad-undo" data-id="' + it.id + '">復原</button>' +
            '<button class="btn sm" data-act="pad-clear" data-id="' + it.id + '">清空</button>' +
          '</div></div>' +
          '</div></div>';
      }
      const chosen = QUIZ.answers[it.id];
      return '<div class="card"><div class="card-p">' +
        '<div class="row" style="justify-content:space-between;margin-bottom:6px">' +
        '<b>第 ' + (idx + 1) + ' 題</b>' +
        '<span class="row">' + itemPillsStudent(it) + '</span></div>' +
        '<div class="stem">' + esc(it.stem) + '</div>' +
        '<div class="opts">' + it.options.map(function(o, k){
          return '<label class="opt' + (chosen === k ? ' chosen' : '') + '">' +
            '<input type="radio" name="q-' + it.id + '" data-act="quiz-pick" data-id="' + it.id + '" data-k="' + k + '"' +
            (chosen === k ? ' checked' : '') + '>' +
            '<b>' + String.fromCharCode(65 + k) + '</b><span>' + esc(o) + '</span></label>';
        }).join('') + '</div></div></div>';
    }).join('') + '</div>' +
    '<div class="row" style="margin-top:16px;justify-content:flex-end">' +
    '<button class="btn primary" data-act="quiz-submit" data-id="' + aid + '">交卷</button></div>';
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
  /* 前測診斷在後測交卷之前不給正解——後測用的是同一份題本。
     前半在上面那道門檻之後看似冗餘，但它是日後放寬門檻時的第二道保險，成本為零。
     四象限、星等與「可惜的題目 → 全班正在討論這題」都保留：
     它們只需要題號，不洩題，而那正是讓孩子回去重讀的動機來源。 */
  const keyLocked = !submitted(aid, me.id) ||
                    (aid === 'a-pre' && !submitted('a-post', me.id));
  const diag = diagnose(state, aid);
  const mine = state.responses.filter(function(r){ return r.aid === aid && r.sid === me.id; });
  const mc = mine.filter(function(r){ return r.correct !== null && r.correct !== undefined; });
  const right = mc.filter(function(r){ return r.correct; }).length;
  const ps = diag && diag.ready ? diag.perStudent.find(function(p){ return p.sid === me.id; }) : null;

  return sectionHead('個人診斷', a.title, '<a class="btn" href="#/student">← 回我的作業</a>') +
    /* 學生端不出現 θ、δ (logit)、KIDMAP、迷思象限——十歲孩子看不懂，
       而且「迷思」是個標籤。同一份資料，換一套對他說話的說法；
       底層的 ps.theta、ps.cells 與所有匯出一個字不動。 */
    '<div class="grid g4" style="margin-bottom:16px">' +
      /* 分母是他實際作答的題數（缺答現在寫 null、不進 mc）。
       不講清楚的話，只答一題的孩子會看到「1 / 1」而更困惑。 */
    statCard('選擇題答對', right + ' / ' + mc.length,
      (function(){
        const total = a.itemIds.map(getItem).filter(function(i){ return i && i.type === 'mc'; }).length;
        const miss = total - mc.length;
        return pct(right / Math.max(1, mc.length)) + (miss ? '　另外 ' + miss + ' 題沒有作答' : '');
      })()) +
      statCard('我這次的閱讀力', ps ? readingStars(ps.theta, diag.meanTheta) : '—',
        ps ? '和所有做過的同學比起來的位置' : '需要更多人完成') +
      statCard('可惜的題目', ps ? ps.q[2] : '—', '這幾題你其實讀得懂，只是這次沒答對') +
      statCard('厲害的題目', ps ? ps.q[1] : '—', '這幾題比較難，你答對了', 'good') +
    '</div>' +
    (ps ? '<div class="card" style="margin-bottom:16px"><div class="card-h"><h3>你這次的閱讀地圖</h3>' +
      '<span class="muted small">每一個圓點是一題</span></div><div class="card-p">' +
      kidmapSVG(diag, ps, true) + '<div class="row" style="margin-top:10px">' + quadLegendStudent() + '</div>' +
      (ps.q[2] ? '<div class="ai-out" style="margin-top:12px"><p><strong>有 ' + ps.q[2] +
        ' 題很可惜。</strong>看你其他題的表現，這幾題你其實讀得懂。回去把題目再讀一次，' +
        '找找看你當時是漏了哪一句。</p>' +
        '<ul>' + ps.cells.filter(function(c){ return c.q === 2; }).map(function(c){
          const it = getItem(c.iid);
          const v = state.views.find(function(v){ return v.origin && v.origin.iid === it.id; });
          return '<li>第 ' + it.no + ' 題：' + esc(shortStem(it.stem)) +
            (v ? '　<a href="#/kb/' + v.id + '">全班正在討論這題 →</a>' : '') + '</li>';
        }).join('') + '</ul></div>' : '') +
      (ps.q[1] ? '<div class="ai-out" style="margin-top:10px"><p><strong>有 ' + ps.q[1] +
        ' 題你很厲害。</strong>這幾題比較難，你答對了。' +
        '到知識建構空間把你的想法貼出來——班上有同學正卡在同一題。</p></div>' : '') +
      '</div></div>'
      : '<div class="card card-p" style="margin-bottom:16px"><p class="muted small">班上還沒有夠多人做完，' +
        '所以還畫不出你的閱讀地圖。等大家都交了再回來看。</p></div>') +
    '<div class="card" style="margin-bottom:16px"><div class="card-h"><h3>逐題檢視</h3>' +
    (keyLocked ? '<span class="pill"><span class="dot"></span>答案還沒打開</span>' : '') + '</div>' +
    (keyLocked ? '<div class="card-p"><p class="small" style="max-width:70ch;margin:0">' +
      '這一節課上完之後，這裡會打開，讓你看到每一題的四個選項、正確答案和你當時選的。' +
      '現在先看上面的閱讀地圖——它已經告訴你哪幾題值得回去重讀。</p></div>' : '') +
    '<div class="card-p col">' + a.itemIds.map(getItem).filter(function(i){ return i && i.type === 'mc'; }).map(function(it){
      const r = mine.find(function(x){ return x.iid === it.id; });
      const c = diag && diag.ready && ps ? ps.cells.find(function(x){ return x.iid === it.id; }) : null;
      return '<div class="item"><div class="row" style="justify-content:space-between">' +
        '<b>第 ' + it.no + ' 題</b>' +
        /* 三態，不是兩態：沒作答不等於答錯。把缺答畫成紅色的「答錯」，
           孩子會以為自己寫了而且寫壞了。 */
        (!r || r.choice == null
           ? '<span class="pill"><span class="dot"></span>這一題你沒有作答</span>'
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
      return '<div class="note-full"><b>非選第 ' + it.no + ' 題</b>' +
        '<div class="stem">' + esc(it.stem) + '</div>' +
        /* 前測與後測是同兩題建構反應題。在後測交卷前把自己前測寫的整段
           作文讀回來，等於直接抄一次——兩題的 Δ 會歸零。 */
        (keyLocked
          ? '<p class="muted small" style="margin-top:6px">這一節課上完之後，這裡會打開，' +
            '讓你看到自己當時寫了什麼。</p>'
          : '<div class="ai-out" style="white-space:pre-wrap">' + esc((r && r.text) || '（未作答）') + '</div>') +
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
        '<div class="opts">' + x.options.map(function(o, k){
          return '<label class="opt" data-act="sim-pick" data-i="' + i + '" data-k="' + k + '" data-ans="' + x.answer +
            '" data-iid="' + iid + '"><b>' + String.fromCharCode(65 + k) + '</b><span>' + esc(o) + '</span></label>';
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

/* --- 手寫板 --- */
const PADS = {};
function initPads(){
  $$('canvas[data-pad]').forEach(function(cv){
    const id = cv.dataset.pad;
    if (cv._init) return;
    cv._init = true;
    const dpr = window.devicePixelRatio || 1;
    function size(){
      const w = cv.clientWidth || 600;
      cv.width = w * dpr; cv.height = 240 * dpr;
      const ctx = cv.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      redraw(id);
    }
    PADS[id] = PADS[id] || {strokes:[], color:'#12161c', width:2, cv:cv};
    PADS[id].cv = cv;
    size();
    window.addEventListener('resize', size);
    let cur = null;
    cv.addEventListener('pointerdown', function(e){
      cv.setPointerCapture(e.pointerId);
      const r = cv.getBoundingClientRect();
      cur = {color:PADS[id].color, width:PADS[id].width, pts:[[e.clientX - r.left, e.clientY - r.top]]};
      PADS[id].strokes.push(cur);
    });
    cv.addEventListener('pointermove', function(e){
      if (!cur) return;
      const r = cv.getBoundingClientRect();
      cur.pts.push([e.clientX - r.left, e.clientY - r.top]);
      redraw(id);
    });
    cv.addEventListener('pointerup', function(){ cur = null; if (QUIZ) QUIZ.strokes[id] = PADS[id].strokes; });
    cv.addEventListener('pointerleave', function(){ cur = null; });
    /* 與畫布同一個坑：手勢被瀏覽器接管時會送 pointercancel，
       不處理的話同一次捲動會在計算紙上留下一條假筆畫。 */
    cv.addEventListener('pointercancel', function(){ cur = null; });
  });
}
function redraw(id){
  const p = PADS[id]; if (!p || !p.cv) return;
  const ctx = p.cv.getContext('2d');
  ctx.clearRect(0, 0, p.cv.width, p.cv.height);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  p.strokes.forEach(function(s){
    ctx.strokeStyle = s.color; ctx.lineWidth = s.width;
    ctx.beginPath();
    s.pts.forEach(function(pt, i){ if (i) ctx.lineTo(pt[0], pt[1]); else ctx.moveTo(pt[0], pt[1]); });
    ctx.stroke();
  });
}
