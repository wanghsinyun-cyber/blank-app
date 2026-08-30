/* ==========================================================================
   32-aal.js — 評量即學習（Assessment as Learning）核心
   ‧ 四條件：無對象（對照）／導師 TUTOR／學生 TUTEE／同儕 PEER
   ‧ 理解歷程架構：PIRLS 2011 四項理解歷程 × 19 項子歷程
   ‧ 模組化提示：1 系統骨幹 + 3 角色（僅社會框架）+ 4 歷程（提問功能）
   ‧ 回合排程、回合上限、防洩答攔截、相對歷程編碼

   設計原則：提問功能跨角色恆定，僅社會框架隨角色而異；
   AI 的回應型態由回合排程決定，不讀取任何學生端編碼函式，
   也不指定學生下一步應採用何種策略（避免 prompt compliance 混入歷程轉移）。
   ========================================================================== */

/* --- 四條件 --- */
const CONDITIONS = [
  {id:'tutor',   name:'老師小葵', en:'AI-as-Tutor',  cls:'sc1', mark:'▲',
   tradition:'智慧型教學系統／蘇格拉底式鷹架',
   /* 三句 frame 的字數要對齊（見開場池的對等規格）。實測 36/29/26——
      tutor 條件的孩子每一題比 peer 多讀約三分之一的字，16 題累積成穩定的組間差異。
      而多出來的那一段還是一則明示的閱讀策略指示（「你是從哪裡看出來的」），
      只有一個條件拿得到：EVID 的組間差異會有一部分是被這句話教出來的。
      三句一律兩句話、27–28 字、只描述社會關係，不指名任何閱讀策略。 */
   /* 原本是「……我會一直問你問題。」——但夥伴永遠不會先開口（agentTurn 在
      學生路徑上的唯一呼叫端是 aalSay），承諾的問題要等孩子先打完字才會出現。
      三句裡只有這一句沒把發言權交給孩子：tutee 是「你可以講給我聽嗎？」、
      peer 是「我們各自說說」，都明確要求孩子先講。照字面等待的孩子，
      這一題（很可能整節課）的學生發話回合就是 0——而回合數就是三個 AI
      條件的處遇劑量，RQ1 量到的差異會有一部分來自開場文案，不是社會框架。
      改文案不改劑量，維持兩句、28 字、只描述社會關係、不指名閱讀策略。 */
   frame:'我是陪你讀的老師。我不會告訴你答案，先聽你怎麼讀這一篇。',
   mech:'適性鷹架與形成性提問',
   note:'指導性鷹架可能壓縮學習者自主性，故本平台限制其僅能提問、不得評價。'},
  {id:'tutee',   name:'同學小葉', en:'AI-as-Tutee',  cls:'sc3', mark:'●',
   tradition:'可教代理人／以教代學（門生效應）',
   frame:'我是剛讀完這篇的同學，很多地方沒看懂。你可以講給我聽嗎？',
   mech:'學習者翻轉為施教者，須為代理人的理解負責',
   note:'評量事件中最徹底的「主動行動者」姿態。'},
  {id:'peer',    name:'同學小森', en:'AI-as-Peer',   cls:'sc5', mark:'■',
   tradition:'社會建構論／對等協作',
   /* 原本是「我先說我讀到哪裡，你再說你的」——但夥伴永遠不會主動開口
      （agentTurn 的唯一呼叫端是 aalSay），孩子先講完之後，turn 0 抽到的
      開場是「我也在讀這一題，我先講我怎麼讀的。」，接著 ROLE_STEM.peer
      的「那你呢？」立刻把球丟回去，自己的讀法一個字都沒有。
      宣告了「我先講」卻什麼都沒講，對等關係的操弄在第一輪就自我否定。
      改文案而不是改劑量：不承諾先後。 */
   /* 結尾原本是「再對一下」。同一支檔案的 PROMPT_ROLE.peer 剛剛才為了
      同一個詞被改掉——「對一下」在台灣國小教室的固定搭配是「對答案」，
      tutor 與 tutee 的 frame 都明確宣告自己沒有答案，只有它宣告了一個
      可供比對的參照物。提示詞那一側修了，孩子真正讀到的那一句沒有。
      而 frame 是對話卡的第一則訊息，也印在首頁的條件卡上，每換一題重印。
      維持兩句、字數不變。 */
   frame:'我也在讀這一篇。我們各自說說自己是怎麼讀的，我想聽你的。',
   mech:'分享觀點、共構理解',
   note:'處理負擔分散於人機之間。'},
  {id:'control', name:'無對象', en:'System-scaffold control', cls:'', mark:'◇',
   tradition:'系統鷹架對照組',
   frame:'',
   mech:'相同工具與流程，不配置 AI 夥伴',
   note:'版面幾何完全相同，僅將對話區替換為同尺寸的「我的筆記」書寫區，' +
        '使四條件的外在認知負荷、捲動深度與畫面留白一致。'}
];
function condition(id){ return CONDITIONS.find(function(c){ return c.id === id; }) || CONDITIONS[3]; }

/* --- PIRLS 2011 四項理解歷程 ---
   架構、細目與題本三者同版，RQ4 的相對歷程編碼才能以官方標定為判定基準。
   中文譯名採臺灣通行用語。 */
const PROCESSES = [
  {id:'FR', name:'直接提取', en:'Focus on and Retrieve Explicitly Stated Information',
   cls:'sc1', order:1, mark:'▲',
   desc:'在文本中找出明確寫出來的訊息，不需要推論。'},
  {id:'SI', name:'直接推論', en:'Make Straightforward Inferences',
   cls:'sc3', order:2, mark:'●',
   desc:'把文本中相鄰的訊息連起來，做出作者沒有明說但顯而易見的推論。'},
  {id:'II', name:'詮釋整合', en:'Interpret and Integrate Ideas and Information',
   cls:'sc5', order:3, mark:'■',
   desc:'整合全文訊息並帶入自己的知識與經驗，形成對主題、語氣或應用的詮釋。'},
  {id:'EE', name:'比較評估', en:'Examine and Evaluate Content, Language, and Textual Elements',
   cls:'sc4', order:4, mark:'◆',
   desc:'跳出文本，評斷內容的合理性、訊息的完整性與作者的立場與手法。'}
];
function processOf(id){ return PROCESSES.find(function(p){ return p.id === id; }); }
function processName(id){ const p = processOf(id); return p ? p.name : id; }
function processOrder(id){ const p = processOf(id); return p ? p.order : 0; }
function processMark(id){ const p = processOf(id); return p ? p.mark : '·'; }

/* --- 19 項子歷程與角色中性的代表性提問句（PIRLS 2011）---
   fit：適用文體，提問庫據此分流，避免對文學性文本提出資訊性文本專用的提問。 */
const SUBPROCESSES = [
  {id:'FR-1', p:'FR', en:'identifying information relevant to the specific goal of reading',
   zh:'找出與閱讀目標有關的訊息',
   q:'這一題要找的是什麼？文章裡哪一段在講這件事？', fit:'皆可'},
  {id:'FR-2', p:'FR', en:'looking for specific ideas',
   zh:'尋找特定的想法／觀點',
   q:'文章裡有沒有直接說到這件事？在哪裡？', fit:'皆可'},
  {id:'FR-3', p:'FR', en:'searching for definitions of words or phrases',
   zh:'尋找字詞或片語的定義',
   q:'這個詞在這篇文章裡是什麼意思？哪一句告訴你的？', fit:'皆可'},
  {id:'FR-4', p:'FR', en:'identifying the setting of a story (e.g., time, place)',
   zh:'指出故事的場景（時間、地點）',
   q:'這件事發生在什麼時候、什麼地方？你從哪一句看出來的？', fit:'敘事'},
  {id:'FR-5', p:'FR', en:'finding the topic sentence or main idea (when explicitly stated)',
   zh:'找出主題句或主要觀點（限明確陳述者）',
   q:'這一段最重要的一句話是哪一句？', fit:'皆可'},

  {id:'SI-1', p:'SI', en:'inferring that one event caused another event',
   zh:'推論某事件導致另一事件（因果）',
   q:'為什麼會發生這件事？是前面哪一件事造成的？', fit:'皆可'},
  {id:'SI-2', p:'SI', en:'concluding what is the main point made by a series of arguments',
   zh:'在一串論點之後歸納出重點',
   q:'作者講了好幾個理由，合起來他想說的重點是什麼？', fit:'說明'},
  {id:'SI-3', p:'SI', en:'determining the referent of a pronoun',
   zh:'判斷代名詞的指涉對象',
   q:'這裡的「他／它」指的是誰或什麼？', fit:'皆可'},
  {id:'SI-4', p:'SI', en:'identifying generalizations made in the text',
   zh:'找出文中所做的概括陳述',
   q:'文章裡有沒有哪一句是在說「通常都會這樣」？是哪一句？', fit:'說明'},
  {id:'SI-5', p:'SI', en:'describing the relationship between two characters',
   zh:'描述兩個人物之間的關係',
   q:'這兩個人是什麼關係？你從哪些地方看出來的？', fit:'敘事'},

  {id:'II-1', p:'II', en:'discerning the overall message or theme of a text',
   zh:'辨識全文的訊息或主題',
   q:'如果用一句話說這篇文章想告訴我們什麼，你會怎麼說？', fit:'皆可'},
  {id:'II-2', p:'II', en:'considering an alternative to actions of characters',
   zh:'思考人物行動的其他可能作法',
   q:'如果是你，你會怎麼做？為什麼跟他不一樣？', fit:'敘事'},
  {id:'II-3', p:'II', en:'comparing and contrasting text information',
   zh:'比較與對照文中訊息',
   q:'前面講的和後面講的有什麼不一樣？', fit:'皆可'},
  {id:'II-4', p:'II', en:"inferring a story's mood or tone",
   zh:'推測故事的情緒或語氣',
   q:'這一段讀起來是什麼感覺？哪些字讓你有這種感覺？', fit:'敘事'},
  {id:'II-5', p:'II', en:'interpreting a real-world application of text information',
   zh:'詮釋文中訊息在真實世界的應用',
   q:'這件事在你的生活裡也會發生嗎？什麼時候？', fit:'皆可'},

  {id:'EE-1', p:'EE', en:'evaluating the likelihood that the events described could really happen',
   zh:'評估所述事件真實發生的可能性',
   q:'這件事真的可能發生嗎？為什麼？', fit:'皆可'},
  {id:'EE-2', p:'EE', en:'describing how the author devised a surprise ending',
   zh:'說明作者如何安排出乎意料的結局',
   q:'結局讓你意外嗎？作者在前面留了什麼線索？', fit:'敘事'},
  {id:'EE-3', p:'EE', en:'judging the completeness or clarity of information in the text',
   zh:'評斷文中訊息的完整性或清晰度',
   q:'文章有沒有哪裡沒說清楚？你還想知道什麼？', fit:'皆可'},
  {id:'EE-4', p:'EE', en:"determining an author's perspective on the central topic",
   zh:'判斷作者對核心主題的立場',
   q:'你覺得作者贊成還是反對？哪一句讓你這樣想？', fit:'皆可'}
];
function subprocess(id){ return SUBPROCESSES.find(function(s){ return s.id === id; }); }
function subprocessesOf(p){ return SUBPROCESSES.filter(function(s){ return s.p === p; }); }

/* 逐題的官方歷程標定由題庫自己攜帶（item.process），此處只提供補綴用的預設 */
function applyItemProcesses(){
  ITEMS.forEach(function(it){ if (!it.process) it.process = 'FR'; });
}

/* --- 提問功能（question functions）：跨角色恆定 --- */
const QFUNCTIONS = [
  {id:'F1', name:'目標澄清', desc:'請學習者說出這一題到底在問什麼。'},
  {id:'F2', name:'依據索引', desc:'請學習者指出他的判斷用到文章裡的哪一句。'},
  {id:'F3', name:'歷程提問', desc:'依該題官方標定歷程的子歷程提問庫提出一問。'},
  {id:'F4', name:'反向檢核', desc:'請學習者說明「有沒有別的讀法也說得通」。'},
  {id:'F5', name:'延伸歷程', desc:'再取同一歷程的另一個子歷程提問，或往上一層歷程提問。'},
  {id:'F6', name:'收束整理', desc:'請學習者用一句話說出自己現在的想法。'}
];

/* 回合排程：第 n 次學生發話後，AI 使用第 n 個提問功能。
   同一排程套用於三種角色，因此鷹架機會、資訊量與任務目標於三條件間恆定。 */
const TURN_SCHEDULE = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6'];
const MAX_TURNS = 6;

/* --- 系統骨幹提示模組（模組 0）：任務規則與防洩答機制 --- */
const PROMPT_BACKBONE =
'【任務規則】你是一個嵌在「評量即學習」平台中的對話夥伴，陪國小四到六年級學生一起讀一篇文章。\n' +
'【嚴格禁止】(1) 說出或暗示答案；(2) 指名答案在哪一個選項、第幾段或第幾句；(3) 判斷學生答對或答錯；\n' +
'(4) 說出學生缺漏了哪一個得分要素；(5) 直接把文章重點整理給他。\n' +
/* 「文章本身」原本不在這份清單裡，而清單是列舉式的——只列作答欄位與選項，
   反而暗示文章看得到。送出去的提示詞從頭到尾只有題幹與學生剛剛講的話，
   模型讀不到全文，於是孩子打「我覺得他後來很後悔」，三個角色都會很自然地
   接一句「對啊，他一直想著那天的事」——一句憑空生成的文本內容，
   而 leakGuard 攔的是判定語、選項字串、位置與指路語，攔不到它，
   blocked 恆為 false，忠實度報表也看不見。II／EE 那幾題（主旨、語氣、
   作者立場）孩子拿到的就是一句聽起來像出自原文、實際上是編的敘述。
   把它寫進禁止清單，根因才收得掉——只刪掉 peer 那一句觸發器不夠，
   排定的捏造沒了，被引出的捏造還在。 */
'【你看不到的東西】你不會讀到學生的作答欄位，也不會知道他選了哪一個選項。\n' +
'**你也讀不到那篇文章的全文**——你只拿得到題目本身。所以絕對不要描述、複述或' +
'猜測文章裡寫了什麼（人物做了什麼、情節如何、作者的意思是什麼）。' +
'你只能問他，不能告訴他文章在說什麼。\n' +
'【每次回應】只做一件事：依系統指定的提問功能問一個問題。最多兩句話，' +
'第一句回應學生剛剛說的內容，第二句提問。用國小中高年級聽得懂的口語，不要說教。\n' +
'【回合上限】這一題最多與學生對話 6 個回合。';

/* --- 角色提示模組（模組 1–3）：只有社會框架 --- */
const PROMPT_ROLE = {
  /* 三個角色的模組現在同構：語氣一句、開場動作一句、同一句禁止、同一句交還。
     只有「開場動作」隨社會框架而異——那正是要操弄的東西，其餘完全一樣。
     原本 tutor 53 字、tutee 85、peer 97（比值 1.83），而 frame／opener／stem
     三層都有寫死的規格、只有這一層沒有：指示強度的不對等會直接變成三條件
     輸出行為的不對等，而輸出行為就是處遇本身。規格與斷言見
     zz-debug 的 assertStemParity（那支斷言的名字在這個檔案裡被引用了好幾輪，
     直到第 9 輪才真的存在）。
     引用句一律不可含 LETTER_NEAR 的詞——那是這一輪踩了三次的坑
     （tutee 的「可以」、peer 的「對」、tutee 開場句的「錯了」）。 */
  tutor: '【社會框架】你是陪學生讀的老師，語氣是「我想確認你是怎麼看的」。' +
         '每一輪先用一句話說你聽到他剛剛講的重點，不要加上你自己的看法，' +
         '再把問題丟回去給他，不要替他整理答案。',
  /* 引用句原本是「我不太懂……你可以說給我聽嗎？」，含『可以』——而『可以』
     在 LETTER_NEAR 裡，與 peer 那一句「我們對一下」是同一個形狀：
     骨幹強制第一句回應學生剛講的內容，孩子報 A–D 是常態，
     兩者同段就被攔成「選項代號＋判定語」。指定語氣可以，指定字句不行。 */
  /* 「不要替他整理答案」tutor 與 peer 各有一份，tutee 原本沒有——而 tutee
     的社會框架就是「請你講給我聽」，最容易滑成模型反過來替孩子整理重點。
     三個角色現在都有同一句提醒，指示強度才對得起來。 */
  tutee: '【社會框架】你是剛讀完這篇、但很多地方沒看懂的同學，語氣是「這裡我還沒聽懂」。' +
         '每一輪先用一句話說你哪裡沒聽懂，像在請他教你而不是在考他，' +
         '再把問題交給他，不要替他整理答案。',
  /* 「先簡短說一句你自己讀到哪裡」已經拿掉。tutor 與 tutee 的角色模組
     都沒有任何自報進度的要求，只有 peer 有——而且括號只禁「第幾段第幾句」，
     擋不住「我讀到中間」「我卡在後面那段」這種軟位置線索。
     內建引擎的 PEER_SHARE_LATER 上一輪才把同一批說法整批清掉，理由就寫在
     那個常數上方（軟位置線索，而且只有 peer 拿得到）；提示詞這一側漏了。
     只有 peer 組每一輪都可能收到一個方位線索，RQ1 比的就不再是三種社會框架。
     改成同層級、不涉位置的對等描述，字數與另兩個角色相當。 */
  /* 「先用一句話說你自己讀這一篇的感覺」也要拿掉。**文章全文從來沒有進過
     提示詞**（送出去的只有 composePrompt ＋「【題目】stem／【學生剛剛說】text」），
     等於要求模型對一篇它讀不到的文章講出第一人稱的閱讀內容——它只能編。
     而 leakGuard 攔的是判定語、選項字串、位置與指路語，攔不到
     「我覺得這篇好像在講一個人後悔的事」這種憑空生成的主旨陳述：
     對 II／EE 那幾題（主旨、作者立場）那實質就是提示或誤導，blocked 恆為 false，
     忠實度報表也看不見。而三個角色裡只有 peer 被要求產生內容。
     內建引擎那一側上一輪已經把 PEER_SHARE 收斂成「只講閱讀動作、不碰文本」，
     提示詞這一側現在跟上：只描述對等關係，不要求任何內容。 */
  /* 兩件事都要避開。
     (a) 不可以指定一句含 LETTER_NEAR 詞的口頭禪。上一版寫「用『我們對一下』
         這種說法」——『對』就是 LETTER_NEAR 的第一個詞，而骨幹又強制
         「第一句回應學生剛剛說的內容」、選項在學生端就是 A–D 標籤，
         孩子報字母是常態：「你覺得是B啊，我們對一下——那你呢？」在同一個
         segment 內同時有 [A-D] 與『對』（分句只切 。！？，逗號不切），
         整則被攔成罐頭替換文。那與這一輪剛在 tutee 身上修掉的失效模式
         是同一個形狀，只是換一個條件重演。指定語氣可以，指定字句不行。
     (b) 「對一下」在台灣國小教室的固定搭配是「對答案」。tutor 與 tutee 的
         引用句都明確宣告自己沒有答案，只有它宣告了一個可供比對的參照物——
         操弄檢核問「你覺得小森知道答案嗎」時，peer 的對等關係會最弱。
     同時把互惠分享要回來：內建引擎的 PEER_SHARE 一直在做這件事
     （「我是讀了兩次，才想通它在講什麼。」），只講自己的閱讀動作、
     一個字都不碰文本——那是模型讀不到文章也產得出來的。上一版把
     「限制內容」直接改成「不要求任何內容」，於是 LLM 路徑上的 peer 與
     tutor 幾乎只差一句引用語，而走哪一條路徑由網路逾時決定。 */
  peer:  '【社會框架】你是跟學生同時在讀這一篇的同學，語氣是對等的討論。' +
         '每一輪先用一句話講你自己剛剛的閱讀動作（像是「又從頭讀了一遍」），' +
         '不要講文章內容或答案，再把問題拋回去問他，不要替他整理答案。'
};

/* --- 歷程提示模組（模組 4–7）：提問功能與子歷程提問庫 --- */
function promptProcessModule(pid){
  const p = processOf(pid);
  const subs = subprocessesOf(pid);
  return '【本題官方標定歷程】' + p.name + '（' + p.en + '）——' + p.desc + '\n' +
    '【可用的子歷程提問庫】\n' +
    subs.map(function(s){ return '  ' + s.id + ' ' + s.zh + '：' + s.q; }).join('\n');
}

/* 執行時動態組合 8 個模組中的 3 個（骨幹 + 角色 + 歷程） */
function composePrompt(conditionId, processId, qfnId){
  const f = QFUNCTIONS.find(function(x){ return x.id === qfnId; });
  return [PROMPT_BACKBONE, PROMPT_ROLE[conditionId] || '', promptProcessModule(processId),
    '【這一回合的提問功能】' + f.name + '：' + f.desc].join('\n\n');
}

/* ==========================================================================
   離線對話引擎
   角色只改社會框架，提問功能與子歷程提問庫三角色共用，
   因此不需要語言模型也能忠實產生三條件的對話。
   ========================================================================== */

/* 開場白分兩池：turn 0 時學生還沒說過任何話，也還沒作答，
   所以「你這樣說我有一點懂了」這類句子在第一回合是假的。 */
/* 三個角色一律「一句社會框架 + 一句提問」，句數與字數刻意對齊。
   話量若不相等，三個實驗組就從「三種社會框架」變成「三種資訊量」，
   RQ1 的組間比較會失效。

   「相等」有兩層，而且原本兩層都沒對齊。
   一層是**每句的字數**：peer 最短的一句原本比 tutee 最長的一句還長，
   同儕組的孩子每一輪就是比同學組多聽幾個字——這正是本段警告的那件事。
   三池的字數現在收在 12–18 字。
   另一層是**池子的大小**：opener 是等機率抽取的，
   池子小的角色重複率就高，孩子聽到同一句開場的次數不一樣多。
   重複感本身是互動的表面特徵，會被讀成「這個 AI 比較罐頭」——
   那就變成社會框架以外的第二個組間差異。三個角色一律 2 句開場 + 4 句後續，
   且兩池不重疊。

   同儕的開場白本身就是「我先講我自己怎麼讀」——所以 peer 的 opener 池
   直接放那些句子，不再額外多一句。內容只能關於**閱讀動作**，
   絕不碰文本內容或選項，碰了就是給提示。

   這份規格**也適用於 CONDITIONS 的 frame**。frame 不是抽樣的開場白，
   是固定印在每一題對話卡最上面的第一則訊息，也印在首頁的條件卡上——
   它其實是三個條件裡話量差距最大的一處，卻一直不在這份規格裡：
   實測 36／29／26 字，tutor 每一題比 peer 多讀約三分之一。
   frame 的規格是：兩句話、27–28 字、只描述社會關係。

   還有一條，三池與 frame 都適用：**不得指涉學生發話的品質或成效**。
   agentTurn 從頭到尾不讀學生說了什麼（見檔首的設計原則），
   所以任何「你這樣說我就懂了」都是隨機發放的假回饋——
   對十歲孩子那就是「我說對了」，而且只有一個條件拿得到，
   直接違反「AI 不可判斷對錯」。
   （tutee 的 later 池原本就有一句，已換掉；「所以你的意思是……」
     是複述不是評價，可以留。） */
/* 第一輪就要真的講出自己的讀法。原本 first 池那兩句是「我先講我怎麼讀的」
   ——一個宣告，不是內容；真正帶內容的四句放在 later，第 2 回合起才抽得到。
   於是同儕在整段對話裡唯一一次「先開口」的機會，說的是一句空話。
   把帶內容的閱讀動作句移進 first，另寫四句同型的放 later。
   兩池仍維持 2+4、不重疊，字數仍收在 12–18（見上方的對等規格）。 */
const PEER_SHARE_FIRST = [
  '我讀的時候停了一下，想了想才往下讀。',
  '我第一次讀，好像有地方看漏了。'
];
const PEER_SHARE_LATER = [
  /* 這幾句原本帶著位置：「我剛剛在第二段停了一下」是硬座標，已經拿掉了；
     但改寫後仍留著「讀到中間」「把這裡看漏」「讀到後面才想通前面」——
     那還是位置線索，只是換成軟的說法，而且一樣只有 peer 組拿得到。
     14 題的答案分散在各段，隨機丟出一個方位，等於隨機把孩子帶對或帶錯。
     傷害不在「提示」而在「只有一個條件拿得到、且隨機出現的位置線索」：
     RQ1 比的就不再是三種社會框架。改成完全不帶方位的閱讀動作句，字數維持。 */
  '我是讀了兩次，才想通它在講什麼。',
  '我這一題也想了一下下，沒有很快。',
  '我剛剛回頭又看了一次才確定。',
  '我一開始想的跟後來不太一樣。'
];

const ROLE_OPENER = {
  /* 「先不要急著選，我們再想一下。」已從 tutor 的後續池移除。
     它是一句關於**作答動作**的指令，而 AI 從頭到尾讀不到作答欄位——
     第一回合說它是假的，第三回合說它一樣是假的（孩子可能早就選好了）。
     上一輪只把它從 first 搬到 later，等於換個回合再違反一次同一條界線。 */
  tutor: {first: ['這一題我們一起看，我想知道你怎麼讀。', '我想聽聽你是怎麼看這一題的。'],
          later: ['好，我聽你說，我想確認你是怎麼想的。', '嗯，你再多說一點，我想聽清楚。',
                  '我想確認我有聽懂你的意思。', '你剛剛的想法，我想再聽一次。']},
  /* 「我也在讀這一段」已改成「這一題」。它是三個角色六句開場裡唯一帶方位
     指示詞的一句——tutor 兩句都是題層級，peer 兩句上一輪才刻意把
     「讀到中間」「把這裡看漏」全部清掉（理由寫在 PEER_SHARE_LATER 上方：
     那還是位置線索，只是換成軟的說法，而且只有一個條件拿得到）。
     turn 0 是等機率抽取，所以約一半的 tutee 孩子整個實驗收到的第一句話
     就是它：對只看得到一篇文章和一道題的四年級孩子，「這一段」既是一個
     找不到指涉的指示詞（他會往上捲去找哪一段），也是「答案落在某一段裡」
     的收窄暗示。RQ1 比較的必須是純粹的三種社會框架。 */
  /* later[0] 原本是「我剛剛好像讀錯了，想再想一次。」——它含子字串「錯了」，
     而第 8 輪新增的 VERDICT_SOFT 正好收了「錯了」。agentTurn 會把自己組好的
     回覆再送一次 leakGuard，於是這一句每被抽中就整則被換成固定的攔截替換文：
     那一輪排定的提問功能（F2–F6，含該題標定的 PIRLS 子歷程問句）完全沒送到
     孩子面前，而日誌照排程記著 qfn 與 sub，blocked 還記成 false。
     tutor 六句、peer 六句、tutee 的 first 兩句都不命中，只有這一句撞上——
     等於只有 tutee 這一個條件被系統性砍掉約四分之一輪次的話量與鷹架，
     而被砍的頻率由孩子講幾次決定，與投入、閱讀速度共變。
     改成不含判定語的說法，長度 15 字不變（規格是 12–18 字）。 */
  tutee: {first: ['這一題我也在讀，可是我卡住了。', '這一題我讀了，可是我不太懂。'],
          later: ['我剛剛好像沒讀懂，想再想一次。', '我還在想這一題，想再聽你說一次。',
                  '所以你的意思是……我想確認一下。', '等一下，我想再確認一次。']},
  peer:  {first: PEER_SHARE_FIRST, later: PEER_SHARE_LATER}
};

/* 第三段也要納入話量規格。每一則內建引擎回覆＝opener + ' ' + ROLE_STEM(body)，
   opener 池已依規格收斂到 12–18 字、CONDITIONS.frame 收斂到 27–28 字，
   但這三個 stem 從來不在那份規格裡：原本 tutor 7 字、tutee 10 字、peer 4 字，
   而 body 三組完全相同——peer 每一輪固定比 tutee 少 6 字、比 tutor 少 3 字，
   不隨回合或題目變動，也不是抽樣的。上一輪判定必須修掉的 frame 差距是
   每題 10 字，這一處每題最多 6 輪、16 題累積可達約 576 字。
   而且它同時是 LLM 逾時退回時的主要路徑，退回率又與班級／時段的網路品質共變。
   三句收斂到 6–7 字（見 zz-debug 的 assertStemParity）。 */
const ROLE_STEM = {
  tutor: function(q){ return '你先說說看——' + q; },      // 6
  tutee: function(q){ return '你說給我聽——' + q; },      // 6
  peer:  function(q){ return '那你怎麼看——' + q; }       // 6
};

/* 子歷程一律不看學生說了什麼，只看該題的標定、文體與回合排程。 */

/* 這一題自己標定的子歷程。item.sub 是命題時對應的 PIRLS 子歷程，
   對話要問的就是它——輪替出來的另一個子歷程問的是別的能力。
   文體不合時回傳 null，由呼叫端退回輪替（目前 14 題皆相合）。 */
function subForItem(item){
  const s = item && item.sub ? subprocess(item.sub) : null;
  if (!s) return null;
  const t = item ? getText(item.unit) : null;
  const genre = t ? t.genre : null;
  return (s.fit === '皆可' || s.fit === genre) ? s : null;
}
/* avoid：要排除的子歷程 id。F5 是「延伸」，重問 F3 剛問過的那一句不是延伸。 */
function pickSubprocess(processId, item, turn, avoid){
  const t = item ? getText(item.unit) : null;
  const genre = t ? t.genre : null;   // '敘事' | '說明'
  const subs = subprocessesOf(processId).filter(function(s){
    return s.fit === '皆可' || s.fit === genre;
  });
  let pool = subs.length ? subs : subprocessesOf(processId);
  if (avoid && pool.length > 1){
    const rest = pool.filter(function(s){ return s.id !== avoid; });
    if (rest.length) pool = rest;
  }
  return pool[turn % pool.length];
}

/* 產生一則 AI 回應（離線引擎）。回傳含研究所需的完整中繼資料。 */
function agentTurn(conditionId, item, turn, rnd){
  const r = rnd || Math.random;
  const qfnId = TURN_SCHEDULE[Math.min(turn, TURN_SCHEDULE.length - 1)];
  const pid = item.process || 'FR';
  let sub = null, body = '';

  if (qfnId === 'F1'){
    body = '這一題到底在問什麼？用你自己的話說一次。';
  } else if (qfnId === 'F2'){
    body = '你剛剛的判斷，是從文章裡哪一句看出來的？';
  } else if (qfnId === 'F3'){
    sub = subForItem(item) || pickSubprocess(pid, item, turn);
    body = sub.q;
  } else if (qfnId === 'F4'){
    body = '有沒有別的讀法也說得通？如果有人跟你想的不一樣，他可能是看到哪一句？';
  } else if (qfnId === 'F5'){
    // 延伸：優先往上一層歷程取一個子歷程，沒有上一層就回到同層另一個。
    // EE 沒有上一層，會退回同一個池子，而 turn+2 與 F3 的 turn 在池長 4 時同餘，
    // 於是 F5 會逐字重問 F3——所以要把 F3 問過的那一個排除掉。
    const up = PROCESSES.find(function(p){ return p.order === processOrder(pid) + 1; });
    const asked = subForItem(item) || pickSubprocess(pid, item, 2);
    sub = pickSubprocess(up ? up.id : pid, item, turn + 2, asked ? asked.id : null);
    body = sub.q;
  } else {
    body = '現在如果只能講一句話說你的想法，你會怎麼說？';
  }

  const pool = ROLE_OPENER[conditionId];
  const openers = pool ? (turn === 0 ? pool.first : pool.later) : [''];
  const opener = openers[Math.floor(r() * openers.length)];
  const text = (opener ? opener + ' ' : '') +
    (ROLE_STEM[conditionId] || function(q){ return q; })(body);

  /* 自己的輸出也過一次守門，但**不可以無聲吞掉**。原本只取 .text：
     內建引擎一旦踩到詞表（第 9 輪就發生過一次，tutee 的一句開場含「錯了」），
     孩子收到的是固定的攔截替換文，而日誌照排程寫著 qfn 與 sub、blocked 記成
     false——RQ4 的子歷程覆蓋率與忠實度指標同時說了謊，事後也分不出來。
     被攔的時候：qfn／sub 一律清成 null（那一輪根本沒問出來），
     blocked／hits／kinds 照實回傳，並且在 console 吼一聲——
     規則引擎自攔是程式的缺陷，不是研究現場的事件。 */
  const g = leakGuard(text, item, conditionId);
  if (g.blocked && typeof console !== 'undefined' && console.error){
    console.error('[KAIROS] 內建引擎被自己的 leakGuard 攔下：' + conditionId +
      '／turn ' + turn + '／' + (item && item.id) + '　hits=' + g.hits.join(',') +
      '　原句：' + text);
  }
  return {
    text: g.text,
    qfn: g.blocked ? null : qfnId,
    sub: (g.blocked || !sub) ? null : sub.id,
    process: sub ? sub.p : pid,
    blocked: g.blocked,
    hits: g.hits,
    kinds: g.kinds,
    engine: 'builtin'
  };
}

/* --- 防洩答攔截 ---
   規則引擎本來就不會產生答案，但外部語言模型會。輸出後一律過這一關，
   攔截次數本身就是一項可報告的實施忠實度指標。 */
const VERDICT_WORDS = ['答對', '答錯', '正確答案', '你錯了', '你對了', '正解是', '應該選', '答案是', '選項是'];
/* 不含「答案」二字的判定語。孩子的原話會原樣送進提示詞（【學生剛剛說】），
   骨幹又要求第一句回應他剛剛說的內容——於是外部模型對「答案是不是 B？」
   最自然的回覆是「B 我覺得不太對耶」「不是 B 喔」「對耶」「沒錯」「再想想」
   「很接近了」，上面那一組一個都不命中，原文照送、blocked 為 false。
   而「AI 不可判斷對錯」是硬不變量，leakGuard 是全站唯一的執行機制
   （提示詞只是請求，模型不保證遵守）。孩子逐一報字母討價還價，每題 6 個
   回合足以刷掉三個誘答，四選一的猜對機率從 .25 逼近 1.0。 */
const VERDICT_SOFT = ['對了', '對耶', '沒錯', '正確', '不正確', '不對', '不是這個',
                      '錯了', '猜對', '再想想', '差一點', '很接近', '接近了', '就是這個'];
/* 判定語的鄰近詞。裸露的 A–D 只要跟這些字出現在同一句就攔——
   不再要求 (選|答案|正解) 前綴，也不再只比對正解那一個字母。 */
const LETTER_NEAR = ['對', '錯', '不是', '是不是', '應該', '沒錯', '就是', '選', '可以'];
/* 指路語。判定詞擋的是「說出答案」，這一組擋的是「帶他去某個地方找」——
   兩者都是提示。內建引擎不會產生它們，這一組是給外部模型用的。 */
const POINTER_WORDS = ['線索在', '你去看', '再看看第', '答案在', '提示：', '往前找', '往後找'];
/* 攔截後的替換文依角色而異。原本三個角色一律換上同一句
   『這個我不能說喔。換個方式問你：……』——它明說自己知道答案只是不講，
   還用「換個方式問你」這種施教者口吻，完全不經 ROLE_OPENER／ROLE_STEM。
   對 tutor 它在框架內（小葵的 frame 本來就寫「我不會告訴你答案」），對
   tutee（剛讀完、很多地方沒看懂的同學）與 peer（一起讀的同學）則直接否定
   該條件的社會框架：門生效應要成立的前提是孩子相信小葉真的不會、需要他教，
   一句「這個我不能說喔」就把小葉變回一個藏著答案的老師。
   而一直逼問答案的孩子正是最常觸發攔截的人——框架破口的頻率由受試者自己的
   行為決定，那個行為又與投入、能力共變。三句等長，語域各自對齊。 */
const GUARD_REPLY = {
  tutor: '這個我不能說喔。你剛剛是從哪一句看出來的？',
  tutee: '那裡我也還沒看懂。你剛剛是從哪一句想到的？',
  peer:  '這個我也還沒想清楚。你是從哪一句看出來的？'
};
const GUARD_REPLY_FALLBACK = '這個我不能說喔。你剛剛是從哪一句看出來的？';
/* 「第 N 段」「第二段」都要認得。CN 只到十——文本沒有超過十段的。 */
const CN_NUM = ['零','一','二','三','四','五','六','七','八','九','十'];
function posRe(n, unit){
  const cn = CN_NUM[n] ? '|' + CN_NUM[n] : '';
  return new RegExp('第\\s*(' + n + cn + ')\\s*' + unit);
}

function leakGuard(text, item, conditionId){
  let t = String(text), hits = [];
  /* 兩類分開記：'verdict' 是判斷對錯，'leak' 是洩答或指路。
     忠實度報表要分得開這兩件事——它們違反的是不同的不變量。 */
  function verdict(w){ hits.push('verdict:' + w); }
  function leak(w){ hits.push('leak:' + w); }
  VERDICT_WORDS.forEach(function(w){ if (t.indexOf(w) >= 0) verdict(w); });
  VERDICT_SOFT.forEach(function(w){ if (t.indexOf(w) >= 0) verdict(w); });
  if (item && item.type === 'mc' && item.options){
    /* 誘答字串也要比對，不只正解。「B 不是這個意思」照樣把一個選項刷掉。 */
    item.options.forEach(function(o, k){
      if (o && o.length > 3 && t.indexOf(o) >= 0) leak(k === item.answer ? '正解字串' : '誘答字串');
    });
    /* 任何裸露的 A–D 只要跟判定語出現在同一句就攔。原本的規則要求
       (選|答案|正解) 前綴、而且只比對正解那一個字母：「不是 B 喔」
       （B 是誘答）完全不命中，而那正是刷掉誘答最有效的一句話。 */
    const sentences = t.split(/[。！？!?\n]/);
    for (let s = 0; s < sentences.length; s++){
      const seg = sentences[s];
      if (!/[A-D]/.test(seg)) continue;
      if (LETTER_NEAR.some(function(w){ return seg.indexOf(w) >= 0; })){
        verdict('選項代號＋判定語'); break;
      }
    }
  }
  /* 位置線索一律擋，不再只擋「這一題正解所在的那一個位置」。
     原本比對的是 item.answerPara／answerSent：正解在第 2 段而模型回
     「你再看看第三段」時 hits 為空、blocked 為 false，原文照送——
     攔得住的只有指對的那一種，活下來的全是指錯的，等於隨機把孩子帶到
     錯的段落；而 blocked 次數作為實施忠實度指標會系統性低報。
     更嚴重的是兩題建構反應題的 answerPara／answerSent 都是 null，
     整條位置規則對它們從來沒有生效過。
     「AI 不可給提示」是不變量，任何指路都違反它，不管指得對不對。 */
  for (let n = 1; n <= 10; n++){
    if (posRe(n, '段').test(t)){ leak('指名段落位置'); break; }
  }
  for (let n = 1; n <= 40; n++){
    if (posRe(n, '句').test(t)){ leak('指名句次位置'); break; }
  }
  /* 判定詞之外還有指路語。VERDICT_WORDS 只收「答對／正解是」這一類，
     擋不住「線索在」「你去看」「再看看第」——那些同樣是提示。 */
  POINTER_WORDS.forEach(function(w){ if (t.indexOf(w) >= 0) leak(w); });
  if (hits.length){
    const kinds = [];
    if (hits.some(function(h){ return h.indexOf('verdict:') === 0; })) kinds.push('verdict');
    if (hits.some(function(h){ return h.indexOf('leak:') === 0; })) kinds.push('leak');
    return {text: GUARD_REPLY[conditionId] || GUARD_REPLY_FALLBACK,
            blocked:true, hits:hits, kinds:kinds};
  }
  return {text:t, blocked:false, hits:[], kinds:[]};
}

/* ==========================================================================
   相對歷程編碼（對應研究構想 RQ4）
   以「試題官方標定之理解歷程」為判定基準，把學生的每一次發話編碼為
   低於（BELOW）／等於（AT）／高於（ABOVE）該題所要求的歷程層次。
   ========================================================================== */
const PROCESS_CUES = {
  FR: ['哪一句', '哪一段', '在第', '找到', '寫著', '有說', '出現', '這個詞', '意思是', '幾點', '哪裡'],
  SI: ['因為', '所以', '造成', '導致', '指的是', '代表', '接下來', '前面說', '後面說', '合起來'],
  II: ['整篇', '主題', '想告訴我們', '如果是我', '我覺得作者', '心情', '語氣', '感覺', '生活中', '比較起來'],
  EE: ['真的可能', '合理嗎', '沒說清楚', '我還想知道', '立場', '贊成', '反對', '寫得好', '如果換成', '有沒有漏']
};
function codeUtteranceProcess(text){
  const t = String(text || '');
  let best = 'FR', bestN = 0;
  ['EE', 'II', 'SI', 'FR'].forEach(function(p){
    let n = 0;
    PROCESS_CUES[p].forEach(function(c){ if (t.indexOf(c) >= 0) n++; });
    if (n > bestN){ bestN = n; best = p; }
  });
  if (!bestN) return t.length > 30 ? 'SI' : 'FR';
  return best;
}
function relativeProcessCode(utterance, item){
  const u = processOrder(codeUtteranceProcess(utterance));
  const o = processOrder(item.process || 'FR');
  return u < o ? 'BELOW' : (u > o ? 'ABOVE' : 'AT');
}
const REL_LABEL = {BELOW:'低於題目歷程', AT:'等於題目歷程', ABOVE:'高於題目歷程'};
const REL_SHORT = {BELOW:'Q−', AT:'Q0', ABOVE:'Q+'};
const REL_MARK  = {BELOW:'▽', AT:'○', ABOVE:'△'};

/* ==========================================================================
   情感分析（詞典法）
   ========================================================================== */
const SENT_POS = ['懂了', '會了', '對耶', '原來', '有道理', '好像可以', '知道了', '簡單', '喜歡',
  '有趣', '成功', '沒問題', '應該可以', '想到了', '找到', '清楚', '謝謝', '哈', '耶'];
const SENT_NEG = ['不懂', '不會', '好難', '看不懂', '卡住', '亂', '煩', '討厭', '放棄', '錯',
  '不知道', '沒辦法', '好煩', '不行', '找不到', '想不到', '完蛋', '慘', '累'];
const SENT_NEG_MARK = ['不', '沒', '別', '無法'];
const SENT_INTENS = ['很', '超', '非常', '好', '真的', '完全', '太'];

/* 一次掃過全文，每個位置只取最長的一個詞條，同一詞條最多計兩次。
   原本是兩個各自獨立的 indexOf 迴圈，三個後果都會直接改變 POS／NEG 的編碼：

   （一）反諷式漏判：否定詞的檢查只寫在正向那一圈，負向那一圈沒有。
         「沒錯」「不錯」都會命中 SENT_NEG 的「錯」而拿到 −1——在國小
         學童的對話裡這兩個詞幾乎都是肯定，而且正好是「懂了」之後最常
         出現的說法，也就是被誤判成負向的地方，正是我們最想量到正向的地方。

   （二）重疊詞條重複計數：「看不懂」同時命中「看不懂」與「不懂」得 −2，
         「好煩」同時命中「好煩」與「煩」得 −2，而「卡住」只有 −1。
         詞典寫得愈細的情緒，分數愈重，權重來自詞條長度而不是強度。

   （三）疊字灌滿量表：「哈」是單字詞條且不限次數，「哈哈哈」＝ +3，
         除以 3 之後正好是 +1.0，一個語助詞就頂到量表上限，並在 ENA
         裡翻成一個 POS 編碼。

   三者都與條件無關但與孩子的語言習慣有關，會被讀成處遇效果。 */
function sentimentOf(text){
  const t = String(text || '');
  /* 長詞優先，才能讓「看不懂」蓋掉「不懂」、「對耶」蓋掉「耶」 */
  const LEX = SENT_POS.map(function(w){ return {w: w, s: 1}; })
    .concat(SENT_NEG.map(function(w){ return {w: w, s: -1}; }))
    .sort(function(a, b){ return b.w.length - a.w.length; });
  let score = 0; const hits = []; const seen = {};
  for (let i = 0; i < t.length; ){
    let m = null;
    for (let k = 0; k < LEX.length; k++){
      if (t.startsWith(LEX[k].w, i)){ m = LEX[k]; break; }
    }
    if (!m){ i++; continue; }
    const n = (seen[m.w] || 0) + 1;
    seen[m.w] = n;
    if (n <= 2){                       /* 同一詞條最多算兩次 */
      const pre = t.slice(Math.max(0, i - 2), i);
      let v = m.s;
      if (SENT_NEG_MARK.some(function(x){ return pre.indexOf(x) >= 0; })) v = -v;
      if (SENT_INTENS.some(function(x){ return pre.indexOf(x) >= 0; })) v *= 1.5;
      score += v; hits.push((v > 0 ? '+' : '−') + m.w);
    }
    i += m.w.length;
  }
  const norm = Math.max(-1, Math.min(1, score / 3));
  return {score: norm, hits: hits,
          label: norm > 0.2 ? '正向' : (norm < -0.2 ? '負向' : '中性')};
}
