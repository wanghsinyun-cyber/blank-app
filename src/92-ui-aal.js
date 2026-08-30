/* ==========================================================================
   92-ui-aal.js — 評量即學習事件的作答介面
   版面：左＝題幹（逐句可標記）＋計算紙；右＝作答區＋AI 夥伴對話區。
   四條件共用同一份版面幾何，對照組僅把對話區換成同尺寸的「我的筆記」。
   ========================================================================== */

let AAL = null;
/* 上一次離開作答頁的方式。分析端要分得開「同一次上課中途離開再回來」
   與「重整或換裝置」——後者的 rel 時間軸斷得比較徹底。 */
let AAL_LEFT_VIA = 'reload';

/* 作答草稿。刻意用獨立的 localStorage key，不擠進 50-kb.js 的 save()——
   那一支會靜默吞掉配額錯誤，而學生的 16 題作答不能靜默遺失。 */
const AAL_DRAFT_KEY = 'kairos-draft';

function aalDraftId(){ return AAL.aid + '|' + AAL.me; }

/* 某位學生在某一份作業上留下的草稿（不需要 AAL 正在執行也讀得到）。
   作業卡片要靠它分辨「還沒開始」與「寫到一半」——原本兩者都印
   「尚未作答」，按鈕都寫「開始這節課」，對已經寫了十二題的孩子而言
   兩句話都是假的，而且「開始」聽起來像要從頭來過。 */
function aalDraftOf(aid, sid){
  try {
    const all = JSON.parse(localStorage.getItem(AAL_DRAFT_KEY) || '{}');
    return all[aid + '|' + sid] || null;
  } catch (e) { return null; }
}
/* 草稿裡已經寫了幾題（選擇題有選 + 非選題有字） */
function aalDraftProgress(aid, sid){
  const d = aalDraftOf(aid, sid);
  if (!d) return 0;
  const picked = Object.keys(d.answers || {}).filter(function(k){
    return d.answers[k] !== undefined && d.answers[k] !== null; }).length;
  const written = Object.keys(d.texts || {}).filter(function(k){
    return String(d.texts[k] || '').trim(); }).length;
  return picked + written;
}

function aalSave(){
  if (isImpersonating()) return;
  if (!AAL) return;
  try {
    const all = JSON.parse(localStorage.getItem(AAL_DRAFT_KEY) || '{}');
    /* tele 與 drafts 要存（重整後遙測才接得起來），turns 不存——
       對話回合是三個 AI 條件的劑量控制，放進 localStorage 等於把劑量
       交給學生的瀏覽器：清掉網站資料就能重新領 6 次。額度改由已落地的
       state.dialog 推導，見 aalStudentTurns()。 */
    all[aalDraftId()] = {idx:AAL.idx, answers:AAL.answers, texts:AAL.texts, notes:AAL.notes,
                         marks:AAL.marks, checks:AAL.checks,
                         tele:AAL.tele, drafts:AAL.drafts, savedAt:Date.now()};
    localStorage.setItem(AAL_DRAFT_KEY, JSON.stringify(all));
    aalSave._fails = 0;
    AAL.dirty = false;
  } catch (e) {
    AAL.dirty = true;   // beforeunload 的守門條件
    /* 加了 tele/drafts 之後這個 key 會變大，配額問題不再是偶發。
       連續兩次失敗就停掉自動存檔並常駐警示，不要只 toast 一次。 */
    aalSave._fails = (aalSave._fails || 0) + 1;
    if (aalSave._fails >= 2){
      AAL._saveOff = true;
      const b = document.getElementById('aalSaveWarn');
      if (b) b.hidden = false;
    }
    toast('這一題沒能存起來，先不要關掉分頁。');
  }
}

function aalDropDraft(){
  try {
    const all = JSON.parse(localStorage.getItem(AAL_DRAFT_KEY) || '{}');
    delete all[aalDraftId()];
    localStorage.setItem(AAL_DRAFT_KEY, JSON.stringify(all));
  } catch (e) {}
}

function aalInit(aid){
  const a = getAssignment(aid);
  const me = currentUser();
  AAL = {
    aid: aid, me: me.id,
    cond: conditionOfStudent(me.id),
    idx: 0,
    items: a.itemIds.map(getItem).filter(Boolean),
    answers: {}, texts: {}, notes: {}, marks: {}, checks: {},
    tele: {}, drafts: {}, t0: Date.now()
  };
  /* 還原草稿。t0 一定重設為現在，並補寫一筆 RESUME，
     讓分析端知道這一場的 rel 時間軸跨了兩次入座、可以排除或另計。 */
  try {
    const all = JSON.parse(localStorage.getItem(AAL_DRAFT_KEY) || '{}');
    const d = all[aalDraftId()];
    if (d){
      AAL.idx = Math.min(d.idx || 0, AAL.items.length - 1);
      AAL.answers = d.answers || {};
      AAL.texts   = d.texts   || {};
      AAL.notes   = d.notes   || {};
      AAL.marks   = d.marks   || {};
      AAL.checks  = d.checks  || {};
      AAL.tele    = d.tele    || {};
      AAL.drafts  = d.drafts  || {};
      /* 每一題的 enter 重設為現在。不重設的話，離線的那幾個小時會被
         算進 firstKeyLatency，產生沒有意義的離群值。 */
      Object.keys(AAL.tele).forEach(function(iid){ AAL.tele[iid].enter = Date.now(); });
      AAL.t0 = Date.now();
      aalLog('RESUME', 'R', {resumed:true, via:AAL_LEFT_VIA, savedAt:d.savedAt || null});
      AAL_LEFT_VIA = 'reload';
    }
  } catch (e) { /* 草稿壞掉就當作沒有，從頭開始 */ }

  /* 標記和對話回合是同一個形狀：兩本帳。
     學生端讀 localStorage 的草稿，教師端的唯讀重播讀事件日誌，
     兩邊會講不同的話——實測標了第 1、3、5 句又取消第 3 句之後，
     學生的畫面是 [0,4]、老師看到的是 [0,1,4]。
     清掉瀏覽器資料或換一台平板更嚴重：孩子看到 0 句標記、老師看到 5 句，
     而畫面上沒有任何線索說明誰才是對的。
     依 aalDialogOf 已經確立的原則（額度與語料以已落地的紀錄為單一真相來源），
     標記一律從日誌重建，草稿只是便利。 */
  try {
    AAL.marks = {};
    (AAL.items || []).forEach(function(i){
      if (AAL.marks[i.unit]) return;
      AAL.marks[i.unit] = inspectMarks(AAL.me, AAL.aid, i.unit).map(Number);
    });
  } catch (e) { AAL.marks = AAL.marks || {}; }
}

function aalItem(){ return AAL.items[AAL.idx]; }
/* 額度與語料是同一份帳：都以已落地的 state.dialog 為單一真相來源。
   曾經有一份記憶體裡的 AAL.turns 與它並存，額度改讀 state.dialog 之後
   畫面卻還在讀 AAL.turns——重整後對話從畫面消失、額度照扣。
   那個暫存已經整個拿掉，不要再加回來。 */
function aalDialogOf(iid){
  return (state.dialog || []).filter(function(d){
    return d.sid === AAL.me && d.aid === AAL.aid && d.iid === iid;
  }).sort(function(a, b){ return (a.t || 0) - (b.t || 0); });
}
function aalStudentTurns(iid){
  return aalDialogOf(iid).filter(function(d){ return d.speaker === 'student'; }).length;
}
function aalTele(iid){
  return AAL.tele[iid] = AAL.tele[iid] || {firstKeyLatency:null, keystrokes:0, deletions:0,
    longPauses:0, lastKey:null, enter:Date.now(), prevLen:0};
}

/* itemArg 是給去抖／節流回呼用的：回呼醒來時學生可能已經翻到下一題，
   aalItem() 會抓到新題，把上一題的事件記到別題的 iid 與 proc 上。
   末位參數，不影響既有呼叫端。 */
function aalLog(type, code, extra, itemArg){
  /* 代為檢視時一律不寫日誌：老師的操作不可以進到學生的歷程資料裡 */
  if (isImpersonating()) return {};
  const it = itemArg || aalItem();
  const k = classOfStudent(AAL.me);
  const e = {t:Date.now(), rel:Date.now() - AAL.t0, sid:AAL.me, cid:k ? k.id : null,
             cond:AAL.cond, lang:'zh', aid:AAL.aid, iid:it.id, proc:it.process || 'FR',
             type:type, code:code};
  if (extra) Object.keys(extra).forEach(function(x){ e[x] = extra[x]; });
  logEvent(e);
  return e;
}

function viewAaL(aid){
  const a = getAssignment(aid);
  const me = currentUser();
  if (!a) return '<div class="empty"><h3>找不到這個評量事件</h3><a class="btn" href="#/student">回我的作業</a></div>';
  if (me.role !== 'student') return '<div class="empty"><h3>請切換成學生身分</h3>' +
    '<p>評量即學習事件是學生端的畫面。用右上角的身分選單換成班上任何一位同學，就會看到他被分派到的條件。</p></div>';
  if (submitted(aid, me.id)) { go('#/result/' + aid); return ''; }
  if (!AAL || AAL.aid !== aid || AAL.me !== me.id) aalInit(aid);

  const it = aalItem();
  const cond = condition(AAL.cond);
  const text = getText(it.unit);
  const sents = passageSentences(text);
  // 標記是「對這篇文本」的，換題不會消失——學生在同一篇文章上持續累積閱讀痕跡
  const marks = AAL.marks[it.unit] = AAL.marks[it.unit] || [];
  const turns = aalDialogOf(it.id);
  const used = aalStudentTurns(it.id);
  const maxT = (state.settings && state.settings.maxTurns) || MAX_TURNS;
  const proc = processOf(it.process || 'FR');

  return '<div class="row" style="justify-content:space-between;align-items:flex-end;margin-bottom:12px">' +
      '<div><h2>' + esc(a.title) + '</h2>' +
      /* 不在學生畫面印出實驗條件名。條件資訊由畫面本身承載
         （右欄卡片頭已經是「我的夥伴：…」或「我的筆記」），
         印出「無對象」等於直接告訴對照組他被分到哪一組。
         AAL.cond 與日誌的 cond 欄位照舊寫入，拿掉的只是畫面上的字。 */
      '<div class="muted small">' + esc(me.name) + '　·　' +
      esc((classOfStudent(me.id) || {}).name || '') + '</div></div>' +
      /* tabindex="-1"：〈回到題目導覽〉的焦點落在這個容器上，
         而不是落在某一顆按鈕。落在容器上，下一次 Tab 才依序碰到
         〈上一題〉〈下一題〉〈交卷〉——不會讓鍵盤使用者一按 Enter 就交卷。 */
      '<div class="row" id="aalNav" tabindex="-1">' +
      '<button class="btn sm" data-act="aal-leave">← 先離開（進度會保留）</button>' +
      '<span class="pill">第 ' + (AAL.idx + 1) + ' / ' + AAL.items.length + ' 題</span>' +
      '<span class="pill">' + esc(text.title) + '</span>' +
      '<button class="btn sm" data-act="aal-prev"' + (AAL.idx ? '' : ' disabled') + '>← 上一題</button>' +
      '<button class="btn sm" data-act="aal-next"' + (AAL.idx < AAL.items.length - 1 ? '' : ' disabled') + '>下一題 →</button>' +
      '<button class="btn primary sm" data-act="aal-submit">交卷</button></div>' +
    '</div>' +

    '<div class="aal">' +
    /* ---- 左欄：文本，逐句可標記 ---- */
    /* 一篇文章有 30–40 句，每一句都是可聚焦的按鈕。沒有這顆跳躍鈕，
       鍵盤使用者要按幾十次 Tab 才走得到作答區（WCAG 2.4.1）。 */
    '<div class="aal-text card">' +
      '<button class="skip" data-act="skip-passage" type="button">跳過文章，直接作答</button>' +
      '<div class="card-h"><h3 id="passageTitle" tabindex="-1">' + esc(text.title) + '</h3>' +
      '<span class="pill">' + esc(text.genre) + '</span>' +
      '<span class="pill" id="markCount"' + (marks.length ? '' : ' hidden') + '>已標記 ' +
      '<span id="markCountN">' + marks.length + '</span> 句</span></div>' +
      '<div class="card-p">' +
      /* 隱私要講實話：老師在唯讀重播裡看得到學生標了哪幾句。 */
      '<p class="muted small" id="passageHelp">點一下任何一句，把它標記起來。' +
      '標記不會影響你的分數，換題也不會消失；每一篇文章的標記分開記。' +
      '老師之後可以看到你標了哪幾句，這是為了知道你怎麼讀。</p>' +
      '<div class="passage" role="group" aria-labelledby="passageTitle" aria-describedby="passageHelp">' +
        text.paras.map(function(_, pi){
          return '<p class="para">' + sents.filter(function(s){ return s.para === pi; }).map(function(s){
            const on = marks.indexOf(s.i) >= 0;
            return '<button type="button" class="sent' + (on ? ' on' : '') + '"' +
              ' data-act="aal-mark" data-i="' + s.i + '" aria-pressed="' + on + '">' +
              esc(s.text) + '</button>';
          }).join('') + '</p>';
        }).join('') +
      '</div>' +
    '</div></div>' +

    /* ---- 右欄：題目與作答 ＋ 對話／筆記 ---- */
    '<div class="aal-side">' +
      /* 不對學生顯示歷程標籤：那是相對歷程編碼的判定基準，
         受試者看到基準等於拿到解題策略提示。 */
      '<div class="card" id="aalAnswer" tabindex="-1"><div class="card-h"><h3>第 ' + (AAL.idx + 1) + ' 題</h3></div>' +
      '<div class="card-p">' +
      '<div class="stem">' + esc(it.stem) + '</div>' +
      (it.type === 'mc'
        ? '<fieldset class="opts"><legend class="sr-only">' + esc(it.stem) + '</legend>' + it.options.map(function(o, k){
            const on = AAL.answers[it.id] === k;
            /* 選中態除了底色，字母後面加一個 ✓：不以顏色單獨傳達訊息（1.4.1） */
            return '<label class="opt' + (on ? ' chosen' : '') + '">' +
              '<input type="radio" name="aal-' + it.id + '" data-act="aal-pick" data-k="' + k + '"' +
              (on ? ' checked' : '') + '>' +
              '<b aria-hidden="true">' + String.fromCharCode(65 + k) + (on ? '✓' : '') +
              '</b><span>' + esc(o) + '</span></label>';
          }).join('') + '</fieldset>' +
          /* 原本這句是 sr-only，而且說「停在你要的答案上就算選好」——
             那是錯的：原生 radiogroup 在一顆都沒選時，Tab 進來會把焦點
             放在第一顆但不勾選它。照著做的孩子那一題是空白的，
             而想選 B/C/D 的必須按方向鍵、反而被正確記錄——
             這個缺陷只吃掉 A 的作答，是只打在鍵盤使用者身上的系統性失分。
             改文案與可見性就好，不要「讓 focus 等於選取」：那會把漏答
             換成錯答，還會用純導覽動作汙染 drafts 的「第一次判斷」。 */
          /* 這句原本只講鍵盤。而這套系統要在教室的平板上跑——
             平板沒有方向鍵也沒有空白鍵，畫面上唯一的操作說明
             講的是他做不到的事，而且完全沒提可以用點的。
             點選寫在前面（那是多數孩子的路徑），鍵盤寫在後面。 */
          '<p class="muted small" style="margin-top:6px">直接點你要的答案就可以。' +
          '用鍵盤的話，上下方向鍵移動、空白鍵選起來。</p>'
        : '<div class="field"><label for="crText">寫出你的答案，並說明你的理由</label>' +
          '<textarea id="crText" data-act="aal-text" style="min-height:160px" ' +
          'placeholder="先寫你的看法，再寫你是從文章哪一段看出來的">' +
          esc(AAL.texts[it.id] || '') + '</textarea></div>') +
      '</div></div>' +

      (AAL.cond === 'control' ? aalNotePane(it) : aalDialogPane(it, cond, turns, used, maxT)) +

      '<div class="card"><div class="card-h"><h3>送出前自我檢核</h3>' +
        '<span class="muted small">勾不勾由你決定</span></div><div class="card-p col">' +
        SELF_CHECKS.map(function(c, i){
          const on = (AAL.checks[it.id] || []).indexOf(i) >= 0;
          return '<label class="opt" style="align-items:center"><input type="checkbox" data-act="aal-check" data-i="' + i + '"' +
            (on ? ' checked' : '') + '><span>' + esc(c) + '</span></label>';
        }).join('') +
        /* 去程有「跳過文章，直接作答」，回程原本沒有對稱出口：
           從最後一個自我檢核回到〈下一題〉要按 54 次 Shift+Tab，
           中途逐顆停在句子鈕上——順手按 Enter 就寫一筆 MARK 事件，
           汙染閱讀歷程資料。 */
        '<button class="skip" data-act="back-to-passage" type="button">回到文章</button>' +
        '<button class="skip" data-act="back-to-nav" type="button">回到題目導覽</button>' +
      '</div></div>' +
    '</div></div>';
}

function aalDialogPane(it, cond, turns, used, maxT){
  const left = maxT - used;
  return '<div class="card aal-chat"><div class="card-h">' +
    '<h3>我的夥伴：' + esc(cond.name) + '</h3>' +
    '<span class="pill">還可以說 <span id="turnLeft">' + Math.max(0, left) + '</span> 次</span></div>' +
    '<div class="card-p">' +
    /* role="log" + aria-live：AI 的回覆是非同步送達的，
       沒有這兩個屬性，報讀器使用者永遠不知道夥伴回話了。 */
    '<div class="chat" id="aalChat" role="log" aria-live="polite" aria-relevant="additions"' +
    ' aria-label="我和夥伴的對話" tabindex="0">' +
      '<div class="msg agent"><b>' + esc(cond.name) + '</b>' + esc(cond.frame) + '</div>' +
      turns.map(function(t){
        return '<div class="msg ' + (t.speaker === 'student' ? 'me' : 'agent') + '">' +
          (t.speaker === 'agent' ? '<b>' + esc(cond.name) + '</b>' : '') + esc(t.text) + '</div>';
      }).join('') +
      (left <= 0 ? '<div class="msg sys">這一題的對話次數用完了。換下一題會重新計算。</div>' : '') +
    '</div>' +
    /* 代為檢視時輸入框也要鎖上。只在送出時擋的話，老師會打完一整段才被拒絕。 */
    '<label class="sr-only" for="aalSay">對夥伴說一句話</label>' +
    '<div class="row pane-bar" style="margin-top:10px;gap:6px">' +
      '<input type="text" id="aalSay" placeholder="' +
        (isImpersonating() ? '代為檢視中，不能替學生說話'
                           : (left > 0 ? '說說你現在的想法…' : '這一題已經聊完了')) +
      '"' + (left > 0 && !isImpersonating() ? '' : ' disabled') + ' style="flex:1">' +
      '<button class="btn primary sm" data-act="aal-say"' +
        (left > 0 && !isImpersonating() ? '' : ' disabled') + '>送出</button>' +
    '</div>' +
    '<p class="muted small pane-foot" style="margin-top:8px">陪你的這位夥伴是電腦程式，不是真的人。' +
    '它不會告訴你答案，也不會說你對或錯。' +
    '你跟它說的話老師之後看得到，不會拿來打分數。</p>' +
    '</div></div>';
}

/* 對照組的面板。結構刻意與 aalDialogPane 逐項對位：
   卡片頭一個標題 + 一顆計數 pill、內容區高度同為 --pane-h、
   下方一條同高的工具列、footer 說明同樣兩句。
   任何一項不對等，介面差異就會以條件為單位混進依變項。 */
function aalNotePane(it){
  const txt = AAL.notes[it.id] || '';
  return '<div class="card aal-chat"><div class="card-h">' +
    '<h3>我的筆記　·　第 ' + (AAL.idx + 1) + ' 題</h3>' +
    /* 字數用 #noteCount 就地更新，與對話組的 #turnLeft 同一種做法。
       每打一個字重繪整個面板，會讓對照組的互動延遲曲線與三個 AI 組不同。 */
    '<span class="pill">已寫 <span id="noteCount">' + txt.length + '</span> 字</span></div>' +
    '<div class="card-p">' +
    '<label class="sr-only" for="aalNote">我的筆記</label>' +
    '<textarea id="aalNote" data-act="aal-note" style="height:var(--pane-h)"' +
    (isImpersonating() ? ' disabled' : '') + ' ' +
    'placeholder="' + (isImpersonating() ? '代為檢視中，不能替學生寫筆記' : '把你想到的、還沒想通的，寫在這裡') +
    '">' + esc(txt) + '</textarea>' +
    '<div class="row pane-bar" style="margin-top:10px;gap:6px">' +
      '<button class="btn sm" data-act="aal-note-clear">清空</button>' +
      '<span class="muted small" style="flex:1">這一題一份，換題會換成新的一頁。</span>' +
    '</div>' +
    /* 三句，與 AI 面板的 pane-foot 逐句對位（字數落差 10% 以內）。
       第一句不要與 textarea 的 placeholder 逐字重複。 */
    /* 第一句原本是「這一頁只有你自己看得到」，而第三句是「你寫的字老師
       之後看得到」——同一段話直接互相否定，而且這個不實承諾只落在對照組
       （三個 AI 組的對位段落沒有）。這是對十歲受試者的知情同意內容。
       不能靠刪掉第三句修：那會把不實承諾留下來，還破壞三句逐句對位。 */
    '<p class="muted small pane-foot" style="margin-top:8px">這一頁是給你整理想法用的，不是要交出去的答案。' +
    '沒有寫得對不對的問題，想到什麼就寫什麼。' +
    '你寫的字老師之後看得到，不會拿來打分數。</p>' +
    '</div></div>';
}

/* 把整篇文本攤平成可標記的句子清單：{i, para, text} */
function passageSentences(text){
  if (!text) return [];
  const out = [];
  let i = 0;
  (text.paras || []).forEach(function(p, pi){
    splitSentences(p).forEach(function(s){
      out.push({i: i++, para: pi, text: s});
    });
  });
  return out;
}

/* --- 互動處理 --- */
/* 標記與作答都是「每分鐘按十幾次」的微互動。
   這裡刻意不呼叫 render()：整頁重繪會把捲動位置與鍵盤焦點都丟掉，
   學生讀到第 9 段標一句話就被彈回文章開頭。只改真正變動的那幾個節點。 */
function aalMark(i){
  const it = aalItem();
  const m = AAL.marks[it.unit] = AAL.marks[it.unit] || [];
  const k = m.indexOf(i);
  const on = k < 0;
  if (k >= 0) m.splice(k, 1); else m.push(i);
  aalLog('MARK', 'M', {sent:i, textId:it.unit, on: on});
  aalSave();

  const btn = document.querySelector('.passage .sent[data-i="' + i + '"]');
  if (btn){ btn.classList.toggle('on', on); btn.setAttribute('aria-pressed', String(on)); }
  const pill = document.getElementById('markCount');
  const n = document.getElementById('markCountN');
  if (n) n.textContent = m.length;
  if (pill){ if (m.length) pill.removeAttribute('hidden'); else pill.setAttribute('hidden', ''); }
}

/* 用方向鍵在四個選項間移動時，原生 radio 每移動一格就觸發一次 change。
   若每一次都寫日誌，掃過 A B C 停在 D 會產生三筆「改過答案」的假事件。
   停留超過這個時間才算真的作答。序列分析用到毫秒級間隔時要註記這個延遲。 */
const OPTION_DEBOUNCE_MS = 350;

/* 解除作答卡片的「還沒寫完」標記。選擇題與非選題兩條寫入路徑共用一份，
   免得只在其中一條解除（這一輪的缺失正是「加了沒有對應的減」）。 */
function aalClearMissing(){
  const card = document.getElementById('aalAnswer');
  if (card) card.classList.remove('missing');
}

function aalPick(k){
  const it = aalItem();
  AAL.answers[it.id] = k;

  /* 畫面立刻回應（不等去抖），使用者才知道焦點停在哪 */
  const fs = document.querySelector('.aal-side fieldset.opts');
  if (fs) Array.prototype.forEach.call(fs.querySelectorAll('label.opt'), function(lb, idx){
    lb.classList.toggle('chosen', idx === k);
    const mark = lb.querySelector('b');
    if (mark) mark.textContent = String.fromCharCode(65 + idx) + (idx === k ? '✓' : '');
  });
  /* 交卷被退回來時，這張卡片會標紅並在標題後面加「還沒寫完」。
     aal-pick 刻意不走 render（高頻互動不重繪整頁），所以要自己解除——
     否則孩子剛選完答案，卡片還掛著「還沒寫完」，看起來像沒存到。
     選擇題只要選了就不算空白（見 missIdx 的判定），解除是對的。 */
  aalClearMissing();

  /* 計時器以題目為鍵。共用單一變數的話，350ms 內翻到下一題再點，
     clearTimeout 會把上一題的回呼整個取消——上一題永遠沒有 OPTION 事件，
     drafts 不會建立，交卷時的 draftFirst／draftFinal 整批缺值。
     手快的學生踩到機率最高，也就是遺失與能力共變。 */
  aalPick._t = aalPick._t || {};
  aalPick._pending = aalPick._pending || {};
  clearTimeout(aalPick._t[it.id]);
  /* 時間在使用者按下的當下就記，不能等回呼醒來才 Date.now()：
     交卷前 flush 會把一整批間隔壓縮成同一毫秒。 */
  const at = Date.now();
  /* 連身分一起拍快照。去抖視窗結束時 AAL 可能已經被釋放（學生按了側欄、
     上一頁或返回手勢），那時 aalLog 讀不到 AAL.me／AAL.aid 會直接拋錯。 */
  aalPick._pending[it.id] = {it:it, k:k, at:at,
    who:{me:AAL.me, aid:AAL.aid, cond:AAL.cond, t0:AAL.t0}};
  aalPick._t[it.id] = setTimeout(function(){ commitPick(it.id); }, OPTION_DEBOUNCE_MS);
}

function commitPick(iid){
  /* 守門下沉一層：pending 裡本來就存了 {it, k, at}，aalLog 也吃得下 p.it，
     所以就算 AAL 已經被釋放（又多了一條沒 flush 的離開路徑），
     去抖視窗結束時仍然寫得進日誌。只有草稿與 drafts 需要 AAL。 */
  const p = (aalPick._pending || {})[iid];
  if (!p) return;
  delete aalPick._pending[iid];
  clearTimeout((aalPick._t || {})[iid]);
  if (AAL){
    if (AAL.answers[iid] !== p.k) return;     // 期間又改了，這一次不算
    const first = !AAL.drafts[iid];
    if (first) AAL.drafts[iid] = {first: p.k, final: p.k};
    else AAL.drafts[iid].final = p.k;
    aalLog('OPTION', 'O', {choice:p.k, changed: !first, at:p.at}, p.it);
    aalSave();
  } else if (p.who && !isImpersonating()){
    /* AAL 已釋放：用快照自己組事件。late 讓分析端知道這一筆是補寫的。 */
    const kk = classOfStudent(p.who.me);
    logEvent({t:Date.now(), rel:p.at - p.who.t0, sid:p.who.me, cid:kk ? kk.id : null,
      cond:p.who.cond, lang:'zh', aid:p.who.aid, iid:p.it.id,
      proc:p.it.process || 'FR', type:'OPTION', code:'O',
      choice:p.k, changed:null, at:p.at, late:true});
  }
}

/* 換題與交卷之前一定要把待處理的去抖／節流結清，否則最後一次點選與
   最後一段打字會憑空消失。打字節流（aalTypeTelemetry 的呼叫端）寫的是
   TYPE／NOTE，不涉及題目歸屬，但同樣會漏最後一批。 */
function flushPendingPicks(){
  clearTimeout(aalTypeTelemetry._saveT); aalTypeTelemetry._saveT = null;
  Object.keys(aalPick._pending || {}).forEach(commitPick);
  flushTypeTelemetry();
}

/* 打字的「遙測節流」與「草稿落地」是兩件事，節奏不該綁在一起。
   TYPE／NOTE 事件刻意用 4 秒節流（那是歷程分析的取樣率，不能改），
   但草稿必須跟得上：原本節流視窗內打的字完全不落地，重整就靜默掉字，
   而那打在對照組整節課唯一的產出（筆記）與兩題建構反應題上。
   300ms 尾緣，只寫 localStorage、不寫日誌，不影響任何依變項的取樣。 */
function scheduleDraftSave(){
  clearTimeout(aalTypeTelemetry._saveT);
  aalTypeTelemetry._saveT = setTimeout(function(){
    aalTypeTelemetry._saveT = null;
    if (AAL) aalSave();
  }, 300);
}

/* 打字是 4 秒節流：節流視窗內的最後一段字沒有事件。換題或交卷時把它補上，
   並帶著當初那一題的 it——4 秒視窗跨過換題的話，aalItem() 會抓到新題。 */
function flushTypeTelemetry(){
  if (!AAL) return;
  const w = aalTypeTelemetry._pendingW;
  if (w){ aalTypeTelemetry._pendingW = null; aalLog('TYPE', 'W', {len:w.len, at:w.at}, w.it); }
  const n = aalTypeTelemetry._pendingN;
  if (n){ aalTypeTelemetry._pendingN = null; aalLog('NOTE', 'N', {text:n.text, at:n.at}, n.it); }
  if (w || n) aalSave();
}

function aalTypeTelemetry(iid, value){
  const t = aalTele(iid);
  const now = Date.now();
  if (t.firstKeyLatency === null) t.firstKeyLatency = now - t.enter;
  if (t.lastKey && now - t.lastKey >= 3000) t.longPauses++;
  t.lastKey = now;
  if (value.length < t.prevLen) t.deletions += (t.prevLen - value.length);
  else t.keystrokes += (value.length - t.prevLen);
  t.prevLen = value.length;
}

async function aalSay(){
  /* 必須是第一行。aalSay 是 async，等到 await 之後才擋的話，
     state.dialog 那一筆已經以學生的名義寫進去了。 */
  if (isImpersonating()){ toast('代為檢視時不能替學生跟夥伴說話。'); return; }
  const box = document.getElementById('aalSay');
  if (!box) return;
  const text = box.value.trim();
  if (!text) return;
  const it = aalItem();
  /* 記下這一輪是在哪一題發起的。await 期間學生可能已經按了下一題，
     it 是舊題、DOM 是新題的節點，寫回去就會出現「一句話沒講就剩 1 次」。 */
  const myIid = it.id;
  const maxT = (state.settings && state.settings.maxTurns) || MAX_TURNS;
  const used = aalStudentTurns(it.id);
  if (used >= maxT){ toast('這一題的對話次數用完了。'); return; }

  const rel = relativeProcessCode(text, it);
  const sm = sentimentOf(text);
  /* 這一輪要用到的東西全部先拍快照。await 之後 AAL 可能已經被釋放
     （學生在等 AI 回覆時按了交卷、先離開、或直接離開路由），
     那時 aalLog 讀 AAL.me／AAL.t0 會拋 TypeError，而且那一輪的 AI 回覆
     完全不會進 state.dialog——額度已經扣了，語料卻少一筆。 */
  const kSnap = classOfStudent(AAL.me);
  const ctx = {me:AAL.me, aid:AAL.aid, cond:AAL.cond, t0:AAL.t0,
               cid:kSnap ? kSnap.id : null, it:it, turn:used + 1};
  const e = aalLog('ASK', REL_SHORT[rel], {text:text, rel:rel, turn:used + 1, sent:sm.score});
  state.dialog = state.dialog || [];
  state.dialog.push({t:e.t, sid:AAL.me, cond:AAL.cond, aid:AAL.aid, iid:it.id,
    proc:it.process, turn:used + 1, speaker:'student', text:text, rel:rel,
    ucode:codeUtteranceProcess(text), sent:sm.score});
  /* 不重繪整頁：輸入框從頭到尾不被摧毀，焦點就不會掉，
     #aalChat 是 role="log" aria-live="polite"，新訊息會自動被報讀器唸出來。 */
  const chat = document.getElementById('aalChat');
  const sendBtn = document.querySelector('[data-act="aal-say"]');
  if (chat) chat.insertAdjacentHTML('beforeend', '<div class="msg me">' + esc(text) + '</div>');
  box.value = '';
  /* 等待期間用 readOnly，不用 disabled。停用一個正握有焦點的元素會讓焦點
     掉到 body——LLM 引擎下等待可達數秒，學生回過神時要從整頁最上面重新
     Tab、穿過三四十顆句子按鈕才回得到作答區。readonly 一樣擋住所有輸入。 */
  box.readOnly = true;
  box.setAttribute('aria-busy', 'true');
  if (sendBtn){
    if (document.activeElement === sendBtn) box.focus();
    sendBtn.disabled = true;
  }
  if (chat){
    chat.insertAdjacentHTML('beforeend',
      '<div class="msg agent" id="aalThinking">' + esc(condition(AAL.cond).name) + '正在想…</div>');
    chat.scrollTop = chat.scrollHeight;
  }
  aalSave();

  /* 產生回覆的整段都要包起來。原本只有 llmChat 那一段有 try：
     規則引擎那一條（agentTurn → pickSubprocess → leakGuard）是裸的，
     而 LLM 失敗時的退路也是同一支 agentTurn——它一旦拋例外，
     整個 async 函式就以 rejected 收場，於是
     「正在想…」永遠留在畫面上、輸入框永遠是 readonly、送出鈕永遠 disabled。
     孩子這一題再也講不了話，畫面上卻沒有任何訊息說明發生什麼事，
     而額度已經扣掉了。任何情況都必須走到下面的還原流程。 */
  let reply;
  const qfnNow = TURN_SCHEDULE[Math.min(used, TURN_SCHEDULE.length - 1)];
  try {
    if (aiEngine() === 'llm'){
      try {
        const raw = await llmChat([
          {role:'system', content: composePrompt(AAL.cond, it.process || 'FR', qfnNow)},
          {role:'user', content:'【題目】' + it.stem + '\n【學生剛剛說】' + text}
        ], {max_tokens:200, temperature:0.7});
        const g = leakGuard(raw, it);
        reply = {text:g.text, qfn:qfnNow,
                 sub:null, engine:'llm', blocked:g.blocked, hits:g.hits};
      } catch (err) {
        reply = agentTurn(ctx.cond, it, used);
        reply.fallback = err.message;
      }
    } else {
      reply = agentTurn(ctx.cond, it, used);
    }
  } catch (err) {
    if (typeof console !== 'undefined' && console.error)
      console.error('[KAIROS] aalSay 產生回覆失敗，改用固定回覆', err);
    /* 這一句不帶任何提問功能，也不標子歷程——它不是一個對話輪，
       是一次故障。engine:'error' 讓分析階段可以把它整批排除。 */
    reply = {text:'我剛剛沒聽清楚，你可以再說一次嗎？', qfn:null, sub:null,
             engine:'error', error: String((err && err.message) || err)};
  }

  /* 一律走快照，不走 AAL：await 之後 AAL 可能已經是 null，
     而 aalLog 沒有 itemArg 時會用 aalItem()——學生翻頁的話，
     同一輪對話的一問一答會被拆到兩題（ASK 記在 R01、AI 記在 R02）。 */
  const eaT = Date.now();
  /* 落地也要包起來：這裡拋例外的話，下面的還原不會執行，
     結果和產生回覆失敗一模一樣——畫面卡在「正在想…」。
     資料寫不進去是嚴重的事，但把孩子鎖在一個不會動的畫面上更嚴重，
     所以記錄到 console 之後照樣把輸入框還給他。 */
  try {
    if (!isImpersonating()){
      logEvent({t:eaT, rel:eaT - ctx.t0, sid:ctx.me, cid:ctx.cid, cond:ctx.cond, lang:'zh',
        aid:ctx.aid, iid:ctx.it.id, proc:ctx.it.process || 'FR', type:'AI', code:'A',
        text:reply.text, qfn:reply.qfn, sub:reply.sub, turn:ctx.turn,
        engine:reply.engine, blocked: !!reply.blocked});
    }
    state.dialog.push({t:eaT, sid:ctx.me, cond:ctx.cond, aid:ctx.aid, iid:ctx.it.id,
      proc:ctx.it.process, turn:ctx.turn, speaker:'agent', text:reply.text,
      qfn:reply.qfn, sub:reply.sub, ucode:reply.process || ctx.it.process, sent:0});
    save();
    if (AAL) aalSave();   // AAL 可能在等待期間被釋放
  } catch (err) {
    if (typeof console !== 'undefined' && console.error)
      console.error('[KAIROS] aalSay 落地失敗', err);
  }

  /* 守衛放在資料寫入之後、DOM 更新之前：回覆一定要進 state.dialog
     （那是額度與語料的同一份帳），但學生已經翻頁的話就不碰畫面、不 toast。 */
  if (!AAL || aalItem().id !== myIid) return;

  /* 拿掉「正在想…」、append 回覆、把輸入框交還給學生 */
  const think = document.getElementById('aalThinking');
  if (think) think.remove();
  if (chat){
    chat.insertAdjacentHTML('beforeend', '<div class="msg agent"><b>' +
      esc(condition(AAL.cond).name) + '</b>' + esc(reply.text) + '</div>');
    chat.scrollTop = chat.scrollHeight;
  }
  const left = maxT - aalStudentTurns(it.id);
  const pill = document.getElementById('turnLeft');
  if (pill) pill.textContent = Math.max(0, left);
  box.readOnly = false;
  box.removeAttribute('aria-busy');
  /* 回覆抵達時只在「焦點還在對話面板、或已經掉到 body」的情況下才收回焦點。
     原本是無條件 box.focus()：LLM 引擎下這一段等待可達數秒（見上方註解），
     而那正是孩子回去讀文章、點句子、或在 #crText 打非選題答案的時間窗。
     焦點被拉走之後他繼續打的字會落進對話框，順手按 Enter 就整段送出去
     （#aalSay 的 Enter 綁在 99-app.js 上）——那一段話會：
       · 扣掉這一題 6 次額度裡的一次
       · 以「【學生剛剛說】」進到提示詞，實質繞過「AI 不可讀作答欄位」
       · 被編碼成 RQ4 的語料
       · 而且從他自己的答案裡消失
     這條路徑只存在於三個 AI 條件，對照組沒有非同步等待——所以它同時是
     一個與條件共變的資料汙染。
     同一支函式第 540 行早就有這道 activeElement 守門，只是沒有套到這裡。
     preventScroll 一併補上，理由與下面那一支相同。 */
  const focusIsOurs = !document.activeElement ||
    document.activeElement === document.body ||
    document.activeElement === box ||
    document.activeElement === sendBtn;
  if (left > 0){
    if (sendBtn) sendBtn.disabled = false;
    if (focusIsOurs) box.focus({preventScroll:true});
  } else {
    box.placeholder = '這一題已經聊完了';
    box.disabled = true;
    /* 順序很重要：先 append，再捲到底，最後才 focus。
       反過來的話那句話確實拿到焦點，但整個落在捲動視窗外——
       孩子只看到輸入框忽然變灰，解釋原因的那句話在他看不到的地方。 */
    if (chat){
      chat.insertAdjacentHTML('beforeend',
        '<div class="msg sys" id="turnsDone" tabindex="-1">這一題的對話次數用完了。換下一題會重新計算。</div>');
      chat.scrollTop = chat.scrollHeight;
    }
    const done = document.getElementById('turnsDone');
    const next = document.querySelector('[data-act="aal-next"]:not([disabled])');
    /* preventScroll 要留著——拿掉會把整個頁面捲走。
       activeElement 守門的理由同上：孩子可能正在別的地方打字，
       額度用完不是把他從答案裡拉走的理由。焦點不收回時，
       #aalChat 是 role="log" aria-live="polite"，那句話仍會被報讀出來，
       而 toast 也照樣出現。 */
    if (focusIsOurs){
      if (done) done.focus({preventScroll:true});
      else if (next) next.focus({preventScroll:true});
    }
    toast('這一題的對話次數用完了，可以按下一題。');
  }
}

function aalSubmit(){
  if (isImpersonating()){ toast('代為檢視時不能替學生交卷。'); return; }
  /* 連按兩次不要丟未捕捉例外（AAL 交卷後會被清成 null）。 */
  if (!AAL){ toast('這一份已經交出去了。'); return; }
  /* 待處理的去抖／節流先結清，再檢查與落地 */
  flushPendingPicks();
  flushLogs();
  const a = getAssignment(AAL.aid), me = currentUser();
  /* 兩種題型分開數。只數選擇題的話，兩題作文整題空白會無聲送出，
     而建構反應題是理解表現的另一半，也是論述層次評定的來源。 */
  /* 安全網原本是反的：有缺答才確認、全部答完反而完全不確認，
     而〈交卷〉在 tab 序上就緊接著一整節課要按十五次的〈下一題〉。
     缺答的訊息也只給數量不給題號，按取消之後畫面留在原地、沒有任何標示，
     要找回缺答的題目只能一路按〈上一題〉——趕時間、能力較弱、
     以及被對話占掉較多時間的孩子最容易在這裡放棄尋找而按確定，
     那正是與條件共變的缺失值來源。 */
  const missIdx = [];
  AAL.items.forEach(function(i, idx){
    const blank = (i.type === 'cr')
      ? !(AAL.texts[i.id] || '').trim()
      : AAL.answers[i.id] === undefined;
    if (blank) missIdx.push(idx);
  });

  /* 「交出去就不能再改」原本只出現在「全部寫完」那一支——兩支是 if / else if，
     互斥。也就是說：唯一沒被告知不可逆的，正好是最可能想「先交、等一下回來補」
     的那群孩子；而整個平台一路在教他「進度會保留」「接著上次繼續」，
     這個誤讀完全合理。按下確定之後草稿被刪、從此被導去成績頁，
     全站沒有任何補交路徑，缺答永久寫成 null 進不了 Rasch——
     而缺答率與條件共變，程式自己在上面的註解裡標記過這個偏誤來源，
     安全網卻只裝在他走不到的分支上。
     不可逆那句提到兩支共用的前置，並把畫面上真的存在的第三條路
     （〈先離開（進度會保留）〉）寫進去。 */
  const FINAL = '交出去之後就不能再修改。';
  if (missIdx.length){
    const nos = missIdx.map(function(idx){ return '第 ' + (idx + 1) + ' 題'; }).join('、');
    if (!confirm(FINAL + '\n\n還有 ' + missIdx.length + ' 題沒寫完：' + nos +
                 '。\n\n按「確定」直接交卷；按「取消」回去把它寫完，' +
                 '或用上面的〈先離開（進度會保留）〉，寫過的都會留著。')){
      /* 取消不是什麼都不做——把他帶到第一題沒寫完的地方 */
      AAL.idx = missIdx[0];
      aalSave();
      render();
      const ans = document.getElementById('aalAnswer');
      if (ans){
        ans.classList.add('missing');
        ans.focus({preventScroll:true});
        ans.scrollIntoView({block:'start'});
      }
      toast('帶你回到第 ' + (missIdx[0] + 1) + ' 題。');
      return;
    }
  } else if (!confirm(FINAL + '\n\n要交卷了嗎？')){
    return;
  }

  AAL.items.forEach(function(it){
    state.responses = state.responses.filter(function(r){
      return !(r.aid === AAL.aid && r.sid === me.id && r.iid === it.id); });
    const t = AAL.tele[it.id];
    if (t){
      logEvent({t:Date.now(), rel:Date.now() - AAL.t0, sid:me.id,
        cid:(classOfStudent(me.id) || {}).id, cond:AAL.cond, lang:'zh', aid:AAL.aid,
        iid:it.id, proc:it.process, type:'TELEMETRY',
        firstKeyLatency:t.firstKeyLatency, keystrokes:t.keystrokes,
        deletions:t.deletions, longPauses:t.longPauses});
    }
    const nC = (AAL.checks[it.id] || []).length;
    logEvent({t:Date.now(), rel:Date.now() - AAL.t0, sid:me.id,
      cid:(classOfStudent(me.id) || {}).id, cond:AAL.cond, lang:'zh', aid:AAL.aid,
      iid:it.id, proc:it.process, type:'SUBMIT', code:'S', selfCheck:nC,
      draftFirst:(AAL.drafts[it.id] || {}).first, draftFinal:(AAL.drafts[it.id] || {}).final});

    /* 對照組整節課唯一的產出就是筆記。存進獨立的 state.aalNotes——
       不塞進 state.dialog，因為全站多處文案與分析建立在「對照組 dialog 為空」上。
       欄位與 dialog 對齊，分析端要納入時自己 concat。 */
    if (AAL.cond === 'control' && (AAL.notes[it.id] || '').trim()){
      state.aalNotes = state.aalNotes || [];
      state.aalNotes.push({t:Date.now(), rel:Date.now() - AAL.t0, sid:me.id,
        cid:(classOfStudent(me.id) || {}).id, cond:AAL.cond, lang:'zh',
        aid:AAL.aid, iid:it.id, proc:it.process, text:AAL.notes[it.id],
        ucode:codeUtteranceProcess(AAL.notes[it.id]),
        sent:sentimentOf(AAL.notes[it.id]).score});
    }
    if (it.type === 'cr'){
      state.responses.push({aid:AAL.aid, sid:me.id, iid:it.id, text:AAL.texts[it.id] || '',
        strokes:(PADS['aal-' + it.id] && PADS['aal-' + it.id].strokes.length) ? PADS['aal-' + it.id].strokes : null,
        score:null, comment:'', correct:null});
    } else {
      const c = AAL.answers[it.id];
      state.responses.push({aid:AAL.aid, sid:me.id, iid:it.id,
        choice: c === undefined ? null : c,
        /* 沒作答就是 null，不是「答錯」。undefined === answer 恆為 false，
           會把缺答計成 0 分餵進 Rasch；而缺答率與條件共變（三個 AI 組
           每題要花對話時間），那會在 RQ1 的組間 θ 比較裡製造與操弄同向的偏誤。 */
        correct: c === undefined ? null : (c === it.answer)});
    }
  });
  state.submissions = state.submissions.filter(function(s){ return !(s.aid === AAL.aid && s.sid === me.id); });
  state.submissions.push({aid:AAL.aid, sid:me.id, at:Date.now()});
  save();
  aalDropDraft();          // 交出去了，草稿不用留
  AAL = null;
  toast('已交卷。接下來是這節課的問卷。');
  replaceHash('#/survey/post');
}

/* ==========================================================================
   問卷施測
   ========================================================================== */
let SURVEY = null;

/* 這一份問卷實際要作答的所有題鍵。抬頭的題數與送出前的檢查都吃這一個來源，
   否則會出現「抬頭說 47 題、送出只檢查 41 題」，操弄檢核與使用感受整段留白也送得出去。
   cond 參數不可省：對照組不施操弄檢核，否則會被要求填不存在的三題而永遠送不出去。 */
/* 表單用 mc_x_i／sys_x_i，儲存用固定 id（mc_tutor、sys_easy…）。
   兩套鍵並存過一段時間，而只有「寫」的方向做了映射——讀回時整段空白，
   再送出一次就把原值洗成 null。這兩支是唯一的橋，讀寫都必須經過它們。 */
function surveyRespToStored(formResp, phase, cond){
  const out = Object.assign({}, formResp);
  if (phase !== 'post') return out;
  if (cond !== 'control'){
    MANIP_CHECK.forEach(function(m, i){
      const v = formResp['mc_x_' + i];
      /* 只有真的作答過才覆寫：保住「鍵存在但值為 null 表示漏答」的語意，
         同時不讓一次無心的重送抹掉既有值。 */
      if (v != null) out[m.id] = v;
      else if (!(m.id in out)) out[m.id] = null;
      delete out['mc_x_' + i];
    });
  }
  SUS_ITEMS.forEach(function(s, i){
    const v = formResp['sys_x_' + i];
    if (v != null) out[s.id] = v;
    else if (!(s.id in out)) out[s.id] = null;
    delete out['sys_x_' + i];
  });
  return out;
}
function surveyRespToForm(storedResp, phase){
  const out = Object.assign({}, storedResp);
  if (phase !== 'post') return out;
  MANIP_CHECK.forEach(function(m, i){
    if (storedResp[m.id] != null) out['mc_x_' + i] = storedResp[m.id];
  });
  SUS_ITEMS.forEach(function(s, i){
    if (storedResp[s.id] != null) out['sys_x_' + i] = storedResp[s.id];
  });
  return out;
}

function surveyKeys(phase, cond){
  const ks = [];
  constructsFor(phase).forEach(function(c){
    c.items.forEach(function(_, i){ ks.push(c.id + '_' + i); });
  });
  if (phase === 'post'){
    if (cond !== 'control') MANIP_CHECK.forEach(function(_, i){ ks.push('mc_x_' + i); });
    SUS_ITEMS.forEach(function(_, i){ ks.push('sys_x_' + i); });
  }
  return ks;
}

/* 課後問卷的門檻。操弄檢核問的是「剛剛那位夥伴像什麼」——
   還沒上課就填，答案沒有意義，而它是驗證實驗操弄成功與否的關鍵工具。
   前測不設門檻（它本來就該在課前填）。 */
function surveyGate(phase){
  const me = currentUser();
  if (phase === 'pre') return '';
  if (me.role !== 'student') return '';
  if (submitted('a-post', me.id)) return '';
  const a = getAssignment('a-post');
  if (!a) return '';
  return '<div class="empty"><h3>課後問卷要等這節課上完</h3>' +
    '<p style="max-width:62ch">這份問卷問的是你剛剛上這節課的感覺。' +
    '還沒上完就填，你會不知道要怎麼回答。先把下面這份做完，做完就會自動帶你來這裡。</p>' +
    '<div class="col" style="margin-top:14px;align-items:flex-start">' +
    '<a class="btn primary" href="#/aal/' + a.id + '">' + esc(a.title) + '　開始這份作業 →</a>' +
    '<a class="btn" href="#/student">回我的作業</a></div></div>';
}

/* 問卷分段。一題都不刪——正式施測要換成 MSLQ／Leppink／Fredricks 的
   已驗證量表，刪題就不是那個構念了。改成一段一頁，並保存進度。

   段落標題刻意不印構念名：「自我效能（自我效能）」既重複又等於告訴受試者
   這一段在量什麼，會啟動作答傾向。構念名留在 data 屬性與教師端。 */
const SURVEY_DRAFT_KEY = 'kairos-survey-draft';

/* 把一份問卷攤成「段落」清單。每一段 = 一個構念（或操弄檢核／使用感受）。
   題號跨段連續，與抬頭的「共 N 題」對得上。 */
function surveySections(phase, cond){
  const secs = [];
  let n = 0;
  constructsFor(phase).forEach(function(c){
    secs.push({key:c.id, construct:c.id, dim:c.dim, scale:c.scale, cls:c.cls,
               items:c.items, from:n});
    n += c.items.length;
  });
  if (phase === 'post'){
    if (cond !== 'control'){
      secs.push({key:'mc_x', construct:'manip', dim:'角色知覺', scale:SCALE6, cls:'',
                 items:MANIP_CHECK.map(function(m){ return m.text; }), from:n});
      n += MANIP_CHECK.length;
    }
    secs.push({key:'sys_x', construct:'sus', dim:'使用感受', scale:SCALE6, cls:'',
               items:SUS_ITEMS.map(function(s){ return s.text; }), from:n});
    n += SUS_ITEMS.length;
  }
  return secs;
}

function surveyDraftSave(){
  if (isImpersonating()) return;
  if (!SURVEY) return;
  try {
    const all = JSON.parse(localStorage.getItem(SURVEY_DRAFT_KEY) || '{}');
    all[SURVEY.sid + '|' + SURVEY.phase] = {resp:SURVEY.resp, page:SURVEY.page, savedAt:Date.now()};
    localStorage.setItem(SURVEY_DRAFT_KEY, JSON.stringify(all));
  } catch (e) { toast('這一段沒能存起來，先不要關掉分頁。'); }
}
function surveyDraftLoad(sid, phase){
  try {
    const all = JSON.parse(localStorage.getItem(SURVEY_DRAFT_KEY) || '{}');
    return all[sid + '|' + phase] || null;
  } catch (e) { return null; }
}
/* 丟掉某位學生在某一份作業上的作答草稿。
   「再走一次」與施測前清場都要用它——只清 state 而不清草稿的話，
   下一次進作答頁 aalInit 會把舊的 idx 與答案原封不動還原回來。 */
function aalDraftDrop(aid, sid){
  try {
    const all = JSON.parse(localStorage.getItem(AAL_DRAFT_KEY) || '{}');
    delete all[aid + '|' + sid];
    localStorage.setItem(AAL_DRAFT_KEY, JSON.stringify(all));
  } catch (e) {}
}
function surveyDraftDrop(sid, phase){
  try {
    const all = JSON.parse(localStorage.getItem(SURVEY_DRAFT_KEY) || '{}');
    delete all[sid + '|' + phase];
    localStorage.setItem(SURVEY_DRAFT_KEY, JSON.stringify(all));
  } catch (e) {}
}

function viewSurvey(phase, page){
  const me = currentUser();
  if (me.role !== 'student') return '<div class="empty"><h3>請切換成學生身分</h3>' +
    '<p>問卷是學生端的畫面。</p></div>';
  const gate = surveyGate(phase); if (gate) return gate;

  const cond = conditionOfStudent(me.id);
  const secs = surveySections(phase, cond);
  const done = surveyOf(me.id, phase);

  /* 送出即定案。原本已送出的問卷還能整份重新進入、預填、再按一次送出，
     而 surveySubmit 是「先濾掉舊的再 push 新的」——原紀錄連同時間戳
     被靜默取代，沒有任何警告，也留不下發生過的痕跡。
     前測那一份是 ANCOVA 的共變數基線：孩子上完課再回來改它，
     基線就被處遇污染了。後測那一份帶著操弄檢核，是驗證三種角色操弄
     是否成立的唯一工具。作答本來就說「交出去之後就不能再修改」，
     問卷是同一種東西，不該是例外。
     （反向映射 surveyRespToForm 留著——它現在用來「顯示」已送出的內容，
       只是不再有寫回去的路徑。） */
  if (done){
    const keys = surveyKeys(phase, cond);
    const filled = keys.filter(function(k){ return done.resp[k] != null; }).length;
    return sectionHead(phase === 'pre' ? '課前問卷' : '課後問卷',
        me.name + '　·　' + (classOfStudent(me.id) || {}).name,
        '<a class="btn" href="#/student">← 回我的作業</a>') +
      '<div class="card card-p" style="border-left:3px solid var(--good)">' +
      '<h3 style="margin-bottom:6px">這份問卷你已經送出了</h3>' +
      '<p class="small" style="max-width:62ch;margin:0">你在 ' + fmtDate(done.at) +
      ' 送出，' + filled + ' 題有作答。送出之後就不能再改了——' +
      '這樣老師和研究者看到的才會是你當時真正的想法。</p>' +
      '<div class="row" style="margin-top:14px">' +
      '<a class="btn primary" href="#/student">回我的作業</a>' +
      (phase === 'pre' && !surveyOf(me.id, 'post') && submitted('a-post', me.id)
        ? '<a class="btn" href="#/survey/post">去填課後問卷</a>' : '') +
      '</div></div>';
  }

  if (!SURVEY || SURVEY.phase !== phase || SURVEY.sid !== me.id){
    const d = surveyDraftLoad(me.id, phase);
    /* 讀回已交問卷時要做反向映射。少了它，第 11、12 段（操弄檢核與使用感受）
       整段空白、抬頭寫「41 / 47」，而且再按一次送出會把原本的 mc_* 洗成 null。
       操弄檢核是驗證三種角色操弄是否成立的唯一工具。 */
    SURVEY = {phase:phase, sid:me.id,
              resp: d ? d.resp : (done ? surveyRespToForm(done.resp, phase) : {}),
              page: d ? d.page : 1};
  }
  SURVEY.page = Math.max(1, Math.min(page || SURVEY.page || 1, secs.length));
  /* 網址與畫面要說同一件事。原本越界的頁碼只在記憶體裡夾回範圍，
     網址列還停在 #/survey/post/99——重整、加書籤、或把連結給老師看，
     又會回到那個值；而「第幾段，共幾段」是孩子判斷自己填到哪裡的唯一依據。
     沒有頁碼的入口（交完卷跳過來的 #/survey/post）也一併補成明確頁碼。
     replaceState 不觸發 hashchange，所以不會再繞一次 render。 */
  const wantHash = '#/survey/' + phase + '/' + SURVEY.page;
  if (location.hash !== wantHash && window.history && history.replaceState){
    try { history.replaceState(null, '', wantHash); } catch (e) {}
  }

  const keys = surveyKeys(phase, cond);
  const total = keys.length;
  const answered = keys.filter(function(k){ return SURVEY.resp[k]; }).length;
  const sec = secs[SURVEY.page - 1];
  const last = SURVEY.page === secs.length;

  /* 量尺從六點換成五點時要說一聲，否則學生會以為自己看錯 */
  const prevScale = SURVEY.page > 1 ? secs[SURVEY.page - 2].scale : null;
  const scaleChanged = prevScale && prevScale.n !== sec.scale.n;

  function block(s){
    return '<div class="card" style="margin-bottom:14px" data-construct="' + esc(s.construct) + '">' +
      /* 副標拿掉了。原本是三句裝飾字用 %3 循環，第 10 段問學習焦慮卻標
         「關於你怎麼讀」；更嚴重的是它依條件位移——對照組少一段操弄檢核，
         於是同一批 SUS 題目在對照組掛「關於這節課的感覺」、在實驗組掛
         「關於你自己」。標題會給題目定框，而 SUS 正是要拿來做四條件比較的。
         也不能改成印構念名：告訴受試者這一段在量什麼會直接啟動作答傾向。 */
      '<div class="card-h"><h3>第 ' + SURVEY.page + ' 段，共 ' + secs.length + ' 段</h3>' +
      '<span class="muted small">選 1 到 ' + s.scale.n + '</span></div><div class="card-p col">' +
      s.items.map(function(txt, i){
        const key = s.key + '_' + i;
        const no = s.from + i + 1;
        return '<div class="likert"><div class="q" id="q_' + key + '">' + no + '. ' + esc(txt) + '</div>' +
          /* 原生 radio：拿回語意與方向鍵行為，Tab 停留點是「一題」而不是「一格」 */
          '<div class="scale" role="radiogroup" aria-labelledby="q_' + key + '">' +
          new Array(s.scale.n).fill(0).map(function(_, v){
            const val = v + 1;
            const on = SURVEY.resp[key] === val;
            return '<label class="lk' + (on ? ' on' : '') + '">' +
              '<input type="radio" class="sr-only" name="' + key + '" data-act="sv-pick"' +
              ' data-k="' + key + '" data-v="' + val + '"' + (on ? ' checked' : '') + '>' +
              '<span class="lk-n" aria-hidden="true">' + val + '</span>' +
              '<span class="lk-t">' + esc(s.scale.labels[v]) + '</span></label>';
          }).join('') + '</div></div>';
      }).join('') + '</div></div>';
  }

  return sectionHead(phase === 'pre' ? '課前問卷' : '課後問卷',
      '沒有標準答案，照你真正的感覺選就好。',
      '<span class="pill" role="status" aria-live="polite">已完成 <span id="svDone">' + answered +
      '</span> / 共 ' + total + ' 題</span>') +

    '<div class="card card-p" style="margin-bottom:14px">' +
      '<div class="row" style="justify-content:space-between">' +
      '<b>第 ' + SURVEY.page + ' 段，共 ' + secs.length + ' 段</b>' +
      '<span class="muted small">中間可以休息，填到哪裡會自動記住</span></div>' +
      '<div class="bar" style="margin-top:8px"><i style="width:' +
      Math.round(100 * SURVEY.page / secs.length) + '%"></i></div>' +
    '</div>' +

    (SURVEY.page === 1
      ? '<div class="card card-p" style="margin-bottom:14px">' +
        '<h4>填之前先看這裡</h4>' +
        '<p class="small" style="margin-top:6px">這些題目沒有對錯，也不會算成績。' +
        '照你真正的感覺選就好。看不懂的題目可以舉手問老師。' +
        '這份問卷分成 ' + secs.length + ' 段，中間可以休息。' +
        /* 量尺與作答頁的選項是同一個 radiogroup 形狀，第一次填時
           行為完全一樣：Tab 進來會停在第一格但不勾選它。
           兩處的說明也要一致：先講點選，再講鍵盤。 */
        '直接點你要的那一格就可以。用鍵盤的話，上下方向鍵移動、空白鍵選起來。</p></div>'
      : '') +
    (scaleChanged
      ? '<div class="card card-p" style="margin-bottom:14px;border-left:3px solid var(--accent)">' +
        /* 方向由 sec.scale 決定，不能寫死。原本永遠寫「改成問符不符合你」，
           但第 7 段是 6→5（符不符合）、第 10 段是 5→6（同不同意）——
           後者畫面上明明是「非常不同意…非常同意」，卡片卻叫孩子改用
           「符不符合」的角度作答。那是對受試者的錯誤作答指導，
           而且落在 anx 這個中介路徑最敏感的依變項上。 */
        '<p class="small" style="margin:0">接下來的題目改成問「' +
        esc(sec.scale.labels[0]) + '」到「' + esc(sec.scale.labels[sec.scale.n - 1]) + '」，' +
        '選項也從 ' + prevScale.n + ' 格變成 ' + sec.scale.n + ' 格，看清楚再選。</p></div>'
      : '') +

    block(sec) +

    '<div class="row" style="justify-content:space-between;margin-top:16px">' +
      (SURVEY.page > 1
        ? '<button class="btn" data-act="sv-page" data-v="' + (SURVEY.page - 1) + '">← 上一段</button>'
        : '<span></span>') +
      (last
        ? '<button class="btn primary" data-act="sv-submit" data-id="' + phase + '">送出問卷</button>'
        : '<button class="btn primary" data-act="sv-page" data-v="' + (SURVEY.page + 1) + '">下一段 →</button>') +
    '</div>';
}

function surveySubmit(phase){
  if (isImpersonating()){ toast('代為檢視時不能替學生送出問卷。'); return; }
  /* 連按兩次不要丟未捕捉例外。同檔其他四處寫入路徑都有這道守門。 */
  if (!SURVEY){ toast('問卷已經送出了。'); return; }
  const me = currentUser();
  const cond = conditionOfStudent(me.id);
  if (surveyGate(phase)){ toast('這節課還沒上完，問卷等一下再填。'); return; }

  const keys = surveyKeys(phase, cond);
  const miss = keys.filter(function(k){ return !SURVEY.resp[k]; });
  if (miss.length){
    /* 直接帶他去缺答的那一段並標紅——只跳一個 confirm，他不知道漏在哪 */
    const secs = surveySections(phase, cond);
    const pre = miss[0].replace(/_\d+$/, '');
    const pg = Math.max(1, secs.findIndex(function(s){ return s.key === pre; }) + 1);
    if (!confirm('還有 ' + miss.length + ' 題沒作答。\n\n' +
                 '按「確定」直接送出，按「取消」回去把它填完。')){
      SURVEY.page = pg;
      surveyDraftSave();
      go('#/survey/' + phase + '/' + pg);
      setTimeout(function(){
        /* 這一段裡每一題缺答都要標，不是只標第一題——只標一題的話，
           孩子填完它再按送出，又被退回來一次，不知道還有幾題。 */
        let first = null, n = 0;
        miss.forEach(function(k){
          const el = document.querySelector('[data-k="' + k + '"]');
          if (!el) return;
          const row = el.closest('.likert');
          if (row){ row.classList.add('missing'); row.setAttribute('aria-invalid', 'true'); }
          n++;
          if (!first) first = el;
        });
        if (n){
          const box = document.querySelector('#view .card-p');
          if (box && !document.getElementById('svMissAlert')){
            box.insertAdjacentHTML('afterbegin',
              '<p id="svMissAlert" role="alert" class="small" style="color:var(--crit);font-weight:600">' +
              '這一段還有 ' + n + ' 題沒有選。</p>');
          }
        }
        if (first){ first.focus(); first.scrollIntoView({block:'center'}); }
      }, 0);
      return;
    }
  }

  /* 第二道門：畫面那一層擋不到直接呼叫的路徑（例如舊分頁上的按鈕），
     而這裡是唯一會覆寫紀錄的地方。 */
  if (surveyOf(me.id, phase)){
    toast('這份問卷已經送出了，不能再改。');
    SURVEY = null;
    replaceHash('#/student');
    return;
  }

  // 操弄檢核與使用感受用固定鍵存回原本的 id。
  // 未答一律寫成 null，讓分析端能用「鍵存在但值為 null」區分漏答與未施測；
  // 對照組不建 mc_* 鍵，因為那三題本來就不對他施測。
  const resp = surveyRespToStored(SURVEY.resp, phase, cond);

  state.surveys = (state.surveys || []).filter(function(s){
    return !(s.sid === me.id && s.phase === phase); });
  state.surveys.push({sid:me.id, phase:phase, at:Date.now(), resp:resp});
  save();
  surveyDraftDrop(me.id, phase);
  SURVEY = null;
  toast('問卷已送出，謝謝你。');
  replaceHash('#/student');
}

/* ==========================================================================
   學生作答與 AI 互動檢視（教師／研究者，唯讀）

   為什麼要有這一頁：評量即學習事件是學生端的畫面，測驗一旦結束就沒有人
   進得去，教師與研究者也就看不到「學生當時實際看到什麼、跟 AI 說了什麼」。
   這裡用與 viewAaL() 相同的版面重播一位學生的作答歷程——同樣的兩欄、
   同樣的文本、同樣的對話卡——差別只在全部唯讀，而且會多顯示對錯與編碼。
   ========================================================================== */
let INSPECT = null;

function inspectInit(aid, sid){
  const a = getAssignment(aid);
  INSPECT = {aid:aid, sid:sid, idx:0,
             items: a ? a.itemIds.map(getItem).filter(Boolean) : []};
}

/* 從事件日誌把這位學生在這篇文本上標記過的句子還原出來（MARK 事件是切換語意） */
function inspectMarks(sid, aid, textId){
  const mine = allLogs().filter(function(e){
    if (e.sid !== sid || e.aid !== aid) return false;
    if (e.textId && e.textId !== textId) return false;
    return e.sent != null;
  });
  return foldToggleLog(mine, 'M', 'sent').map(Number);
}

/* 唯讀重播的學生順序。教師端名單（tabReplay）與這一頁的「上一位／下一位」
   必須用同一份順序，否則他按下一位跳到的人跟他剛看到的名單對不上。
   依發話次數排序，同數再依姓名，讓順序在同一次工作階段中穩定。 */
function inspectRoster(aid){
  const a = getAssignment(aid);
  if (!a) return [];
  const dial = allDialog().filter(function(d){ return d.aid === aid && d.speaker === 'student'; });
  const said = {};
  dial.forEach(function(d){ said[d.sid] = (said[d.sid] || 0) + 1; });
  return assignmentRoster(a).slice().sort(function(x, y){
    const dx = (said[y] || 0) - (said[x] || 0);
    return dx || (userName(x) < userName(y) ? -1 : 1);
  });
}

function viewInspect(aid, sid){
  if (!isTeacher()) return '<div class="empty"><h3>這一頁只有教師與研究者看得到</h3></div>';
  const a = getAssignment(aid);
  if (!a) return '<div class="empty"><h3>找不到這份派題</h3><a class="btn" href="#/teacher">回教師後台</a></div>';
  const roster = inspectRoster(aid);
  if (!sid || roster.indexOf(sid) < 0) sid = roster[0];
  if (!sid) return '<div class="empty"><h3>這份派題還沒有學生</h3></div>';
  if (!INSPECT || INSPECT.aid !== aid || INSPECT.sid !== sid) inspectInit(aid, sid);

  const ri = roster.indexOf(sid);
  const k = classOfStudent(sid);
  const cond = condition(conditionOfStudent(sid));
  const it = INSPECT.items[INSPECT.idx];
  if (!it) return '<div class="empty"><h3>這份派題沒有題目</h3></div>';

  const text = getText(it.unit);
  const sents = passageSentences(text);
  const marks = inspectMarks(sid, aid, it.unit);
  const resp = state.responses.find(function(r){
    return r.aid === aid && r.sid === sid && r.iid === it.id; }) || {};
  const turns = allDialog().filter(function(d){
    return d.sid === sid && d.aid === aid && d.iid === it.id; })
    .sort(function(x, y){ return x.t - y.t; });
  /* 寫入端把 CHECK 記成切換事件（取消時帶 off:true），讀取端必須折疊。
     不折疊的話老師會看到學生已經取消的勾選，還會出現「勾了 7 / 5 項」。 */
  const checks = foldToggleLog(allLogs().filter(function(e){
    return e.sid === sid && e.aid === aid && e.iid === it.id; }), 'C', 'idx').map(Number);
  const done = submitted(aid, sid);

  /* 全部學生的下拉，讓教師不必回上一頁就能換人 */
  const picker = '<select id="inspectWho" data-act="inspect-who" style="width:auto">' +
    roster.map(function(x){
      return '<option value="' + x + '"' + (x === sid ? ' selected' : '') + '>' +
        esc(userName(x)) + '（' + esc(condition(conditionOfStudent(x)).name) + '）</option>';
    }).join('') + '</select>';

  return sectionHead('作答與 AI 互動檢視',
      esc(a.title) + '　·　與學生當時看到的版面相同，此處為唯讀重播。',
      '<a class="btn" href="#/assign/' + aid + '/replay">← 回唯讀重播</a>') +

    '<div class="card card-p" style="margin-bottom:14px">' +
      '<div class="row" style="gap:14px;flex-wrap:wrap;align-items:center">' +
        '<label class="small muted" for="inspectWho">學生</label>' + picker +
        /* 名單有 96 列。沒有這兩顆鈕，老師逐位檢查等於做 96 次
           「回名單 → 捲到剛才的位置 → 點下一位」。 */
        '<button class="btn sm" data-act="inspect-who-prev" data-id="' + roster[Math.max(0, ri - 1)] +
          '"' + (ri <= 0 ? ' disabled' : '') + '>← 上一位</button>' +
        '<span class="muted small">第 ' + (ri + 1) + ' / ' + roster.length + ' 位</span>' +
        '<button class="btn sm" data-act="inspect-who-next" data-id="' +
          roster[Math.min(roster.length - 1, ri + 1)] + '"' +
          (ri >= roster.length - 1 ? ' disabled' : '') + '>下一位 →</button>' +
        '<span class="pill">' + esc((k || {}).name || '') + '</span>' +
        '<span class="pill"><span aria-hidden="true">' + esc(cond.mark || '') + '</span>' + esc(cond.name) + '</span>' +
        '<span class="pill">' + (done ? '已交卷' : '未交卷') + '</span>' +
        '<div class="spacer"></div>' +
        /* 這一組是「換題」，上面那一組是「換人」——兩個軸向要分開講 */
        '<span class="pill">第 ' + (INSPECT.idx + 1) + ' / ' + INSPECT.items.length + ' 題</span>' +
        '<button class="btn sm" data-act="inspect-prev"' + (INSPECT.idx ? '' : ' disabled') + '>← 上一題</button>' +
        '<button class="btn sm" data-act="inspect-next"' +
          (INSPECT.idx < INSPECT.items.length - 1 ? '' : ' disabled') + '>下一題 →</button>' +
      '</div>' +
      '<p class="muted small" style="margin-top:10px">這一頁不會產生任何事件日誌，也不會改到學生的資料。' +
      '對照組（無對象）沒有對話，右欄顯示的是他自己的筆記區。</p>' +
    '</div>' +

    '<div class="aal">' +
    /* ---- 左欄：文本，重播該生的標記 ---- */
    '<div class="aal-text card"><div class="card-h"><h3 id="passageTitle">' + esc(text.title) + '</h3>' +
      '<span class="pill">' + esc(text.genre) + '</span>' +
      '<span class="pill">他標記了 ' + marks.length + ' 句</span></div>' +
      '<div class="card-p">' +
      '<p class="muted small" id="passageHelp">底色與「▍」記號是這位學生自己標起來的句子，由事件日誌還原。</p>' +
      /* 唯讀重播用文字語意，不用控制項語意：
         38 顆 disabled button 會讓報讀器唸 38 次「按鈕　未按下　無法使用」。 */
      '<div class="passage" role="region" tabindex="0" aria-labelledby="passageTitle" aria-describedby="passageHelp">' +
        text.paras.map(function(_, pi){
          return '<p class="para">' + sents.filter(function(s){ return s.para === pi; }).map(function(s){
            const on = marks.indexOf(s.i) >= 0;
            return '<span class="sent' + (on ? ' on' : '') + '">' +
              (on ? '<span class="sr-only">學生標記：</span>' : '') + esc(s.text) + '</span>';
          }).join('') + '</p>';
        }).join('') +
      '</div>' +
    '</div></div>' +

    /* ---- 右欄：題目與他的作答 ＋ 對話逐字 ---- */
    '<div class="aal-side">' +
      '<div class="card"><div class="card-h"><h3>第 ' + (INSPECT.idx + 1) + ' 題</h3>' +
        procPill(it.process) + subPill(it.sub) + '</div>' +
      '<div class="card-p">' +
      '<div class="stem">' + esc(it.stem) + '</div>' +
      (it.type === 'mc' ? inspectOptions(it, resp) : inspectCR(it, resp)) +
      '</div></div>' +

      (turns.length ? inspectDialogPane(cond, turns) : inspectNotePane(sid, aid, it, cond)) +

      '<div class="card"><div class="card-h"><h3>送出前自我檢核</h3>' +
        '<span class="muted small">勾了 ' + checks.length + ' / ' + SELF_CHECKS.length + ' 項</span></div>' +
        '<div class="card-p col">' +
        SELF_CHECKS.map(function(c, i){
          const on = checks.indexOf(i) >= 0;
          return '<label class="opt" style="align-items:center"><input type="checkbox" disabled' +
            (on ? ' checked' : '') + '><span>' + esc(c) + '</span></label>';
        }).join('') +
      '</div></div>' +
    '</div></div>';
}

function subPill(sub){
  const s = SUBPROCESSES.find(function(x){ return x.id === sub; });
  return s ? '<span class="pill">' + esc(s.id) + '　' + esc(s.zh) + '</span>' : '';
}

function inspectOptions(it, resp){
  return '<div class="opts">' + it.options.map(function(o, k){
    const chosen = resp.choice === k;
    const right = k === it.answer;
    const tag = right ? '<span class="pill q1">正解</span>'
      : (it.why && it.why[k] ? '<span class="pill q2">' + esc(it.why[k]) + '　' +
          esc((MISCONCEPTIONS.find(function(m){ return m.id === it.why[k]; }) || {}).name || '') + '</span>' : '');
    return '<div class="opt' + (chosen ? ' chosen' : '') + '" style="align-items:flex-start">' +
      '<b aria-hidden="true">' + String.fromCharCode(65 + k) + '</b>' +
      '<span>' + esc(o) + '　' + tag +
      (chosen ? '<span class="pill" style="border-color:var(--accent);color:var(--accent)">他選這個</span>' : '') +
      '</span></div>';
  }).join('') + '</div>' +
  '<p class="small" style="margin-top:8px">' +
    (resp.choice == null ? '<span class="muted">沒有作答。</span>'
      : (resp.correct ? '<b>答對</b>' : '<b>答錯</b>') +
        '　·　依據位置：第 ' + (it.answerPara + 1) + ' 段第 ' + (it.answerSent + 1) + ' 句') +
  '</p>';
}

function inspectCR(it, resp){
  return '<div class="field"><label>他寫的答案</label>' +
    '<div class="note-full" style="white-space:pre-wrap">' +
    (resp.text ? esc(resp.text) : '<span class="muted">沒有作答。</span>') + '</div></div>' +
    '<p class="muted small" style="margin-top:8px">建構反應題不進入 Rasch 估計，評閱在「派題分析 → 建構反應題評閱」。</p>';
}

function inspectDialogPane(cond, turns){
  return '<div class="card aal-chat"><div class="card-h">' +
    '<h3>他的夥伴：' + esc(cond.name) + '</h3>' +
    '<span class="pill">' + turns.filter(function(t){ return t.speaker === 'student'; }).length +
    ' 次發話</span></div>' +
    '<div class="card-p">' +
    '<div class="chat" tabindex="0" role="log" aria-label="這位學生和夥伴的對話">' +
      '<div class="msg agent"><b>' + esc(cond.name) + '</b>' + esc(cond.frame) + '</div>' +
      turns.map(function(t){
        const meta = t.speaker === 'student'
          ? '<div class="muted small" style="margin-top:4px">' +
            (t.rel ? esc(REL_MARK[t.rel] + ' ' + REL_LABEL[t.rel]) : '') +
            (t.ucode ? '　·　發話歷程 ' + esc(processName(t.ucode)) : '') +
            (t.sent != null ? '　·　情感 ' + fx(t.sent, 2) : '') + '</div>'
          : (t.qfn ? '<div class="muted small" style="margin-top:4px">提問功能 ' + esc(t.qfn) +
              (t.sub ? '　·　' + esc(t.sub) : '') + '</div>' : '');
        return '<div class="msg ' + (t.speaker === 'student' ? 'me' : 'agent') + '">' +
          (t.speaker === 'agent' ? '<b>' + esc(cond.name) + '</b>' : '') + esc(t.text) + meta + '</div>';
      }).join('') +
    '</div>' +
    '<p class="muted small" style="margin-top:8px">灰字是系統的編碼，學生當時看不到。' +
    '相對歷程以這一題官方標定的歷程為基準。</p>' +
    '</div></div>';
}

function inspectNotePane(sid, aid, it, cond){
  /* 優先讀交卷時存下的完整筆記（state.aalNotes）。
     舊資料只有每 4 秒一次的 80 字 NOTE 事件尾巴，作為回退。 */
  const full = (state.aalNotes || []).filter(function(n){
    return n.sid === sid && n.aid === aid && n.iid === it.id; });
  const tail = allLogs().filter(function(e){
    return e.sid === sid && e.aid === aid && e.iid === it.id && e.code === 'N'; });
  const isControl = cond && cond.id === 'control';
  const body = full.length
    ? full.map(function(n){ return '<div class="note-full" style="white-space:pre-wrap">' +
        esc(n.text || '') + '</div>'; }).join('')
    : (tail.length
        ? '<p class="muted small">只有書寫過程的片段（舊資料沒有存完整筆記）：</p>' +
          tail.map(function(e){ return '<div class="note-full" style="white-space:pre-wrap">' +
            esc(e.text || '') + '</div>'; }).join('')
        : '<p class="muted small">這一題沒有留下' + (isControl ? '筆記' : '對話') + '記錄。</p>');
  return '<div class="card aal-chat"><div class="card-h"><h3>' +
    (isControl ? '他的筆記' : '這一題沒有對話') + '</h3>' +
    '<span class="muted small">' + (isControl ? '無對象條件' : '') + '</span></div>' +
    '<div class="card-p">' + body +
    (isControl ? '<p class="muted small" style="margin-top:8px">對照組的版面與其他三班完全一樣，' +
      '只是把對話區換成同樣大小的筆記區——版面幾何恆定，避免介面差異混進依變項。</p>' : '') +
    '</div></div>';
}
