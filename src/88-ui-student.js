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
  const unread = state.notes.filter(isUnread).length;

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
      : '<div class="card card-p" style="margin-bottom:16px">' +
        '<div class="eyebrow">這節課的進行方式</div>' +
        '<p class="small" style="margin-top:6px">你這一班沒有 AI 夥伴。畫面右邊是「我的筆記」，' +
        '把你想到的、卡住的地方寫下來就好。</p></div>') +
    (needPre ? '<div class="card card-p" style="margin-bottom:16px;border-left:3px solid var(--warn)">' +
      '<div class="row" style="justify-content:space-between"><span class="small">還沒填課前問卷。</span>' +
      '<a class="btn sm primary" href="#/survey/pre">去填課前問卷</a></div></div>' : '') +
    '<div class="grid g4" style="margin-bottom:16px">' +
      statCard('待作答', asgs.filter(function(a){ return !submitted(a.id, me.id); }).length, '') +
      statCard('已完成', asgs.filter(function(a){ return submitted(a.id, me.id); }).length, '') +
      statCard('我貼的想法', myNotes, '在知識建構空間') +
      statCard('未讀貼文', unread, '同學的新想法', unread ? 'warn' : '') +
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
        '<div class="row">' + (done
          ? '<a class="btn" href="#/result/' + a.id + '">查看個人診斷</a>'
          : '<a class="btn primary" href="#/' + (a.aal ? 'aal' : 'quiz') + '/' + a.id + '">' +
            (a.aal ? '開始這節課 →' : '開始作答 →') + '</a>') + '</div>' +
        '</div></div></div>';
    }).join('') + '</div>' +
    '<div class="card" style="margin-top:16px"><div class="card-p">' +
    '<h4>作答之後會發生什麼</h4>' +
    '<p class="small" style="margin-top:6px;max-width:70ch">系統會用全班的作答估出每題的難度與你的能力，' +
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
          '<span class="row">' + itemPills(it) + '</span></div>' +
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
        '<span class="row">' + itemPills(it) + '</span></div>' +
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

/* --- 個人診斷 --- */
function viewResult(aid){
  const me = currentUser();
  const a = getAssignment(aid);
  if (!a) return '<div class="empty"><h3>找不到這份作業</h3></div>';
  const diag = diagnose(state, aid);
  const mine = state.responses.filter(function(r){ return r.aid === aid && r.sid === me.id; });
  const mc = mine.filter(function(r){ return r.correct !== null && r.correct !== undefined; });
  const right = mc.filter(function(r){ return r.correct; }).length;
  const ps = diag && diag.ready ? diag.perStudent.find(function(p){ return p.sid === me.id; }) : null;

  return sectionHead('個人診斷', a.title, '<a class="btn" href="#/student">← 回我的作業</a>') +
    '<div class="grid g4" style="margin-bottom:16px">' +
      statCard('選擇題答對', right + ' / ' + mc.length, pct(right / Math.max(1, mc.length))) +
      statCard('能力估計 θ', ps ? fx(ps.theta) : '—', ps ? '班級平均 ' + fx(diag.meanTheta) : '需要更多人完成') +
      statCard('迷思題', ps ? ps.q[2] : '—', '能力足以答對卻答錯', ps && ps.q[2] ? 'crit' : '') +
      statCard('優勢題', ps ? ps.q[1] : '—', '難題卻答對了', 'good') +
    '</div>' +
    (ps ? '<div class="card" style="margin-bottom:16px"><div class="card-h"><h3>你的 KIDMAP</h3>' +
      '<span class="pill">θ = ' + fx(ps.theta) + '</span></div><div class="card-p">' +
      kidmapSVG(diag, ps) + '<div class="row" style="margin-top:10px">' + quadLegend() + '</div>' +
      (ps.q[2] ? '<div class="ai-out" style="margin-top:12px"><p><strong>你有 ' + ps.q[2] +
        ' 題落在迷思象限。</strong>照你在其他題目上的表現，這些題目本來應該答得出來。回頭看看題目、對照正解，找出思考卡在哪。</p>' +
        '<ul>' + ps.cells.filter(function(c){ return c.q === 2; }).map(function(c){
          const it = getItem(c.iid);
          const v = state.views.find(function(v){ return v.origin && v.origin.iid === it.id; });
          return '<li>第 ' + it.no + ' 題：' + esc(shortStem(it.stem)) +
            (v ? '　<a href="#/kb/' + v.id + '">全班正在討論這題 →</a>' : '') + '</li>';
        }).join('') + '</ul></div>' : '') +
      (ps.q[1] ? '<div class="ai-out" style="margin-top:10px"><p><strong>你有 ' + ps.q[1] +
        ' 題屬於優勢概念。</strong>這些難題超出預期答對，代表你在這些單元有隱藏實力。' +
        '到知識建構空間把你的想法貼出來——班上有同學正卡在同一題。</p></div>' : '') +
      '</div></div>'
      : '<div class="card card-p" style="margin-bottom:16px"><p class="muted small">目前完成人數不足 ' +
        (diag ? diag.minN : 3) + ' 人，還不能產生個人 KIDMAP。KIDMAP 需要一定樣本量才能估出穩定的題目難度與能力值，稍後再回來看。</p></div>') +
    '<div class="card" style="margin-bottom:16px"><div class="card-h"><h3>逐題檢視</h3></div>' +
    '<div class="card-p col">' + a.itemIds.map(getItem).filter(function(i){ return i && i.type === 'mc'; }).map(function(it){
      const r = mine.find(function(x){ return x.iid === it.id; });
      const c = diag && diag.ready && ps ? ps.cells.find(function(x){ return x.iid === it.id; }) : null;
      return '<div class="item"><div class="row" style="justify-content:space-between">' +
        '<b>第 ' + it.no + ' 題</b>' + (c ? qpill(c.q) : (r && r.correct ? '<span class="pill q1"><span class="dot"></span>答對</span>' :
          '<span class="pill q2"><span class="dot"></span>答錯</span>')) + '</div>' +
        '<div class="stem">' + esc(it.stem) + '</div>' +
        '<div class="opts">' + it.options.map(function(o, k){
          const isAns = k === it.answer, isMine = r && r.choice === k;
          return '<div class="opt' + (isAns ? ' right' : (isMine ? ' wrong' : '')) + '"><b>' +
            String.fromCharCode(65 + k) + '</b><span>' + esc(o) +
            (isAns ? '　<span class="muted small">正解</span>' : '') +
            (isMine && !isAns ? '　<span class="muted small">你選的</span>' : '') + '</span></div>';
        }).join('') + '</div>' +
        '<div class="row" style="margin-top:8px"><button class="btn sm" data-act="similar" data-id="' + it.id + '">請 AI 出 3 道相似題</button></div>' +
        '<div id="sim-' + it.id + '"></div>' +
        '</div>';
    }).join('') + '</div></div>' +
    crResultBlock(aid, me.id);
}

function crResultBlock(aid, sid){
  const a = getAssignment(aid);
  const crs = a.itemIds.map(getItem).filter(function(i){ return i && i.type === 'cr'; });
  if (!crs.length) return '';
  return '<div class="card"><div class="card-h"><h3>非選題</h3></div><div class="card-p col">' +
    crs.map(function(it){
      const r = state.responses.find(function(x){ return x.aid === aid && x.sid === sid && x.iid === it.id; });
      return '<div class="note-full"><b>非選第 ' + it.no + ' 題</b>' +
        '<div class="stem">' + esc(it.stem) + '</div>' +
        '<div class="ai-out" style="white-space:pre-wrap;font-size:13px">' + esc((r && r.text) || '（未作答）') + '</div>' +
        '<div class="row" style="margin-top:8px">' +
        (r && r.score !== null && r.score !== undefined
          ? '<span class="pill q1"><span class="dot"></span>得分 ' + r.score + ' / 6</span>'
          : '<span class="pill">等待老師評閱</span>') +
        (r && r.comment ? '<span class="small muted">老師評語：' + esc(r.comment) + '</span>' : '') +
        '</div></div>';
    }).join('') + '</div></div>';
}

/* --- 相似題練習 --- */
async function showSimilar(iid){
  const box = document.getElementById('sim-' + iid);
  if (!box) return;
  box.innerHTML = '<p class="muted small" style="margin-top:8px">出題中……</p>';
  try {
    const items = await aiSimilarItems(getItem(iid));
    box.innerHTML = '<div class="col" style="margin-top:10px">' + items.map(function(x, i){
      return '<div class="item" style="background:var(--shade)"><div class="eyebrow">相似題 ' + (i + 1) + '</div>' +
        '<div class="stem">' + esc(x.stem) + '</div>' +
        '<div class="opts">' + x.options.map(function(o, k){
          return '<label class="opt" data-act="sim-pick" data-i="' + i + '" data-k="' + k + '" data-ans="' + x.answer +
            '" data-iid="' + iid + '"><b>' + String.fromCharCode(65 + k) + '</b><span>' + esc(o) + '</span></label>';
        }).join('') + '</div>' +
        '<div class="small muted" id="simfb-' + iid + '-' + i + '" style="margin-top:6px"></div>' +
        '<details style="margin-top:6px"><summary class="small muted" style="cursor:pointer">解題思路</summary>' +
        '<div class="small" style="margin-top:4px">' + esc(x.hint || '') + '</div></details>' +
        '</div>';
    }).join('') + '<div class="row"><span class="muted small">引擎：' + esc(engineLabel()) + '</span>' +
    '<button class="btn sm" data-act="similar-again" data-id="' + iid + '">再出 3 題</button></div></div>';
  } catch (e) {
    box.innerHTML = '<p class="small" style="margin-top:8px"><strong>出題失敗：</strong>' + esc(e.message) + '</p>';
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
