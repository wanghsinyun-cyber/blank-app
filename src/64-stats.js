/* ==========================================================================
   64-stats.js — 效果檢定
   ‧ 共變數分析（ANCOVA）：F、partial η²、調整後平均、Bonferroni 事後比較
   ‧ 平行多重中介的路徑分析：a、b、c'、間接效果與百分位 bootstrap 信賴區間
   說明：本模組估計的是「觀察變項」路徑模型，不是含潛在變項的結構方程模型。
   正式分析請以 Mplus／lavaan 重跑並檢驗測量模型。
   ========================================================================== */

/* --- 線性代數：最小平方解 --- */
function olsFit(X, y){
  const n = X.length, p = X[0].length;
  const XtX = [], Xty = new Array(p).fill(0);
  for (let i = 0; i < p; i++){
    XtX.push(new Array(p).fill(0));
    for (let j = 0; j < p; j++){
      let s = 0; for (let r = 0; r < n; r++) s += X[r][i] * X[r][j];
      XtX[i][j] = s;
    }
    let s2 = 0; for (let r = 0; r < n; r++) s2 += X[r][i] * y[r];
    Xty[i] = s2;
  }
  const inv = matInv(XtX);
  if (!inv) return null;
  const b = inv.map(function(row){
    return row.reduce(function(a, v, j){ return a + v * Xty[j]; }, 0);
  });
  const fit = X.map(function(row){ return row.reduce(function(a, v, j){ return a + v * b[j]; }, 0); });
  const res = y.map(function(v, i){ return v - fit[i]; });
  const ybar = mean(y);
  const ssTot = y.reduce(function(a, v){ return a + (v - ybar) * (v - ybar); }, 0);
  const ssRes = res.reduce(function(a, v){ return a + v * v; }, 0);
  const df = n - p;
  const mse = df > 0 ? ssRes / df : NaN;
  const se = b.map(function(_, j){ return Math.sqrt(Math.max(0, mse * inv[j][j])); });
  const t = b.map(function(v, j){ return se[j] > 0 ? v / se[j] : 0; });
  return {b:b, se:se, t:t, inv:inv, fit:fit, res:res, ssRes:ssRes, ssTot:ssTot,
          mse:mse, df:df, n:n, p:p, r2: ssTot > 0 ? 1 - ssRes / ssTot : 0};
}

function matInv(A){
  const n = A.length;
  const M = A.map(function(r, i){
    return r.concat(new Array(n).fill(0).map(function(_, j){ return i === j ? 1 : 0; }));
  });
  for (let c = 0; c < n; c++){
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    if (Math.abs(M[piv][c]) < 1e-12) return null;
    const tmp = M[c]; M[c] = M[piv]; M[piv] = tmp;
    const d = M[c][c];
    for (let j = 0; j < 2 * n; j++) M[c][j] /= d;
    for (let r = 0; r < n; r++){
      if (r === c) continue;
      const f = M[r][c];
      if (!f) continue;
      for (let j = 0; j < 2 * n; j++) M[r][j] -= f * M[c][j];
    }
  }
  return M.map(function(r){ return r.slice(n); });
}

/* --- 分布函數（供 p 值） --- */
function erf(x){
  const s = x < 0 ? -1 : 1; x = Math.abs(x);
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741,
        a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return s * y;
}
/* 標準常態上尾機率 P(Z > z) */
function normUpper(z){ return 0.5 * (1 - erf(z / Math.SQRT2)); }
/* F 分布上尾 p：Wilson–Hilferty 近似。df 小時請以統計軟體覆核。 */
function fPvalue(F, df1, df2){
  if (!isFinite(F) || F <= 0 || df1 <= 0 || df2 <= 0) return 1;
  const a = 2 / (9 * df1), b = 2 / (9 * df2);
  const den = Math.sqrt(a + Math.pow(F, 2 / 3) * b);
  if (!(den > 0)) return 1;
  return normUpper((Math.pow(F, 1 / 3) * (1 - b) - (1 - a)) / den);
}
/* t 雙尾 p：t² ~ F(1, df)，故等於 F 的上尾 p */
function tP2(t, df){ return isFinite(t) ? fPvalue(t * t, 1, df) : NaN; }
function fmtP(p){
  if (!isFinite(p)) return '—';
  return p < .001 ? '< .001' : p.toFixed(3).replace(/^0/, '');
}

/* --- 資料集組裝：每位學生一列 --- */
function analysisDataset(){
  const rows = [];
  const pre = diagnose(state, 'a-pre'), post = diagnose(state, 'a-post');
  const thPre = {}, thPost = {};
  if (pre && pre.ready) pre.perStudent.forEach(function(p){ thPre[p.sid] = p.theta; });
  if (post && post.ready) post.perStudent.forEach(function(p){ thPost[p.sid] = p.theta; });

  state.classes.forEach(function(k){
    k.studentIds.forEach(function(sid){
      const sp = surveyScores(sid, 'pre') || {}, sq = surveyScores(sid, 'post') || {};
      const logs = allLogs().filter(function(e){ return e.sid === sid; });
      const asks = logs.filter(function(e){ return e.type === 'ASK'; });
      const rel = {BELOW:0, AT:0, ABOVE:0};
      asks.forEach(function(e){ rel[e.rel || 'AT']++; });
      /* 切換型事件要折疊：取消也被算一次的話，自我檢核勾選數（真的會跑 ANCOVA）
         每題只有 5 個檢核項卻可能報出 9。見 34-log.js 的 foldedCount。 */
      const checks = foldedCount(logs, 'C', 'idx');
      const marks = foldedCount(logs, 'M', 'sent');
      // 情緒以「學生自己寫的文字」為準：對照組沒有對話，改採其筆記，四條件才可比較
      const voiced = logs.filter(function(e){ return e.type === 'ASK' || e.code === 'N'; });
      const sents = voiced.map(function(e){
        return e.sent != null ? e.sent : sentimentOf(e.text || '').score; });
      rows.push({
        sid:sid, name:userName(sid), cid:k.id, klass:k.name, grade:k.grade, cond:k.condition,
        thetaPre: thPre[sid], thetaPost: thPost[sid],
        gain: (thPre[sid] != null && thPost[sid] != null) ? thPost[sid] - thPre[sid] : null,
        pre: sp, post: sq,
        turns: asks.length, marks: marks, checks: checks,
        relBelow: rel.BELOW, relAt: rel.AT, relAbove: rel.ABOVE,
        relAboveRate: asks.length ? rel.ABOVE / asks.length : null,
        sentMean: sents.length ? mean(sents) : null
      });
    });
  });
  return rows;
}

/* --- ANCOVA：以條件為因子、前測為共變數 --- */
function ancova(rows, yGet, xGet){
  const data = rows.map(function(r){
    return {cond:r.cond, y:yGet(r), x: xGet ? xGet(r) : null};
  }).filter(function(d){
    return typeof d.y === 'number' && isFinite(d.y) && (!xGet || (typeof d.x === 'number' && isFinite(d.x)));
  });
  if (data.length < 12) return null;
  const conds = CONDITIONS.map(function(c){ return c.id; })
    .filter(function(c){ return data.some(function(d){ return d.cond === c; }); });
  if (conds.length < 2) return null;
  const ref = conds[conds.length - 1];              // 以對照組為參照
  const others = conds.filter(function(c){ return c !== ref; });
  const withCov = !!xGet;
  const xbar = withCov ? mean(data.map(function(d){ return d.x; })) : 0;

  function design(useCond){
    return data.map(function(d){
      const row = [1];
      if (withCov) row.push(d.x - xbar);
      if (useCond) others.forEach(function(c){ row.push(d.cond === c ? 1 : 0); });
      return row;
    });
  }
  const y = data.map(function(d){ return d.y; });
  const full = olsFit(design(true), y);
  const red = olsFit(design(false), y);
  if (!full || !red) return null;

  const dfEffect = others.length;
  const ssEffect = red.ssRes - full.ssRes;
  const F = (ssEffect / dfEffect) / full.mse;
  const p = fPvalue(F, dfEffect, full.df);
  const eta = ssEffect / (ssEffect + full.ssRes);

  // 調整後平均（在共變數的總平均處）
  const adj = {};
  conds.forEach(function(c){
    let v = full.b[0];
    const k = others.indexOf(c);
    if (k >= 0) v += full.b[(withCov ? 2 : 1) + k];
    adj[c] = v;
  });
  const nBy = {}, xBy = {};
  conds.forEach(function(c){
    const g = data.filter(function(d){ return d.cond === c; });
    nBy[c] = g.length;
    xBy[c] = withCov ? mean(g.map(function(d){ return d.x; })) : 0;
  });
  const ssw = withCov ? conds.reduce(function(a, c){
    const g = data.filter(function(d){ return d.cond === c; });
    const m = xBy[c];
    return a + g.reduce(function(s, d){ return s + (d.x - m) * (d.x - m); }, 0);
  }, 0) : 0;

  const pairs = [];
  for (let i = 0; i < conds.length; i++) for (let j = i + 1; j < conds.length; j++){
    const a = conds[i], b = conds[j];
    const diff = adj[a] - adj[b];
    let seSq = full.mse * (1 / nBy[a] + 1 / nBy[b]);
    if (withCov && ssw > 0) seSq += full.mse * Math.pow(xBy[a] - xBy[b], 2) / ssw;
    const se = Math.sqrt(seSq);
    const t = se > 0 ? diff / se : 0;
    const raw = tP2(t, full.df);
    const nComp = conds.length * (conds.length - 1) / 2;
    pairs.push({a:a, b:b, diff:diff, se:se, t:t, p:raw, pAdj: Math.min(1, raw * nComp),
                d: diff / Math.sqrt(full.mse)});
  }

  const desc = conds.map(function(c){
    const g = data.filter(function(d){ return d.cond === c; });
    return {cond:c, n:g.length, m:mean(g.map(function(d){ return d.y; })),
            sd:sd(g.map(function(d){ return d.y; })), adj:adj[c],
            xm: withCov ? xBy[c] : null};
  });

  return {conds:conds, ref:ref, F:F, df1:dfEffect, df2:full.df, p:p, eta:eta,
          adj:adj, desc:desc, pairs:pairs, mse:full.mse, n:data.length,
          covariate:withCov, covMean:xbar, r2:full.r2};
}

/* --- 平行多重中介 --- */
function mediation(rows, xCond, yGet, mediators, xGet, boot){
  const B = boot || 1500;
  const data = rows.filter(function(r){ return r.cond === xCond || r.cond === 'control'; })
    .map(function(r){
      const o = {x: r.cond === xCond ? 1 : 0, y: yGet(r), cov: xGet ? xGet(r) : 0};
      o.m = mediators.map(function(md){ return md.get(r); });
      return o;
    }).filter(function(o){
      return isFinite(o.y) && o.m.every(function(v){ return typeof v === 'number' && isFinite(v); }) &&
             (!xGet || isFinite(o.cov));
    });
  if (data.length < 20) return null;

  function run(sample){
    const withCov = !!xGet;
    const Xa = sample.map(function(o){ return withCov ? [1, o.x, o.cov] : [1, o.x]; });
    const a = mediators.map(function(_, j){
      const f = olsFit(Xa, sample.map(function(o){ return o.m[j]; }));
      return f ? f.b[1] : NaN;
    });
    const Xb = sample.map(function(o){
      return (withCov ? [1, o.x, o.cov] : [1, o.x]).concat(o.m);
    });
    const fb = olsFit(Xb, sample.map(function(o){ return o.y; }));
    if (!fb) return null;
    const off = withCov ? 3 : 2;
    const b = mediators.map(function(_, j){ return fb.b[off + j]; });
    const cp = fb.b[1];
    const Xc = sample.map(function(o){ return withCov ? [1, o.x, o.cov] : [1, o.x]; });
    const fc = olsFit(Xc, sample.map(function(o){ return o.y; }));
    return {a:a, b:b, cp:cp, c: fc ? fc.b[1] : NaN,
            ind: a.map(function(v, j){ return v * b[j]; }),
            fb:fb, fc:fc};
  }
  const point = run(data);
  if (!point) return null;

  const rnd = mulberry32(424242);
  const dist = mediators.map(function(){ return []; });
  const totDist = [];
  for (let it = 0; it < B; it++){
    const s = [];
    for (let i = 0; i < data.length; i++) s.push(data[Math.floor(rnd() * data.length)]);
    const r = run(s);
    if (!r) continue;
    let tot = 0;
    r.ind.forEach(function(v, j){ if (isFinite(v)){ dist[j].push(v); tot += v; } });
    totDist.push(tot);
  }
  function ci(arr){
    const v = arr.slice().sort(function(a, b){ return a - b; });
    if (v.length < 20) return [NaN, NaN];
    return [v[Math.floor(v.length * 0.025)], v[Math.ceil(v.length * 0.975) - 1]];
  }
  return {
    n: data.length, boot: totDist.length,
    c: point.c, cp: point.cp,
    paths: mediators.map(function(md, j){
      const c95 = ci(dist[j]);
      return {name: md.name, a: point.a[j], b: point.b[j], ind: point.ind[j],
              lo: c95[0], hi: c95[1], sig: c95[0] * c95[1] > 0};
    }),
    total: {ind: point.ind.reduce(function(a, b){ return a + b; }, 0),
            lo: ci(totDist)[0], hi: ci(totDist)[1],
            sig: ci(totDist)[0] * ci(totDist)[1] > 0}
  };
}

/* --- 可分析的結果變項清單 --- */
function outcomeList(){
  const out = [
    {id:'theta_post', name:'閱讀理解表現（後測 θ）', get:function(r){ return r.thetaPost; },
     cov:function(r){ return r.thetaPre; }, covName:'前測 θ'}
  ];
  CONSTRUCTS.forEach(function(c){
    out.push({id:c.id, name:c.name + '（後測）', get:function(r){ return r.post[c.id]; },
      cov: c.phase === 'both' ? function(r){ return r.pre[c.id]; } : null,
      covName: c.phase === 'both' ? c.name + '（前測）' : null});
  });
  out.push({id:'relAbove', name:'高於題目歷程的發話比例', get:function(r){ return r.relAboveRate; }, cov:null});
  out.push({id:'sent', name:'平均情緒分數', get:function(r){ return r.sentMean; }, cov:null});
  out.push({id:'checks', name:'自我檢核勾選數', get:function(r){ return r.checks; }, cov:null});
  return out;
}
