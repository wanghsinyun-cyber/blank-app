/* ==========================================================================
   92-ui-aal.js — 評量即學習事件的作答介面
   版面：左＝題幹（逐句可標記）＋計算紙；右＝作答區＋AI 夥伴對話區。
   四條件共用同一份版面幾何，對照組僅把對話區換成同尺寸的「我的筆記」。
   ========================================================================== */

let AAL = null;

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
             cond:AAL.cond, lang:'zh', aid:AAL.aid, iid:it.id, proc:it.process || 'K',
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
  const sents = splitSentences(it.stem);
  const marks = AAL.marks[it.id] = AAL.marks[it.id] || [];
  const turns = aalTurns(it.id);
  const used = aalStudentTurns(it.id);
  const maxT = (state.settings && state.settings.maxTurns) || MAX_TURNS;
  const proc = processOf(it.process || 'K');

  return '<div class="row" style="justify-content:space-between;align-items:flex-end;margin-bottom:12px">' +
      '<div><h2>' + esc(a.title) + '</h2>' +
      '<div class="muted small">' + esc(me.name) + '　·　' + esc((classOfStudent(me.id) || {}).name || '') +
      '　·　夥伴條件：<b>' + esc(cond.name) + '</b></div></div>' +
      '<div class="row"><span class="pill">第 ' + (AAL.idx + 1) + ' / ' + AAL.items.length + ' 題</span>' +
      '<button class="btn sm" data-act="aal-prev"' + (AAL.idx ? '' : ' disabled') + '>← 上一題</button>' +
      '<button class="btn sm" data-act="aal-next"' + (AAL.idx < AAL.items.length - 1 ? '' : ' disabled') + '>下一題 →</button>' +
      '<button class="btn primary sm" data-act="aal-submit">交卷</button></div>' +
    '</div>' +

    '<div class="aal">' +
    /* ---- 左欄：題幹逐句標記 ＋ 計算紙 ---- */
    '<div class="aal-text card"><div class="card-h"><h3>題目</h3>' +
      '<span class="pill">' + it.year + ' 年 · ' + esc(it.diff) + '</span>' +
      '<span class="pill ' + proc.cls + '">' + esc(proc.name) + '</span></div>' +
      '<div class="card-p">' +
      '<p class="muted small">點一下句子，標記你正在看的條件。標記只有你看得到，不會影響分數。</p>' +
      '<div class="sentences">' + sents.map(function(s, i){
        return '<span class="sent' + (marks.indexOf(i) >= 0 ? ' on' : '') + '" data-act="aal-mark" data-i="' + i + '">' +
          esc(s) + '</span>';
      }).join('') + '</div>' +
      '<hr class="hr">' +
      '<div class="eyebrow">計算紙</div>' +
      '<canvas class="pad" data-pad="aal-' + it.id + '" height="220"></canvas>' +
      '<div class="row" style="margin-top:6px">' +
        '<button class="btn sm" data-act="pad-undo" data-id="aal-' + it.id + '">復原</button>' +
        '<button class="btn sm" data-act="pad-clear" data-id="aal-' + it.id + '">清空</button>' +
      '</div>' +
    '</div></div>' +

    /* ---- 右欄：作答區 ＋ 對話／筆記 ---- */
    '<div class="aal-side">' +
      '<div class="card"><div class="card-h"><h3>我的作答</h3></div><div class="card-p">' +
      (it.type === 'mc'
        ? '<div class="opts">' + it.options.map(function(o, k){
            return '<label class="opt' + (AAL.answers[it.id] === k ? ' chosen' : '') + '">' +
              '<input type="radio" name="aal-' + it.id + '" data-act="aal-pick" data-k="' + k + '"' +
              (AAL.answers[it.id] === k ? ' checked' : '') + '>' +
              '<b>' + String.fromCharCode(65 + k) + '</b><span>' + esc(o) + '</span></label>';
          }).join('') + '</div>'
        : '<textarea data-act="aal-text" style="min-height:150px" placeholder="寫出你的解題過程與說明">' +
          esc(AAL.texts[it.id] || '') + '</textarea>') +
      '</div></div>' +

      (AAL.cond === 'control' ? aalNotePane(it) : aalDialogPane(it, cond, turns, used, maxT)) +

      '<div class="card"><div class="card-h"><h3>送出前自我檢核</h3>' +
        '<span class="muted small">勾不勾由你決定</span></div><div class="card-p col">' +
        SELF_CHECKS.map(function(c, i){
          const on = (AAL.checks[it.id] || []).indexOf(i) >= 0;
          return '<label class="opt" style="align-items:center"><input type="checkbox" data-act="aal-check" data-i="' + i + '"' +
            (on ? ' checked' : '') + '><span>' + esc(c) + '</span></label>';
        }).join('') +
      '</div></div>' +
    '</div></div>';
}

function aalDialogPane(it, cond, turns, used, maxT){
  const left = maxT - used;
  return '<div class="card aal-chat"><div class="card-h">' +
    '<h3>我的夥伴：' + esc(cond.name) + '</h3>' +
    '<span class="pill">還可以說 ' + Math.max(0, left) + ' 次</span></div>' +
    '<div class="card-p">' +
    '<div class="chat" id="aalChat">' +
      '<div class="msg agent"><b>' + esc(cond.name) + '</b>' + esc(cond.frame) + '</div>' +
      turns.map(function(t){
        return '<div class="msg ' + (t.speaker === 'student' ? 'me' : 'agent') + '">' +
          (t.speaker === 'agent' ? '<b>' + esc(cond.name) + '</b>' : '') + esc(t.text) + '</div>';
      }).join('') +
      (left <= 0 ? '<div class="msg sys">這一題的對話次數用完了。換下一題會重新計算。</div>' : '') +
    '</div>' +
    '<div class="row" style="margin-top:10px;gap:6px">' +
      '<input type="text" id="aalSay" placeholder="' + (left > 0 ? '說說你現在的想法…' : '這一題已經聊完了') +
      '"' + (left > 0 ? '' : ' disabled') + ' style="flex:1">' +
      '<button class="btn primary sm" data-act="aal-say"' + (left > 0 ? '' : ' disabled') + '>送出</button>' +
    '</div>' +
    '<p class="muted small" style="margin-top:8px">夥伴不會告訴你答案，也不會說你對或錯——它只會一直問你怎麼想的。</p>' +
    '</div></div>';
}

function aalNotePane(it){
  return '<div class="card aal-chat"><div class="card-h"><h3>我的筆記</h3>' +
    '<span class="muted small">只有你看得到</span></div><div class="card-p">' +
    '<textarea data-act="aal-note" style="min-height:210px" placeholder="把你想到的、卡住的地方寫下來">' +
    esc(AAL.notes[it.id] || '') + '</textarea>' +
    '<p class="muted small" style="margin-top:8px">這一節沒有 AI 夥伴。版面與其他班完全一樣，' +
    '只是把對話區換成同樣大小的筆記區。</p>' +
    '</div></div>';
}

/* --- 互動處理 --- */
function aalMark(i){
  const it = aalItem();
  const m = AAL.marks[it.id] = AAL.marks[it.id] || [];
  const k = m.indexOf(i);
  if (k >= 0) m.splice(k, 1); else m.push(i);
  aalLog('MARK', 'M', {sent:i, on: k < 0});
  render();
}

function aalPick(k){
  const it = aalItem();
  const first = AAL.answers[it.id] === undefined;
  AAL.answers[it.id] = k;
  if (first) AAL.drafts[it.id] = {first: k, final: k};
  else AAL.drafts[it.id].final = k;
  aalLog('OPTION', 'O', {choice:k, changed: !first});
  render();
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
  box.value = '';
  render();

  let reply;
  if (aiEngine() === 'llm'){
    try {
      const raw = await llmChat([
        {role:'system', content: composePrompt(AAL.cond, it.process || 'K', TURN_SCHEDULE[Math.min(used, TURN_SCHEDULE.length - 1)])},
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
  render();
  const c = document.getElementById('aalChat');
  if (c) c.scrollTop = c.scrollHeight;
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
  const aid = AAL.aid;
  AAL = null;
  toast('已交卷。接下來是這節課的問卷。');
  go('#/survey/post');
}

/* ==========================================================================
   問卷施測
   ========================================================================== */
let SURVEY = null;

function viewSurvey(phase){
  const me = currentUser();
  if (me.role !== 'student') return '<div class="empty"><h3>請切換成學生身分</h3>' +
    '<p>問卷是學生端的畫面。</p></div>';
  const done = surveyOf(me.id, phase);
  if (!SURVEY || SURVEY.phase !== phase || SURVEY.sid !== me.id){
    SURVEY = {phase:phase, sid:me.id, resp: done ? Object.assign({}, done.resp) : {}};
  }
  const cs = constructsFor(phase);
  const cond = conditionOfStudent(me.id);
  const total = cs.reduce(function(a, c){ return a + c.items.length; }, 0) +
    (phase === 'post' ? (cond === 'control' ? 0 : MANIP_CHECK.length) + SUS_ITEMS.length : 0);
  const answered = Object.keys(SURVEY.resp).filter(function(k){ return SURVEY.resp[k]; }).length;

  function block(title, items, scale, prefix, cls){
    return '<div class="card" style="margin-bottom:14px"><div class="card-h">' +
      '<h3 class="' + (cls || '') + '">' + esc(title) + '</h3>' +
      '<span class="muted small">' + scale.n + ' 點量尺</span></div><div class="card-p col">' +
      items.map(function(txt, i){
        const key = prefix + '_' + i;
        return '<div class="likert"><div class="q">' + (i + 1) + '. ' + esc(txt) + '</div>' +
          '<div class="scale">' + new Array(scale.n).fill(0).map(function(_, v){
            const val = v + 1;
            return '<button class="lk' + (SURVEY.resp[key] === val ? ' on' : '') + '"' +
              ' data-act="sv-pick" data-k="' + key + '" data-v="' + val + '"' +
              ' title="' + esc(scale.labels[v]) + '">' + val + '</button>';
          }).join('') + '</div>' +
          '<div class="scale-lab"><span>' + esc(scale.labels[0]) + '</span>' +
          '<span>' + esc(scale.labels[scale.n - 1]) + '</span></div></div>';
      }).join('') + '</div></div>';
  }

  return sectionHead(phase === 'pre' ? '課前問卷' : '課後問卷',
      '沒有標準答案，照你真正的感覺選就好。共 ' + total + ' 題，已完成 ' + answered + ' 題。',
      '<button class="btn primary" data-act="sv-submit" data-id="' + phase + '">送出問卷</button>') +
    '<div class="card card-p" style="margin-bottom:14px;border-left:3px solid var(--warn)">' +
    '<p class="small" style="margin:0">本平台內建的題項是<strong>依構念自撰的示範題</strong>，' +
    '用來讓施測與計分流程完整可跑。正式研究請改用已完成中譯與信效度驗證的公開量表，' +
    '並經專家審查與學童認知訪談。</p></div>' +
    cs.map(function(c){ return block(c.name + '（' + c.dim + '）', c.items, c.scale, c.id, c.cls); }).join('') +
    (phase === 'post' && cond !== 'control'
      ? block('角色知覺（操弄檢核）', MANIP_CHECK.map(function(m){ return m.text; }), SCALE6, 'mc_x', '') : '') +
    (phase === 'post' ? block('系統使用感受', SUS_ITEMS.map(function(s){ return s.text; }), SCALE6, 'sys_x', '') : '') +
    '<div class="row" style="justify-content:flex-end;margin-top:16px">' +
    '<button class="btn primary" data-act="sv-submit" data-id="' + phase + '">送出問卷</button></div>';
}

function surveySubmit(phase){
  const me = currentUser();
  const cs = constructsFor(phase);
  const need = cs.reduce(function(a, c){ return a + c.items.length; }, 0);
  const got = cs.reduce(function(a, c){
    return a + c.items.filter(function(_, i){ return SURVEY.resp[c.id + '_' + i]; }).length; }, 0);
  if (got < need && !confirm('還有 ' + (need - got) + ' 題沒作答，確定要送出嗎？')) return;

  // 操弄檢核與使用感受用固定鍵存回原本的 id
  const resp = Object.assign({}, SURVEY.resp);
  MANIP_CHECK.forEach(function(m, i){ if (resp['mc_x_' + i]) resp[m.id] = resp['mc_x_' + i]; });
  SUS_ITEMS.forEach(function(s, i){ if (resp['sys_x_' + i]) resp[s.id] = resp['sys_x_' + i]; });

  state.surveys = (state.surveys || []).filter(function(s){
    return !(s.sid === me.id && s.phase === phase); });
  state.surveys.push({sid:me.id, phase:phase, at:Date.now(), resp:resp});
  save();
  SURVEY = null;
  toast('問卷已送出，謝謝你。');
  go('#/student');
}
