/* ==========================================================================
   92-ui-aal.js — 評量即學習事件的作答介面
   版面：左＝題幹（逐句可標記）＋計算紙；右＝作答區＋AI 夥伴對話區。
   四條件共用同一份版面幾何，對照組僅把對話區換成同尺寸的「我的筆記」。
   ========================================================================== */

let AAL = null;

/* 作答草稿。刻意用獨立的 localStorage key，不擠進 50-kb.js 的 save()——
   那一支會靜默吞掉配額錯誤，而學生的 16 題作答不能靜默遺失。 */
const AAL_DRAFT_KEY = 'kairos-draft';

function aalDraftId(){ return AAL.aid + '|' + AAL.me; }

function aalSave(){
  if (!AAL) return;
  try {
    const all = JSON.parse(localStorage.getItem(AAL_DRAFT_KEY) || '{}');
    all[aalDraftId()] = {idx:AAL.idx, answers:AAL.answers, texts:AAL.texts, notes:AAL.notes,
                         marks:AAL.marks, checks:AAL.checks, savedAt:Date.now()};
    localStorage.setItem(AAL_DRAFT_KEY, JSON.stringify(all));
  } catch (e) { toast('這一題沒能存起來，先不要關掉分頁。'); }
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
    answers: {}, texts: {}, notes: {}, marks: {}, checks: {}, turns: {},
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
      AAL.t0 = Date.now();
      aalLog('RESUME', 'R', {resumed:true, savedAt:d.savedAt || null});
    }
  } catch (e) { /* 草稿壞掉就當作沒有，從頭開始 */ }
}

function aalItem(){ return AAL.items[AAL.idx]; }
function aalTurns(iid){ return AAL.turns[iid] = AAL.turns[iid] || []; }
function aalStudentTurns(iid){
  return aalTurns(iid).filter(function(t){ return t.speaker === 'student'; }).length;
}
function aalTele(iid){
  return AAL.tele[iid] = AAL.tele[iid] || {firstKeyLatency:null, keystrokes:0, deletions:0,
    longPauses:0, lastKey:null, enter:Date.now(), prevLen:0};
}

function aalLog(type, code, extra){
  const it = aalItem();
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
  const turns = aalTurns(it.id);
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
      '<div class="row">' +
      '<a class="btn sm" href="#/student">← 先離開（進度會保留）</a>' +
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
          '<p class="sr-only">用上下方向鍵聽過每個選項，停在你要的答案上就算選好。</p>'
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
        '<button class="skip" data-act="back-to-passage" type="button">回到文章</button>' +
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
    ' aria-label="我和夥伴的對話">' +
      '<div class="msg agent"><b>' + esc(cond.name) + '</b>' + esc(cond.frame) + '</div>' +
      turns.map(function(t){
        return '<div class="msg ' + (t.speaker === 'student' ? 'me' : 'agent') + '">' +
          (t.speaker === 'agent' ? '<b>' + esc(cond.name) + '</b>' : '') + esc(t.text) + '</div>';
      }).join('') +
      (left <= 0 ? '<div class="msg sys">這一題的對話次數用完了。換下一題會重新計算。</div>' : '') +
    '</div>' +
    '<label class="sr-only" for="aalSay">對夥伴說一句話</label>' +
    '<div class="row pane-bar" style="margin-top:10px;gap:6px">' +
      '<input type="text" id="aalSay" placeholder="' + (left > 0 ? '說說你現在的想法…' : '這一題已經聊完了') +
      '"' + (left > 0 ? '' : ' disabled') + ' style="flex:1">' +
      '<button class="btn primary sm" data-act="aal-say"' + (left > 0 ? '' : ' disabled') + '>送出</button>' +
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
    '<span class="pill">已寫 ' + txt.length + ' 字</span></div>' +
    '<div class="card-p">' +
    '<label class="sr-only" for="aalNote">我的筆記</label>' +
    '<textarea id="aalNote" data-act="aal-note" style="height:var(--pane-h)" ' +
    'placeholder="把你想到的、還沒想通的，寫在這裡">' + esc(txt) + '</textarea>' +
    '<div class="row pane-bar" style="margin-top:10px;gap:6px">' +
      '<button class="btn sm" data-act="aal-note-clear">清空</button>' +
      '<span class="muted small" style="flex:1">這一題一份，換題會換成新的一頁。</span>' +
    '</div>' +
    '<p class="muted small pane-foot" style="margin-top:8px">把你想到的、還沒想通的，寫在這裡。' +
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

  clearTimeout(aalPick._t);
  aalPick._t = setTimeout(function(){
    if (AAL.answers[it.id] !== k) return;     // 期間又改了，這一次不算
    const first = !AAL.drafts[it.id];
    if (first) AAL.drafts[it.id] = {first: k, final: k};
    else AAL.drafts[it.id].final = k;
    aalLog('OPTION', 'O', {choice:k, changed: !first});
    aalSave();
  }, OPTION_DEBOUNCE_MS);
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
  const box = document.getElementById('aalSay');
  if (!box) return;
  const text = box.value.trim();
  if (!text) return;
  const it = aalItem();
  const maxT = (state.settings && state.settings.maxTurns) || MAX_TURNS;
  const used = aalStudentTurns(it.id);
  if (used >= maxT){ toast('這一題的對話次數用完了。'); return; }

  const rel = relativeProcessCode(text, it);
  const sm = sentimentOf(text);
  aalTurns(it.id).push({speaker:'student', text:text, rel:rel, at:Date.now()});
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
  box.disabled = true;
  if (sendBtn) sendBtn.disabled = true;
  if (chat){
    chat.insertAdjacentHTML('beforeend',
      '<div class="msg agent" id="aalThinking">' + esc(condition(AAL.cond).name) + '正在想…</div>');
    chat.scrollTop = chat.scrollHeight;
  }
  aalSave();

  let reply;
  if (aiEngine() === 'llm'){
    try {
      const raw = await llmChat([
        {role:'system', content: composePrompt(AAL.cond, it.process || 'FR', TURN_SCHEDULE[Math.min(used, TURN_SCHEDULE.length - 1)])},
        {role:'user', content:'【題目】' + it.stem + '\n【學生剛剛說】' + text}
      ], {max_tokens:200, temperature:0.7});
      const g = leakGuard(raw, it);
      reply = {text:g.text, qfn:TURN_SCHEDULE[Math.min(used, TURN_SCHEDULE.length - 1)],
               sub:null, engine:'llm', blocked:g.blocked, hits:g.hits};
    } catch (err) {
      reply = agentTurn(AAL.cond, it, used);
      reply.fallback = err.message;
    }
  } else {
    reply = agentTurn(AAL.cond, it, used);
  }

  aalTurns(it.id).push({speaker:'agent', text:reply.text, at:Date.now()});
  const ea = aalLog('AI', 'A', {text:reply.text, qfn:reply.qfn, sub:reply.sub,
    turn:used + 1, engine:reply.engine, blocked: !!reply.blocked});
  state.dialog.push({t:ea.t, sid:AAL.me, cond:AAL.cond, aid:AAL.aid, iid:it.id,
    proc:it.process, turn:used + 1, speaker:'agent', text:reply.text,
    qfn:reply.qfn, sub:reply.sub, ucode:reply.process || it.process, sent:0});
  save();
  aalSave();

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
  if (left > 0){
    box.disabled = false;
    if (sendBtn) sendBtn.disabled = false;
    box.focus();
  } else {
    box.placeholder = '這一題已經聊完了';
    if (chat) chat.insertAdjacentHTML('beforeend',
      '<div class="msg sys">這一題的對話次數用完了。換下一題會重新計算。</div>');
    toast('這一題的對話次數用完了，可以按下一題。');
  }
}

function aalSubmit(){
  const a = getAssignment(AAL.aid), me = currentUser();
  const mcs = AAL.items.filter(function(i){ return i.type === 'mc'; });
  const missing = mcs.filter(function(i){ return AAL.answers[i.id] === undefined; });
  if (missing.length && !confirm('還有 ' + missing.length + ' 題沒作答，確定要交卷嗎？')) return;

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
        choice: c === undefined ? null : c, correct: c === it.answer});
    }
  });
  state.submissions = state.submissions.filter(function(s){ return !(s.aid === AAL.aid && s.sid === me.id); });
  state.submissions.push({aid:AAL.aid, sid:me.id, at:Date.now()});
  save();
  aalDropDraft();          // 交出去了，草稿不用留
  AAL = null;
  toast('已交卷。接下來是這節課的問卷。');
  go('#/survey/post');
}

/* ==========================================================================
   問卷施測
   ========================================================================== */
let SURVEY = null;

/* 這一份問卷實際要作答的所有題鍵。抬頭的題數與送出前的檢查都吃這一個來源，
   否則會出現「抬頭說 47 題、送出只檢查 41 題」，操弄檢核與使用感受整段留白也送得出去。
   cond 參數不可省：對照組不施操弄檢核，否則會被要求填不存在的三題而永遠送不出去。 */
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
const SURVEY_SECTION_SUB = ['關於你怎麼讀', '關於這節課的感覺', '關於你自己'];

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

  if (!SURVEY || SURVEY.phase !== phase || SURVEY.sid !== me.id){
    const d = surveyDraftLoad(me.id, phase);
    SURVEY = {phase:phase, sid:me.id,
              resp: d ? d.resp : (done ? Object.assign({}, done.resp) : {}),
              page: d ? d.page : 1};
  }
  SURVEY.page = Math.max(1, Math.min(page || SURVEY.page || 1, secs.length));

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
      '<div class="card-h"><h3>第 ' + SURVEY.page + ' 段　·　' +
      esc(SURVEY_SECTION_SUB[(SURVEY.page - 1) % SURVEY_SECTION_SUB.length]) + '</h3>' +
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
        '這份問卷分成 ' + secs.length + ' 段，中間可以休息。</p></div>'
      : '') +
    (scaleChanged
      ? '<div class="card card-p" style="margin-bottom:14px;border-left:3px solid var(--accent)">' +
        '<p class="small" style="margin:0">接下來的題目改成問「符不符合你」，' +
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
        const el = document.querySelector('[data-k="' + miss[0] + '"]');
        if (el){
          const row = el.closest('.likert');
          if (row) row.classList.add('missing');
          el.focus();
          el.scrollIntoView({block:'center'});
        }
      }, 0);
      return;
    }
  }

  // 操弄檢核與使用感受用固定鍵存回原本的 id。
  // 未答一律寫成 null，讓分析端能用「鍵存在但值為 null」區分漏答與未施測；
  // 對照組不建 mc_* 鍵，因為那三題本來就不對他施測。
  const resp = Object.assign({}, SURVEY.resp);
  if (phase === 'post' && cond !== 'control'){
    MANIP_CHECK.forEach(function(m, i){ resp[m.id] = SURVEY.resp['mc_x_' + i] || null; });
  }
  if (phase === 'post'){
    SUS_ITEMS.forEach(function(s, i){ resp[s.id] = SURVEY.resp['sys_x_' + i] || null; });
  }

  state.surveys = (state.surveys || []).filter(function(s){
    return !(s.sid === me.id && s.phase === phase); });
  state.surveys.push({sid:me.id, phase:phase, at:Date.now(), resp:resp});
  save();
  surveyDraftDrop(me.id, phase);
  SURVEY = null;
  toast('問卷已送出，謝謝你。');
  go('#/student');
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
  const on = {};
  allLogs().forEach(function(e){
    if (e.sid !== sid || e.aid !== aid || e.code !== 'M') return;
    if (e.textId && e.textId !== textId) return;
    if (e.sent == null) return;
    if (e.on === false) delete on[e.sent]; else on[e.sent] = 1;
  });
  return Object.keys(on).map(Number);
}

function viewInspect(aid, sid){
  if (!isTeacher()) return '<div class="empty"><h3>這一頁只有教師與研究者看得到</h3></div>';
  const a = getAssignment(aid);
  if (!a) return '<div class="empty"><h3>找不到這份派題</h3><a class="btn" href="#/teacher">回教師後台</a></div>';
  const roster = assignmentRoster(a);
  if (!sid || roster.indexOf(sid) < 0) sid = roster[0];
  if (!sid) return '<div class="empty"><h3>這份派題還沒有學生</h3></div>';
  if (!INSPECT || INSPECT.aid !== aid || INSPECT.sid !== sid) inspectInit(aid, sid);

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
  const checks = allLogs().filter(function(e){
    return e.sid === sid && e.aid === aid && e.iid === it.id && e.code === 'C'; });
  const done = submitted(aid, sid);

  /* 全部學生的下拉，讓教師不必回上一頁就能換人 */
  const picker = '<select id="inspectWho" data-act="inspect-who" style="width:auto">' +
    roster.map(function(x){
      return '<option value="' + x + '"' + (x === sid ? ' selected' : '') + '>' +
        esc(userName(x)) + '（' + esc(condition(conditionOfStudent(x)).name) + '）</option>';
    }).join('') + '</select>';

  return sectionHead('作答與 AI 互動檢視',
      esc(a.title) + '　·　與學生當時看到的版面相同，此處為唯讀重播。',
      '<a class="btn" href="#/assign/' + aid + '">← 回派題分析</a>') +

    '<div class="card card-p" style="margin-bottom:14px">' +
      '<div class="row" style="gap:14px;flex-wrap:wrap;align-items:center">' +
        '<label class="small muted" for="inspectWho">學生</label>' + picker +
        '<span class="pill">' + esc((k || {}).name || '') + '</span>' +
        '<span class="pill"><span aria-hidden="true">' + esc(cond.mark || '') + '</span>' + esc(cond.name) + '</span>' +
        '<span class="pill">' + (done ? '已交卷' : '未交卷') + '</span>' +
        '<div class="spacer"></div>' +
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
      '<div class="passage" role="group" aria-labelledby="passageTitle" aria-describedby="passageHelp">' +
        text.paras.map(function(_, pi){
          return '<p class="para">' + sents.filter(function(s){ return s.para === pi; }).map(function(s){
            const on = marks.indexOf(s.i) >= 0;
            return '<button type="button" class="sent' + (on ? ' on' : '') + '" disabled' +
              ' aria-pressed="' + on + '">' + esc(s.text) + '</button>';
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
          const on = checks.some(function(e){ return e.idx === i; });
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
    '<div class="chat">' +
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
