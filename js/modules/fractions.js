// שברים לנירי: שבר כחלק משלם, שם השבר, חיבור שברים, השוואה בין שברים.
import { esc, shuffle, pick } from '../ui.js';
import { METHODS, vizPanel, METHODS_ADD, METHODS_COMPARE, gcd, mixedLabel, fracName } from '../viz/fractions.js';
import { runQuiz, finishScreen } from '../quiz.js';
import { getProgress, saveProgress, logSession } from '../store.js';
import { review, pickSession, MASTERED_BOX } from '../srs.js';

const eq = (s) => `<span class="eq">${s}</span>`;
const SESSION_SIZE = 10;

// A fraction written numerator-over-denominator, the way it's taught on paper.
const vfrac = (n, d) => `<span class="vfrac"><span class="vf-n">${n}</span><span class="vf-bar"></span><span class="vf-d">${d}</span></span>`;

// A mixedLabel() string ("3/4", "1 1/3", "2") as vertical-fraction html.
function vfracLabel(label) {
  const sp = label.indexOf(' ');
  const whole = sp === -1 ? null : label.slice(0, sp);
  const frac = sp === -1 ? label : label.slice(sp + 1);
  if (!frac.includes('/')) return label; // a plain whole number, no fraction part
  const [n, d] = frac.split('/');
  return whole ? `<span class="vfrac-mixed">${whole}${vfrac(n, d)}</span>` : vfrac(n, d);
}

// Every reduced proper fraction with denominator 2–10: the fixed fact list for "part of whole" and "name".
const DENOMS = [2, 3, 4, 5, 6, 7, 8, 9, 10];
const FRACTS = [];
for (const d of DENOMS) for (let n = 1; n < d; n++) if (gcd(n, d) === 1) FRACTS.push([n, d]);
const PART_KEYS = FRACTS.map(([n, d]) => `fr:p:${n}/${d}`);
const NAME_KEYS = FRACTS.map(([n, d]) => `fr:n:${n}/${d}`);
const parseFrac = (k) => k.split(':')[2].split('/').map(Number);

const box = (items, k) => items[k]?.box || 0;
const mastered = (items, keys) => keys.filter((k) => box(items, k) >= MASTERED_BOX).length;

function vizHelp(n, d) {
  const { html, caption } = pick(METHODS).render(n, d);
  return `<div class="viz-box">${html}</div><p class="viz-caption">${caption}</p>`;
}

export function renderFractions(root, kid, [view = 'menu', ...args]) {
  const base = `#/kid/${kid.id}/fractions`;
  if (view === 'learn') return learn(root, base, +args[0] || 4, +args[1] || 1);
  if (view === 'part') return partPractice(root, kid, base);
  if (view === 'name') return namePractice(root, kid, base);
  if (view === 'add') return addPractice(root, kid, base);
  if (view === 'compare') return comparePractice(root, kid, base);
  if (view === 'map') return map(root, kid, base);
  const items = getProgress(kid.id).items;
  root.innerHTML = `
    <h1 class="page-title">🍕 שברים</h1>
    <p class="subtitle">מכירים: ${mastered(items, PART_KEYS)} מתוך ${PART_KEYS.length} · שם השבר: ${mastered(items, NAME_KEYS)} מתוך ${NAME_KEYS.length}</p>
    <div class="cards">
      <a class="card" href="${base}/learn"><span class="card-icon">🔍</span><span class="card-title">להכיר שברים</span><span class="card-sub">עוגה, פס, ציר וקבוצה</span></a>
      <a class="card" href="${base}/part"><span class="card-icon">🍕</span><span class="card-title">שבר כחלק משלם</span><span class="card-sub">מתאימים ציור לשבר</span></a>
      <a class="card" href="${base}/name"><span class="card-icon">🏷️</span><span class="card-title">שם השבר</span><span class="card-sub">חצי, שליש, רבע...</span></a>
      <a class="card" href="${base}/add"><span class="card-icon">➕</span><span class="card-title">חיבור שברים</span><span class="card-sub">מחברים שני שברים</span></a>
      <a class="card" href="${base}/compare"><span class="card-icon">⚖️</span><span class="card-title">גדול, קטן או שווה</span><span class="card-sub">משווים בין שני שברים</span></a>
      <a class="card" href="${base}/map"><span class="card-icon">🗺️</span><span class="card-title">המפה שלי</span><span class="card-sub">מה כבר יודעים</span></a>
    </div>`;
}

// ---------- learn / explore ----------
function learn(root, base, d, n) {
  const stepper = (name, v) => `
    <div class="stepper" data-name="${name}">
      <button class="step" data-d="-1">−</button><span class="step-val">${v}</span><button class="step" data-d="1">+</button>
    </div>`;
  root.innerHTML = `
    <a class="back" href="${base}">→ חזרה</a>
    <h1 class="page-title">🔍 להכיר שברים</h1>
    <div class="learn-pick ltr">${stepper('n', n)}<span class="big-op">/</span>${stepper('d', d)}</div>
    <div id="viz"></div>`;
  const panel = vizPanel(root.querySelector('#viz'), n, d);
  const update = () => {
    root.querySelector('[data-name=n] .step-val').textContent = n;
    root.querySelector('[data-name=d] .step-val').textContent = d;
    panel.set(n, d);
    history.replaceState(null, '', `${base}/learn/${d}/${n}`);
  };
  root.querySelector('.learn-pick').addEventListener('click', (e) => {
    const btn = e.target.closest('.step');
    if (!btn) return;
    const name = btn.closest('.stepper').dataset.name;
    if (name === 'd') { d = Math.min(12, Math.max(2, d + +btn.dataset.d)); n = Math.min(n, d); }
    else { n = Math.min(d, Math.max(0, n + +btn.dataset.d)); }
    update();
  });
}

// ---------- שבר כחלק משלם ----------
function partQuestion([n, d]) {
  const key = `fr:p:${n}/${d}`;
  const distractors = shuffle(FRACTS.filter(([x, y]) => !(x === n && y === d))).slice(0, 3);
  if (Math.random() < 0.6) {
    // רואים ציור, בוחרים את השבר
    const { html } = pick(METHODS).render(n, d);
    const opts = shuffle([[n, d], ...distractors]).map(([x, y]) =>
      ({ html: `<span class="choice-text">${eq(`${x}/${y}`)}</span>`, value: `${x}/${y}` }));
    return {
      key, answer: `${n}/${d}`, options: opts, help: () => vizHelp(n, d),
      prompt: `<div class="viz-box">${html}</div><p class="q-ask">איזה שבר מתאים לציור?</p>`,
    };
  }
  // רואים שבר בכתב, בוחרים את הציור
  const method = pick(METHODS);
  const opts = shuffle([[n, d], ...distractors]).map(([x, y]) =>
    ({ html: `<div class="choice-viz">${method.render(x, y).html}</div>`, value: `${x}/${y}` }));
  return {
    key, answer: `${n}/${d}`, options: opts, help: () => vizHelp(n, d),
    prompt: `<p class="q-ask">איזה ציור מתאים לשבר?</p><div class="q-big">${eq(`${n}/${d}`)}</div>`,
  };
}

function partPractice(root, kid, base) {
  const progress = getProgress(kid.id);
  const before = mastered(progress.items, PART_KEYS);
  const keys = shuffle(pickSession(progress.items, PART_KEYS, SESSION_SIZE, { maxNew: 4 }));
  runQuiz(root, {
    back: base,
    questions: keys.map((k) => partQuestion(parseFrac(k))),
    onResult: (q, ok, ms) => { progress.items[q.key] = review(progress.items[q.key], ok, ms); },
    onDone: ({ right, total }) => {
      saveProgress(progress);
      logSession(kid.id, { module: 'fractions', part: 'part', total, correct: right });
      const gained = mastered(getProgress(kid.id).items, PART_KEYS) - before;
      finishScreen(root, {
        right, total,
        extra: gained > 0 ? `<p class="subtitle">🎉 ${gained} שברים חדשים נכנסו לרשימת היודעים!</p>` : '',
        again: () => partPractice(root, kid, base),
        links: `<a class="btn btn-soft" href="${base}">לתפריט שברים 🍕</a>`,
      });
    },
  });
}

// ---------- שם השבר ----------
function nameQuestion([n, d]) {
  const key = `fr:n:${n}/${d}`;
  const distractors = shuffle(FRACTS.filter(([x, y]) => !(x === n && y === d))).slice(0, 3);
  if (Math.random() < 0.5) {
    const opts = shuffle([[n, d], ...distractors]).map(([x, y]) =>
      ({ html: `<span class="choice-text">${fracName(x, y)}</span>`, value: `${x}/${y}` }));
    return {
      key, answer: `${n}/${d}`, options: opts, help: () => vizHelp(n, d),
      prompt: `<p class="q-ask">איך קוראים לשבר הזה?</p><div class="q-big">${eq(`${n}/${d}`)}</div>`,
    };
  }
  const opts = shuffle([[n, d], ...distractors]).map(([x, y]) =>
    ({ html: `<span class="choice-text">${eq(`${x}/${y}`)}</span>`, value: `${x}/${y}` }));
  return {
    key, answer: `${n}/${d}`, options: opts, help: () => vizHelp(n, d),
    prompt: `<p class="q-ask">איזה שבר זה?</p><div class="q-big">${fracName(n, d)}</div>`,
  };
}

function namePractice(root, kid, base) {
  const progress = getProgress(kid.id);
  const before = mastered(progress.items, NAME_KEYS);
  const keys = shuffle(pickSession(progress.items, NAME_KEYS, SESSION_SIZE, { maxNew: 4 }));
  runQuiz(root, {
    back: base,
    questions: keys.map((k) => nameQuestion(parseFrac(k))),
    onResult: (q, ok, ms) => { progress.items[q.key] = review(progress.items[q.key], ok, ms); },
    onDone: ({ right, total }) => {
      saveProgress(progress);
      logSession(kid.id, { module: 'fractions', part: 'name', total, correct: right });
      const gained = mastered(getProgress(kid.id).items, NAME_KEYS) - before;
      finishScreen(root, {
        right, total,
        extra: gained > 0 ? `<p class="subtitle">🎉 ${gained} שמות חדשים נכנסו לרשימת היודעים!</p>` : '',
        again: () => namePractice(root, kid, base),
        links: `<a class="btn btn-soft" href="${base}">לתפריט שברים 🍕</a>`,
      });
    },
  });
}

// ---------- חיבור שברים (מכנה משותף, בלי חזרה מרווחת - התרגילים אינסופיים) ----------
const ADD_DENOMS = [2, 3, 4, 5, 6, 8, 10];

function addFact() {
  const d = pick(ADD_DENOMS);
  const n1 = 1 + Math.floor(Math.random() * (d - 1));
  const n2 = 1 + Math.floor(Math.random() * (d - 1));
  return { n1, n2, d };
}

function addQuestion({ n1, n2, d }) {
  const total = n1 + n2;
  const correct = mixedLabel(total, d);
  const candidates = [correct, `${total}/${d * 2}`];
  if (total >= d) candidates.push(`${total}/${d}`);
  candidates.push(mixedLabel(total - 1, d), mixedLabel(total + 1, d));
  const pool = [...new Set(candidates)].slice(0, 4);
  const opts = shuffle(pool).map((label) => ({ html: `<span class="choice-text">${vfracLabel(label)}</span>`, value: label }));
  return {
    key: `fr:add:${n1}/${d}+${n2}/${d}`, answer: correct, options: opts,
    help: () => { const { html, caption } = pick(METHODS_ADD).render(n1, n2, d); return `<div class="viz-box">${html}</div><p class="viz-caption">${caption}</p>`; },
    prompt: `<p class="q-ask">כמה זה?</p><div class="frac-row">${vfrac(n1, d)}<span class="frac-op">+</span>${vfrac(n2, d)}</div>`,
  };
}

function addPractice(root, kid, base) {
  const questions = Array.from({ length: SESSION_SIZE }, () => addQuestion(addFact()));
  runQuiz(root, {
    back: base,
    questions,
    onResult: () => {},
    onDone: ({ right, total }) => {
      logSession(kid.id, { module: 'fractions', part: 'add', total, correct: right });
      finishScreen(root, {
        right, total,
        again: () => addPractice(root, kid, base),
        links: `<a class="btn btn-soft" href="${base}">לתפריט שברים 🍕</a>`,
      });
    },
  });
}

// ---------- גדול, קטן או שווה ----------
function compareFact() {
  const [n1, d1] = pick(FRACTS);
  if (Math.random() < 0.25) return { n1, d1, n2: n1 * 2, d2: d1 * 2 }; // שבר שווה, בכתיב אחר
  let [n2, d2] = pick(FRACTS);
  if (n1 === n2 && d1 === d2) [n2, d2] = pick(FRACTS.filter(([x, y]) => !(x === n1 && y === d1)));
  return { n1, d1, n2, d2 };
}

const relation = (n1, d1, n2, d2) => {
  const L = n1 * d2, R = n2 * d1;
  return L === R ? '=' : L > R ? '>' : '<';
};

function compareQuestion({ n1, d1, n2, d2 }) {
  const rel = relation(n1, d1, n2, d2);
  const opts = ['<', '=', '>'].map((s) => ({ html: `<span class="choice-text">${eq(s)}</span>`, value: s }));
  return {
    key: `fr:cmp:${n1}/${d1}?${n2}/${d2}`, answer: rel, options: opts,
    help: () => {
      const { html, caption } = pick(METHODS_COMPARE).render(n1, d1, n2, d2);
      return `<div class="viz-box">${html}</div><p class="viz-caption">${caption}<br>${eq(`${n1}/${d1} ${rel} ${n2}/${d2}`)}</p>`;
    },
    prompt: `<p class="q-ask">מה הסימן המתאים בין השברים?</p><div class="frac-row">${vfrac(n1, d1)}<span class="frac-op">⬜</span>${vfrac(n2, d2)}</div>`,
  };
}

function comparePractice(root, kid, base) {
  const questions = Array.from({ length: SESSION_SIZE }, () => compareQuestion(compareFact()));
  runQuiz(root, {
    back: base,
    questions,
    onResult: () => {},
    onDone: ({ right, total }) => {
      logSession(kid.id, { module: 'fractions', part: 'compare', total, correct: right });
      finishScreen(root, {
        right, total,
        again: () => comparePractice(root, kid, base),
        links: `<a class="btn btn-soft" href="${base}">לתפריט שברים 🍕</a>`,
      });
    },
  });
}

// ---------- המפה שלי ----------
function map(root, kid, base) {
  const items = getProgress(kid.id).items;
  const LEVELS = ['עוד לא תרגלנו', 'מתחילים', 'מתקדמים', 'כמעט', 'יודעים', 'אלופים'];
  const cells = FRACTS.map(([n, d]) => {
    const lvl = Math.min(box(items, `fr:p:${n}/${d}`), box(items, `fr:n:${n}/${d}`));
    return `<a class="tt-cell lvl-${lvl}" href="${base}/learn/${d}/${n}" title="${LEVELS[lvl]}">${n}/${d}</a>`;
  }).join('');
  root.innerHTML = `
    <a class="back" href="${base}">→ חזרה</a>
    <h1 class="page-title">🗺️ המפה של ${esc(kid.name)}</h1>
    <p class="subtitle">הצבע לפי מה שיודעים גם בציור וגם בשם. לחיצה על משבצת מראה אותה.</p>
    <div class="tt-grid frac-grid ltr">${cells}</div>
    <div class="legend">${LEVELS.map((l, i) => `<span><i class="lvl-${i}"></i>${l}</span>`).join('')}</div>`;
}
