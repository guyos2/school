// One practice session. Steps:
//  meet  — a new word: first only the English. "מכירים" goes straight to the question;
//          "עוד לא" shows the picture, the meaning and a sentence first.
//  q     — a question, English → Hebrew meaning (or, once, Hebrew → English). The kid chooses how to answer:
//          ✍️ write (or record) the answer, which proves the word is known, or 👆 choose from 4 options,
//          which counts with less certainty (see review() in srs.js).
// A wrong answer shows the correct one with the word card and the sentence, and the word comes back at the end.
import { esc, shuffle, pick, PRAISE, later, viewSignal } from './ui.js';
import { say, speakBtn, wireSpeakButtons } from './speech.js';
import { meaningMatch, acceptedMeanings } from './meaning.js';
import { directionFor, KNOWN_BOX } from './srs.js';

const SpeechRec = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

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
// onAnswer(id, ok, ms, {claim, mode}) is called once per word on its first try.
export function runPractice(outer, { words, plan, items, all, back, onAnswer, onDone }) {
  const steps = [];
  for (const { id, isNew } of plan) {
    if (!words.has(id)) continue;
    if (isNew) steps.push({ kind: 'meet', id });
    steps.push({ kind: 'q', id, dir: isNew ? 'en-he' : directionFor(items[`w:${id}`]) });
  }
  const total = steps.filter((s) => s.kind !== 'meet').length;
  let i = 0, right = 0, answered = 0, started = 0, locked = false;
  const begin = Date.now();
  const missed = new Set();
  let rec = null;
  const stopListening = () => { rec?.abort(); rec = null; };
  viewSignal().addEventListener('abort', stopListening);

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
    stopListening();
    i++;
    if (i < steps.length) show();
    else onDone({ right, total, ms: Date.now() - begin, newIds: plan.filter((p) => p.isNew).map((p) => p.id) });
  };

  const log = (step, ok, ms) => {
    if (step.retry) return;
    onAnswer(step.id, ok, ms, { claim: !!step.claim, mode: step.mode });
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
      steps.push({ kind: 'q', id: step.id, dir: step.dir, retry: true });
    }
    $('#help').innerHTML = `
      <div class="help-box">
        <div class="viz-box">${wordCard(w)}${sentence(w)}</div>
        <button class="btn btn-big" id="go">הבנתי, ממשיכים ←</button>
      </div>`;
    $('#go').onclick = next;
    later(300, () => say(w.en));
  };

  // A new word: first only the English (no picture, no meaning), so "we know it" can be checked honestly.
  function showMeet(step) {
    const w = words.get(step.id);
    stage.innerHTML = `
      <div class="q-card meet">
        <div class="tag">מילה חדשה</div>
        <div class="vo-q en">${esc(w.en)} ${speakBtn(w.en)}</div>
        <div class="q-ask">מכירים את המילה?</div>
      </div>
      <div class="meet-choices">
        <button class="btn btn-big" id="know">👍 מכירים את המילה</button>
        <button class="btn btn-soft btn-big" id="show">👀 עוד לא. תראו לי</button>
      </div>`;
    later(300, () => say(w.en));
    $('#know').onclick = () => {
      // Prove it in the next question: a right answer skips the first steps.
      const s = steps[i + 1];
      if (s && s.id === step.id) s.claim = true;
      next();
    };
    $('#show').onclick = () => {
      stage.innerHTML = `
        <div class="q-card meet">
          <div class="tag">מילה חדשה</div>
          ${wordCard(w)}
          ${sentence(w)}
        </div>
        <div class="row-center"><button class="btn btn-big" id="go">הבנתי, ממשיכים ←</button></div>`;
      $('#go').onclick = next;
    };
  }

  // The question, and the kid picks how to answer it.
  function showQuestion(step) {
    const w = words.get(step.id);
    const toHe = step.dir === 'en-he';
    const box = items[`w:${step.id}`]?.box || 0;
    stage.innerHTML = `
      <div class="q-card">
        <div class="q-ask">${step.claim ? 'מעולה! ' : ''}${toHe ? 'מה הפירוש?' : 'איך אומרים באנגלית?'}</div>
        ${toHe ? `<div class="vo-q en">${esc(w.en)} ${speakBtn(w.en)}</div>` : `<div class="vo-q">${esc(w.he)}</div>`}
        <div id="answer">
          <div class="mode-pick">
            <button class="btn btn-big" id="m-write">✍️ ${toHe ? 'נכתוב או נגיד' : 'נכתוב באנגלית'}</button>
            <button class="btn btn-soft btn-big" id="m-choice">👆 נבחר מ-4 אפשרויות</button>
          </div>
          <p class="q-sub">${box >= KNOWN_BOX - 2
            ? 'מילה נהיית ירוקה רק כשכותבים אותה נכון'
            : 'כשכותבים, יודעים בטוח שהמילה ידועה'}</p>
        </div>
        <div class="q-feedback" id="fb"></div>
      </div>
      <div id="help"></div>`;
    if (toHe) later(250, () => say(w.en));
    $('#m-write').onclick = () => { step.mode = 'write'; started = Date.now(); (toHe ? writeHebrew : writeEnglish)(step, w); };
    $('#m-choice').onclick = () => { step.mode = 'choice'; started = Date.now(); choose(step, w, toHe); };
  }

  function choose(step, w, toHe) {
    const field = toHe ? 'he' : 'en';
    const options = shuffle([w, ...distractors(w, all, field)]);
    $('#answer').innerHTML = `<div class="choices">${options.map((o, n) =>
      `<button class="choice ${toHe ? '' : 'en'}" data-n="${n}">${esc(o[field])}</button>`).join('')}</div>`;
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

  // Hebrew meaning → the English word, checked exactly (spelling counts), ignoring case and extra spaces.
  function writeEnglish(step, w) {
    const canon = (x) => String(x).toLowerCase().replace(/[()]/g, '').replace(/[.!?,]+$/, '').replace(/\s+/g, ' ').trim();
    let firstAct = 0;
    $('#answer').innerHTML = `
      <form id="form">
        <input id="ans" class="text-input wide-input en" lang="en" dir="ltr" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="English">
        <div class="row-center">
          <button class="btn" type="submit">בדיקה ✓</button>
          <button type="button" class="btn btn-soft" id="dunno">🤷 לא יודעים</button>
        </div>
      </form>
      <p class="q-sub" id="msg"></p>`;
    const input = $('#ans');
    input.focus();
    input.addEventListener('input', () => { firstAct ||= Date.now(); });
    const check = (text) => {
      if (locked) return;
      locked = true;
      input.disabled = true;
      root.querySelectorAll('#form button').forEach((b) => { b.disabled = true; });
      const ok = !!text && [w.en, w.en.replace(/^to /, '')].some((x) => canon(x) === canon(text.replace(/^to /i, '')));
      finish(step, ok, (firstAct || Date.now()) - started);
      if (!ok && text) $('#help .help-box').insertAdjacentHTML('afterbegin', `<p class="center">כתבתם: <b class="en">${esc(text)}</b></p>`);
    };
    $('#form').onsubmit = (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) { $('#msg').textContent = 'כותבים את המילה באנגלית. לא יודעים? לוחצים על "לא יודעים"'; return; }
      check(text);
    };
    $('#dunno').onclick = () => check('');
  }

  // Write or say the meaning. Speech recognition (where the browser has it) fills the box, and the kid can fix it.
  function writeHebrew(step, w) {
    let alts = [], firstAct = 0;
    $('#answer').innerHTML = `
      <form id="form">
        <input id="ans" class="text-input wide-input" lang="he" dir="rtl" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="הפירוש בעברית">
        <div class="row-center">
          ${SpeechRec ? '<button type="button" class="btn btn-soft" id="mic">🎙️ להקליט</button>' : ''}
          <button class="btn" type="submit">בדיקה ✓</button>
          <button type="button" class="btn btn-soft" id="dunno">🤷 לא יודעים</button>
        </div>
      </form>
      <p class="q-sub" id="msg">כותבים${SpeechRec ? ' או מקליטים' : ''} את הפירוש, ולוחצים על בדיקה</p>`;
    const input = $('#ans');
    if (!SpeechRec) input.focus();
    const act = () => { firstAct ||= Date.now(); };
    input.addEventListener('input', () => { act(); alts = []; });

    const check = (text) => {
      if (locked) return;
      locked = true;
      stopListening();
      input.disabled = true;
      root.querySelectorAll('#form button').forEach((b) => { b.disabled = true; });
      // Time to answer = thinking time until the kid started typing or recording, not how long writing took.
      const ms = (firstAct || Date.now()) - started;
      const ok = !!text && meaningMatch([text, ...alts], w);
      if (ok || !text) { finish(step, ok, ms); return; }
      // Not one of the listed meanings: show them, and let the kid say their answer is right too.
      finish(step, false, ms, { deferLog: true });
      $('#help .help-box').insertAdjacentHTML('afterbegin', `
        <p class="center">הפירוש שלכם: <b>${esc(text)}</b>. הפירושים ברשימה: <b>${acceptedMeanings(w).map(esc).join(', ')}</b></p>
        <div class="row-center"><button class="btn btn-soft" id="mine">✓ התשובה שלי נכונה גם כן</button></div>`);
      $('#go').onclick = () => { log(step, false, ms); next(); };
      $('#mine').onclick = () => {
        log(step, true, ms);
        const r = steps.findLastIndex((x) => x.id === step.id && x.retry);
        if (r > i) steps.splice(r, 1);
        next();
      };
    };
    $('#form').onsubmit = (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) { $('#msg').textContent = 'כותבים או מקליטים את הפירוש. לא יודעים? לוחצים על "לא יודעים"'; return; }
      check(text);
    };
    $('#dunno').onclick = () => check('');
    $('#mic')?.addEventListener('click', () => {
      if (rec) { rec.stop(); return; }
      act();
      rec = new SpeechRec();
      rec.lang = 'he-IL';
      rec.interimResults = false;
      rec.maxAlternatives = 5;
      $('#mic').textContent = '⏹️ מקשיבים… לחצו לסיום';
      $('#msg').textContent = '';
      rec.onresult = (e) => {
        alts = [...e.results[0]].map((a) => a.transcript);
        input.value = alts[0] ?? '';
        $('#msg').textContent = 'שמענו. אפשר לתקן בכתיבה, ואז לוחצים על בדיקה';
      };
      rec.onerror = (e) => {
        $('#msg').textContent = e.error === 'not-allowed'
          ? 'צריך לאשר למכשיר להשתמש במיקרופון' : 'לא הצלחנו לשמוע. נסו שוב או כתבו';
      };
      rec.onend = () => { rec = null; const b = root.querySelector('#mic'); if (b) b.textContent = '🎙️ להקליט'; };
      rec.start();
    });
  }

  function show() {
    const step = steps[i];
    locked = false;
    started = Date.now();
    $('.progress-fill').style.width = `${(answered / Math.max(total, 1)) * 100}%`;
    if (step.kind === 'meet') showMeet(step);
    else showQuestion(step);
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && $('#go')) { e.preventDefault(); $('#go').click(); }
  }, { signal: viewSignal() });

  if (!steps.length) { onDone({ right: 0, total: 0, ms: 0, newIds: [] }); return; }
  show();
}
