/* ==========================================================================
   40-psy.js — 心理計量：簡化 Rasch 模式（JMLE）與 KIDMAP 四象限
   參考：Wright & Stone (1979) Best Test Design；
        國立臺灣師範大學心理與教育測驗研究發展中心之 KIDMAP 診斷表徵。
   ========================================================================== */

const QUAD = {
  1:{key:'q1', roman:'I',   name:'優勢概念',  short:'優勢',    desc:'難題答對，超越預期。'},
  2:{key:'q2', roman:'II',  name:'迷思概念',  short:'迷思',    desc:'能力足以答對卻答錯，最需要介入。'},
  3:{key:'q3', roman:'III', name:'合理答錯',  short:'合理錯',  desc:'難題答錯，屬合理範圍。'},
  4:{key:'q4', roman:'IV',  name:'合理答對',  short:'合理對',  desc:'簡單題答對，屬合理範圍。'}
};

function logistic(x){ return 1 / (1 + Math.exp(-x)); }

/* 由作答矩陣估計 Rasch 參數。
   X: 二維陣列 [人][題]，值為 1 / 0 / null（未作答）。 */
function estimateRasch(X, opts){
  opts = opts || {};
  const N = X.length, L = N ? X[0].length : 0;
  const theta = new Array(N).fill(0);
  const delta = new Array(L).fill(0);
  if (!N || !L) return {theta:theta, delta:delta, se:[], seItem:[], iterations:0, converged:false};

  // 原始分數與作答題數
  const pScore = [], pCount = [], iScore = [], iCount = [];
  for (let n = 0; n < N; n++){ let s = 0, c = 0;
    for (let i = 0; i < L; i++){ if (X[n][i] === null || X[n][i] === undefined) continue; c++; s += X[n][i]; }
    pScore.push(s); pCount.push(c);
  }
  for (let i = 0; i < L; i++){ let s = 0, c = 0;
    for (let n = 0; n < N; n++){ if (X[n][i] === null || X[n][i] === undefined) continue; c++; s += X[n][i]; }
    iScore.push(s); iCount.push(c);
  }

  // 極端分數調整（Wright 的 0.3 邏輯分校正），避免估計發散
  const ADJ = 0.3;
  function targetPerson(n){
    let r = pScore[n], c = pCount[n];
    if (!c) return null;
    if (r === 0) r = ADJ; else if (r === c) r = c - ADJ;
    return r;
  }
  function targetItem(i){
    let r = iScore[i], c = iCount[i];
    if (!c) return null;
    if (r === 0) r = ADJ; else if (r === c) r = c - ADJ;
    return r;
  }

  // PROX 起始值
  for (let n = 0; n < N; n++){
    const r = targetPerson(n);
    theta[n] = r === null ? 0 : Math.log(r / (pCount[n] - r));
  }
  for (let i = 0; i < L; i++){
    const r = targetItem(i);
    delta[i] = r === null ? 0 : -Math.log(r / (iCount[i] - r));
  }

  // JMLE 交替 Newton–Raphson
  const maxIt = opts.maxIt || 120, tol = opts.tol || 1e-4;
  let it = 0, converged = false;
  for (; it < maxIt; it++){
    let maxChange = 0;
    // 更新人
    for (let n = 0; n < N; n++){
      const r = targetPerson(n); if (r === null) continue;
      let E = 0, V = 0;
      for (let i = 0; i < L; i++){
        if (X[n][i] === null || X[n][i] === undefined) continue;
        const p = logistic(theta[n] - delta[i]); E += p; V += p * (1 - p);
      }
      if (V < 1e-6) V = 1e-6;
      let step = (r - E) / V;
      step = Math.max(-1, Math.min(1, step));
      theta[n] += step;
      maxChange = Math.max(maxChange, Math.abs(step));
    }
    // 更新題
    for (let i = 0; i < L; i++){
      const r = targetItem(i); if (r === null) continue;
      let E = 0, V = 0;
      for (let n = 0; n < N; n++){
        if (X[n][i] === null || X[n][i] === undefined) continue;
        const p = logistic(theta[n] - delta[i]); E += p; V += p * (1 - p);
      }
      if (V < 1e-6) V = 1e-6;
      let step = (E - r) / V;
      step = Math.max(-1, Math.min(1, step));
      delta[i] += step;
      maxChange = Math.max(maxChange, Math.abs(step));
    }
    // 將題目難度中心化為 0（設定量尺原點）
    let m = 0, k = 0;
    for (let i = 0; i < L; i++){ if (iCount[i]){ m += delta[i]; k++; } }
    if (k){ m /= k; for (let i = 0; i < L; i++) delta[i] -= m; for (let n = 0; n < N; n++) theta[n] -= m; }
    if (maxChange < tol){ converged = true; break; }
  }

  // 標準誤與適配度
  const se = [], seItem = [], infit = [], outfit = [], pInfit = [], pOutfit = [];
  for (let n = 0; n < N; n++){
    let V = 0, num = 0, den = 0, oz = 0, oc = 0;
    for (let i = 0; i < L; i++){
      if (X[n][i] === null || X[n][i] === undefined) continue;
      const p = logistic(theta[n] - delta[i]), v = p * (1 - p);
      V += v; num += Math.pow(X[n][i] - p, 2); den += v;
      oz += Math.pow(X[n][i] - p, 2) / Math.max(v, 1e-6); oc++;
    }
    se.push(V > 0 ? 1 / Math.sqrt(V) : null);
    pInfit.push(den > 0 ? num / den : null);
    pOutfit.push(oc ? oz / oc : null);
  }
  for (let i = 0; i < L; i++){
    let V = 0, num = 0, den = 0, oz = 0, oc = 0;
    for (let n = 0; n < N; n++){
      if (X[n][i] === null || X[n][i] === undefined) continue;
      const p = logistic(theta[n] - delta[i]), v = p * (1 - p);
      V += v; num += Math.pow(X[n][i] - p, 2); den += v;
      oz += Math.pow(X[n][i] - p, 2) / Math.max(v, 1e-6); oc++;
    }
    seItem.push(V > 0 ? 1 / Math.sqrt(V) : null);
    infit.push(den > 0 ? num / den : null);
    outfit.push(oc ? oz / oc : null);
  }

  return {theta:theta, delta:delta, se:se, seItem:seItem,
          infit:infit, outfit:outfit, pInfit:pInfit, pOutfit:pOutfit,
          pScore:pScore, pCount:pCount, iScore:iScore, iCount:iCount,
          iterations:it, converged:converged};
}

/* KIDMAP 四象限判定 */
function quadrantOf(theta, delta, correct){
  const expectRight = theta > delta;
  if (correct && !expectRight) return 1;
  if (!correct && expectRight) return 2;
  if (!correct && !expectRight) return 3;
  return 4;
}

/* 針對一份派題執行完整診斷 */
function diagnose(state, aid){
  const asg = state.assignments.find(function(a){ return a.id === aid; });
  if (!asg) return null;
  const items = asg.itemIds.map(getItem).filter(function(it){ return it && it.type === 'mc'; });
  // 四個班級共用同一份題本、同一次校準，條件之間才可比較
  const roster = assignmentRoster(asg);
  const done = roster.filter(function(sid){
    return state.submissions.some(function(s){ return s.aid === aid && s.sid === sid; });
  });

  const X = done.map(function(sid){
    return items.map(function(it){
      const r = state.responses.find(function(r){ return r.aid === aid && r.sid === sid && r.iid === it.id; });
      return r ? (r.correct ? 1 : 0) : null;
    });
  });

  const minN = (state.settings && state.settings.minN) || 3;
  const ready = done.length >= minN && items.length >= 3;
  const est = ready ? estimateRasch(X) : null;

  const cells = [];         // 每一「人×題」的象限
  const perItem = items.map(function(it, i){
    return {item:it, idx:i, delta: est ? est.delta[i] : null,
            infit: est ? est.infit[i] : null, outfit: est ? est.outfit[i] : null,
            q:{1:0,2:0,3:0,4:0}, n:0, right:0, distractors:{}, q2Students:[], q1Students:[]};
  });
  const perStudent = done.map(function(sid, n){
    return {sid:sid, theta: est ? est.theta[n] : null, se: est ? est.se[n] : null,
            infit: est ? est.pInfit[n] : null,
            q:{1:0,2:0,3:0,4:0}, right:0, n:0, cells:[]};
  });

  if (ready){
    done.forEach(function(sid, n){
      items.forEach(function(it, i){
        const x = X[n][i]; if (x === null) return;
        const q = quadrantOf(est.theta[n], est.delta[i], x === 1);
        const resp = state.responses.find(function(r){ return r.aid === aid && r.sid === sid && r.iid === it.id; });
        const cell = {sid:sid, iid:it.id, i:i, n:n, correct:x === 1, q:q,
                      theta:est.theta[n], delta:est.delta[i], choice: resp ? resp.choice : null,
                      p: logistic(est.theta[n] - est.delta[i])};
        cells.push(cell);
        perItem[i].q[q]++; perItem[i].n++; if (x === 1) perItem[i].right++;
        perStudent[n].q[q]++; perStudent[n].n++; if (x === 1) perStudent[n].right++;
        perStudent[n].cells.push(cell);
        if (q === 2){
          perItem[i].q2Students.push(sid);
          const c = cell.choice;
          if (c !== null && c !== undefined) perItem[i].distractors[c] = (perItem[i].distractors[c] || 0) + 1;
        }
        if (q === 1) perItem[i].q1Students.push(sid);
      });
    });
  }

  perItem.forEach(function(pi){
    pi.misRate = pi.n ? pi.q[2] / pi.n : 0;
    pi.pass = pi.n ? pi.right / pi.n : 0;
    let best = null, bestC = 0;
    Object.keys(pi.distractors).forEach(function(k){
      if (pi.distractors[k] > bestC){ bestC = pi.distractors[k]; best = parseInt(k, 10); }
    });
    pi.topDistractor = best; pi.topDistractorN = bestC;
    pi.misCode = (best !== null && pi.item.why) ? (pi.item.why[best] || null) : null;
  });

  const thr = ((state.settings && state.settings.misThreshold) || 15) / 100;
  const flagged = perItem.filter(function(p){ return p.misRate >= thr && p.q[2] > 0; })
                         .sort(function(a, b){ return b.misRate - a.misRate; });

  const totals = {1:0,2:0,3:0,4:0};
  cells.forEach(function(c){ totals[c.q]++; });

  return {
    assignment: asg, items: items, roster: roster, done: done, ready: ready, minN: minN,
    est: est, cells: cells, perItem: perItem, perStudent: perStudent,
    flagged: flagged, totals: totals,
    meanTheta: est ? mean(est.theta) : null,
    meanDelta: est ? mean(est.delta) : null
  };
}

function mean(a){ const v = a.filter(function(x){ return typeof x === 'number' && isFinite(x); });
  return v.length ? v.reduce(function(s, x){ return s + x; }, 0) / v.length : 0; }
function sd(a){ const v = a.filter(function(x){ return typeof x === 'number' && isFinite(x); });
  if (v.length < 2) return 0; const m = mean(v);
  return Math.sqrt(v.reduce(function(s, x){ return s + (x - m) * (x - m); }, 0) / (v.length - 1)); }
