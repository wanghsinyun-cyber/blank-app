/* ==========================================================================
   94-ui-research.js — 研究控制台
   條件分派、對話設計（8 個提示模組）、LSA、ENA、情感軌跡、效果檢定、匯出
   ========================================================================== */

let RTAB = 'design';

function viewResearch(){
  const tabs = [['design','對話設計'],['assign','條件分派'],['lsa','序列分析 LSA'],
                ['ena','認知網絡 ENA'],['sent','情感軌跡'],['stats','效果檢定'],['export','資料匯出']];
  let body = '';
  if (RTAB === 'design') body = rDesign();
  else if (RTAB === 'assign') body = rAssign();
  else if (RTAB === 'lsa') body = rLSA();
  else if (RTAB === 'ena') body = rENA();
  else if (RTAB === 'sent') body = rSent();
  else if (RTAB === 'stats') body = rStats();
  else body = rExport();
  return sectionHead('研究控制台', '評量即學習事件的設計、分派與歷程層次分析。') +
    '<div class="tabs">' + tabs.map(function(t){
      return '<button data-act="rtab" data-id="' + t[0] + '" aria-selected="' + (RTAB === t[0]) + '">' + t[1] + '</button>';
    }).join('') + '</div>' + body;
}

/* ---------- 對話設計 ---------- */
function rDesign(){
  const sel = rDesign.sel || {cond:'tutor', proc:'FR', qfn:'F3'};
  rDesign.sel = sel;
  const it = ITEMS.find(function(i){ return (i.process || 'FR') === sel.proc; }) || ITEMS[0];
  const preview = agentTurn(sel.cond, it, TURN_SCHEDULE.indexOf(sel.qfn));

  return '<div class="card card-p" style="margin-bottom:16px">' +
    '<h3>模組化提示：8 個模組，執行時組合 3 個</h3>' +
    '<p class="lead" style="margin-top:8px">腳本不是 3 角色 × 4 歷程各寫一份，而是拆成' +
    '<strong>系統骨幹 1 個</strong>（任務規則與防洩答）、<strong>角色 3 個</strong>（只有社會框架）、' +
    '<strong>歷程 4 個</strong>（提問功能與 19 項子歷程提問庫）。' +
    '這個設計讓「提問功能跨角色恆定、僅社會框架隨角色而異」成為可以逐字查核的事實，' +
    '也讓鷹架機會、資訊量與任務目標在三個條件之間保持恆定。</p></div>' +

    '<div class="grid" style="grid-template-columns:minmax(0,1fr) minmax(320px,.85fr);gap:16px">' +
    '<div class="col">' +
      '<div class="card"><div class="card-h"><h3>模組 0 · 系統骨幹</h3>' +
      '<span class="pill">四條件共用</span></div>' +
      '<div class="card-p"><pre class="prompt">' + esc(PROMPT_BACKBONE) + '</pre></div></div>' +

      '<div class="card"><div class="card-h"><h3>模組 1–3 · 角色（只有社會框架）</h3></div>' +
      '<div class="card-p col">' + CONDITIONS.filter(function(c){ return c.id !== 'control'; }).map(function(c){
        return '<div class="note-full ' + c.cls + '" style="border-left:3px solid">' +
          '<b class="' + c.cls + '">' + esc(c.name) + '（' + esc(c.en) + '）</b>' +
          '<div class="muted small" style="margin:3px 0 6px">' + esc(c.tradition) + '　·　' + esc(c.mech) + '</div>' +
          '<pre class="prompt">' + esc(PROMPT_ROLE[c.id]) + '</pre></div>';
      }).join('') + '</div></div>' +

      '<div class="card"><div class="card-h"><h3>模組 4–7 · 理解歷程（提問功能）</h3>' +
      '<span class="muted small">PIRLS 2011 四項理解歷程 × 19 子歷程</span></div>' +
      '<div class="card-p col">' + PROCESSES.map(function(p){
        return '<div class="note-full"><b class="' + p.cls + '">' + esc(p.name) + '（' + esc(p.en) + '）</b>' +
          '<p class="small muted" style="margin:4px 0 8px">' + esc(p.desc) + '</p>' +
          '<div class="tablewrap"><table><thead><tr><th>編號</th><th>子歷程</th><th>代表性提問句（角色中性）</th></tr></thead><tbody>' +
          subprocessesOf(p.id).map(function(s){
            return '<tr><td class="num">' + s.id + '</td><td class="small">' + esc(s.zh) +
              '<div class="muted" style="font-size:11px">' + esc(s.en) + '</div></td>' +
              '<td class="small">' + esc(s.q) + '</td></tr>';
          }).join('') + '</tbody></table></div></div>';
      }).join('') + '</div></div>' +
    '</div>' +

    '<div class="col">' +
      '<div class="card"><div class="card-h"><h3>組合預覽</h3></div><div class="card-p col">' +
        '<div class="field"><label>角色</label><select data-act="dg-cond">' +
        CONDITIONS.filter(function(c){ return c.id !== 'control'; }).map(function(c){
          return '<option value="' + c.id + '"' + (sel.cond === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>';
        }).join('') + '</select></div>' +
        '<div class="field"><label>題目歷程</label><select data-act="dg-proc">' +
        PROCESSES.map(function(p){
          return '<option value="' + p.id + '"' + (sel.proc === p.id ? ' selected' : '') + '>' + esc(p.name) + '</option>';
        }).join('') + '</select></div>' +
        '<div class="field"><label>回合（提問功能）</label><select data-act="dg-qfn">' +
        TURN_SCHEDULE.map(function(f, i){
          const q = QFUNCTIONS.find(function(x){ return x.id === f; });
          return '<option value="' + f + '"' + (sel.qfn === f ? ' selected' : '') + '>第 ' + (i + 1) + ' 回合 · ' + esc(q.name) + '</option>';
        }).join('') + '</select></div>' +
        '<div class="ai-out"><div class="eyebrow">離線引擎產生的夥伴發話</div>' +
        '<p style="margin-top:6px">' + esc(preview.text) + '</p>' +
        '<div class="muted small">提問功能 ' + preview.qfn + (preview.sub ? '　·　子歷程 ' + preview.sub : '') + '</div></div>' +
        '<div class="eyebrow">實際送給語言模型的完整提示</div>' +
        '<pre class="prompt" style="max-height:280px;overflow:auto">' +
        esc(composePrompt(sel.cond, sel.proc, sel.qfn)) + '</pre>' +
      '</div></div>' +

      '<div class="card"><div class="card-h"><h3>回合排程</h3></div><div class="card-p">' +
      '<p class="small">AI 的回應型態由回合數決定，<strong>不讀取任何學生端的編碼函式</strong>，' +
      '也不指定學生下一步該用什麼策略。學生的歷程轉移因此反映他自己的選擇，' +
      '不含對 AI 指令的遵從成分。</p>' +
      '<div class="tablewrap" style="margin-top:8px"><table><thead><tr><th>回合</th><th>提問功能</th><th>做什麼</th></tr></thead><tbody>' +
      TURN_SCHEDULE.map(function(f, i){
        const q = QFUNCTIONS.find(function(x){ return x.id === f; });
        return '<tr><td class="num">' + (i + 1) + '</td><td><b>' + esc(q.name) + '</b></td>' +
          '<td class="small">' + esc(q.desc) + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<p class="muted small" style="margin-top:8px">每題上限 ' +
      ((state.settings && state.settings.maxTurns) || MAX_TURNS) +
      ' 次學生發話；第 ' + (((state.settings && state.settings.maxTurns) || MAX_TURNS) + 1) +
      ' 次起系統以固定語句告知額度用盡並停止回應，換題後重新計算。</p>' +
      '</div></div>' +

      '<div class="card"><div class="card-h"><h3>防洩答攔截</h3></div><div class="card-p">' +
      '<p class="small">每一則夥伴發話送出前都會過一次篩檢：出現判定詞（' +
      esc(VERDICT_WORDS.slice(0, 5).join('、')) + '…）、正解字串或正解代號一律攔下並改為固定語句。' +
      '規則引擎本來就不會產生這些內容，這一關是為外部語言模型準備的——' +
      '<strong>攔截次數本身就是一項可報告的忠實度指標</strong>。</p>' +
      '<div class="row" style="margin-top:8px">' +
      statCard('已攔截', allLogs().filter(function(e){ return e.blocked; }).length, '本機累計') +
      '</div></div></div>' +
    '</div></div>';
}

/* ---------- 條件分派 ---------- */
function rAssign(){
  const strata = {};
  state.classes.forEach(function(c){ (strata[c.grade] = strata[c.grade] || []).push(c); });
  const last = (state.assignmentLog || [])[state.assignmentLog.length - 1] || {};
  return '<div class="card card-p" style="margin-bottom:16px">' +
    '<h3>以班級為單位、依年級分層的叢集隨機分派</h3>' +
    '<p class="lead" style="margin-top:8px">條件在班級層次操弄：同一班的學生分派到同一個條件，' +
    '避免同班同學互相看到不同夥伴而造成擴散污染。分派在年級內進行區組，' +
    '確保各條件在年級之間平均分布。每次分派的亂數種子都會記錄下來，分派可以完全重現。</p>' +
    '<div class="row" style="margin-top:12px">' +
    '<button class="btn primary" data-act="reassign">重新隨機分派</button>' +
    '<span class="muted small">上次分派：' + (last.at ? fmtDateTime(last.at) : '—') +
    '　·　種子 <span class="num">' + (last.seed || '—') + '</span></span></div></div>' +

    '<div class="card" style="margin-bottom:16px"><div class="card-h"><h3>目前分派</h3>' +
    '<span class="muted small">' + state.classes.length + ' 班 · ' +
    state.classes.reduce(function(a, c){ return a + c.studentIds.length; }, 0) + ' 人</span></div>' +
    '<div class="tablewrap"><table><thead><tr><th>班級</th><th>年級（分層）</th><th class="n">人數</th>' +
    '<th>條件</th><th>理論傳統</th><th class="n">已交後測</th></tr></thead><tbody>' +
    state.classes.map(function(c){
      const cd = condition(c.condition);
      const done = c.studentIds.filter(function(s){ return submitted('a-post', s); }).length;
      return '<tr><td><b>' + esc(c.name) + '</b><div class="muted small">代碼 ' + esc(c.code) + '</div></td>' +
        '<td>' + esc(c.grade) + '</td><td class="n">' + c.studentIds.length + '</td>' +
        '<td><span class="pill ' + (cd.cls || '') + '">' + esc(cd.name) + '</span></td>' +
        '<td class="small muted">' + esc(cd.tradition) + '</td>' +
        '<td class="n">' + done + '</td></tr>';
    }).join('') + '</tbody></table></div></div>' +

    '<div class="grid g2">' + CONDITIONS.map(function(c){
      const ks = state.classes.filter(function(k){ return k.condition === c.id; });
      const n = ks.reduce(function(a, k){ return a + k.studentIds.length; }, 0);
      return '<div class="card"><div class="card-p">' +
        '<div class="row" style="justify-content:space-between">' +
        '<span class="pill ' + (c.cls || '') + '"><span class="dot"></span>' + esc(c.name) + '</span>' +
        '<span class="num" style="font-size:20px;font-weight:600">' + n + ' 人</span></div>' +
        '<p class="small muted" style="margin-top:8px">' + esc(c.note) + '</p>' +
        (c.frame ? '<div class="ai-out small" style="margin-top:8px">' + esc(c.frame) + '</div>' : '') +
        '<div class="muted small" style="margin-top:8px">班級：' +
        (ks.map(function(k){ return esc(k.name); }).join('、') || '—') + '</div>' +
        '</div></div>';
    }).join('') + '</div>' +

    '<div class="card" style="margin-top:16px"><div class="card-h"><h3>分派紀錄</h3></div>' +
    '<div class="tablewrap"><table><thead><tr><th>時間</th><th class="n">種子</th><th>分層</th><th>對應</th></tr></thead><tbody>' +
    (state.assignmentLog || []).slice().reverse().map(function(l){
      return '<tr><td class="small">' + fmtDateTime(l.at) + '</td><td class="n">' + l.seed + '</td>' +
        '<td class="small">' + esc(l.stratify || '—') + '</td>' +
        '<td class="small">' + l.map.map(function(m){
          const k = getClass(m.cid);
          return (k ? k.name : m.cid) + '→' + condition(m.cond).name; }).join('；') + '</td></tr>';
    }).join('') + '</tbody></table></div></div>';
}

function doReassign(){
  const seed = Math.floor(Math.random() * 900000) + 100000;
  const rnd = mulberry32(seed);
  const conds = CONDITIONS.map(function(c){ return c.id; });
  const strata = {};
  state.classes.forEach(function(c){ (strata[c.grade] = strata[c.grade] || []).push(c); });
  // 全體條件序列先洗牌，再在各分層內依序發放，確保條件在分層間平均
  let pool = [];
  const per = Math.ceil(state.classes.length / conds.length);
  for (let i = 0; i < per; i++) pool = pool.concat(conds);
  for (let i = pool.length - 1; i > 0; i--){
    const j = Math.floor(rnd() * (i + 1)); const t = pool[i]; pool[i] = pool[j]; pool[j] = t;
  }
  let k = 0;
  Object.keys(strata).sort().forEach(function(g){
    strata[g].forEach(function(c){ c.condition = pool[k++]; });
  });
  state.assignmentLog = state.assignmentLog || [];
  state.assignmentLog.push({at:Date.now(), seed:seed, stratify:'grade',
    map: state.classes.map(function(c){ return {cid:c.id, cond:c.condition}; })});
  save();
  buildDemoLogs();
  toast('已重新分派（種子 ' + seed + '）。示範日誌已依新條件重算。');
}

/* ---------- LSA ---------- */
function rLSA(){
  const sel = rLSA.cond || 'all';
  rLSA.cond = sel;
  const r = lsa(sel === 'all' ? {} : {cond:sel});
  return '<div class="card card-p" style="margin-bottom:16px">' +
    '<h3>延宕序列分析（Lag Sequential Analysis）</h3>' +
    '<p class="lead" style="margin-top:8px">把每位學生在每一題內的事件排成序列，計算相鄰兩個行為的轉移次數，' +
    '再以 Bakeman & Gottman 的<strong>調整殘差</strong>判定哪些轉移顯著高於／低於期望值（|z| ≥ 1.96）。' +
    '顯著為正的轉移代表前一個行為<strong>促進</strong>了後一個行為。</p>' +
    '<div class="row" style="margin-top:10px">' +
    '<label class="small muted">條件</label><select data-act="lsa-cond" style="width:auto">' +
    '<option value="all"' + (sel === 'all' ? ' selected' : '') + '>全部</option>' +
    CONDITIONS.map(function(c){
      return '<option value="' + c.id + '"' + (sel === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>';
    }).join('') + '</select>' +
    '<span class="muted small">序列 ' + r.nSeq + ' 段 · 事件 ' + r.nEvent + ' 次 · 轉移 ' + r.N + ' 次</span></div></div>' +

    '<div class="grid" style="grid-template-columns:minmax(0,1.1fr) minmax(300px,.9fr);gap:16px">' +
    '<div class="card"><div class="card-h"><h3>調整殘差矩陣</h3>' +
    '<span class="muted small">列＝前一個行為，欄＝後一個行為</span></div>' +
    '<div class="tablewrap"><table><thead><tr><th>z</th>' +
    r.codes.map(function(c){ return '<th class="n">' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>' +
    r.codes.map(function(c, i){
      return '<tr><th style="position:static">' + esc(c) + '<div class="muted" style="font-size:10px;font-weight:400">' +
        esc(behaviorName(c)) + '</div></th>' +
        r.codes.map(function(_, j){
          const z = r.Z[i][j];
          const on = Math.abs(z) >= 1.96;
          const col = z > 0 ? 'var(--q1)' : 'var(--q2)';
          return '<td class="n"' + (on ? ' style="font-weight:700;color:' + col + ';background:' +
            (z > 0 ? 'var(--q1-bg)' : 'var(--q2-bg)') + '"' : ' style="color:var(--ink-4)"') + '>' +
            (r.F[i][j] ? z.toFixed(2) : '—') + '</td>';
        }).join('') + '</tr>';
    }).join('') + '</tbody></table></div>' +
    '<div class="card-p"><p class="muted small">粗體格子為顯著（|z| ≥ 1.96）。' +
    '綠色＝促進性轉移，紅色＝抑制性轉移。</p></div></div>' +

    '<div class="col">' +
      '<div class="card"><div class="card-h"><h3>顯著轉移（依 |z| 排序）</h3></div>' +
      '<div class="tablewrap"><table><thead><tr><th>轉移</th><th class="n">次數</th><th class="n">條件機率</th><th class="n">z</th></tr></thead><tbody>' +
      r.sig.slice(0, 14).map(function(s){
        return '<tr><td><b>' + esc(s.from) + ' → ' + esc(s.to) + '</b>' +
          '<div class="muted" style="font-size:11px">' + esc(behaviorName(s.from)) + ' → ' + esc(behaviorName(s.to)) + '</div></td>' +
          '<td class="n">' + s.f + '</td><td class="n">' + pct(s.p) + '</td>' +
          '<td class="n" style="color:' + (s.z > 0 ? 'var(--q1)' : 'var(--q2)') + ';font-weight:600">' +
          s.z.toFixed(2) + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      (r.sig.length ? '' : '<div class="card-p muted small">沒有顯著轉移。</div>') + '</div>' +
      '<div class="card"><div class="card-h"><h3>行為編碼</h3></div><div class="card-p">' +
      '<div class="tablewrap"><table><tbody>' + BEHAVIOR_CODES.map(function(b){
        return '<tr><td class="num" style="width:44px">' + esc(b.code) + '</td>' +
          '<td><b>' + esc(b.name) + '</b><div class="muted small">' + esc(b.desc) + '</div></td></tr>';
      }).join('') + '</tbody></table></div></div></div>' +
    '</div></div>';
}

/* ---------- ENA ---------- */
function rENA(){
  const acc = enaAccumulate(4);
  const proj = enaProject(acc);
  const nets = enaMeanNetworks(acc);
  const rel = relativeProcessProfile();
  return '<div class="card card-p" style="margin-bottom:16px">' +
    '<h3>認知網絡分析（Epistemic Network Analysis）</h3>' +
    '<p class="lead" style="margin-top:8px">把每位學生在每一題內的事件切成移動窗（' + acc.W +
    ' 行），統計八種編碼在窗內的共現，累積成每位學生的鄰接向量，經球面正規化後以 SVD 投影到二維。' +
    '單位＝學生，因此圖上每一點是一個人的「人—AI 認知互動網絡」。</p>' +
    '<p class="muted small">節點採固定圓形佈局；正式分析請以 R 的 <code>rENA</code> 套件重跑並採用共註冊佈局，' +
    '本平台的「資料匯出」已提供符合其輸入格式的寬表 CSV。</p></div>' +

    '<div class="grid" style="grid-template-columns:minmax(0,1fr) minmax(320px,.9fr);gap:16px">' +
    '<div class="card"><div class="card-h"><h3>單位投影空間</h3>' +
    (proj ? '<span class="pill">SVD1 ' + pct(proj.var1) + ' · SVD2 ' + pct(proj.var2) + '</span>' : '') +
    '</div><div class="card-p">' + (proj ? enaSVG(proj) : '<div class="muted small">資料不足。</div>') +
    '<div class="legend" style="margin-top:8px">' + CONDITIONS.map(function(c){
      return '<span><i class="swatch" style="background:' + condColor(c.id) + '"></i>' + esc(c.name) + '</span>';
    }).join('') + '</div></div></div>' +

    '<div class="col">' +
      '<div class="card"><div class="card-h"><h3>各條件的平均網絡</h3></div><div class="card-p">' +
      '<div class="grid g2">' + CONDITIONS.filter(function(c){ return nets[c.id]; }).map(function(c){
        return '<div><div class="eyebrow" style="margin-bottom:4px">' + esc(c.name) +
          '（n=' + nets[c.id].n + '）</div>' + enaNetSVG(acc, nets[c.id].v) + '</div>';
      }).join('') + '</div></div></div>' +
      '<div class="card"><div class="card-h"><h3>編碼定義</h3></div><div class="card-p">' +
      '<div class="tablewrap"><table><tbody>' + ENA_CODES.map(function(c){
        return '<tr><td class="num" style="width:56px">' + esc(c.id) + '</td>' +
          '<td><b>' + esc(c.name) + '</b><div class="muted small">' + esc(c.desc) + '</div></td></tr>';
      }).join('') + '</tbody></table></div></div></div>' +
    '</div></div>' +

    '<div class="card" style="margin-top:16px"><div class="card-h"><h3>相對歷程分布</h3>' +
    '<span class="muted small">以試題官方標定歷程為判定基準</span></div>' +
    '<div class="tablewrap"><table><thead><tr><th>條件</th><th class="n">發話數</th>' +
    '<th class="n">低於</th><th class="n">等於</th><th class="n">高於</th><th>分布</th></tr></thead><tbody>' +
    CONDITIONS.map(function(c){
      const r = rel[c.id];
      if (!r || !r.n) return '<tr><td>' + esc(c.name) + '</td><td class="n">0</td><td class="n">—</td>' +
        '<td class="n">—</td><td class="n">—</td><td class="muted small">無對話（對照組）</td></tr>';
      return '<tr><td><span class="pill ' + (c.cls || '') + '">' + esc(c.name) + '</span></td>' +
        '<td class="n">' + r.n + '</td>' +
        '<td class="n">' + pct(r.BELOW / r.n) + '</td><td class="n">' + pct(r.AT / r.n) + '</td>' +
        '<td class="n" style="font-weight:600">' + pct(r.ABOVE / r.n) + '</td>' +
        '<td style="min-width:140px"><div class="bar" style="display:flex">' +
        '<i style="width:' + (100 * r.BELOW / r.n) + '%;background:var(--q3)"></i>' +
        '<i style="width:' + (100 * r.AT / r.n) + '%;background:var(--q4)"></i>' +
        '<i style="width:' + (100 * r.ABOVE / r.n) + '%;background:var(--q1)"></i></div></td></tr>';
    }).join('') + '</tbody></table></div>' +
    '<div class="card-p"><p class="muted small">「高於題目歷程」的發話代表學生自發地把問題往上推——' +
    '在只要求「知道」的題目上談起了推論或論證。這是 AaL 主張「學生是主動行動者」最直接的行為證據。</p></div></div>';
}

function condColor(id){
  return id === 'tutor' ? 'var(--sc-1)' : id === 'tutee' ? 'var(--sc-3)'
       : id === 'peer' ? 'var(--sc-5)' : 'var(--ink-4)';
}

function enaSVG(proj){
  const W = 560, H = 460, m = 40;
  const xs = proj.pts.map(function(p){ return p.x; }), ys = proj.pts.map(function(p){ return p.y; });
  const x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
  const y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
  const X = function(v){ return m + (W - 2 * m) * (v - x0) / ((x1 - x0) || 1); };
  const Y = function(v){ return H - m - (H - 2 * m) * (v - y0) / ((y1 - y0) || 1); };
  const p = ['<svg class="kidmap" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="ENA 投影空間">'];
  p.push('<rect class="axis" x="' + m + '" y="' + m + '" width="' + (W - 2 * m) + '" height="' + (H - 2 * m) + '" fill="none"/>');
  p.push('<line class="theta" x1="' + X(0) + '" y1="' + m + '" x2="' + X(0) + '" y2="' + (H - m) + '"/>');
  p.push('<line class="theta" x1="' + m + '" y1="' + Y(0) + '" x2="' + (W - m) + '" y2="' + Y(0) + '"/>');
  // 各條件形心
  CONDITIONS.forEach(function(c){
    const g = proj.pts.filter(function(q){ return q.cond === c.id; });
    if (!g.length) return;
    g.forEach(function(q){
      p.push('<circle cx="' + X(q.x).toFixed(1) + '" cy="' + Y(q.y).toFixed(1) + '" r="4.5" fill="' +
        condColor(c.id) + '" fill-opacity="0.55" stroke="var(--card)" stroke-width="1"><title>' +
        esc(userName(q.sid)) + '（' + esc(condition(c.id).name) + '）</title></circle>');
    });
    const cx = mean(g.map(function(q){ return q.x; })), cy = mean(g.map(function(q){ return q.y; }));
    p.push('<circle cx="' + X(cx).toFixed(1) + '" cy="' + Y(cy).toFixed(1) + '" r="9" fill="none" stroke="' +
      condColor(c.id) + '" stroke-width="2.5"/>');
    p.push('<text x="' + X(cx).toFixed(1) + '" y="' + (Y(cy) - 14).toFixed(1) + '" text-anchor="middle" fill="' +
      condColor(c.id) + '" style="font-weight:600">' + esc(condition(c.id).name) + '</text>');
  });
  p.push('<text x="' + (W / 2) + '" y="' + (H - 10) + '" text-anchor="middle">SVD 第一維</text>');
  p.push('<text x="14" y="' + (H / 2) + '" transform="rotate(-90 14 ' + (H / 2) + ')" text-anchor="middle">SVD 第二維</text>');
  p.push('</svg>');
  return p.join('');
}

function enaNetSVG(acc, v){
  const W = 240, H = 240, cx = 120, cy = 120, R = 82;
  const ids = acc.ids;
  const pos = ids.map(function(_, i){
    const a = -Math.PI / 2 + 2 * Math.PI * i / ids.length;
    return {x:cx + R * Math.cos(a), y:cy + R * Math.sin(a), a:a};
  });
  const mx = Math.max.apply(null, v.concat([1e-9]));
  const p = ['<svg class="sna" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="平均認知網絡">'];
  acc.pairs.forEach(function(pr, i){
    const w = v[i] / mx;
    if (w < 0.06) return;
    p.push('<line x1="' + pos[pr[0]].x.toFixed(1) + '" y1="' + pos[pr[0]].y.toFixed(1) +
      '" x2="' + pos[pr[1]].x.toFixed(1) + '" y2="' + pos[pr[1]].y.toFixed(1) +
      '" stroke="var(--accent)" stroke-opacity="' + (0.15 + w * 0.7).toFixed(2) +
      '" stroke-width="' + (0.6 + w * 4).toFixed(2) + '"><title>' +
      esc(ENA_CODES[pr[0]].name) + ' — ' + esc(ENA_CODES[pr[1]].name) + '</title></line>');
  });
  ids.forEach(function(id, i){
    p.push('<circle cx="' + pos[i].x.toFixed(1) + '" cy="' + pos[i].y.toFixed(1) +
      '" r="4" fill="var(--ink-3)"/>');
    const lx = cx + (R + 16) * Math.cos(pos[i].a), ly = cy + (R + 16) * Math.sin(pos[i].a);
    const an = Math.cos(pos[i].a) > 0.25 ? 'start' : (Math.cos(pos[i].a) < -0.25 ? 'end' : 'middle');
    p.push('<text x="' + lx.toFixed(1) + '" y="' + (ly + 3).toFixed(1) + '" text-anchor="' + an + '">' +
      esc(ENA_CODES[i].name) + '</text>');
  });
  p.push('</svg>');
  return p.join('');
}

/* ---------- 情感軌跡 ---------- */
function rSent(){
  const tr = sentimentTrajectory();
  const conds = CONDITIONS.filter(function(c){ return tr[c.id] && tr[c.id].n; });
  return '<div class="card card-p" style="margin-bottom:16px">' +
    '<h3>情感分析</h3>' +
    '<p class="lead" style="margin-top:8px">以詞典法對每一次學生發話（對照組為筆記）評分：' +
    '正負向詞、程度副詞與否定前綴，輸出 −1 到 +1 的情緒分數。用途有兩層——' +
    '對內用於辨識與校正作答情緒對測量的干擾，對外可發展為<strong>去識別化的情緒儀表板</strong>，' +
    '把班級層級的情緒回饋給教師與同儕群體。</p>' +
    '<p class="muted small">詞典法對反諷與脈絡依賴的表達無能為力，正式分析建議加上人工標註的信度檢核。</p></div>' +

    '<div class="grid g4" style="margin-bottom:16px">' + conds.map(function(c){
      const t = tr[c.id];
      return statCard(c.name, (t.mean >= 0 ? '+' : '') + fx(t.mean, 2),
        '正向 ' + t.pos + ' · 負向 ' + t.neg + ' · 共 ' + t.n + ' 則',
        t.mean > 0.05 ? 'good' : (t.mean < -0.05 ? 'crit' : ''));
    }).join('') + '</div>' +

    '<div class="grid g2">' +
    '<div class="card"><div class="card-h"><h3>情緒隨回合的變化</h3>' +
    '<span class="muted small">每題內的第 1–6 次發話</span></div><div class="card-p">' +
    sentTrajSVG(tr) + '</div></div>' +
    '<div class="card"><div class="card-h"><h3>去識別化情緒儀表板</h3>' +
    '<span class="muted small">班級層級，不顯示個人</span></div><div class="card-p col">' +
    (function(){
      const cm = state.classes.map(function(k){
        const vals = allLogs().filter(function(e){
          return e.cid === k.id && (e.type === 'ASK' || e.code === 'N'); })
          .map(function(e){ return e.sent != null ? e.sent : sentimentOf(e.text || '').score; });
        return {k:k, m: vals.length ? mean(vals) : null, n: vals.length};
      });
      const span = Math.max(0.1, Math.max.apply(null,
        cm.map(function(x){ return Math.abs(x.m || 0); }).concat([0.05])) * 1.3);
      return cm.map(function(x){
        const w = x.m == null ? 50 : (x.m + span) / (2 * span) * 100;
        return '<div class="rub-row"><span>' + esc(x.k.name) + '<div class="muted" style="font-size:11px">' +
          esc(condition(x.k.condition).name) + '</div></span>' +
          '<div class="bar"><i style="width:' + w.toFixed(1) + '%;background:' +
          ((x.m || 0) >= 0 ? 'var(--q1)' : 'var(--q2)') + '"></i></div>' +
          '<span class="lv">' + (x.m == null ? '—' : ((x.m >= 0 ? '+' : '') + fx(x.m, 3))) + '</span></div>';
      }).join('') +
      '<p class="muted small" style="margin-top:10px">橫條的中點對應 0（中性），刻度依實際分布縮放（±' +
      span.toFixed(2) + '）——詞典法的分數本來就集中在中線附近，不放大就看不出條件差異，' +
      '右側數字是未縮放的實際值。這個面板刻意只到班級層級：' +
      '個人情緒不回饋給同儕，避免把情緒變成另一種被評比的東西。</p>';
    })() +
    '</div></div></div>';
}

function sentTrajSVG(tr){
  const W = 520, H = 260, m = {t:16, r:16, b:34, l:44};
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const maxT = 6;
  // 依實際資料自動縮放（最小 ±0.15），否則詞典法的分數都擠在中線附近看不出差異
  const all = [];
  CONDITIONS.forEach(function(c){
    const d = tr[c.id]; if (!d) return;
    d.byTurn.forEach(function(x){ if (x.turn <= maxT) all.push(x.mean); });
  });
  const span = Math.max(0.15, Math.max.apply(null, all.map(Math.abs).concat([0.05])) * 1.25);
  const X = function(t){ return m.l + iw * (t - 1) / (maxT - 1); };
  const Y = function(v){ return m.t + ih * (1 - (v + span) / (2 * span)); };
  const p = ['<svg class="kidmap" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="情緒軌跡">'];
  p.push('<rect class="axis" x="' + m.l + '" y="' + m.t + '" width="' + iw + '" height="' + ih + '" fill="none"/>');
  p.push('<line class="theta" x1="' + m.l + '" y1="' + Y(0) + '" x2="' + (m.l + iw) + '" y2="' + Y(0) + '"/>');
  [span, 0, -span].forEach(function(v){
    p.push('<text x="' + (m.l - 8) + '" y="' + (Y(v) + 3) + '" text-anchor="end">' +
      (v > 0 ? '+' : '') + v.toFixed(2) + '</text>');
  });
  for (let t = 1; t <= maxT; t++){
    p.push('<text x="' + X(t) + '" y="' + (H - 12) + '" text-anchor="middle">' + t + '</text>');
  }
  CONDITIONS.forEach(function(c){
    const d = tr[c.id]; if (!d || !d.byTurn.length) return;
    const pts = d.byTurn.filter(function(x){ return x.turn <= maxT; });
    if (pts.length < 2) return;
    const path = pts.map(function(x, i){
      return (i ? 'L' : 'M') + X(x.turn).toFixed(1) + ' ' + Y(x.mean).toFixed(1); }).join(' ');
    p.push('<path d="' + path + '" fill="none" stroke="' + condColor(c.id) + '" stroke-width="2"/>');
    pts.forEach(function(x){
      p.push('<circle cx="' + X(x.turn).toFixed(1) + '" cy="' + Y(x.mean).toFixed(1) + '" r="3.5" fill="' +
        condColor(c.id) + '"><title>' + esc(c.name) + ' 第 ' + x.turn + ' 回合：' + fx(x.mean, 2) +
        '（n=' + x.n + '）</title></circle>');
    });
  });
  p.push('<text x="' + (m.l + iw / 2) + '" y="' + (H - 2) + '" text-anchor="middle">回合</text>');
  p.push('</svg>');
  return p.join('');
}

/* ---------- 效果檢定 ---------- */
function rStats(){
  const rows = analysisDataset();
  const outs = outcomeList();
  const sel = rStats.sel || 'theta_post';
  rStats.sel = sel;
  const o = outs.find(function(x){ return x.id === sel; }) || outs[0];
  const res = ancova(rows, o.get, o.cov);

  const medY = outs.find(function(x){ return x.id === 'theta_post'; });
  const mediators = ['mot_in', 'eff', 'cl_ge', 'eng_c', 'anx'].map(function(id){
    const c = constructById(id);
    return {name:c.name, get:function(r){ return r.post[id]; }};
  });

  return '<div class="card card-p" style="margin-bottom:16px">' +
    '<h3>共變數分析與中介路徑</h3>' +
    '<p class="lead" style="margin-top:8px">以條件為因子、對應的前測分數為共變數，檢定四條件在結果變項上的差異，' +
    '報告 F、p、partial η² 與 Bonferroni 校正後的事後比較；再以平行多重中介的路徑分析估計' +
    '「條件 → 動機性變項 → 表現」的間接效果，信賴區間以百分位 bootstrap 求得。</p>' +
    '<p class="muted small">本模組估計的是<strong>觀察變項</strong>路徑模型，不是含潛在變項的結構方程模型；' +
    'p 值採 Wilson–Hilferty 近似。正式分析請以 lavaan／Mplus 重跑並檢驗測量模型。' +
    '此外，條件在班級層次操弄，嚴謹的分析應採多層次模型處理班級內相依。</p>' +
    '<div class="row" style="margin-top:10px"><label class="small muted">結果變項</label>' +
    '<select data-act="st-out" style="width:auto;max-width:320px">' + outs.map(function(x){
      return '<option value="' + x.id + '"' + (sel === x.id ? ' selected' : '') + '>' + esc(x.name) + '</option>';
    }).join('') + '</select>' +
    (o.cov ? '<span class="muted small">共變數：' + esc(o.covName) + '</span>'
           : '<span class="muted small">無共變數（單因子變異數分析）</span>') + '</div></div>' +

    (res ? '<div class="grid" style="grid-template-columns:minmax(0,1fr) minmax(300px,.85fr);gap:16px">' +
    '<div class="card"><div class="card-h"><h3>' + esc(o.name) + '</h3>' +
    '<span class="pill' + (res.p < .05 ? ' q1' : '') + '">F(' + res.df1 + ', ' + res.df2 + ') = ' +
    res.F.toFixed(2) + '　p ' + fmtP(res.p) + '　ηp² = ' + res.eta.toFixed(3) + '</span></div>' +
    '<div class="tablewrap"><table><thead><tr><th>條件</th><th class="n">n</th>' +
    '<th class="n">原始 M</th><th class="n">SD</th>' + (res.covariate ? '<th class="n">共變數 M</th>' : '') +
    '<th class="n">調整後 M</th><th>相對位置</th></tr></thead><tbody>' +
    res.desc.slice().sort(function(a, b){ return b.adj - a.adj; }).map(function(d){
      const lo = Math.min.apply(null, res.desc.map(function(x){ return x.adj; }));
      const hi = Math.max.apply(null, res.desc.map(function(x){ return x.adj; }));
      const w = hi > lo ? (d.adj - lo) / (hi - lo) * 100 : 50;
      return '<tr><td><span class="pill ' + (condition(d.cond).cls || '') + '">' +
        esc(condition(d.cond).name) + '</span></td>' +
        '<td class="n">' + d.n + '</td><td class="n">' + fx(d.m) + '</td><td class="n">' + fx(d.sd) + '</td>' +
        (res.covariate ? '<td class="n">' + fx(d.xm) + '</td>' : '') +
        '<td class="n" style="font-weight:600">' + fx(d.adj) + '</td>' +
        '<td style="min-width:120px"><div class="bar"><i style="width:' + w.toFixed(0) + '%"></i></div></td></tr>';
    }).join('') + '</tbody></table></div>' +
    '<div class="card-p"><p class="muted small">調整後平均＝在共變數的總平均處的預測值。' +
    'partial η² 的常用參考值：.01 小、.06 中、.14 大。</p></div></div>' +

    '<div class="card"><div class="card-h"><h3>事後比較</h3>' +
    '<span class="muted small">Bonferroni 校正</span></div>' +
    '<div class="tablewrap"><table><thead><tr><th>比較</th><th class="n">差異</th><th class="n">t</th>' +
    '<th class="n">p(調整)</th><th class="n">d</th></tr></thead><tbody>' +
    res.pairs.slice().sort(function(a, b){ return a.pAdj - b.pAdj; }).map(function(pr){
      return '<tr' + (pr.pAdj < .05 ? ' style="background:var(--q1-bg)"' : '') + '>' +
        '<td class="small">' + esc(condition(pr.a).name) + ' − ' + esc(condition(pr.b).name) + '</td>' +
        '<td class="n">' + fx(pr.diff) + '</td><td class="n">' + fx(pr.t) + '</td>' +
        '<td class="n">' + fmtP(pr.pAdj) + '</td><td class="n">' + fx(pr.d) + '</td></tr>';
    }).join('') + '</tbody></table></div></div></div>'
    : '<div class="empty"><h3>資料不足</h3><p>需要更多完成作答與問卷的學生。</p></div>') +

    '<div class="card" style="margin-top:16px"><div class="card-h"><h3>平行多重中介：條件 → 動機性變項 → 後測 θ</h3>' +
    '<span class="muted small">各角色 vs. 對照組</span></div>' +
    '<div class="card-p col">' + ['tutor', 'tutee', 'peer'].map(function(cid){
      const md = mediation(rows, cid, medY.get, mediators, medY.cov, 1200);
      if (!md) return '<div class="muted small">' + esc(condition(cid).name) + '：資料不足。</div>';
      return '<div class="note-full"><div class="row" style="justify-content:space-between;margin-bottom:8px">' +
        '<b class="' + condition(cid).cls + '">' + esc(condition(cid).name) + ' vs. 對照</b>' +
        '<span class="muted small">n = ' + md.n + '　·　bootstrap ' + md.boot + ' 次</span></div>' +
        '<div class="tablewrap"><table><thead><tr><th>中介變項</th><th class="n">a</th><th class="n">b</th>' +
        '<th class="n">a×b</th><th class="n">95% CI</th></tr></thead><tbody>' +
        md.paths.map(function(p){
          return '<tr' + (p.sig ? ' style="background:var(--q1-bg)"' : '') + '>' +
            '<td>' + esc(p.name) + '</td><td class="n">' + fx(p.a) + '</td><td class="n">' + fx(p.b) + '</td>' +
            '<td class="n" style="font-weight:600">' + fx(p.ind) + '</td>' +
            '<td class="n small">[' + fx(p.lo) + ', ' + fx(p.hi) + ']</td></tr>';
        }).join('') +
        '<tr><td><b>總間接效果</b></td><td class="n">—</td><td class="n">—</td>' +
        '<td class="n" style="font-weight:600">' + fx(md.total.ind) + '</td>' +
        '<td class="n small">[' + fx(md.total.lo) + ', ' + fx(md.total.hi) + ']</td></tr>' +
        '</tbody></table></div>' +
        '<div class="muted small" style="margin-top:6px">總效果 c = ' + fx(md.c) +
        '　·　直接效果 c′ = ' + fx(md.cp) + '。信賴區間不含 0 即視為顯著（標示為綠底）。</div>' +
        '</div>';
    }).join('') + '</div></div>';
}

/* ---------- 匯出 ---------- */
function rExport(){
  const L = allLogs(), D = allDialog();
  return '<div class="grid g4" style="margin-bottom:16px">' +
    statCard('事件日誌', L.length, '含示範資料（由種子重算）') +
    statCard('對話回合', D.length, '學生 ' + D.filter(function(d){ return d.speaker === 'student'; }).length +
      ' · 夥伴 ' + D.filter(function(d){ return d.speaker === 'agent'; }).length) +
    statCard('問卷紀錄', (state.surveys || []).length, '前測 + 後測') +
    statCard('作答紀錄', state.responses.length, '兩次派題') +
  '</div>' +
  '<div class="card"><div class="card-h"><h3>四類資料，對應七項研究問題</h3></div>' +
  '<div class="tablewrap"><table><thead><tr><th>資料類型</th><th>對應研究問題</th><th>格式</th><th></th></tr></thead><tbody>' +
  [['題本作答得分', 'RQ1、RQ7', '長格式 CSV（含 θ、δ、四象限）', 'export-csv'],
   ['五構念問卷', 'RQ2、RQ3', '長格式 CSV（每人每構念一列）', 'export-survey'],
   ['系統日誌', 'RQ4', 'GSEQ SDIS（可直接匯入序列分析）', 'export-sdis'],
   ['系統日誌（遙測摘要）', 'RQ4', '寬表 CSV（每人每題一列）', 'export-tele'],
   ['人—AI 對話語料', 'RQ5、RQ6', 'rENA 寬表 CSV（含二元編碼欄）', 'export-ena'],
   ['完整研究資料包', '全部', 'JSON（含編碼簿與所有衍生指標）', 'export-json']
  ].map(function(r){
    return '<tr><td><b>' + esc(r[0]) + '</b></td><td class="small">' + esc(r[1]) + '</td>' +
      '<td class="small muted">' + esc(r[2]) + '</td>' +
      '<td><button class="btn sm" data-act="' + r[3] + '">下載</button></td></tr>';
  }).join('') + '</tbody></table></div>' +
  '<div class="card-p"><p class="muted small">示範資料是由固定種子產生的模擬資料——' +
  '每次載入結果一致，可重現，但<strong>不得當成實徵結果引用</strong>。' +
  '你自己在平台上操作產生的事件會存進 localStorage 並一起匯出。</p></div></div>';
}
