/* ==========================================================================
   90-ui-misc.js — 題庫與單元歸類、系統設定、系統說明與研究設計
   ========================================================================== */

let BANKF = {process:'', type:'', unit:''};

function viewBank(){
  if (!isTeacher()) return studentBlocked();
  const list = ITEMS.filter(function(i){
    return (!BANKF.process || i.process === BANKF.process) &&
           (!BANKF.type || i.type === BANKF.type) &&
           (!BANKF.unit || i.unit === BANKF.unit);
  });
  const usedUnits = uniq(ITEMS.map(function(i){ return i.unit; }));
  return sectionHead('文本與題庫', '每一題都掛在一篇文本上，並標定它所測的 PIRLS 理解歷程與子歷程。' +
      '這個標定是相對歷程編碼（RQ4）的判定基準，架構、細目與題本三者必須同版。') +

    '<div class="grid g4" style="margin-bottom:16px">' +
      statCard('文本', TEXTS.length, TEXTS.map(function(t){ return t.genre; }).join(' · ')) +
      statCard('題目總數', ITEMS.length, '選擇題 ' + ITEMS.filter(function(i){ return i.type === 'mc'; }).length +
        ' · 建構反應題 ' + ITEMS.filter(function(i){ return i.type === 'cr'; }).length) +
      statCard('誘答已標記', ITEMS.filter(function(i){ return Object.keys(i.why || {}).some(function(k){ return i.why[k]; }); }).length,
        '誘答對應到理解失誤代碼') +
      statCard('理解失誤類型', READING_ERRORS.length, '離線診斷的基礎') +
    '</div>' +

    '<div class="card" style="margin-bottom:16px"><div class="card-h"><h3>四項理解歷程的題數分布</h3>' +
      '<span class="muted small">形狀記號與顏色並用，不以顏色單獨傳達訊息</span></div>' +
      '<div class="card-p"><div class="grid g4">' + PROCESSES.map(function(p){
        const n = ITEMS.filter(function(i){ return i.process === p.id; }).length;
        return '<div class="stat"><div class="k"><span aria-hidden="true">' + p.mark + '</span> ' + esc(p.name) + '</div>' +
          '<div class="v" style="color:var(--' + p.cls.replace('sc', 'sc-') + ')">' + n + '</div>' +
          '<div class="s">' + esc(p.desc) + '</div></div>';
      }).join('') + '</div></div></div>' +

    '<div class="kb-toolbar">' +
      '<label class="small muted" for="bkProc">理解歷程</label>' +
      '<select id="bkProc" data-act="bank-process" style="width:auto">' +
      '<option value="">全部</option>' + PROCESSES.map(function(p){
        return '<option value="' + p.id + '"' + (BANKF.process === p.id ? ' selected' : '') + '>' +
          p.mark + ' ' + esc(p.name) + '</option>'; }).join('') + '</select>' +
      '<label class="small muted" for="bkType">題型</label>' +
      '<select id="bkType" data-act="bank-type" style="width:auto">' +
      '<option value="">全部</option><option value="mc"' + (BANKF.type === 'mc' ? ' selected' : '') + '>選擇題</option>' +
      '<option value="cr"' + (BANKF.type === 'cr' ? ' selected' : '') + '>建構反應題</option></select>' +
      '<label class="small muted" for="bkText">文本</label>' +
      '<select id="bkText" data-act="bank-unit" style="width:auto">' +
      '<option value="">全部</option>' + usedUnits.map(function(u){
        return '<option value="' + u + '"' + (BANKF.unit === u ? ' selected' : '') + '>' + esc(unitName(u)) + '</option>'; }).join('') + '</select>' +
      '<div class="spacer"></div><span class="muted small">顯示 ' + list.length + ' 題</span>' +
    '</div>' +

    /* 文本全文 */
    '<div class="col" style="margin-bottom:16px">' + TEXTS.filter(function(t){
      return !BANKF.unit || BANKF.unit === t.id;
    }).map(function(t){
      return '<details class="card"><summary class="card-h" style="cursor:pointer">' +
        '<h3 style="flex:1">' + esc(t.title) + '</h3>' +
        '<span class="pill">' + esc(t.genre) + '</span>' +
        '<span class="pill">' + esc(t.grade) + '</span>' +
        '<span class="pill">' + ITEMS.filter(function(i){ return i.unit === t.id; }).length + ' 題</span></summary>' +
        '<div class="card-p"><div class="passage">' +
        t.paras.map(function(p){ return '<p class="para">' + esc(p) + '</p>'; }).join('') + '</div>' +
        '<p class="muted small">' + esc(t.source) + '</p></div></details>';
    }).join('') + '</div>' +

    '<div class="col">' + list.map(function(it){
      const sub = subprocess(it.sub);
      return '<div class="card"><div class="card-p">' +
        '<div class="row" style="justify-content:space-between;margin-bottom:6px">' +
        '<span class="row"><b>' + it.id + '</b>' + itemPills(it) +
        '<span class="pill">' + (it.type === 'cr' ? '建構反應題' : '選擇題') + '</span></span>' +
        '<span class="row"><label class="small muted">文本</label>' +
        '<select data-act="set-unit" data-id="' + it.id + '" style="width:auto">' + TEXTS.map(function(t){
          return '<option value="' + t.id + '"' + (t.id === it.unit ? ' selected' : '') + '>' +
            esc(t.title) + '</option>'; }).join('') + '</select></span></div>' +
        (sub ? '<div class="muted small" style="margin-bottom:6px">子歷程 <b>' + sub.id + '</b>　' +
          esc(sub.zh) + '　<span style="font-size:.85em">' + esc(sub.en) + '</span></div>' : '') +
        '<div class="stem">' + esc(it.stem) + '</div>' +
        (it.options.length ? '<div class="opts">' + it.options.map(function(o, k){
          const err = it.why && it.why[k] ? READING_ERRORS.find(function(m){ return m.id === it.why[k]; }) : null;
          const isAns = k === it.answer;
          return '<div class="opt' + (isAns ? ' right' : (err ? ' wrong' : '')) + '"><b>' +
            String.fromCharCode(65 + k) + '</b><span>' + esc(o) +
            (isAns ? '　<span class="muted small">✓ 正解</span>' : '') +
            (err ? '　<span class="muted small">誘答標記：' + esc(err.id) + ' ' + esc(err.name) + '</span>' : '') + '</span></div>';
        }).join('') + '</div>' : '') +
        (it.answerPara != null ? '<p class="muted small" style="margin-top:8px">依據位置：第 ' +
          (it.answerPara + 1) + ' 段第 ' + (it.answerSent + 1) + ' 句（供防洩答與教師檢視，學生看不到）</p>' : '') +
        '<p class="muted small">' + esc(it.note) + '</p>' +
        '</div></div>';
    }).join('') + '</div>' +

    '<div class="card" style="margin-top:16px"><div class="card-h"><h3>理解失誤代碼表</h3></div>' +
    '<div class="tablewrap"><table><thead><tr><th>代碼</th><th>名稱</th><th>描述</th><th class="n">相關題數</th></tr></thead><tbody>' +
    READING_ERRORS.map(function(m){
      const n = ITEMS.filter(function(i){ return Object.keys(i.why || {}).some(function(k){ return i.why[k] === m.id; }); }).length;
      return '<tr><td class="num">' + m.id + '</td><td>' + esc(m.name) + '</td><td class="small">' + esc(m.desc) +
        '</td><td class="n">' + n + '</td></tr>';
    }).join('') + '</tbody></table></div>' +
    '<div class="card-p"><p class="muted small">誘答選項掛上理解失誤代碼，是本系統能在<strong>不依賴語言模型</strong>的情況下' +
    '做出歷程層次診斷的關鍵。命題時多花的這一步，換來的是完全可重現的分析結果。</p></div></div>';
}

/* --- 系統設定 --- */
function viewSettings(){
  const s = state.settings;
  const providers = [
    ['openai', 'OpenAI', 'https://api.openai.com/v1', 'gpt-4o-mini'],
    ['deepseek', 'DeepSeek', 'https://api.deepseek.com/v1', 'deepseek-chat'],
    ['gemini', 'Google Gemini（OpenAI 相容端點）', 'https://generativelanguage.googleapis.com/v1beta/openai', 'gemini-2.0-flash'],
    ['custom', '自訂端點', s.baseUrl, s.model]
  ];
  return sectionHead('系統設定', '評量門檻、AI 引擎與研究資料匯出。') +
  '<div class="grid g2">' +
    '<div class="card"><div class="card-h"><h3>診斷門檻</h3></div><div class="card-p col">' +
      '<div class="field"><label for="thr">迷思橋接門檻（%）</label>' +
      '<input id="thr" type="number" min="1" max="60" value="' + s.misThreshold + '" data-act="set-thr">' +
      '<span class="muted small">一題的迷思(II)比例達到這個值，就會出現在「迷思橋接」清單裡。出廠預設 12%；門檻越低，被標出來一起討論的題目越多。</span></div>' +
      '<div class="field"><label for="minn">閱讀地圖最低樣本數</label>' +
      '<input id="minn" type="number" min="' + RASCH_MIN_N + '" max="200" value="' + s.minN + '" data-act="set-minn">' +
      '<span class="muted small">低於這個人數不執行 Rasch 估計。硬下限是 ' + RASCH_MIN_N +
      ' 人，只能往上調——14 題、3 個人的 JMLE 只是把三個人的總分重新排一次，' +
      '而成績頁掛的是「和所有做過的同學比起來的位置」。' +
      '一人一台平板時本機只有自己那一筆，要先用下面的「合併其他平板的資料」把四個班併起來。</span></div>' +
      /* 這個門檻原本硬編碼在 keyUnlocked() 裡、預設物件也沒有這個鍵，
         正式施測時連調都調不了。 */
      '<div class="field"><label for="kur">答案卡釋出門檻（作答比例）</label>' +
      '<input id="kur" type="number" min="0" max="1" step="0.05" value="' +
      (s.keyUnlockRatio != null ? s.keyUnlockRatio : 0.5) + '" data-act="set-kur">' +
      '<span class="muted small">學生至少要作答到這個比例，答案卡才可能打開（出廠預設 0.5）。' +
      '前後測共用同一份題本，先交卷的孩子把答案攤在螢幕上，旁邊還在寫的同學就看得到。</span></div>' +
      /* 「同班都交完就自動開」在單機／共用瀏覽器成立，但正式施測是
         一人一台平板、而這個平台沒有伺服器：每台裝置只看得到自己那一筆
         submission，那個條件永遠不會成立。所以要有一顆教師真的按得到的開關，
         否則畫面會一直承諾一個架構上達不到的條件。 */
      '<div class="field"><label>答案卡釋出</label>' +
      '<div class="col" style="gap:6px">' +
      state.assignments.map(function(a){
        const on = !!((s.keyReleased || {})[a.id]);
        return '<button type="button" class="btn sm' + (on ? ' primary' : '') +
          '" data-act="toggle-key" data-id="' + a.id + '" aria-pressed="' + on + '">' +
          '<span aria-hidden="true">' + (on ? '☑' : '☐') + '</span>' +
          esc(a.title) + '　' + (on ? '已開放' : '尚未開放') + '</button>';
      }).join('') + '</div>' +
      '<span class="muted small">按下去，這份派題的逐題答案就對已交卷的學生打開。' +
      '不按也會自動開的情形有兩種：同班每一位都交卷（單機或共用瀏覽器時才成立），' +
      '或是教師在派題精靈裡設過截止時間而且已經過期。' +
      '<strong>一人一台平板時請用這顆開關</strong>——每台裝置只看得到自己那一筆交卷紀錄，' +
      '「全班都交完」在那個情境下永遠不會成立。</span></div>' +
    '</div></div>' +
    /* 教師代碼。30-data.js 的註解原本說「研究者可以在系統設定頁改掉它」，
       而這一頁從來沒有這個欄位－－一句死註解配一個寫死的 '1234'。 */
    '<div class="card" style="margin-bottom:14px"><div class="card-h"><h3>教師代碼</h3>' +
      '<span class="muted small">施測中要把這台平板交給下一位同學時用</span></div>' +
      '<div class="card-p col">' +
      '<div class="row" style="justify-content:space-between;gap:10px">' +
      '<span class="num" style="font-size:1.4rem;letter-spacing:.18em">' +
        (s.teacherCode ? esc(s.teacherCode) : '（還沒有，清場時會產生）') + '</span>' +
      '<button class="btn sm" data-act="regen-code">換一組</button></div>' +
      '<p class="muted small" style="margin:0">老師在網址列打 <code>#/unlock</code> 並輸入這組碼，' +
      '就可以把裝置交給下一位同學。這條路徑故意不放在頂列：' +
      '剩十分鐘沒事做的孩子最先按的就是眼前的新按鈕。' +
      '連續輸錯會鎖住並加長等待，每一次嘗試（成功與否）都會寫進歷程日誌，' +
      '事後標記得出哪一台裝置被動過。</p>' +
    '</div></div>' +
    '<div class="card"><div class="card-h"><h3>AI 引擎</h3></div><div class="card-p col">' +
      '<div class="field"><label for="eng">目前使用</label><select id="eng" data-act="set-engine">' +
      '<option value="builtin"' + (s.engine === 'builtin' ? ' selected' : '') + '>內建規則引擎（離線、可重現）</option>' +
      '<option value="llm"' + (s.engine === 'llm' ? ' selected' : '') + '>外部語言模型（OpenAI Chat Completions 相容）</option>' +
      '</select></div>' +
      '<div class="field"><label for="prov">服務提供者</label><select id="prov" data-act="set-provider">' +
      providers.map(function(p){
        return '<option value="' + p[0] + '"' + (s.provider === p[0] ? ' selected' : '') + '>' + esc(p[1]) + '</option>';
      }).join('') + '</select></div>' +
      '<div class="field"><label for="burl">端點</label><input id="burl" type="text" value="' + esc(s.baseUrl) + '" data-act="set-baseurl"></div>' +
      '<div class="field"><label for="mdl">模型名稱</label><input id="mdl" type="text" value="' + esc(s.model) + '" data-act="set-model"></div>' +
      '<div class="field"><label for="key">API key</label><input id="key" type="password" value="' + esc(s.apiKey) +
      '" placeholder="sk-…" data-act="set-key">' +
      '<span class="muted small">只存在這台瀏覽器的 localStorage，不會上傳到任何地方。請使用有額度上限的專用金鑰。</span></div>' +
      '<div class="row"><button class="btn" data-act="test-llm">測試連線</button>' +
      '<span class="pill">' + (s.apiKey ? '已填入金鑰' : '尚未設定') + '</span></div>' +
      '<div id="out-testllm" class="muted small"></div>' +
      '<hr class="hr">' +
      '<p class="muted small"><strong>線上發布版的限制：</strong>以 Artifact 形式發布的頁面受安全政策限制，無法連線到外部網址，' +
      '外部語言模型只有在把本檔下載到電腦上開啟時才能使用。內建規則引擎在任何情況下都能運作，所有分析功能都不會少。</p>' +
    '</div></div>' +
  '</div>' +
  '<div class="card" style="margin-top:16px"><div class="card-h"><h3>研究資料</h3></div><div class="card-p">' +
    '<p class="small">匯出的 JSON 共 26 個頂層鍵，包含：使用者、班級、文本與題庫、作答矩陣、' +
    'Rasch 估計值與四象限判定、所有貼文與其支架／延伸／引用結構、論述指標與雙軌分區，' +
    '以及評量即學習的完整設計與歷程——四條件、PIRLS 四項理解歷程與 19 項子歷程、' +
    '<strong>8 個提示模組全文</strong>、事件日誌、對話逐字、問卷原始作答與構念分數、' +
    'LSA／ENA／情感軌跡的分析結果、效果檢定與分析資料表。' +
    '可直接讀進 R 或 Python 做後續分析。</p>' +
    '<div class="row" style="margin-top:10px">' +
    '<button class="btn primary" data-act="export-json">匯出研究資料（JSON）</button>' +
    '<button class="btn" data-act="export-csv">匯出作答矩陣（CSV）</button>' +
    '<button class="btn danger" data-act="reset">重設為示範資料</button></div>' +
    '<p class="muted small" style="margin-top:10px">重設會清除你在這台瀏覽器上新增的所有貼文與作答，回到出廠的模擬班級。</p>' +
  '</div></div>';
}

/* --- 系統說明與研究設計 --- */
/* 學生版的「系統說明」。
   研究設計書（四個條件、七個研究問題、量哪些構念）不能端到受試者面前——
   知道自己被分到哪一組、知道問卷在量什麼，會直接污染所有自陳依變項。
   但「完全相同的字」不等於對等：原本四個條件都被告知「你旁邊的夥伴」，
   對照組因此被承諾了一位他整節課都不會遇到的同伴。正確的對等是
   **結構相同、只描述自己這一班實際看得到的東西**——卡片數、標題層級、
   段落長度都一致，內容不提別班、不提沒有的東西、也不用否定句。 */
function aboutCondition(){
  const me = currentUser();
  return me && me.role === 'student' ? conditionOfStudent(me.id) : 'tutor';
}
function viewAboutStudent(){
  return sectionHead('這個網站是什麼', '三件你會想先知道的事。') +
  '<div class="col" style="max-width:70ch">' +
    '<div class="card card-p">' +
      '<h3>這個網站要你做什麼</h3>' +
      '<p class="lead" style="margin-top:8px">讀一篇文章，回答關於它的問題，' +
      '然後把你是怎麼讀出來的說出來。答錯沒關係，我們想看的是你怎麼想。</p>' +
    '</div>' +
    /* 這一段以前對四個條件都說「你旁邊的夥伴」——對照組整節課不會遇到任何
       夥伴，卻被告知他有一位。卡片結構（標題＋一段 lead）四個條件相同，
       只有內容依自己這一班實際會看到的東西寫。 */
    /* 三個 AI 組印自己那位夥伴的開場白（32-aal.js 的 frame，三句約略等長），
       不是 tutor 的台詞。課後問卷的操弄檢核問的正是「剛剛陪我讀的那位夥伴
       比較像…」，這一頁先寫給他們看等於在課前給了角色提示。 */
    (aboutCondition() === 'control'
      ? '<div class="card card-p">' +
          '<h3>你自己的筆記</h3>' +
          '<p class="lead about-frame" style="margin-top:8px">這節課你自己讀、自己想。' +
          '這一頁有一塊「我的筆記」，把你想到的、卡住的地方寫下來。</p>' +
        '</div>'
      : '<div class="card card-p">' +
          '<h3>你旁邊的夥伴</h3>' +
          '<p class="lead about-frame" style="margin-top:8px">' +
          esc(condition(aboutCondition()).frame) + '</p>' +
        '</div>') +
    '<div class="card card-p">' +
      '<h3>你寫的東西會怎麼被用</h3>' +
      '<p class="lead about-use" style="margin-top:8px">你在這裡寫的字、標記的句子' +
      (aboutCondition() === 'control' ? '' : '、跟夥伴說的話') + '，' +
      '老師之後看得到，這是為了知道你怎麼讀，不會拿來打分數。' +
      '研究整理的時候會把名字拿掉。你隨時可以跟老師說你不想繼續。</p>' +
    '</div>' +
  '</div>';
}

function viewAbout(){
  if (!isTeacher()) return viewAboutStudent();
  const P = [
    ['真實想法、真實問題', '前測的迷思題不是「錯題訂正」，而是全班真正卡住的問題，直接成為視圖的起點。'],
    ['可改進的想法', '貼文可以被延伸、挑戰、改寫；系統記錄每一次修改與論述層次的變化。'],
    ['想法多樣性', '支架刻意提供六種不同的說話方式，鼓勵不同角度的想法並存。'],
    ['躍升', '躍升貼文把分散的想法收攏成新的共同理解，並保留來源連結。'],
    ['認識論主體性', '學生自己決定要延伸誰、要挑戰什麼；AI 回饋只指出下一步，不給答案。'],
    ['社群知識與集體責任', '想法貼出去就屬於社群；被延伸次數與想法被接手率是社群層級的指標。'],
    ['知識民主化', '把在該題落在「優勢概念」的同學標為知識資源人——資源不必然來自成績最好的人。'],
    ['對稱知識進展', '每個人在某些題目是待解者，在另一些題目是資源人，角色會互換。'],
    ['普遍的知識建構', '討論不限於課堂，視圖之間可互相連結，跨單元的想法可以再被引用。'],
    ['權威來源的建設性使用', '「新的資訊」支架要求標明來源；引用功能保留被引用的原句與作者。'],
    ['知識建構的論述', '論述層次由連接詞、反例、證據、修正語判定，讓「討論的品質」可被觀察。'],
    ['同步、內嵌、轉化的評量', '整個系統就是這一條：評量產生問題，討論改變理解，再評量檢核遷移。']
  ];
  return sectionHead('系統說明與研究設計', 'KAIROS 如何把「閱讀理解診斷 × KIDMAP」、「Knowledge Forum」與「評量即學習」接成一個系統。') +

  '<div class="card card-p" style="margin-bottom:16px;border-left:3px solid var(--accent)">' +
    '<div class="eyebrow">評量即學習（Assessment as Learning）</div>' +
    '<h3 style="margin-top:6px">把 AI 夥伴放進作答的當下</h3>' +
    '<p class="lead" style="margin-top:8px">傳統評量把「測」與「教」分開：診斷在這裡發生，補救在別的時間、別的地方。' +
    'AaL 主張評量事件本身就是學習發生的場域——學生是連結評量與學習的主動行動者，' +
    '在作答當下運用並發展理解策略。過去這個理念受限於技術，' +
    '沒辦法在幾十名學生作答的同一時刻逐一提供差異化鷹架；生成式 AI 代理人首度讓它可規模化。</p>' +
    '<p class="lead">本系統把三種代理人角色放進同一個評量事件，並與無代理人的<strong>系統鷹架對照組</strong>比較。' +
    '三種角色各承一支教學傳統，理當產生可區辨的效果，但既有證據各自累積、互不相涉，' +
    '多角色的直接比較極為罕見——這正是本設計的缺口所在。</p>' +
    '<div class="grid g4" style="margin-top:14px">' + CONDITIONS.map(function(c){
      return '<div class="note-full" style="border-left:3px solid var(--' +
        (c.cls ? c.cls.replace('sc', 'sc-') : 'ink-4') + ')">' +
        '<b>' + esc(c.name) + '</b><div class="muted small">' + esc(c.en) + '</div>' +
        '<p class="small" style="margin-top:6px">' + esc(c.tradition) + '</p>' +
        '<p class="muted small">' + esc(c.mech) + '</p></div>';
    }).join('') + '</div>' +
    '<hr class="hr">' +
    '<h4>四項與測量效度直接相關的規格</h4>' +
    '<div class="col" style="margin-top:8px">' +
    [['回應型態由回合排程決定',
      'AI 不讀取任何學生端的編碼函式，也不指定學生下一步該用什麼策略。學生的歷程轉移因此反映他自己的選擇，不含對 AI 指令的遵從成分。'],
     ['嚴格的防洩答邊界',
      '禁止說出答案、禁止指名答案所在句次、禁止判斷對錯、禁止說出缺漏的得分要素；AI 不讀取作答欄位，以免回應構成隱性的正確性回饋。每一則回應送出前都會過一次篩檢，攔截次數本身即為忠實度指標。'],
     ['三條件的鷹架機會恆定',
      '三種角色共用同一組提問功能、同一份子歷程提問庫與同一個回合上限（每題 ' + MAX_TURNS +
      ' 次學生發話），只有社會框架隨角色而異，使資訊量與任務目標在條件之間保持一致。' +
      '回合上限由已落地的對話紀錄推導，重整或換裝置都不會重新發放；' +
      '學生端沒有第二條 AI 通道（相似題生成僅在教師端，不計入學生的鷹架劑量）。'],
     ['對照組的版面幾何相同',
      '對照組採用完全相同的文本面板、作答區與送出前自我檢核流程，僅將對話區替換為同尺寸的「我的筆記」書寫區，避免介面差異混入認知負荷這個依變項。']
    ].map(function(x, i){
      return '<div class="principle"><div class="no">' + (i + 1) + '</div><div><b>' + esc(x[0]) + '</b>' +
        '<span class="small muted">' + esc(x[1]) + '</span></div></div>';
    }).join('') + '</div>' +
  '</div>' +

  '<div class="card card-p" style="margin-bottom:16px">' +
    '<div class="eyebrow">整合的主張</div>' +
    '<p class="lead" style="margin-top:8px">兩個平台各自缺一半。<strong>派題與 KIDMAP</strong> 能精準指出「誰在哪個概念上卡住」，' +
    '但它的終點是一份給老師看的報告，學生仍然是被診斷的對象。<strong>Knowledge Forum</strong> 把知識的推進權交回學生手上，' +
    '但它沒有辦法告訴老師「今天最該討論的是哪一個問題」，起始問題往往靠教師的直覺。</p>' +
    '<p class="lead">KAIROS 讓前者成為後者的問題來源，讓後者成為前者的介入手段，' +
    '再用 AI 助評把兩邊的資料翻譯成教師與學生都能行動的語言。</p>' +
  '</div>' +
  '<div class="card card-p" style="margin-bottom:16px">' +
    '<h3>系統迴圈</h3>' +
    '<div class="col" style="margin-top:12px">' +
    [['①','派題','從文本出發挑閱讀理解題，含選擇題與建構反應題。'],
     ['②','作答','學生線上作答，非選題可手寫。'],
     ['③','KIDMAP 診斷','簡化 Rasch 估出 δ 與 θ，把每個「人 × 題」分成四象限。'],
     ['④','迷思橋接','第二象限（能力足以答對卻答錯）的題目一鍵開成知識建構視圖，附誘答分析與知識資源人名單。'],
     ['⑤','知識建構','學生用支架貼文、延伸、挑戰、躍升；想法屬於社群。'],
     ['⑥','AI 助評','對貼文給形成性回饋、對想法串給綜整建議、對社群給報告。'],
     ['⑦','由討論命題','把共同理解轉成新題目。'],
     ['⑧','共構後測','再測一次，比較 Δθ 與論述參與，回到 ①。']].map(function(x){
      return '<div class="principle"><div class="no">' + x[0] + '</div><div><b>' + esc(x[1]) + '</b>' +
        '<span class="small muted">' + esc(x[2]) + '</span></div></div>';
    }).join('') + '</div>' +
    '<p class="small" style="margin-top:14px;max-width:70ch">關鍵在 ④ 與 ⑧。④ 讓量化診斷有了教學上的出口，' +
    '⑧ 讓質性討論有了可檢核的證據。少掉任何一步，系統就退回原本的兩個平台。</p>' +
  '</div>' +
  '<div class="grid g2" style="margin-bottom:16px">' +
    '<div class="card"><div class="card-h"><h3>來自「派題 × KIDMAP 診斷」的功能</h3></div><div class="card-p">' +
    '<ul class="small" style="padding-left:18px;line-height:1.9">' +
    ['角色與班級（研究者／老師／學生、加入代碼）',
     '從文本出發的三步驟派題精靈（選文本 → 挑題目 → 派給學生）',
     '自編閱讀理解題庫、理解歷程／題型／文本三欄篩選',
     '簡化 Rasch 模式估計難度與能力（含 SE、Infit／Outfit）',
     'KIDMAP 四象限：優勢／迷思／合理答錯／合理答對',
     '每題四象限表與誘答分析（誘答掛理解失誤代碼 E1–E8）',
     '建構反應題作答與逐生評閱',
     'AI 評量規準、教學策略、同歷程替代題'].map(function(x){ return '<li>' + esc(x) + '</li>'; }).join('') +
    '</ul></div></div>' +
    '<div class="card"><div class="card-h"><h3>來自 Knowledge Forum 的功能</h3></div><div class="card-p">' +
    '<ul class="small" style="padding-left:18px;line-height:1.9">' +
    ['視圖（共同白板）與視圖之間的連結',
     '貼文與六種理論建構支架',
     '延伸貼文（build-on）與想法串',
     '躍升貼文（rise-above）收攏多則貼文',
     '引用其他貼文並保留原句',
     '註記（annotation）與共同作者',
     '閱讀狀態與未讀提示',
     '依標題／支架／內容／作者／關鍵詞／日期搜尋',
     '分析工具：貢獻、延伸網絡、支架使用、詞彙成長'].map(function(x){ return '<li>' + esc(x) + '</li>'; }).join('') +
    '</ul></div></div>' +
  '</div>' +
  '<div class="card card-p" style="margin-bottom:16px">' +
    '<h3>研究問題與對應的資料／方法</h3>' +
    '<div class="tablewrap" style="margin-top:10px"><table><thead><tr>' +
    '<th>研究問題</th><th>資料來源</th><th>分析方法</th><th>系統中的位置</th></tr></thead><tbody>' +
    [['RQ1 四條件在理解表現上有何差異？', '題本作答得分', '共變數分析（前測為共變數）', '研究控制台 → 效果檢定'],
     ['RQ2 四條件在五項動機性變項上有何差異？', '五構念前後測問卷', '共變數分析、partial η²', '研究控制台 → 效果檢定'],
     ['RQ3 角色效果是否經由動機性變項中介？', '問卷 ＋ 題本得分', '平行多重中介路徑分析、bootstrap CI', '研究控制台 → 效果檢定'],
     ['RQ4 歷程運用層次呈現何種序列型態？', '系統日誌（含相對歷程編碼）', '延宕序列分析（調整殘差）', '研究控制台 → 序列分析'],
     ['RQ5 人—AI 認知互動網絡結構為何？', '人—AI 對話語料', '認知網絡分析（共現 → SVD）', '研究控制台 → 認知網絡'],
     ['RQ6 情緒型態如何隨事件進展變化？', '對話語料 ＋ 筆記', '情感分析（詞典法）', '研究控制台 → 情感軌跡'],
     ['RQ7 效果對誰成立？', '前測能力 ＋ 前測動機', '調節分析（能力／動機分組）', '雙軌評量儀表板 ＋ 匯出後續分析']
    ].map(function(r){
      return '<tr><td class="small"><b>' + esc(r[0]) + '</b></td><td class="small">' + esc(r[1]) + '</td>' +
        '<td class="small muted">' + esc(r[2]) + '</td><td class="small muted">' + esc(r[3]) + '</td></tr>';
    }).join('') + '</tbody></table></div>' +
    '<p class="muted small" style="margin-top:10px">研究構想原案為國小閱讀（PIRLS 四項理解歷程 × 19 子歷程、中英雙語軸）。' +
    '本平台<strong>採用同一個領域與同一套架構</strong>：PIRLS 2011 四項理解歷程' +
    '（直接提取 5、直接推論 5、詮釋整合 5、比較評估 4，共 19 項子歷程），' +
    '示範題本為 2 篇自編文本、16 題。中英雙語軸尚未實作，' +
    '<code>34-log.js</code> 的事件結構保留 <code>lang</code> 欄位備用。' +
    '若要換到其他 IEA 架構（例如 TIMSS 數學認知領域），只需替換 <code>PROCESSES</code>、' +
    '<code>SUBPROCESSES</code> 與題目的歷程標定，分析程式不必更動。</p>' +
  '</div>' +

  '<div class="card card-p" style="margin-bottom:16px">' +
    '<h3>只有整合後才有的功能</h3>' +
    '<div class="grid g2" style="margin-top:12px">' +
    [['迷思橋接', '把 KIDMAP 第二象限的題目一鍵轉成共構視圖，並自動生成探究問題與知識資源人名單。'],
     ['知識資源人', '第一象限（超越預期答對）的學生被指名先貼想法，而不是由老師公布答案。'],
     ['論述層次評定', '以連接詞、反例、證據語、修正語、支架使用與引用關係判定貼文的認識論層次（1–4 級）。'],
     ['雙軌評量', 'Δθ（能力變化）× KB 指數（論述參與）的四分區，區分「論述未轉化」與「沉默的高手」。'],
     ['由討論命題', '把躍升貼文中的共同理解轉成後測題，檢核共同理解是否可遷移。'],
     ['雙引擎助評', '同一份材料同時給規則引擎與語言模型，便於做人—規則—模型的三方比對。'],
     ['相對歷程編碼', '以試題官方標定的歷程為基準，把每一次學生發話編碼為低於／等於／高於，直接量到「學生自己把問題往上推」的行為。'],
     ['離線也能跑的三角色對話', '因為提問功能與子歷程提問庫跨角色共用、只有社會框架不同，規則引擎就能忠實產生三條件的對話，不必依賴語言模型。'],
     ['防洩答攔截計數', '每一則夥伴發話送出前篩檢答案洩漏，攔截次數本身成為可報告的實施忠實度指標。']].map(function(x){
      return '<div class="note-full"><b>' + esc(x[0]) + '</b><p class="small muted" style="margin-top:4px">' + esc(x[1]) + '</p></div>';
    }).join('') + '</div>' +
  '</div>' +
  '<div class="card card-p" style="margin-bottom:16px">' +
    '<h3>知識建構十二項原則在系統中的落點</h3>' +
    '<div style="margin-top:10px">' + P.map(function(p, i){
      return '<div class="principle"><div class="no">' + (i + 1) + '</div><div><b>' + esc(p[0]) + '</b>' +
        '<span class="small muted">' + esc(p[1]) + '</span></div></div>';
    }).join('') + '</div>' +
  '</div>' +
  '<div class="card card-p" style="margin-bottom:16px">' +
    '<h3>指標定義</h3>' +
    '<div class="tablewrap" style="margin-top:10px"><table><tbody>' +
    [['θ（能力估計值）', '簡化 Rasch 模式的 JMLE 估計，單位為 logit，題目難度平均中心化為 0。極端分數以 ±0.3 分校正。'],
     ['δ（試題難度）', '同上，與 θ 在同一量尺上，因此可以直接比較。'],
     ['四象限', 'θ > δ 為「預期答對」。預期答對卻答錯＝迷思(II)；預期答錯卻答對＝優勢(I)；其餘為合理答對(IV)／合理答錯(III)。'],
     ['Infit / Outfit MNSQ', '適配度統計量。明顯大於 1.3 表示作答型態異常，常來自迷思或猜測。'],
     ['論述層次（1–4）', '1 陳述主張／2 提出理由／3 援引證據或反例／4 綜整並改進理論。由規則判定，可重現。'],
     ['KB 指數', '貼文量 15%＋延伸他人 20%＋被延伸 15%＋閱讀廣度 10%＋支架多樣性 10%＋論述層次 20%＋領域詞彙 10%，以班級最大值正規化。'],
     ['相對歷程編碼', '把學生發話的認知層次（知道／應用／推理）與該題官方標定的歷程比較，編為 BELOW／AT／ABOVE。'],
     ['調整殘差（LSA）', 'z = (F − E) / √(E(1−Ri/N)(1−Cj/N))。|z| ≥ 1.96 視為顯著；正值代表促進性轉移。'],
     ['ENA 投影', '共現向量經球面正規化後，取共變異數矩陣的前兩個主軸投影。SVD1／SVD2 為各軸解釋的變異比例。'],
     ['情緒分數', '詞典法：正負向詞計數，程度副詞加權 1.5、否定前綴反號，除以 3 後截斷於 ±1。'],
     ['partial η²', 'SS效果 /(SS效果 + SS誤差)。參考值：.01 小、.06 中、.14 大。'],
     ['想法被接手率', '有人延伸的起始貼文 ÷ 全部起始貼文。反映社群是否真的在接住彼此的想法。'],
     ['網絡密度／互惠率', '延伸關係的有向圖密度，以及雙向延伸佔全部連結的比例。'],
     ['Δθ', '後測 θ − 前測 θ。若小於 θ 標準誤的兩倍，不應解讀為真的進步。']].map(function(r){
      return '<tr><td style="width:170px"><b>' + esc(r[0]) + '</b></td><td class="small">' + esc(r[1]) + '</td></tr>';
    }).join('') + '</tbody></table></div>' +
  '</div>' +
  '<div class="card card-p" style="margin-bottom:16px">' +
    '<h3>使用與研究上的限制</h3>' +
    '<ul class="small" style="padding-left:18px;line-height:1.95;max-width:74ch">' +
    ['本頁的班級、學生、作答與貼文<strong>全部是模擬資料</strong>，由固定亂數種子產生，每次載入結果一致，僅供展示與方法討論，不得當成實徵結果引用。',
     '文本與題目是仿 PIRLS 題型的自編示範素材，不是官方釋出文本或原題。',
     '論述層次是規則判定，會低估口語表達好但書寫少的學生；也會被刻意堆砌連接詞的貼文抬高。任何用於成績的用途都必須有人工複核。',
     '簡化 Rasch 模式假設題目等鑑別度、單一向度，且未處理題組的局部相依。樣本小時估計不穩。',
     'KB 指數的權重是本系統的設定值，不是既有文獻的標準，請在研究中明確說明並做敏感度分析。',
     '<strong>問卷題項是依構念自撰的示範題，不是已驗證量表的中譯本</strong>。正式施測請改用已完成信效度驗證的公開量表，並經專家審查與學童認知訪談。',
     '<strong>條件在班級層次操弄</strong>，本平台的 ANCOVA 以學生為分析單位，未處理班級內相依。嚴謹分析應採多層次模型，並報告 ICC 與設計效應。',
     '效果檢定的 p 值採 Wilson–Hilferty 近似；中介估計的是<strong>觀察變項</strong>路徑模型，不是含潛在變項的結構方程模型。兩者都請以統計軟體覆核。',
     'ENA 的節點採固定圓形佈局，不是 rENA 的共註冊佈局；相對歷程編碼與情感分析都是規則判定，正式研究需要人工標註的信度檢核。',
     '資料存放在瀏覽器的 localStorage，換裝置或清除資料就會消失。真實課堂使用需要接後端與帳號系統。',
     '以國中／國小學生為對象的生成式 AI 互動涉及知情同意、資料最小化與人為監督；實際施測前需完成倫理審查，並明確告知哪些指標會、哪些不會用於成績。'].map(function(x){
      return '<li>' + x + '</li>'; }).join('') +
    '</ul></div>' +
  '<div class="card card-p">' +
    '<h3>概念來源</h3>' +
    '<ul class="small" style="padding-left:18px;line-height:1.95">' +
    '<li>Earl, L. (2003, 2012) — 評量即學習（assessment as learning）與 AoL／AfL／AaL 光譜。</li>' +
    '<li>Chase, C. C. et al. (2009) — 門生效應（protégé effect）；Biswas, G. et al. (2005) — 可教代理人。</li>' +
    '<li>Vygotsky, L. S. (1978) — 社會建構論，同儕角色的理論依據。</li>' +
    '<li>Bakeman, R., &amp; Gottman, J. M. (1997) — 延宕序列分析與調整殘差。</li>' +
    '<li>Shaffer, D. W. (2017) — 認知網絡分析（Epistemic Network Analysis）。</li>' +
    '<li>Mullis, I. V. S., &amp; Martin, M. O. — PIRLS 2011 閱讀理解歷程架構（本平台的歷程架構）。</li>' +
    '<li>Scardamalia, M., &amp; Bereiter, C. — 知識建構理論與 Knowledge Forum；十二項知識建構原則。</li>' +
    '<li>Wright, B. D., &amp; Stone, M. H. (1979). <em>Best Test Design</em> — Rasch 模式與 JMLE 估計。</li>' +
    '<li>Earl, L.、Leppink, J. et al.、Fredricks, J. A. et al.、Pintrich, P. R. et al. — 問卷構念的來源量表。</li>' +
    '<li>KIDMAP 四象限診斷表徵——測驗成績診斷的常見呈現方式。</li>' +
    '<li>介面詞彙參考自前身平台「會考派題 · 國中數學」與 knowledgeforum.org 的 KF6 介面；' +
    '本版領域已改為國小閱讀理解，部分用語（「單元」「迷思」）是那個階段留下的。</li>' +
    '</ul>' +
    '<p class="muted small" style="margin-top:10px">KAIROS 是研究用的整合原型，與上述任何平台或機構均無隸屬關係。</p>' +
  '</div>';
}

/* ==========================================================================
   #/unlock — 施測狀態下把裝置交給下一位同學
   上一輪把這個出口做成頂列上一顆對每個學生都可見的〈換人〉，代碼還寫死
   '1234'——那是把出口做成了入口（見 80-ui-core.js 的說明）。
   現在它是一條要自己打網址才到得了的路由：老師知道就好，而剩十分鐘沒事做
   的孩子不會憑空打出 #/unlock。代碼在清場時產生、可在設定頁看與換，
   連續輸錯會鎖住並加長等待，每一次嘗試都寫進 state.logs（type:'UNLOCK'）。
   ========================================================================== */
function viewUnlock(){
  const live = state.demoSeed === false;
  const s = state.settings || {};
  const unlocked = !!(state.ui && state.ui.deviceUnlock);
  if (!live){
    return '<div class="empty"><h3>這台平板還在示範模式</h3>' +
      '<p style="max-width:60ch">示範模式本來就可以直接用右上角的選單換人，不需要代碼。</p>' +
      '<a class="btn primary" href="#/student">回我的作業</a></div>';
  }
  if (unlocked){
    return '<div class="empty"><h3>已經解鎖了</h3>' +
      '<p style="max-width:60ch">用右上角的選單換成下一位同學就可以。換完之後會自動鎖回去。</p>' +
      '<div class="row" style="justify-content:center;margin-top:12px">' +
      '<button class="btn" data-act="device-relock">現在就鎖回去</button>' +
      '<a class="btn primary" href="#/student">回我的作業</a></div></div>';
  }
  const now = Date.now();
  const locked = s.unlockLockedUntil && now < s.unlockLockedUntil;
  return sectionHead('換一位同學使用這台平板', '這是老師的動作',
      '<a class="btn" href="#/student">← 回我的作業</a>') +
    '<div class="card" style="max-width:34rem"><div class="card-p col">' +
    '<p class="small" style="margin:0">請老師輸入這台平板的教師代碼。' +
    '解鎖之前，系統會先把目前這位同學寫到一半的作答、筆跡與問卷全部存起來。</p>' +
    (locked
      ? '<p class="small" role="alert" style="color:var(--crit);font-weight:600">' +
        '輸錯太多次了，請等 ' + Math.ceil((s.unlockLockedUntil - now) / 1000) + ' 秒再試。</p>'
      : '') +
    '<div class="field"><label for="unlockCode">教師代碼</label>' +
    '<input type="password" id="unlockCode" inputmode="numeric" autocomplete="off"' +
    (locked ? ' disabled' : '') + '></div>' +
    '<div class="row"><button class="btn primary" data-act="device-unlock"' +
    (locked ? ' disabled' : '') + '>解鎖</button>' +
    '<a class="btn" href="#/student">取消</a></div>' +
    '<p class="muted small" style="margin:0">代碼在《清空示範資料，準備施測》時產生，' +
    '可以在研究控制台的系統設定頁看到或換掉。每一次嘗試都會記錄下來。</p>' +
    '</div></div>';
}
