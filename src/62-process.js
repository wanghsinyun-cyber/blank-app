/* ==========================================================================
   62-process.js — 歷程層次分析
   ‧ 延宕序列分析（Lag Sequential Analysis, Bakeman & Gottman 調整殘差）
   ‧ 認知網絡分析（Epistemic Network Analysis：共現累積 → 球面正規化 → SVD 投影）
   ‧ 情感軌跡（詞典法）
   ========================================================================== */

/* ==========================================================================
   延宕序列分析
   ========================================================================== */
function lsa(opts){
  opts = opts || {};
  const codes = BEHAVIOR_ORDER;
  const idx = {}; codes.forEach(function(c, i){ idx[c] = i; });
  const n = codes.length;
  const F = codes.map(function(){ return new Array(n).fill(0); });

  // 依「同一位學生、同一題」切段，段與段之間不計轉移
  const seqs = {};
  /* 共用取樣：只留真正的行為碼並排掉「取消」。原本只檢查 e.code 有沒有值，
     於是取消標記／取消檢核與 RESUME 都被當成一次完整動作進入轉移矩陣。 */
  behaviorSeq(allLogs()).forEach(function(e){
    if (opts.cond && e.cond !== opts.cond) return;
    const k = e.sid + '|' + e.iid;
    (seqs[k] = seqs[k] || []).push(e);
  });
  let nSeq = 0, nEvent = 0;
  Object.keys(seqs).forEach(function(k){
    const s = seqs[k].sort(function(a, b){ return a.t - b.t; });
    nSeq++; nEvent += s.length;
    for (let i = 0; i + 1 < s.length; i++){
      const a = idx[s[i].code], b = idx[s[i + 1].code];
      if (a === undefined || b === undefined) continue;
      F[a][b]++;
    }
  });

  const rowT = F.map(function(r){ return r.reduce(function(a, b){ return a + b; }, 0); });
  const colT = codes.map(function(_, j){ return F.reduce(function(a, r){ return a + r[j]; }, 0); });
  const N = rowT.reduce(function(a, b){ return a + b; }, 0);

  const Z = F.map(function(r, i){
    return r.map(function(f, j){
      if (!N || !rowT[i] || !colT[j]) return 0;
      const E = rowT[i] * colT[j] / N;
      const d = E * (1 - rowT[i] / N) * (1 - colT[j] / N);
      return d > 0 ? (f - E) / Math.sqrt(d) : 0;
    });
  });
  const Tr = F.map(function(r, i){
    return r.map(function(f){ return rowT[i] ? f / rowT[i] : 0; });
  });

  const sig = [];
  Z.forEach(function(r, i){ r.forEach(function(z, j){
    if (Math.abs(z) >= 1.96 && F[i][j] > 0) sig.push({from:codes[i], to:codes[j], z:z, f:F[i][j], p:Tr[i][j]});
  }); });
  sig.sort(function(a, b){ return Math.abs(b.z) - Math.abs(a.z); });

  return {codes:codes, F:F, Z:Z, T:Tr, rowT:rowT, colT:colT, N:N,
          sig:sig, nSeq:nSeq, nEvent:nEvent};
}

/* ==========================================================================
   認知網絡分析
   ========================================================================== */
const ENA_CODES = [
  {id:'FR',   name:'直接提取', desc:'發話停留在找出文中明確寫出來的訊息。'},
  {id:'SI',   name:'直接推論', desc:'發話把相鄰訊息連起來，做出顯而易見的推論。'},
  {id:'II',   name:'詮釋整合', desc:'發話整合全文並帶入自己的知識，形成詮釋。'},
  {id:'EE',   name:'比較評估', desc:'發話評斷內容的合理性、完整性或作者立場。'},
  {id:'EVID', name:'援引依據', desc:'指出題目中的具體條件或標記題幹。'},
  {id:'MON',  name:'自我監控', desc:'檢查、驗算、送出前自我檢核。'},
  {id:'REV',  name:'修正',     desc:'對話之後更改選項或改寫作答。'},
  {id:'POS',  name:'正向情緒', desc:'發話帶正向情緒詞。'},
  {id:'NEG',  name:'負向情緒', desc:'發話帶負向情緒詞。'}
];

/* 把日誌轉成 ENA 的「行」：每一行帶有若干個編碼 */
function enaLines(){
  const lines = [];
  const seqs = {};
  /* 走共用取樣。原本這裡是 `if (!e.code) return;`——34-log.js 的
     behaviorSeq 註解把這一支當成原則的出處，但那次修正只套到 lsa()、
     toSDIS()、toENACsv() 三個入口，這一支自己沒改。
     RESUME 的 code 是 'R'，不在 BEHAVIOR_ORDER 裡，所以它照樣進入序列：
     它自己不產生任何 ENA 編碼，但佔掉序列裡一格，把 ASK 的 EVID 前後 ±2
     視窗與 OPTION／WRITE 的 REV 往前 3 格視窗各推遠一格。
     這一格只出現在中途重開的孩子身上，而且正好落在他斷電那一題的序列中間；
     REV（對話之後改答案）本來就是 tutor 條件被預期產生的行為，而重開後
     第一個動作往往就是回頭改那一題——AI 回覆一旦被擠出視窗，這個孩子在
     最該被記到 REV 的地方沒被記到，ENA 的組間投影因此帶進一個與
     「有沒有被中斷」相關、而非與條件相關的位移。 */
  behaviorSeq(allLogs()).forEach(function(e){
    const k = e.sid + '|' + e.iid;
    (seqs[k] = seqs[k] || []).push(e);
  });
  Object.keys(seqs).forEach(function(k){
    /* 「取消標記」「取消檢核」不是一次認知動作。原本 code 'M' 一律編成
       EVID（援引依據）、'C' 一律編成 MON（監控），連取消都算——
       於是反覆切換的孩子在認知網絡上看起來最會回到文本。
       寫入端記的是切換（見 34-log.js 的原則），讀取端要先把取消排掉。 */
    const s = seqs[k].filter(function(e){ return !(e.on === false || e.off === true); })
                     .sort(function(a, b){ return a.t - b.t; });
    s.forEach(function(e, i){
      const c = {};
      if (e.type === 'ASK'){
        c[codeUtteranceProcess(e.text || '')] = 1;
        const sm = sentimentOf(e.text || '');
        if (sm.score > 0.2) c.POS = 1;
        if (sm.score < -0.2) c.NEG = 1;
        // 前後兩步之內有標記題幹 → 援引依據
        for (let j = Math.max(0, i - 2); j <= Math.min(s.length - 1, i + 2); j++){
          if (s[j].code === 'M') c.EVID = 1;
        }
      } else if (e.code === 'M'){ c.EVID = 1;
      } else if (e.code === 'C'){ c.MON = 1;
      } else if (e.code === 'O' || e.code === 'W'){
        // 對話之後才發生的修改才算「修正」
        for (let j = Math.max(0, i - 3); j < i; j++){
          if (s[j].code === 'A' || String(s[j].code).indexOf('Q') === 0) c.REV = 1;
        }
      } else if (e.code === 'N'){
        const sm = sentimentOf(e.text || '');
        c[codeUtteranceProcess(e.text || '')] = 1;
        if (sm.score > 0.2) c.POS = 1;
        if (sm.score < -0.2) c.NEG = 1;
      }
      const on = Object.keys(c);
      if (on.length) lines.push({sid:e.sid, cond:e.cond, iid:e.iid, seq:k, i:i, codes:on});
    });
  });
  return lines;
}

/* 累積共現：單位＝學生，stanza＝同一題內的移動窗（預設 4 行） */
function enaAccumulate(window){
  const W = window || 4;
  const lines = enaLines();
  const ids = ENA_CODES.map(function(c){ return c.id; });
  const pairs = [];
  for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) pairs.push([a, b]);

  const bySeq = {};
  lines.forEach(function(l){ (bySeq[l.seq] = bySeq[l.seq] || []).push(l); });
  const units = {};
  Object.keys(bySeq).forEach(function(k){
    const L = bySeq[k];
    L.forEach(function(l, i){
      const win = L.slice(Math.max(0, i - W + 1), i + 1);
      const present = {};
      win.forEach(function(x){ x.codes.forEach(function(c){ present[c] = 1; }); });
      const u = units[l.sid] = units[l.sid] || {sid:l.sid, cond:l.cond, v:new Array(pairs.length).fill(0), n:0};
      pairs.forEach(function(p, pi){
        if (present[ids[p[0]]] && present[ids[p[1]]]) u.v[pi]++;
      });
      u.n++;
    });
  });

  const arr = Object.keys(units).map(function(k){ return units[k]; });
  // 球面正規化
  arr.forEach(function(u){
    const len = Math.sqrt(u.v.reduce(function(a, b){ return a + b * b; }, 0));
    u.norm = len > 0 ? u.v.map(function(x){ return x / len; }) : u.v.slice();
  });
  return {units:arr, pairs:pairs, ids:ids, W:W, lines:lines.length};
}

/* 以冪迭代求共變異數矩陣的前兩個主軸（SVD 的等價做法） */
function enaProject(acc){
  const U = acc.units;
  if (U.length < 3) return null;
  const d = acc.pairs.length;
  const mean = new Array(d).fill(0);
  U.forEach(function(u){ u.norm.forEach(function(x, i){ mean[i] += x / U.length; }); });
  const X = U.map(function(u){ return u.norm.map(function(x, i){ return x - mean[i]; }); });

  function mulCov(v){
    // (XᵀX)v，避免顯式建構 d×d 矩陣
    const t = X.map(function(row){
      let s = 0; for (let i = 0; i < d; i++) s += row[i] * v[i]; return s;
    });
    const out = new Array(d).fill(0);
    X.forEach(function(row, r){ for (let i = 0; i < d; i++) out[i] += row[i] * t[r]; });
    return out;
  }
  function power(deflate){
    let v = new Array(d).fill(0).map(function(_, i){ return Math.sin(i * 12.9898) * 0.5 + 0.5; });
    for (let it = 0; it < 220; it++){
      let w = mulCov(v);
      deflate.forEach(function(p){
        const dot = w.reduce(function(a, x, i){ return a + x * p[i]; }, 0);
        for (let i = 0; i < d; i++) w[i] -= dot * p[i];
      });
      const len = Math.sqrt(w.reduce(function(a, x){ return a + x * x; }, 0));
      if (len < 1e-12) break;
      v = w.map(function(x){ return x / len; });
    }
    return v;
  }
  const v1 = power([]);
  const v2 = power([v1]);
  function eig(v){
    const w = mulCov(v);
    return w.reduce(function(a, x, i){ return a + x * v[i]; }, 0);
  }
  const e1 = eig(v1), e2 = eig(v2);
  let tot = 0;
  X.forEach(function(row){ row.forEach(function(x){ tot += x * x; }); });

  const pts = U.map(function(u, r){
    return {sid:u.sid, cond:u.cond,
            x: X[r].reduce(function(a, x, i){ return a + x * v1[i]; }, 0),
            y: X[r].reduce(function(a, x, i){ return a + x * v2[i]; }, 0)};
  });
  return {pts:pts, v1:v1, v2:v2, var1: tot ? e1 / tot : 0, var2: tot ? e2 / tot : 0, mean:mean};
}

/* 各條件的平均網絡（邊權＝該條件單位向量的平均） */
function enaMeanNetworks(acc){
  const out = {};
  CONDITIONS.forEach(function(c){
    const U = acc.units.filter(function(u){ return u.cond === c.id; });
    if (!U.length) return;
    const v = new Array(acc.pairs.length).fill(0);
    U.forEach(function(u){ u.norm.forEach(function(x, i){ v[i] += x / U.length; }); });
    out[c.id] = {v:v, n:U.length};
  });
  return out;
}

/* ==========================================================================
   情感軌跡
   ========================================================================== */
function sentimentTrajectory(){
  const byCond = {};
  CONDITIONS.forEach(function(c){ byCond[c.id] = {turns:{}, items:{}, all:[]}; });
  allLogs().forEach(function(e){
    if (e.type !== 'ASK' && e.code !== 'N') return;
    const s = e.sent != null ? e.sent : sentimentOf(e.text || '').score;
    const b = byCond[e.cond]; if (!b) return;
    b.all.push(s);
    const tn = e.turn || 1;
    (b.turns[tn] = b.turns[tn] || []).push(s);
    (b.items[e.iid] = b.items[e.iid] || []).push(s);
  });
  const out = {};
  Object.keys(byCond).forEach(function(c){
    const b = byCond[c];
    out[c] = {
      mean: b.all.length ? mean(b.all) : null,
      n: b.all.length,
      pos: b.all.filter(function(x){ return x > 0.2; }).length,
      neg: b.all.filter(function(x){ return x < -0.2; }).length,
      byTurn: Object.keys(b.turns).sort(function(a, x){ return a - x; }).map(function(k){
        return {turn:+k, mean:mean(b.turns[k]), n:b.turns[k].length};
      }),
      byItem: Object.keys(b.items).map(function(k){
        return {iid:k, mean:mean(b.items[k]), n:b.items[k].length};
      })
    };
  });
  return out;
}

/* 相對歷程分布（RQ4 的描述統計） */
function relativeProcessProfile(){
  const out = {};
  CONDITIONS.forEach(function(c){ out[c.id] = {BELOW:0, AT:0, ABOVE:0, n:0}; });
  allLogs().forEach(function(e){
    if (e.type !== 'ASK') return;
    const rel = e.rel || (e.code === 'Q−' ? 'BELOW' : e.code === 'Q+' ? 'ABOVE' : 'AT');
    const b = out[e.cond]; if (!b) return;
    b[rel]++; b.n++;
  });
  return out;
}
