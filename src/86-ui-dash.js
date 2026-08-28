/* ==========================================================================
   86-ui-dash.js — 雙軌評量儀表板
   一軸是心理計量的能力變化（Δθ），一軸是知識建構的論述參與（KB 指數）。
   單看任何一軸都會誤判，這正是整合兩個平台的理由。
   ========================================================================== */

let DTAB = 'dual';

function viewDash(){
  if (!isTeacher()) return studentBlocked();
  const tabs = [['dual','雙軌總覽'],['students','學生個別'],['sna','建構網絡'],['discourse','論述指標'],['report','社群報告']];
  let body = '';
  if (DTAB === 'dual') body = dashDual();
  else if (DTAB === 'students') body = dashStudents();
  else if (DTAB === 'sna') body = dashSNA();
  else if (DTAB === 'discourse') body = dashDiscourse();
  else body = dashReport();
  const kc = kbClass();
  return sectionHead('雙軌評量儀表板',
      '知識建構示範班：' + kc.name + '（' + condition(kc.condition).name + '，' +
      kc.studentIds.length + ' 人）　·　把能力估計與論述指標放在同一張圖上。',
      '<button class="btn sm" data-act="export-json">匯出研究資料</button>') +
    /* 這一頁永遠只有示範班的 24 人，但頂列還掛著一顆班級選單——
       不說清楚，老師會以為自己看的是全部 96 人。 */
    '<div class="card card-p" style="margin-bottom:12px;border-left:3px solid var(--warn)">' +
    '<p class="small" style="margin:0">這一頁只涵蓋<strong>有討論紀錄的示範班（' + esc(kc.name) +
    '）</strong>。其他班級還沒有知識建構資料，因此不在這張圖上；' +
    '頂列的班級選單在這一頁不作用。</p></div>' +
    '<div class="tabs">' + tabs.map(function(t){
      return '<button data-act="dtab" data-id="' + t[0] + '" ' + (DTAB === t[0] ? ' aria-current="true"' : '') + '>' + t[1] + '</button>';
    }).join('') + '</div>' + body;
}

function dashDual(){
  const dt = dualTrack();
  const zones = ['A','B','C','D'];
  const counts = {}; zones.forEach(function(z){ counts[z] = dt.rows.filter(function(r){ return r.zone === z; }).length; });
  return '<div class="grid" style="grid-template-columns:minmax(0,1.15fr) minmax(300px,.85fr);gap:16px">' +
    '<div class="card"><div class="card-h"><h3>能力變化 × 論述參與</h3>' +
      '<span class="muted small">分界線為 ' + esc(kbClass().name) + ' 的中位數</span></div>' +
      '<div class="card-p">' + dualSVG(dt) + '</div></div>' +
    '<div class="col">' + zones.map(function(z){
      const Z = DUAL_ZONE[z];
      const rows = dt.rows.filter(function(r){ return r.zone === z; });
      return '<div class="card"><div class="card-p">' +
        '<div class="row" style="justify-content:space-between;margin-bottom:6px">' +
        '<span class="pill ' + Z.cls + '"><span class="dot"></span>' + z + '　' + Z.name + '</span>' +
        '<span class="num" style="font-size:1rem;font-weight:600">' + counts[z] + '</span></div>' +
        '<p class="small muted">' + esc(Z.desc) + '</p>' +
        '<div class="row" style="gap:5px;margin-top:6px">' + rows.map(function(r){
          return '<button type="button" class="pill" data-act="asrole" data-id="' + r.sid + '">' +
            esc(userName(r.sid)) + '</button>'; }).join('') + '</div>' +
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
      return '<tr><td><button type="button" class="lk-plain" data-act="asrole" data-id="' + r.sid + '">' + esc(userName(r.sid)) + '<span class="sr-only">：以這位學生的視角唯讀檢視</span></button></td>' +
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
/* 學生版的分區文案。不可以讀 DUAL_ZONE——那一份是寫給老師的處置建議
   （「需要介入」「優先安排小組角色」），對著十歲孩子講會變成貼標籤。
   同一份資料，換一套對他說話的說法。 */
const DUAL_ZONE_STUDENT = {
  A:{name:'你把討論變成了自己的理解',
     desc:'你在課堂上說出來的想法，後測也看得出來變化。繼續這樣讀。'},
  B:{name:'你講了很多，下一步是把它變成自己的',
     desc:'你貼了不少想法。試著挑一則你同意的，寫出「我為什麼也這樣想」的理由，而不只是說「我同意」。'},
  C:{name:'你自己讀懂了，還沒說出來',
     desc:'你的理解有進步。班上有同學正卡在你已經想通的地方，把你的想法貼出去，他們會需要。'},
  D:{name:'這節課還在起步',
     desc:'先挑一題你最有話想說的，用「我的想法」支架貼一則就好。一則就夠。'}
};

function viewMyGrowth(){
  const me = currentUser();
  if (me.role !== 'student') return '<div class="empty"><h3>這一頁是學生看的</h3>' +
    '<a class="btn" href="#/teacher">回教師後台</a></div>';

  /* 不走 dualTrack()：那一份只涵蓋知識建構示範班（settings.kbClassId）的 24 人，
     其餘 72 人會直接撞到空狀態。diagnose 的 roster 是四班 96 人，四個條件都有資料。 */
  const pre  = diagnose(state, 'a-pre');
  const post = diagnose(state, 'a-post');
  const pp = pre  && pre.ready  ? pre.perStudent.find(function(p){ return p.sid === me.id; })  : null;
  const qp = post && post.ready ? post.perStudent.find(function(p){ return p.sid === me.id; }) : null;
  if (!pp && !qp) return '<div class="empty"><h3>還沒有可以看的紀錄</h3>' +
    '<p style="max-width:60ch">你的紀錄要等前測與後測都完成之後才算得出來。</p>' +
    '<a class="btn" href="#/student">回我的作業</a></div>';

  const ds = discourseStats().find(function(s){ return s.sid === me.id; }) || {};
  const myNotes = state.notes.filter(function(n){ return n.authorIds.indexOf(me.id) >= 0; });
  const thetaPre  = pp ? pp.theta : null;
  const thetaPost = qp ? qp.theta : null;
  const delta = (thetaPre != null && thetaPost != null) ? thetaPost - thetaPre : null;
  const q2Pre  = pp ? pp.q[2] : 0;
  const q2Post = qp ? qp.q[2] : 0;

  /* 這一班有沒有討論紀錄。沒有的話走降級版面，但卡片數與尺寸一模一樣，
     四個條件看到的版面幾何必須相同，否則介面差異會混進依變項。 */
  const k = classOfStudent(me.id);
  const mates = k ? k.studentIds : [];
  const classNotes = state.notes.filter(function(n){
    return n.authorIds.some(function(a){ return mates.indexOf(a) >= 0; }); });
  const hasKB = classNotes.length > 0;

  let zone = 'D';
  if (hasKB){
    /* 切點用同班同學的中位數，不用全體 */
    const all = discourseStats().filter(function(s){ return mates.indexOf(s.sid) >= 0; });
    const kbis = all.map(function(s){ return s.kbi; }).sort(function(a, b){ return a - b; });
    const kmed = kbis.length ? kbis[Math.floor(kbis.length / 2)] : 0;
    const deltas = mates.map(function(sid){
      const a = pre  && pre.ready  ? pre.perStudent.find(function(p){ return p.sid === sid; })  : null;
      const b = post && post.ready ? post.perStudent.find(function(p){ return p.sid === sid; }) : null;
      return (a && b) ? b.theta - a.theta : null;
    }).filter(function(x){ return x != null; }).sort(function(a, b){ return a - b; });
    const dmed = deltas.length ? deltas[Math.floor(deltas.length / 2)] : 0;
    const dHigh = delta != null && delta >= dmed;      // 算不出來一律歸「低」
    const kHigh = (ds.kbi || 0) >= kmed;
    zone = dHigh ? (kHigh ? 'A' : 'C') : (kHigh ? 'B' : 'D');
  }
  const Z = DUAL_ZONE_STUDENT[zone];

  return sectionHead('我的學習軌跡', me.name) +
    '<div class="grid g4" style="margin-bottom:16px">' +
      statCard('這次讀懂的程度', thetaPost != null ? fx(thetaPost) : (thetaPre != null ? fx(thetaPre) : '—'),
        '課前 ' + (thetaPre == null ? '—' : fx(thetaPre)) + ' → 課後 ' + (thetaPost == null ? '—' : fx(thetaPost))) +
      statCard('比課前進步多少', (delta == null ? '—' : (delta > 0 ? '+' : '') + fx(delta)),
        delta == null ? '等課後那份做完' : (delta > 0 ? '往上' : '持平或下降'),
        delta != null && delta > 0.15 ? 'good' : (delta != null && delta < -0.15 ? 'crit' : '')) +
      statCard('本來會、卻答錯的題數', q2Pre + ' → ' + q2Post,
        '這些是最值得回頭看的題目', q2Post < q2Pre ? 'good' : '') +
      (hasKB
        ? statCard('討論參與度', ds.kbi || 0, '把想法貼出來、也接住別人的想法')
        : statCard('討論參與度', '—', '你們班的知識建構空間還沒有討論紀錄')) +
    '</div>' +
    '<div class="grid g2">' +
      '<div class="card"><div class="card-p">' +
        (hasKB
          ? '<div class="pill"><span aria-hidden="true">◆</span>' + esc(Z.name) + '</div>' +
            '<p class="small" style="margin-top:10px">' + esc(Z.desc) + '</p>'
          : '<div class="pill"><span aria-hidden="true">◆</span>這節課還在起步</div>' +
            '<p class="small" style="margin-top:10px">你們班的知識建構空間還沒有討論紀錄。' +
            '等大家開始貼想法之後，這裡會告訴你你的想法被接住了幾次。</p>') +
        '<hr class="hr">' +
        '<h4>你在討論裡做了什麼</h4>' +
        '<div class="col" style="margin-top:8px">' +
        [['貼出想法', ds.notes || 0], ['接住別人的想法', ds.buildMade || 0],
         ['你的想法被接住', ds.buildGot || 0], ['讀過別人的貼文', ds.reads || 0],
         ['用過幾種開頭句', (ds.scaffoldKinds || 0) + ' / 6'],
         ['用到的關鍵詞', ds.termCount || 0],
         ['說理的深度', fx(ds.epi, 1) + ' / 4']].map(function(p){
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
