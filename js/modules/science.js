// מדעים (Itamar): atom structure, charges, elements, the periodic table, metals and non-metals.
// Material: unit with "kind": "science" (content/units/itamar/2026-11-14-science.json). Item keys sc:<id>.
// Views: menu, learn/<topic>, build, practice/<topic|mix>, read/<id>, open, mock.
import { esc, mixed, shuffle, pick, viewSignal } from '../ui.js';
import { runQuiz, finishScreen } from '../quiz.js';
import { getProgress, saveProgress, logSession } from '../store.js';
import { review, pickSession, MASTERED_BOX } from '../srs.js';
import { panel, ATOM_METHODS, CHARGE_METHODS, ELEMENT_METHODS, METAL_METHODS, tableMethods, POS, C } from '../viz/science.js';

const cache = {};
async function loadUnit(kidId) {
  cache[kidId] ??= fetch(`content/units/${kidId}/index.json`).then((r) => r.json())
    .then(({ units }) => Promise.all(units.map((f) => fetch(`content/units/${kidId}/${f}`).then((r) => r.json()))))
    .then((all) => all.find((u) => u.kind === 'science') || null)
    .catch(() => { cache[kidId] = undefined; return null; });
  return cache[kidId];
}

const box = (items, k) => items[k]?.box || 0;

// ---------- question bank: written items + generated ones from the element list ----------
function numOptions(z) {
  const set = new Set([z]);
  for (const d of shuffle([1, -1, 2, -2, 3, 4])) { if (set.size >= 4) break; if (z + d > 0) set.add(z + d); }
  return [...set].map(String);
}
function bank(U) {
  const els = U.elements;
  const items = U.items.map((it) => ({ ...it, key: `sc:${it.id}`, el: it.z ? els.find((e) => e.z === it.z) : null }));
  const others = (el, f, n = 3) => shuffle(els.filter((e) => e !== el)).slice(0, n).map(f);
  for (const el of els) {
    const base = { el: el.z <= 20 ? el : el, z: el.z };
    items.push({ ...base, id: `sym:${el.s}`, key: `sc:sym:${el.s}`, topic: 'atom', gen: true, q: `מהו הסימול הכימי של ${el.he}?`,
      options: [el.s, ...others(el, (e) => e.s)], why: `הסימול של ${el.he} הוא ${el.s}.` });
    items.push({ ...base, id: `nm:${el.s}`, key: `sc:nm:${el.s}`, topic: 'atom', gen: true, q: `איזה יסוד מסומל ${el.s}?`,
      options: [el.he, ...others(el, (e) => e.he)], why: `${el.s} הוא הסימול של ${el.he}.` });
    items.push({ ...base, id: `pr:${el.s}`, key: `sc:pr:${el.s}`, topic: 'atom', gen: true, q: `מהו המספר האטומי של ${el.he} (${el.s})? כלומר, כמה פרוטונים באטום שלו?`,
      options: numOptions(el.z), why: `המספר האטומי של ${el.he} הוא ${el.z}, ולכן בגרעין ${el.z} פרוטונים.` });
    items.push({ ...base, id: `el:${el.s}`, key: `sc:el:${el.s}`, topic: 'atom', gen: true, q: `כמה אלקטרונים יש באטום ניטרלי של ${el.he} (${el.s}), שהמספר האטומי שלו ${el.z}?`,
      options: numOptions(el.z), why: `באטום ניטרלי מספר האלקטרונים שווה למספר הפרוטונים: ${el.z}.` });
    items.push({ ...base, id: `who:${el.s}`, key: `sc:who:${el.s}`, topic: 'atom', gen: true, q: `באטום ניטרלי יש ${el.z} אלקטרונים. איזה יסוד זה?`,
      options: [`${el.he} (${el.s})`, ...others(el, (e) => `${e.he} (${e.s})`)], why: `${el.z} אלקטרונים באטום ניטרלי = ${el.z} פרוטונים. המספר האטומי ${el.z} הוא ${el.he}.` });
    if (el.t === 'm' || el.t === 'n') {
      items.push({ ...base, id: `ty:${el.s}`, key: `sc:ty:${el.s}`, topic: 'metals', gen: true, viz: 'table-type', hi: el.z, q: `${el.he} (${el.s}): מתכת או אל-מתכת?`,
        options: el.t === 'm' ? ['מתכת', 'אל-מתכת'] : ['אל-מתכת', 'מתכת'], why: `${el.he} היא ${el.t === 'm' ? 'מתכת' : 'אל-מתכת'}. ${el.z === 1 ? 'מימן בצד שמאל, אבל הוא אל-מתכת.' : 'אפשר לראות לפי מקומה בטבלה.'}` });
    }
    if (el.z <= 20 && el.z !== 1 && el.z !== 2) {
      const row = POS(el.z)[0];
      items.push({ ...base, id: `rw:${el.s}`, key: `sc:rw:${el.s}`, topic: 'table', gen: true, viz: 'table-rows', hi: el.z, q: `באיזו שורה בטבלה המחזורית נמצא ${el.he} (${el.s})?`,
        options: [String(row), ...[1, 2, 3, 4].filter((x) => x !== row).map(String)].slice(0, 4), why: `מספר אטומי ${el.z}: שורה 1 היא 1-2, שורה 2 היא 3-10, שורה 3 היא 11-18, שורה 4 מתחילה ב-19. לכן ${el.he} בשורה ${row}.` });
    }
  }
  return items;
}

// ---------- help panels ----------
function helpFor(U, it) {
  const syms = U.symbols.split(' ');
  const tm = tableMethods(syms);
  const el = it.el;
  let methods, spec = { el, hi: it.hi ?? it.z }, start = 0;
  const tableStart = { 'table-type': 0, 'table-rows': 1, 'table-cols': 2 };
  if (it.viz?.startsWith('table')) { methods = tm; start = tableStart[it.viz]; }
  else if (it.viz === 'table') { methods = tm; }
  else if (it.viz === 'charge') methods = CHARGE_METHODS;
  else if (it.viz === 'element') methods = ELEMENT_METHODS;
  else if (it.viz === 'metals') methods = [...METAL_METHODS, tm[0]];
  else {
    const e = el || U.elements.find((x) => x.z === 6);
    spec = { el: e };
    methods = ATOM_METHODS.filter((m) => !m.ok || m.ok(e));
  }
  if (it.topic === 'charge' && el) { methods = ATOM_METHODS.filter((m) => !m.ok || m.ok(el)); start = 2; }
  return { methods, spec, start };
}

function toQuestion(U, it) {
  const options = shuffle(it.options).map((o) => ({ html: `<span class="sc-opt">${mixed(o)}</span>`, value: o }));
  return {
    key: it.key, answer: it.options[0], options,
    prompt: `<p class="q-ask">${mixed(it.q)}</p>`,
    help: () => `<p class="be-right">✓ ${mixed(it.options[0])}</p><p class="be-why">${mixed(it.why)}</p><div class="sc-help-viz"></div>`,
    afterHelp: (el) => { const h = helpFor(U, it); panel(el.querySelector('.sc-help-viz'), h.methods, h.spec, h.start); },
  };
}

// ---------- routes ----------
export async function renderScience(root, kid, [view = 'menu', ...args]) {
  const base = `#/kid/${kid.id}/science`;
  const U = await loadUnit(kid.id);
  if (!U) { root.innerHTML = '<p class="subtitle">עוד אין חומר לנושא הזה.</p>'; return; }
  if (view === 'learn') return learn(root, base, U, args[0] || 'atom', args[1]);
  if (view === 'build') return build(root, base, U);
  if (view === 'practice') return practice(root, kid, base, U, args[0] || 'mix');
  if (view === 'read') return args[0] ? readText(root, kid, base, U, args[0]) : readList(root, base, U);
  if (view === 'open') return openQs(root, kid, base, U);
  if (view === 'mock') return mockIntro(root, kid, base, U);
  menu(root, kid, base, U);
}

function menu(root, kid, base, U) {
  const p = getProgress(kid.id);
  const all = bank(U);
  const keys = all.map((i) => i.key);
  const known = keys.filter((k) => box(p.items, k) >= MASTERED_BOX).length;
  const tests = p.sessions.filter((s) => s.module === 'science' && s.part === 'mock');
  const card = (href, icon, title, sub) => `<a class="card" href="${href}"><span class="card-icon">${icon}</span><span class="card-title">${title}</span><span class="card-sub">${sub}</span></a>`;
  root.innerHTML = `
    <h1 class="page-title">🔬 מדעים: מבנה האטום</h1>
    <p class="subtitle">${esc(U.source)}<br>בעל פה: ${known} מתוך ${keys.length}</p>
    <h2 class="section">1. ללמוד ולהבין (כל נושא ב-3 דרכים לפחות)</h2>
    <div class="cards">${Object.entries(U.topics).map(([id, t]) => card(`${base}/learn/${id}`, t.icon, t.title, 'הסיכום של המורה, עם ציורים')).join('')}
      ${card(`${base}/build`, '🧱', 'בנו אטום', 'מוסיפים פרוטונים, נויטרונים ואלקטרונים, ורואים איזה יסוד נוצר')}</div>
    <h2 class="section">2. תרגול</h2>
    <div class="cards">
      ${card(`${base}/practice/mix`, '🎯', 'תרגול מעורב', 'כל הנושאים, יותר ממה שעוד קשה')}
      ${Object.entries(U.topics).map(([id, t]) => card(`${base}/practice/${id}`, t.icon, t.title, 'תרגול רק בנושא הזה')).join('')}
      ${card(`${base}/read`, '📄', 'קטע קריאה', 'שאלות על קטע, כמו במבחן')}
      ${card(`${base}/open`, '✍️', 'שאלות פתוחות', 'עונים, ואז משווים לתשובה לדוגמה')}</div>
    <h2 class="section">3. מבחן</h2>
    <div class="cards">${card(`${base}/mock`, '🏁', 'מבחן לדוגמה', `רב-ברירה וקטע קריאה, ציון מתוך 100${tests.length ? `<br><small>אחרון: ${tests.at(-1).score}</small>` : ''}`)}</div>`;
}

// ---------- learn ----------
function topicMethods(U, topic) {
  const tm = tableMethods(U.symbols.split(' '));
  return { atom: ATOM_METHODS, charge: CHARGE_METHODS, element: ELEMENT_METHODS, table: tm, metals: [...METAL_METHODS, tm[0]] }[topic];
}
function learn(root, base, U, topic, sym) {
  const T = U.topics[topic] || U.topics.atom;
  if (!U.topics[topic]) topic = 'atom';
  const picks = U.elements.filter((e) => e.z <= 20);
  let cur = picks.find((e) => e.s === sym) || picks.find((e) => e.z === 6);
  root.innerHTML = `
    <a class="back" href="${base}">→ חזרה</a>
    <h1 class="page-title">${T.icon} ${T.title}</h1>
    <div class="sc-tabs">${Object.entries(U.topics).map(([id, t]) => `<a class="viz-tab ${id === topic ? 'active' : ''}" href="${base}/learn/${id}">${t.icon} ${t.title}</a>`).join('')}</div>
    <div class="panel wide sc-summary"><h2 class="sc-frame-h">📕 המסגרת האדומה: מה חייבים לדעת</h2><ul>${U.cards[topic].bullets.map((b) => `<li>${b.split(/(<\/?b>)/).map((x) => (/^<\/?b>$/.test(x) ? x : mixed(x))).join('')}</li>`).join('')}</ul></div>
    ${topic === 'atom' ? `<p class="subtitle">בחרו יסוד וראו את האטום שלו:</p><div class="be-pick sc-pick">${picks.map((e) => `<button class="be-pick-btn" data-s="${e.s}"><span class="en">${e.s}</span></button>`).join('')}</div>` : ''}
    <div id="viz"></div>
    <div class="row-center"><a class="btn btn-big" href="${base}/practice/${topic}">לתרגל את הנושא ✏️</a></div>`;
  const methods = topicMethods(U, topic);
  const usable = () => methods.filter((m) => !m.ok || m.ok(cur));
  let pn = panel(root.querySelector('#viz'), usable(), { el: cur });
  const mark = () => root.querySelectorAll('.sc-pick .be-pick-btn').forEach((b) => b.classList.toggle('on', b.dataset.s === cur.s));
  mark();
  root.querySelector('.sc-pick')?.addEventListener('click', (e) => {
    const b = e.target.closest('.be-pick-btn');
    if (!b) return;
    cur = picks.find((x) => x.s === b.dataset.s);
    pn = panel(root.querySelector('#viz'), usable(), { el: cur });
    mark();
  });
  void pn;
}

// ---------- build an atom ----------
function build(root, base, U) {
  const st = { z: 6, n: 6, e: 6 };
  root.innerHTML = `
    <a class="back" href="${base}">→ חזרה</a>
    <h1 class="page-title">🧱 בנו אטום</h1>
    <p class="subtitle">לחצו + ו-− וראו מה קורה. נסו לבנות אטום חמצן, ואז אטום שאינו ניטרלי.</p>
    <div class="sc-build">
      ${[['z', 'פרוטונים (+)', C.p], ['n', 'נויטרונים (0)', C.n], ['e', 'אלקטרונים (−)', C.e]].map(([k, l, c]) => `
        <div class="sc-ctr"><b style="color:${c}">${l}</b><div><button class="btn btn-soft" data-k="${k}" data-d="-1">−</button><span class="sc-num" id="v-${k}"></span><button class="btn btn-soft" data-k="${k}" data-d="1">+</button></div></div>`).join('')}
    </div>
    <div id="status" class="panel wide sc-status"></div>
    <div class="viz-box sc-viz"><div class="sc-bohr" id="pic"></div></div>`;
  const draw = () => {
    const el = U.elements.find((x) => x.z === st.z);
    const net = st.z - st.e;
    for (const k of ['z', 'n', 'e']) root.querySelector(`#v-${k}`).textContent = st[k];
    root.querySelector('#status').innerHTML = `
      <p>🧬 <b>מספר אטומי:</b> ${st.z || 0} ← ${st.z ? `היסוד: <b>${el ? `${esc(el.he)} <span class="en">(${el.s})</span>` : 'יסוד נוסף בטבלה'}</b>` : 'בלי פרוטונים אין יסוד'}</p>
      <p>${net === 0 ? '✅ <b>אטום ניטרלי</b>: מספר הפרוטונים שווה למספר האלקטרונים, המטען הכולל 0.'
        : `⚠️ <b>האטום לא ניטרלי</b>: ${net > 0 ? `יש ${net} פרוטונים יותר מאלקטרונים, המטען הכולל חיובי (+${net}).` : `יש ${-net} אלקטרונים יותר מפרוטונים, המטען הכולל שלילי (−${-net}).`}`}</p>
      <p class="muted small">שימו לב: שינוי מספר הנויטרונים לא משנה את היסוד ולא את המטען.</p>`;
    root.querySelector('#pic').innerHTML = (() => {
      const m = ATOM_METHODS[0].render({ z: st.z, n: st.n, e: st.e, s: '', he: '' }).html;
      return m;
    })();
  };
  root.querySelector('.sc-build').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-k]');
    if (!b) return;
    const lim = { z: [1, 20], n: [0, 22], e: [0, 20] }[b.dataset.k];
    st[b.dataset.k] = Math.min(lim[1], Math.max(lim[0], st[b.dataset.k] + +b.dataset.d));
    draw();
  }, { signal: viewSignal() });
  draw();
}

// ---------- practice ----------
function runPractice(root, kid, base, U, questions, part, again, label) {
  const progress = getProgress(kid.id);
  runQuiz(root, {
    back: base, questions,
    onResult: (q, ok, ms) => { progress.items[q.key] = review(progress.items[q.key], ok, ms); },
    onDone: ({ right, total, ms }) => {
      saveProgress(progress);
      logSession(kid.id, { module: 'science', part, unit: U.id, total, correct: right, ms });
      finishScreen(root, { right, total, again, links: `<a class="btn btn-soft" href="${base}/learn/${label || 'atom'}">📖 לחזור לסיכום</a><a class="btn btn-soft" href="${base}">לתפריט 🔬</a>` });
    },
  });
}

function practice(root, kid, base, U, topic) {
  const all = bank(U).filter((i) => topic === 'mix' || i.topic === topic);
  const byKey = new Map(all.map((i) => [i.key, i]));
  const keys = shuffle([...byKey.keys()]);
  const chosen = shuffle(pickSession(getProgress(kid.id).items, keys, 12, { maxNew: 6 }));
  runPractice(root, kid, base, U, chosen.map((k) => toQuestion(U, byKey.get(k))), topic, () => practice(root, kid, base, U, topic), topic === 'mix' ? 'atom' : topic);
}

// ---------- reading ----------
const para = (T, mark = '') => T.paragraphs.map((p, i) => {
  const at = mark ? p.indexOf(mark) : -1;
  const body = at < 0 ? esc(p) : `${esc(p.slice(0, at))}<mark class="rd-mark">${esc(mark)}</mark>${esc(p.slice(at + mark.length))}`;
  return `<p class="sc-rd-p"><span class="rd-n">${i + 1}</span>${body}</p>`;
}).join('');

function readList(root, base, U) {
  root.innerHTML = `<a class="back" href="${base}">→ חזרה</a><h1 class="page-title">📄 קטע קריאה</h1>
    <div class="cards">${U.reading.map((T) => `<a class="card" href="${base}/read/${T.id}"><span class="card-icon">${T.emoji}</span><span class="card-title">${esc(T.title)}</span><span class="card-sub">${T.questions.length} שאלות</span></a>`).join('')}</div>`;
}
function readQuestions(U, T) {
  return T.questions.map((q, i) => ({
    key: `sc:rd:${T.id}:${i}`, answer: q.options[0],
    options: shuffle(q.options).map((o) => ({ html: `<span class="sc-opt">${esc(o)}</span>`, value: o })),
    prompt: `<div class="rd-text sc-rd">${para(T)}</div><p class="q-ask">${esc(q.q)}</p>`,
    help: () => `<p class="be-right">✓ ${esc(q.options[0])}</p><p class="be-why">המקום בקטע:</p><div class="rd-text sc-rd">${para(T, q.evidence)}</div>`,
  }));
}
function readText(root, kid, base, U, id) {
  const T = U.reading.find((t) => t.id === id);
  if (!T) return readList(root, base, U);
  runPractice(root, kid, `${base}/read`, U, readQuestions(U, T), 'read', () => readText(root, kid, base, U, id), 'atom');
}

// ---------- open questions: write, compare with the model answer, tick what you covered ----------
function openQs(root, kid, base, U) {
  const done = {};
  root.innerHTML = `
    <a class="back" href="${base}">→ חזרה</a>
    <h1 class="page-title">✍️ שאלות פתוחות</h1>
    <p class="subtitle">עונים בקול או על דף. אחר כך לוחצים על ״התשובה לדוגמה״ ומסמנים מה כללתם בתשובה.</p>
    ${U.open.map((o, i) => `
      <div class="panel wide sc-open" data-i="${i}">
        <p class="q-ask">${i + 1}. ${mixed(o.q)}</p>
        <button class="btn btn-soft sc-show">👀 התשובה לדוגמה</button>
        <div class="sc-model" hidden>
          <p class="be-why">${mixed(o.model)}</p>
          <p><b>מה כללתם בתשובה?</b></p>
          ${o.points.map((pt, k) => `<label class="sc-pt"><input type="checkbox" data-k="${k}"> ${mixed(pt)}</label>`).join('')}
        </div>
      </div>`).join('')}
    <p class="subtitle" id="msg"></p>
    <div class="row-center"><button class="btn btn-big" id="fin">סיימתי ✅</button></div>`;
  root.addEventListener('click', (e) => {
    const show = e.target.closest('.sc-show');
    if (show) { show.nextElementSibling.hidden = false; show.hidden = true; done[+show.closest('.sc-open').dataset.i] = true; }
    if (!e.target.closest('#fin')) return;
    let total = 0, correct = 0;
    U.open.forEach((o, i) => {
      total += o.points.length;
      correct += root.querySelectorAll(`.sc-open[data-i="${i}"] input:checked`).length;
    });
    if (!Object.keys(done).length) { root.querySelector('#msg').textContent = 'קודם עונים ומסתכלים על לפחות תשובה אחת לדוגמה 🙂'; return; }
    logSession(kid.id, { module: 'science', part: 'open', unit: U.id, total, correct, ms: 0 });
    root.querySelector('#msg').textContent = `כללתם ${correct} מתוך ${total} נקודות. מה שלא סומן, כדאי לקרוא שוב בסיכום.`;
  }, { signal: viewSignal() });
}

// ---------- mock test ----------
function buildTest(U) {
  const items = bank(U).filter((i) => !i.gen);
  const take = (topic, n) => shuffle(items.filter((i) => i.topic === topic)).slice(0, n);
  const mc = shuffle([...take('atom', 4), ...take('charge', 3), ...take('element', 3), ...take('table', 3), ...take('metals', 3)]);
  const T = pick(U.reading);
  return { mc, T };
}
function mockIntro(root, kid, base, U) {
  const tests = getProgress(kid.id).sessions.filter((s) => s.module === 'science' && s.part === 'mock');
  root.innerHTML = `
    <a class="back" href="${base}">→ חזרה</a>
    <h1 class="page-title">🏁 מבחן לדוגמה: מבנה האטום</h1>
    <div class="panel">
      <p>המבחן האמיתי כולל שאלות רב-ברירה, קטע קריאה ושאלות פתוחות. כאן:</p>
      <ol class="mt-plan"><li>16 שאלות רב-ברירה · 60 נקודות</li><li>קטע קריאה עם 4 שאלות · 40 נקודות</li></ol>
      <p>את השאלות הפתוחות מתרגלים בנפרד ב״שאלות פתוחות״. אין משוב באמצע, ובסוף רואים כל טעות עם הסבר וציור.</p>
      ${tests.length ? `<p class="muted">מבחנים קודמים: ${tests.slice(-5).map((s) => s.score).join(' · ')}</p>` : ''}
      <div class="row-center"><button class="btn btn-big" id="start">מתחילים ✍️</button></div>
    </div>`;
  root.querySelector('#start').onclick = () => runMock(root, kid, base, U, buildTest(U));
}

function runMock(outer, kid, base, U, { mc, T }) {
  const begin = Date.now();
  const qs = [
    ...mc.map((it) => ({ ...it, part: 1, opts: shuffle(it.options), ans: it.options[0], label: mixed(it.q) })),
    ...T.questions.map((q, i) => ({ id: `${T.id}:${i}`, key: `sc:rd:${T.id}:${i}`, part: 2, opts: shuffle(q.options), ans: q.options[0], label: esc(q.q), evidence: q.evidence, why: '' })),
  ];
  const answers = qs.map(() => null);
  outer.innerHTML = '<div class="mt"></div>';
  const root = outer.firstElementChild;
  let confirm = false;
  const qHtml = (q, i) => `<div class="mt-q"><p class="mt-qtext"><b>${i + 1}.</b> ${q.label}</p><div class="mt-opts">${q.opts.map((o, k) => `<button class="mt-opt" data-i="${i}" data-k="${k}">${mixed(o)}</button>`).join('')}</div></div>`;
  root.innerHTML = `
    <a class="back" href="${base}">→ חזרה</a>
    <h1 class="page-title">🏁 מבחן לדוגמה</h1>
    <h2 class="mt-task">חלק א: שאלות רב-ברירה (60 נקודות)</h2>
    ${qs.map((q, i) => (q.part === 1 ? qHtml(q, i) : '')).join('')}
    <h2 class="mt-task">חלק ב: קטע קריאה (40 נקודות)</h2>
    <div class="rd-text sc-rd"><h3 class="rd-title">${T.emoji} ${esc(T.title)}</h3>${para(T)}</div>
    ${qs.map((q, i) => (q.part === 2 ? qHtml(q, i) : '')).join('')}
    <p class="subtitle" id="msg"></p>
    <div class="row-center"><button class="btn btn-big" id="submit">הגשה ✅</button></div>`;
  root.addEventListener('click', (e) => {
    const opt = e.target.closest('.mt-opt');
    if (opt) {
      answers[+opt.dataset.i] = qs[+opt.dataset.i].opts[+opt.dataset.k];
      opt.parentElement.querySelectorAll('.mt-opt').forEach((b) => b.classList.toggle('on', b === opt));
      return;
    }
    if (!e.target.closest('#submit')) return;
    const empty = answers.filter((a) => a === null).length;
    if (empty && !confirm) { confirm = true; root.querySelector('#msg').textContent = `נשארו ${empty} תשובות ריקות. לוחצים שוב על הגשה כדי להגיש בכל זאת.`; return; }
    mockResults(outer, kid, base, U, T, qs, answers, Date.now() - begin);
  }, { signal: viewSignal() });
}

function mockResults(outer, kid, base, U, T, qs, answers, ms) {
  const progress = getProgress(kid.id);
  const pts = { 1: 0, 2: 0 }, cnt = { 1: 0, 2: 0 }, ok = { 1: 0, 2: 0 }, mistakes = [];
  qs.forEach((q, i) => {
    const good = answers[i] === q.ans;
    cnt[q.part]++;
    if (good) ok[q.part]++; else mistakes.push({ q, i, v: answers[i] });
    progress.items[q.key] = review(progress.items[q.key], good, 5000);
  });
  pts[1] = Math.round((60 * ok[1]) / cnt[1]);
  pts[2] = Math.round((40 * ok[2]) / cnt[2]);
  const score = pts[1] + pts[2], correct = ok[1] + ok[2];
  saveProgress(progress);
  logSession(kid.id, { module: 'science', part: 'mock', unit: U.id, score, total: qs.length, correct, ms });
  const verdict = score >= 90 ? 'מצוין! אתם מוכנים למבחן 🏆' : score >= 75 ? 'טוב מאוד! עוברים על הטעויות, והציון יעלה עוד 💪'
    : score >= 55 ? 'בדרך הנכונה. כדאי לקרוא שוב את הסיכומים ולתרגל' : 'כדאי לחזור לסיכומים ולתרגל, ואז לנסות שוב 🙂';
  outer.innerHTML = '<div class="mt"></div>';
  const root = outer.firstElementChild;
  root.innerHTML = `
    <div class="finish"><p class="subtitle">הציון במבחן</p><div class="sp-grade">${score}</div><h1>${verdict}</h1>
      <p class="subtitle">${correct} נכונות מתוך ${qs.length} · ${Math.max(1, Math.round(ms / 6e4))} דקות</p></div>
    <div class="kpis"><div class="kpi"><span class="kpi-num">${pts[1]}<small>/60</small></span><span class="kpi-label">רב-ברירה</span></div>
      <div class="kpi"><span class="kpi-num">${pts[2]}<small>/40</small></span><span class="kpi-label">קטע קריאה</span></div></div>
    ${mistakes.length ? `<h2 class="section">הטעויות, עם התשובה הנכונה</h2><div class="mt-review">${mistakes.map(({ q, i, v }) => `
      <div class="mt-mistake"><p><b>${i + 1}.</b> ${q.label}</p>
        <p class="mt-ans">✗ התשובה שלכם: ${v ? mixed(v) : 'לא עניתם'}</p><p class="mt-ans">✓ התשובה הנכונה: ${mixed(q.ans)}</p>
        ${q.part === 1 ? `<p class="be-why">${mixed(q.why)}</p><div class="sc-mviz" data-i="${i}"></div>` : `<div class="rd-text sc-rd">${para(T, q.evidence)}</div>`}
      </div>`).join('')}</div>` : '<p class="subtitle">🎉 אין אף טעות!</p>'}
    <div class="row-center"><button class="btn btn-big" id="again">מבחן נוסף</button><a class="btn btn-soft" href="${base}">לתפריט 🔬</a></div>`;
  window.scrollTo(0, 0);
  root.querySelectorAll('.sc-mviz').forEach((el) => {
    const q = qs[+el.dataset.i];
    const h = helpFor(U, q);
    panel(el, h.methods, h.spec, h.start);
  });
  root.querySelector('#again').onclick = () => mockIntro(outer, kid, base, U);
}
