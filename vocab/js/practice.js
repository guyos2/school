// One practice session. Steps:
//  meet   — a new word: picture, word, meaning and a sentence. "כבר מכירים" turns the next step into writing the meaning.
//  mc-he  — English word → choose the Hebrew meaning
//  mc-en  — Hebrew meaning → choose the English word
//  write  — English word → write (or say) the meaning; several meanings count, and the kid can mark their answer as right
// A wrong answer shows the correct one with the word card and the sentence, and the word comes back at the end.
import { esc, shuffle, pick, PRAISE, later, viewSignal } from './ui.js';
import { say, speakBtn, wireSpeakButtons } from './speech.js';
import { meaningMatch, acceptedMeanings } from './meaning.js';
import { exerciseFor } from './srs.js';

const POS = { n: 'שם עצם', v: 'פועל', adj: 'תואר', adv: 'תואר הפועל', prep: 'מילת יחס', phrase: 'ביטוי' };

export function wordCard(w) {
  return `
    <div class="vo-card">
      <div class="vo-emoji">${w.emoji || '📝'}</div>
      <div class="vo-word en">${esc(w.en)} ${speakBtn(w.en)}</div>
      ${POS[w.pos] ? `<div class="vo-pos">${POS[w.pos]}</div>` : ''}
      <div class="vo-he">${esc(w.he)}</div>
    </div>`;
}

const sentence = (w) => (w.ex ? `
  <div class="vo-sentence en">${esc(w.ex)} ${speakBtn(w.ex)}</div>
  <div class="vo-sentence-he">${esc(w.exHe || '')}</div>` : '');

// Up to 3 distractors: same part of speech first, never the same meaning or spelling.
function distractors(w, all, field) {
  const ok = (x) => x.id !== w.id && x[field] && x[field] !== w[field] && x.en.toLowerCase() !== w.en.toLowerCase();
  const same = shuffle(all.filter((x) => ok(x) && x.pos && x.pos === w.pos));
  const rest = shuffle(all.filter((x) => ok(x) && !same.includes(x)));
  const out = [];
  for (const x of [...same, ...rest]) {
    if (!out.some((y) => y[field] === x[field])) out.push(x);
    if (out.length === 3) break;
  }
  return out;
}

// words: Map id → word. plan: [{id, isNew}]. items: current SRS items (to pick each word's exercise).
// onAnswer(id, ok, ms, {claim}) is called once per word on its first try.
export function runPractice(outer, { words, plan, items, all, back, onAnswer, onDone }) {
  const steps = [];
  for (const { id, isNew } of plan) {
    if (!words.has(id)) continue;
    if (isNew) steps.push({ kind: 'meet', id });
    steps.push({ kind: isNew ? 'mc-he' : exerciseFor(items[`w:${id}`]), id });
  }
  const total = steps.filter((s) => s.kind !== 'meet').length;
  let i = 0, right = 0, answered = 0, started = 0, locked = false;
  const begin = Date.now();
  const missed = new Set();

  outer.innerHTML = '<div class="quiz"></div>';
  const root = outer.firstElementChild;
  root.innerHTML = `
    <a class="back" href="${back}">→ חזרה</a>
    <div class="progress-bar"><div class="progress-fill"></div></div>
    <div id="stage"></div>`;
  wireSpeakButtons(root);
  const $ = (s) => root.querySelector(s);
  const stage = $('#stage');

  const next = () => {
    i++;
    if (i < steps.length) show();
    else onDone({ right, total, ms: Date.now() - begin, newIds: plan.filter((p) => p.isNew).map((p) => p.id) });
  };

  const log = (step, ok, ms) => {
    if (step.retry) return;
    onAnswer(step.id, ok, ms, { claim: !!step.claim });
    answered++;
    if (ok) right++;
  };

  // deferLog: a written answer that is not on the list is logged only after the kid decides whether it was right.
  const finish = (step, ok, ms, { deferLog = false } = {}) => {
    if (!deferLog) log(step, ok, ms);
    const w = words.get(step.id);
    const fb = $('#fb');
    if (ok) {
      fb.textContent = pick(PRAISE);
      fb.className = 'q-feedback good';
      later(1100, next);
      return;
    }
    fb.textContent = 'כמעט! הנה התשובה הנכונה 👇';
    fb.className = 'q-feedback bad';
    if (!missed.has(step.id)) {
      missed.add(step.id);
      // Next time an easier exercise: choosing, not writing.
      steps.push({ kind: step.kind === 'write' ? 'mc-he' : step.kind, id: step.id, retry: true });
    }
    $('#help').innerHTML = `
      <div class="help-box">
        <div class="viz-box">${wordCard(w)}${sentence(w)}</div>
        <button class="btn btn-big" id="go">הבנתי, ממשיכים ←</button>
      </div>`;
    $('#go').onclick = next;
    later(300, () => say(w.en));
  };

  function showMeet(step) {
    const w = words.get(step.id);
    stage.innerHTML = `
      <div class="q-card meet">
        <div class="tag">מילה חדשה</div>
        ${wordCard(w)}
        ${sentence(w)}
      </div>
      <div class="row-center">
        <button class="btn btn-big" id="ok">הבנתי, ממשיכים ←</button>
        <button class="btn btn-soft" id="know">כבר מכירים את המילה</button>
      </div>`;
    later(300, () => say(w.en));
    $('#ok').onclick = next;
    $('#know').onclick = () => {
      // Prove it: the next step becomes writing the meaning, and a right answer skips the easy steps.
      const s = steps[i + 1];
      if (s && s.id === step.id) Object.assign(s, { kind: 'write', claim: true });
      next();
    };
  }

  function showChoice(step) {
    const w = words.get(step.id);
    const toHe = step.kind === 'mc-he';
    const field = toHe ? 'he' : 'en';
    const options = shuffle([w, ...distractors(w, all, field)]);
    stage.innerHTML = `
      <div class="q-card">
        <div class="q-ask">${toHe ? 'מה הפירוש?' : 'איך אומרים באנגלית?'}</div>
        ${toHe
          ? `<div class="vo-q en">${esc(w.en)} ${speakBtn(w.en)}</div>`
          : `<div class="vo-q">${esc(w.he)}</div>`}
        <div class="q-feedback" id="fb"></div>
      </div>
      <div class="choices words">${options.map((o, n) =>
        `<button class="choice ${toHe ? '' : 'en'}" data-n="${n}">${esc(o[field])}</button>`).join('')}</div>
      <div id="help"></div>`;
    if (toHe) later(250, () => say(w.en));
    $('.choices').addEventListener('click', (e) => {
      const b = e.target.closest('.choice');
      if (!b || locked) return;
      locked = true;
      const n = +b.dataset.n;
      root.querySelectorAll('.choice').forEach((x, k) => {
        x.classList.add(options[k] === w ? 'correct' : k === n ? 'wrong' : 'dim');
      });
      finish(step, options[n] === w, Date.now() - started);
    });
  }

  function showWrite(step) {
    const w = words.get(step.id);
    stage.innerHTML = `
      <div class="q-card">
        <div class="q-ask">${step.claim ? 'מכירים? כתבו מה הפירוש' : 'כתבו מה הפירוש בעברית'}</div>
        <div class="vo-q en">${esc(w.en)} ${speakBtn(w.en)}</div>
        <form class="write-row" id="form">
          <input id="ans" class="text-input" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="הפירוש בעברית">
          <button class="btn">בדיקה</button>
        </form>
        <button class="link-btn" id="dunno">לא יודעים</button>
        <div class="q-feedback" id="fb"></div>
      </div>
      <div id="help"></div>`;
    later(250, () => say(w.en));
    const input = $('#ans');
    input.focus();
    const check = (text) => {
      if (locked) return;
      locked = true;
      input.disabled = true;
      $('#dunno').remove();
      const ms = Date.now() - started;
      const ok = !!text && meaningMatch([text], w);
      if (ok || !text) { finish(step, ok, ms); return; }
      // Not one of the listed meanings: show them, and let the kid say their answer is right too.
      finish(step, false, ms, { deferLog: true });
      $('#help .help-box').insertAdjacentHTML('afterbegin', `
        <p class="center">כתבתם: <b>${esc(text)}</b>. הפירושים ברשימה: <b>${acceptedMeanings(w).map(esc).join(', ')}</b></p>
        <div class="row-center"><button class="btn btn-soft" id="mine">התשובה שלי נכונה גם כן</button></div>`);
      $('#go').onclick = () => { log(step, false, ms); next(); };
      $('#mine').onclick = () => {
        log(step, true, ms);
        const r = steps.findLastIndex((x) => x.id === step.id && x.retry);
        if (r > i) steps.splice(r, 1);
        next();
      };
    };
    $('#form').onsubmit = (e) => { e.preventDefault(); check(input.value.trim()); };
    $('#dunno').onclick = () => check('');
  }

  function show() {
    const step = steps[i];
    locked = false;
    started = Date.now();
    $('.progress-fill').style.width = `${(answered / Math.max(total, 1)) * 100}%`;
    if (step.kind === 'meet') showMeet(step);
    else if (step.kind === 'write') showWrite(step);
    else showChoice(step);
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && $('#go')) { e.preventDefault(); $('#go').click(); }
  }, { signal: viewSignal() });

  if (!steps.length) { onDone({ right: 0, total: 0, ms: 0, newIds: [] }); return; }
  show();
}
