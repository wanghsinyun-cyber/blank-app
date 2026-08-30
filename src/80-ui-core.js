/* ==========================================================================
   80-ui-core.js — 外殼、路由、共用元件與圖形
   ========================================================================== */

const $ = function(s, r){ return (r || document).querySelector(s); };
const $$ = function(s, r){ return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

let ROUTE = {name:'teacher', args:[]};

function go(hash){ location.hash = hash; }
/* 有些跳轉之後，原本停留的那一頁已經不成立了：交完卷的作答頁、
   送出後的問卷、刪掉之後的貼文詳頁。用 go() 疊一筆歷史紀錄的話，
   按〈上一頁〉會回到一個已經不存在的狀態——而按上一頁正是孩子
   最直覺的動作。這種跳轉要「換掉」目前這一筆，不是疊上去。
   replaceState 不會觸發 hashchange，所以要自己叫 render()。 */
function replaceHash(hash){
  if (location.hash === hash){ if (typeof render === 'function') render(); return; }
  if (window.history && history.replaceState){
    history.replaceState(null, '', hash);
    if (typeof render === 'function') render();
  } else {
    location.replace(location.pathname + location.search + hash);
  }
}
/* 在 render() 內部發現「這一頁已經不成立」時的轉址。三種寫法只有這一種對：
   go() 會把作廢的那一頁疊進歷史，按〈上一頁〉又被送回來，兩頁之間原地打轉；
   replaceHash() 會自己先 render 一次，等這個 view 函式回傳之後，外層 render()
   再把畫面清空，而 replaceState 不觸發 hashchange，沒有東西會把它補回來，
   結果是一片空白。這裡只換網址、把 ROUTE 對齊，實際要畫什麼由呼叫端
   在同一次 render 裡直接回傳（例如 return viewResult(aid)）。 */
function rerouteInRender(hash){
  if (location.hash === hash) return;
  if (!(window.history && history.replaceState)) return;
  try {
    history.replaceState(null, '', hash);
    if (typeof parseRoute === 'function') ROUTE = parseRoute();
  } catch (e) {}
}
/* 已知路由白名單。逐條抄自 99-app.js 的 render() switch；
   新增 case 時這裡要同步，否則新路由會被當成未知而不重繪。
   有這道白名單，頁內錨點（#stage、#anything）就不會把畫面打成 404。 */
const KNOWN_ROUTES = {teacher:1, create:1, assign:1, kb:1, note:1, synth:1, dash:1,
  bank:1, settings:1, about:1, research:1, aal:1, inspect:1, survey:1,
  student:1, quiz:1, result:1, mygrowth:1, unlock:1};

function parseRoute(){
  const h = (location.hash || '#/teacher').replace(/^#\/?/, '');
  const parts = h.split('/').filter(Boolean);
  const name = parts[0] || 'teacher';
  if (!KNOWN_ROUTES[name] && typeof ROUTE !== 'undefined' && ROUTE) return ROUTE;
  return {name: name, args: parts.slice(1)};
}

/* 提示條。原本一律 2600ms 之後自己消失，沒有任何辦法留住它：
   · 2.6 秒是給「已存檔」那種三個字的訊息定的，但最長的一則有二十幾個字
     （「這一題的對話次數用完了，可以按下一題。」），四年級讀者讀不完；
   · 而 toast 是好幾條路徑唯一的回饋——〈帶你回到第 3 題〉、〈額度用完〉、
     〈沒能存起來〉都只在這裡出現一次，錯過就沒有第二次；
   · WCAG 2.2.1（時間可調整）要求會自動消失的訊息可暫停或可關閉。
   改成：停留時間隨字數走、滑過或用鍵盤停在上面就暫停、並且給一顆關閉鈕。
   #toastRoot 本身是 role="status" aria-live="polite"，報讀不受影響。 */
function toast(msg){
  const r = $('#toastRoot');
  const ms = Math.min(9000, 2600 + String(msg == null ? '' : msg).length * 90);
  r.innerHTML = '<div class="toast">' +
    '<span>' + esc(msg) + '</span>' +
    '<button class="toast-x" type="button" data-act="toast-close" aria-label="關閉這則訊息">×</button>' +
    '</div>';
  const box = r.firstChild;
  clearTimeout(toast._t);
  function arm(){
    clearTimeout(toast._t);
    /* 只收自己那一則：暫停期間若有新的 toast 進來，舊的計時器不該把它清掉。 */
    toast._t = setTimeout(function(){ if (r.firstChild === box) r.innerHTML = ''; }, ms);
  }
  function hold(){ clearTimeout(toast._t); }
  box.addEventListener('pointerenter', hold);
  box.addEventListener('pointerleave', arm);
  box.addEventListener('focusin', hold);
  box.addEventListener('focusout', arm);
  arm();
}

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),' +
                  'select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

function modal(html, opts){
  opts = opts || {};
  const r = $('#modalRoot');
  /* 覆寫 innerHTML 之前先讀 activeElement。反過來的話，原本有焦點的節點
     已經被移除、activeElement 已經是 body，_returnTo 就永遠是 body——
     而編輯器每按一次「＋ 再加一個支架段落」都會重繪這個彈窗。 */
  const prev = document.activeElement;
  /* 每開一個新彈窗就把上一個的「被取消」回呼清掉。忘了清的話，
     alertModal（沒有取消語意）被 Esc 關掉時會跑到上一個確認框的救援流程。 */
  modal._onDismiss = null;
  const reopening = !!r.firstChild;
  const keepTop = reopening ? (r.querySelector('.modal') || {}).scrollTop : 0;

  r.innerHTML = '<div class="modal-back" data-act="modal-back"><div class="modal' +
    (opts.wide ? ' wide' : '') + '" role="dialog" aria-modal="true"' +
    ' tabindex="-1">' + html + '</div></div>';
  const box = r.querySelector('.modal');
  const h = r.querySelector('h2,h3,h4');
  /* aria-labelledby 只在 id 真的設好時才輸出。無條件輸出、卻只在有標題時
     指派 id，會讓它指向不存在的 id——可及名稱因此是空的，而 aria-label
     的優先度比它低，補了也沒用。 */
  if (h){
    if (!h.id) h.id = 'modalTitle';
    box.setAttribute('aria-labelledby', h.id);
  } else {
    box.setAttribute('aria-label', opts.label || '對話方塊');
  }

  if (!reopening) modal._returnTo = prev;
  if (keepTop) box.scrollTop = keepTop;

  /* 初始焦點給 .modal 本身，讓報讀器先唸出 dialog 名稱。
     原本抓「第一個可聚焦元素」抓到的是最上面的「關閉」鈕——
     重繪之後順手按 Enter 就等於關掉彈窗，剛打的字全沒。 */
  if (opts.focus){
    const f = r.querySelector(opts.focus);
    if (f){ f.focus(); if (f.setSelectionRange) try { f.setSelectionRange(f.value.length, f.value.length); } catch (e) {} }
    else box.focus();
  } else {
    box.focus();
  }

  /* 焦點陷阱。宣告了 aria-modal 卻讓 Tab 走進被遮罩壓住的頁面，
     對鍵盤與報讀器使用者等於沒有彈窗。 */
  if (!modal._trap){
    modal._trap = function(e){
      if (e.key !== 'Tab') return;
      const m = $('#modalRoot').querySelector('.modal');
      if (!m) return;
      const f = Array.prototype.filter.call(m.querySelectorAll(FOCUSABLE), function(el){
        return el.offsetParent !== null || el === document.activeElement;
      });
      if (!f.length){ e.preventDefault(); m.focus(); return; }
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === m)){
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last){
        e.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', modal._trap, true);
  }
}
/* 站內的確認對話框。
   學生端唯一不可逆的決定（交卷、送出問卷）原本走原生 confirm()——
   而原生對話框由瀏覽器 UI 繪製，完全不吃 :root 的 --fs，也不吃
   [data-contrast="high"]。也就是說：平台為低視力孩子準備的 175% 字級與
   高對比模式，在整個流程裡最需要看清楚的那一個畫面上完全失效，
   而缺答清單（「還有 5 題沒寫完：第 3 題、第 7 題…」）正是要他讀完再決定的。
   modal() 會隨 --fs 與高對比一起變，已經有焦點陷阱與捲動偏移。
   confirm 是同步的，這一支是回呼式的——呼叫端要把後續流程搬進 onYes。
   初始焦點放在〈取消〉：這是不可逆的動作，預設不該停在「確定」上。 */
function confirmModal(opts, onYes){
  const o = opts || {};
  const listHtml = (o.list && o.list.length)
    ? '<ul style="margin:10px 0 0 1.2em">' +
        o.list.map(function(x){ return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>'
    : '';
  confirmModal._onNo = null;
  confirmModal._yes = function(){
    modal._onDismiss = null;      // 走的是「確定」，不要再觸發取消流程
    closeModal();
    confirmModal._onNo = null;
    try { onYes(); } catch (e) {
      if (typeof console !== 'undefined' && console.error) console.error(e);
    }
  };
  modal('<div class="modal-h"><h3>' + esc(o.title || '請確認') + '</h3></div>' +
    '<div class="modal-b"><p style="margin:0;max-width:60ch">' + esc(o.body || '') + '</p>' +
    listHtml +
    (o.note ? '<p class="muted small" style="margin-top:10px;max-width:60ch">' + esc(o.note) + '</p>' : '') +
    '</div>' +
    '<div class="modal-f">' +
    /* o.danger：「確定」那一邊才是不可逆的時候，把視覺權重翻過來。
       兩個缺答分支的 yes 正是「還是要交卷」「還是要送出」，
       no 才是救援路徑。初始焦點早就放在取消（理由寫在上面），
       但同一個理由沒有套到視覺權重上－－而教室裡的孩子是用手指點的，
       不是用 Tab 的；十歲孩子在鐘響前點的是顏色最重的那一顆。 */
    '<button class="btn' + (o.danger ? ' primary' : '') + '" data-act="confirm-no">' + esc(o.no || '取消') + '</button>' +
    '<button class="btn' + (o.danger ? '' : ' primary') + '" data-act="confirm-yes">' + esc(o.yes || '確定') + '</button>' +
    '</div>', {focus:'[data-act="confirm-no"]'});
  /* Esc 與點背景關掉彈窗，語意上就是按了〈取消〉，所以要走同一條路。
     原本只有〈取消〉那顆鈕會呼叫 _onNo，於是用 Esc 關掉缺答提醒的孩子
     不會被帶回沒寫的那一題、也不會看到標紅——而那正是這個彈窗存在的理由；
     鍵盤使用者按 Esc 是最自然的取消動作，等於這道救援只對用滑鼠的人生效。
     必須在 modal() 之後設定：modal() 開頭會把它清成 null。 */
  modal._onDismiss = function(){
    const no = confirmModal._onNo;
    confirmModal._onNo = null; confirmModal._yes = null;
    if (no) try { no(); } catch (e) {
      if (typeof console !== 'undefined' && console.error) console.error(e);
    }
  };
}

/* 站內的輸入框（目前只有「換人」的教師代碼用它）。理由與 confirmModal
   相同：原生 prompt() 不吃 --fs 與高對比，而且會凍住整個執行緒。
   onOk 收到輸入值；按取消或 Esc 不呼叫。 */
function promptModal(opts, onOk){
  const o = opts || {};
  confirmModal._onNo = null;
  confirmModal._yes = function(){
    const box = document.getElementById('promptInput');
    const v = box ? box.value : '';
    modal._onDismiss = null;
    closeModal();
    try { onOk(v); } catch (e) {
      if (typeof console !== 'undefined' && console.error) console.error(e);
    }
  };
  modal('<div class="modal-h"><h3>' + esc(o.title || '請輸入') + '</h3></div>' +
    '<div class="modal-b">' +
    (o.body ? '<p style="margin:0 0 10px;max-width:60ch">' + esc(o.body) + '</p>' : '') +
    '<div class="field"><label for="promptInput">' + esc(o.label || '') + '</label>' +
    '<input type="' + (o.password ? 'password' : 'text') + '" id="promptInput" ' +
    'inputmode="' + esc(o.inputmode || 'text') + '" autocomplete="off"></div>' +
    (o.note ? '<p class="muted small" style="margin-top:10px;max-width:60ch">' + esc(o.note) + '</p>' : '') +
    '</div>' +
    '<div class="modal-f">' +
    '<button class="btn" data-act="confirm-no">' + esc(o.no || '取消') + '</button>' +
    '<button class="btn primary" data-act="confirm-yes">' + esc(o.yes || '確定') + '</button>' +
    '</div>', {focus:'#promptInput'});
}

/* 站內的告知框。理由與 confirmModal 完全相同，只是沒有「取消」這個選項。
   會走到它的兩個地方都是存檔失敗——原生 alert() 在那一刻特別糟：
   它不吃 --fs 與高對比，而它要傳達的正是「先不要關掉這個分頁」；
   而且原生對話框會把整個 JS 執行緒凍住，畫面上的內容連捲都捲不動。
   訊息裡不要留 Markdown 的星號：原生 alert 只會把 ** 原樣印出來，
   孩子看到的是一行帶星號的怪句子。要強調就用 strong。 */
function alertModal(opts){
  const o = opts || {};
  modal('<div class="modal-h"><h3>' + esc(o.title || '請看一下') + '</h3></div>' +
    '<div class="modal-b"><p style="margin:0;max-width:60ch">' + esc(o.body || '') + '</p>' +
    (o.strong ? '<p style="margin:10px 0 0;max-width:60ch"><strong>' + esc(o.strong) + '</strong></p>' : '') +
    (o.note ? '<p class="muted small" style="margin-top:10px;max-width:60ch">' + esc(o.note) + '</p>' : '') +
    '</div>' +
    '<div class="modal-f">' +
    '<button class="btn primary" data-act="confirm-no">' + esc(o.ok || '我知道了') + '</button>' +
    '</div>', {focus:'[data-act="confirm-no"]'});
}

function closeModal(){
  /* 先取走再清空：_onDismiss 裡多半會重繪，重繪之後 modal._onDismiss
     這個欄位還在，沒先取走會有再跑一次的風險。 */
  const dismissed = modal._onDismiss; modal._onDismiss = null;
  $('#modalRoot').innerHTML = '';
  if (modal._trap){ document.removeEventListener('keydown', modal._trap, true); modal._trap = null; }
  /* 焦點還給打開它的那顆按鈕。那顆按鈕已經不在文件裡（重繪換掉了）時，
     退到 #stage——寧可退到主舞台也不要掉回 body。 */
  if (modal._returnTo && document.contains(modal._returnTo)){
    try { modal._returnTo.focus(); } catch (e) {}
  } else {
    const stage = $('#stage');
    if (stage) try { stage.focus({preventScroll:true}); } catch (e) {}
  }
  modal._returnTo = null;
  /* 放在最後：救援流程多半要自己搶焦點（帶回沒寫完的那一題），
     不能被上面的「焦點還給打開它的那顆按鈕」蓋掉。 */
  if (dismissed) try { dismissed(); } catch (e) {
    if (typeof console !== 'undefined' && console.error) console.error(e);
  }
}

/* --- 外殼 --- */
function renderShell(){
  const sel = $('#who');
  /* 身分下拉是研究者與教師的工具，學生不該碰得到。實測一位學生的下拉裡
     有 98 個選項：本班 24 人、別班 72 人、導師、以及研究者。後果有三層——
     ① 對照組的孩子切到 tutor 班就看得到 AI 夥伴，受試者間設計當場失效；
     ② 可以變成同班同學，讀或改別人的作答；
     ③ 可以變成研究者走進控制台。
     上一輪把「條件名」對學生藏起來了（見下方 optgroup 的註解），
     但整份名單一直都在。
     示範模式保留（那是研究者探索平台的沙盒）；一旦按過〈準備施測〉
     （demoSeed === false），學生端就整個收起來——正式施測時每個孩子
     用自己的裝置，本來就不需要切換身分。 */
  const liveRun = state.demoSeed === false;
  const whoWrap = $('#whoWrap');
  /* 「示範資料（模擬班級）」是靜態節點，清場之後還掛在每一頁的頂列——
     真的孩子在真的施測時，每一頁都被告知這是模擬班級，
     與知情同意的文案互相矛盾。 */
  const chip = $('#chipDemo');
  if (chip) chip.style.display = liveRun ? 'none' : '';
  const groups = [
    {label:'教師與管理', users: state.users.filter(function(u){ return u.role !== 'student'; })},
    {label:'學生', byClass: true}
  ];
  sel.innerHTML = groups.map(function(g){
    if (g.byClass){
      return state.classes.map(function(k){
        /* 條件名只給教師與研究者看。對學生印出來，等於在身分下拉裡
           把四個班的分組全部攤開——對照組會直接讀到自己是「無對象」。
           同一支函式已經把 #classWrap 對學生隱藏了，這裡是漏網的那一處。 */
        return '<optgroup label="' + esc(k.name) +
          (isTeacher() ? '（' + esc(condition(k.condition).name) + '）' : '') + '">' +
          k.studentIds.map(function(sid){
            const u = getUser(sid);
            return '<option value="' + u.id + '"' + (u.id === state.ui.role ? ' selected' : '') + '>' +
              esc(u.name) + '</option>';
          }).join('') + '</optgroup>';
      }).join('');
    }
    return '<optgroup label="' + esc(g.label) + '">' + g.users.map(function(u){
      return '<option value="' + u.id + '"' + (u.id === state.ui.role ? ' selected' : '') + '>' +
        esc(u.name) + '（' + roleName(u.role) + '）</option>';
    }).join('') + '</optgroup>';
  }).join('');
  /* 藏起來還不夠：把選項本身也收掉，控制項就算被翻出來也換不了人。
     但「鎖住」不等於「沒有出口」。三道守門的解鎖條件原本都是 isTeacher()，
     而 isTeacher() 讀的是目前選到的身分——清場之後一旦選成學生就恆為 false，
     這台裝置永遠回不到教師端：老師把平板交給下一個孩子、或一開始選錯人，
     現場唯一解法是清瀏覽器資料，那會連同這孩子唯一一份作答與草稿一起銷毀，
     而且代為檢視、評閱、答案卡開關也全部做不到。
     出口在 #/unlock（見下方），不在頂列。 */
  const unlocked = !!(state.ui && state.ui.deviceUnlock);
  if (liveRun && !isTeacher() && !unlocked){
    const meNow = currentUser();
    sel.innerHTML = '<option value="' + meNow.id + '" selected>' + esc(meNow.name) + '</option>';
    sel.disabled = true;
  } else {
    sel.disabled = false;
  }
  /* 這顆鈕已經拿掉。上一輪為了給老師一個出口，在施測狀態下對每一位學生的
     每一頁都長出一顆〈換人〉——那是把出口做成了入口：
       · 剩十分鐘沒事做的孩子最先按的就是與自己名字並排的那顆新鈕
       · 代碼硬編碼成 '1234'，四個班 96 台平板同一組，而且沒有任何 UI 改得動它
       · 輸錯只 toast，沒有次數上限、沒有延遲、不留任何紀錄
       · 猜中之後身分下拉整份攤開：切成別班同學＝當場看到另一個條件的夥伴
         （受試者間設計對兩個孩子同時失效）；切成研究者＝拿得到題庫正解、
         同學的唯讀重播、答案卡開關與〈清場〉
     出口還是要有，但不能長在孩子眼前。改成一條不會被亂按到的路由
     #/unlock（老師知道就好），代碼在清場時產生、可在設定頁看與換，
     連續輸錯會鎖住並加長等待，每一次嘗試都寫進日誌。
     解鎖之後身分下拉才打開。 */
  if (whoWrap) whoWrap.style.display = (liveRun && !isTeacher() && !unlocked) ? 'none' : '';
  const sw = document.getElementById('switchWho');
  if (sw) sw.remove();

  /* 教師視角的班級選擇器（學生看不到） */
  const cw = $('#classWrap');
  if (isTeacher()){
    cw.style.display = '';
    const sel2 = $('#classSel');
    sel2.innerHTML = state.classes.map(function(k){
      return '<option value="' + k.id + '"' + (k.id === state.ui.classId ? ' selected' : '') + '>' +
        esc(k.name) + '　·　' + esc(condition(k.condition).name) + '</option>';
    }).join('');
  } else {
    cw.style.display = 'none';
  }

  /* 代為檢視的出口。學生本人永遠看不到這條橫幅，
     所以不影響四條件的版面幾何。 */
  let bar = document.getElementById('impBar');
  if (isImpersonating()){
    if (!bar){
      bar = document.createElement('div');
      bar.id = 'impBar';
      bar.className = 'imp-bar';
      const main = document.querySelector('.main');
      if (main && main.parentNode) main.parentNode.insertBefore(bar, main);
    }
    bar.innerHTML = '<span>你正在以「' + esc(currentUser().name) + '」的視角檢視（唯讀，' +
      '你的操作不會記到他名下）</span>' +
      '<button class="btn sm" data-act="exit-impersonate">結束檢視，回教師後台</button>';
  } else if (bar){
    bar.remove();
  }
  /* 橫幅出現／消失都會改變頂部帶的總高度，sticky 的偏移量要跟著更新 */
  if (typeof syncTopbarHeight === 'function') syncTopbarHeight();

  renderRail();
}
function roleName(r){ return r === 'admin' ? '管理員' : r === 'teacher' ? '老師' : '學生'; }

/* 深層頁面對應到側欄的哪一個項目。沒有這張表，學生在作答頁時
   側欄不會有任何一項被標成「目前位置」。 */
const RAIL_PARENT = {quiz:'student', result:'student', aal:'student',
  note:'kb', synth:'kb', inspect:'assign', create:'teacher'};

/* 側欄的「派題分析」不要寫死 a-pre——寫死的話，人在後測頁時
   側欄不是點錯項目就是完全不點亮。 */
function latestAssignmentId(){
  const a = state.assignments.slice().sort(function(x, y){ return y.createdAt - x.createdAt; })[0];
  return a ? a.id : 'a-pre';
}

function renderRail(){
  const unread = notesForViewer().filter(isUnread).length;
  const me = currentUser();

  /* 雙軌儀表板永遠只涵蓋知識建構示範班，班級選單在那一頁不作用。
     假的控制項比沒有控制項更傷。放在 renderRail 而不是 renderShell，
     因為只有前者每次換頁都會跑。 */
  /* 白名單，不是黑名單：currentClass() 的消費者只有教師後台與派題分析的
     「理解歷程」分頁，其他頁面都是四班全樣本（共用同一次 Rasch 校準）。
     把下拉修活之後若不限定範圍，它會從一個假控制項變成一個會靜默縮小
     分母的真控制項——那更糟。 */
  const csel = $('#classSel');
  if (csel){
    const live = (ROUTE.name === 'teacher') ||
                 (ROUTE.name === 'assign' && ROUTE.args[1] === 'process');
    csel.disabled = !live;
    const nAll = state.classes.reduce(function(a, c){ return a + c.studentIds.length; }, 0);
    csel.title = live ? ''
      : (ROUTE.name === 'dash'
          ? '這一頁只涵蓋知識建構示範班，班級選單在這裡不作用'
          : (ROUTE.name === 'kb' || ROUTE.name === 'note' || ROUTE.name === 'synth'
          ? '這一頁只涵蓋你自己的班'
          : '這一頁涵蓋四個班共 ' + nAll + ' 人，班級選單在這裡不作用'));
  }

  /* 三種導覽：研究者（super user，看得到全部）、教師（只看教學會用到的四項）、學生。
     研究控制台、建立派題、題庫與系統設定屬於研究者的工具，不進教師的側欄。 */
  const nav = me.role === 'admin' ? [
    {g:'評量'},
    {h:'#/teacher', g2:'教', t:'教師後台'},
    {h:'#/create',  g2:'派', t:'建立派題'},
    {h:'#/assign/' + latestAssignmentId(), g2:'診', t:'派題分析'},
    {g:'評量即學習'},
    {h:'#/research', g2:'研', t:'研究控制台'},
    {g:'知識建構'},
    {h:'#/kb', g2:'構', t:'知識建構空間', b: unread ? unread : null},
    {h:'#/dash', g2:'雙', t:'雙軌評量儀表板'},
    {g:'設定'},
    {h:'#/bank', g2:'庫', t:'文本與題庫'},
    {h:'#/settings', g2:'設', t:'系統設定'},
    {h:'#/about', g2:'說', t:'系統說明與研究設計'}
  ] : me.role === 'teacher' ? [
    {g:'評量'},
    {h:'#/teacher', g2:'教', t:'教師後台'},
    {h:'#/assign/' + latestAssignmentId(), g2:'診', t:'派題分析'},
    {g:'知識建構'},
    {h:'#/kb', g2:'構', t:'知識建構空間', b: unread ? unread : null},
    {h:'#/dash', g2:'雙', t:'雙軌評量儀表板'},
    /* 教師的每一頁都是 θ、SE、Infit、δ，卻是唯一沒有名詞說明入口的角色 */
    {g:'關於'},
    {h:'#/about', g2:'說', t:'名詞說明'}
  ] : [
    {g:'我的學習'},
    {h:'#/student', g2:'業', t:'我的作業'},
    {h:'#/kb', g2:'構', t:'知識建構空間',
     /* 三種原因都要有自己的標示。原本只認 'survey'，把 'class' 折進
        「測驗後開放」——而那個孩子早就交過卷了。字串表在 50-kb.js。 */
     b: kbLocked(me) ? ((kbLockLabel(me) || {}).badge || '測驗後開放')
          : (unread ? unread : null)},
    {h:'#/mygrowth', g2:'長', t:'我的學習軌跡',
     /* 學習軌跡被同一道課後問卷門擋著（86-ui-dash.js 的 viewMyGrowth），
        側欄這一項卻沒有任何徽章，看起來與平常一樣可點——點下去換來一張
        整頁擋板。鎖著就要說出來。 */
     b: (submitted('a-post', me.id) && !surveyOf(me.id, 'post')) ? '問卷後開放' : null},
    {g:'問卷'},
    /* 有草稿就印「寫到一半」而不是「待填」——與作業那一側的狀態語彙一致。 */
    {h:'#/survey/pre',  g2:'前', t:'課前問卷',
     /* 課上完之後就不再標成可補的待辦（見 surveyGate 對 'pre' 的說明） */
     b: surveyOf(me.id, 'pre') ? null
        : (submitted('a-post', me.id) ? '未填'
          : (surveyDraftProgress(me.id, 'pre') ? '寫到一半' : '待填'))},
    {h:'#/survey/post', g2:'後', t:'課後問卷',
     b: surveyOf(me.id, 'post') ? null
        : (submitted('a-post', me.id)
          ? (surveyDraftProgress(me.id, 'post') ? '寫到一半' : '待填')
          : '上完課再填')},
    {g:'關於'},
    {h:'#/about', g2:'說', t:'系統說明'}
  ];
  $('#rail').innerHTML = nav.map(function(n){
    if (n.g) return '<div class="rail-group">' + esc(n.g) + '</div>';
    const parts = n.h.replace(/^#\//, '').split('/');
    /* 深層頁面（作答、結果、單篇貼文、唯讀重播…）在側欄沒有自己的項目，
       要點亮它的來源項目，否則使用者永遠不知道自己在哪一區。 */
    const base = RAIL_PARENT[ROUTE.name] || ROUTE.name;
    const same = base === parts[0] &&
      (parts.length < 2 || base !== ROUTE.name || parts[0] === 'assign' || ROUTE.args[0] === parts[1]);
    const cur = same ? ' aria-current="page"' : '';
    /* 徽章在窄版會被 CSS 隱藏，所以另外給一份只有報讀器聽得到的文字，
       否則「待填」「測驗後開放」這些狀態在手機上等於消失。 */
    const badge = n.b
      ? '<span class="badge" aria-hidden="true">' + esc(String(n.b)) + '</span>' +
        '<span class="sr-only">（' + esc(String(n.b)) + '）</span>'
      : '';
    /* 字符是純裝飾的視覺記號，要藏起來。不藏的話報讀器會把它併進連結名稱，
       念成「業我的作業」「構知識建構空間」「長我的學習軌跡」——
       旁邊的徽章與 procPill() 的形狀記號本來就都 aria-hidden 了，
       只有這一處沒跟上。 */
    return '<a href="' + n.h + '"' + cur + '><span class="glyph" aria-hidden="true">' + n.g2 + '</span>' + esc(n.t) +
      badge + '</a>';
  }).join('');
}

/* --- 共用小元件 --- */
/* 理解歷程標籤。形狀記號與文字並用，不以顏色單獨傳達訊息（WCAG 1.4.1）。 */
function procPill(pid){
  const p = processOf(pid);
  if (!p) return '';
  return '<span class="pill ' + p.cls + '"><span aria-hidden="true">' + p.mark + '</span>' +
    esc(p.name) + '</span>';
}
/* 一道題目的識別標籤：文本 · 理解歷程 · 難度。教師與研究端專用。 */
function itemPills(it){
  if (!it) return '';
  return '<span class="pill">' + esc(textTitle(it.unit)) + '</span>' +
    procPill(it.process) +
    '<span class="pill">' + esc(it.diff) + '</span>';
}
/* 學生看得到的版本：只有文本名。
   歷程標定是相對歷程編碼（RQ4）的判定基準，受試者不該看到基準；
   難度標籤則等於直接告訴學生「這題你大概答不出來」。 */
function itemPillsStudent(it){
  if (!it) return '';
  return '<span class="pill">' + esc(textTitle(it.unit)) + '</span>';
}

function qpill(q, n){
  const Q = QUAD[q];
  return '<span class="pill ' + Q.key + '"><span class="dot"></span>' + Q.roman + ' ' + Q.short +
    (n === undefined ? '' : ' <b class="num">' + n + '</b>') + '</span>';
}
function statCard(k, v, s, cls){
  return '<div class="stat ' + (cls || '') + '"><div class="k">' + esc(k) + '</div>' +
    '<div class="v">' + v + '</div>' + (s ? '<div class="s">' + s + '</div>' : '') + '</div>';
}
function sectionHead(title, sub, right){
  return '<div class="row" style="justify-content:space-between;align-items:flex-end;margin-bottom:14px">' +
    '<div><h2>' + esc(title) + '</h2>' + (sub ? '<div class="muted small">' + esc(sub) + '</div>' : '') + '</div>' +
    '<div class="row">' + (right || '') + '</div></div>';
}
function quadLegend(){
  return '<div class="legend">' + [1,2,3,4].map(function(q){
    return '<span><i class="swatch" style="background:var(--' + QUAD[q].key + ')"></i>' +
      QUAD[q].roman + ' ' + QUAD[q].name + '</span>';
  }).join('') + '</div>';
}

/* --- KIDMAP：個別學生四象限圖 --- */
/* 學生版的四象限用語。同一份資料、同一個幾何，只換說法——
   十歲孩子看不懂 θ、δ (logit)、「迷思象限」，而且「迷思」是個標籤。
   教師端與研究端一律走預設（student=false），計算與匯出一個字不動。 */
const QUAD_STUDENT = {
  1: '比較難，你答對了',
  2: '可惜，你其實讀得懂',
  3: '比較難，這次沒答對',
  4: '你穩穩答對'
};
function quadLegendStudent(){
  return '<div class="legend">' + [1,2,3,4].map(function(q){
    return '<span><i class="swatch" style="background:var(--' + QUAD[q].key + ')"></i>' +
      esc(QUAD_STUDENT[q]) + '</span>';
  }).join('') + '</div>';
}

function kidmapSVG(diag, ps, student){
  const W = 620, H = 400, m = {t:26, r:18, b:34, l:52};
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const ds = diag.perItem.map(function(p){ return p.delta; });
  let lo = Math.min.apply(null, ds.concat([ps.theta])) - 0.7;
  let hi = Math.max.apply(null, ds.concat([ps.theta])) + 0.7;
  if (!isFinite(lo) || !isFinite(hi) || hi - lo < 1){ lo = -3; hi = 3; }
  const Y = function(d){ return m.t + ih * (hi - d) / (hi - lo); };
  const yTheta = Y(ps.theta);
  const xW = m.l + iw * 0.27, xR = m.l + iw * 0.73;

  const parts = [];
  /* role="img" + aria-label 會讓整個子樹變 presentational，
     裡面的象限標籤、刻度與所有資料點文字全部從可及性樹消失。
     改用 title + desc，並在 desc 裡寫出老師真正要的摘要（迷思題號）。 */
  const q2list = ps.cells.filter(function(c){ return c.q === 2; })
    .map(function(c){ return itemLabel(diag.assignment.id, c.iid); });
  const qn = [1,2,3,4].map(function(k){ return ps.cells.filter(function(c){ return c.q === k; }).length; });
  const desc = (student ? '你這次的閱讀地圖：' : 'KIDMAP 四象限圖。能力估計值 θ = ' + fx(ps.theta) + '。')
    + (student ? '' : '優勢概念 ' + qn[0] + ' 題、迷思概念 ' + qn[1] + ' 題、合理答錯 ' + qn[2] +
       ' 題、合理答對 ' + qn[3] + ' 題。')
    + (q2list.length ? (student ? '可惜的題目：' : '落在迷思象限的是：') + q2list.join('、') + '。'
                     : (student ? '這次沒有可惜的題目。' : '沒有題目落在迷思象限。'));
  parts.push('<svg class="kidmap" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-labelledby="kmTitle kmDesc">');
  parts.push('<title id="kmTitle">' + esc(student ? '你這次的閱讀地圖' : 'KIDMAP 四象限圖') + '</title>');
  parts.push('<desc id="kmDesc">' + esc(desc) + '</desc>');
  // 四個象限底色
  parts.push('<rect x="' + m.l + '" y="' + m.t + '" width="' + (iw / 2) + '" height="' + (yTheta - m.t) + '" fill="var(--q3-bg)"/>');
  parts.push('<rect x="' + (m.l + iw / 2) + '" y="' + m.t + '" width="' + (iw / 2) + '" height="' + (yTheta - m.t) + '" fill="var(--q1-bg)"/>');
  parts.push('<rect x="' + m.l + '" y="' + yTheta + '" width="' + (iw / 2) + '" height="' + (m.t + ih - yTheta) + '" fill="var(--q2-bg)"/>');
  parts.push('<rect x="' + (m.l + iw / 2) + '" y="' + yTheta + '" width="' + (iw / 2) + '" height="' + (m.t + ih - yTheta) + '" fill="var(--q4-bg)"/>');
  // 象限標籤
  parts.push('<text class="qlabel" x="' + (m.l + 8) + '" y="' + (m.t + 14) + '" fill="var(--q3)">' + (student ? QUAD_STUDENT[3] : 'III 合理答錯') + '</text>');
  parts.push('<text class="qlabel" x="' + (m.l + iw - 8) + '" y="' + (m.t + 14) + '" text-anchor="end" fill="var(--q1)">' + (student ? QUAD_STUDENT[1] : 'I 優勢概念') + '</text>');
  parts.push('<text class="qlabel" x="' + (m.l + 8) + '" y="' + (m.t + ih - 8) + '" fill="var(--q2)">' + (student ? QUAD_STUDENT[2] : 'II 迷思概念') + '</text>');
  parts.push('<text class="qlabel" x="' + (m.l + iw - 8) + '" y="' + (m.t + ih - 8) + '" text-anchor="end" fill="var(--q4)">' + (student ? QUAD_STUDENT[4] : 'IV 合理答對') + '</text>');
  // 框線與分隔
  parts.push('<rect class="axis" x="' + m.l + '" y="' + m.t + '" width="' + iw + '" height="' + ih + '" fill="none"/>');
  parts.push('<line class="axis" x1="' + (m.l + iw / 2) + '" y1="' + m.t + '" x2="' + (m.l + iw / 2) + '" y2="' + (m.t + ih) + '"/>');
  parts.push('<line class="theta" x1="' + m.l + '" y1="' + yTheta + '" x2="' + (m.l + iw) + '" y2="' + yTheta + '"/>');
  parts.push('<text x="' + (m.l + iw + 4) + '" y="' + (yTheta + 4) + '" fill="var(--accent)">' + (student ? '你' : 'θ') + '</text>');
  // δ 刻度
  for (let v = Math.ceil(lo); v <= Math.floor(hi); v++){
    parts.push('<line class="axis" x1="' + (m.l - 4) + '" y1="' + Y(v) + '" x2="' + m.l + '" y2="' + Y(v) + '"/>');
    if (!student) parts.push('<text x="' + (m.l - 8) + '" y="' + (Y(v) + 3) + '" text-anchor="end">' + v + '</text>');
  }
  parts.push('<text x="' + (m.l - 40) + '" y="' + (m.t + ih / 2) + '" transform="rotate(-90 ' + (m.l - 40) + ' ' + (m.t + ih / 2) + ')" text-anchor="middle">' + (student ? '題目的難度（上面比較難）' : '試題難度 δ (logit)') + '</text>');
  parts.push('<text x="' + xW + '" y="' + (H - 12) + '" text-anchor="middle">答錯</text>');
  parts.push('<text x="' + xR + '" y="' + (H - 12) + '" text-anchor="middle">答對</text>');
  // 資料點
  const used = {};
  ps.cells.forEach(function(c){
    const base = c.correct ? xR : xW;
    const key = Math.round(Y(c.delta) / 12);
    used[key] = (used[key] || 0);
    const off = (used[key] % 5 - 2) * 26;
    used[key]++;
    const cx = base + off, cy = Y(c.delta);
    const col = 'var(--' + QUAD[c.q].key + ')';
    parts.push('<circle cx="' + cx + '" cy="' + cy + '" r="9" fill="' + col + '" fill-opacity="0.9" stroke="var(--card)" stroke-width="1.5"><title>第 ' +
      displayNo(diag.assignment.id, c.iid) + ' 題 · ' + (student ? QUAD_STUDENT[c.q]
        : QUAD[c.q].name + ' · δ=' + fx(c.delta) + ' · 預期答對率 ' + pct(c.p)) + '</title></circle>');
    parts.push('<text x="' + cx + '" y="' + (cy + 3.2) + '" text-anchor="middle" fill="var(--card)" class="dotno">' +
      displayNo(diag.assignment.id, c.iid) + '</text>');
  });
  parts.push('</svg>');
  return parts.join('');
}

/* --- 直方圖（成績分佈） --- */
function histSVG(values, bins, label){
  const W = 460, H = 170, m = {t:10, r:10, b:26, l:28};
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const lo = 0, hi = Math.max.apply(null, values.concat([1]));
  const nb = bins || 10;
  const counts = new Array(nb).fill(0);
  values.forEach(function(v){ const k = Math.min(nb - 1, Math.floor((v - lo) / (hi - lo || 1) * nb)); counts[k]++; });
  const mx = Math.max.apply(null, counts.concat([1]));
  const bw = iw / nb;
  const p = ['<svg class="kidmap" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(label || '分佈') + '">'];
  counts.forEach(function(c, i){
    const h = ih * c / mx;
    p.push('<rect x="' + (m.l + i * bw + 1) + '" y="' + (m.t + ih - h) + '" width="' + (bw - 2) + '" height="' + h +
      '" fill="var(--accent)" fill-opacity="0.75"><title>' + Math.round(lo + (hi - lo) * i / nb) + '–' +
      Math.round(lo + (hi - lo) * (i + 1) / nb) + '：' + c + ' 人</title></rect>');
  });
  p.push('<line class="axis" x1="' + m.l + '" y1="' + (m.t + ih) + '" x2="' + (m.l + iw) + '" y2="' + (m.t + ih) + '"/>');
  p.push('<text x="' + m.l + '" y="' + (H - 8) + '">0</text>');
  p.push('<text x="' + (m.l + iw) + '" y="' + (H - 8) + '" text-anchor="end">' + Math.round(hi) + '</text>');
  p.push('<text x="' + (m.l + iw / 2) + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(label || '') + '</text>');
  p.push('</svg>');
  return p.join('');
}

/* --- 折線圖 --- */
function lineSVG(points, o){
  o = o || {};
  const W = o.w || 460, H = o.h || 180, m = {t:12, r:14, b:26, l:34};
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  if (!points.length) return '<div class="muted small">尚無資料</div>';
  const xs = points.map(function(p){ return p.x; }), ys = points.map(function(p){ return p.y; });
  const x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
  const y0 = 0, y1 = Math.max.apply(null, ys) * 1.1 || 1;
  const X = function(v){ return m.l + iw * (x1 === x0 ? 0.5 : (v - x0) / (x1 - x0)); };
  const Y = function(v){ return m.t + ih * (1 - (v - y0) / (y1 - y0)); };
  const d = points.map(function(p, i){ return (i ? 'L' : 'M') + X(p.x).toFixed(1) + ' ' + Y(p.y).toFixed(1); }).join(' ');
  const area = d + ' L' + X(points[points.length - 1].x).toFixed(1) + ' ' + (m.t + ih) + ' L' + X(points[0].x).toFixed(1) + ' ' + (m.t + ih) + ' Z';
  const p = ['<svg class="kidmap" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.label || '趨勢') + '">'];
  p.push('<path d="' + area + '" fill="var(--accent)" fill-opacity="0.10"/>');
  p.push('<path d="' + d + '" fill="none" stroke="var(--accent)" stroke-width="1.8"/>');
  const last = points[points.length - 1];
  p.push('<circle cx="' + X(last.x) + '" cy="' + Y(last.y) + '" r="4" fill="var(--accent)"/>');
  p.push('<line class="axis" x1="' + m.l + '" y1="' + (m.t + ih) + '" x2="' + (m.l + iw) + '" y2="' + (m.t + ih) + '"/>');
  p.push('<text x="' + m.l + '" y="' + (H - 8) + '">' + esc(o.x0 || '') + '</text>');
  p.push('<text x="' + (m.l + iw) + '" y="' + (H - 8) + '" text-anchor="end">' + esc(o.x1 || '') + '</text>');
  p.push('<text x="' + (m.l - 6) + '" y="' + (m.t + 8) + '" text-anchor="end">' + Math.round(y1) + '</text>');
  p.push('</svg>');
  return p.join('');
}

/* --- 社會網絡圖（環形佈局） --- */
function snaSVG(g){
  const W = 620, H = 620, cx = W / 2, cy = H / 2, R = 240;
  const n = g.ids.length;
  const pos = {};
  g.ids.forEach(function(id, i){
    const a = -Math.PI / 2 + 2 * Math.PI * i / n;
    pos[id] = {x: cx + R * Math.cos(a), y: cy + R * Math.sin(a), a: a};
  });
  const p = ['<svg class="sna" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="知識建構延伸網絡">'];
  g.edges.forEach(function(e){
    const a = pos[e.from], b = pos[e.to];
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const k = 0.28;
    const qx = cx + (mx - cx) * (1 - k), qy = cy + (my - cy) * (1 - k);
    p.push('<path d="M' + a.x.toFixed(1) + ' ' + a.y.toFixed(1) + ' Q' + qx.toFixed(1) + ' ' + qy.toFixed(1) +
      ' ' + b.x.toFixed(1) + ' ' + b.y.toFixed(1) + '" fill="none" stroke="var(--accent)" stroke-opacity="' +
      Math.min(0.75, 0.25 + e.w * 0.2) + '" stroke-width="' + Math.min(4, e.w * 1.2) + '"><title>' +
      esc(userName(e.from)) + ' 延伸 ' + esc(userName(e.to)) + '（' + e.w + ' 次）</title></path>');
  });
  g.ids.forEach(function(id){
    const d = g.deg[id], tot = d.in + d.out;
    const r = 5 + Math.min(11, tot * 1.6);
    const col = tot === 0 ? 'var(--ink-4)' : (d.in >= d.out ? 'var(--q1)' : 'var(--q4)');
    const q = pos[id];
    p.push('<circle cx="' + q.x.toFixed(1) + '" cy="' + q.y.toFixed(1) + '" r="' + r + '" fill="' + col +
      '"><title>' + esc(userName(id)) + '：延伸他人 ' + d.out + ' 次、被延伸 ' + d.in + ' 次</title></circle>');
    const lx = cx + (R + 26) * Math.cos(q.a), ly = cy + (R + 26) * Math.sin(q.a);
    const anchor = Math.cos(q.a) > 0.2 ? 'start' : (Math.cos(q.a) < -0.2 ? 'end' : 'middle');
    p.push('<text x="' + lx.toFixed(1) + '" y="' + (ly + 3).toFixed(1) + '" text-anchor="' + anchor + '">' + esc(userName(id)) + '</text>');
  });
  p.push('</svg>');
  return p.join('');
}

/* --- 雙軌散布圖 --- */
function dualSVG(dt){
  const W = 620, H = 420, m = {t:22, r:20, b:40, l:52};
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const rows = dt.rows.filter(function(r){ return r.delta != null; });
  if (!rows.length) return '<div class="muted small">需要前測與後測都完成才能繪製。</div>';
  const ds = rows.map(function(r){ return r.delta; });
  const lo = Math.min.apply(null, ds) - 0.2, hi = Math.max.apply(null, ds) + 0.2;
  const X = function(v){ return m.l + iw * (v - lo) / (hi - lo || 1); };
  const Y = function(v){ return m.t + ih * (1 - v / 100); };
  const xm = X(dt.dmed), ym = Y(dt.kmed);
  const p = ['<svg class="kidmap" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="雙軌評量散布圖">'];
  p.push('<rect x="' + m.l + '" y="' + m.t + '" width="' + (xm - m.l) + '" height="' + (ym - m.t) + '" fill="var(--q2-bg)"/>');
  p.push('<rect x="' + xm + '" y="' + m.t + '" width="' + (m.l + iw - xm) + '" height="' + (ym - m.t) + '" fill="var(--q1-bg)"/>');
  p.push('<rect x="' + m.l + '" y="' + ym + '" width="' + (xm - m.l) + '" height="' + (m.t + ih - ym) + '" fill="var(--q3-bg)"/>');
  p.push('<rect x="' + xm + '" y="' + ym + '" width="' + (m.l + iw - xm) + '" height="' + (m.t + ih - ym) + '" fill="var(--q4-bg)"/>');
  p.push('<text class="qlabel" x="' + (m.l + 8) + '" y="' + (m.t + 14) + '" fill="var(--q2)">B 論述未轉化</text>');
  p.push('<text class="qlabel" x="' + (m.l + iw - 8) + '" y="' + (m.t + 14) + '" text-anchor="end" fill="var(--q1)">A 共構轉化</text>');
  p.push('<text class="qlabel" x="' + (m.l + 8) + '" y="' + (m.t + ih - 8) + '" fill="var(--q3)">D 需要介入</text>');
  p.push('<text class="qlabel" x="' + (m.l + iw - 8) + '" y="' + (m.t + ih - 8) + '" text-anchor="end" fill="var(--q4)">C 個別成長</text>');
  p.push('<rect class="axis" x="' + m.l + '" y="' + m.t + '" width="' + iw + '" height="' + ih + '" fill="none"/>');
  p.push('<line class="theta" x1="' + xm + '" y1="' + m.t + '" x2="' + xm + '" y2="' + (m.t + ih) + '"/>');
  p.push('<line class="theta" x1="' + m.l + '" y1="' + ym + '" x2="' + (m.l + iw) + '" y2="' + ym + '"/>');
  rows.forEach(function(r){
    const x = X(r.delta), y = Y(r.kbi);
    p.push('<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="6" fill="var(--' + DUAL_ZONE[r.zone].cls +
      ')" fill-opacity="0.9" stroke="var(--card)" stroke-width="1.4"><title>' + esc(userName(r.sid)) +
      '　Δθ=' + fx(r.delta) + '　KB 指數=' + r.kbi + '　' + DUAL_ZONE[r.zone].name + '</title></circle>');
  });
  p.push('<text x="' + (m.l + iw / 2) + '" y="' + (H - 10) + '" text-anchor="middle">能力變化 Δθ（後測 − 前測，logit）</text>');
  p.push('<text x="18" y="' + (m.t + ih / 2) + '" transform="rotate(-90 18 ' + (m.t + ih / 2) + ')" text-anchor="middle">知識建構指數（0–100）</text>');
  p.push('<text x="' + (m.l - 8) + '" y="' + (m.t + 8) + '" text-anchor="end">100</text>');
  p.push('<text x="' + (m.l - 8) + '" y="' + (m.t + ih) + '" text-anchor="end">0</text>');
  p.push('</svg>');
  return p.join('');
}

/* --- 四象限橫條（每題） --- */
/* 7px 高的四色橫條原本是空的儲存格：報讀器聽不到任何東西，
   辨色困難的人也讀不出比例。補 aria-label 與一行數字。 */
function quadBar(q, n){
  if (!n) return '<div class="bar"></div>';
  const seg = [2,1,3,4].map(function(k){
    const w = 100 * q[k] / n;
    return w > 0 ? '<i style="width:' + w + '%;background:var(--' + QUAD[k].key + ')"></i>' : '';
  }).join('');
  const label = '四象限分佈：優勢概念 ' + q[1] + ' 題、迷思概念 ' + q[2] + ' 題、' +
    '合理答錯 ' + q[3] + ' 題、合理答對 ' + q[4] + ' 題，共 ' + n + ' 題';
  return '<div class="bar" style="display:flex" role="img" aria-label="' + esc(label) + '">' + seg + '</div>' +
    '<div class="small muted" aria-hidden="true" style="margin-top:2px">I ' + q[1] +
    '・II ' + q[2] + '・III ' + q[3] + '・IV ' + q[4] + '</div>';
}

/* --- AI 輸出區塊 --- */
function aiBlock(id, title, hint){
  return '<div class="card"><div class="card-h"><h3>' + esc(title) + '</h3>' +
    '<span class="pill">' + esc(engineLabel()) + '</span>' +
    '<button class="btn sm" data-act="' + esc(id) + '">開始分析</button></div>' +
    '<div class="card-p"><div id="out-' + esc(id) + '" class="muted small">' + esc(hint || '') + '</div></div></div>';
}
async function runAI(outId, fn, force){
  const box = document.getElementById('out-' + outId);
  if (!box) return;
  box.innerHTML = '<span class="muted small">分析中……</span>';
  try {
    const txt = await fn(force);
    box.className = 'ai-out';
    box.innerHTML = md(txt) +
      '<hr class="hr"><div class="row"><button class="btn sm" data-act="rerun-' + outId + '">重新分析（覆蓋快取）</button>' +
      '<span class="muted small">引擎：' + esc(engineLabel()) + '</span></div>';
  } catch (e) {
    box.className = 'ai-out';
    box.innerHTML = '<p><strong>分析失敗</strong></p><p>' + esc(e.message) + '</p>' +
      '<p class="muted small">你仍然可以在「系統設定」把引擎切回<strong>內建規則引擎</strong>，所有分析功能都能離線運作。</p>';
  }
}

/* ==========================================================================
   頁面標題
   這是雜湊路由的單頁應用，涵蓋 18 條路由，而文件標題自始至終是「KAIROS」，
   render() 從頭到尾沒有寫過 document.title。換頁時唯一的訊號是把焦點送到
   #stage，而它是一個沒有 aria-label 的 <main>，可及名稱為空——報讀器只會
   播報「主要地標」。好幾條路徑還會在孩子不知情的情況下換掉目的地
   （entryGate 的前置門檻、交卷後 rerouteInRender 轉去成績頁、surveyGate 的
   擋板、viewSurvey 用 replaceState 改寫頁碼），而這些轉向產生的訊號與正常
   抵達完全相同。WCAG 2.4.2（A 級）。
   rerouteInRender 會在轉向之後覆寫 ROUTE，所以這一支放在 render() 結尾、
   讀最終的 ROUTE，標題與畫面永遠是同一頁。
   ========================================================================== */
/* 教師端與研究端的作業顯示名：學生端的中性名稱 + 研究標記。
   學生端一律直接用 a.title（見 30-data.js 的 rlabel 註解）。 */
function assignmentLabel(a){
  if (!a) return '';
  return a.title + (a.rlabel ? '（' + a.rlabel + '）' : '');
}

const PAGE_TITLES = {
  teacher:'教師後台', create:'建立派題', assign:'派題分析',
  kb:'知識建構空間', note:'貼文', synth:'想法串綜整',
  dash:'雙軌評量儀表板', bank:'文本與題庫', settings:'系統設定',
  about:'名詞說明', unlock:'切換身分', research:'研究控制台',
  /* 學生端的分頁標題也不可以印研究構念（見 30-data.js 的 rlabel 註解）。
     唯讀重播只有教師走得到，維持原名。 */
  aal:'閱讀活動作答', inspect:'唯讀重播',
  student:'我的作業', quiz:'閱讀活動作答', result:'我的成績', mygrowth:'我的學習軌跡'
};
function pageTitleFor(route){
  const r = route || ROUTE;
  if (r.name === 'survey') return r.args[0] === 'pre' ? '課前問卷' : '課後問卷';
  if (r.name === 'teacher' && !isTeacher()) return PAGE_TITLES.student;
  return PAGE_TITLES[r.name] || '找不到這一頁';
}
function syncPageTitle(){
  const t = pageTitleFor(ROUTE);
  try { document.title = t + '｜KAIROS'; } catch (e) {}
  /* #stage 是換頁後焦點的落點，要有名字才播報得出來。 */
  const stage = document.getElementById('stage');
  if (stage) stage.setAttribute('aria-label', t);
}
