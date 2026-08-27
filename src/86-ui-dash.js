/* ==========================================================================
   86-ui-dash.js — 雙軌評量儀表板
   一軸是心理計量的能力變化（Δθ），一軸是知識建構的論述參與（KB 指數）。
   單看任何一軸都會誤判，這正是整合兩個平台的理由。
   ========================================================================== */

let DTAB = 'dual';

function viewDash(){
  const tabs = [['dual','雙軌總覽'],['students','學生個別'],['sna','建構網絡'],['discourse','論述指標'],['report','社群報告']];
  let body = '';
  if (DTAB === 'dual') body = dashDual();
  else if (DTAB === 'students') body = dashStudents();
  else if (DTAB === 'sna') body = dashSNA();
  else if (DTAB === 'discourse') body = dashDiscourse();
  else body = dashReport();
  return sectionHead('雙軌評量儀表板', '把 KIDMAP 的能力估計與知識建構的論述指標放在同一張圖上。',
      '<button class="btn sm" data-act="export-json">匯出研究資料</button>') +
    '<div class="tabs">' + tabs.map(function(t){
      return '<button data-act="dtab" data-id="' + t[0] + '" aria-selected="' + (DTAB === t[0]) + '">' + t[1] + '</button>';
    }).join('') + '</div>' + body;
}

function dashDual(){
  const dt = dualTrack();
  const zones = ['A','B','C','D'];
  const counts = {}; zones.forEach(function(z){ counts[z] = dt.rows.filter(function(r){ return r.zone === z; }).length; });
  return '<div class="grid" style="grid-template-columns:minmax(0,1.15fr) minmax(300px,.85fr);gap:16px">' +
    '<div class="card"><div class="card-h"><h3>能力變化 × 論述參與</h3>' +
      '<span class="muted small">分界線為班級中位數</span></div>' +
      '<div class="card-p">' + dualSVG(dt) + '</div></div>' +
    '<div class="col">' + zones.map(function(z){
      const Z = DUAL_ZONE[z];
      const rows = dt.rows.filter(function(r){ return r.zone === z; });
      return '<div class="card"><div class="card-p">' +
        '<div class="row" style="justify-content:space-between;margin-bottom:6px">' +
        '<span class="pill ' + Z.cls + '"><span class="dot"></span>' + z + '　' + Z.name + '</span>' +
        '<span class="num" style="font-size:20px;font-weight:600">' + counts[z] + '</span></div>' +
        '<p class="small muted">' + esc(Z.desc) + '</p>' +
        '<div class="row" style="gap:5px;margin-top:6px">' + rows.map(function(r){
          return '<span class="pill" data-act="asrole" data-id="' + r.sid + '" style="cursor:pointer" title="切換為此學生檢視">' +
            esc(userName(r.sid)) + '</span>'; }).join('') + '</div>' +
        '</div></div>';
    }).join('') + '</div></div>' +
    '<div class="card" style="margin-top:16px"><div class="card-p">' +
    '<h4>為什麼要兩軸一起看</h4>' +
    '<p class="small" style="margin-top:8px;max-width:70ch">只看 Δθ，會把安靜自學的學生與帶著全班往前走的學生看成一樣；' +
    '只看貼文量，會把熱心但沒有改變理解的參與誤判為學習。B 區（論述多但沒進步）與 C 區（進步但不發言）是兩種完全不同的教學處方，' +
    '而它們在任何單軌系統裡都看不見。</p>' +
    '<p class="muted small">注意：Δθ 帶有測量誤差。若某位學生的 Δθ 小於其 θ 標準誤的兩倍，不應解讀為真的進步。</p>' +
    '</div></div>';
}

function dashStudents(){
  const dt = dualTrack();
  const ds = discourseStats(); const dsMap = {}; ds.forEach(function(s){ dsMap[s.sid] = s; });
  return '<div class="card"><div class="card-h"><h3>每位學生的雙軌紀錄</h3>' +
    '<span class="muted small">點姓名可切換成該學生視角</span></div>' +
    '<div class="tablewrap"><table><thead><tr>' +
    '<th>學生</th><th class="n">θ 前測</th><th class="n">θ 後測</th><th class="n">Δθ</th>' +
    '<th class="n">前測迷思</th><th class="n">後測迷思</th>' +
    '<th class="n">貼文</th><th class="n">延伸</th><th class="n">被延伸</th><th class="n">支架</th>' +
    '<th class="n">論述層次</th><th class="n">KB 指數</th><th>分區</th></tr></thead><tbody>' +
    dt.rows.slice().sort(function(a, b){ return b.kbi - a.kbi; }).map(function(r){
      const s = dsMap[r.sid] || {};
      const d = r.delta;
      const cls = d == null ? 'flat' : (d > 0.15 ? 'up' : (d < -0.15 ? 'down' : 'flat'));
      return '<tr><td><a href="#" data-act="asrole" data-id="' + r.sid + '">' + esc(userName(r.sid)) + '</a></td>' +
        '<td class="n">' + fx(r.thetaPre) + '</td><td class="n">' + fx(r.thetaPost) + '</td>' +
        '<td class="n delta ' + cls + '">' + (d == null ? '—' : (d > 0 ? '+' : '') + fx(d)) + '</td>' +
        '<td class="n">' + r.q2Pre + '</td><td class="n">' + r.q2Post + '</td>' +
        '<td class="n">' + (s.notes || 0) + '</td><td class="n">' + (s.buildMade || 0) + '</td>' +
        '<td class="n">' + (s.buildGot || 0) + '</td><td class="n">' + (s.scaffoldKinds || 0) + '/6</td>' +
        '<td class="n">' + fx(s.epi, 1) + '</td>' +
        '<td class="n"><div class="row" style="gap:6px;justify-content:flex-end"><span>' + r.kbi + '</span>' +
        '<div class="bar" style="width:52px"><i style="width:' + r.kbi + '%"></i></div></div></td>' +
        '<td><span class="pill ' + DUAL_ZONE[r.zone].cls + '"><span class="dot"></span>' + r.zone + '</span></td></tr>';
    }).join('') + '</tbody></table></div>' +
    '<div class="card-p"><p class="muted small">KB 指數的組成：貼文量 15%、延伸他人 20%、被他人延伸 15%、閱讀廣度 10%、' +
    '支架多樣性 10%、論述層次 20%、領域詞彙 10%。刻意壓低貼文量的權重，避免把「發言多」直接當成「學得好」。</p></div></div>';
}

function dashSNA(){
  const g = snaGraph();
  const top = g.ids.slice().sort(function(a, b){ return (g.deg[b].in + g.deg[b].out) - (g.deg[a].in + g.deg[a].out); }).slice(0, 8);
  return '<div class="grid" style="grid-template-columns:minmax(0,1.2fr) minmax(280px,.8fr);gap:16px">' +
    '<div class="card"><div class="card-h"><h3>誰延伸誰的想法</h3>' +
      '<span class="muted small">線的粗細＝延伸次數</span></div><div class="card-p">' + snaSVG(g) +
      '<div class="legend" style="margin-top:8px">' +
      '<span><i class="swatch" style="background:var(--q1)"></i>被延伸多於延伸他人</span>' +
      '<span><i class="swatch" style="background:var(--q4)"></i>延伸他人多於被延伸</span>' +
      '<span><i class="swatch" style="background:var(--ink-4)"></i>尚未進入網絡</span></div></div></div>' +
    '<div class="col">' +
      '<div class="grid g2">' +
        statCard('網絡密度', fx(g.density, 3), '實際連結 / 所有可能連結') +
        statCard('互惠率', pct(g.reciprocity), '雙向延伸的比例') +
        statCard('已進入網絡', g.active + ' 人', '共 ' + g.ids.length + ' 人', g.active < g.ids.length * 0.7 ? 'warn' : 'good') +
        statCard('延伸總數', g.edges.reduce(function(s, e){ return s + e.w; }, 0), '含跨視圖') +
      '</div>' +
      '<div class="card"><div class="card-h"><h3>中心人物</h3></div>' +
      '<div class="tablewrap"><table><thead><tr><th>學生</th><th class="n">延伸他人</th><th class="n">被延伸</th></tr></thead><tbody>' +
      top.map(function(id){
        return '<tr><td>' + esc(userName(id)) + '</td><td class="n">' + g.deg[id].out + '</td><td class="n">' + g.deg[id].in + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<div class="card-p"><p class="muted small">被延伸次數高代表他丟出的想法被社群接住；延伸他人次數高代表他在接別人的想法。' +
      '知識建構希望兩者都分散，而不是集中在少數人身上。</p></div></div>' +
    '</div></div>';
}

function dashDiscourse(){
  const cs = communitySummary();
  const vg = vocabGrowth();
  const pts = vg.points.map(function(p, i){ return {x:i, y:p.v}; });
  const ds = discourseStats();
  const levels = [1,2,3,4];
  const mxL = Math.max.apply(null, cs.epiDist.concat([1]));
  return '<div class="grid g4" style="margin-bottom:16px">' +
    statCard('貼文總數', cs.notes, '延伸 ' + cs.buildOns + ' · 躍升 ' + cs.riseAbove) +
    statCard('參與人數', cs.contributors + ' / ' + cs.roster, pct(cs.contributors / cs.roster) + ' 的學生貼過文',
      cs.contributors / cs.roster < 0.7 ? 'warn' : 'good') +
    statCard('想法被接手率', pct(cs.threadUptake), '起始貼文有人回應的比例') +
    statCard('領域詞彙', cs.vocab + ' / ' + DOMAIN_TERMS.length, '討論中實際用到的專門用語') +
  '</div>' +
  '<div class="grid g2">' +
    '<div class="card"><div class="card-h"><h3>論述層次分布</h3>' +
      '<span class="pill">平均 ' + fx(cs.epiMean, 2) + ' 級</span></div><div class="card-p col">' +
      levels.map(function(l){
        return '<div class="rub-row"><span>第 ' + l + ' 級 · ' + EPI_LABEL[l] + '</span>' +
          '<div class="bar"><i style="width:' + (100 * cs.epiDist[l - 1] / mxL) + '%"></i></div>' +
          '<span class="lv">' + cs.epiDist[l - 1] + '</span></div>';
      }).join('') +
      '<p class="muted small" style="margin-top:10px">由內建規則引擎依連接詞、反例、證據語、修正語、支架使用與引用關係判定，' +
      '完全可重現。它會低估口語表達好但書寫少的學生，請與課堂觀察並用。</p>' +
      '</div></div>' +
    '<div class="card"><div class="card-h"><h3>詞彙成長</h3>' +
      '<span class="muted small">累積首次出現的領域詞彙</span></div><div class="card-p">' +
      lineSVG(pts, {label:'貼文序', x0:'第 1 則', x1:'第 ' + pts.length + ' 則'}) +
      '<div class="row" style="gap:5px;margin-top:8px">' + vg.terms.map(function(t){
        return '<span class="pill">' + esc(t) + '</span>'; }).join('') + '</div>' +
      '</div></div>' +
  '</div>' +
  '<div class="card" style="margin-top:16px"><div class="card-h"><h3>支架使用（全社群）</h3></div>' +
    '<div class="card-p">' + scaffoldUsageBar(state.notes) + '</div></div>' +
  '<div class="card" style="margin-top:16px"><div class="card-h"><h3>個人論述輪廓</h3></div>' +
    '<div class="tablewrap"><table><thead><tr><th>學生</th><th class="n">貼文</th><th class="n">字數</th>' +
    '<th class="n">延伸</th><th class="n">被延伸</th><th class="n">閱讀</th><th class="n">註記</th>' +
    '<th class="n">詞彙</th><th class="n">想法串</th><th class="n">層次</th></tr></thead><tbody>' +
    ds.slice().sort(function(a, b){ return b.notes - a.notes; }).map(function(s){
      return '<tr><td>' + esc(userName(s.sid)) + '</td><td class="n">' + s.notes + '</td>' +
        '<td class="n">' + s.chars + '</td><td class="n">' + s.buildMade + '</td><td class="n">' + s.buildGot + '</td>' +
        '<td class="n">' + s.reads + '</td><td class="n">' + s.ann + '</td><td class="n">' + s.termCount + '</td>' +
        '<td class="n">' + s.threadCount + '</td><td class="n">' + fx(s.epi, 1) + '</td></tr>';
    }).join('') + '</tbody></table></div></div>';
}

function dashReport(){
  const cached = cacheGet('community', kbClass().id);
  return '<div class="card"><div class="card-h"><h3>社群知識建構報告</h3>' +
    '<span class="pill">' + esc(engineLabel()) + '</span>' +
    '<button class="btn primary sm" data-act="ai-community">' + (cached ? '重新產生' : '產生報告') + '</button></div>' +
    '<div class="card-p"><div id="out-ai-community" class="' + (cached ? 'ai-out' : 'muted small') + '">' +
    (cached ? md(cached) : '會綜合社群指標與雙軌分區，指出值得注意的訊號、下一週可以做的事，以及評量上的提醒。') +
    '</div></div></div>';
}

/* --- 學生端的個人軌跡 --- */
function viewMyGrowth(){
  const me = currentUser();
  const dt = dualTrack();
  const row = dt.rows.find(function(r){ return r.sid === me.id; });
  if (!row) return '<div class="empty"><h3>這個帳號沒有學習紀錄</h3><p>請切換成班上的學生來看。</p></div>';
  const ds = discourseStats().find(function(s){ return s.sid === me.id; }) || {};
  const myNotes = state.notes.filter(function(n){ return n.authorIds.indexOf(me.id) >= 0; });
  const Z = DUAL_ZONE[row.zone];

  return sectionHead('我的學習軌跡', me.name) +
    '<div class="grid g4" style="margin-bottom:16px">' +
      statCard('能力估計 θ', fx(row.thetaPost != null ? row.thetaPost : row.thetaPre), '前測 ' + fx(row.thetaPre) + ' → 後測 ' + fx(row.thetaPost)) +
      statCard('能力變化 Δθ', (row.delta == null ? '—' : (row.delta > 0 ? '+' : '') + fx(row.delta)),
        row.delta == null ? '等後測完成' : (row.delta > 0 ? '往上' : '持平或下降'),
        row.delta > 0.15 ? 'good' : (row.delta < -0.15 ? 'crit' : '')) +
      statCard('迷思題數', row.q2Pre + ' → ' + row.q2Post, '能力足以答對卻答錯的題數', row.q2Post < row.q2Pre ? 'good' : '') +
      statCard('知識建構指數', ds.kbi || 0, '班上中位數 ' + Math.round(dt.kmed)) +
    '</div>' +
    '<div class="grid g2">' +
      '<div class="card"><div class="card-p">' +
        '<div class="pill ' + Z.cls + '"><span class="dot"></span>' + Z.name + '</div>' +
        '<p class="small" style="margin-top:10px">' + esc(Z.desc) + '</p>' +
        '<hr class="hr">' +
        '<h4>你的論述輪廓</h4>' +
        '<div class="col" style="margin-top:8px">' +
        [['貼文', ds.notes || 0], ['延伸別人的想法', ds.buildMade || 0], ['被別人延伸', ds.buildGot || 0],
         ['讀過別人的貼文', ds.reads || 0], ['用過的支架種類', (ds.scaffoldKinds || 0) + ' / 6'],
         ['用到的專門用語', ds.termCount || 0], ['平均論述層次', fx(ds.epi, 1) + ' / 4']].map(function(p){
          return '<div class="row" style="justify-content:space-between;border-bottom:1px solid var(--rule-soft);padding-bottom:5px">' +
            '<span class="small">' + p[0] + '</span><span class="num">' + p[1] + '</span></div>';
        }).join('') + '</div>' +
      '</div></div>' +
      '<div class="card"><div class="card-h"><h3>我貼過的想法</h3><span class="muted small">' + myNotes.length + ' 則</span></div>' +
      '<div class="card-p col">' + (myNotes.map(function(n){
        return '<div class="row" style="justify-content:space-between;border-bottom:1px solid var(--rule-soft);padding-bottom:6px">' +
          '<a href="#/note/' + n.id + '">' + esc(n.title) + '</a>' +
          '<span class="pill">第 ' + epistemicLevel(n) + ' 級</span></div>';
      }).join('') || '<div class="muted small">還沒貼過想法。到知識建構空間貼第一則吧。</div>') + '</div></div>' +
    '</div>';
}
