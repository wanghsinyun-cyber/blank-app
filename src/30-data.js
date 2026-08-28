/* ==========================================================================
   30-data.js — 領域內容與示範資料（閱讀理解）
   所有示範班級／作答／貼文皆為「模擬資料」，由固定亂數種子產生，
   每次載入結果一致，可重現，便於研究報告引用。

   文本與試題皆為「自編示範素材」，仿 PIRLS 題型與難度撰寫，
   **不是** PIRLS 官方釋出文本。正式施測請換上取得授權的釋出題本，
   資料結構完全相同，只需替換 TEXTS 與 ITEMS 兩個常數。
   ========================================================================== */

/* 示範資料的結構版號。存檔的版號與這個值不符時就重建示範資料。
   改資料結構時要把它加一——loadState() 與 buildSeedState() 都讀同一個常數，
   不要在兩邊各寫一個字面量（曾經因此讓存檔永遠讀不回）。 */
const STATE_VERSION = 4;

/* --- 固定種子亂數（mulberry32），確保示範資料可重現 --- */
function mulberry32(a){
  return function(){
    a |= 0; a = a + 0x6D2B79F5 | 0;
    var t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* ==========================================================================
   文本
   ========================================================================== */
const TEXTS = [
  {
    id:'T1', title:'會走路的樹', genre:'敘事', grade:'四—六年級',
    source:'自編示範文本（PIRLS 風格），非官方釋出文本',
    intro:'請先讀完整篇故事，再回答後面的問題。',
    paras:[
      '搬到這條巷子的第三天早上，小昀在陽台上發現一件怪事。巷口那棵種在大陶盆裡的柚子樹，昨天明明靠在紅色鐵門旁邊，今天卻站到了巷子中間。',
      '她跑下樓去看。陶盆很重，底下沒有輪子，泥土上也沒有拖過的痕跡。小昀繞著樹走了兩圈，抬頭看了看那些還沒轉黃的果子，什麼線索也沒找到。',
      '接下來一個星期，柚子樹每天都在不同的位置。星期一在電線桿下，星期三挪到了郵筒旁邊，星期五又回到紅色鐵門邊。小昀在筆記本上畫了一張巷子的地圖，每天把樹的位置點上去。畫著畫著，她發現那些點連起來並不是隨便亂走的——樹總是待在整條巷子裡最亮的地方。',
      '星期六天還沒完全亮，小昀就搬了張小凳子坐在陽台上。六點十分，紅色鐵門開了。一位頭髮全白的老先生走出來，他先站在巷口看了看天空，然後從門後推出一台舊舊的板車。',
      '老先生把板車推到陶盆旁，蹲下去，用一塊厚木板把盆底一點一點撬起來，再慢慢挪上車。他推得很慢，每走幾步就停下來喘氣。到了電線桿旁邊那塊有太陽的空地，他又用同樣的方法把陶盆卸下來，扶正，退後兩步瞇著眼睛看了看，好像在確認什麼。',
      '小昀跑下樓。「阿公，你每天都在搬這棵樹嗎？」',
      '老先生愣了一下，笑了。「妳都看到啦。」他用袖子擦了擦額頭。「這棵樹是我太太種的。她說柚子要曬夠太陽才會甜。」',
      '「那……阿嬤呢？」',
      '老先生沒有馬上回答。他伸手摸了摸樹幹上一道舊舊的疤，那是被繩子綁久了留下的。「她在醫院。」過了一會兒他才說，「醫生說今年冬天以前應該可以回來。」他把手放下，聲音輕輕的，「我想讓她回來的時候，就有柚子可以吃。」',
      '那天以後，小昀每天早上六點都會下樓。她幫忙扶著陶盆，老先生推車。板車走過石板路的聲音，成了那條巷子最早的聲音。',
      '入冬那天，巷口停了一輛計程車。小昀正要出門，看見老先生扶著一位瘦瘦的老太太下車。老太太抬起頭，看見那棵樹，愣住了。',
      '樹上掛滿了柚子。而那棵樹，正好站在紅色鐵門旁邊——她當年種下它的地方。'
    ]
  },
  {
    id:'T2', title:'為什麼有些種子要坐飛機？', genre:'說明', grade:'四—六年級',
    source:'自編示範文本（PIRLS 風格），非官方釋出文本',
    intro:'請先讀完整篇文章，再回答後面的問題。',
    paras:[
      '植物不會走路，可是它們的種子卻可以跑得很遠。這件事聽起來奇怪，其實有很好的理由。',
      '如果所有的種子都掉在母株的正下方，它們會遇到一個大麻煩：母株的葉子擋住了陽光，母株的根搶走了水分和養分。擠在一起的幼苗長不大，最後多半會死掉。生物學家把種子離開母株、散布到別處的過程叫做「傳播」。傳播讓幼苗有機會找到自己的空地。',
      '不同的植物發展出不同的傳播方法。最常見的一種是靠風。蒲公英的種子上長著一叢細細的白毛，張開的時候像一把小傘，風一吹就能飄上幾百公尺。楓樹的種子則長了一片薄薄的翅膀，落下時會像竹蜻蜓一樣旋轉，旋轉可以拖慢下墜的速度，讓風有更多時間把它帶走。',
      '第二種方法是靠動物。有些果實又甜又香，鳥類和哺乳動物吃下去以後，堅硬的種子不會被消化，最後隨著糞便排出，落在離母株很遠的地方。還有一些種子表面長滿了小鉤子，會勾在動物的毛上，被帶著走上好幾公里——你褲管上偶爾黏到的「鬼針草」就是這樣。',
      '第三種方法是靠水。椰子的外殼又厚又輕，中間有空氣，可以在海上漂流好幾個月而不沉，也不會被海水泡壞。許多熱帶海島上的椰子樹，祖先就是這樣漂過來的。',
      '也有少數植物選擇自己動手。鳳仙花的果莢成熟以後，只要輕輕一碰就會突然裂開，把種子彈到兩、三公尺外。這種方法傳得不遠，但勝在不必等風、也不必等動物。',
      '這些方法各有各的代價。靠風的種子必須做得很輕，能帶的養分就少，落地以後得馬上找到適合的土壤；靠動物的種子要準備甜美的果肉，那需要消耗母株大量的能量；靠水的種子只有在海邊才用得上。',
      '所以，種子要跑多遠、用什麼方法跑，並不是隨便決定的。每一種植物的做法，都是它的祖先在自己生長的環境裡，經過非常長的時間慢慢調整出來的結果。'
    ]
  }
];
function getText(id){ return TEXTS.find(function(t){ return t.id === id; }); }
function textTitle(id){ const t = getText(id); return t ? '〈' + t.title + '〉' : id; }
/* 舊介面沿用：本平台的「單元」即「文本」 */
const UNITS = TEXTS;
function getUnit(id){ return getText(id); }
function unitName(id){ const t = getText(id); return t ? textTitle(id) + '（' + t.genre + '）' : id; }

/* --- 理解失誤類型：診斷不必依賴語言模型，誘答選項本身即攜帶失誤標記 --- */
const READING_ERRORS = [
  {id:'E1', name:'未回到文本',   desc:'憑印象或常識作答，沒有回去找文章裡的依據。'},
  {id:'E2', name:'找錯位置',     desc:'回到文本了，但停在錯的段落或錯的句子。'},
  {id:'E3', name:'停在字面',     desc:'只讀出字面訊息，沒有把相鄰的線索連起來做推論。'},
  {id:'E4', name:'過度推論',     desc:'推得太遠，結論超出文本能支持的範圍。'},
  {id:'E5', name:'指涉判斷錯誤', desc:'代名詞或指示詞的對象認錯。'},
  {id:'E6', name:'以偏概全',     desc:'把文中的單一例子當成全文的通則。'},
  {id:'E7', name:'以經驗代替文本',desc:'用自己的生活經驗取代作者實際寫出來的內容。'},
  {id:'E8', name:'忽略作者立場', desc:'只看表面訊息，沒有讀出作者的態度或寫作用意。'}
];
/* 相容舊名（診斷與橋接模組沿用同一組欄位） */
const MISCONCEPTIONS = READING_ERRORS;

/* ==========================================================================
   試題（14 選擇題 + 2 非選題，涵蓋四項理解歷程）
   answerPara / answerSent：答案依據所在的段落與句次，供防洩答與教師檢視使用。
   ========================================================================== */
const ITEMS = [
  /* ---------- T1 會走路的樹（敘事） ---------- */
  {id:'R01', unit:'T1', no:1, process:'FR', sub:'FR-4', type:'mc', diff:'基礎',
   stem:'小昀第一次發現柚子樹位置不對，是在什麼時候？',
   options:['搬來的第三天早上','搬來的第一天晚上','一個星期後的星期六','入冬那天'], answer:0,
   answerPara:0, answerSent:0,
   why:{2:'E2', 3:'E2'},
   note:'直接提取：故事場景中的時間，第一段第一句明確寫出。',
   tags:['場景','時間']},

  {id:'R02', unit:'T1', no:2, process:'FR', sub:'FR-2', type:'mc', diff:'基礎',
   stem:'小昀用什麼方法記錄柚子樹每天的位置？',
   options:['用手機拍照','在筆記本上畫巷子的地圖','請鄰居幫忙看','在樹上綁繩子做記號'], answer:1,
   answerPara:2, answerSent:2,
   why:{0:'E1', 2:'E1', 3:'E7'},
   note:'直接提取：文中明確敘述的行動。選項 D 取自樹幹上的舊疤，屬於找錯位置。',
   tags:['細節']},

  {id:'R03', unit:'T1', no:3, process:'FR', sub:'FR-5', type:'mc', diff:'中等',
   stem:'小昀畫了一個星期的地圖之後，發現了什麼規律？',
   options:['樹每天都往前走一點','樹總是待在巷子裡最亮的地方','樹只在星期六移動','樹一直繞著電線桿轉'], answer:1,
   answerPara:2, answerSent:3,
   why:{0:'E3', 2:'E2', 3:'E2'},
   note:'直接提取：明確陳述的主要發現，位於第三段末句。',
   tags:['主要觀點']},

  {id:'R04', unit:'T1', no:4, process:'SI', sub:'SI-1', type:'mc', diff:'中等',
   stem:'老先生每天把柚子樹搬到有太陽的地方，最主要的原因是什麼？',
   options:['他想讓巷子看起來比較整齊','他相信曬夠太陽柚子才會甜，想讓太太回來時有柚子吃',
            '他怕樹擋住鄰居的門','醫生建議他每天多運動'], answer:1,
   answerPara:6, answerSent:2,
   why:{0:'E1', 2:'E4', 3:'E4'},
   note:'直接推論：把「太太說柚子要曬夠太陽」與「想讓她回來時有柚子吃」兩處線索連起來。',
   tags:['因果']},

  {id:'R05', unit:'T1', no:5, process:'SI', sub:'SI-5', type:'mc', diff:'中等',
   stem:'從故事後半段可以看出小昀和老先生之間變成什麼樣的關係？',
   options:['她成了每天早上幫忙搬樹的夥伴','她變成他的學生，跟他學種樹',
            '她只是遠遠看著，沒有再接觸','她幫他去醫院照顧阿嬤'], answer:0,
   answerPara:9, answerSent:1,
   why:{1:'E4', 2:'E2', 3:'E4'},
   note:'直接推論：由「每天早上六點下樓、幫忙扶著陶盆」推論兩人的關係。',
   tags:['人物關係']},

  {id:'R06', unit:'T1', no:6, process:'II', sub:'II-4', type:'mc', diff:'中等',
   stem:'老先生說「她在醫院」之前停頓了一下，還先摸了摸樹幹上的疤。這樣寫最主要是讓讀者感覺到什麼？',
   options:['他年紀大了，動作比較慢','他不太喜歡別人問他問題',
            '他心裡很掛念，不容易把這件事說出口','他想讓小昀注意到那道疤'], answer:2,
   answerPara:8, answerSent:0,
   why:{0:'E3', 1:'E4', 3:'E2'},
   note:'詮釋整合：從停頓與動作推測人物情緒，屬於語氣與情緒的詮釋。',
   tags:['情緒','語氣']},

  {id:'R07', unit:'T1', no:7, process:'II', sub:'II-1', type:'mc', diff:'進階',
   stem:'如果用一句話說這個故事想告訴我們什麼，下面哪一句最接近？',
   options:['觀察久了就能發現生活中的規律','有些看起來奇怪的事，背後可能藏著一份很深的心意',
            '種柚子需要很多陽光才會甜','老人家做事情比較慢，需要別人幫忙'], answer:1,
   answerPara:11, answerSent:0,
   why:{0:'E3', 2:'E3', 3:'E6'},
   note:'詮釋整合：辨識全文主題。A、C 都是文中出現過的細節，但不是主題。',
   tags:['主題']},

  {id:'R08', unit:'T1', no:8, process:'EE', sub:'EE-2', type:'mc', diff:'進階',
   stem:'故事最後說那棵樹「正好站在紅色鐵門旁邊——她當年種下它的地方」。作者在前面埋了哪一個線索，讓這個結尾成立？',
   options:['第一段提到樹本來就靠在紅色鐵門旁邊','老先生的頭髮全白',
            '陶盆很重，底下沒有輪子','小昀搬了張小凳子坐在陽台上'], answer:0,
   answerPara:0, answerSent:1,
   why:{1:'E1', 2:'E2', 3:'E2'},
   note:'比較評估：辨認作者為結尾預埋的伏筆。',
   tags:['結局','伏筆']},

  {id:'R09', unit:'T1', no:9, process:'EE', sub:'EE-1', type:'mc', diff:'進階',
   stem:'有人說：「一個老人家每天推板車搬那麼重的陶盆，這在真實生活裡不可能發生。」根據文章，最能回應這個質疑的是哪一點？',
   options:['文章說他推得很慢，每走幾步就停下來喘氣，並沒有把他寫得很輕鬆',
            '文章說他頭髮全白，所以體力應該很好','文章說板車是舊的，舊的板車比較好推',
            '文章沒有提到重量，所以不能討論'], answer:0,
   answerPara:4, answerSent:2,
   why:{1:'E4', 2:'E4', 3:'E1'},
   note:'比較評估：評估所述事件真實發生的可能性，並要求以文本證據支持。',
   tags:['合理性']},

  /* ---------- T2 為什麼有些種子要坐飛機？（說明） ---------- */
  {id:'R10', unit:'T2', no:10, process:'FR', sub:'FR-3', type:'mc', diff:'基礎',
   stem:'文章裡「傳播」這個詞指的是什麼？',
   options:['種子發芽長成幼苗的過程','種子離開母株、散布到別處的過程',
            '植物開花結果的過程','風把樹葉吹落的過程'], answer:1,
   answerPara:1, answerSent:2,
   why:{0:'E2', 2:'E2', 3:'E1'},
   note:'直接提取：文中明確給出的定義。',
   tags:['定義']},

  {id:'R11', unit:'T2', no:11, process:'FR', sub:'FR-2', type:'mc', diff:'基礎',
   stem:'根據文章，楓樹的種子為什麼會旋轉？',
   options:['因為種子很重','因為長了一片薄薄的翅膀','因為外殼中間有空氣','因為表面長滿小鉤子'], answer:1,
   answerPara:2, answerSent:3,
   why:{2:'E2', 3:'E2'},
   note:'直接提取：明確寫出的訊息。誘答皆取自文中其他傳播方式，屬找錯位置。',
   tags:['細節']},

  {id:'R12', unit:'T2', no:12, process:'SI', sub:'SI-2', type:'mc', diff:'中等',
   stem:'文章講了風、動物、水、自己彈射四種方法，還說了它們各自的代價。把這些合起來看，作者想說的重點是什麼？',
   options:['靠風傳播是最好的方法','每一種傳播方法都有它的長處和代價，沒有哪一種絕對比較好',
            '種子越輕，傳得越遠','植物應該多學幾種傳播方法'], answer:1,
   answerPara:6, answerSent:0,
   why:{0:'E6', 2:'E6', 3:'E4'},
   note:'直接推論：在一串論點之後歸納重點。A、C 都是把單一例子當成通則。',
   tags:['歸納']},

  {id:'R13', unit:'T2', no:13, process:'SI', sub:'SI-4', type:'mc', diff:'中等',
   stem:'下面哪一句是文章中「通常都會這樣」的概括陳述，而不是講某一種植物？',
   options:['椰子的外殼又厚又輕，中間有空氣','蒲公英的種子上長著一叢細細的白毛',
            '如果所有的種子都掉在母株的正下方，擠在一起的幼苗長不大，最後多半會死掉',
            '鳳仙花的果莢輕輕一碰就會裂開'], answer:2,
   answerPara:1, answerSent:1,
   why:{0:'E3', 1:'E3', 3:'E3'},
   note:'直接推論：辨認文中的概括陳述，需區分通則與個例。',
   tags:['概括']},

  {id:'R14', unit:'T2', no:14, process:'II', sub:'II-5', type:'mc', diff:'進階',
   stem:'如果你在自己家附近的空地上看到一整片長得又高又壯的蒲公英，用文章裡的道理最能解釋的是什麼？',
   options:['那塊空地的土特別肥','那些種子被風帶到有空間、有陽光的地方，才長得起來',
            '蒲公英不需要陽光也能長大','一定是有人特地種下去的'], answer:1,
   answerPara:1, answerSent:2,
   why:{0:'E7', 2:'E4', 3:'E7'},
   note:'詮釋整合：把文中訊息應用到真實世界的情境。',
   tags:['應用']},

  /* ---------- 非選題 ---------- */
  {id:'C01', unit:'T1', no:1, process:'II', sub:'II-2', type:'cr', diff:'中等',
   stem:'如果你是小昀，在發現老先生每天搬樹的原因之後，你會做什麼？請說出你的做法，並且說明你為什麼會這樣做——你的理由要能連到故事裡的某一段。',
   options:[], answer:null, why:{},
   answerPara:null, answerSent:null,
   note:'非選題：思考人物行動的其他可能作法。評閱重點在「有沒有把理由連回文本」。',
   tags:['替代行動','論證']},

  {id:'C02', unit:'T2', no:2, process:'EE', sub:'EE-3', type:'cr', diff:'中等',
   stem:'讀完這篇文章之後，你覺得作者有哪裡沒有說清楚，或是你還想知道什麼？請寫出一個問題，並說明為什麼文章裡的訊息不足以回答它。',
   options:[], answer:null, why:{},
   answerPara:null, answerSent:null,
   note:'非選題：評斷文中訊息的完整性或清晰度。評閱重點在能否指出文本的具體空缺，而非泛泛的好奇。',
   tags:['完整性','提問']}
];

/* --- 知識建構支架（Knowledge Forum scaffolds，理論建構組） --- */
const SCAFFOLDS = [
  {id:'s1', cls:'sc1', label:'我的想法',           hint:'我目前讀到的是……'},
  {id:'s2', cls:'sc2', label:'我需要理解',         hint:'我還不清楚的是……'},
  {id:'s3', cls:'sc3', label:'文本裡的證據',       hint:'文章第◯段說……'},
  {id:'s4', cls:'sc4', label:'這樣讀說不通',       hint:'如果照這個說法，那……就說不通'},
  {id:'s5', cls:'sc5', label:'更好的說法',         hint:'把前面的想法改成……會更好，因為……'},
  {id:'s6', cls:'sc6', label:'綜合我們的理解',     hint:'把大家的想法放在一起看，可以說……'}
];

/* --- 領域詞彙表：用於詞彙成長與論述深度的離線計算 --- */
const DOMAIN_TERMS = [
  '主題','主旨','段落','句子','線索','證據','根據','推論','因果','原因','結果',
  '對比','比較','語氣','情緒','立場','作者','用意','伏筆','結局','細節','舉例',
  '通則','概括','以偏概全','代名詞','指的是','文本','回到文章','沒說清楚','推得太遠'
];

/* 論述品質線索詞（離線引擎用；對應 Knowledge Building 論述特徵） */
const EPISTEMIC_CUES = {
  causal:   ['因為','所以','由於','導致','之所以','原因是'],
  conditional:['如果','假設','若','當','就會','則'],
  counter:  ['反例','但是','可是','不過','然而','並不','未必','不一定','說不通'],
  evidence: ['第','段','句','文章','文中','作者寫','原文','查到','舉例','根據'],
  revision: ['修正','改成','原本以為','後來發現','更精確','補充','重新','再讀一次'],
  question: ['為什麼','怎麼','是不是','會不會','？','疑問']
};

const STUDENT_NAMES = [
  '王品瑄','陳柏宇','林芷妍','張家豪','李映彤','黃冠廷','吳采庭','劉宸希',
  '蔡宜蓁','鄭皓翔','許雅筑','曾于哲','謝亦辰','洪詩涵','周廷叡','施函潔',
  '賴思妤','高睿謙','葉柏翰','莊心怡','邱奕安','潘語彤','杜宥辰','馮筱恩'
];

/* 非選題作答文字（模擬）：依學生能力與參與傾向產生不同版本 */
function crText(it, s, mode, rnd){
  const strong = s.thetaTrue > 0.4;
  const grew = mode === 'post' && s.engage > 0.45;
  if (it.id === 'C01'){
    if (strong || grew){
      return '我會每天早上去幫他扶陶盆。因為第九段寫他推得很慢、每走幾步就要停下來喘氣，' +
             '一個人搬那麼重的盆子很危險。而且他做這件事是為了讓阿嬤回來有柚子吃，' +
             '我幫他就等於也幫了阿嬤。';
    }
    if (s.thetaTrue > -0.6){
      return '我會去幫他推車，因為他年紀很大了，一個人搬很辛苦。';
    }
    return '我會跟他說加油。';
  }
  // C02
  if (strong || grew){
    return '作者沒有說清楚：靠動物傳播的種子，如果被吃掉之後掉在不適合的地方會怎麼樣？' +
           '文章第四段只說種子不會被消化、會隨糞便排出，可是沒有說落地之後成功長大的機會有多少，' +
           '所以我沒辦法比較它跟靠風傳播哪一種比較有效。';
  }
  if (s.thetaTrue > -0.6){
    return '我想知道還有沒有別的傳播方法，文章只講了四種。';
  }
  return '我覺得都寫得很清楚。';
}

/* ==========================================================================
   示範資料建構
   ========================================================================== */
function buildSeedState(){
  // 亂數用固定種子 → 作答矩陣與貼文結構每次載入完全一致（可重現）；
  // 只有時間戳記跟著今天走，示範資料看起來才不會過期。
  const rnd = mulberry32(20250827);
  const today = new Date(); today.setHours(8, 0, 0, 0);
  const now = today.getTime();
  const DAY = 86400000;

  const users = [
    {id:'u-admin', name:'研究者', email:'researcher@kairos.tw', role:'admin'},
    {id:'u-t1',    name:'王慧敏 老師', email:'teacher@kairos.tw', role:'teacher'}
  ];

  /* --- 四個班級：以班級為單位分派到四條件（叢集隨機分派） --- */
  const CLASS_DEFS = [
    {id:'c-1', name:'中山國小 五年 3 班', grade:'五年級', school:'中山國小', code:'RD513', condition:'tutor'},
    {id:'c-2', name:'中山國小 五年 4 班', grade:'五年級', school:'中山國小', code:'RD524', condition:'tutee'},
    {id:'c-3', name:'仁愛國小 六年 1 班', grade:'六年級', school:'仁愛國小', code:'RD631', condition:'peer'},
    {id:'c-4', name:'仁愛國小 六年 2 班', grade:'六年級', school:'仁愛國小', code:'RD642', condition:'control'}
  ];
  // 只分配「真的掛在某個誘答選項上」的失誤類型，否則學生持有一個永遠不會作用的失誤，
  // 會把條件效果稀釋掉。這也是一個實際命題時要注意的事：失誤類型必須有題目測得到。
  const errPool = READING_ERRORS.map(function(e){ return e.id; }).filter(function(id){
    return ITEMS.some(function(it){
      return Object.keys(it.why || {}).some(function(k){ return it.why[k] === id; });
    });
  });
  const classes = [];
  const students = [];
  let sn = 0;

  CLASS_DEFS.forEach(function(def, ci){
    const ids = [];
    for (let i = 0; i < 24; i++){
      sn++;
      const name = ci === 0 ? STUDENT_NAMES[i] : genName(rnd);
      const theta = -1.7 + 3.5 * (i + 0.5) / 24 + (rnd() - 0.5) * 0.7;
      // 只在「真的有題目測得到」的失誤類型之間輪流分配（errPool 已過濾掉 E5、E8），
      // 確保每一種都有幾位持有者，且橫跨各種能力
      // —— 高能力學生也可能有頑固的閱讀習慣問題，這正是 KIDMAP 第二象限要抓的人。
      const held = [];
      held.push(errPool[i % errPool.length]);
      if (rnd() < 0.5){
        const e2 = errPool[(i * 3 + 2) % errPool.length];
        if (held.indexOf(e2) < 0) held.push(e2);
      }
      const s = {id:'u-s' + sn, name:name, email:'s' + sn + '@kairos.tw', role:'student',
                 thetaTrue:theta, held:held, engage:rnd(), classId:def.id};
      students.push(s); users.push(s); ids.push(s.id);
    }
    classes.push({id:def.id, name:def.name, grade:def.grade, school:def.school, code:def.code,
                  condition:def.condition, teacherId:'u-t1', studentIds:ids,
                  createdAt: now - 30 * DAY});
  });
  const allClassIds = classes.map(function(c){ return c.id; });

  /* 兩次派題：同一份題本、同一次校準，四班共用 → 條件間可比 */
  const allIds = ITEMS.map(function(it){ return it.id; });
  const pre = {
    id:'a-pre', title:'閱讀理解 前測', desc:'先看看大家目前的讀法，答錯沒關係，等一下我們一起討論。',
    classIds: allClassIds, teacherId:'u-t1', itemIds: allIds, phase:'pre',
    createdAt: now - 12 * DAY, due: now - 9 * DAY
  };
  const post = {
    id:'a-post', title:'閱讀理解 評量即學習事件（後測）',
    desc:'這一節你會一邊讀一邊回答問題。答錯沒關係，重點是把你怎麼讀的說出來。',
    classIds: allClassIds, teacherId:'u-t1', itemIds: allIds, phase:'post', linkedTo:'a-pre',
    aal: true, createdAt: now - 1 * DAY, due: now + 3 * DAY
  };

  /* --- 作答矩陣（依 Rasch 機率 + 理解失誤規則產生） --- */
  const itemB = {};   // 題目真實難度
  ITEMS.forEach(function(it){
    const base = it.diff === '基礎' ? -1.1 : (it.diff === '中等' ? 0.15 : 1.2);
    itemB[it.id] = base + (rnd() - 0.5) * 0.5;
  });

  function distractorFor(it, err){
    if (err){
      const hit = Object.keys(it.why || {}).filter(function(k){ return it.why[k] === err; });
      if (hit.length) return parseInt(hit[Math.floor(rnd() * hit.length)], 10);
    }
    const pool = [];
    for (let k = 0; k < it.options.length; k++) if (k !== it.answer) pool.push(k);
    return pool[Math.floor(rnd() * pool.length)];
  }

  const responses = [];
  const submissions = [];

  /* 條件對後測能力的模擬效果（依研究構想的理論推導；模擬資料，非實徵結果） */
  const CONDITION_GAIN = {tutee:0.72, peer:0.52, tutor:0.44, control:0.05};
  const CONDITION_FIX  = {tutee:0.30, peer:0.22, tutor:0.20, control:0.02};

  function runAssignment(asg, mode){
    students.forEach(function(s){
      const cond = (classes.find(function(c){ return c.id === s.classId; }) || {}).condition || 'control';
      const fixed = {};
      if (mode === 'post'){
        s.held.forEach(function(m){
          const p = 0.18 + 0.45 * s.engage + (CONDITION_FIX[cond] || 0);
          fixed[m] = rnd() < p;
        });
      }
      const gain = mode === 'post'
        ? (0.10 + 0.35 * s.engage + (CONDITION_GAIN[cond] || 0)) : 0;
      let done = 0;
      ITEMS.forEach(function(it){
        if (it.type === 'cr'){
          const txt = crText(it, s, mode, rnd);
          responses.push({aid:asg.id, sid:s.id, iid:it.id, text:txt, strokes:null,
                          score:null, comment:'', correct:null});
          return;
        }
        const relevant = s.held.filter(function(m){
          return Object.keys(it.why || {}).some(function(k){ return it.why[k] === m; });
        });
        const active = relevant.filter(function(m){ return !fixed[m]; });
        let choice, correct;
        // 持有某個理解失誤，不代表每一題都會犯——設成機率性的，作答矩陣才像真的
        if (active.length && rnd() < 0.5){
          choice = distractorFor(it, active[0]);
          correct = (choice === it.answer);
        } else {
          const p = 1 / (1 + Math.exp(-((s.thetaTrue + gain) - itemB[it.id])));
          correct = rnd() < p;
          if (correct) choice = it.answer;
          else choice = distractorFor(it, null);
        }
        responses.push({aid:asg.id, sid:s.id, iid:it.id, choice:choice, correct:correct});
        done++;
      });
      if (done) submissions.push({aid:asg.id, sid:s.id, at: asg.createdAt + DAY + rnd() * DAY});
    });
  }
  runAssignment(pre, 'pre');
  runAssignment(post, 'post');

  /* --- 知識建構視圖與貼文 --- */
  const views = [];
  const notes = [];
  const S = {};   // 依姓名索引學生 id（僅班級 1，知識建構的示範班級）
  const kbStudents = students.filter(function(s){ return s.classId === 'c-1'; });
  kbStudents.forEach(function(s){ S[s.name] = s.id; });

  const v1 = {
    id:'v-1', title:'那棵樹最後為什麼「正好」站在紅色鐵門旁邊？', createdAt: now - 8 * DAY,
    desc:'從前測第 8 題長出來的共同問題：這是巧合，還是作者早就安排好的？',
    origin:{aid:'a-pre', iid:'R08', mis:'E1'}, links:['v-2']
  };
  const v2 = {
    id:'v-2', title:'什麼樣的答案才算「有根據」？', createdAt: now - 7 * DAY,
    desc:'很多人答對了卻說不出理由。我們來討論：怎樣才算真的從文章裡讀出來的。',
    origin:{aid:'a-pre', iid:'R09', mis:'E1'}, links:['v-1']
  };
  const v3 = {
    id:'v-3', title:'我們班的讀法工具箱', createdAt: now - 4 * DAY,
    desc:'把「找位置、連線索、想主題、評內容」四種讀法放在一起比較：什麼時候用哪一種？',
    origin:null, links:['v-1','v-2']
  };
  views.push(v1, v2, v3);

  let nSeq = 0;
  function mkNote(o){
    nSeq++;
    const n = {
      id:'n-' + nSeq,
      viewId:o.v, title:o.t,
      segs:o.segs || [],
      authorIds:o.a.map(function(nm){ return S[nm] || nm; }),
      keywords:o.k || [],
      createdAt:o.at,
      editedAt:o.ed || null,
      x:o.x, y:o.y,
      kind:o.kind || 'note',
      buildOn:o.bo || null,
      contains:o.contains || [],
      refs:o.refs || [],
      itemRef:o.item || null,
      reads:[],
      annotations:o.ann || []
    };
    notes.push(n);
    return n;
  }

  /* v-1：伏筆是不是巧合 */
  mkNote({v:'v-1', t:'【全班共同問題】結尾是巧合，還是作者早就安排好的？', kind:'problem',
    a:['u-t1'], at:now - 8*DAY, x:60, y:40, k:['伏筆','結局'],
    item:{aid:'a-pre', iid:'R08'},
    segs:[{s:'s2', text:'前測第 8 題問「作者在前面埋了哪一個線索」，有不少同學選了跟結尾無關的細節。有趣的是，這些同學在比較難的第 7 題反而答對了——照他們的能力，這一題本來應該會。我們一起來弄清楚：什麼樣的細節才算「伏筆」？'}]});

  mkNote({v:'v-1', t:'我覺得就是剛好而已', a:['王品瑄'], at:now - 8*DAY + 3600e3, x:330, y:36, k:['結局'],
    segs:[{s:'s1', text:'我讀的時候覺得樹回到鐵門旁邊只是剛好。老先生每天搬來搬去，總有一天會搬回去啊。'}]});

  mkNote({v:'v-1', t:'可是第一段就寫了它本來在那裡', a:['陳柏宇'], at:now - 8*DAY + 7200e3, x:600, y:30,
    bo:'n-2', k:['伏筆','證據'],
    segs:[{s:'s4', text:'如果只是剛好，那作者為什麼要在第一段特別寫「昨天明明靠在紅色鐵門旁邊」？那句話對故事的其他部分完全沒有用。'},
          {s:'s1', text:'我覺得作者是先把位置告訴我們，最後才讓我們自己想起來。'}]});

  mkNote({v:'v-1', t:'那要怎麼分辨伏筆和普通細節？', a:['林芷妍'], at:now - 7*DAY, x:330, y:190,
    bo:'n-2', k:['伏筆','判準'],
    segs:[{s:'s2', text:'我需要理解的是：文章裡細節那麼多，為什麼有的是伏筆有的不是？陶盆很重、板車很舊，這些不也是細節嗎？'}]});

  mkNote({v:'v-1', t:'我想到一個判斷方法', a:['蔡宜蓁','鄭皓翔'], at:now - 7*DAY + 5400e3, x:600, y:180,
    bo:'n-4', k:['判準','伏筆'],
    segs:[{s:'s5', text:'我們試了一個方法：把那句話遮起來，看結尾還成不成立。遮掉「陶盆很重」，結尾照樣看得懂；可是遮掉第一段的紅色鐵門，最後那句「她當年種下它的地方」就沒有力量了。'},
          {s:'s3', text:'所以伏筆是「拿掉之後結尾會垮」的細節。'}]});

  mkNote({v:'v-1', t:'用這個方法檢查第 9 題也行', a:['黃冠廷'], at:now - 7*DAY + 9000e3, x:870, y:176,
    bo:'n-5', k:['證據'], item:{aid:'a-pre', iid:'R09'},
    segs:[{s:'s3', text:'第 9 題問老人搬得動嗎，我本來想說老人力氣大。可是回去看第五段，作者寫「推得很慢，每走幾步就停下來喘氣」——這句話就是拿來回答那個質疑的。'},
          {s:'s1', text:'我發現我原本是用自己的想法回答，不是用文章。'}]});

  mkNote({v:'v-1', t:'我把兩種細節分開整理', a:['吳采庭'], at:now - 6*DAY, x:60, y:300, k:['伏筆','整理'],
    bo:'n-1',
    segs:[{s:'s5', text:'我想把它整理成兩類：\n（1）鋪陳用的細節——讓場景有畫面，拿掉不影響結局。例如陶盆很重、板車很舊。\n（2）伏筆——結尾回頭要用到它。例如第一段的紅色鐵門、樹幹上的舊疤。\n兩種都重要，但只有第二種可以拿來回答第 8 題。'}]});

  mkNote({v:'v-1', t:'那道疤也是伏筆嗎？', a:['劉宸希'], at:now - 6*DAY + 3600e3, x:330, y:330,
    bo:'n-7', k:['伏筆'],
    segs:[{s:'s4', text:'如果照采庭的分法，樹幹上的疤應該是伏筆。可是結尾沒有再提到它啊。'},
          {s:'s2', text:'我不確定它是不是在暗示這棵樹被綁著搬過很多次，還是別的意思。'}]});

  mkNote({v:'v-1', t:'我覺得疤是拿來寫時間的', a:['許雅筑','洪詩涵'], at:now - 5*DAY, x:600, y:330,
    bo:'n-8', k:['伏筆','時間'],
    segs:[{s:'s5', text:'我們討論之後覺得，那道疤不是為結尾服務的，是為了讓讀者知道「這件事做很久了」。它支撐的是第七段阿公說的話，不是最後一句。'},
          {s:'s3', text:'所以伏筆要看它回頭指向哪裡，不是有沒有被再提到。'}]});

  mkNote({v:'v-1', t:'【躍升】我們班目前對「伏筆」的共同理解', kind:'rise',
    a:['u-t1','吳采庭','許雅筑'], at:now - 4*DAY, x:870, y:330,
    contains:['n-3','n-5','n-7','n-9'], k:['共同理解','伏筆'],
    segs:[{s:'s6', text:'把大家的想法放在一起，我們現在同意三件事：\n1. 伏筆是「拿掉之後，後面某一段會垮」的細節——可以用遮住那句話的方法檢查。\n2. 伏筆不一定會被再提到，重點是它回頭支撐了哪一段。\n3. 回答「作者埋了什麼線索」這種題目時，要指出具體是哪一句，不能只說「感覺是這樣」。'},
          {s:'s2', text:'還沒解決的是：如果一句話同時支撐好幾個地方，算不算更重要的伏筆？'}],
    refs:[{noteId:'n-5', quote:'把那句話遮起來，看結尾還成不成立'}]});

  /* v-2：什麼算有根據 */
  mkNote({v:'v-2', t:'【全班共同問題】答對了，但說得出理由嗎？', kind:'problem',
    a:['u-t1'], at:now - 7*DAY, x:60, y:40, k:['證據'],
    item:{aid:'a-pre', iid:'R09'},
    segs:[{s:'s2', text:'前測第 9 題有不少同學選對了，但寫下的理由是「因為老人家很辛苦」——那是你的想法，不是文章的訊息。請大家想清楚：怎樣才算真的從文章裡讀出來的？'}]});

  mkNote({v:'v-2', t:'我以為想得通就算有根據', a:['張家豪'], at:now - 7*DAY + 3600e3, x:330, y:36,
    bo:'n-11', k:['證據'],
    segs:[{s:'s1', text:'我本來覺得只要說得通就好。反正老人搬重物本來就慢，這是常識。'}]});

  mkNote({v:'v-2', t:'常識有時候會害我們讀錯', a:['曾于哲'], at:now - 7*DAY + 6000e3, x:600, y:30,
    bo:'n-12', k:['反例','經驗'],
    segs:[{s:'s4', text:'可是第 14 題我就是用常識答錯的。我看到蒲公英長得好，直接想「一定是土很肥」，可是文章根本沒提土。'},
          {s:'s3', text:'文章講的是種子被風帶到有空間、有陽光的地方。我用了自己的經驗代替文章。'}]});

  mkNote({v:'v-2', t:'有根據要指得出第幾段', a:['謝亦辰'], at:now - 6*DAY, x:600, y:170,
    bo:'n-12', k:['證據','判準'],
    segs:[{s:'s5', text:'我覺得判斷方法很簡單：能不能指出是第幾段第幾句。指得出來就是有根據，指不出來就是自己想的。'},
          {s:'s1', text:'第 9 題可以指到第五段「推得很慢，每走幾步就停下來喘氣」，那就有根據。'}]});

  mkNote({v:'v-2', t:'我試著把兩種說法排在一起', a:['周廷叡'], at:now - 6*DAY + 4000e3, x:330, y:190,
    bo:'n-12', k:['對比'],
    segs:[{s:'s3', text:'「老人家搬重物本來就慢」——這句話在文章裡找不到。\n「作者寫他推得很慢、每走幾步就停下來喘氣」——這句話指得到第五段。\n兩句話的結論一樣，可是只有第二句是從文章來的。'},
          {s:'s4', text:'所以結論對不代表讀法對。這一點很容易被忽略，因為答案會被打勾。'}]});

  mkNote({v:'v-2', t:'那如果文章沒直接寫呢？', a:['施函潔','賴思妤'], at:now - 5*DAY, x:870, y:170,
    bo:'n-15', k:['推論','證據'],
    segs:[{s:'s2', text:'第 6 題問老先生停頓一下代表什麼，文章沒有直接寫「他很掛念」啊。那要怎麼指？'},
          {s:'s5', text:'我們後來覺得可以這樣說：指出兩個線索（停頓、摸疤），再說它們合起來讓人覺得什麼。這樣還是有根據，只是多了一步推論。'}]});

  mkNote({v:'v-2', t:'【躍升】什麼叫「有根據的答案」', kind:'rise',
    a:['u-t1','謝亦辰','施函潔'], at:now - 4*DAY, x:870, y:330,
    contains:['n-13','n-14','n-16'], k:['共同理解','證據'],
    segs:[{s:'s6', text:'我們的共同結論：\n1. 有根據 = 指得出第幾段第幾句，或指得出兩個以上的線索再說它們合起來的意思。\n2. 結論對不代表讀法對——碰巧選對還是要檢查理由從哪裡來。\n3. 用自己的經驗回答不是錯，但要先確認文章有沒有支持它。'}]});

  /* v-3：讀法工具箱 */
  mkNote({v:'v-3', t:'四種讀法什麼時候用？', kind:'problem', a:['u-t1'], at:now - 4*DAY, x:60, y:40,
    k:['直接提取','直接推論','詮釋整合','比較評估'],
    segs:[{s:'s2', text:'找位置、連線索、想主題、評內容——這四種讀法我們都用過了。我們來整理出「看到題目時怎麼決定用哪一種」的判斷流程。'}]});

  mkNote({v:'v-3', t:'看題目的動詞就知道了', a:['高睿謙'], at:now - 3*DAY, x:330, y:36, k:['判準'],
    segs:[{s:'s1', text:'我發現題目問「是什麼、在哪裡」通常回去找就好；問「為什麼」就要連線索；問「如果用一句話說」就是問主題；問「真的可能嗎、有沒有說清楚」就是要評內容。'},
    ], bo:'n-18'});

  mkNote({v:'v-3', t:'可是有的題目看起來像 A 其實是 B', a:['莊心怡'], at:now - 3*DAY + 3600e3, x:600, y:36,
    bo:'n-19', k:['判準'], item:{aid:'a-pre', iid:'R13'},
    segs:[{s:'s4', text:'第 13 題問「哪一句是通常都會這樣」，看起來像找位置，可是四個選項都在文章裡找得到，真正要做的是分辨通則和個例。'},
          {s:'s5', text:'所以動詞只能當第一步，還要看選項在考什麼。'}]});

  mkNote({v:'v-3', t:'評內容那一類最難', a:['邱奕安'], at:now - 2*DAY, x:330, y:200,
    bo:'n-18', k:['比較評估'],
    segs:[{s:'s1', text:'我覺得問「有沒有說清楚」最難，因為要先知道一篇文章「應該說清楚什麼」。第 C02 題我想很久都寫不出來。'}]});

  /* 閱讀紀錄（模擬）：能力越高、參與傾向越高者讀越多 */
  notes.forEach(function(n){
    kbStudents.forEach(function(s){
      const p = 0.2 + 0.65 * s.engage;
      if (n.authorIds.indexOf(s.id) < 0 && rnd() < p) n.reads.push(s.id);
    });
  });

  /* 註記（annotation）示範 */
  notes[4].annotations.push({id:'an-1', authorId:'u-t1', text:'「遮起來看結尾成不成立」是很好的檢驗方法——你們自己想出了一個可以重複使用的判準。', at:now - 6*DAY});
  notes[8].annotations.push({id:'an-2', authorId:S['陳柏宇'], text:'那如果一句話同時支撐好幾段呢？我想在躍升貼文裡補這一點。', at:now - 4*DAY});

  const st = {
    version: STATE_VERSION,
    users: users,
    classes: classes,
    assignments: [pre, post],
    responses: responses,
    submissions: submissions,
    views: views,
    notes: notes,
    logs: [],
    dialog: [],
    surveys: [],
    assignmentLog: [{at: now - 20 * DAY, seed: 20250827, stratify:'grade',
                     map: classes.map(function(c){ return {cid:c.id, cond:c.condition}; }),
                     note:'出廠預設分派（示範）'}],
    settings: {
      engine:'builtin', provider:'anthropic', baseUrl:'https://api.anthropic.com/v1',
      apiKey:'', model:'claude-sonnet-5',
      misThreshold: 12, minN: 3, maxTurns: 6, kbClassId: 'c-1',
      a11y: {fontScale: 1, highContrast: false}
    },
    aiCache: {},
    ui: { role:'u-t1', classId:'c-1' },
    seededAt: now
  };
  return st;
}

/* 班級 2–4 的學生姓名（固定種子產生，僅為示範） */
const SURNAMES = ['王','陳','林','張','李','黃','吳','劉','蔡','鄭','許','曾','謝','洪','周','施',
                  '賴','高','葉','莊','邱','潘','杜','馮','宋','徐','孫','呂','盧','蕭','簡','范'];
const GIVEN = ['宇彤','家瑋','品叡','語安','宸恩','昱翔','若晴','柏睿','詩晴','承翰','宜靜','子桓',
               '亭妤','祐生','采蓁','冠霖','思穎','立宸','佳霓','允中','念慈','宥廷','曉薇','劭寧',
               '睿哲','沛蓁','品岑','翊軒','怡君','孟哲','雅涵','建霖'];
function genName(rnd){
  return SURNAMES[Math.floor(rnd() * SURNAMES.length)] + GIVEN[Math.floor(rnd() * GIVEN.length)];
}
