/* ==========================================================================
   80-ui-core.js — 外殼、路由、共用元件與圖形
   ========================================================================== */

const $ = function(s, r){ return (r || document).querySelector(s); };
const $$ = function(s, r){ return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

let ROUTE = {name:'teacher', args:[]};

function go(hash){ location.hash = hash; }
/* 已知路由白名單。逐條抄自 99-app.js 的 render() switch；
   新增 case 時這裡要同步，否則新路由會被當成未知而不重繪。
   有這道白名單，頁內錨點（#stage、#anything）就不會把畫面打成 404。 */
const KNOWN_ROUTES = {teacher:1, create:1, assign:1, kb:1, note:1, synth:1, dash:1,
  bank:1, settings:1, about:1, research:1, aal:1, inspect:1, survey:1,
  student:1, quiz:1, result:1, mygrowth:1};

function parseRoute(){
  const h = (location.hash || '#/teacher').replace(/^#\/?/, '');
  const parts = h.split('/').filter(Boolean);
  const name = parts[0] || 'teacher';
  if (!KNOWN_ROUTES[name] && typeof ROUTE !== 'undefined' && ROUTE) return ROUTE;
  return {name: name, args: parts.slice(1)};
}

function toast(msg){
  const r = $('#toastRoot');
  r.innerHTML = '<div class="toast">' + esc(msg) + '</div>';
  clearTimeout(toast._t);
  toast._t = setTimeout(function(){ r.innerHTML = ''; }, 2600);
}

function modal(html, opts){
  opts = opts || {};
  const r = $('#modalRoot');
  r.innerHTML = '<div class="modal-back" data-act="modal-back"><div class="modal' +
    (opts.wide ? ' wide' : '') + '" role="dialog" aria-modal="true">' + html + '</div></div>';
  const first = r.querySelector('input,textarea,select,button');
  if (first) first.focus();
}
function closeModal(){ $('#modalRoot').innerHTML = ''; }

/* --- 外殼 --- */
function renderShell(){
  const sel = $('#who');
  const groups = [
    {label:'教師與管理', users: state.users.filter(function(u){ return u.role !== 'student'; })},
    {label:'學生', byClass: true}
  ];
  sel.innerHTML = groups.map(function(g){
    if (g.byClass){
      return state.classes.map(function(k){
        return '<optgroup label="' + esc(k.name) + '（' + esc(condition(k.condition).name) + '）">' +
          k.studentIds.map(function(sid){
            const u = getUser(sid);
            return '<option value="' + u.id + '"' + (u.id === state.ui.role ? ' selected' : '') + '>' +
              esc(u.name) + '</option>';
          }).join('') + '</optgroup>';
      }).join('');
    }
    return '<optgroup label="' + esc(g.label) + '">' + g.users.map(function(u){
      return '<option value="' + u.id + '"' + (u.id === state.ui.role ? ' selected' : '') + '>' +
        esc(u.name) + '（' + roleName(u.role) + '）</option>';
    }).join('') + '</optgroup>';
  }).join('');

  /* 教師視角的班級選擇器（學生看不到） */
  const cw = $('#classWrap');
  if (isTeacher()){
    cw.style.display = '';
    $('#classSel').innerHTML = state.classes.map(function(k){
      return '<option value="' + k.id + '"' + (k.id === state.ui.classId ? ' selected' : '') + '>' +
        esc(k.name) + '　·　' + esc(condition(k.condition).name) + '</option>';
    }).join('');
  } else {
    cw.style.display = 'none';
  }
  renderRail();
}
function roleName(r){ return r === 'admin' ? '管理員' : r === 'teacher' ? '老師' : '學生'; }

/* 深層頁面對應到側欄的哪一個項目。沒有這張表，學生在作答頁時
   側欄不會有任何一項被標成「目前位置」。 */
const RAIL_PARENT = {quiz:'student', result:'student', aal:'student',
  note:'kb', synth:'kb', inspect:'assign', create:'teacher'};

function renderRail(){
  const unread = state.notes.filter(isUnread).length;
  const me = currentUser();
  /* 三種導覽：研究者（super user，看得到全部）、教師（只看教學會用到的四項）、學生。
     研究控制台、建立派題、題庫與系統設定屬於研究者的工具，不進教師的側欄。 */
  const nav = me.role === 'admin' ? [
    {g:'評量'},
    {h:'#/teacher', g2:'教', t:'教師後台'},
    {h:'#/create',  g2:'派', t:'建立派題'},
    {h:'#/assign/a-pre', g2:'診', t:'派題分析'},
    {g:'評量即學習'},
    {h:'#/research', g2:'研', t:'研究控制台'},
    {g:'知識建構'},
    {h:'#/kb', g2:'構', t:'知識建構空間', b: unread ? unread : null},
    {h:'#/dash', g2:'雙', t:'雙軌評量儀表板'},
    {g:'設定'},
    {h:'#/bank', g2:'庫', t:'文本與題庫'},
    {h:'#/settings', g2:'設', t:'系統設定'},
    {h:'#/about', g2:'說', t:'系統說明與研究設計'}
  ] : me.role === 'teacher' ? [
    {g:'評量'},
    {h:'#/teacher', g2:'教', t:'教師後台'},
    {h:'#/assign/a-pre', g2:'診', t:'派題分析'},
    {g:'知識建構'},
    {h:'#/kb', g2:'構', t:'知識建構中心', b: unread ? unread : null},
    {h:'#/dash', g2:'雙', t:'雙軌評量儀表板'}
  ] : [
    {g:'我的學習'},
    {h:'#/student', g2:'業', t:'我的作業'},
    {h:'#/kb', g2:'構', t:'知識建構空間',
     b: kbLocked(me) ? '測驗後開放' : (unread ? unread : null)},
    {h:'#/mygrowth', g2:'長', t:'我的學習軌跡'},
    {g:'問卷'},
    {h:'#/survey/pre',  g2:'前', t:'課前問卷', b: surveyOf(me.id, 'pre')  ? null : '待填'},
    {h:'#/survey/post', g2:'後', t:'課後問卷', b: surveyOf(me.id, 'post') ? null : (submitted('a-post', me.id) ? '待填' : '上完課再填')},
    {g:'關於'},
    {h:'#/about', g2:'說', t:'系統說明'}
  ];
  $('#rail').innerHTML = nav.map(function(n){
    if (n.g) return '<div class="rail-group">' + esc(n.g) + '</div>';
    const parts = n.h.replace(/^#\//, '').split('/');
    /* 深層頁面（作答、結果、單篇貼文、唯讀重播…）在側欄沒有自己的項目，
       要點亮它的來源項目，否則使用者永遠不知道自己在哪一區。 */
    const base = RAIL_PARENT[ROUTE.name] || ROUTE.name;
    const same = base === parts[0] &&
      (parts.length < 2 || parts[0] === 'assign' || base !== ROUTE.name || ROUTE.args[0] === parts[1]);
    const cur = same ? ' aria-current="page"' : '';
    /* 徽章在窄版會被 CSS 隱藏，所以另外給一份只有報讀器聽得到的文字，
       否則「待填」「測驗後開放」這些狀態在手機上等於消失。 */
    const badge = n.b
      ? '<span class="badge" aria-hidden="true">' + esc(String(n.b)) + '</span>' +
        '<span class="sr-only">（' + esc(String(n.b)) + '）</span>'
      : '';
    return '<a href="' + n.h + '"' + cur + '><span class="glyph">' + n.g2 + '</span>' + esc(n.t) +
      badge + '</a>';
  }).join('');
}

/* --- 共用小元件 --- */
/* 理解歷程標籤。形狀記號與文字並用，不以顏色單獨傳達訊息（WCAG 1.4.1）。 */
function procPill(pid){
  const p = processOf(pid);
  if (!p) return '';
  return '<span class="pill ' + p.cls + '"><span aria-hidden="true">' + p.mark + '</span>' +
    esc(p.name) + '</span>';
}
/* 一道題目的識別標籤：文本 · 理解歷程 · 難度。教師與研究端專用。 */
function itemPills(it){
  if (!it) return '';
  return '<span class="pill">' + esc(textTitle(it.unit)) + '</span>' +
    procPill(it.process) +
    '<span class="pill">' + esc(it.diff) + '</span>';
}
/* 學生看得到的版本：只有文本名。
   歷程標定是相對歷程編碼（RQ4）的判定基準，受試者不該看到基準；
   難度標籤則等於直接告訴學生「這題你大概答不出來」。 */
function itemPillsStudent(it){
  if (!it) return '';
  return '<span class="pill">' + esc(textTitle(it.unit)) + '</span>';
}

function qpill(q, n){
  const Q = QUAD[q];
  return '<span class="pill ' + Q.key + '"><span class="dot"></span>' + Q.roman + ' ' + Q.short +
    (n === undefined ? '' : ' <b class="num">' + n + '</b>') + '</span>';
}
function statCard(k, v, s, cls){
  return '<div class="stat ' + (cls || '') + '"><div class="k">' + esc(k) + '</div>' +
    '<div class="v">' + v + '</div>' + (s ? '<div class="s">' + s + '</div>' : '') + '</div>';
}
function sectionHead(title, sub, right){
  return '<div class="row" style="justify-content:space-between;align-items:flex-end;margin-bottom:14px">' +
    '<div><h2>' + esc(title) + '</h2>' + (sub ? '<div class="muted small">' + esc(sub) + '</div>' : '') + '</div>' +
    '<div class="row">' + (right || '') + '</div></div>';
}
function quadLegend(){
  return '<div class="legend">' + [1,2,3,4].map(function(q){
    return '<span><i class="swatch" style="background:var(--' + QUAD[q].key + ')"></i>' +
      QUAD[q].roman + ' ' + QUAD[q].name + '</span>';
  }).join('') + '</div>';
}

/* --- KIDMAP：個別學生四象限圖 --- */
/* 學生版的四象限用語。同一份資料、同一個幾何，只換說法——
   十歲孩子看不懂 θ、δ (logit)、「迷思象限」，而且「迷思」是個標籤。
   教師端與研究端一律走預設（student=false），計算與匯出一個字不動。 */
const QUAD_STUDENT = {
  1: '比較難，你答對了',
  2: '可惜，你其實讀得懂',
  3: '比較難，這次沒答對',
  4: '你穩穩答對'
};
function quadLegendStudent(){
  return '<div class="legend">' + [1,2,3,4].map(function(q){
    return '<span><i class="swatch" style="background:var(--' + QUAD[q].key + ')"></i>' +
      esc(QUAD_STUDENT[q]) + '</span>';
  }).join('') + '</div>';
}

function kidmapSVG(diag, ps, student){
  const W = 620, H = 400, m = {t:26, r:18, b:34, l:52};
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const ds = diag.perItem.map(function(p){ return p.delta; });
  let lo = Math.min.apply(null, ds.concat([ps.theta])) - 0.7;
  let hi = Math.max.apply(null, ds.concat([ps.theta])) + 0.7;
  if (!isFinite(lo) || !isFinite(hi) || hi - lo < 1){ lo = -3; hi = 3; }
  const Y = function(d){ return m.t + ih * (hi - d) / (hi - lo); };
  const yTheta = Y(ps.theta);
  const xW = m.l + iw * 0.27, xR = m.l + iw * 0.73;

  const parts = [];
  parts.push('<svg class="kidmap" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + (student ? '你這次的閱讀地圖' : 'KIDMAP 四象限圖') + '">');
  // 四個象限底色
  parts.push('<rect x="' + m.l + '" y="' + m.t + '" width="' + (iw / 2) + '" height="' + (yTheta - m.t) + '" fill="var(--q3-bg)"/>');
  parts.push('<rect x="' + (m.l + iw / 2) + '" y="' + m.t + '" width="' + (iw / 2) + '" height="' + (yTheta - m.t) + '" fill="var(--q1-bg)"/>');
  parts.push('<rect x="' + m.l + '" y="' + yTheta + '" width="' + (iw / 2) + '" height="' + (m.t + ih - yTheta) + '" fill="var(--q2-bg)"/>');
  parts.push('<rect x="' + (m.l + iw / 2) + '" y="' + yTheta + '" width="' + (iw / 2) + '" height="' + (m.t + ih - yTheta) + '" fill="var(--q4-bg)"/>');
  // 象限標籤
  parts.push('<text class="qlabel" x="' + (m.l + 8) + '" y="' + (m.t + 14) + '" fill="var(--q3)">' + (student ? QUAD_STUDENT[3] : 'III 合理答錯') + '</text>');
  parts.push('<text class="qlabel" x="' + (m.l + iw - 8) + '" y="' + (m.t + 14) + '" text-anchor="end" fill="var(--q1)">' + (student ? QUAD_STUDENT[1] : 'I 優勢概念') + '</text>');
  parts.push('<text class="qlabel" x="' + (m.l + 8) + '" y="' + (m.t + ih - 8) + '" fill="var(--q2)">' + (student ? QUAD_STUDENT[2] : 'II 迷思概念') + '</text>');
  parts.push('<text class="qlabel" x="' + (m.l + iw - 8) + '" y="' + (m.t + ih - 8) + '" text-anchor="end" fill="var(--q4)">' + (student ? QUAD_STUDENT[4] : 'IV 合理答對') + '</text>');
  // 框線與分隔
  parts.push('<rect class="axis" x="' + m.l + '" y="' + m.t + '" width="' + iw + '" height="' + ih + '" fill="none"/>');
  parts.push('<line class="axis" x1="' + (m.l + iw / 2) + '" y1="' + m.t + '" x2="' + (m.l + iw / 2) + '" y2="' + (m.t + ih) + '"/>');
  parts.push('<line class="theta" x1="' + m.l + '" y1="' + yTheta + '" x2="' + (m.l + iw) + '" y2="' + yTheta + '"/>');
  parts.push('<text x="' + (m.l + iw + 4) + '" y="' + (yTheta + 4) + '" fill="var(--accent)">' + (student ? '你' : 'θ') + '</text>');
  // δ 刻度
  for (let v = Math.ceil(lo); v <= Math.floor(hi); v++){
    parts.push('<line class="axis" x1="' + (m.l - 4) + '" y1="' + Y(v) + '" x2="' + m.l + '" y2="' + Y(v) + '"/>');
    if (!student) parts.push('<text x="' + (m.l - 8) + '" y="' + (Y(v) + 3) + '" text-anchor="end">' + v + '</text>');
  }
  parts.push('<text x="' + (m.l - 40) + '" y="' + (m.t + ih / 2) + '" transform="rotate(-90 ' + (m.l - 40) + ' ' + (m.t + ih / 2) + ')" text-anchor="middle">' + (student ? '題目的難度（上面比較難）' : '試題難度 δ (logit)') + '</text>');
  parts.push('<text x="' + xW + '" y="' + (H - 12) + '" text-anchor="middle">答錯</text>');
  parts.push('<text x="' + xR + '" y="' + (H - 12) + '" text-anchor="middle">答對</text>');
  // 資料點
  const used = {};
  ps.cells.forEach(function(c){
    const base = c.correct ? xR : xW;
    const key = Math.round(Y(c.delta) / 12);
    used[key] = (used[key] || 0);
    const off = (used[key] % 5 - 2) * 26;
    used[key]++;
    const cx = base + off, cy = Y(c.delta);
    const col = 'var(--' + QUAD[c.q].key + ')';
    parts.push('<circle cx="' + cx + '" cy="' + cy + '" r="9" fill="' + col + '" fill-opacity="0.9" stroke="var(--card)" stroke-width="1.5"><title>第 ' +
      getItem(c.iid).no + ' 題 · ' + (student ? QUAD_STUDENT[c.q]
        : QUAD[c.q].name + ' · δ=' + fx(c.delta) + ' · 預期答對率 ' + pct(c.p)) + '</title></circle>');
    parts.push('<text x="' + cx + '" y="' + (cy + 3.2) + '" text-anchor="middle" fill="var(--card)" style="font-size:9px;font-weight:600">' +
      getItem(c.iid).no + '</text>');
  });
  parts.push('</svg>');
  return parts.join('');
}

/* --- 直方圖（成績分佈） --- */
function histSVG(values, bins, label){
  const W = 460, H = 170, m = {t:10, r:10, b:26, l:28};
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const lo = 0, hi = Math.max.apply(null, values.concat([1]));
  const nb = bins || 10;
  const counts = new Array(nb).fill(0);
  values.forEach(function(v){ const k = Math.min(nb - 1, Math.floor((v - lo) / (hi - lo || 1) * nb)); counts[k]++; });
  const mx = Math.max.apply(null, counts.concat([1]));
  const bw = iw / nb;
  const p = ['<svg class="kidmap" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(label || '分佈') + '">'];
  counts.forEach(function(c, i){
    const h = ih * c / mx;
    p.push('<rect x="' + (m.l + i * bw + 1) + '" y="' + (m.t + ih - h) + '" width="' + (bw - 2) + '" height="' + h +
      '" fill="var(--accent)" fill-opacity="0.75"><title>' + Math.round(lo + (hi - lo) * i / nb) + '–' +
      Math.round(lo + (hi - lo) * (i + 1) / nb) + '：' + c + ' 人</title></rect>');
  });
  p.push('<line class="axis" x1="' + m.l + '" y1="' + (m.t + ih) + '" x2="' + (m.l + iw) + '" y2="' + (m.t + ih) + '"/>');
  p.push('<text x="' + m.l + '" y="' + (H - 8) + '">0</text>');
  p.push('<text x="' + (m.l + iw) + '" y="' + (H - 8) + '" text-anchor="end">' + Math.round(hi) + '</text>');
  p.push('<text x="' + (m.l + iw / 2) + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(label || '') + '</text>');
  p.push('</svg>');
  return p.join('');
}

/* --- 折線圖 --- */
function lineSVG(points, o){
  o = o || {};
  const W = o.w || 460, H = o.h || 180, m = {t:12, r:14, b:26, l:34};
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  if (!points.length) return '<div class="muted small">尚無資料</div>';
  const xs = points.map(function(p){ return p.x; }), ys = points.map(function(p){ return p.y; });
  const x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
  const y0 = 0, y1 = Math.max.apply(null, ys) * 1.1 || 1;
  const X = function(v){ return m.l + iw * (x1 === x0 ? 0.5 : (v - x0) / (x1 - x0)); };
  const Y = function(v){ return m.t + ih * (1 - (v - y0) / (y1 - y0)); };
  const d = points.map(function(p, i){ return (i ? 'L' : 'M') + X(p.x).toFixed(1) + ' ' + Y(p.y).toFixed(1); }).join(' ');
  const area = d + ' L' + X(points[points.length - 1].x).toFixed(1) + ' ' + (m.t + ih) + ' L' + X(points[0].x).toFixed(1) + ' ' + (m.t + ih) + ' Z';
  const p = ['<svg class="kidmap" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.label || '趨勢') + '">'];
  p.push('<path d="' + area + '" fill="var(--accent)" fill-opacity="0.10"/>');
  p.push('<path d="' + d + '" fill="none" stroke="var(--accent)" stroke-width="1.8"/>');
  const last = points[points.length - 1];
  p.push('<circle cx="' + X(last.x) + '" cy="' + Y(last.y) + '" r="4" fill="var(--accent)"/>');
  p.push('<line class="axis" x1="' + m.l + '" y1="' + (m.t + ih) + '" x2="' + (m.l + iw) + '" y2="' + (m.t + ih) + '"/>');
  p.push('<text x="' + m.l + '" y="' + (H - 8) + '">' + esc(o.x0 || '') + '</text>');
  p.push('<text x="' + (m.l + iw) + '" y="' + (H - 8) + '" text-anchor="end">' + esc(o.x1 || '') + '</text>');
  p.push('<text x="' + (m.l - 6) + '" y="' + (m.t + 8) + '" text-anchor="end">' + Math.round(y1) + '</text>');
  p.push('</svg>');
  return p.join('');
}

/* --- 社會網絡圖（環形佈局） --- */
function snaSVG(g){
  const W = 620, H = 620, cx = W / 2, cy = H / 2, R = 240;
  const n = g.ids.length;
  const pos = {};
  g.ids.forEach(function(id, i){
    const a = -Math.PI / 2 + 2 * Math.PI * i / n;
    pos[id] = {x: cx + R * Math.cos(a), y: cy + R * Math.sin(a), a: a};
  });
  const p = ['<svg class="sna" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="知識建構延伸網絡">'];
  g.edges.forEach(function(e){
    const a = pos[e.from], b = pos[e.to];
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const k = 0.28;
    const qx = cx + (mx - cx) * (1 - k), qy = cy + (my - cy) * (1 - k);
    p.push('<path d="M' + a.x.toFixed(1) + ' ' + a.y.toFixed(1) + ' Q' + qx.toFixed(1) + ' ' + qy.toFixed(1) +
      ' ' + b.x.toFixed(1) + ' ' + b.y.toFixed(1) + '" fill="none" stroke="var(--accent)" stroke-opacity="' +
      Math.min(0.75, 0.25 + e.w * 0.2) + '" stroke-width="' + Math.min(4, e.w * 1.2) + '"><title>' +
      esc(userName(e.from)) + ' 延伸 ' + esc(userName(e.to)) + '（' + e.w + ' 次）</title></path>');
  });
  g.ids.forEach(function(id){
    const d = g.deg[id], tot = d.in + d.out;
    const r = 5 + Math.min(11, tot * 1.6);
    const col = tot === 0 ? 'var(--ink-4)' : (d.in >= d.out ? 'var(--q1)' : 'var(--q4)');
    const q = pos[id];
    p.push('<circle cx="' + q.x.toFixed(1) + '" cy="' + q.y.toFixed(1) + '" r="' + r + '" fill="' + col +
      '"><title>' + esc(userName(id)) + '：延伸他人 ' + d.out + ' 次、被延伸 ' + d.in + ' 次</title></circle>');
    const lx = cx + (R + 26) * Math.cos(q.a), ly = cy + (R + 26) * Math.sin(q.a);
    const anchor = Math.cos(q.a) > 0.2 ? 'start' : (Math.cos(q.a) < -0.2 ? 'end' : 'middle');
    p.push('<text x="' + lx.toFixed(1) + '" y="' + (ly + 3).toFixed(1) + '" text-anchor="' + anchor + '">' + esc(userName(id)) + '</text>');
  });
  p.push('</svg>');
  return p.join('');
}

/* --- 雙軌散布圖 --- */
function dualSVG(dt){
  const W = 620, H = 420, m = {t:22, r:20, b:40, l:52};
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const rows = dt.rows.filter(function(r){ return r.delta != null; });
  if (!rows.length) return '<div class="muted small">需要前測與後測都完成才能繪製。</div>';
  const ds = rows.map(function(r){ return r.delta; });
  const lo = Math.min.apply(null, ds) - 0.2, hi = Math.max.apply(null, ds) + 0.2;
  const X = function(v){ return m.l + iw * (v - lo) / (hi - lo || 1); };
  const Y = function(v){ return m.t + ih * (1 - v / 100); };
  const xm = X(dt.dmed), ym = Y(dt.kmed);
  const p = ['<svg class="kidmap" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="雙軌評量散布圖">'];
  p.push('<rect x="' + m.l + '" y="' + m.t + '" width="' + (xm - m.l) + '" height="' + (ym - m.t) + '" fill="var(--q2-bg)"/>');
  p.push('<rect x="' + xm + '" y="' + m.t + '" width="' + (m.l + iw - xm) + '" height="' + (ym - m.t) + '" fill="var(--q1-bg)"/>');
  p.push('<rect x="' + m.l + '" y="' + ym + '" width="' + (xm - m.l) + '" height="' + (m.t + ih - ym) + '" fill="var(--q3-bg)"/>');
  p.push('<rect x="' + xm + '" y="' + ym + '" width="' + (m.l + iw - xm) + '" height="' + (m.t + ih - ym) + '" fill="var(--q4-bg)"/>');
  p.push('<text class="qlabel" x="' + (m.l + 8) + '" y="' + (m.t + 14) + '" fill="var(--q2)">B 論述未轉化</text>');
  p.push('<text class="qlabel" x="' + (m.l + iw - 8) + '" y="' + (m.t + 14) + '" text-anchor="end" fill="var(--q1)">A 共構轉化</text>');
  p.push('<text class="qlabel" x="' + (m.l + 8) + '" y="' + (m.t + ih - 8) + '" fill="var(--q3)">D 需要介入</text>');
  p.push('<text class="qlabel" x="' + (m.l + iw - 8) + '" y="' + (m.t + ih - 8) + '" text-anchor="end" fill="var(--q4)">C 個別成長</text>');
  p.push('<rect class="axis" x="' + m.l + '" y="' + m.t + '" width="' + iw + '" height="' + ih + '" fill="none"/>');
  p.push('<line class="theta" x1="' + xm + '" y1="' + m.t + '" x2="' + xm + '" y2="' + (m.t + ih) + '"/>');
  p.push('<line class="theta" x1="' + m.l + '" y1="' + ym + '" x2="' + (m.l + iw) + '" y2="' + ym + '"/>');
  rows.forEach(function(r){
    const x = X(r.delta), y = Y(r.kbi);
    p.push('<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="6" fill="var(--' + DUAL_ZONE[r.zone].cls +
      ')" fill-opacity="0.9" stroke="var(--card)" stroke-width="1.4"><title>' + esc(userName(r.sid)) +
      '　Δθ=' + fx(r.delta) + '　KB 指數=' + r.kbi + '　' + DUAL_ZONE[r.zone].name + '</title></circle>');
  });
  p.push('<text x="' + (m.l + iw / 2) + '" y="' + (H - 10) + '" text-anchor="middle">能力變化 Δθ（後測 − 前測，logit）</text>');
  p.push('<text x="18" y="' + (m.t + ih / 2) + '" transform="rotate(-90 18 ' + (m.t + ih / 2) + ')" text-anchor="middle">知識建構指數（0–100）</text>');
  p.push('<text x="' + (m.l - 8) + '" y="' + (m.t + 8) + '" text-anchor="end">100</text>');
  p.push('<text x="' + (m.l - 8) + '" y="' + (m.t + ih) + '" text-anchor="end">0</text>');
  p.push('</svg>');
  return p.join('');
}

/* --- 四象限橫條（每題） --- */
function quadBar(q, n){
  if (!n) return '<div class="bar"></div>';
  const seg = [2,1,3,4].map(function(k){
    const w = 100 * q[k] / n;
    return w > 0 ? '<i style="width:' + w + '%;background:var(--' + QUAD[k].key + ')"></i>' : '';
  }).join('');
  return '<div class="bar" style="display:flex">' + seg + '</div>';
}

/* --- AI 輸出區塊 --- */
function aiBlock(id, title, hint){
  return '<div class="card"><div class="card-h"><h3>' + esc(title) + '</h3>' +
    '<span class="pill">' + esc(engineLabel()) + '</span>' +
    '<button class="btn sm" data-act="' + esc(id) + '">開始分析</button></div>' +
    '<div class="card-p"><div id="out-' + esc(id) + '" class="muted small">' + esc(hint || '') + '</div></div></div>';
}
async function runAI(outId, fn, force){
  const box = document.getElementById('out-' + outId);
  if (!box) return;
  box.innerHTML = '<span class="muted small">分析中……</span>';
  try {
    const txt = await fn(force);
    box.className = 'ai-out';
    box.innerHTML = md(txt) +
      '<hr class="hr"><div class="row"><button class="btn sm" data-act="rerun-' + outId + '">重新分析（覆蓋快取）</button>' +
      '<span class="muted small">引擎：' + esc(engineLabel()) + '</span></div>';
  } catch (e) {
    box.className = 'ai-out';
    box.innerHTML = '<p><strong>分析失敗</strong></p><p>' + esc(e.message) + '</p>' +
      '<p class="muted small">你仍然可以在「系統設定」把引擎切回<strong>內建規則引擎</strong>，所有分析功能都能離線運作。</p>';
  }
}
