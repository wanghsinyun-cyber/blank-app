/* ==========================================================================
   70-ai.js — AI 助評層
   兩套引擎並存，這是本系統在研究上的刻意設計：
   ‧ 內建規則引擎：離線、可重現、逐字可追溯到診斷資料與誘答標記。
   ‧ 外部語言模型：OpenAI Chat Completions 相容端點，提供彈性語言回饋。
   同一份 prompt 材料同時餵給兩者，便於做「人—規則—模型」三方比對。
   ========================================================================== */

function aiEngine(){ return state.settings.engine === 'llm' && state.settings.apiKey ? 'llm' : 'builtin'; }
function engineLabel(){ return aiEngine() === 'llm' ? '外部語言模型 · ' + state.settings.model : '內建規則引擎（離線可重現）'; }

function cacheKey(kind, id){ return kind + ':' + id + ':' + aiEngine(); }
function cacheGet(kind, id){ return state.aiCache[cacheKey(kind, id)]; }
function cacheSet(kind, id, val){ state.aiCache[cacheKey(kind, id)] = val; save(); }

/* --- 外部模型呼叫 --- */
async function llmChat(messages, o){
  o = o || {};
  const s = state.settings;
  if (!s.apiKey) throw new Error('尚未填入 API key。請到「系統設定」頁設定，或改用內建引擎。');
  const url = String(s.baseUrl || '').replace(/\/+$/, '') + '/chat/completions';
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + s.apiKey},
      body: JSON.stringify({model: s.model, messages: messages,
        temperature: o.temperature === undefined ? 0.4 : o.temperature,
        max_tokens: o.max_tokens || 1400})
    });
  } catch (e) {
    throw new Error('連不到 ' + url + '。線上發布版受安全政策限制無法連外部網址；請把本檔下載到電腦上開啟，或改用內建引擎。');
  }
  if (!res.ok){
    const t = await res.text().catch(function(){ return ''; });
    throw new Error('呼叫失敗（HTTP ' + res.status + '）' + (t ? '：' + t.slice(0, 200) : ''));
  }
  const j = await res.json();
  const txt = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
  if (!txt) throw new Error('沒有回傳內容，請確認模型名稱與端點正確。');
  return txt;
}

const SYS_TEACHER = '你是資深國小閱讀教學研究者，熟悉 PIRLS 四項理解歷程、KIDMAP 四象限診斷與 Rasch 測量。' +
  '請用臺灣繁體中文回答，行文像老師之間的討論，具體實用，避免空話與套語。用 Markdown 標題與清單排版，重點加粗。';
const SYS_KB = '你是知識建構（Knowledge Building, Scardamalia & Bereiter）研究者，熟悉 Knowledge Forum 的支架與想法改進歷程，' +
  '也熟悉形成性評量。請用臺灣繁體中文回答，聚焦在「想法如何被改進」而不是「答案對不對」，具體、可操作，避免空話。';

/* ==========================================================================
   材料建構：把診斷資料整理成人與模型都讀得懂的文字
   ========================================================================== */
function materialClass(diag){
  const L = [];
  L.push('作業：' + diag.assignment.title);
  L.push('完成人數：' + diag.done.length + ' / ' + diag.roster.length);
  L.push('平均能力估計值 θ：' + fx(diag.meanTheta) + ' logit；平均試題難度 δ：' + fx(diag.meanDelta) + ' logit');
  L.push('全體（四班合計）四象限總題次：優勢(I) ' + diag.totals[1] + '、迷思(II) ' + diag.totals[2] +
         '、合理答錯(III) ' + diag.totals[3] + '、合理答對(IV) ' + diag.totals[4]);
  L.push('');
  L.push('【主要迷思題】');
  diag.flagged.forEach(function(pi){
    const it = pi.item;
    L.push('- 第 ' + it.no + ' 題（' + unitName(it.unit) + '，' + processName(it.process) + '，' + it.diff + '）');
    L.push('  題幹：' + it.stem);
    L.push('  選項：' + it.options.map(function(o, i){ return String.fromCharCode(65 + i) + '. ' + o; }).join('　'));
    L.push('  正解：' + String.fromCharCode(65 + it.answer) + '　難度 δ=' + fx(pi.delta) + '　全體（四班合計）答對率 ' + pct(pi.pass));
    L.push('  迷思(II) ' + pi.q[2] + ' 人（占作答 ' + pct(pi.misRate) + '）；優勢(I) ' + pi.q[1] + ' 人');
    if (pi.topDistractor != null){
      L.push('  迷思學生最常選：' + String.fromCharCode(65 + pi.topDistractor) + '. ' +
             it.options[pi.topDistractor] + '（' + pi.topDistractorN + ' 人）');
    }
    if (pi.misCode){
      const m = MISCONCEPTIONS.find(function(x){ return x.id === pi.misCode; });
      if (m) L.push('  題庫標記的理解失誤：' + m.name + '——' + m.desc);
    }
  });
  return L.join('\n');
}

function materialNote(n){
  const L = [];
  L.push('貼文標題：' + n.title);
  L.push('作者：' + noteAuthors(n));
  (n.segs || []).forEach(function(g){
    L.push('［' + scaffoldLabel(g.s) + '］' + g.text);
  });
  if (n.buildOn){ const p = getNote(n.buildOn); if (p) L.push('（此篇延伸自：' + p.title + '）'); }
  const kids = childrenOf(n.id);
  if (kids.length) L.push('（有 ' + kids.length + ' 篇延伸自此篇）');
  return L.join('\n');
}

function materialThread(rootId){
  const seq = threadOf(rootId);
  return seq.map(function(x){
    const pre = '　'.repeat(x.depth) + (x.depth ? '↳ ' : '● ');
    return pre + x.note.title + '（' + noteAuthors(x.note) + '）\n' +
      (x.note.segs || []).map(function(g){ return '　'.repeat(x.depth + 1) + '［' + scaffoldLabel(g.s) + '］' + g.text; }).join('\n');
  }).join('\n');
}

/* ==========================================================================
   1. 全體（四班合計）迷思深度分析
   ========================================================================== */
async function aiClassMisconception(diag, force){
  const id = diag.assignment.id;
  if (!force){ const c = cacheGet('class', id); if (c) return c; }
  let out;
  if (aiEngine() === 'llm'){
    out = await llmChat([
      {role:'system', content: SYS_TEACHER},
      {role:'user', content: materialClass(diag) + '\n\n請依序回覆：\n' +
        '1.【共同迷思診斷】把主要迷思題聚合起來看，找出學生共同卡住的概念。\n' +
        '2.【每一題的迷思解釋】說明為何學生會選那個誘答選項。\n' +
        '3.【具體教學策略】每個共同迷思給 2–3 個可執行的教學動作。\n' +
        '4.【轉為共構問題】針對其中最值得全體討論的 1–2 個迷思，寫出可以直接貼到知識建構空間的問題敘述。\n' +
        '5.【下一步派題建議】接下來派哪個單元或題型能繼續診斷或補救。'}
    ]);
  } else {
    out = builtinClassReport(diag);
  }
  cacheSet('class', id, out);
  return out;
}

function builtinClassReport(diag){
  const L = [];
  const byMis = {};
  diag.flagged.forEach(function(pi){
    const k = pi.misCode || 'other';
    (byMis[k] = byMis[k] || []).push(pi);
  });
  L.push('#### 1. 共同迷思診斷');
  const keys = Object.keys(byMis).sort(function(a, b){
    return sumQ2(byMis[b]) - sumQ2(byMis[a]);
  });
  if (!keys.length){
    L.push('目前沒有任何題目的迷思(II)比例超過門檻 ' + state.settings.misThreshold + '%。全體（四班合計）的錯誤大多落在「合理答錯」，代表是難度問題而非概念問題，可以直接進入練習與精熟。');
  }
  keys.forEach(function(k){
    const g = byMis[k];
    const m = MISCONCEPTIONS.find(function(x){ return x.id === k; });
    const students = uniq(g.reduce(function(a, pi){ return a.concat(pi.q2Students); }, []));
    L.push('**' + (m ? m.name : '其他錯誤型態') + '**（' + g.length + ' 題受影響，涉及 ' + students.length + ' 位學生）');
    if (m) L.push('- 概念描述：' + m.desc);
    L.push('- 相關題號：' + g.map(function(pi){ return '第 ' + pi.item.no + ' 題（迷思 ' + pct(pi.misRate) + '）'; }).join('、'));
    L.push('- 落在此迷思的學生：' + students.slice(0, 12).map(userName).join('、') + (students.length > 12 ? ' 等' : ''));
    L.push('');
  });

  L.push('#### 2. 每一題的迷思解釋');
  diag.flagged.forEach(function(pi){
    const it = pi.item;
    L.push('**第 ' + it.no + ' 題**（' + unitName(it.unit) + ' · ' + processName(it.process) + ' · δ=' + fx(pi.delta) + '）');
    L.push('- ' + it.stem);
    if (pi.topDistractor != null){
      L.push('- 迷思學生最常選 **' + String.fromCharCode(65 + pi.topDistractor) + '. ' + it.options[pi.topDistractor] + '**（' + pi.topDistractorN + ' 人）。');
      const m = pi.misCode ? MISCONCEPTIONS.find(function(x){ return x.id === pi.misCode; }) : null;
      if (m) L.push('- 這個選項之所以吸引人，是因為 ' + m.desc);
      else L.push('- 這個選項沒有對應到題庫既有的迷思標記，建議人工檢視學生的作答理由。');
    }
    L.push('- 命題備註：' + it.note);
    L.push('');
  });

  L.push('#### 3. 具體教學策略');
  keys.forEach(function(k){
    const m = MISCONCEPTIONS.find(function(x){ return x.id === k; });
    const acts = STRATEGY[k] || ['請學生把自己的判斷依據寫出來，再與同儕互相檢查。',
      '提供一個「答案對但理由來自常識」的作答，讓學生指出問題。',
      '要求每題都回到文本圈出依據的那一句。'];
    L.push('**' + (m ? m.name : '其他') + '**');
    acts.forEach(function(a){ L.push('- ' + a); });
    L.push('');
  });

  L.push('#### 4. 轉為共構問題');
  const top = diag.flagged.slice(0, 2);
  if (!top.length){
    L.push('目前沒有需要立即開啟共構的迷思題。');
  }
  top.forEach(function(pi){
    L.push('**第 ' + pi.item.no + ' 題 → 可直接貼到知識建構空間的問題敘述**');
    L.push('');
    L.push('> ' + buildInquiryPrompt(pi, diag).split('\n').join('\n> '));
    L.push('');
    L.push('在「派題診斷 → 迷思橋接」按下〈開啟共構視圖〉，系統會把這段話與該題一起貼進新的視圖，並自動標出可以擔任知識資源人的同學。');
    L.push('');
  });

  L.push('#### 5. 下一步派題建議');
  const units = uniq(diag.flagged.map(function(pi){ return pi.item.unit; }));
  if (units.length){
    L.push('- 補救優先單元：' + units.map(unitName).join('、') + '。');
    L.push('- 建議在共構討論結束後，用相同題組施測一次（本系統的「共構後測」），並比較每位學生的 θ 變化與論述參與，看討論是否真的轉成理解。');
  }
  const weakest = diag.perItem.slice().sort(function(a, b){ return a.pass - b.pass; })[0];
  if (weakest) L.push('- 全體（四班合計）答對率最低的是第 ' + weakest.item.no + ' 題（' + pct(weakest.pass) + '），若其迷思比例不高，代表是難度而非概念問題，可先做鷹架式練習。');
  L.push('');
  L.push('---');
  L.push('*本報告由內建規則引擎產生：所有數字直接來自 Rasch 估計與誘答選項標記，不含語言模型生成內容，可重現。*');
  return L.join('\n');
}

function sumQ2(list){ return list.reduce(function(s, p){ return s + p.q[2]; }, 0); }
function uniq(a){ const o = {}; const r = []; a.forEach(function(x){ if (!o[x]){ o[x] = 1; r.push(x); } }); return r; }

/* 八種理解失誤對應的教學動作。診斷不依賴語言模型，這張表是離線引擎的知識來源。 */
const STRATEGY = {
  E1:['規定回答任何一題之前，先在文本上把依據的那一句畫起來，畫不出來就不能作答。',
      '把「文章說的」與「我覺得的」畫成兩欄，請學生把自己的理由分類進去。',
      '刻意給一題答案正確但理由來自常識的作答，請全班找出問題在哪裡。'],
  E2:['請學生說出「你是在第幾段找到的」，再全班一起回去核對那一段有沒有真的講到。',
      '練習先看題目的關鍵詞，再用關鍵詞回文本掃描，而不是從頭讀到尾。',
      '把四個選項各自對應到文本的哪一段標出來，讓學生看到誘答其實來自別段。'],
  E3:['問「這一句和前一句合起來告訴我們什麼」，訓練把相鄰訊息連起來。',
      '拿掉題目，只給兩句話，請學生說出中間隱含的因果或關係。',
      '對照「文章直接寫的」與「要自己補上的」，讓學生知道推論是被允許的。'],
  E4:['要求每個推論都補一句「我是從第◯段推出來的」，推不回去就是推太遠。',
      '給一個過度推論的例子，請學生指出文本到哪裡為止是有支持的。',
      '練習用「文章只說到……，沒有說……」的句型描述文本的邊界。'],
  E5:['遇到代名詞就停下來，把它替換成所指的名詞再讀一次，看句子通不通。',
      '在文本上用箭頭把代名詞連到指涉對象，全班一起核對。',
      '刻意選一段有多個可能指涉對象的文字，討論怎麼判斷。'],
  E6:['問「這是講某一個例子，還是講通常都會這樣」，逐句分類。',
      '請學生找出文中真正的概括句，並說明它和例子的關係。',
      '給一個把單一例子當通則的說法，請學生用文中另一個例子推翻它。'],
  E7:['把「我的經驗」寫在便利貼上貼旁邊，先跟文本分開，再討論它能不能當依據。',
      '問「如果沒有讀過這篇文章，你還會這樣回答嗎」——會的話，那就不是從文章讀出來的。',
      '練習先回答「文章怎麼說」，再回答「我怎麼想」，兩步分開。'],
  E8:['問「作者為什麼要寫這一段」，把注意力從內容轉到寫作用意。',
      '找出文中帶有態度的用詞，討論作者的立場藏在哪裡。',
      '請學生用一句話說出「作者想讓我們覺得什麼」，並指出支持的句子。']
};

/* ==========================================================================
   2. 單題教學策略
   ========================================================================== */
async function aiItemStrategy(diag, pi, force){
  const id = diag.assignment.id + '#' + pi.item.id;
  if (!force){ const c = cacheGet('item', id); if (c) return c; }
  let out;
  if (aiEngine() === 'llm'){
    const it = pi.item;
    out = await llmChat([
      {role:'system', content:'你是資深國小閱讀教師。針對單題的理解失誤提出具體教學建議。用臺灣繁體中文，動詞驅動、短句、具體，控制在 300 字內，用 Markdown 短列點。'},
      {role:'user', content:'題幹：' + it.stem + '\n選項：' +
        it.options.map(function(o, i){ return String.fromCharCode(65 + i) + '. ' + o; }).join('　') +
        '\n正解：' + String.fromCharCode(65 + it.answer) +
        '\n迷思學生 ' + pi.q[2] + ' 人，最常選 ' + (pi.topDistractor != null ? String.fromCharCode(65 + pi.topDistractor) : '無') +
        '\n\n請回答：1. 學生選錯選項的可能推理錯誤（1–2 句）。2. 三個具體教學動作。3. 這是概念錯、程序錯還是策略錯（單選並補一句說明）。'}
    ], {max_tokens:700});
  } else {
    out = builtinItemStrategy(pi);
  }
  cacheSet('item', id, out);
  return out;
}

function builtinItemStrategy(pi){
  const it = pi.item;
  const m = pi.misCode ? MISCONCEPTIONS.find(function(x){ return x.id === pi.misCode; }) : null;
  const L = [];
  L.push('#### 學生可能的推理路徑');
  if (pi.topDistractor != null){
    L.push('選 **' + String.fromCharCode(65 + pi.topDistractor) + '. ' + it.options[pi.topDistractor] + '** 的 ' +
      pi.topDistractorN + ' 位同學，很可能是' + (m ? m.desc : '在中途跳過了一個檢驗步驟'));
  } else {
    L.push('這一題的錯誤選項分散，沒有集中的誘答，較可能是粗心或時間不足，而非單一迷思。');
  }
  L.push('');
  L.push('#### 三個教學動作');
  const acts = (pi.misCode && STRATEGY[pi.misCode]) || [
    '請兩位落在迷思象限的同學說說他們是從哪一段讀到的，先不要糾正。',
    '把四個選項各自對應到文本的哪一段標出來，讓學生看到誘答其實來自別的地方。',
    '要求每個答案都補一句「我是從第◯段第◯句看出來的」，寫不出來就回去再讀一次。'];
  acts.forEach(function(a){ L.push('- ' + a); });
  L.push('');
  L.push('#### 失誤類型判斷');
  /* 依 READING_ERRORS（E1–E8）分成四類閱讀失誤；沒有掛代碼時退回「歷程不明」。 */
  const READ_TYPE = {
    E1:'依據失誤', E7:'依據失誤',
    E2:'定位失誤', E5:'定位失誤',
    E3:'推論失誤', E4:'推論失誤', E6:'推論失誤',
    E8:'評估失誤'
  };
  const TYPE_DESC = {
    '依據失誤':'學生根本沒有回到文本，是憑常識或生活經驗作答。補讀更多文章沒有用，' +
               '要先建立「不畫出依據就不能作答」的規矩。',
    '定位失誤':'學生知道要回文本，但停在錯的段落或認錯了指涉對象。' +
               '適合用「關鍵詞 → 掃描 → 核對」的固定流程矯正。',
    '推論失誤':'學生找得到訊息，問題出在連起來的那一步——不是停在字面，就是推得超出文本能支持的範圍。' +
               '適合練習描述文本的邊界：「文章只說到……，沒有說……」。',
    '評估失誤':'學生讀得懂內容，但沒有讀出作者的態度與寫作用意。' +
               '適合用同一件事的兩種寫法對照，讓立場浮出來。',
    '歷程不明':'這一題的誘答沒有掛失誤代碼，無法判斷失誤型態。' +
               '建議先補上誘答標記——規則引擎的診斷品質完全取決於這一步。'
  };
  const type = (m && READ_TYPE[m.id]) || '歷程不明';
  L.push('**' + type + '**：' + TYPE_DESC[type]);
  L.push('');
  L.push('#### 建議的共構切入點');
  L.push('把這一題貼進知識建構空間時，不要問「正確答案是什麼」，改問「' +
    (m ? '「' + m.name + '」' : '這樣的讀法') + '在什麼情況下會讓我們讀錯？請從文章裡舉一個例子」。');
  return L.join('\n');
}

/* ==========================================================================
   3. 非選題評量規準
   ========================================================================== */
async function aiRubric(item, force){
  if (!force){ const c = cacheGet('rubric', item.id); if (c) return c; }
  let out;
  if (aiEngine() === 'llm'){
    out = await llmChat([
      {role:'system', content:'你是資深國小閱讀教師，熟悉 PIRLS 建構反應題的閱卷標準。用臺灣繁體中文，具體可操作，避免空話。'},
      {role:'user', content:'題目：' + item.stem + '\n單元：' + unitName(item.unit) +
        '\n\n請產出評量規準（Markdown）：開頭寫「滿分：N 分」；分成三個向度並標配分（回到文本、推論或評估品質、表達與論證）；最後列出 3 個常見錯誤與扣分建議。只要規準本身，不要開場白。'}
    ], {max_tokens:900});
  } else {
    out = builtinRubric(item);
  }
  cacheSet('rubric', item.id, out);
  return out;
}

function builtinRubric(item){
  const L = [];
  L.push('**滿分：6 分**');
  L.push('');
  L.push('#### 評分向度');
  L.push('| 向度 | 配分 | 給分描述 |');
  L.push('| --- | --- | --- |');
  if (item.id === 'C01'){
    /* II 詮釋整合 · II-2：思考人物行動的其他可能作法 */
    L.push('| 回到文本 | 2 | 理由明確連到故事裡的某一段（不必寫出段號，但要看得出依據來自文本）。只寫「因為他很可憐」這類沒有文本依據的理由給 0 分。 |');
    L.push('| 詮釋品質 | 3 | 提出的做法與「老先生每天搬樹是為了太太」這個已詮釋出來的動機一致；能說出這個做法會帶來什麼結果。做法與動機無關給 1 分。 |');
    L.push('| 表達與論證 | 1 | 做法與理由分得清楚，讀得出「我會做什麼」與「我為什麼這樣做」兩層。 |');
    L.push('');
    L.push('#### 扣分要點');
    L.push('- **只寫做法沒有理由**：扣 3 分。本題明確要求說明理由，理由才是評的東西。');
    L.push('- **理由來自生活經驗而非文本**（E7 以經驗代替文本）：扣 2 分，並在評語中請學生指出是從哪一段看出來的。');
    L.push('- **推論超出文本**（E4 過度推論，例如斷定阿嬤一定會康復）：扣 1 分，提醒區分「文章說的」與「我希望的」。');
  } else {
    /* EE 比較評估 · EE-3：評斷文中訊息的完整性或清晰度 */
    L.push('| 指出空缺 | 3 | 提出的問題確實是這篇文章沒有回答的，且與文章主題相關（例如「哪一種傳播方法最有效」「為什麼有些植物同時用兩種方法」）。問題與文章無關給 0 分。 |');
    L.push('| 說明不足的理由 | 2 | 能指出文章寫到哪裡為止，說明為什麼現有訊息不足以回答；有引用或轉述文中相關段落。 |');
    L.push('| 表達 | 1 | 問題寫成一個完整、可回答的問句，不是感嘆或評論。 |');
    L.push('');
    L.push('#### 扣分要點');
    L.push('- **問題其實文章有答**（E2 找錯位置）：扣 3 分，並帶學生回到該段核對。');
    L.push('- **泛泛的好奇**（「我想知道更多關於植物的事」）：扣 2 分。本題評的是能否指出**具體**的空缺。');
    L.push('- **只提問沒說明為什麼不足**：扣 2 分。說明才是比較評估歷程的證據。');
  }
  L.push('');
  L.push('*本規準由內建規則引擎依題目類型產生，請老師依班級狀況調整後再使用。*');
  return L.join('\n');
}

/* ==========================================================================
   4. 相似題生成
   ========================================================================== */
async function aiSimilarItems(item, force){
  if (!force){ const c = cacheGet('similar', item.id); if (c) return c; }
  let out;
  if (aiEngine() === 'llm'){
    const txt = await llmChat([
      {role:'system', content:'你是資深閱讀評量命題者，熟悉 PIRLS 題型與四項理解歷程。請嚴格輸出 JSON，不要多任何說明。'},
      {role:'user', content:'原題：' + item.stem + '\n選項：' +
        item.options.map(function(o, i){ return String.fromCharCode(65 + i) + '. ' + o; }).join('　') +
        '\n正解：' + String.fromCharCode(65 + item.answer) +
        '\n\n請仿造 3 道概念相同、數字或情境不同的相似題，難度與原題相近。每題四個選項，正解隨機分布，誘答要真的可能被選錯，並附一句話解題思路。' +
        '只回傳 JSON：{"items":[{"stem":"","options":["","","",""],"answer":0,"hint":""}]}'}
    ], {temperature:0.8, max_tokens:1200});
    const m = txt.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('回傳的格式不正確，請再試一次。');
    out = JSON.parse(m[0]).items;
  } else {
    out = builtinSimilar(item);
  }
  /* 相似題也要過洩答篩檢。這條通道原本一次都沒過，而 #/about 對老師寫著
     「每一則回應送出前都會過一次篩檢，攔截次數本身即為忠實度指標」——
     漏掉任何一條通道，那個計數就不是可報告的指標。 */
  out = out.map(function(x){
    const g = leakGuard(x.stem + ' ' + (x.hint || ''), item);
    return g.blocked ? null : x;
  }).filter(Boolean);
  cacheSet('similar', item.id, out);
  return out;
}


/* 內建引擎不「生成」新題——閱讀題離不開文本，憑空造題會造出沒有文本依據的題目。
   改為從現有題庫挑出「測同一項理解歷程」的題目：先取同一篇文本的，不足再跨文本補，
   讓老師拿得到可以直接用的替代題，而不是一段看起來像題目的生成文字。 */
function builtinSimilar(item){
  const sameProc = function(i){ return i.type === 'mc' && i.id !== item.id && i.process === item.process; };
  const near = ITEMS.filter(function(i){ return sameProc(i) && i.unit === item.unit; });
  const far  = ITEMS.filter(function(i){ return sameProc(i) && i.unit !== item.unit; });
  const alt = near.concat(far).slice(0, 3).map(function(i){
    return {stem:i.stem, options:i.options, answer:i.answer,
            hint:'同樣測「' + processName(i.process) + '」' +
                 (i.unit === item.unit ? '，同一篇文本' : '，取自' + textTitle(i.unit)) +
                 '。' + (i.note || '')};
  });
  return alt.length ? alt : [{stem:'（題庫裡沒有其他測同一項理解歷程的選擇題。' +
      '切換到外部語言模型可以依這篇文本即時生成；離線模式不會憑空造閱讀題。）',
    options:['—','—','—','—'], answer:0, hint:'到「系統設定」填入 OpenAI 相容端點與 API key。'}];
}

/* ==========================================================================
   5. 貼文形成性回饋（知識建構評量）
   ========================================================================== */
async function aiNoteFeedback(n, force){
  if (!force){ const c = cacheGet('note', n.id); if (c) return c; }
  let out;
  if (aiEngine() === 'llm'){
    out = await llmChat([
      {role:'system', content: SYS_KB},
      {role:'user', content: materialNote(n) + '\n\n請以形成性回饋的方式回覆，控制在 250 字內：\n' +
        '1. 這則貼文對社群知識的貢獻是什麼（一句）。\n' +
        '2. 想法改進的層次落在「陳述主張／提出理由／援引證據或反例／綜整並改進理論」哪一級，為什麼。\n' +
        '3. 給作者一個可以立刻做的下一步（用「你可以試試看……」開頭，不要直接給答案）。'}
    ], {max_tokens:600});
  } else {
    out = builtinNoteFeedback(n);
  }
  cacheSet('note', n.id, out);
  return out;
}

function builtinNoteFeedback(n){
  const t = noteFullText(n);
  const lv = epistemicLevel(n);
  const terms = domainTermsIn(t);
  const scaf = uniq((n.segs || []).map(function(s){ return s.s; }));
  const kids = childrenOf(n.id);
  const L = [];
  L.push('#### 對社群知識的貢獻');
  if (n.kind === 'rise') L.push('這是一則躍升貼文，把分散的想法收攏成全班可以共用的說法——社群知識因此有了可引用的版本。');
  else if (scaf.indexOf('s4') >= 0) L.push('這則貼文提出了挑戰，指出既有說法解釋不了的地方。想法要改進，必須先有人做這件事。');
  else if (scaf.indexOf('s3') >= 0) L.push('這則貼文帶進了外部資訊，讓討論不再只靠印象，而有可以檢核的依據。');
  else if (kids.length) L.push('這則貼文引出了 ' + kids.length + ' 篇延伸，是這條想法串的推進點。');
  else L.push('這則貼文提出了個人目前的想法，是後續討論可以接住的起點。');
  L.push('');
  L.push('#### 想法改進的層次');
  L.push('**第 ' + lv + ' 級 · ' + EPI_LABEL[lv] + '**');
  const reasons = [];
  if (cueHits(t, EPISTEMIC_CUES.causal) + cueHits(t, EPISTEMIC_CUES.conditional) > 0) reasons.push('有用因果或條件語句把理由說出來');
  if (cueHits(t, EPISTEMIC_CUES.counter) > 0) reasons.push('出現反例或轉折，代表在檢驗說法的界線');
  if (cueHits(t, EPISTEMIC_CUES.evidence) > 0) reasons.push('援引了課本、例子或實際計算作為依據');
  if (cueHits(t, EPISTEMIC_CUES.revision) > 0) reasons.push('有修正自己先前想法的語言');
  if ((n.refs || []).length || (n.contains || []).length) reasons.push('引用或收攏了其他人的貼文');
  L.push(reasons.length ? '判定依據：' + reasons.join('；') + '。' : '判定依據：目前只看到主張，還沒有出現理由、例子或反例。');
  if (terms.length) L.push('使用的領域詞彙：' + terms.join('、') + '。');
  L.push('');
  L.push('#### 你可以試試看');
  if (lv <= 1) L.push('- 你可以試試看在句子後面加一句「因為……」，把你為什麼這樣想寫出來，別人才有東西可以接。');
  else if (lv === 2) L.push('- 你可以試試看舉一個具體的數字例子，或找一個「照你的說法會說不通」的情況，把理由變成可以檢驗的東西。');
  else if (lv === 3) L.push('- 你可以試試看用「更好的理論」支架，把你和前面同學的說法合併寫成一個新版本，並說明新版本改掉了什麼。');
  else L.push('- 你可以試試看把這個版本貼回原本的問題貼文下面，並標出「還沒解決的部分」，讓討論有下一步。');
  if (!kids.length && n.kind !== 'problem') L.push('- 這則還沒有人延伸。你可以試試看主動去讀兩則別人的貼文並回應，通常也會有人回來讀你的。');
  L.push('');
  L.push('*本回饋由內建規則引擎依論述特徵（連接詞、反例、證據、修正語、支架使用、引用關係）計算，可重現。*');
  return L.join('\n');
}

/* ==========================================================================
   6. 想法串綜整（躍升建議）
   ========================================================================== */
async function aiThreadSynthesis(rootId, force){
  if (!force){ const c = cacheGet('thread', rootId); if (c) return c; }
  let out;
  if (aiEngine() === 'llm'){
    out = await llmChat([
      {role:'system', content: SYS_KB},
      {role:'user', content: materialThread(rootId) + '\n\n請回覆：\n' +
        '1.【這條想法串走到哪裡】用三句話描述想法怎麼被改進的。\n' +
        '2.【還沒解決的問題】列出 2–3 個社群還沒回答的問題。\n' +
        '3.【躍升貼文草稿】寫一則可以直接貼上去的「綜合我們的知識」貼文，要引用具體是誰說了什麼。\n' +
        '4.【誰還沒進來】從論述看，哪一類同學的想法還沒出現。'}
    ], {max_tokens:1100});
  } else {
    out = builtinThreadSynthesis(rootId);
  }
  cacheSet('thread', rootId, out);
  return out;
}

function builtinThreadSynthesis(rootId){
  const ii = ideaImprovement(rootId);
  const seq = ii.steps;
  const L = [];
  L.push('#### 這條想法串走到哪裡');
  L.push('- 共 ' + seq.length + ' 則貼文，參與者 ' +
    uniq(seq.reduce(function(a, s){ return a.concat(s.note.authorIds); }, [])).map(userName).join('、') + '。');
  L.push('- 論述層次由第 ' + seq[0].level + ' 級起，最高到第 ' + Math.max.apply(null, seq.map(function(s){ return s.level; })) + ' 級。');
  L.push('- 改進弧線：**' + ii.arc + '**。');
  L.push('- 過程中新出現的領域詞彙共 ' + ii.newTermTotal + ' 個。');
  L.push('');
  L.push('#### 還沒解決的問題');
  const opens = seq.filter(function(s){ return s.scaffolds.indexOf('s2') >= 0; });
  if (opens.length){
    opens.forEach(function(s){
      const seg = (s.note.segs || []).find(function(g){ return g.s === 's2'; });
      L.push('- ' + userName(s.note.authorIds[0]) + '：「' + (seg ? shortStem(seg.text) : s.note.title) + '」');
    });
  } else {
    L.push('- 這條串裡沒有人用「我需要理解」支架。請刻意邀請學生把還不懂的地方寫出來——沒有問題，想法就不會再往前。');
  }
  if (!ii.hasChallenge) L.push('- **缺少挑戰**：沒有人使用「這個理論無法解釋」。可以直接問：有沒有哪一個情況照現在的說法會說不通？');
  if (!ii.hasBetter) L.push('- **缺少改進**：還沒有人把大家的說法合併成新版本。');
  L.push('');
  L.push('#### 躍升貼文草稿');
  L.push('> ［綜合我們的知識］把大家的想法放在一起，我們目前同意：');
  seq.filter(function(s){ return s.level >= 3; }).slice(0, 4).forEach(function(s){
    const seg = (s.note.segs || [])[0];
    L.push('> ・' + userName(s.note.authorIds[0]) + ' 指出：' + (seg ? shortStem(seg.text) : s.note.title));
  });
  L.push('> ');
  L.push('> 還沒解決的是：' + (opens.length ? shortStem(((opens[0].note.segs || []).find(function(g){ return g.s === 's2'; }) || {}).text || '') : '（請補上一個大家還想不通的地方）'));
  L.push('');
  L.push('#### 誰還沒進來');
  const inThread = uniq(seq.reduce(function(a, s){ return a.concat(s.note.authorIds); }, []));
  const missing = kbClass().studentIds.filter(function(sid){ return inThread.indexOf(sid) < 0; });
  L.push('- 尚未在這條串發言的有 ' + missing.length + ' 位：' + missing.slice(0, 10).map(userName).join('、') + (missing.length > 10 ? ' 等' : '') + '。');
  L.push('- 若其中有人在原始題目上落在「優勢概念」象限，優先邀請他們——他們手上有全班需要的想法。');
  return L.join('\n');
}

/* ==========================================================================
   7. 社群知識建構報告
   ========================================================================== */
async function aiCommunityReport(force){
  if (!force){ const c = cacheGet('community', kbClass().id); if (c) return c; }
  let out;
  const cs = communitySummary();
  const dt = dualTrack();
  if (aiEngine() === 'llm'){
    const mat = ['社群摘要：貼文 ' + cs.notes + '、延伸 ' + cs.buildOns + '、躍升 ' + cs.riseAbove +
      '、視圖 ' + cs.views + '、參與人數 ' + cs.contributors + '/' + cs.roster,
      '想法串被接手率 ' + pct(cs.threadUptake) + '；網絡密度 ' + fx(cs.density) + '；互惠率 ' + pct(cs.reciprocity),
      '論述層次平均 ' + fx(cs.epiMean) + '（分布 1–4 級：' + cs.epiDist.join('/') + '）；領域詞彙 ' + cs.vocab + ' 個',
      '雙軌分區人數：' + ['A','B','C','D'].map(function(z){
        return DUAL_ZONE[z].name + ' ' + dt.rows.filter(function(r){ return r.zone === z; }).length + ' 人';
      }).join('、')].join('\n');
    out = await llmChat([
      {role:'system', content: SYS_KB},
      {role:'user', content: mat + '\n\n請寫一份給老師看的社群知識建構報告：\n' +
        '1.【社群目前的樣子】\n2.【三個值得注意的訊號】\n3.【下一週可以做的三件事】\n4.【評量上的提醒】哪些指標不能單獨用來給分。'}
    ], {max_tokens:1200});
  } else {
    out = builtinCommunityReport(cs, dt);
  }
  cacheSet('community', kbClass().id, out);
  return out;
}

function builtinCommunityReport(cs, dt){
  const L = [];
  const zone = function(z){ return dt.rows.filter(function(r){ return r.zone === z; }); };
  L.push('#### 社群目前的樣子');
  L.push('- ' + cs.roster + ' 位學生中有 **' + cs.contributors + ' 位**貼過文，共 ' + cs.notes + ' 則（其中延伸貼文 ' +
    cs.buildOns + ' 則、躍升貼文 ' + cs.riseAbove + ' 則），分布在 ' + cs.views + ' 個視圖。');
  L.push('- 想法串被接手率 **' + pct(cs.threadUptake) + '**：意思是有這麼高比例的起始貼文得到了回應，其餘的沒有人接。');
  L.push('- 論述層次平均 **' + fx(cs.epiMean, 2) + ' 級**，四級分布為 ' + cs.epiDist.map(function(v, i){ return (i + 1) + '級 ' + v + ' 則'; }).join('、') + '。');
  L.push('- 建構網絡密度 ' + fx(cs.density, 3) + '，互惠率 ' + pct(cs.reciprocity) + '。');
  L.push('');
  L.push('#### 三個值得注意的訊號');
  const sig = [];
  if (cs.contributors / cs.roster < 0.7) sig.push('**參與集中**：有 ' + (cs.roster - cs.contributors) + ' 位同學一則都沒貼。建構網絡看起來熱鬧，但可能只是少數人的熱鬧。');
  if (cs.threadUptake < 0.7) sig.push('**想法被丟下**：約 ' + pct(1 - cs.threadUptake) + ' 的起始貼文沒有人回應。可以指定「每人至少延伸兩則別人的貼文」作為下一次的任務。');
  if (cs.riseAbove < cs.views) sig.push('**缺少收斂**：有些視圖還沒有躍升貼文，討論散開了但沒有收回來。可在每個視圖結束前安排一次躍升活動。');
  if (cs.epiDist[0] + cs.epiDist[1] > cs.epiDist[2] + cs.epiDist[3]) sig.push('**論述停在意見層次**：一半以上的貼文只到「提出理由」為止，還沒有進到反例與證據。');
  if (zone('B').length) sig.push('**論述未轉化**：' + zone('B').length + ' 位同學貼文很多但後測沒有跟上（' + zone('B').slice(0, 5).map(function(r){ return userName(r.sid); }).join('、') + '）。要檢查他們是不是只在附和。');
  if (zone('C').length) sig.push('**沉默的高手**：' + zone('C').length + ' 位同學能力進步但幾乎不發言（' + zone('C').slice(0, 5).map(function(r){ return userName(r.sid); }).join('、') + '）。他們是最好的知識資源人選。');
  (sig.length ? sig.slice(0, 4) : ['社群指標大致均衡，可以把重心放在提高論述層次。']).forEach(function(s){ L.push('- ' + s); });
  L.push('');
  L.push('#### 下一週可以做的三件事');
  L.push('1. 在每個視圖各指定一位學生做「躍升人」，負責把該視圖的討論收成一則綜合貼文，並在課堂上唸出來。');
  L.push('2. 對 ' + DUAL_ZONE.D.name + '（' + zone('D').length + ' 人）採用指派角色：先請他們只做「我需要理解」的提問，降低發言門檻。');
  L.push('3. 把本週躍升貼文中的共同結論轉成 2–3 道新題目施測（可用「派題診斷 → 由討論命題」），檢核共同理解是否真的可遷移。');
  L.push('');
  L.push('#### 評量上的提醒');
  L.push('- **貼文數不能單獨用來給分**。本系統的 KB 指數把貼文量的權重壓在 15%，其餘來自延伸、被延伸、閱讀、支架多樣性與論述層次。');
  L.push('- **論述層次是規則判定的**（連接詞、反例、證據、修正語），它會低估口語表達好但書寫少的學生，請務必與課堂觀察並用。');
  L.push('- **θ 的變化含測量誤差**。單一學生的前後測差值若小於其標準誤的兩倍，不應解讀為真的進步。');
  return L.join('\n');
}

/* ==========================================================================
   8. 由討論命題（共構後測）
   ========================================================================== */
async function aiItemsFromDiscourse(view, force){
  if (!force){ const c = cacheGet('fromview', view.id); if (c) return c; }
  const ns = notesOfView(view.id);
  let out;
  if (aiEngine() === 'llm'){
    const mat = ns.map(function(n){ return materialNote(n); }).join('\n---\n');
    const txt = await llmChat([
      {role:'system', content:'你是資深閱讀評量命題者，同時熟悉知識建構。請嚴格輸出 JSON，不要多任何說明。'},
      {role:'user', content:'以下是一個知識建構視圖中的討論：\n' + mat +
        '\n\n請根據這些討論中形成的共同理解，命 3 道可以檢核「這個理解是否真的可遷移」的選擇題。' +
        '誘答選項要對應討論中被推翻的說法。只回傳 JSON：{"items":[{"stem":"","options":["","","",""],"answer":0,"hint":"","targets":""}]}'}
    ], {temperature:0.7, max_tokens:1400});
    const m = txt.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('回傳的格式不正確，請再試一次。');
    out = JSON.parse(m[0]).items;
  } else {
    const src = view.origin && view.origin.iid ? getItem(view.origin.iid) : null;
    out = (src ? builtinSimilar(src) : []).map(function(x){
      return {stem:x.stem, options:x.options, answer:x.answer, hint:x.hint,
              targets: src ? '對應原題 ' + src.id + '：' + (src.tags || []).join('、') : ''};
    });
    if (!out.length) out = [{stem:'（這個視圖沒有連到原始題目，內建引擎無法命題。切換到外部語言模型即可依討論內容命題。）',
      options:['—','—','—','—'], answer:0, hint:'', targets:''}];
  }
  cacheSet('fromview', view.id, out);
  return out;
}

/* ==========================================================================
   極簡 Markdown 轉 HTML（只支援本系統會產生的語法）
   ========================================================================== */
function md(src){
  const lines = String(src || '').split('\n');
  const out = [];
  let inUl = false, inOl = false, inTable = false, inQuote = false;
  function closeAll(){
    if (inUl){ out.push('</ul>'); inUl = false; }
    if (inOl){ out.push('</ol>'); inOl = false; }
    if (inTable){ out.push('</tbody></table></div>'); inTable = false; }
    if (inQuote){ out.push('</blockquote>'); inQuote = false; }
  }
  function inline(s){
    return esc(s)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
  }
  for (let i = 0; i < lines.length; i++){
    const l = lines[i];
    const t = l.trim();
    if (!t){ closeAll(); continue; }
    if (/^#{1,6}\s/.test(t)){ closeAll();
      const lv = Math.max(3, Math.min(6, t.match(/^#+/)[0].length));
      out.push('<h' + lv + '>' + inline(t.replace(/^#+\s*/, '')) + '</h' + lv + '>'); continue; }
    if (/^---+$/.test(t)){ closeAll(); out.push('<hr class="hr">'); continue; }
    if (/^\|/.test(t)){
      const cells = t.split('|').slice(1, -1).map(function(c){ return c.trim(); });
      if (cells.length && cells.every(function(c){ return /^:?-{2,}:?$/.test(c); })) continue;
      if (!inTable){ closeAll(); out.push('<div class="tablewrap"><table><tbody>'); inTable = true;
        out.push('<tr>' + cells.map(function(c){ return '<th>' + inline(c) + '</th>'; }).join('') + '</tr>'); continue; }
      out.push('<tr>' + cells.map(function(c){ return '<td>' + inline(c) + '</td>'; }).join('') + '</tr>'); continue;
    }
    if (/^>\s?/.test(t)){ if (!inQuote){ closeAll(); out.push('<blockquote style="margin:0 0 10px;padding:8px 14px;border-left:3px solid var(--rule);color:var(--ink-2)">'); inQuote = true; }
      out.push(inline(t.replace(/^>\s?/, '')) + '<br>'); continue; }
    if (/^[-*]\s/.test(t)){ if (!inUl){ closeAll(); out.push('<ul>'); inUl = true; }
      out.push('<li>' + inline(t.replace(/^[-*]\s/, '')) + '</li>'); continue; }
    if (/^\d+\.\s/.test(t)){ if (!inOl){ closeAll(); out.push('<ol>'); inOl = true; }
      out.push('<li>' + inline(t.replace(/^\d+\.\s/, '')) + '</li>'); continue; }
    closeAll();
    out.push('<p>' + inline(t) + '</p>');
  }
  closeAll();
  return out.join('\n');
}
