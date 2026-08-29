/* ==========================================================================
   60-analytics.js — 論述分析工具箱
   對應 Knowledge Forum 的 Analytic Toolkit：貢獻、延伸、閱讀、支架、詞彙、
   社會網絡；再加上本系統新增的「認識論層次」與「雙軌評量」。
   全部離線可算，不需要任何外部模型。
   ========================================================================== */

/* --- 單則貼文的認識論層次（1–4） --- */
function cueHits(text, list){
  let n = 0;
  list.forEach(function(c){ if (text.indexOf(c) >= 0) n++; });
  return n;
}
function epistemicLevel(n){
  const t = noteFullText(n);
  const causal = cueHits(t, EPISTEMIC_CUES.causal);
  const cond = cueHits(t, EPISTEMIC_CUES.conditional);
  const counter = cueHits(t, EPISTEMIC_CUES.counter);
  const evid = cueHits(t, EPISTEMIC_CUES.evidence);
  const rev = cueHits(t, EPISTEMIC_CUES.revision);
  const scaf = (n.segs || []).map(function(s){ return s.s; });
  const hasSynth = scaf.indexOf('s5') >= 0 || scaf.indexOf('s6') >= 0 || n.kind === 'rise';
  const hasChallenge = scaf.indexOf('s4') >= 0;
  const terms = domainTermsIn(t).length;

  let lv = 1;
  if (causal + cond > 0 || t.length > 60) lv = 2;
  if ((counter > 0 || evid > 0 || hasChallenge) && causal + cond > 0) lv = 3;
  if (hasSynth && (rev > 0 || (n.refs || []).length || (n.contains || []).length || terms >= 3)) lv = 4;
  return lv;
}
function domainTermsIn(t){
  return DOMAIN_TERMS.filter(function(w){ return t.indexOf(w) >= 0; });
}

const EPI_LABEL = {1:'陳述主張', 2:'提出理由', 3:'援引證據或反例', 4:'綜整並改進理論'};
/* 學生看到的版本：不可排序、不帶級數。把每個孩子的想法在社群空間裡
   標上「第 N 級」，等於當著全班替他的想法排名。 */
const EPI_LABEL_STUDENT = {1:'提出了看法', 2:'說了理由', 3:'找了證據', 4:'把大家的想法合起來'};
function epiLabelFor(n){
  const lv = epistemicLevel(n);
  return isTeacher() ? ('第 ' + lv + ' 級 · ' + EPI_LABEL[lv]) : EPI_LABEL_STUDENT[lv];
}

/* --- 每位學生的論述指標 --- */
/* ids 省略時預設是知識建構示範班——教師端的雙軌儀表板與 dualTrack()
   都靠這個範圍，而 #/dash 畫面上寫著「這一頁只涵蓋示範班」，
   改預設值會讓那句宣稱變成假的，象限中位數也會跨四個條件混算。
   要看別的母體請由呼叫端傳進來（例如學生看自己班）。 */
function discourseStats(ids){
  ids = ids || kbClass().studentIds;
  const byId = {};
  ids.forEach(function(sid){
    byId[sid] = {sid:sid, notes:0, buildMade:0, buildGot:0, rise:0, refs:0, ann:0,
                 reads:0, chars:0, scaffolds:{}, terms:{}, epiSum:0, epiN:0,
                 revisions:0, keywords:0, threads:{}};
  });
  /* 分母必須與 ids 同範圍。用全站 76 則當分母、分子只算本班的閱讀，
     每個人的閱讀率會被系統性壓到約 1/3.6——而 readRate 佔 kbi 權重 10%，
     那是依變項內部的跨範圍污染。 */
  const scoped = notesOfClass(ids);
  const total = scoped.length;

  scoped.forEach(function(n){
    const lv = epistemicLevel(n);
    const t = noteFullText(n);
    const terms = domainTermsIn(t);
    (n.authorIds || []).forEach(function(a){
      const s = byId[a]; if (!s) return;
      s.notes++;
      s.chars += t.length;
      s.epiSum += lv; s.epiN++;
      s.revisions += n.revisions || 0;
      s.keywords += (n.keywords || []).length;
      s.refs += (n.refs || []).length;
      if (n.kind === 'rise') s.rise++;
      (n.segs || []).forEach(function(g){ s.scaffolds[g.s] = (s.scaffolds[g.s] || 0) + 1; });
      terms.forEach(function(w){ s.terms[w] = (s.terms[w] || 0) + 1; });
      const root = threadRootOf(n); if (root) s.threads[root.id] = true;
      if (n.buildOn){
        s.buildMade++;
        const p = getNote(n.buildOn);
        if (p) (p.authorIds || []).forEach(function(pa){ if (byId[pa] && pa !== a) byId[pa].buildGot++; });
      }
    });
    (n.reads || []).forEach(function(r){ if (byId[r]) byId[r].reads++; });
    (n.annotations || []).forEach(function(an){ if (byId[an.authorId]) byId[an.authorId].ann++; });
  });

  const arr = ids.map(function(sid){
    const s = byId[sid];
    s.epi = s.epiN ? s.epiSum / s.epiN : 0;
    s.scaffoldKinds = Object.keys(s.scaffolds).length;
    s.termCount = Object.keys(s.terms).length;
    s.threadCount = Object.keys(s.threads).length;
    s.readRate = total ? s.reads / Math.max(1, total - s.notes) : 0;
    return s;
  });

  // 以班級最大值正規化後加權合成 KB 指數
  function mx(k){ return Math.max.apply(null, arr.map(function(s){ return s[k]; }).concat([1])); }
  const M = {notes:mx('notes'), buildMade:mx('buildMade'), buildGot:mx('buildGot'),
             termCount:mx('termCount'), scaffoldKinds:6, epi:4};
  arr.forEach(function(s){
    s.kbi = Math.round(100 * (
      0.15 * (s.notes / M.notes) +
      0.20 * (s.buildMade / M.buildMade) +
      0.15 * (s.buildGot / M.buildGot) +
      0.10 * Math.min(1, s.readRate) +
      0.10 * (s.scaffoldKinds / M.scaffoldKinds) +
      0.20 * (s.epi / M.epi) +
      0.10 * (s.termCount / M.termCount)
    ));
  });
  return arr;
}

/* --- 社會網絡：誰延伸誰的想法 --- */
function snaGraph(){
  const klass = kbClass();
  const ids = klass.studentIds.slice();
  const idx = {}; ids.forEach(function(id, i){ idx[id] = i; });
  const edges = {};
  /* 只看本班的貼文——跨班的 buildOn 不該進這張網 */
  notesOfClass(ids).forEach(function(n){
    if (!n.buildOn) return;
    const p = getNote(n.buildOn); if (!p) return;
    (n.authorIds || []).forEach(function(a){
      (p.authorIds || []).forEach(function(b){
        if (idx[a] === undefined || idx[b] === undefined || a === b) return;
        const k = a + '>' + b;
        edges[k] = (edges[k] || 0) + 1;
      });
    });
  });
  const list = Object.keys(edges).map(function(k){
    const p = k.split('>'); return {from:p[0], to:p[1], w:edges[k]};
  });
  const deg = {}; ids.forEach(function(id){ deg[id] = {out:0, in:0}; });
  list.forEach(function(e){ deg[e.from].out += e.w; deg[e.to].in += e.w; });
  const n = ids.length;
  const density = n > 1 ? list.length / (n * (n - 1)) : 0;
  let recip = 0;
  list.forEach(function(e){ if (edges[e.to + '>' + e.from]) recip++; });
  return {ids:ids, edges:list, deg:deg, density:density,
          reciprocity: list.length ? recip / list.length : 0,
          active: ids.filter(function(id){ return deg[id].in + deg[id].out > 0; }).length};
}

/* --- 詞彙成長：領域詞彙首次出現的累積曲線 --- */
function vocabGrowth(notes){
  const ns = (notes || notesOfClass(kbClass().studentIds)).slice()
    .sort(function(a, b){ return a.createdAt - b.createdAt; });
  const seen = {}; const pts = [];
  ns.forEach(function(n){
    domainTermsIn(noteFullText(n)).forEach(function(w){ seen[w] = true; });
    pts.push({t:n.createdAt, v:Object.keys(seen).length, note:n.id});
  });
  return {points:pts, terms:Object.keys(seen)};
}

/* --- 想法串的改進軌跡 --- */
function ideaImprovement(rootId){
  const seq = threadOf(rootId);
  let seen = {}; const steps = [];
  seq.forEach(function(x){
    const t = noteFullText(x.note);
    const terms = domainTermsIn(t);
    const fresh = terms.filter(function(w){ return !seen[w]; });
    fresh.forEach(function(w){ seen[w] = true; });
    steps.push({note:x.note, depth:x.depth, level:epistemicLevel(x.note),
                newTerms:fresh, scaffolds:(x.note.segs || []).map(function(s){ return s.s; })});
  });
  const levels = steps.map(function(s){ return s.level; });
  const improved = levels.length > 1 && Math.max.apply(null, levels.slice(1)) > levels[0];
  const hasChallenge = steps.some(function(s){ return s.scaffolds.indexOf('s4') >= 0; });
  const hasBetter = steps.some(function(s){ return s.scaffolds.indexOf('s5') >= 0 || s.scaffolds.indexOf('s6') >= 0; });
  return {steps:steps, improved:improved, hasChallenge:hasChallenge, hasBetter:hasBetter,
          arc: hasChallenge && hasBetter ? '完整（提出→挑戰→改進）'
             : hasChallenge ? '已被挑戰，尚未提出' + scaffoldLabel('s5')
             : hasBetter ? '已綜整，但缺少被挑戰的環節'
             : '仍停留在提出階段',
          newTermTotal: Object.keys(seen).length};
}

/* --- 雙軌評量：能力進展 × 論述參與 --- */
function dualTrack(){
  const pre = diagnose(state, 'a-pre');
  const post = diagnose(state, 'a-post');
  const ds = discourseStats();
  const dsMap = {}; ds.forEach(function(s){ dsMap[s.sid] = s; });
  const thetaPre = {}, thetaPost = {}, sePre = {}, sePost = {};
  if (pre && pre.ready) pre.perStudent.forEach(function(p){ thetaPre[p.sid] = p.theta; sePre[p.sid] = p.se; });
  if (post && post.ready) post.perStudent.forEach(function(p){ thetaPost[p.sid] = p.theta; sePost[p.sid] = p.se; });

  const rows = kbClass().studentIds.map(function(sid){
    const a = thetaPre[sid], b = thetaPost[sid];
    const d = (a != null && b != null) ? b - a : null;
    const st = dsMap[sid] || {kbi:0};
    /* 儀表板自己寫著「Δθ 小於 2×SE 不應解讀為真的進步」，然後用 Δθ 決定
       四格分區、每一格再附一句處方——系統點名孩子要優先介入，用的正是
       它剛說不可信的統計量。SE 本來就在 perStudent 裡，只是沒帶進來。 */
    const sd = (sePre[sid] != null && sePost[sid] != null)
      ? Math.sqrt(sePre[sid] * sePre[sid] + sePost[sid] * sePost[sid]) : null;
    return {sid:sid, thetaPre:a, thetaPost:b, delta:d, kbi:st.kbi, stats:st,
            sePre:sePre[sid], sePost:sePost[sid], seDelta:sd,
            sig: (d != null && sd != null) ? Math.abs(d) >= 2 * sd : false,
            q2Pre: pre && pre.ready ? (pre.perStudent.find(function(p){ return p.sid === sid; }) || {q:{}}).q[2] || 0 : 0,
            q2Post: post && post.ready ? (post.perStudent.find(function(p){ return p.sid === sid; }) || {q:{}}).q[2] || 0 : 0};
  });
  const dmed = median(rows.map(function(r){ return r.delta; }).filter(function(x){ return x != null; }));
  const kmed = median(rows.map(function(r){ return r.kbi; }));
  rows.forEach(function(r){
    const hiD = r.delta != null && r.delta >= dmed;
    const hiK = r.kbi >= kmed;
    r.zone = hiD && hiK ? 'A' : (!hiD && hiK ? 'B' : (hiD && !hiK ? 'C' : 'D'));
  });
  return {rows:rows, pre:pre, post:post, dmed:dmed, kmed:kmed};
}
const DUAL_ZONE = {
  A:{name:'共構轉化', desc:'論述參與高、能力也明顯進步。討論確實轉成了理解。', cls:'q1'},
  B:{name:'論述未轉化', desc:'貼文很多，但後測沒有跟上。要檢查他是否只在附和，而沒有真的改寫自己的理論。', cls:'q2'},
  C:{name:'個別成長', desc:'能力進步了，但幾乎不參與討論。可邀請他把已經懂的說出來，成為班上的知識資源。', cls:'q4'},
  D:{name:'需要介入', desc:'兩軌都低。優先安排小組指派角色與具體任務。', cls:'q3'}
};

function median(a){
  const v = a.filter(function(x){ return typeof x === 'number' && isFinite(x); }).sort(function(x, y){ return x - y; });
  if (!v.length) return 0;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

/* --- 社群層級摘要 --- */
function communitySummary(){
  /* 全部收在同一個班級範圍內。原本分子用 state.notes（四班 76 則），
     而頁首寫著「這一頁只涵蓋示範班」、隔壁 SNA 分頁對「延伸」給出 15——
     同一個儀表板對同一件事給兩個答案。 */
  const ids = kbClass().studentIds;
  const scoped = notesOfClass(ids);
  const ds = discourseStats(ids);
  const g = snaGraph();
  const vg = vocabGrowth(scoped);
  const roots = scoped.filter(function(n){ return !n.buildOn; });
  const withBuild = roots.filter(function(n){ return childrenOf(n.id).length > 0; });
  const rise = scoped.filter(function(n){ return n.kind === 'rise'; });
  const epi = scoped.map(epistemicLevel);
  return {
    notes: scoped.length,
    buildOns: scoped.filter(function(n){ return n.buildOn; }).length,
    riseAbove: rise.length,
    views: state.views.filter(function(v){ return (v.classId || kbClass().id) === kbClass().id; }).length,
    threads: roots.length,
    threadUptake: roots.length ? withBuild.length / roots.length : 0,
    contributors: ds.filter(function(s){ return s.notes > 0; }).length,
    roster: kbClass().studentIds.length,
    density: g.density,
    reciprocity: g.reciprocity,
    vocab: vg.terms.length,
    epiMean: mean(epi),
    epiDist: [1,2,3,4].map(function(l){ return epi.filter(function(x){ return x === l; }).length; }),
    kbiMean: mean(ds.map(function(s){ return s.kbi; }))
  };
}
