/* ==========================================================================
   82-ui-teacher.js — 教師端：後台、派題精靈、派題分析（KIDMAP）、非選評閱、迷思橋接
   ========================================================================== */

let WIZ = null;

function viewTeacher(){
  const k = currentClass();
  const cond = condition(k.condition);
  const asgs = state.assignments.slice().sort(function(a, b){ return b.createdAt - a.createdAt; });
  const cs = communitySummary();
  const diag = diagnose(state, 'a-pre');
  const flagged = diag && diag.ready ? diag.flagged.length : 0;
  /* 這一排統計卡必須同一個範圍。「社群貼文」已經是本班（communitySummary），
     「共構視圖」原本卻是四班合計——同一排相鄰的兩張卡各講各的。 */
  const myViews = viewsForViewer();
  const bridged = myViews.filter(function(v){ return v.origin; }).length;
  const nAll = state.classes.reduce(function(a, c){ return a + c.studentIds.length; }, 0);

  return sectionHead('教師後台',
    k.name + '　·　加入代碼 ' + k.code + '　·　' + k.studentIds.length + ' 位學生　·　夥伴條件：' + cond.name,
    /* 研究控制台與建立派題屬於研究者的工具，教師端不出現 */
    (isResearcher()
      ? '<a class="btn" href="#/research">研究控制台</a><a class="btn primary" href="#/create">建立派題</a>'
      : '<a class="btn primary" href="#/assign/a-post/replay">看這節課的作答與對話</a>')) +
  /* 抬頭寫「本班 24 人」，統計卡卻是四班 96 人——同一畫面自相矛盾。
     派題分析頁已經有這張範圍說明卡，教師最先落地的這一頁也要有。 */
  '<div class="card card-p" style="margin-bottom:14px;border-left:3px solid var(--accent)">' +
  '<p class="small" style="margin:0">下面四張卡與「派過的作業」表格涵蓋<strong>四個班級共 ' +
  nAll + ' 人</strong>（四班共用同一次 Rasch 校準，條件之間才可比較）。' +
  '你自己班的名單在本頁最下方的「班級名單」。</p></div>' +
  '<div class="grid g4" style="margin-bottom:18px">' +
    statCard('全體樣本', nAll + ' 人', state.classes.length + ' 班 · 四條件叢集分派') +
    statCard('待處理迷思題', flagged, '前測 · 全體 · 迷思比例 ≥ ' + state.settings.misThreshold + '%',
             flagged ? 'crit' : '') +
    statCard('共構視圖', myViews.length, '其中 ' + bridged + ' 個由迷思開啟') +
    statCard('社群貼文', cs.notes, '延伸 ' + cs.buildOns + ' · 躍升 ' + cs.riseAbove) +
  '</div>' +

  '<div class="card" style="margin-bottom:18px"><div class="card-h"><h3>四條件分派概況</h3>' +
    (isResearcher() ? '<a class="btn sm" href="#/research">條件分派與歷程分析 →</a>' : '') + '</div>' +
    '<div class="card-p"><div class="grid g4">' + CONDITIONS.map(function(c){
      const ks = state.classes.filter(function(x){ return x.condition === c.id; });
      const n = ks.reduce(function(a, x){ return a + x.studentIds.length; }, 0);
      return '<div class="stat"><div class="k">' + esc(c.name) + '</div>' +
        '<div class="v">' + n + '</div><div class="s">' +
        (ks.map(function(x){ return esc(x.name); }).join('、') || '—') + '</div></div>';
    }).join('') + '</div>' +
    '<p class="muted small" style="margin-top:10px">條件在班級層次操弄：同一班的同學拿到同一種夥伴，' +
    '避免同班互相看到不同條件而造成擴散污染。四個班共用同一份題本、同一次 Rasch 校準，條件之間才可比較。</p>' +
    '</div></div>' +

  '<div class="card" style="margin-bottom:18px"><div class="card-h"><h3>派過的作業</h3>' +
    '<span class="muted small">點開任何一份，會看到成績分佈、KIDMAP 診斷、迷思橋接與非選評閱。</span></div>' +
    '<div class="tablewrap"><table><thead><tr><th>作業標題</th><th>階段</th><th class="n">題數</th>' +
    '<th class="n">已交（全體）</th><th class="n">迷思題</th><th>建立時間</th><th></th></tr></thead><tbody>' +
    asgs.map(function(a){
      const d = diagnose(state, a.id);
      const done = d ? d.done.length : 0;
      const fl = d && d.ready ? d.flagged.length : '—';
      return '<tr><td><a href="#/assign/' + a.id + '">' + esc(a.title) + '</a><div class="muted small">' + esc(a.desc || '') + '</div></td>' +
        '<td><span class="pill">' + (a.phase === 'post' ? '共構後測' : '前測') + '</span></td>' +
        '<td class="n">' + a.itemIds.length + '</td><td class="n">' + done + ' / ' + assignmentRoster(a).length + '</td>' +
        '<td class="n">' + fl + '</td><td class="num small">' + fmtDate(a.createdAt) + '</td>' +
        '<td><a class="btn sm" href="#/assign/' + a.id + '">分析</a></td></tr>';
    }).join('') + '</tbody></table></div></div>' +

  '<div class="grid g2">' +
    '<div class="card"><div class="card-h"><h3>班級名單</h3><span class="muted small">共 ' + k.studentIds.length + ' 人</span></div>' +
    '<div class="card-p"><div class="row" style="gap:6px">' +
      k.studentIds.map(function(sid){
        return '<button type="button" class="pill" data-act="asrole" data-id="' + sid + '">' + esc(userName(sid)) + '<span class="sr-only">：以這位學生的視角唯讀檢視</span></button>';
      }).join('') + '</div>' +
      '<p class="muted small" style="margin-top:12px">點任一位同學會以他的視角唯讀檢視（你的閱讀與貼文不會記到他名下），畫面上方會出現結束檢視的按鈕。</p>' +
    '</div></div>' +
    '<div class="card"><div class="card-h"><h3>從迷思開啟的共構視圖</h3></div><div class="card-p col">' +
      (myViews.filter(function(v){ return v.origin; }).map(function(v){
        const it = getItem(v.origin.iid);
        return '<div class="row" style="justify-content:space-between;border-bottom:1px solid var(--rule-soft);padding-bottom:8px">' +
          '<div><a href="#/kb/' + v.id + '"><b>' + esc(v.title) + '</b></a>' +
          '<div class="muted small">源自 ' + (it ? itemLabel(v.origin.aid, it.id) : '—') + '　·　' + notesOfView(v.id).length + ' 則貼文</div></div>' +
          '<a class="btn sm" href="#/kb/' + v.id + '">進入</a></div>';
      }).join('') || '<div class="muted small">還沒有由迷思開啟的視圖。到「派題分析 → 迷思橋接」按下〈開啟共構視圖〉。</div>') +
    '</div></div>' +
  '</div>';
}

/* ==========================================================================
   派題精靈
   ========================================================================== */
function viewCreate(){
  if (!WIZ) WIZ = {step:1, units:{}, items:{}, title:'', desc:'', due:'', phase:'pre'};
  const steps = ['選文本', '挑題目', '派給學生'];
  let body = '';

  if (WIZ.step === 1){
    body = '<div class="card card-p"><h3>選要用的文本</h3>' +
      '<p class="muted small">勾選文本，下一步會列出掛在這些文本上的題目給你挑。</p>' +
      '<div class="col" style="margin-top:12px">' + TEXTS.map(function(t){
        const n = ITEMS.filter(function(i){ return i.unit === t.id; }).length;
        const on = WIZ.units[t.id];
        return '<button class="btn' + (on ? ' primary' : '') + '" data-act="wiz-unit" data-id="' + t.id + '"' +
          ' aria-pressed="' + (!!on) + '" style="justify-content:flex-start;text-align:left"' +
          (n ? '' : ' disabled') + '><span aria-hidden="true">' + (on ? '☑' : '☐') + '</span>' +
          '<b>' + esc(t.title) + '</b><span class="pill">' + esc(t.genre) + '</span>' +
          '<span class="pill">' + n + ' 題</span></button>';
      }).join('') + '</div>' +
      '<hr class="hr"><div class="row"><span class="muted small">已選 ' + Object.keys(WIZ.units).length + ' 篇文本</span>' +
      '<div class="spacer"></div><button class="btn primary" data-act="wiz-next"' +
      (Object.keys(WIZ.units).length ? '' : ' disabled') + '>下一步：挑題目 →</button></div></div>';
  }

  if (WIZ.step === 2){
    const cand = ITEMS.filter(function(i){ return WIZ.units[i.unit]; });
    body = '<div class="card card-p"><h3>挑題目</h3>' +
      '<p class="muted small">從你選的文本中挑要派的題目。建構反應題會進入人工評閱流程。</p>' +
      '<div class="col" style="margin-top:12px">' + cand.map(function(i){
        const on = WIZ.items[i.id];
        return '<label class="item" style="cursor:pointer;border-color:' + (on ? 'var(--accent)' : 'var(--rule)') + '">' +
          '<div class="row" style="justify-content:space-between">' +
          '<div class="row"><input type="checkbox" data-act="wiz-item" data-id="' + i.id + '"' + (on ? ' checked' : '') + '>' +
          itemPills(i) +
          '<span class="pill">' + (i.type === 'cr' ? '非選題' : '選擇題') + '</span>' +
          '<span class="muted small">' + esc(unitName(i.unit)) + '</span></div></div>' +
          '<div class="stem">' + esc(i.stem) + '</div>' +
          (i.options.length ? '<div class="muted small">' + i.options.map(function(o, k){
            return String.fromCharCode(65 + k) + '. ' + esc(o); }).join('　') + '　·　正解 ' +
            String.fromCharCode(65 + i.answer) + '</div>' : '') +
          '</label>';
      }).join('') + '</div>' +
      '<hr class="hr"><div class="row"><button class="btn" data-act="wiz-back">← 上一步</button>' +
      '<span class="muted small">已選 ' + Object.keys(WIZ.items).length + ' 題</span><div class="spacer"></div>' +
      '<button class="btn primary" data-act="wiz-next"' + (Object.keys(WIZ.items).length ? '' : ' disabled') +
      '>下一步：派給學生 →</button></div></div>';
  }

  if (WIZ.step === 3){
    body = '<div class="card card-p"><h3>派題細節</h3>' +
      '<div class="col" style="max-width:520px;margin-top:12px">' +
      '<div class="field"><label for="wt">作業標題</label><input id="wt" type="text" value="' + esc(WIZ.title) +
        '" placeholder="例：〈會走路的樹〉閱讀理解"></div>' +
      '<div class="field"><label for="wd">說明（給學生的提示，可留空）</label><textarea id="wd">' + esc(WIZ.desc) + '</textarea></div>' +
      '<div class="field"><label for="wp">階段</label><select id="wp">' +
        '<option value="pre"' + (WIZ.phase === 'pre' ? ' selected' : '') + '>前測（診斷用，會進入迷思橋接）</option>' +
        '<option value="post"' + (WIZ.phase === 'post' ? ' selected' : '') + '>共構後測（與前測比較 Δθ）</option></select></div>' +
      '<div class="field"><label for="wdue">截止時間</label><input id="wdue" type="datetime-local" value="' + esc(WIZ.due) + '"></div>' +
      '</div><hr class="hr"><div class="row"><button class="btn" data-act="wiz-back">← 上一步</button>' +
      '<span class="muted small">將派出 ' + Object.keys(WIZ.items).length + ' 題給全部 ' + state.classes.length + ' 個班級</span>' +
      '<div class="spacer"></div><button class="btn primary" data-act="wiz-submit">派出這份作業</button></div></div>';
  }

  return sectionHead('建立派題', '從文本開始，三個步驟完成派題。', '<a class="btn" href="#/teacher">回教師後台</a>') +
    '<div class="steps">' + steps.map(function(s, i){
      return '<div class="step' + (WIZ.step === i + 1 ? ' on' : '') + '"><b>' + (i + 1) + '</b>' + s + '</div>';
    }).join('') + '</div>' + body;
}

/* ==========================================================================
   派題分析
   ========================================================================== */
function viewAssign(aid, tab){
  if (!isTeacher()) return studentBlocked();
  const diag = diagnose(state, aid);
  if (!diag) return '<div class="empty"><h3>找不到這份派題</h3><p>它可能已刪除。</p><a class="btn" href="#/teacher">回教師後台</a></div>';
  const a = diag.assignment;
  /* 每個分頁補一句副標，老師點進去之前就知道那是什麼 */
  const tabs = [
    ['overview', '成績總覽', '全體答對率與分佈（四班）'],
    ['process', '理解歷程', '四種讀法各答對幾成'],
    ['kidmap', 'KIDMAP 診斷', '個別學生的四象限圖'],
    ['items', '每題四象限', '哪一題最多人卡住'],
    ['bridge', '迷思橋接', '把卡住的題目變成討論'],
    ['cr', '建構反應題評閱', '逐生批改與給評語'],
    ['replay', '作答與 AI 互動', '重播學生當時的畫面'],
    ['ai', 'AI 深度分析', '整班的教學建議']
  ];
  const T = tabs.some(function(t){ return t[0] === tab; }) ? tab : 'overview';
  let body = '';
  if (T === 'overview') body = tabOverview(diag);
  else if (T === 'process') body = tabProcess(diag);
  else if (T === 'kidmap') body = tabKidmap(diag);
  else if (T === 'items') body = tabItems(diag);
  else if (T === 'bridge') body = tabBridge(diag);
  else if (T === 'cr') body = tabCR(diag);
  else if (T === 'replay') body = tabReplay(diag);
  else body = tabAI(diag);

  const k = currentClass();
  return sectionHead(a.title, (a.phase === 'post' ? '共構後測' : '前測') + '　·　' +
      '四班共同校準　·　' + diag.done.length + ' / ' + diag.roster.length + ' 位已交' +
      '（本班 ' + k.studentIds.length + ' 人）　·　' + diag.items.length + ' 道選擇題',
      '<a class="btn" href="#/teacher">回教師後台</a>') +
    /* 八個分頁裡七個是四班合計卻用班級語彙，老師會以為那是她班上的數字 */
    '<div class="card card-p" style="margin-bottom:12px;border-left:3px solid var(--accent)">' +
    '<p class="small" style="margin:0">這一頁的統計範圍是<strong>四個班級共 ' + diag.roster.length +
    ' 人</strong>——四班共用同一次 Rasch 校準，條件之間才可以比較。' +
    '只有「理解歷程」分頁另外把本班拆出來。</p></div>' +
    '<div class="tabs" role="tablist">' + tabs.map(function(t){
      const on = T === t[0];
      return '<a href="#/assign/' + aid + '/' + t[0] + '"' + (on ? ' aria-current="true"' : '') +
        ' title="' + esc(t[2]) + '">' + esc(t[1]) +
        (on ? '<span class="sr-only">（目前顯示中）</span>' : '') + '</a>';
    }).join('') + '</div>' + body;
}

function tabOverview(diag){
  const scores = diag.perStudent.map(function(p){ return p.right; });
  const nItems = diag.items.length;
  /* 實際有作答的人數，不要寫死。四格數的是「人 × 題」的格子。 */
  const nAll = diag.perStudent.length;
  if (!diag.done.length) return '<div class="empty"><h3>還沒有學生作答</h3><p>把班級加入代碼發給學生，作答後這裡會顯示。</p></div>';
  return '<div class="grid g4" style="margin-bottom:16px">' +
    statCard('全體平均', fx(mean(scores) / nItems * 100, 1) + '<span style="font-size:0.75em">%</span>', '答對 ' + fx(mean(scores), 1) + ' / ' + nItems + ' 題') +
    statCard('已交作答', diag.done.length, '未完成 ' + (diag.roster.length - diag.done.length) + ' 人') +
    statCard('迷思題次', diag.totals[2], '占全部作答 ' + pct(diag.totals[2] / Math.max(1, diag.cells.length)), diag.totals[2] ? 'crit' : '') +
    statCard('優勢題次', diag.totals[1], '超越預期答對', 'good') +
  '</div>' +
  '<div class="grid g2">' +
    '<div class="card"><div class="card-h"><h3>成績分佈</h3></div><div class="card-p">' +
      histSVG(scores, Math.min(10, nItems), '答對題數（滿分 ' + nItems + '）') + '</div></div>' +
    /* 四格填的是「人 × 題」的格子數，不是人數。原本標題寫死「96 人」，
       於是會出現「II 迷思概念 213」掛在「96 人」底下，而同一畫面上方的
       統計卡對同一組數字用的是正確單位「迷思題次」。 */
    '<div class="card"><div class="card-h"><h3>全體每題四象限分佈（四班 ' + nAll + ' 人 × ' +
      nItems + ' 題，共 ' + (nAll * nItems) + ' 題次）</h3>' +
      '<span class="muted small">排列方式與 KIDMAP 圖一致</span></div><div class="card-p">' +
      // 依 KIDMAP 圖上的位置排列：左上 III、右上 I、左下 II、右下 IV
      '<div class="grid split" style="--cols:repeat(2,minmax(0,1fr))">' + [3,1,2,4].map(function(q){
        return '<div class="stat"><div class="k">' + QUAD[q].roman + ' ' + QUAD[q].name + '</div>' +
          '<div class="v" style="color:var(--' + QUAD[q].key + ')">' + diag.totals[q] +
          '<span class="s" style="font-size:.6em"> 題次</span></div>' +
          '<div class="s">' + esc(QUAD[q].desc) + '</div></div>';
      }).join('') + '</div>' +
      '<p class="muted small" style="margin-top:12px">用簡化 Rasch 模式從全體（四班合計）作答估出每題難度 δ 與每位學生能力 θ，' +
      '再把每一個「人 × 題」的結果分成四象限。<strong>迷思概念（II）</strong>指能力足以答對卻答錯，是最需要老師介入的格子。</p>' +
    '</div></div>' +
  '</div>' +
  '<div class="card" style="margin-top:16px"><div class="card-h"><h3>學生表現（全體）</h3><span class="muted small">依能力估計值排序</span></div>' +
  /* θ／SE／Infit 對只用過 Google Classroom 的老師是天書，就地解釋 */
  '<div class="tablewrap"><table><thead><tr><th>學生</th><th>班級</th><th class="n">答對</th>' +
  '<th class="n"><abbr title="這位學生的閱讀能力估計值，與題目難度在同一量尺上">θ 能力</abbr></th>' +
  '<th class="n"><abbr title="估計的誤差範圍，越小越準">SE 誤差</abbr></th>' +
  '<th class="n"><abbr title="作答型態是否異常。明顯大於 1.3 常來自理解失誤或猜測">Infit 適配</abbr></th>' +
  '<th>四象限</th><th class="n">迷思</th><th></th></tr></thead><tbody>' +
  diag.perStudent.slice().sort(function(a, b){ return (b.theta || 0) - (a.theta || 0); }).map(function(p){
    return '<tr><td>' + esc(userName(p.sid)) + '</td>' +
      '<td class="small muted">' + esc((classOfStudent(p.sid) || {}).name || '') + '</td>' +
      '<td class="n">' + p.right + '/' + p.n + '</td>' +
      '<td class="n">' + fx(p.theta) + '</td><td class="n">' + fx(p.se) + '</td><td class="n">' + fx(p.infit) + '</td>' +
      '<td style="min-width:110px">' + quadBar(p.q, p.n) + '</td>' +
      '<td class="n" style="color:var(--q2)">' + p.q[2] + '</td>' +
      '<td><button class="btn sm" data-act="kidmap-one" data-id="' + p.sid + '">KIDMAP</button></td></tr>';
  }).join('') + '</tbody></table></div></div>';
}

/* ==========================================================================
   四項理解歷程的分布（個別與整體）＋ 質性敘述
   ========================================================================== */
function processProfile(diag, sids){
  const out = {};
  PROCESSES.forEach(function(p){ out[p.id] = {right:0, n:0, q2:0}; });
  diag.cells.forEach(function(c){
    if (sids && sids.indexOf(c.sid) < 0) return;
    const pid = getItem(c.iid).process;
    const b = out[pid]; if (!b) return;
    b.n++; if (c.correct) b.right++; if (c.q === 2) b.q2++;
  });
  PROCESSES.forEach(function(p){
    const b = out[p.id];
    b.rate = b.n ? b.right / b.n : null;
  });
  return out;
}

/* 由規則引擎產生的質性敘述：完全可重現，每一句都追得回數字 */
function processNarrative(prof, label){
  const rows = PROCESSES.map(function(p){ return {p:p, b:prof[p.id]}; })
    .filter(function(x){ return x.b.n; });
  if (!rows.length) return '尚無足夠作答資料。';
  const sorted = rows.slice().sort(function(a, b){ return b.b.rate - a.b.rate; });
  const best = sorted[0], worst = sorted[sorted.length - 1];
  const L = [];
  L.push(label + '在四項理解歷程上的表現，最強的是**' + best.p.name + '**（答對率 ' +
    pct(best.b.rate) + '），最弱的是**' + worst.p.name + '**（' + pct(worst.b.rate) + '）。');

  const gap = best.b.rate - worst.b.rate;
  if (gap < 0.12){
    L.push('四項歷程之間的落差只有 ' + Math.round(gap * 100) + ' 個百分點，剖面相當平整——' +
      '這通常代表整體閱讀量能一致，接下來可以直接提高文本難度，而不必針對特定歷程補救。');
  } else {
    L.push('落差達 ' + Math.round(gap * 100) + ' 個百分點，是明顯的歷程不均。');
    if (worst.p.order <= 2){
      L.push('值得注意的是，弱項落在**' + worst.p.name + '**這種較基礎的歷程上。' +
        '這通常不是理解力的問題，而是回到文本的習慣還沒建立——' +
        '學生憑印象作答，或找到了段落卻停在錯的句子。');
    } else {
      L.push('弱項落在**' + worst.p.name + '**這種較高階的歷程上，而基礎歷程表現尚可。' +
        '這代表學生找得到訊息，但還不習慣把訊息整合起來、或跳出文本評斷它。' +
        '這一類能力很難靠多做題目長出來，比較需要在討論中被要求說出理由。');
    }
  }
  const hi = rows.filter(function(x){ return x.b.q2 > 0; })
    .sort(function(a, b){ return (b.b.q2 / b.b.n) - (a.b.q2 / a.b.n); })[0];
  if (hi && hi.b.q2 / hi.b.n >= 0.08){
    L.push('第二象限（能力足以答對卻答錯）最集中在**' + hi.p.name + '**，占該歷程作答的 ' +
      pct(hi.b.q2 / hi.b.n) + '。這些是最值得帶進共構討論的題目——' +
      '它們不是難度問題，是讀法問題。');
  }
  return L.join('');
}

function tabProcess(diag){
  if (!diag.ready) return '<div class="empty"><h3>尚無足夠資料</h3><p>需要至少 ' + diag.minN + ' 位學生完成作答。</p></div>';
  const all = processProfile(diag, null);
  const k = currentClass();
  const inClass = diag.done.filter(function(s){ return k.studentIds.indexOf(s) >= 0; });
  const cls = processProfile(diag, inClass);

  function bars(prof, caption){
    const mx = 1;
    return '<div class="col">' + PROCESSES.map(function(p){
      const b = prof[p.id];
      if (!b.n) return '';
      return '<div class="rub-row">' +
        '<span><span aria-hidden="true">' + p.mark + '</span> ' + esc(p.name) +
        '<div class="muted" style="font-size:.8em">' + b.n + ' 題次</div></span>' +
        '<div class="bar" role="img" aria-label="' + esc(p.name) + ' 答對率 ' + pct(b.rate) + '">' +
        '<i style="width:' + (100 * b.rate / mx) + '%;background:var(--' + p.cls.replace('sc', 'sc-') + ')"></i></div>' +
        '<span class="lv">' + pct(b.rate) + '</span></div>';
    }).join('') + '</div>' +
    '<p class="muted small" style="margin-top:8px">' + esc(caption) + '</p>';
  }

  return '<div class="grid g2" style="margin-bottom:16px">' +
    '<div class="card"><div class="card-h"><h3>' + esc(k.name) + '</h3>' +
      '<span class="pill ' + (condition(k.condition).cls || '') + '">' +
      '<span aria-hidden="true">' + condition(k.condition).mark + '</span>' +
      esc(condition(k.condition).name) + '</span></div>' +
      '<div class="card-p">' + bars(cls, '本班 ' + inClass.length + ' 位學生的答對率') + '</div></div>' +
    '<div class="card"><div class="card-h"><h3>全體樣本</h3>' +
      '<span class="muted small">' + diag.done.length + ' 人 · ' + state.classes.length + ' 班</span></div>' +
      '<div class="card-p">' + bars(all, '四個班合計，作為本班的比較基準') + '</div></div>' +
  '</div>' +

  '<div class="card" style="margin-bottom:16px"><div class="card-h"><h3>質性敘述</h3>' +
    '<span class="pill">內建規則引擎 · 可重現</span></div>' +
    '<div class="card-p"><div class="ai-out">' + md(processNarrative(cls, esc(k.name))) + '</div>' +
    '<p class="muted small" style="margin-top:10px">這段敘述由規則引擎依上面的數字產生，' +
    '每一句都追得回具體的答對率與象限比例，不含語言模型生成內容。</p></div></div>' +

  '<div class="card"><div class="card-h"><h3>每位學生的歷程剖面</h3>' +
    '<span class="muted small">依最弱歷程排序，優先看需要介入的人</span></div>' +
    '<div class="tablewrap"><table><thead><tr><th>學生</th>' +
    PROCESSES.map(function(p){
      return '<th class="n"><span aria-hidden="true">' + p.mark + '</span> ' + esc(p.name) + '</th>';
    }).join('') + '<th>剖面</th><th class="n">最弱</th></tr></thead><tbody>' +
    inClass.map(function(sid){
      const pr = processProfile(diag, [sid]);
      const rows = PROCESSES.map(function(p){ return {p:p, b:pr[p.id]}; }).filter(function(x){ return x.b.n; });
      /* 並列與滿分都要處理。取 [0] 的話：三項並列 0% 只會顯示 PROCESSES
         陣列裡排最前面的那一項，四項全對的學生也會被印一個「最弱」——
         而這一欄的副標寫著「優先看需要介入的人」，那個排序建立在一個
         任意的 tie-break 上。 */
      const minRate = rows.length ? Math.min.apply(null, rows.map(function(x){ return x.b.rate; })) : 1;
      const worsts = rows.filter(function(x){ return x.b.rate === minRate; });
      return {sid:sid, pr:pr, rows:rows, minRate:minRate, worsts:worsts};
    }).sort(function(a, b){
      /* 先看最弱的答對率，再看並列了幾項——並列越多代表越全面地卡住 */
      return (a.minRate - b.minRate) || (b.worsts.length - a.worsts.length);
    })
    .map(function(x){
      return '<tr><td>' + esc(userName(x.sid)) + '</td>' +
        PROCESSES.map(function(p){
          const b = x.pr[p.id];
          return '<td class="n">' + (b.n ? pct(b.rate) : '—') + '</td>';
        }).join('') +
        '<td style="min-width:130px"><div class="bar" style="display:flex">' +
        x.rows.map(function(r){
          return '<i style="width:' + (100 / x.rows.length) + '%;background:var(--' +
            r.p.cls.replace('sc', 'sc-') + ');opacity:' + (0.25 + 0.75 * r.b.rate).toFixed(2) + '"></i>';
        }).join('') + '</div></td>' +
        '<td class="n">' + (
          x.minRate === 1
            ? '<span class="pill">—　四項都答對</span>'
            : x.worsts.map(function(w){
                return '<span class="pill ' + w.p.cls + '">' +
                  '<span aria-hidden="true">' + w.p.mark + '</span>' + esc(w.p.name) + '</span>';
              }).join(' ')
        ) + '</td></tr>';
    }).join('') + '</tbody></table></div>' +
    '<div class="card-p"><p class="muted small">剖面條的每一段代表一項歷程，顏色深淺代表答對率高低；' +
    '同時附上數字與「最弱」文字標籤，不以顏色單獨傳達訊息。' +
    '單一學生在 3–4 題上的答對率非常不穩定，這一欄用來排序與挑人談話，不適合直接當成能力估計。</p></div></div>';
}

function tabKidmap(diag){
  if (!diag.ready){
    return '<div class="empty"><h3>尚無足夠資料</h3><p>至少需要 ' + diag.minN +
      ' 位學生完成才會執行 KIDMAP，目前完成 ' + diag.done.length + ' 位。</p></div>';
  }
  // 預設先看迷思最多的學生——那是老師最需要處理的人
  const ranked = diag.perStudent.slice().sort(function(a, b){ return b.q[2] - a.q[2]; });
  const sel = (tabKidmap.sel && diag.perStudent.some(function(p){ return p.sid === tabKidmap.sel; }))
    ? tabKidmap.sel : ranked[0].sid;
  tabKidmap.sel = sel;
  const ps = diag.perStudent.find(function(p){ return p.sid === sel; }) || ranked[0];
  return '<div class="grid split" style="--cols:230px minmax(0,1fr);gap:16px">' +
    '<div class="card" style="max-height:660px;overflow:auto"><div class="card-h"><h3>學生</h3>' +
    '<span class="muted small">依迷思題數排序</span></div>' +
    '<div style="padding:8px">' + ranked.map(function(p){
      return '<button class="btn sm" style="width:100%;justify-content:space-between;margin-bottom:4px;' +
        (p.sid === sel ? 'border-color:var(--accent);font-weight:600' : 'border-color:transparent') + '"' +
        ' data-act="kidmap-sel" data-id="' + p.sid + '">' + esc(userName(p.sid)) +
        '<span class="num" style="color:var(--q2)">' + (p.q[2] || '') + '</span></button>';
    }).join('') + '</div></div>' +
    '<div class="card"><div class="card-h"><h3>' + esc(userName(ps.sid)) + ' 的 KIDMAP</h3>' +
      '<span class="pill">θ = ' + fx(ps.theta) + ' ± ' + fx(ps.se) + '</span>' +
      '<span class="pill">Infit ' + fx(ps.infit) + '</span></div>' +
    '<div class="card-p">' + kidmapSVG(diag, ps) +
      '<div class="row" style="margin-top:10px">' + quadLegend() + '</div>' +
      '<hr class="hr">' +
      '<p class="small"><strong>怎麼讀這張圖：</strong>縱軸是試題難度（越上面越難），橫向分成答錯／答對兩欄，' +
      '中間那條虛線是這位學生的能力值 θ。落在<strong style="color:var(--q2)">左下（II 迷思）</strong>的題目，' +
      '照他的能力本來應該答對卻答錯了——這些題目就是他真正的概念缺口，也是本系統送進共構討論的材料。' +
      '落在<strong style="color:var(--q1)">右上（I 優勢）</strong>的題目代表他有隱藏實力，可以邀他當該題的知識資源人。</p>' +
      (ps.q[2] ? '<div class="ai-out" style="margin-top:12px"><p><strong>這位學生的迷思題：</strong></p><ul>' +
        ps.cells.filter(function(c){ return c.q === 2; }).map(function(c){
          const it = getItem(c.iid);
          return '<li>' + itemLabel(diag.assignment.id, it.id) + '（' + esc(shortStem(it.stem)) + '）——他選了 ' +
            (c.choice != null ? String.fromCharCode(65 + c.choice) + '. ' + esc(it.options[c.choice]) : '未作答') +
            '，正解是 ' + String.fromCharCode(65 + it.answer) + '。預期答對率 ' + pct(c.p) + '。</li>';
        }).join('') + '</ul></div>' : '<p class="small muted" style="margin-top:12px">這位學生沒有落在迷思象限的題目。</p>') +
    '</div></div></div>';
}

function tabItems(diag){
  if (!diag.ready) return '<div class="empty"><h3>尚無足夠資料</h3><p>等更多學生作答後才能顯示每題分析。</p></div>';
  const rows = diag.perItem.slice().sort(function(a, b){ return b.misRate - a.misRate; });
  return '<div class="card"><div class="card-h"><h3>全體每題四象限分佈（四班合計）</h3>' +
    '<span class="muted small">依迷思(II)比例由高至低排序</span>' + '</div>' +
    '<div class="tablewrap"><table><thead><tr><th>題號</th><th>單元</th><th class="n">δ</th><th class="n">答對率</th>' +
    '<th>四象限</th><th class="n">迷思</th><th>迷思誘答</th><th class="n">Outfit</th><th></th></tr></thead><tbody>' +
    rows.map(function(pi){
      const it = pi.item;
      const m = pi.misCode ? MISCONCEPTIONS.find(function(x){ return x.id === pi.misCode; }) : null;
      return '<tr><td><b>' + itemLabel(diag.assignment.id, it.id) + '</b><div class="muted small">' + esc(processName(it.process)) + ' · ' + esc(it.diff) + '</div></td>' +
        '<td class="small">' + esc(unitName(it.unit)) + '</td>' +
        '<td class="n">' + fx(pi.delta) + '</td><td class="n">' + pct(pi.pass) + '</td>' +
        '<td style="min-width:120px">' + quadBar(pi.q, pi.n) + '</td>' +
        '<td class="n"' + (pi.misRate >= 0.15 ? ' style="color:var(--q2);font-weight:600"' : '') + '>' +
          pi.q[2] + '（' + pct(pi.misRate) + '）</td>' +
        '<td class="small">' + (pi.topDistractor != null
          ? String.fromCharCode(65 + pi.topDistractor) + '. ' + esc(pi.item.options[pi.topDistractor]) +
            (m ? '<div class="muted" style="font-size:0.58rem">' + esc(m.name) + '</div>' : '')
          : '<span class="muted">—</span>') + '</td>' +
        '<td class="n">' + fx(pi.outfit) + '</td>' +
        '<td><div class="row" style="gap:6px">' +
          '<button class="btn sm" data-act="item-strategy" data-id="' + it.id + '">教學策略</button>' +
          '<button class="btn sm" data-act="similar" data-id="' + it.id + '">相似題</button>' +
        '</div><div id="sim-' + it.id + '"></div></td></tr>';
    }).join('') + '</tbody></table></div>' +
    '<div class="card-p"><div class="row">' + quadLegend() + '</div>' +
    /* 相似題原本印在學生的診斷頁上，四個條件都拿得到、不限次數，
       等於在 MAX_TURNS 之外多開一條鷹架通道。移到教師端備課用。 */
    '<p class="muted small" style="margin-top:10px">「相似題」是給你備課用的，<strong>它挑出來的是題庫裡的現役題目，不是新生成的</strong>——前後測同一份題本，印給學生練習等於先發答案卡。' +
    '<strong>不計入學生的鷹架劑量</strong>——學生端看不到這顆按鈕。</p>' +
    '<p class="muted small" style="margin-top:10px">Outfit MNSQ 接近 1 代表該題與 Rasch 模式相符；明顯大於 1.3 表示有異常作答型態，' +
    '通常正是迷思或猜測造成的，值得優先檢視。</p></div></div>';
}

/* --- 迷思橋接：兩個平台真正接起來的地方 --- */
function tabBridge(diag){
  if (!diag.ready) return '<div class="empty"><h3>尚無足夠資料</h3><p>需要至少 ' + diag.minN + ' 位學生完成作答。</p></div>';
  const list = diag.flagged;
  return '<div class="card card-p" style="margin-bottom:16px">' +
    '<h3>從測驗到討論：一鍵把迷思變成社群的問題</h3>' +
    '<p class="lead" style="margin-top:8px">KIDMAP 的第二象限（<span class="pill q2"><span class="dot"></span>II 迷思概念</span>）指出的是' +
    '「這個學生的能力應該答得出來，卻答錯了」——這正是最值得全班一起想清楚的真實問題。' +
    '按下〈開啟共構視圖〉，系統會建立一個 Knowledge Forum 式的視圖，把題目、誘答分析與探究問題貼進去，' +
    '同時把在該題落在<span class="pill q1"><span class="dot"></span>I 優勢概念</span>的同學標為<strong>知識資源人</strong>，' +
    '請他們先貼出自己的想法，而不是直接公布答案。</p>' +
    '<p class="muted small">門檻：迷思比例 ≥ ' + state.settings.misThreshold + '%（由研究者在系統設定調整）。</p></div>' +
    (list.length ? list.map(function(pi){
      const it = pi.item;
      const v = bridgeExists(diag.assignment.id, it.id);
      const m = pi.misCode ? MISCONCEPTIONS.find(function(x){ return x.id === pi.misCode; }) : null;
      return '<div class="card" style="margin-bottom:14px"><div class="card-h">' +
        '<h3>' + itemLabel(diag.assignment.id, it.id) + '　<span class="pill q2"><span class="dot"></span>迷思 ' + pi.q[2] + ' 人 · ' + pct(pi.misRate) + '</span></h3>' +
        (v ? '<a class="btn sm" href="#/kb/' + v.id + '">進入共構視圖 →</a>'
           : '<button class="btn primary sm" data-act="bridge" data-id="' + it.id + '">開啟共構視圖</button>') + '</div>' +
        '<div class="card-p"><div class="item" style="margin-bottom:12px"><div class="stem">' + esc(it.stem) + '</div>' +
        '<div class="opts">' + it.options.map(function(o, k){
          const isAns = k === it.answer, isTop = k === pi.topDistractor;
          return '<div class="opt' + (isAns ? ' right' : (isTop ? ' wrong' : '')) + '"><b>' +
            String.fromCharCode(65 + k) + '</b><span>' + esc(o) + (isAns ? '　<span class="muted small">正解</span>' : '') +
            (isTop ? '　<span class="muted small">迷思學生最常選（' + pi.topDistractorN + ' 人）</span>' : '') + '</span></div>';
        }).join('') + '</div></div>' +
        (m ? '<p class="small"><strong>題庫標記的迷思類型：</strong>' + esc(m.name) + '——' + esc(m.desc) + '</p>' : '') +
        '<div class="grid g2" style="margin-top:10px">' +
          '<div><div class="eyebrow">落在迷思象限（待解者）</div><div class="row" style="gap:5px;margin-top:6px">' +
            pi.q2Students.map(function(s){ return '<span class="pill q2">' + esc(userName(s)) + '</span>'; }).join('') + '</div></div>' +
          '<div><div class="eyebrow">落在優勢象限（知識資源人）</div><div class="row" style="gap:5px;margin-top:6px">' +
            (pi.q1Students.map(function(s){ return '<span class="pill q1">' + esc(userName(s)) + '</span>'; }).join('') ||
             '<span class="muted small">這一題沒有人超越預期答對。</span>') + '</div></div>' +
        '</div>' +
        '<hr class="hr"><div class="eyebrow">將貼進視圖的探究問題</div>' +
        '<div class="ai-out" style="margin-top:6px">' + nl2br(buildInquiryPrompt(pi, diag, currentClass())) + '</div>' +
        '</div></div>';
    }).join('') : '<div class="empty"><h3>目前沒有明顯的迷思題</h3>' +
      '<p>全體（四班合計）沒有出現迷思比例超過 ' + state.settings.misThreshold + '% 的題目。</p></div>');
}

/* --- 非選題評閱 --- */
function tabCR(diag){
  const crs = diag.assignment.itemIds.map(getItem).filter(function(i){ return i && i.type === 'cr'; });
  if (!crs.length) return '<div class="empty"><h3>這份作業沒有非選題</h3><p>下次派題時可以在題型中加入非選題。</p></div>';
  const sel = tabCR.sel || crs[0].id;
  tabCR.sel = sel;
  const it = getItem(sel);
  const rubricKey = 'rubric:' + it.id + ':' + aiEngine();
  const rubric = state.aiCache[rubricKey];
  /* 這一頁原本一次列出四班 96 人的作文，沒有班級欄也沒有篩選。示範資料的
     四班姓名是隨機組合，撞名機率高，老師會在別班孩子的欄位裡打分數——
     而別班是別的實驗條件，一位老師的評分標準跨條件飄移，直接落在依變項上。
     預設只顯示自己的班，範圍是顯性選擇而不是靜默縮小分母。 */
  const all = state.responses.filter(function(r){ return r.aid === diag.assignment.id && r.iid === it.id; });
  const mine = currentClass();
  const scopeAll = (tabCR.scope === 'all');
  const answers = (scopeAll ? all : all.filter(function(r){
    const k = classOfStudent(r.sid); return k && k.id === mine.id;
  })).slice().sort(function(a, b){
    const ka = (classOfStudent(a.sid) || {}).id || '', kb = (classOfStudent(b.sid) || {}).id || '';
    if (ka !== kb) return ka === mine.id ? -1 : (kb === mine.id ? 1 : (ka < kb ? -1 : 1));
    return userName(a.sid) < userName(b.sid) ? -1 : 1;
  });

  return '<div class="row" style="margin-bottom:12px">' + crs.map(function(c){
      return '<button class="btn sm' + (c.id === sel ? ' primary' : '') + '" data-act="cr-sel" data-id="' + c.id + '">' + itemLabel(diag.assignment.id, c.id) + '</button>';
    }).join('') + '</div>' +
    '<div class="card" style="margin-bottom:14px"><div class="card-h"><h3>題目</h3>' +
      itemPills(it) + '</div>' +
      '<div class="card-p"><div class="stem">' + esc(it.stem) + '</div></div></div>' +
    '<div class="card" style="margin-bottom:14px"><div class="card-h"><h3>評量規準</h3>' +
      '<span class="pill">' + esc(engineLabel()) + '</span>' +
      '<button class="btn sm" data-act="gen-rubric" data-id="' + it.id + '">' + (rubric ? '重新產生規準' : '產生規準') + '</button></div>' +
      '<div class="card-p"><div id="out-rubric" class="' + (rubric ? 'ai-out' : 'muted small') + '">' +
      (rubric ? md(rubric) : '尚未撰寫評量規準。點右上〈產生規準〉開始，之後仍可自行修改。') + '</div></div></div>' +
    '<div class="card card-p" style="margin-bottom:14px;border-left:3px solid var(--accent)">' +
    '<p class="small" style="margin:0 0 8px">這份派題涵蓋<strong>四個班級共 ' + all.length +
    ' 份作答</strong>。給分是即時儲存、沒有復原，所以預設只列出你自己班的。' +
    'Rasch 校準與四象限仍是四班全樣本，這裡的篩選只影響顯示。</p>' +
    '<div class="row" style="gap:6px">' +
    '<button class="btn sm' + (scopeAll ? '' : ' primary') + '" data-act="cr-scope" data-id="mine">' +
      esc(mine.name) + '（' + all.filter(function(r){ const k = classOfStudent(r.sid); return k && k.id === mine.id; }).length + ' 人）</button>' +
    '<button class="btn sm' + (scopeAll ? ' primary' : '') + '" data-act="cr-scope" data-id="all">' +
      '全部（' + all.length + ' 人）</button></div></div>' +
    '<div class="card"><div class="card-h"><h3>逐生評閱</h3>' +
    '<span class="muted small">分數與評語會即時儲存，改動立即生效、沒有復原</span></div>' +
    '<div class="card-p col">' + answers.map(function(r){
      const k = classOfStudent(r.sid);
      const isMine = k && k.id === mine.id;
      /* 每一列的控制項要有自己的 id，label 的 for 才接得上 */
      const rowKey = (r.sid + '-' + it.id).replace(/[^A-Za-z0-9_-]/g, '');
      const scoreId = 'crScore-' + rowKey, noteId = 'crNote-' + rowKey;
      return '<div class="note-full"' + (isMine ? ' style="border-left:3px solid var(--accent)"' : '') + '>' +
        '<div class="row" style="justify-content:space-between;margin-bottom:8px">' +
        '<span class="row"><b>' + esc(userName(r.sid)) + '</b>' +
        '<span class="pill">' + esc((k || {}).name || '—') + '</span></span>' +
        /* 這兩個 label 原本既沒有 for、也沒有包住控制項——純粹是視覺上擺在旁邊。
           一頁 24 位學生 × 2 題＝48 個控制項，報讀軟體全部念成無名的
           spin button 與 text area。而且每一列的標籤字一模一樣，
           光是關聯起來還不夠：得把學生名字放進可及名稱，
           老師才知道游標停在誰的分數上。（可及名稱包含可見文字，
           符合 WCAG 2.5.3 label in name。） */
        '<span class="row"><label class="small muted" for="' + scoreId + '">給分（滿分 6）</label>' +
        '<input type="number" min="0" max="6" step="1" style="width:72px" id="' + scoreId +
        '" aria-label="' + esc(userName(r.sid)) + ' 的給分（滿分 6）" value="' + (r.score === null ? '' : r.score) +
        '" data-act="cr-score" data-sid="' + r.sid + '" data-iid="' + it.id + '" data-aid="' + diag.assignment.id + '">' +
        '</span></div>' +
        /* 手寫也要印出來。畫面上那塊板子的標籤寫著「老師評閱時看得到」，
           但這裡原本只印 r.text，於是整題用手寫作答的孩子在評閱畫面上是
           「（未作答）」、給分留白——而手寫正是不會打字的孩子唯一的
           建構反應通道，遺失會與打字能力共變，直接污染 CR 的組間比較。
           兩者都有就兩者都印：孩子可能先打幾個字再用畫的補圖。 */
        crAnswerHtml(r, {style:'font-family:var(--f-mono);font-size:0.78rem'}) +
        '<div class="field" style="margin-top:8px"><label for="' + noteId + '">給學生的評語</label>' +
        '<textarea rows="3" style="min-height:4.5rem" id="' + noteId +
        '" aria-label="給 ' + esc(userName(r.sid)) + ' 的評語" data-act="cr-comment" data-sid="' + r.sid + '" data-iid="' + it.id +
        '" data-aid="' + diag.assignment.id + '" placeholder="可留空">' + esc(r.comment || '') + '</textarea></div>' +
        '</div>';
    }).join('') + '</div></div>';
}

function tabAI(diag){
  const cached = cacheGet('class', diag.assignment.id);
  return '<div class="card" style="margin-bottom:14px"><div class="card-h">' +
    '<h3>請 AI 一次看完整份 KIDMAP 診斷</h3>' +
    '<span class="pill">' + esc(engineLabel()) + '</span>' +
    '<button class="btn primary sm" data-act="ai-class">' + (cached ? '重新分析' : '開始分析') + '</button></div>' +
    '<div class="card-p"><div id="out-ai-class" class="' + (cached ? 'ai-out' : 'muted small') + '">' +
    (cached ? md(cached) : '會分析全體（四班合計）的共同迷思、逐題誘答成因、具體教學策略，並把最值得討論的迷思寫成可直接貼進知識建構空間的問題敘述。') +
    '</div></div></div>' +
    '<div class="card card-p"><h4>兩套引擎的差別</h4>' +
    '<p class="small" style="margin-top:6px"><strong>內建規則引擎</strong>直接讀 Rasch 估計值與題庫的誘答標記，' +
    '輸出完全可重現、每一句都能追溯到資料，適合寫進研究報告；<strong>外部語言模型</strong>語言較自然、能處理沒有標記的例外情況，' +
    '但同一份資料兩次結果可能不同。研究上建議兩者都跑一次並比對差異。</p>' +
    '<p class="muted small">目前引擎：' + esc(engineLabel()) + '（由研究者設定）。</p></div>';
}

/* 作答與 AI 互動：列出名單，點進去用學生當時的版面唯讀重播。
   測驗結束後學生端就進不去了，這裡是教師與研究者唯一看得到那個介面的入口。 */
function tabReplay(diag){
  const a = diag.assignment;
  const dial = allDialog().filter(function(d){ return d.aid === a.id; });
  const logs = allLogs().filter(function(e){ return e.aid === a.id; });
  /* 順序與 #/inspect 的「上一位／下一位」共用同一支 inspectRoster()，
     否則老師按下一位跳到的人跟他剛看到的名單對不上。 */
  const rows = inspectRoster(a.id).map(function(sid){
    const cond = condition(conditionOfStudent(sid));
    const said = dial.filter(function(d){ return d.sid === sid && d.speaker === 'student'; }).length;
    const marks = foldedMarks(logs.filter(function(e){ return e.sid === sid; }));
    const ans = state.responses.filter(function(r){
      return r.aid === a.id && r.sid === sid &&
             (r.choice != null || (r.text && r.text.length)); }).length;
    return {sid:sid, cond:cond, said:said, marks:marks, ans:ans, done:submitted(a.id, sid)};
  });
  const withDialog = rows.filter(function(r){ return r.said > 0; }).length;

  return '<div class="grid g4" style="margin-bottom:16px">' +
    statCard('可檢視的學生', rows.length, a.aal ? '這是評量即學習事件' : '一般測驗，沒有 AI 對話') +
    statCard('有對話記錄', withDialog, '對照組沒有 AI 夥伴，屬正常') +
    statCard('學生發話總數', dial.filter(function(d){ return d.speaker === 'student'; }).length,
             '每題上限 ' + ((state.settings && state.settings.maxTurns) || MAX_TURNS) + ' 次') +
    statCard('文句標記總數', foldedMarks(logs), '學生在文本上畫的線（取消的不算）') +
    '</div>' +

    '<div class="card card-p" style="margin-bottom:16px;border-left:3px solid var(--accent)">' +
    '<div class="eyebrow">為什麼會有這一頁</div>' +
    '<p class="small" style="margin-top:6px;max-width:74ch">評量即學習的作答介面是學生端的畫面，' +
    '測驗結束之後就沒有人進得去，教師與研究者也就看不到學生當時實際看到什麼、跟 AI 說了什麼。' +
    '點任何一位學生，就會用<strong>與他當時完全相同的版面</strong>重播——同樣的文本、同樣的兩欄、' +
    '同樣的對話卡，差別只在全部唯讀，並且多顯示對錯、誘答標記與系統的歷程編碼。' +
    '這一頁不會寫入任何事件日誌。</p></div>' +

    '<div class="card"><div class="card-h"><h3>學生名單</h3>' +
    '<span class="muted small">依發話次數排序</span></div><div class="card-p">' +
    '<div class="tablewrap"><table><thead><tr>' +
    '<th>學生</th><th>條件</th><th>作答</th><th>標記句數</th><th>發話次數</th><th>狀態</th><th></th>' +
    '</tr></thead><tbody>' +
    rows.map(function(r){   /* inspectRoster() 已排序 */
      return '<tr><td><b>' + esc(userName(r.sid)) + '</b></td>' +
        '<td><span class="pill"><span aria-hidden="true">' + esc(r.cond.mark || '') + '</span>' +
        esc(r.cond.name) + '</span></td>' +
        '<td>' + r.ans + ' / ' + diag.assignment.itemIds.length + '</td>' +
        '<td>' + r.marks + '</td>' +
        '<td>' + (r.said || (r.cond.id === 'control' ? '—' : 0)) + '</td>' +
        '<td>' + (r.done ? '已交卷' : '<span class="muted">未交卷</span>') + '</td>' +
        '<td><a class="btn sm" href="#/inspect/' + a.id + '/' + r.sid + '">檢視 →</a></td></tr>';
    }).join('') +
    '</tbody></table></div></div></div>';
}
