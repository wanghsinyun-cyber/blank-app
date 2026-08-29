/* ==========================================================================
   84-ui-kb.js — 知識建構空間（Knowledge Forum 式）
   視圖、貼文、支架、延伸貼文、躍升貼文、引用、註記、搜尋、閱讀狀態
   ========================================================================== */

/* 模組層級的 UI 狀態。每一個都要說清楚生命週期，否則就會像躍升選取模式
   那樣跨視圖殘留，讓學生在別的視圖點貼文打不開，還能建出跨視圖的假躍升。 */
let KBSEL = null;               // 躍升選取模式：存「哪一個視圖」，換視圖或離開 #/kb 即清
let KBPICK = {};                // 被選取的貼文，與 KBSEL 同生命週期
let KBSEARCH = {field:'content', q:''};   // 離開 #/kb 時清（換視圖保留，同一次找東西）
let EDIT = null;                // 編輯中的貼文草稿，closeModal() 時清

/* 測驗還沒交完的學生看到的門檻畫面。四個 KB 入口都先過這一關。 */
/* 測驗還沒交完的學生看到的門檻畫面。四個 KB 入口都先過這一關。
   文案依「實際擋住你的那一份作業」說話——寫死「前測」會在後測派出後變成謊話。 */
function kbGate(){
  const me = currentUser();
  if (!kbLocked(me)) return '';
  const pend = pendingAssignments(me.id);
  const blocking = pend[0];
  return '<div class="empty">' +
    '<h3>先把「' + esc(blocking.title) + '」交出來，這裡就會打開</h3>' +
    '<p style="max-width:62ch">這個地方放的是全班一起想的問題，那些問題是從大家的作答整理出來的。' +
    '如果你先看到別人怎麼想，就很難知道自己本來會怎麼讀了。</p>' +
    '<p class="muted small">還沒交的有 ' + pend.length + ' 份。</p>' +
    '<div class="row" style="margin-top:14px">' +
    pend.map(function(a){
      return '<a class="btn primary" href="#/' + (a.aal ? 'aal' : 'quiz') + '/' + a.id + '">' +
        esc(a.title) + '　' + (a.aal ? '開始這節課 →' : '開始作答 →') + '</a>';
    }).join('') +
    '<a class="btn" href="#/student">回我的作業</a></div></div>';
}

/* 視圖不屬於你這一班時的空狀態。不要用「權限不足」那種說法——
   對孩子而言那不是權限問題，是「這不是我們班的白板」。 */
function kbScopeBlock(){
  return '<div class="empty"><h3>這塊白板不是你們班的</h3>' +
    '<p style="max-width:60ch">每一個班有自己的知識建構空間，' +
    '你們班的討論在這裡。</p>' +
    '<a class="btn" href="#/kb">回知識建構空間</a></div>';
}

function viewKBList(){
  const gate = kbGate(); if (gate) return gate;
  const res = KBSEARCH.q ? searchNotes(KBSEARCH.field, KBSEARCH.q) : null;
  return sectionHead('知識建構空間', '每個視圖是一塊共同的白板。想法貼上去之後就屬於社群，任何人都可以延伸、挑戰、綜整。',
    (isTeacher() ? '<button class="btn" data-act="new-view">新增視圖</button>' : '')) +
  '<div class="kb-toolbar">' +
    '<label class="small muted" for="sf">搜尋</label>' +
    '<select id="sf" style="width:auto" data-act="search-field">' +
      [['title','標題'],['scaffold','支架'],['content','內容'],['author','作者'],['keyword','關鍵詞'],['date','建立日期']]
      .map(function(o){ return '<option value="' + o[0] + '"' + (KBSEARCH.field === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') +
    '</select>' +
    '<input type="text" id="sq" placeholder="輸入關鍵字…" value="' + esc(KBSEARCH.q) + '" style="max-width:260px" data-act="search-q">' +
    (KBSEARCH.q ? '<button class="btn sm" data-act="search-clear">清除</button>' : '') +
    '<div class="spacer"></div><span class="muted small">未讀 ' + notesForViewer().filter(isUnread).length + ' 則</span>' +
  '</div>' +
  (res ? '<div class="card" style="margin-bottom:16px"><div class="card-h"><h3>搜尋結果</h3>' +
      '<span class="muted small">' + res.length + ' 則貼文符合</span></div><div class="card-p col">' +
      (res.map(noteRow).join('') || '<div class="muted small">沒有符合的貼文。</div>') + '</div></div>' : '') +
  /* 白板依班級隔離之後，還沒有討論的班會拿到空清單。空的格線沒有任何說明，
     孩子會以為壞掉了。示範資料只種了示範班，其餘三班在示範模式下本來就是空的。 */
  (viewsForViewer().length ? '' :
    '<div class="empty"><h3>你們班的討論還沒開始</h3>' +
    '<p style="max-width:62ch">等老師把大家卡住的那一題整理出來，' +
    '它就會出現在這裡，變成一塊你們班一起想的白板。</p>' +
    '<a class="btn" href="#/student">回我的作業</a></div>') +
  '<div class="grid g2">' + viewsForViewer().map(function(v){
    const ns = notesOfView(v.id);
    const un = ns.filter(isUnread).length;
    const it = v.origin ? getItem(v.origin.iid) : null;
    return '<div class="card"><div class="card-h"><h3>' + esc(v.title) + '</h3>' +
      (un ? '<span class="pill" style="border-color:var(--accent);color:var(--accent)">未讀 ' + un + '</span>' : '') + '</div>' +
      '<div class="card-p">' +
      '<p class="small muted">' + esc(v.desc) + '</p>' +
      /* 同上：學生版用中性色與中性語彙，不用紅色的迷思 pill。 */
      (it ? '<div class="pill ' + (isTeacher() ? 'q2' : '') + '" style="margin-bottom:8px">' +
            '<span class="dot"></span>' +
            (isTeacher() ? '源自迷思題：第 ' : '大家在討論：第 ') + it.no + ' 題</div>' : '') +
      '<div class="row small muted" style="gap:14px">' +
        '<span>' + ns.length + ' 則貼文</span>' +
        '<span>' + ns.filter(function(n){ return n.buildOn; }).length + ' 則延伸</span>' +
        '<span>' + ns.filter(function(n){ return n.kind === 'rise'; }).length + ' 則躍升</span>' +
        '<span>' + uniq(ns.reduce(function(a, n){ return a.concat(n.authorIds); }, [])).length + ' 位作者</span>' +
      '</div>' +
      (v.links && v.links.length ? '<div class="small muted" style="margin-top:8px">連結視圖：' +
        v.links.map(function(l){ const t = getView(l); return t ? '<a href="#/kb/' + l + '">' + esc(t.title) + '</a>' : ''; }).join('、') + '</div>' : '') +
      '<div class="row" style="margin-top:12px"><a class="btn primary sm" href="#/kb/' + v.id + '">進入視圖</a>' +
      (isTeacher() ? '<a class="btn sm" href="#/synth/' + v.id + '">想法串綜整</a>' : '') + '</div>' +
      '</div></div>';
  }).join('') + '</div>';
}

function noteRow(n){
  const v = getView(n.viewId);
  return '<div class="row" style="justify-content:space-between;border-bottom:1px solid var(--rule-soft);padding-bottom:8px">' +
    '<div><a href="#/note/' + n.id + '"><b>' + esc(n.title) + '</b></a>' +
    '<div class="muted small">' + esc(noteAuthors(n)) + '　·　' + (v ? esc(v.title) : '') + '　·　' + fmtDate(n.createdAt) + '</div></div>' +
    '<span class="pill">' + esc(epiLabelFor(n)) + '</span></div>';
}

/* --- 視圖畫布 --- */
function viewKBCanvas(vid){
  const gate = kbGate(); if (gate) return gate;
  const v = getView(vid);
  if (!v) return '<div class="empty"><h3>找不到這個視圖</h3><a class="btn" href="#/kb">回知識建構空間</a></div>';
  /* 列表過濾擋不住直接打網址。條件是在班級層次操弄的，
     讓對照組讀得到 tutor 班的討論就是擴散污染。 */
  if (!viewVisible(vid)) return kbScopeBlock();
  /* 先清再組。選取模式綁在視圖上，換視圖就結束——否則工具列會寫著
     「選取中（2）」而畫布上沒有任何貼文帶外框，點貼文也打不開詳頁。 */
  if (KBSEL && KBSEL !== vid){ KBSEL = null; KBPICK = {}; }
  const ns = notesOfView(vid);
  const it = v.origin ? getItem(v.origin.iid) : null;

  const notesHTML = ns.map(function(n){
    const scaf = (n.segs || [])[0];
    const cls = ['note', n.kind === 'problem' ? 'problem' : '', n.kind === 'rise' ? 'rise' : '',
                 isUnread(n) ? 'unread' : '', KBPICK[n.id] ? 'sel' : ''].filter(Boolean).join(' ');
    const scls = scaf ? (scaffold(scaf.s) || {}).cls : '';
    /* aria-label 會吞掉整張卡的內容，改用 labelledby + describedby。
       但 role="button" 的 Children Presentational 為 true——卡內所有子節點的
       語意都被移除，所以 .nf（未讀、作者、回應／閱讀／註記數）也必須被
       describedby 明確參照，否則報讀器一律拿不到。 */
    /* 座標存的是 viewBox 單位（100% 字級下的 px），畫成 rem 讓整張畫布
       隨字級等比縮放——貼文寬度本來就會長，座標不跟著長就會互相重疊。 */
    return '<div class="' + cls + ' ' + (scls || '') +
      '" style="left:' + (n.x / 20) + 'rem;top:' + (n.y / 20) + 'rem"' +
      ' data-note="' + n.id + '" tabindex="0" role="button"' +
      /* 只有在選取模式下才是「可切換」的按鈕。非選取模式輸出 aria-pressed
         會讓報讀器把每一張貼文都唸成「未按下」。 */
      (KBSEL === v.id ? ' aria-pressed="' + (KBPICK[n.id] ? 'true' : 'false') + '"' : '') +
      ' aria-labelledby="nt-' + n.id + '" aria-describedby="nb-' + n.id + ' nf-' + n.id + '">' +
      '<div class="nt" id="nt-' + n.id + '">' + esc(n.title) + '</div>' +
      (scaf ? '<div class="small" style="color:var(--' + ((scaffold(scaf.s) || {}).cls || '').replace('sc', 'sc-') +
        ');font-size:0.55rem;font-weight:600;margin-bottom:2px">' + esc(scaffoldLabel(scaf.s)) + '</div>' : '') +
      '<div class="nb" id="nb-' + n.id + '">' + esc((scaf ? scaf.text : '').slice(0, 90)) + '</div>' +
      /* 未讀原本只用一條顏色細線傳達（1.4.1），補一個記號與報讀器文字。
         放在 .nf 那一列，不要放標題前——卡片只有 13.2rem 寬，會提早折行。 */
      '<div class="nf" id="nf-' + n.id + '">' +
        (isUnread(n) ? '<span class="sr-only">未讀。</span>' +
                       '<span class="unread-dot" aria-hidden="true">●</span>' : '') +
        '<span>' + esc(noteAuthors(n)) + '</span>' +
        /* 符號各補一段報讀器文字，否則會被唸成符號名 */
        (childrenOf(n.id).length ? '<span><span aria-hidden="true">↳</span>' + childrenOf(n.id).length +
          '<span class="sr-only"> 則回應</span></span>' : '') +
        ((n.reads || []).length ? '<span><span aria-hidden="true">👁</span>' + n.reads.length +
          '<span class="sr-only"> 人已讀</span></span>' : '') +
        ((n.annotations || []).length ? '<span><span aria-hidden="true">✎</span>' + n.annotations.length +
          '<span class="sr-only"> 則註記</span></span>' : '') +
      '</div></div>';
  }).join('');

  // 連線
  const pos = {};
  /* 連線畫在 viewBox 0 0 1600 1100 的座標系裡，那是固定的：畫布改用 rem
     之後整張圖等比縮放，錨點不可以再乘上當下的字級（乘了的話，
     改字級不會重繪畫布，座標會停在改字級前的值）。
     264 就是 13.2rem 在 100% 字級下的值，也就是一個 viewBox 單位的卡寬。 */
  const NOTE_W = 264;
  ns.forEach(function(n){ pos[n.id] = {x: n.x + NOTE_W / 2 - 24, y: n.y + 40}; });
  const edges = [];
  ns.forEach(function(n){
    if (n.buildOn && pos[n.buildOn]) edges.push(curve(pos[n.buildOn], pos[n.id], 'build'));
    (n.contains || []).forEach(function(c){ if (pos[c]) edges.push(curve(pos[c], pos[n.id], 'rise')); });
    (n.refs || []).forEach(function(r){ if (pos[r.noteId]) edges.push(curve(pos[r.noteId], pos[n.id], 'ref')); });
  });

  return sectionHead(v.title, v.desc, '<a class="btn" href="#/kb">← 所有視圖</a>' +
      (isTeacher() ? '<a class="btn" href="#/synth/' + v.id + '">想法串綜整</a>' : '')) +
    (it ? '<div class="card card-p" style="margin-bottom:14px;border-left:3px solid var(--q2)">' +
      '<div class="eyebrow">這個視圖從哪裡來</div>' +
      /* 學生只看到作業名稱的純文字：那條連結會直接把他帶到含 16 題正解的分析頁 */
      '<p class="small" style="margin-top:6px">來自 ' + (isTeacher() ? '<a href="#/assign/' + v.origin.aid + '">' : '<span>') +
      esc((getAssignment(v.origin.aid) || {}).title || '') + (isTeacher() ? '</a>' : '</span>') +
      /* 「迷思」是教師與研究端的術語，不放在學生每天要進來的社群空間裡。
         在這裡把一張視圖標成「源自迷思題」，等於當著全班的面宣告這是
         「大家答錯的那題」——與知識建構論「真實想法、真實問題」的預設相反。 */
      (isTeacher() ? ' 第 ' + it.no + ' 題的 KIDMAP 迷思象限。</p>'
                   : ' 第 ' + it.no + ' 題。這一題有不少同學讀法不一樣，所以拿出來一起想。</p>') +
      '<div class="item"><div class="stem">' + esc(it.stem) + '</div>' +
      '<div class="muted small">' + it.options.map(function(o, k){ return String.fromCharCode(65 + k) + '. ' + esc(o); }).join('　') + '</div></div>' +
      '</div>' : '') +
    '<div class="kb-toolbar">' +
      '<button class="btn primary sm" data-act="new-note" data-id="' + v.id + '">貼一則新想法</button>' +
      '<button class="btn sm' + (KBSEL === v.id ? ' primary' : '') +
        '" data-act="toggle-sel" data-id="' + v.id + '">' +
        (KBSEL === v.id ? '選取中（' + Object.keys(KBPICK).length + '）' : '選取貼文做躍升') + '</button>' +
      (KBSEL === v.id && Object.keys(KBPICK).length >= 2 ?
        '<button class="btn sm" data-act="make-rise" data-id="' + v.id + '">建立躍升貼文</button>' : '') +
      '<div class="spacer"></div>' +
      '<span class="legend small">' +
        '<span><i class="swatch" style="background:var(--accent)"></i>延伸</span>' +
        '<span><i class="swatch" style="background:var(--sc-6)"></i>躍升收攏</span>' +
        '<span><i class="swatch" style="background:var(--sc-5)"></i>引用</span>' +
      '</span>' +
    '</div>' +
    '<div class="canvas" id="canvas"><div class="canvas-inner" id="canvasInner">' +
      '<svg class="edges" viewBox="0 0 1600 1100" preserveAspectRatio="none">' + edges.join('') + '</svg>' +
      notesHTML + '</div></div>' +
    '<div class="row" style="margin-top:10px"><span class="muted small">拖曳貼文可以重新安排版面，位置會存下來。' +
    '點一下貼文開啟完整內容、延伸與註記。</span></div>' +
    '<div class="card" style="margin-top:16px"><div class="card-h"><h3>這個視圖的支架使用</h3></div><div class="card-p">' +
      scaffoldUsageBar(ns) + '</div></div>';
}

function curve(a, b, cls){
  const mx = (a.x + b.x) / 2;
  return '<path class="' + cls + '" d="M' + a.x + ' ' + a.y + ' C' + mx + ' ' + a.y + ' ' + mx + ' ' + b.y + ' ' + b.x + ' ' + b.y + '"/>';
}

function scaffoldUsageBar(ns){
  const c = {};
  ns.forEach(function(n){ (n.segs || []).forEach(function(g){ c[g.s] = (c[g.s] || 0) + 1; }); });
  const mx = Math.max.apply(null, SCAFFOLDS.map(function(s){ return c[s.id] || 0; }).concat([1]));
  return '<div class="col">' + SCAFFOLDS.map(function(s){
    const n = c[s.id] || 0;
    return '<div class="rub-row"><span class="' + s.cls + '" style="border-left:3px solid;padding-left:8px">' + esc(s.label) + '</span>' +
      '<div class="bar"><i style="width:' + (100 * n / mx) + '%;background:var(--' + s.cls.replace('sc', 'sc-') + ')"></i></div>' +
      '<span class="lv">' + n + '</span></div>';
  }).join('') + '</div>' +
  '<p class="muted small" style="margin-top:10px">支架分布反映論述的形態。若「' + esc(scaffoldLabel('s1')) + '」遠多於「' + esc(scaffoldLabel('s4')) + '」與「' + esc(scaffoldLabel('s5')) + '」，' +
  '代表大家在各說各話，想法還沒有真的被改進。</p>';
}

/* --- 貼文詳頁 --- */
function viewNote(nid){
  const gate = kbGate(); if (gate) return gate;
  const n = getNote(nid);
  if (!n) return '<div class="empty"><h3>找不到這則貼文</h3><a class="btn" href="#/kb">回知識建構空間</a></div>';
  /* 直接打網址也要擋，而且要在 markRead 之前——否則光是打開別班的貼文，
     就會把自己寫進那則貼文的 reads（那是 KB 指數的原料）。 */
  if (!viewVisible(n.viewId)) return kbScopeBlock();
  markRead(nid);
  const v = getView(n.viewId);
  const root = threadRootOf(n);
  const seq = threadOf(root.id);
  const fb = cacheGet('note', n.id);
  const me = currentUser();
  /* 畫面要反映守門。按鈕留著、按下去被擋，使用者收到的是假成功；
     按鈕直接消失又會讓老師找不到平常有的那顆鈕，所以要說一句。 */
  const canEdit = !isImpersonating() && (n.authorIds.indexOf(me.id) >= 0 || isTeacher());

  return sectionHead(n.title, (v ? v.title + '　·　' : '') + noteAuthors(n) + '　·　' + fmtDateTime(n.createdAt),
    '<a class="btn" href="#/kb/' + n.viewId + '">← 回視圖</a>' +
    (canEdit ? '<button class="btn sm" data-act="edit-note" data-id="' + n.id + '">編輯</button>' : '')) +
  (isImpersonating() ? '<div class="card card-p" style="margin-bottom:12px">' +
    '<p class="small" style="margin:0">代為檢視中，只能看不能改——編輯、刪除、加註記與' +
    '「重做這節課」都停用了，' +
    '你的操作不會記到這位學生名下。</p></div>' : '') +
  '<div class="grid" style="grid-template-columns:minmax(0,1.6fr) minmax(280px,1fr);gap:16px">' +
  '<div class="col">' +
    noteFullHTML(n, true) +
    '<div class="card"><div class="card-h"><h3>這條想法串</h3>' +
      '<span class="muted small">' + seq.length + ' 則</span></div><div class="card-p">' +
      seq.map(function(x){
        const cur = x.note.id === n.id;
        return '<div style="margin-left:' + (x.depth * 16) + 'px;margin-bottom:8px">' +
          '<div class="row" style="gap:8px"><span class="pill">' + (x.depth ? '↳' : '●') + '</span>' +
          (cur ? '<b>' + esc(x.note.title) + '</b>' : '<a href="#/note/' + x.note.id + '">' + esc(x.note.title) + '</a>') +
          '<span class="muted small">' + esc(noteAuthors(x.note)) + '</span>' +
          '<span class="pill">' + esc(epiLabelFor(x.note)) + '</span></div></div>';
      }).join('') + '</div></div>' +
    '<div class="card"><div class="card-h"><h3>延伸這則想法</h3></div><div class="card-p">' +
      '<div class="sc-btns" style="margin-bottom:10px">' + SCAFFOLDS.map(function(s){
        return '<button class="sc-btn ' + s.cls + '" data-act="buildon" data-id="' + n.id + '" data-sc="' + s.id + '">' +
          esc(s.label) + '</button>';
      }).join('') + '</div>' +
      '<p class="muted small">選一個支架開始寫。支架不是格式要求，是提醒你這一則想做的事：提出理論、指出不懂的地方、' +
      '帶進新資訊、挑戰現有說法、提出更好的版本，或把大家的想法綜整起來。</p></div></div>' +
  '</div>' +
  '<div class="col">' +
    /* 整張卡只給教師。它會給貼文作者「一個可以立刻做的下一步」——那就是
       個人化鷹架，四個條件都拿得到、不限次數、在 MAX_TURNS 之外，
       對照組因此會變成第四種處理。學生端唯一的 AI 通道是作答頁的夥伴。 */
    (isTeacher()
      ? '<div class="card"><div class="card-h"><h3>AI 形成性回饋</h3>' +
        '<button class="btn sm" data-act="ai-note" data-id="' + n.id + '">' + (fb ? '重新分析' : '分析') + '</button></div>' +
        '<div class="card-p"><div id="out-ai-note" class="' + (fb ? 'ai-out' : 'muted small') + '">' +
        (fb ? md(fb) : '會評這則貼文對社群知識的貢獻、想法改進落在哪一級，以及可以立刻做的下一步。不會直接給答案。') +
        '</div></div></div>'
      : '') +
    '<div class="card"><div class="card-h"><h3>註記</h3><span class="muted small">' + (n.annotations || []).length + ' 則</span></div>' +
      '<div class="card-p col">' + ((n.annotations || []).map(function(a){
        return '<div style="border-left:2px solid var(--rule);padding-left:10px">' +
          '<div class="muted small">' + esc(userName(a.authorId)) + '　' + fmtDate(a.at) + '</div>' +
          '<div class="small">' + nl2br(a.text) + '</div></div>';
      }).join('') || '<div class="muted small">還沒有人加註記。</div>') +
      '<div class="field" style="margin-top:8px"><textarea id="annText" placeholder="加一則註記（不會改動原貼文）"></textarea>' +
      '<button class="btn sm" data-act="add-ann" data-id="' + n.id + '">送出註記</button></div>' +
      '</div></div>' +
    '<div class="card"><div class="card-h"><h3>閱讀情形</h3></div><div class="card-p">' +
      '<div class="row" style="gap:5px">' + ((n.reads || []).map(function(r){
        return '<span class="pill">' + esc(userName(r)) + '</span>'; }).join('') || '<span class="muted small">還沒有人讀過。</span>') + '</div>' +
      '<p class="muted small" style="margin-top:10px">閱讀紀錄用來看社群是否真的在互相參照，不作為給分依據。</p></div></div>' +
  '</div></div>';
}

function noteFullHTML(n, full){
  const it = n.itemRef ? getItem(n.itemRef.iid) : null;
  return '<div class="card"><div class="card-p">' +
    '<div class="row" style="justify-content:space-between;margin-bottom:10px">' +
      '<span class="row" style="gap:6px">' +
        (n.kind === 'problem' ? '<span class="pill q2"><span class="dot"></span>共同問題</span>' : '') +
        (n.kind === 'rise' ? '<span class="pill" style="color:var(--sc-6);border-color:var(--sc-6)">躍升貼文</span>' : '') +
        '<span class="pill">' + esc(epiLabelFor(n)) + '</span>' +
      '</span>' +
      '<span class="meta">' + fmtDateTime(n.createdAt) + (n.editedAt ? '（已修改）' : '') + '</span>' +
    '</div>' +
    (n.segs || []).map(function(g){
      const s = scaffold(g.s) || {cls:'', label:''};
      return '<div class="sc-seg ' + s.cls + '"><span class="lab">' + esc(s.label) + '</span>' + nl2br(g.text) + '</div>';
    }).join('') +
    (it ? '<div class="item" style="margin-top:10px"><div class="eyebrow">連結的題目</div>' +
      '<div class="stem">' + esc(it.stem) + '</div></div>' : '') +
    ((n.refs || []).length ? '<div style="margin-top:10px"><div class="eyebrow">引用</div>' +
      n.refs.map(function(r){
        const t = getNote(r.noteId);
        return '<blockquote style="margin:6px 0;padding:6px 12px;border-left:3px solid var(--sc-5)">「' +
          esc(r.quote) + '」<div class="muted small">— <a href="#/note/' + r.noteId + '">' +
          esc(t ? t.title : '已刪除的貼文') + '</a></div></blockquote>';
      }).join('') + '</div>' : '') +
    ((n.contains || []).length ? '<div style="margin-top:10px"><div class="eyebrow">這則躍升收攏了</div>' +
      '<div class="row" style="gap:6px;margin-top:6px">' + n.contains.map(function(c){
        const t = getNote(c);
        return t ? '<a class="pill" href="#/note/' + c + '">' + esc(t.title) + '</a>' : '';
      }).join('') + '</div></div>' : '') +
    ((n.keywords || []).length ? '<div class="row" style="gap:5px;margin-top:10px">' +
      n.keywords.map(function(k){ return '<span class="pill">#' + esc(k) + '</span>'; }).join('') + '</div>' : '') +
    '<div class="meta" style="margin-top:12px">作者：' + esc(noteAuthors(n)) +
      '　·　被延伸 ' + childrenOf(n.id).length + ' 次　·　閱讀 ' + (n.reads || []).length + ' 人次</div>' +
    '</div></div>';
}

/* --- 貼文編輯器 --- */
function openNoteEditor(o){
  EDIT = {
    id: o.id || null,
    viewId: o.viewId,
    title: o.title || '',
    segs: o.segs && o.segs.length ? o.segs.slice() : [{s: o.scaffold || 's1', text:''}],
    keywords: (o.keywords || []).join('、'),
    authorIds: o.authorIds || [currentUser().id],
    buildOn: o.buildOn || null,
    contains: o.contains || [],
    refs: o.refs || [],
    kind: o.kind || 'note',
    x: o.x, y: o.y
  };
  renderEditor();
}

function renderEditor(opts){
  const parent = EDIT.buildOn ? getNote(EDIT.buildOn) : null;
  const others = state.notes.filter(function(n){ return n.id !== EDIT.id; });
  modal(
    '<div class="modal-h"><h3>' + (EDIT.id ? '編輯貼文' : (EDIT.kind === 'rise' ? '建立躍升貼文' : (parent ? '延伸：' + esc(parent.title) : '貼一則新想法'))) + '</h3>' +
    '<button class="btn sm ghost" data-act="close-modal">關閉</button></div>' +
    '<div class="modal-b col">' +
    (parent ? '<div class="ai-out small"><strong>你正在延伸：</strong>' + esc(parent.title) + '<br>' +
      esc(shortStem(noteText(parent))) + '</div>' : '') +
    '<div class="field"><label for="ntitle">標題</label>' +
      '<input id="ntitle" type="text" value="' + esc(EDIT.title) + '" placeholder="用一句話說出你的想法，不要只寫「我的答案」"></div>' +
    '<div><div class="eyebrow" style="margin-bottom:6px">支架段落</div>' +
    EDIT.segs.map(function(g, i){
      const s = scaffold(g.s) || SCAFFOLDS[0];
      return '<div class="sc-seg ' + s.cls + '" style="margin-bottom:12px">' +
        '<div class="row" style="margin-bottom:6px">' +
        '<select data-act="seg-sc" data-i="' + i + '" style="width:auto">' + SCAFFOLDS.map(function(x){
          return '<option value="' + x.id + '"' + (x.id === g.s ? ' selected' : '') + '>' + esc(x.label) + '</option>';
        }).join('') + '</select>' +
        '<span class="muted small">' + esc(s.hint) + '</span><div class="spacer"></div>' +
        (EDIT.segs.length > 1 ? '<button class="btn sm ghost" data-act="seg-del" data-i="' + i + '">移除</button>' : '') +
        '</div>' +
        '<textarea data-act="seg-text" data-i="' + i + '" placeholder="' + esc(s.hint) + '">' + esc(g.text) + '</textarea>' +
        '</div>';
    }).join('') +
    '<button class="btn sm" data-act="seg-add">＋ 再加一個支架段落</button></div>' +
    '<div class="field"><label for="nkw">關鍵詞（用、分隔）</label>' +
      '<input id="nkw" type="text" value="' + esc(EDIT.keywords) + '" placeholder="伏筆、線索、證據"></div>' +
    '<div class="field"><label for="nauth">共同作者</label>' +
      '<select id="nauth" multiple size="4">' + state.users.filter(function(u){ return u.role !== 'admin'; }).map(function(u){
        return '<option value="' + u.id + '"' + (EDIT.authorIds.indexOf(u.id) >= 0 ? ' selected' : '') + '>' + esc(u.name) + '</option>';
      }).join('') + '</select><span class="muted small">按住 Ctrl／⌘ 可以多選。知識建構鼓勵共同署名。</span></div>' +
    '<div class="field"><label for="nref">引用其他貼文</label>' +
      '<select id="nref" style="width:100%"><option value="">（不引用）</option>' +
      others.map(function(n){ return '<option value="' + n.id + '">' + esc(n.title) + ' — ' + esc(noteAuthors(n)) + '</option>'; }).join('') +
      '</select><input id="nquote" type="text" placeholder="引用的句子" style="margin-top:6px"></div>' +
    '</div>' +
    '<div class="modal-f"><button class="btn" data-act="close-modal">取消</button>' +
    (EDIT.id ? '<button class="btn danger" data-act="del-note" data-id="' + EDIT.id + '">刪除這則</button>' : '') +
    '<button class="btn primary" data-act="save-note">貼上去</button></div>',
    {wide:false, focus:(opts && opts.focus) || null});
}

function collectEditor(){
  const t = $('#ntitle'); if (t) EDIT.title = t.value;
  const k = $('#nkw'); if (k) EDIT.keywords = k.value;
  const a = $('#nauth');
  if (a) EDIT.authorIds = Array.prototype.slice.call(a.selectedOptions).map(function(o){ return o.value; });
  $$('[data-act="seg-text"]').forEach(function(el){ EDIT.segs[+el.dataset.i].text = el.value; });
  const r = $('#nref'), q = $('#nquote');
  if (r && r.value && q && q.value.trim()){
    EDIT.refs = [{noteId:r.value, quote:q.value.trim()}];
  }
}

function saveEditor(){
  collectEditor();
  if (!EDIT.title.trim()){ toast('請先給這則貼文一個標題。'); return; }
  if (!EDIT.segs.some(function(g){ return g.text.trim(); })){ toast('至少寫一段內容再貼上去。'); return; }
  const kws = EDIT.keywords.split(/[、,，\s]+/).filter(Boolean);
  const payload = {title:EDIT.title.trim(), segs:EDIT.segs.filter(function(g){ return g.text.trim(); }),
                   keywords:kws, authorIds:EDIT.authorIds, refs:EDIT.refs};
  if (EDIT.id){
    const n2 = updateNote(EDIT.id, payload);
    toast(n2 ? '已更新。' : '代為檢視時不能替學生改貼文。');
  } else {
    const n = createNote(Object.assign({viewId:EDIT.viewId, buildOn:EDIT.buildOn, kind:EDIT.kind,
      contains:EDIT.contains, x:EDIT.x, y:EDIT.y}, payload));
    /* createNote 在代為檢視時回 null。不檢查的話會先跳「已貼上去」的成功訊息，
       再在 n.id 丟 TypeError——使用者看到的是「大聲的假成功」。 */
    if (!n){ closeModal(); EDIT = null; toast('代為檢視時不能替學生貼想法。'); return; }
    toast('已貼上去。想法現在屬於社群了。');
    closeModal(); EDIT = null; go('#/note/' + n.id); return;
  }
  closeModal(); EDIT = null; render();
}

/* --- 想法串綜整 --- */
function viewSynth(vid){
  const gate = kbGate(); if (gate) return gate;
  const v = getView(vid);
  if (!v) return '<div class="empty"><h3>找不到這個視圖</h3></div>';
  const roots = notesOfView(vid).filter(function(n){ return !n.buildOn; });
  const sel = viewSynth.sel && roots.some(function(r){ return r.id === viewSynth.sel; }) ? viewSynth.sel : (roots[0] || {}).id;
  viewSynth.sel = sel;
  if (!sel) return '<div class="empty"><h3>這個視圖還沒有貼文</h3></div>';
  const ii = ideaImprovement(sel);
  const cached = cacheGet('thread', sel);

  return sectionHead('想法串綜整', v.title, '<a class="btn" href="#/kb/' + vid + '">← 回視圖</a>') +
    '<div class="row" style="margin-bottom:14px">' + roots.map(function(r){
      return '<button class="btn sm' + (r.id === sel ? ' primary' : '') + '" data-act="synth-sel" data-id="' + r.id + '">' +
        esc(shortStem(r.title)) + '</button>';
    }).join('') + '</div>' +
    '<div class="grid" style="grid-template-columns:minmax(0,1fr) minmax(300px,.9fr);gap:16px">' +
    '<div class="card"><div class="card-h"><h3>想法改進軌跡</h3>' +
      '<span class="pill">' + esc(ii.arc) + '</span></div><div class="card-p col">' +
      ii.steps.map(function(s){
        return '<div style="margin-left:' + (s.depth * 18) + 'px" class="note-full">' +
          '<div class="row" style="justify-content:space-between">' +
          '<a href="#/note/' + s.note.id + '"><b>' + esc(s.note.title) + '</b></a>' +
          '<span class="pill">第 ' + s.level + ' 級</span></div>' +
          '<div class="meta">' + esc(noteAuthors(s.note)) + '　·　' +
          s.scaffolds.map(function(x){ return esc(scaffoldLabel(x)); }).join('／') + '</div>' +
          (s.newTerms.length ? '<div class="small" style="margin-top:6px">新出現的詞彙：' +
            s.newTerms.map(function(w){ return '<span class="pill">' + esc(w) + '</span>'; }).join(' ') + '</div>' : '') +
          '</div>';
      }).join('') + '</div></div>' +
    '<div class="col">' +
      '<div class="card"><div class="card-h"><h3>AI 綜整建議</h3>' +
        '<button class="btn sm" data-act="ai-thread" data-id="' + sel + '">' + (cached ? '重新分析' : '分析') + '</button></div>' +
        '<div class="card-p"><div id="out-ai-thread" class="' + (cached ? 'ai-out' : 'muted small') + '">' +
        (cached ? md(cached) : '會判讀這條想法串走到哪裡、還有哪些問題沒解決，並給一則可以直接貼上去的躍升貼文草稿。') +
        '</div></div></div>' +
      '<div class="card"><div class="card-h"><h3>由討論命題</h3>' +
        '<button class="btn sm" data-act="items-from-view" data-id="' + vid + '">產生後測題</button></div>' +
        '<div class="card-p"><div id="out-fromview" class="muted small">' +
        '把討論中形成的共同理解轉成 2–3 道新題目，用來檢核這個理解是不是真的可以遷移。' +
        '這一步讓「討論 → 再評量」的迴圈閉合。</div></div></div>' +
    '</div></div>';
}
