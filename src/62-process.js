/* ==========================================================================
   62-process.js — 歷程層次分析
   ‧ 延宕序列分析（Lag Sequential Analysis, Bakeman & Gottman 調整殘差）
   ‧ 認知網絡分析（Epistemic Network Analysis：共現累積 → 球面正規化 → SVD 投影）
   ‧ 情感軌跡（詞典法）
   ========================================================================== */

/* ==========================================================================
   延宕序列分析
   ========================================================================== */
/* 同一題的「第幾次坐下來」。lsa() 與 enaLines() 原本都以 sid|iid 切段，
   而 ENTER／EXIT 的 code 是 null、會被 behaviorSeq() 濾掉，所以同一題的
   多次造訪被黏成一段。於是：
     · LSA 會在「離開這一題前的最後一個動作」與「十幾分鐘後回來的
       第一個動作」之間記一次 lag-1 轉移
     · ENA 的 REV 判定是「往前 3 格裡有 A 或 Q 就算對話之後的修正」，
       孩子跟夥伴講完話、翻去別題、十幾分鐘後回來改選項，
       那個 OPTION 的前 3 格仍是離開前的 A／Q，於是被編成 REV。
   而只有三個 AI 條件會產生 'A' 與 'Q…'（對照組只有 'N'），
   這種假 REV 在結構上不可能出現在對照組，產生方向與操弄同向－－
   而「對話帶動修正」正是三個 AI 條件的核心宣稱。
   dwell 已經改用 ENTER→EXIT 累加，序列這一側要跟上。 */
function visitIndex(){
  const seen = {}, out = {};
  allLogs().slice().sort(function(a, b){ return a.t - b.t; }).forEach(function(e){
    const k = (e.sid || '_') + '|' + (e.iid || '_');
    if (e.type === 'ENTER') seen[k] = (seen[k] || 0) + 1;
    out[e.t + '|' + k] = seen[k] || 1;
  });
  return out;
}
function visitKey(e, vi){
  const k = (e.sid || '_') + '|' + (e.iid || '_');
  return k + '|v' + (vi[e.t + '|' + k] || 1);
}

function lsa(opts){
  opts = opts || {};
  const codes = BEHAVIOR_ORDER;
  const idx = {}; codes.forEach(function(c, i){ idx[c] = i; });
  const n = codes.length;
  const F = codes.map(function(){ return new Array(n).fill(0); });

  // 依「同一位學生、同一題、同一次造訪」切段（見 visitIndex）
  const seqs = {};
  const vi = visitIndex();
  /* 共用取樣：只留真正的行為碼並排掉「取消」。原本只檢查 e.code 有沒有值，
     於是取消標記／取消檢核與 RESUME 都被當成一次完整動作進入轉移矩陣。 */
  behaviorSeq(allLogs()).forEach(function(e){
    if (opts.cond && e.cond !== opts.cond) return;
    const k = visitKey(e, vi);
    (seqs[k] = seqs[k] || []).push(e);
  });
  let nSeq = 0, nEvent = 0;
  /* 先分人再合併，不要一路累加。原本所有學生的 lag-1 轉移直接堆進同一個 F，
     於是「把 T1 三十幾句逐句標下去」的孩子，在同一個 sid|iid|visit 段落裡
     就貢獻 35 筆以上連續的 M→M，而一般只標三五句的孩子貢獻 2–4 筆；
     每格只有 24 人，單一受試者就可能供應該條件 M 列與 M 欄的三分之一。
     34-log.js 的註解自己點名要解決的就是「M→M 的自轉移被灌爆，單一受試者
     就能位移整個矩陣的調整殘差」，但那次修正只排掉「取消」那一半，
     用正常標記走同一條路完全暢通。
     後果是 M→Q／M→O（回文本找依據之後才發話，RQ4 的核心宣稱）的期望次數
     被撐大而被壓到 1.96 以下，而「有沒有十分鐘可以一直點」由完課速度決定、
     完課速度與條件共變。

     這裡不做強制的 run-length 折疊（那會改動邊際分布，不宜當唯一解），
     改成每人等權：每位學生的轉移矩陣先各自正規化成總和 1，平均之後再
     乘回原本的總次數 N，殘差與轉移機率的算式一個字都不用改，
     而任何一位學生對任何一格的最大貢獻上限變成 1/人數。
     每格由幾人貢獻、最大單人占比多少，一起回傳給面板印出來。 */
  const perSid = {};                       // sid -> 轉移次數矩陣
  Object.keys(seqs).forEach(function(k){
    const s = seqs[k].sort(function(a, b){ return a.t - b.t; });
    nSeq++; nEvent += s.length;
    const sid = (s[0] && s[0].sid) || '_';
    const M = perSid[sid] || (perSid[sid] = codes.map(function(){ return new Array(n).fill(0); }));
    for (let i = 0; i + 1 < s.length; i++){
      const a = idx[s[i].code], b = idx[s[i + 1].code];
      if (a === undefined || b === undefined) continue;
      M[a][b]++;
    }
  });
  const sids = Object.keys(perSid);
  /* 原始（未加權）總次數，用來把等權後的比例乘回真實尺度 */
  let raw = 0;
  sids.forEach(function(sid){
    perSid[sid].forEach(function(r){ r.forEach(function(v){ raw += v; }); });
  });
  /* 每格的貢獻人數與最大單人占比（以未加權的原始次數計，才看得出誰在主導） */
  const contrib = codes.map(function(){ return new Array(n).fill(0); });
  const topShare = codes.map(function(){ return new Array(n).fill(0); });
  const cellRaw = codes.map(function(){ return new Array(n).fill(0); });
  sids.forEach(function(sid){
    const M = perSid[sid];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++){
      if (M[i][j] > 0){ contrib[i][j]++; cellRaw[i][j] += M[i][j]; }
    }
  });
  sids.forEach(function(sid){
    const M = perSid[sid];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++){
      if (cellRaw[i][j] > 0){
        const sh = M[i][j] / cellRaw[i][j];
        if (sh > topShare[i][j]) topShare[i][j] = sh;
      }
    }
  });
  /* 每人等權合併 */
  sids.forEach(function(sid){
    const M = perSid[sid];
    let tot = 0;
    M.forEach(function(r){ r.forEach(function(v){ tot += v; }); });
    if (!tot) return;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) F[i][j] += M[i][j] / tot;
  });
  if (raw > 0){
    let wsum = 0;
    F.forEach(function(r){ r.forEach(function(v){ wsum += v; }); });
    if (wsum > 0) for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) F[i][j] = F[i][j] / wsum * raw;
  }

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
          sig:sig, nSeq:nSeq, nEvent:nEvent,
          nSid:sids.length, contrib:contrib, topShare:topShare, cellRaw:cellRaw, rawN:raw};
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
  const vi = visitIndex();
  behaviorSeq(allLogs()).forEach(function(e){
    const k = visitKey(e, vi);
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
      /* 發話行的三個編碼（歷程、情緒、援引依據）對兩種發話一起套用。
         原本 EVID 的前後 ±2 掃描只寫在 ASK 這一支，'N'（無對象組寫在
         「我的筆記」裡的字）只拿到歷程與情緒。ENA 量的是同一行裡的共現，
         所以那一條「一邊標題幹、一邊說出自己的讀法」的邊，在對照組的網絡裡
         結構上不可能出現——不是孩子沒做，是讀取端沒編。
         對照組是 RQ1 的比較基準，這個缺口會被讀成「有 AI 才會回到文本」。
         標記事件本身在兩組都照樣獨立成行（下面的 e.code === 'M'），
         差別只在共現，所以補上這一支不會重複計數。 */
      if (e.type === 'ASK' || e.code === 'N'){
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
