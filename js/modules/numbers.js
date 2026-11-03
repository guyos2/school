// מספרים טבעיים: reading and writing big numbers, place value, comparing, building numbers from digits, ordering,
// and composing ("54 עשרות ו-2 יחידות"). Material from class comes from content/units/<kid>/ (units with kind "numbers").
import { esc, shuffle, pick, PRAISE, keypad, later, viewSignal } from '../ui.js';
import { finishScreen } from '../quiz.js';
import {
  PLACES, fmt, fmtBlank, words, numberWords, vizPanel, missingFits, composeValue, composeText, digitsAnswer,
} from '../viz/numbers.js';
import { getProgress, saveProgress, logSession } from '../store.js';
import { review, MASTERED_BOX } from '../srs.js';
import { writeHub, lesson, steps } from './numbersWrite.js';

const eq = (s) => `<span class="eq">${s}</span>`;
const SESSION_SIZE = 8;
const rnd = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
const clean = (v) => String(v ?? '').replace(/[^0-9]/g, '');

// A number with len digits; zero = chance of a 0 in each later place.
function genNum(len, zero = 0.3) {
  let s = String(rnd(1, 9));
  for (let i = 1; i < len; i++) s += Math.random() < zero ? '0' : rnd(1, 9);
  return +s;
}

async function loadUnits(kidId) {
  try {
    const { units } = await fetch(`content/units/${kidId}/index.json`).then((r) => r.json());
    const all = await Promise.all(units.map((f) => fetch(`content/units/${kidId}/${f}`).then((r) => r.json())));
    return all.filter((u) => u.kind === 'numbers');
  } catch {
    return [];
  }
}

// ---------- question builders ----------
// A question: { key, section, prompt, input: type|choice|tiles|order|own, check(value) → 0..1, answerHtml, why, viz, vizStart }
const big = (s) => `<div class="nu-big ltr">${s}</div>`;

// Numbers that are easy to mix up with n: a 0 moved, dropped or added, two digits swapped, one digit changed.
function lookAlikes(n, count = 3) {
  const s = String(n), out = new Set();
  const tries = [
    () => { const i = s.indexOf('0', 1); return i > 0 ? s.slice(0, i) + s.slice(i + 1) : null; },
    () => { const i = rnd(1, s.length - 1); return s.slice(0, i) + '0' + s.slice(i); },
    () => { const i = rnd(0, s.length - 2); return s[i] === s[i + 1] ? null : s.slice(0, i) + s[i + 1] + s[i] + s.slice(i + 2); },
    () => { const zs = [...s].map((c, i) => (c === '0' ? i : -1)).filter((i) => i > 0); if (!zs.length) return null; const z = pick(zs); const t = s.slice(0, z) + s.slice(z + 1); const j = rnd(1, t.length); return t.slice(0, j) + '0' + t.slice(j); },
    () => { const i = rnd(1, s.length - 1); return s.slice(0, i) + ((+s[i] + rnd(1, 8)) % 10) + s.slice(i + 1); },
  ];
  for (let t = 0; out.size < count && t < 200; t++) {
    const v = pick(tries)();
    if (v && v[0] !== '0' && +v !== n && +v < 1e7 && words(+v) !== words(n)) out.add(+v);
  }
  return [...out];
}

function toDigits(n, text = words(n)) {
  const { groups } = numberWords(n);
  return {
    key: `nu:td:${String(n).length}`, section: 'כתבו בספרות', input: 'type', maxLen: 7,
    prompt: `<p class="nu-words">${esc(text)}</p>`,
    check: (v) => (+clean(v) === n ? 1 : 0),
    answerHtml: eq(fmt(n)),
    why: `קוראים בחלקים: ${groups.map((g) => `<b>${esc(g.text)}</b>`).join(' · ')}. מחלקה שאין בה כלום מקבלת 000.`,
    viz: { kind: 'number', n }, vizStart: 2,
  };
}

function toWords(n, mode = 'tiles') {
  const text = words(n);
  const alikes = lookAlikes(n);
  const q = {
    key: `nu:tw:${String(n).length}`, section: 'כתבו במילים', input: mode,
    prompt: big(fmt(n)),
    answerHtml: `<b>${esc(text)}</b>`,
    why: 'מחלקים לשלשות מימין, וקוראים כל שלשה עם שם המחלקה שלה: מיליון, אלף, ואז השאר.',
    viz: { kind: 'number', n }, vizStart: 2,
  };
  if (mode === 'choice') {
    q.options = shuffle([n, ...alikes]).map((v) => ({ html: esc(words(v)), value: v }));
    q.answer = n;
    q.check = (v) => (v === n ? 1 : 0);
  } else {
    const mine = text.split(' ');
    const extra = shuffle([...new Set(alikes.flatMap((v) => words(v).split(' ')))].filter((w) => !mine.includes(w))).slice(0, 3);
    q.tiles = shuffle([...mine, ...extra]);
    q.check = (v) => (v === text ? 1 : 0);
  }
  return q;
}

const SYMS = ['<', '>', '='];
const rel = (a, b) => (a < b ? '<' : a > b ? '>' : '=');

function compareQ(a, b) {
  return {
    key: 'nu:cmp', section: 'כתבו <, > או =', input: 'choice',
    prompt: big(`${fmt(a)} <span class="nu-slot">?</span> ${fmt(b)}`),
    options: SYMS.map((s) => ({ html: `<span class="ltr nu-sym">${esc(s)}</span>`, value: s })),
    answer: rel(a, b), check: (v) => (v === rel(a, b) ? 1 : 0),
    answerHtml: eq(`${fmt(a)} ${esc(rel(a, b))} ${fmt(b)}`),
    why: 'הפה של הסימן פתוח תמיד לצד של המספר הגדול. קודם בודקים כמה ספרות יש, ואז משווים משמאל, עמודה אחרי עמודה.',
    viz: { kind: 'compare', a, b },
  };
}

function genCompare() {
  const len = rnd(5, 6), a = genNum(len);
  const kind = pick(['first', 'later', 'later', 'length', 'equal']);
  let b;
  if (kind === 'equal') b = a;
  else if (kind === 'length') b = +(rnd(+String(a)[0], 9) + String(genNum(len - 1, 0.2)).slice(1)); // fewer digits but a bigger first digit
  else {
    const s = String(a), i = kind === 'first' ? 0 : rnd(1, len - 1);
    let d = rnd(kind === 'first' ? 1 : 0, 9);
    if (d === +s[i]) d = (d + 1) % 10 || 1;
    b = +(s.slice(0, i) + d + [...s.slice(i + 1)].map((c) => (Math.random() < 0.5 ? c : rnd(0, 9))).join(''));
  }
  return Math.random() < 0.5 ? compareQ(a, b) : compareQ(b, a);
}

function missingQ(a, r, b) {
  const spec = { a, rel: r, b };
  const fits = missingFits(spec);
  return {
    key: 'nu:gap', section: 'השלימו ספרה, כך שהסימן יהיה נכון', input: 'type', maxLen: 1,
    prompt: big(`${fmtBlank(a)} ${esc(r)} ${fmtBlank(b)}`),
    check: (v) => (clean(v) !== '' && fits.includes(+clean(v)) ? 1 : 0),
    answerHtml: `כל אחת מהספרות ${eq(fits.join(', '))}`,
    why: 'שמים ספרה במקום ה-? ובודקים: האם הסימן נכון? אם ה-? יוצא שווה לספרה שמולו, ממשיכים לבדוק את הספרות שמימין.',
    viz: { kind: 'missing', ...spec },
  };
}

function genMissing() {
  for (let t = 0; t < 100; t++) {
    const len = rnd(5, 6), s = String(genNum(len, 0.4)), i = rnd(0, len - 2);
    const tail = Math.random() < 0.5 ? s.slice(i + 1) : [...s.slice(i + 1)].map(() => rnd(0, 9)).join('');
    const blank = s.slice(0, i) + '_' + tail;
    const r = pick(['<', '>']);
    const [a, b] = Math.random() < 0.5 ? [blank, s] : [s, blank];
    const fits = missingFits({ a, rel: r, b });
    if (fits.length >= 1 && fits.length <= 8) return missingQ(a, r, b);
  }
  return missingQ('3_8000', '<', '348000');
}

function placeQ(n, p) {
  const s = String(n), d = +s[s.length - 1 - p];
  return {
    key: `nu:pl:${p}`, section: `המספר ${fmt(n)}`, input: 'type', maxLen: 1,
    prompt: `<p class="q-ask">מהי ספרת ה${PLACES[p]}?</p>${big(fmt(n))}`,
    check: (v) => (clean(v) !== '' && +clean(v) === d ? 1 : 0),
    answerHtml: eq(d),
    why: `סופרים מימין: אחדות, עשרות, מאות, אלפים, עשרות אלפים, מאות אלפים. ספרת ה${PLACES[p]} היא ${eq(d)}.`,
    viz: { kind: 'number', n, hl: p },
  };
}

function placeValueQ(n) {
  const s = String(n);
  const ps = [...s].map((c, i) => [s.length - 1 - i, +c]).filter(([, c]) => c && s.split(String(c)).length === 2);
  if (!ps.length) return placeQ(n, rnd(0, s.length - 1));
  const [p, d] = pick(ps);
  const vals = shuffle([...new Set([p, ...shuffle([...Array(s.length).keys()].filter((k) => k !== p)).slice(0, 3)])]).map((k) => d * 10 ** k);
  return {
    key: 'nu:pv', section: 'ערך הספרה', input: 'choice',
    prompt: `<p class="q-ask">כמה שווה הספרה ${eq(d)} במספר?</p>${big(fmt(n))}`,
    options: vals.map((v) => ({ html: `<span class="ltr">${fmt(v)}</span>`, value: v })),
    answer: d * 10 ** p, check: (v) => (v === d * 10 ** p ? 1 : 0),
    answerHtml: eq(fmt(d * 10 ** p)),
    why: `ה-${eq(d)} יושב בעמודת ה${PLACES[p]}, ולכן הוא שווה ${eq(`${d} × ${fmt(10 ** p)} = ${fmt(d * 10 ** p)}`)}.`,
    viz: { kind: 'number', n, hl: p }, vizStart: 1,
  };
}

function digitsQ(digits, goal) {
  const ans = digitsAnswer(digits, goal);
  const zero = goal === 'min' && digits.includes(0);
  return {
    key: `nu:dg:${goal}${zero ? '0' : ''}`, section: `כתבו את המספר ה${goal === 'max' ? 'גדול' : 'קטן'} ביותר`, input: 'type', maxLen: digits.length,
    prompt: `<div class="nu-cards ltr">${digits.map((d) => `<span class="nu-card"><b>${d}</b></span>`).join('')}</div>
      <p class="muted">משתמשים בכל הספרות, כל ספרה פעם אחת.</p>`,
    check: (v) => (+clean(v) === ans ? 1 : 0),
    answerHtml: eq(fmt(ans)),
    why: goal === 'max' ? 'מסדרים מהספרה הגדולה לקטנה, משמאל לימין.'
      : `מסדרים מהספרה הקטנה לגדולה, משמאל לימין.${zero ? ' 0 לא יכול להיות ראשון, ולכן הוא בא מיד אחרי הספרה הראשונה.' : ''}`,
    viz: { kind: 'digits', digits, goal },
  };
}

function genDigits(goal = pick(['max', 'min'])) {
  const n = rnd(5, 6);
  const pool = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, n);
  if (Math.random() < 0.4) pool[rnd(0, n - 1)] = 0;
  return digitsQ(shuffle(pool), goal);
}

function orderQ(list) {
  const sorted = [...list].sort((x, y) => x - y);
  return {
    key: 'nu:ord', section: 'סדרו מהקטן לגדול', input: 'order', list: shuffle(list),
    prompt: '<p class="q-ask">לחצו על המספרים לפי הסדר, מהקטן לגדול.</p>',
    check: (v) => (v.every((x, i) => x === sorted[i]) ? 1 : 0),
    answerHtml: `<span class="eq nu-wrap">${sorted.map(fmt).join(' &lt; ')}</span>`,
    why: 'קודם מי שיש לו פחות ספרות. אם יש אותו מספר ספרות, משווים משמאל: מאות אלפים, ואז עשרות אלפים, וכך הלאה.',
    viz: { kind: 'order', list },
  };
}

function genOrder() {
  // Six-digit numbers that share their start, so the order is decided further in.
  const base = String(genNum(6, 0.2));
  const keep = rnd(1, 3);
  const set = new Set();
  while (set.size < 5) set.add(+(base.slice(0, keep) + [...base.slice(keep)].map((c, i) => (i === 0 || Math.random() < 0.6 ? rnd(0, 9) : c)).join('')));
  return orderQ([...set]);
}

function ownQ() {
  const score = (v) => {
    const ns = v.map((x) => clean(x)).map((x) => (x.length === 6 && x[0] !== '0' ? +x : null));
    const valid = ns.every((x) => x !== null) && new Set(ns).size === 5;
    if (!valid) return 0;
    return ns.every((x, i) => !i || ns[i - 1] < x) ? 1 : 1 / 3;
  };
  return {
    key: 'nu:own', section: 'כתבו 5 מספרים בני 6 ספרות, וסדרו אותם מהקטן לגדול', input: 'own',
    prompt: '<p class="q-ask">מספר בן 6 ספרות הוא בין 100,000 ל-999,999. כתבו אותם כבר לפי הסדר: הקטן ראשון.</p>',
    check: score,
    answerHtml: 'חמישה מספרים שונים, כל אחד בן 6 ספרות, וכל מספר גדול מזה שלפניו',
    why: 'אפשר לבחור מספרים שמתחילים בספרות שונות, למשל 1….., 3….., 5….., ולכתוב אותם לפי הספרה הראשונה.',
    vizFor: (v) => {
      const ns = v.map((x) => +clean(x)).filter((x) => x > 0);
      return ns.length >= 2 ? { kind: 'order', list: [...new Set(ns)] } : { kind: 'order', list: [123456, 234567, 345678, 456789, 567890] };
    },
    feedback: (v) => {
      const bad = v.map(clean).filter((x) => x.length !== 6 || x[0] === '0');
      if (bad.length) return `${bad.map((x) => eq(x || '___')).join(', ')} ${bad.length > 1 ? 'אינם בני' : 'אינו בן'} 6 ספרות.`;
      if (new Set(v.map(clean)).size < 5) return 'יש מספר שחוזר פעמיים. צריך חמישה מספרים שונים.';
      return 'המספרים בני 6 ספרות 👍, אבל הסדר לא מהקטן לגדול.';
    },
  };
}

function composeQ(parts) {
  const v = composeValue(parts);
  return {
    key: `nu:cp:${parts.map(([, p]) => p).join('-')}`, section: 'כתבו את המספר', input: 'type', maxLen: 7,
    prompt: `<p class="nu-words">${esc(composeText(parts))} = ?</p>`,
    check: (x) => (+clean(x) === v ? 1 : 0),
    answerHtml: eq(fmt(v)),
    why: `${parts.map(([c, p]) => `${eq(c)} ${PLACES[p]} = ${eq(fmt(c * 10 ** p))}`).join(', ')}. מחברים: ${eq(fmt(v))}.`,
    viz: { kind: 'compose', parts },
  };
}

const COMPOSE_KINDS = [
  () => [[rnd(11, 99), 1], [rnd(1, 9), 0]],
  () => [[rnd(2, 9), 2], [rnd(10, 99), 0]],
  () => [[rnd(11, 99), 2], [rnd(1, 9), 1]],
  () => [[rnd(2, 9), 3], [rnd(1, 99), 0]],
  () => [[rnd(11, 59), 2], [rnd(10, 99), 0]],
  () => [[rnd(2, 9), 3], [rnd(2, 9), 2], [rnd(1, 9), 0]],
];
const genCompose = (k = rnd(0, COMPOSE_KINDS.length - 1)) => composeQ(COMPOSE_KINDS[k]());

// Class material: one item in the unit file → a question.
function fromItem(it, mode) {
  if (it.type === 'toDigits') return toDigits(it.n, it.words);
  if (it.type === 'toWords') return toWords(it.n, mode === 'test' ? 'choice' : 'tiles');
  if (it.type === 'compare') return compareQ(it.a, it.b);
  if (it.type === 'missing') return missingQ(it.a, it.rel, it.b);
  if (it.type === 'place') return placeQ(it.n, it.place);
  if (it.type === 'digits') return digitsQ(it.digits, it.goal);
  if (it.type === 'own6') return ownQ();
  if (it.type === 'compose') return composeQ(it.parts);
  return null;
}

// ---------- topics ----------
const TOPICS = {
  write: { icon: '✍️', title: 'קוראים וכותבים', sub: 'הסבר, בונים בשלבים ותרגול', prefix: ['nu:td', 'nu:tw', 'nu:st'],
    gen: () => (Math.random() < 0.5 ? toDigits(genNum(rnd(5, 7), 0.4)) : toWords(genNum(rnd(4, 7), 0.4))) },
  compare: { icon: '⚖️', title: 'גדול, קטן או שווה', sub: '<, >, = ומשלימים ספרה חסרה', prefix: ['nu:cmp', 'nu:gap'],
    gen: () => (Math.random() < 0.55 ? genCompare() : genMissing()) },
  place: { icon: '🗂️', title: 'ערך המקום', sub: 'ספרת האחדות, העשרות, המאות...', prefix: ['nu:pl', 'nu:pv'],
    gen: () => { const n = genNum(rnd(5, 7), 0.15); return Math.random() < 0.7 ? placeQ(n, rnd(0, String(n).length - 1)) : placeValueQ(n); } },
  digits: { icon: '🃏', title: 'הכי גדול, הכי קטן', sub: 'בונים מספר מספרות נתונות', prefix: ['nu:dg'], gen: () => genDigits() },
  order: { icon: '📶', title: 'מסדרים מספרים', sub: 'מהקטן לגדול', prefix: ['nu:ord', 'nu:own'], size: 5,
    gen: () => (Math.random() < 0.8 ? genOrder() : ownQ()) },
  compose: { icon: '🧱', title: 'עשרות, מאות ויחידות', sub: '54 עשרות ו-2 יחידות = ?', prefix: ['nu:cp'], gen: () => genCompose() },
};

const topicItems = (items, t) => Object.entries(items).filter(([k]) => TOPICS[t].prefix.some((p) => k.startsWith(p)));

// The mixed round leans toward topics with open mistakes.
function genMix(items) {
  const ids = Object.keys(TOPICS);
  const w = ids.map((t) => 1 + topicItems(items, t).filter(([, it]) => it.wrong && (it.box || 0) < MASTERED_BOX).length);
  let r = Math.random() * w.reduce((s, x) => s + x, 0);
  const t = ids.find((_, i) => (r -= w[i]) < 0) || ids[0];
  return t === 'order' ? genOrder() : TOPICS[t].gen();
}

// ---------- routes ----------
export function renderNumbers(root, kid, [view = 'menu', ...args]) {
  const base = `#/kid/${kid.id}/numbers`;
  if (view === 'learn') return learn(root, base);
  if (view === 'write') return args[0] === 'lesson' ? lesson(root, kid, base) : args[0] === 'steps' ? steps(root, kid, base) : writeHub(root, kid, base);
  if (view === 'practice' && (TOPICS[args[0]] || args[0] === 'mix')) return practice(root, kid, base, args[0]);
  if (view === 'class') return classSheet(root, kid, base);
  if (view === 'mock') return testIntro(root, kid, base);
  menu(root, kid, base);
}

async function menu(root, kid, base) {
  const p = getProgress(kid.id);
  const tests = p.sessions.filter((s) => s.module === 'numbers' && s.part === 'mock');
  const stateOf = (t) => {
    const its = topicItems(p.items, t);
    if (!its.length) return 'עוד לא התחלתם';
    const right = its.reduce((s, [, it]) => s + it.right, 0), seen = its.reduce((s, [, it]) => s + it.seen, 0);
    return `${Math.round((100 * right) / seen)}% נכון`;
  };
  root.innerHTML = `
    <h1 class="page-title">🔢 מספרים טבעיים</h1>
    <p class="subtitle">מספרים גדולים עד מיליונים: קוראים, כותבים, משווים ומסדרים</p>
    <div class="cards" id="cards">
      <a class="card" href="${base}/learn"><span class="card-icon">🔍</span><span class="card-title">להכיר מספרים גדולים</span><span class="card-sub">כל מספר ב-4 דרכים, והכללים</span></a>
      ${Object.entries(TOPICS).map(([id, t]) => `
        <a class="card" href="${base}/${id === 'write' ? 'write' : `practice/${id}`}"><span class="card-icon">${t.icon}</span><span class="card-title">${t.title}</span>
          <span class="card-sub">${t.sub}<br><small>${stateOf(id)}</small></span></a>`).join('')}
      <a class="card" href="${base}/practice/mix"><span class="card-icon">🎲</span><span class="card-title">תרגול מעורב</span><span class="card-sub">יותר ממה שעוד קשה</span></a>
      <a class="card" href="${base}/mock"><span class="card-icon">🏁</span><span class="card-title">מבדק לדוגמה</span>
        <span class="card-sub">כמו המבדק בכיתה, ציון מתוך 100${tests.length ? `<br><small>אחרון: ${tests.at(-1).score}</small>` : ''}</span></a>
    </div>`;
  const units = await loadUnits(kid.id);
  if (!units.length || !root.querySelector('#cards')) return;
  const u = units[0];
  const done = p.sessions.some((s) => s.module === 'numbers' && s.part === 'class' && s.unit === u.id);
  root.querySelector('#cards').insertAdjacentHTML('afterbegin', `
    <a class="card" href="${base}/class"><span class="card-icon">📸</span><span class="card-title">משימת החזרה מהכיתה</span>
      <span class="card-sub">${esc(u.source)}<br><small>${done ? '✅ כבר פתרתם, אפשר שוב' : 'השאלות מהדף, אחת אחת'}</small></span></a>`);
}

// ---------- learn ----------
const RULES = [
  ['✍️', 'קוראים וכותבים', [
    'מחלקים את המספר לשלשות מימין, עם פסיק: 1,025,041.',
    'כל שלשה היא מחלקה: יחידות, אלפים, מיליונים. קוראים כל שלשה ואת שם המחלקה: <b>מיליון</b> · <b>עשרים וחמישה אלף</b> · <b>ארבעים ואחת</b>.',
    'ממילים לספרות: לכל מחלקה יש בדיוק 3 ספרות (חוץ מהראשונה). מחלקה ריקה = 000, ולכן 500,006 ולא 5,006.',
  ]],
  ['⚖️', 'משווים', [
    'קודם סופרים ספרות: למספר עם יותר ספרות ערך גדול יותר.',
    'אותו מספר ספרות? משווים משמאל, עמודה אחרי עמודה. הספרה הראשונה ששונה מחליטה.',
    'הסימן: הפה של < או > פתוח תמיד לכיוון המספר הגדול.',
    'ספרה חסרה: מנסים ספרות במקום ה-? ובודקים אם הסימן נכון.',
  ]],
  ['🗂️', 'ערך המקום', [
    'מימין לשמאל: אחדות, עשרות, מאות, אלפים, עשרות אלפים, מאות אלפים, מיליונים.',
    'ספרת המאות ב-254,627 היא 6, אבל <b>ערך</b> ה-6 הוא 600.',
  ]],
  ['🃏', 'הכי גדול והכי קטן', [
    'הכי גדול: מהספרה הגדולה לקטנה. 3,2,5,7,8,9 → 987,532.',
    'הכי קטן: מהקטנה לגדולה. 235,789. אם יש 0, הוא לא פותח: 0,4,1 → 104.',
  ]],
  ['🧱', 'עשרות, מאות ויחידות', [
    '54 עשרות = 540, ועוד 2 יחידות = 542.',
    '5 מאות = 500, ועוד 42 יחידות = 542. 4 מאות ו-25 יחידות = 425.',
    'אלפים: 3 אלפים ו-25 יחידות = 3,025. ה-0 שומר את מקום המאות.',
  ]],
];

function learn(root, base) {
  let typed = '';
  let n = 1025041;
  root.innerHTML = `
    <a class="back" href="${base}">→ חזרה</a>
    <h1 class="page-title">🔍 להכיר מספרים גדולים</h1>
    <p class="subtitle">הקלידו מספר (עד 7 ספרות), או בחרו מספר אקראי</p>
    <div class="q-card"><div class="nu-big ltr" id="num"></div><p class="nu-words" id="words"></p></div>
    <div id="pad"></div>
    <div class="row-center"><button class="btn btn-soft" id="rand">🎲 מספר אקראי</button></div>
    <div id="viz"></div>
    <h2 class="section">הכללים</h2>
    ${RULES.map(([icon, title, list]) => `<div class="panel col-rules"><h2>${icon} ${title}</h2><ul>${list.map((r) => `<li>${r}</li>`).join('')}</ul></div>`).join('')}`;
  const $ = (s) => root.querySelector(s);
  const panel = vizPanel($('#viz'), { kind: 'number', n });
  const show = () => {
    $('#num').innerHTML = typed ? fmt(typed) + '<span class="nu-caret">|</span>' : fmt(n);
    $('#words').textContent = typed ? '' : words(n);
  };
  const set = (v) => { n = v; typed = ''; show(); panel.set({ kind: 'number', n }); };
  keypad($('#pad'), {
    onDigit: (d) => { if (typed.length < 7 && (typed || d !== '0')) { typed += d; show(); } },
    onBack: () => { typed = typed.slice(0, -1); show(); },
    onEnter: () => { if (typed) set(+typed); },
  });
  $('#rand').onclick = () => set(genNum(rnd(4, 7), 0.35));
  show();
}

// ---------- practice ----------
function practice(root, kid, base, topic) {
  const items = getProgress(kid.id).items;
  const size = topic === 'mix' ? 10 : TOPICS[topic].size || SESSION_SIZE;
  const qs = Array.from({ length: size }, () => (topic === 'mix' ? genMix(items) : TOPICS[topic].gen()));
  drill(root, kid, {
    back: base, qs, part: topic,
    again: () => practice(root, kid, base, topic),
    links: `<a class="btn btn-soft" href="${base}">לתפריט 🔢</a>`,
  });
}

async function classSheet(root, kid, base) {
  const units = await loadUnits(kid.id);
  const u = units[0];
  if (!u) { menu(root, kid, base); return; }
  const qs = u.items.map((it) => {
    const q = fromItem(it, 'practice');
    if (q) q.tag = `שאלה ${it.q} מהדף`;
    return q;
  }).filter(Boolean);
  drill(root, kid, {
    back: base, qs, part: 'class', unit: u.id,
    again: () => classSheet(root, kid, base),
    links: `<a class="btn" href="${base}/mock">🏁 למבדק לדוגמה</a><a class="btn btn-soft" href="${base}">לתפריט 🔢</a>`,
  });
}

// One question at a time with feedback; a wrong answer shows the right one, why, and a visualization, and comes back once.
function drill(outer, kid, { back, qs, part, unit, again, links }) {
  outer.innerHTML = '<div class="quiz nu"></div>';
  const root = outer.firstElementChild;
  root.innerHTML = `
    <a class="back" href="${back}">→ חזרה</a>
    <div class="progress-bar"><div class="progress-fill"></div></div>
    <div class="q-card"><p class="nu-tag" id="tag"></p><p class="q-ask" id="sec"></p><div id="prompt"></div><div class="q-feedback" id="fb"></div></div>
    <div id="ans"></div>
    <div id="pad"></div>
    <div id="help"></div>`;
  const $ = (s) => root.querySelector(s);
  const queue = [...qs];
  const total = qs.length, missed = new Set();
  let i = 0, right = 0, q, typed, locked, picked, started;
  const begin = Date.now();

  const drawTyped = () => { $('#ans').innerHTML = `<div class="nu-typed ltr">${typed ? fmt(typed) : '<span class="muted">?</span>'}</div>`; };

  const drawTiles = () => {
    const used = new Set(picked);
    $('#ans').innerHTML = `
      <div class="nu-built" id="built">${picked.map((k, j) => `<button class="nu-tile on" data-j="${j}">${esc(q.tiles[k])}</button>`).join('') || '<span class="muted">לחצו על המילים לפי הסדר</span>'}</div>
      <div class="nu-tiles">${q.tiles.map((w, k) => (used.has(k) ? '' : `<button class="nu-tile" data-k="${k}">${esc(w)}</button>`)).join('')}</div>
      <div class="row-center"><button class="btn btn-big" id="check" ${picked.length ? '' : 'disabled'}>בדיקה ✓</button></div>`;
  };

  const drawOrder = () => {
    const used = new Set(picked);
    $('#ans').innerHTML = `
      <div class="nu-order-row ltr">${q.list.map((_, j) => (picked[j] !== undefined
        ? `<button class="nu-num on" data-j="${j}">${fmt(q.list[picked[j]])}</button>` : '<span class="nu-num empty">?</span>')).join('<span class="nu-lt">&lt;</span>')}</div>
      <div class="nu-order-pick">${q.list.map((v, k) => (used.has(k) ? '' : `<button class="nu-num" data-k="${k}">${fmt(v)}</button>`)).join('')}</div>
      <div class="row-center"><button class="btn btn-big" id="check" ${picked.length === q.list.length ? '' : 'disabled'}>בדיקה ✓</button></div>`;
  };

  const show = () => {
    q = queue[i];
    typed = ''; locked = false; picked = []; started = Date.now();
    $('.progress-fill').style.width = `${(i / queue.length) * 100}%`;
    $('#tag').textContent = q.tag || '';
    $('#sec').innerHTML = esc(q.section);
    $('#prompt').innerHTML = q.prompt;
    $('#fb').textContent = ''; $('#fb').className = 'q-feedback';
    $('#help').innerHTML = '';
    $('#pad').hidden = q.input !== 'type';
    if (q.input === 'type') drawTyped();
    else if (q.input === 'choice') {
      $('#ans').innerHTML = `<div class="choices ${q.options.length > 3 && q.options[0].html.length > 30 ? 'nu-wide' : ''}">${q.options.map((o, n) =>
        `<button class="choice" data-n="${n}">${o.html}</button>`).join('')}</div>`;
    } else if (q.input === 'tiles') drawTiles();
    else if (q.input === 'order') drawOrder();
    else if (q.input === 'own') {
      $('#ans').innerHTML = `
        <div class="nu-own">${[1, 2, 3, 4, 5].map((k) => `<input class="nu-in" inputmode="numeric" dir="ltr" maxlength="7" placeholder="${k}">`).join('<span class="nu-lt">&lt;</span>')}</div>
        <div class="row-center"><button class="btn btn-big" id="check">בדיקה ✓</button></div>`;
    }
  };

  const valueNow = () => {
    if (q.input === 'type') return typed;
    if (q.input === 'tiles') return picked.map((k) => q.tiles[k]).join(' ');
    if (q.input === 'order') return picked.map((k) => q.list[k]);
    if (q.input === 'own') return [...root.querySelectorAll('.nu-in')].map((x) => x.value);
    return null;
  };

  const submit = (value) => {
    if (locked) return;
    locked = true;
    const ok = q.check(value) === 1;
    if (!q.retry) {
      const p = getProgress(kid.id);
      p.items[q.key] = review(p.items[q.key], ok, Date.now() - started);
      saveProgress(p);
      if (ok) right++;
    }
    $('#pad').hidden = true;
    root.querySelectorAll('#ans button, #ans input').forEach((b) => { b.disabled = true; });
    if (q.input === 'choice') {
      root.querySelectorAll('.choice').forEach((b, k) => {
        const v = q.options[k].value;
        b.classList.add(v === q.answer ? 'correct' : v === value ? 'wrong' : 'dim');
      });
    }
    if (ok) {
      $('#fb').textContent = pick(PRAISE);
      $('#fb').className = 'q-feedback good';
      later(1100, next);
      return;
    }
    $('#fb').textContent = 'כמעט! הנה התשובה הנכונה 👇';
    $('#fb').className = 'q-feedback bad';
    if (!missed.has(q)) { missed.add(q); queue.push({ ...q, retry: true }); }
    $('#help').innerHTML = `<div class="help-box">
      ${q.feedback ? `<p class="nu-why">${q.feedback(value)}</p>` : ''}
      <p class="nu-right">✓ ${q.answerHtml}</p>
      <p class="nu-why">${q.why}</p>
      <div id="viz"></div>
      <button class="btn btn-big" id="go">הבנתי, ממשיכים ←</button></div>`;
    vizPanel($('#viz'), q.vizFor ? q.vizFor(value) : q.viz, q.vizStart || 0);
    $('#go').onclick = next;
  };

  const next = () => {
    i++;
    if (i < queue.length) { show(); window.scrollTo(0, 0); return; }
    const ms = Date.now() - begin;
    logSession(kid.id, { module: 'numbers', part, ...(unit ? { unit } : {}), total, correct: right, ms });
    finishScreen(outer, { right, total, again, links });
  };

  root.addEventListener('click', (e) => {
    if (locked) return;
    const c = e.target.closest('.choice');
    if (c) return submit(q.options[+c.dataset.n].value);
    const tile = e.target.closest('.nu-tile');
    if (tile) {
      if (tile.dataset.k !== undefined) picked.push(+tile.dataset.k); else picked.splice(+tile.dataset.j, 1);
      return drawTiles();
    }
    const num = e.target.closest('.nu-num');
    if (num && !num.classList.contains('empty')) {
      if (num.dataset.k !== undefined) picked.push(+num.dataset.k); else picked.splice(+num.dataset.j, 1);
      return drawOrder();
    }
    if (e.target.closest('#check')) submit(valueNow());
  });
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches('.nu-in') && !locked) submit(valueNow());
  });
  keypad($('#pad'), {
    onDigit: (d) => { if (q.input === 'type' && !locked && typed.length < q.maxLen && (typed || d !== '0' || q.maxLen === 1)) { typed += d; drawTyped(); } },
    onBack: () => { if (q.input === 'type' && !locked) { typed = typed.slice(0, -1); drawTyped(); } },
    onEnter: () => {
      if (locked) { if ($('#go')) next(); return; }
      if (q.input === 'type' && typed) submit(typed);
    },
  });
  show();
}

// ---------- mock test (מבדק לדוגמה) ----------
// Built like the class review sheet: six questions, 100 points, no feedback until the end.
function buildTest() {
  const n3 = genNum(6, 0);
  const places = shuffle([0, 1, 2, 3, 4, 5]).slice(0, 5).sort((a, b) => a - b);
  const ds = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, 6);
  if (Math.random() < 0.5) ds[rnd(0, 5)] = 0;
  const kinds = shuffle([0, 1, 2, 3, 4, 5]).slice(0, 4).sort();
  const cmp = [genCompare(), genCompare()];
  return [
    { title: 'כתבו בספרות ובמילים', points: 20, qs: [toDigits(genNum(7, 0.5)), toDigits(genNum(6, 0.45)), toWords(genNum(7, 0.5), 'choice'), toWords(genNum(6, 0.5), 'choice')] },
    { title: 'כתבו <, > או =, והשלימו ספרות', points: 20, qs: [...cmp, genMissing(), genMissing()] },
    { title: `המספר ${fmt(n3)}`, points: 15, qs: places.map((p) => placeQ(n3, p)) },
    { title: `לפניכם הספרות ${ds.join(', ')}`, points: 10, qs: [digitsQ(ds, 'max'), digitsQ(ds, 'min')] },
    { title: 'כתבו 5 מספרים בני 6 ספרות, וסדרו אותם מהקטן לגדול', points: 15, qs: [ownQ()] },
    { title: 'כתבו את המספר', points: 20, qs: kinds.map((k) => genCompose(k)) },
  ];
}

function testIntro(root, kid, base) {
  const tests = getProgress(kid.id).sessions.filter((s) => s.module === 'numbers' && s.part === 'mock');
  root.innerHTML = `
    <a class="back" href="${base}">→ חזרה</a>
    <h1 class="page-title">🏁 מבדק לדוגמה</h1>
    <div class="panel">
      <p>המבדק בנוי כמו משימת החזרה מהכיתה, <b>6 שאלות, 100 נקודות</b>:</p>
      <ol class="mt-plan">
        <li>כתבו בספרות ובמילים · 20 נקודות</li>
        <li>&lt;, &gt;, = והשלמת ספרות · 20 נקודות</li>
        <li>ספרת האחדות, העשרות, המאות... · 15 נקודות</li>
        <li>המספר הגדול ביותר והקטן ביותר מספרות · 10 נקודות</li>
        <li>5 מספרים בני 6 ספרות מהקטן לגדול · 15 נקודות</li>
        <li>עשרות, מאות ויחידות · 20 נקודות</li>
      </ol>
      <p>כמו במבדק אמיתי, אין משוב באמצע. בסוף מקבלים ציון, ורואים כל טעות עם התשובה הנכונה, הסבר וציור. כדאי להקדיש לזה כ-20 דקות, בשקט. מותר להשתמש בדף טיוטה.</p>
      ${tests.length ? `<p class="muted">מבדקים קודמים: ${tests.slice(-5).map((s) => s.score).join(' · ')}</p>` : ''}
      <div class="row-center"><button class="btn btn-big" id="start">מתחילים ✍️</button></div>
    </div>`;
  root.querySelector('#start').onclick = () => runTest(root, kid, base, buildTest());
}

function runTest(outer, kid, base, parts) {
  const begin = Date.now();
  const answers = parts.map((P) => P.qs.map(() => null));
  outer.innerHTML = '<div class="mt nu"></div>';
  const root = outer.firstElementChild;
  let confirm = false;
  const qHtml = (q, pi, i, num) => {
    let input = '';
    if (q.input === 'type') input = `<input class="nu-in" inputmode="numeric" dir="ltr" maxlength="${q.maxLen + 2}" data-p="${pi}" data-i="${i}">`;
    else if (q.input === 'choice') input = `<div class="mt-opts${q.key === 'nu:cmp' ? ' nu-sym-row' : ''}">${q.options.map((o, k) => `<button class="mt-opt" data-p="${pi}" data-i="${i}" data-k="${k}">${o.html}</button>`).join('')}</div>`;
    else if (q.input === 'own') input = `<div class="nu-own">${[0, 1, 2, 3, 4].map((k) => `<input class="nu-in" inputmode="numeric" dir="ltr" maxlength="7" data-p="${pi}" data-i="${i}" data-k="${k}">`).join('<span class="nu-lt">&lt;</span>')}</div>`;
    return `<div class="mt-q"><p class="nu-qn"><b>${num}.</b> ${q.section === parts[pi].title ? '' : esc(q.section)}</p>${q.prompt}${input}</div>`;
  };
  root.innerHTML = `
    <a class="back" href="${base}">→ חזרה</a>
    <h1 class="page-title">🏁 מבדק לדוגמה</h1>
    ${parts.map((P, pi) => `
      <section class="nu-part">
        <h2 class="nu-part-h"><span class="nu-circle">${pi + 1}</span> ${esc(P.title)} <small class="muted">${P.points} נקודות</small></h2>
        ${P.qs.map((q, i) => qHtml(q, pi, i, `${pi + 1}${'אבגדהו'[i]}`)).join('')}
      </section>`).join('')}
    <p class="subtitle" id="msg"></p>
    <div class="row-center"><button class="btn btn-big" id="submit">הגשה ✅</button></div>`;

  root.addEventListener('click', (e) => {
    const opt = e.target.closest('.mt-opt');
    if (opt) {
      answers[+opt.dataset.p][+opt.dataset.i] = parts[+opt.dataset.p].qs[+opt.dataset.i].options[+opt.dataset.k].value;
      opt.parentElement.querySelectorAll('.mt-opt').forEach((b) => b.classList.toggle('on', b === opt));
      return;
    }
    if (!e.target.closest('#submit')) return;
    root.querySelectorAll('.nu-in').forEach((inp) => {
      const p = +inp.dataset.p, i = +inp.dataset.i;
      if (inp.dataset.k !== undefined) (answers[p][i] ||= [])[+inp.dataset.k] = inp.value;
      else answers[p][i] = clean(inp.value) || null;
    });
    const empty = answers.flat().filter((a) => a === null || (Array.isArray(a) && a.every((x) => !clean(x)))).length;
    if (empty && !confirm) {
      confirm = true;
      root.querySelector('#msg').textContent = `נשארו ${empty} תשובות ריקות. לוחצים שוב על הגשה כדי להגיש בכל זאת.`;
      return;
    }
    results(outer, kid, base, parts, answers, Date.now() - begin);
  }, { signal: viewSignal() });
}

function givenText(q, v) {
  if (v === null || v === undefined) return 'לא עניתם';
  if (q.input === 'choice') return q.options.find((o) => o.value === v)?.html ?? 'לא עניתם';
  if (q.input === 'own') return `<span class="eq nu-wrap">${v.map((x) => clean(x) || '___').join(' &lt; ')}</span>`;
  return eq(esc(v));
}

function results(outer, kid, base, parts, answers, ms) {
  const progress = getProgress(kid.id);
  let score = 0, total = 0, correct = 0, num = 0;
  const rows = [], mistakes = [];
  parts.forEach((P, pi) => {
    let pts = 0, ok = 0;
    P.qs.forEach((q, i) => {
      num++;
      const v = answers[pi][i];
      const s = v === null || v === undefined ? 0 : q.check(v);
      progress.items[q.key] = review(progress.items[q.key], s === 1, 5000);
      pts += (P.points / P.qs.length) * s;
      total++;
      if (s === 1) { ok++; correct++; } else mistakes.push({ label: `${pi + 1}${'אבגדהו'[i]}`, P, q, v });
    });
    pts = Math.round(pts);
    score += pts;
    rows.push(`<div class="kpi"><span class="kpi-num">${pts}<small>/${P.points}</small></span><span class="kpi-label">שאלה ${pi + 1} · ${ok} מתוך ${P.qs.length}</span></div>`);
  });
  score = Math.min(100, score);
  saveProgress(progress);
  logSession(kid.id, { module: 'numbers', part: 'mock', score, total, correct, ms });
  const verdict = score >= 90 ? 'מצוין! אתם מוכנים למבדק 🏆' : score >= 75 ? 'טוב מאוד! עוברים על הטעויות, והציון יעלה עוד 💪'
    : score >= 55 ? 'בדרך הנכונה. כדאי לתרגל את השאלה שבה היו הכי הרבה טעויות' : 'כדאי לחזור על הכללים ולתרגל, ואז לנסות שוב. כל ניסיון מקרב 🙂';
  outer.innerHTML = '<div class="mt nu"></div>';
  const root = outer.firstElementChild;
  root.innerHTML = `
    <div class="finish">
      <p class="subtitle">הציון במבדק</p>
      <div class="sp-grade">${score}</div>
      <h1>${verdict}</h1>
      <p class="subtitle">${correct} תשובות נכונות מתוך ${total} · ${Math.max(1, Math.round(ms / 6e4))} דקות</p>
    </div>
    <div class="kpis">${rows.join('')}</div>
    ${mistakes.length ? `
      <h2 class="section">הטעויות, עם התשובה הנכונה</h2>
      <div class="mt-review">${mistakes.map(({ label, P, q, v }, k) => `
        <div class="mt-mistake">
          <p class="nu-qn"><b>${label}.</b> ${esc(P.title)}${q.section !== P.title ? ` · ${esc(q.section)}` : ''}</p>
          ${q.prompt}
          <p class="mt-ans">✗ התשובה שלכם: ${givenText(q, v)}</p>
          ${q.feedback && v ? `<p class="mt-ans">${q.feedback(v)}</p>` : ''}
          <p class="mt-ans">✓ התשובה הנכונה: ${q.answerHtml}</p>
          <p class="nu-why">${q.why}</p>
          <div class="nu-mviz" data-k="${k}"></div>
        </div>`).join('')}</div>` : '<p class="subtitle">🎉 אין אף טעות!</p>'}
    <div class="row-center">
      <button class="btn btn-big" id="again">מבדק נוסף</button>
      <a class="btn btn-soft" href="${base}">לתפריט 🔢</a>
    </div>`;
  root.querySelectorAll('.nu-mviz').forEach((el) => {
    const { q, v } = mistakes[+el.dataset.k];
    vizPanel(el, q.vizFor ? q.vizFor(v || []) : q.viz, q.vizStart || 0);
  });
  window.scrollTo(0, 0);
  root.querySelector('#again').onclick = () => runTest(outer, kid, base, buildTest());
}
