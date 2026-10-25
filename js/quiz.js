// Multiple-choice practice engine shared by modules.
// question: { key, prompt: html, speak?: text spoken on show, onShow?: () => void, options: [{ html, value }], answer,
//             help: () => html shown after a wrong answer, after?: () => void on a correct answer }
import { pick, PRAISE, later, viewSignal } from './ui.js';
import { say, wireSpeakButtons } from './speech.js';

export function runQuiz(outer, { back, questions, onResult, onDone }) {
  let root = outer;
  const queue = [...questions];
  const total = queue.length;
  const missed = new Set();
  let i = 0, right = 0, started = 0, locked = false;
  const begin = Date.now();

  // A fresh inner element per run, so listeners never pile up on the shared root.
  root.innerHTML = '<div class="quiz"></div>';
  root = root.firstElementChild;
  root.innerHTML = `
    <a class="back" href="${back}">→ חזרה</a>
    <div class="progress-bar"><div class="progress-fill"></div></div>
    <div class="q-card"><div id="prompt"></div><div class="q-feedback" id="fb"></div></div>
    <div class="choices" id="choices"></div>
    <div id="help"></div>`;
  const $ = (s) => root.querySelector(s);
  wireSpeakButtons(root);

  const show = () => {
    const q = queue[i];
    locked = false; started = Date.now();
    $('#prompt').innerHTML = q.prompt;
    $('#fb').textContent = ''; $('#fb').className = 'q-feedback';
    $('#help').innerHTML = '';
    $('#choices').innerHTML = q.options.map((o, n) =>
      `<button class="choice" data-n="${n}">${o.html}</button>`).join('');
    $('.progress-fill').style.width = `${(i / queue.length) * 100}%`;
    if (q.speak) later(250, () => say(q.speak));
    q.onShow?.();
  };

  const answer = (n) => {
    if (locked) return;
    locked = true;
    const q = queue[i];
    const ok = q.options[n].value === q.answer;
    if (!q.retry) {
      onResult(q, ok, Date.now() - started);
      if (ok) right++;
    }
    const buttons = [...root.querySelectorAll('.choice')];
    buttons.forEach((b, k) => {
      if (q.options[k].value === q.answer) b.classList.add('correct');
      else if (k === n) b.classList.add('wrong');
      else b.classList.add('dim');
    });
    if (ok) {
      $('#fb').textContent = pick(PRAISE);
      $('#fb').className = 'q-feedback good';
      q.after?.();
      later(1100, next);
    } else {
      $('#fb').textContent = 'כמעט! הנה התשובה הנכונה 👇';
      $('#fb').className = 'q-feedback bad';
      if (!missed.has(q.key)) { missed.add(q.key); queue.push({ ...q, retry: true }); }
      $('#help').innerHTML = `<div class="help-box">${q.help()}<button class="btn btn-big" id="go">הבנתי, ממשיכים ←</button></div>`;
      $('#go').onclick = next;
    }
  };

  const next = () => {
    i++;
    if (i < queue.length) show(); else onDone({ right, total, ms: Date.now() - begin });
  };

  $('#choices').addEventListener('click', (e) => {
    const b = e.target.closest('.choice');
    if (b) answer(+b.dataset.n);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && locked && $('#go')) next();
  }, { signal: viewSignal() });
  show();
}

export function finishScreen(root, { right, total, extra = '', again, links = '' }) {
  const ratio = right / Math.max(total, 1);
  const stars = ratio >= 0.9 ? 3 : ratio >= 0.6 ? 2 : 1;
  root.innerHTML = `
    <div class="finish">
      <div class="stars">${'⭐'.repeat(stars)}</div>
      <h1>סיימתם את הסיבוב!</h1>
      <p class="subtitle">${right} נכונות בניסיון הראשון מתוך ${total}</p>
      ${extra}
      <div class="row-center"><button class="btn btn-big" id="again">עוד סיבוב</button>${links}</div>
    </div>`;
  root.querySelector('#again').onclick = again;
}
