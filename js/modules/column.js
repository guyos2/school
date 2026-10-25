// חשבון במאונך: חיבור, חיסור וכפל במאונך, צעד אחר צעד מימין לשמאל.
// Exercises from class come from content/units/<kid>/ (index.json lists the files).
import { esc, ltr, pick, PRAISE, keypad, later } from '../ui.js';
import { finishScreen } from '../quiz.js';
import { plan, board, emptyState, applyPatch, vizPanel, resultOf, exText, PLACE, SYM } from '../viz/column.js';
import { getProgress, saveProgress, logSession } from '../store.js';
import { review } from '../srs.js';

const eq = (s) => `<span class="eq">${s}</span>`;
const SESSION_SIZE = 5;
const OPS = { add: 'חיבור', sub: 'חיסור', mul: 'כפל', mix: 'מעורב' };
const itemKey = (ex) => `col:${ex.op}:${ex.a}:${ex.b}`;
const EXAMPLES = { add: { op: 'add', a: 4567, b: 2385 }, sub: { op: 'sub', a: 5032, b: 1476 }, mul: { op: 'mul', a: 47, b: 8 } };

async function loadUnits(kidId) {
  try {
    const { units } = await fetch(`content/units/${kidId}/index.json`).then((r) => r.json());
    return await Promise.all(units.map((f) => fetch(`content/units/${kidId}/${f}`).then((r) => r.json())));
  } catch {
    return [];
  }
}

function parseEx([op, a, b]) {
  const ex = { op, a: +a, b: +b };
  const ok = SYM[op] && Number.isInteger(ex.a) && Number.isInteger(ex.b) && ex.a > 0 && ex.b > 0 && ex.a < 1e5 && ex.b < 1e5 &&
    (op !== 'sub' || ex.a > ex.b) && (op !== 'mul' || ex.b < 10);
  return ok ? ex : null;
}

export function renderColumn(root, kid, [view = 'menu', ...args]) {
  const base = `#/kid/${kid.id}/column`;
  if (view === 'class') return classList(root, kid, base);
  if (view === 'howto') return howto(root, base);
  if (view === 'practice' && OPS[args[0]]) return practice(root, kid, base, args[0]);
  if (view === 'solve' || view === 'watch') {
    const ex = parseEx(args);
    if (ex) return view === 'watch' ? watchOne(root, base, ex) : solveClass(root, kid, base, ex);
  }
  menu(root, kid, base);
}

async function menu(root, kid, base) {
  root.innerHTML = `
    <h1 class="page-title">🧮 חשבון במאונך</h1>
    <p class="subtitle">חיבור, חיסור וכפל במאונך, צעד אחר צעד</p>
    <div class="cards" id="cards">
      <a class="card" href="${base}/howto"><span class="card-icon">🧭</span><span class="card-title">איך פותרים במאונך</span><span class="card-sub">הכללים, ודוגמה שרואים צעד אחר צעד</span></a>
      <a class="card" href="${base}/practice/add"><span class="card-icon">➕</span><span class="card-title">תרגול חיבור</span><span class="card-sub">עם העברה לעמודה הבאה</span></a>
      <a class="card" href="${base}/practice/sub"><span class="card-icon">➖</span><span class="card-title">תרגול חיסור</span><span class="card-sub">עם פריטה, גם דרך 0</span></a>
      <a class="card" href="${base}/practice/mul"><span class="card-icon">✖️</span><span class="card-title">תרגול כפל</span><span class="card-sub">מספר כפול ספרה אחת</span></a>
      <a class="card" href="${base}/practice/mix"><span class="card-icon">🎲</span><span class="card-title">תרגול מעורב</span><span class="card-sub">קצת מהכול</span></a>
    </div>`;
  const units = await loadUnits(kid.id);
  if (!units.length || !root.querySelector('#cards')) return;
  const items = getProgress(kid.id).items;
  const all = units.flatMap((u) => u.groups.flatMap((g) => g.exercises));
  const done = all.filter((ex) => items[itemKey(ex)]?.right > 0).length;
  root.querySelector('#cards').insertAdjacentHTML('afterbegin', `
    <a class="card" href="${base}/class"><span class="card-icon">📸</span><span class="card-title">התרגילים מהכיתה</span>
      <span class="card-sub">פתרתם ${done} מתוך ${all.length}</span></a>`);
}

// ---------- how to solve ----------
const RULES = {
  add: [
    'כותבים את המספרים אחד מתחת לשני: אחדות מתחת לאחדות, עשרות מתחת לעשרות.',
    'מתחילים מימין, מעמודת האחדות, ומתקדמים שמאלה.',
    'אם בעמודה יצא 10 או יותר, כותבים למטה רק את ספרת האחדות, ומעבירים 1 קטן לעמודה שמשמאל.',
    'בעמודה הבאה לא שוכחים לחבר גם את ה-1 שהעברנו.',
  ],
  sub: [
    'כותבים את המספר הגדול למעלה ואת הקטן מתחתיו, אחדות מתחת לאחדות.',
    'מתחילים מימין, מעמודת האחדות.',
    'בכל עמודה בודקים: הספרה למעלה קטנה מהספרה למטה? אם כן, פורטים: לוקחים 1 מהעמודה שמשמאל, והספרה שלנו מקבלת 10.',
    'אם בעמודה שמשמאל יש 0, ממשיכים שמאלה עד שמוצאים ספרה שאינה 0. כל 0 בדרך הופך ל-9.',
    'בסוף בודקים בחיבור: התשובה + המספר שהורדנו = המספר הגדול.',
  ],
  mul: [
    'כותבים את המספר הגדול למעלה ואת הספרה מתחת לאחדות.',
    'כופלים את הספרה בכל ספרה של המספר, מימין לשמאל.',
    'אם יצא 10 או יותר, כותבים למטה את ספרת האחדות, ומעבירים את העשרות כמספר קטן מעל העמודה הבאה.',
    'בעמודה הבאה קודם כופלים, ורק אחר כך מוסיפים את מה שהעברנו.',
    'בעמודה האחרונה כותבים את כל המספר שיצא.',
  ],
};

function howto(root, base) {
  root.innerHTML = `
    <a class="back" href="${base}">→ חזרה</a>
    <h1 class="page-title">🧭 איך פותרים במאונך</h1>
    <p class="subtitle">הסוד: תמיד מתחילים <b>מימין</b>, מעמודת האחדות 👉</p>
    ${['add', 'sub', 'mul'].map((op) => `
      <div class="panel col-rules">
        <h2>${{ add: '➕ חיבור', sub: '➖ חיסור', mul: '✖️ כפל' }[op]} במאונך</h2>
        <ol>${RULES[op].map((r) => `<li>${r}</li>`).join('')}</ol>
        <div class="row-center">
          <a class="btn" href="${base}/watch/${op}/${EXAMPLES[op].a}/${EXAMPLES[op].b}">👀 צפו בדוגמה: ${ltr(exText(EXAMPLES[op]))}</a>
          <a class="btn btn-soft" href="${base}/practice/${op}">✏️ נסו בעצמכם</a>
        </div>
      </div>`).join('')}`;
}

// ---------- class exercises ----------
async function classList(root, kid, base) {
  root.innerHTML = `<a class="back" href="${base}">→ חזרה</a><h1 class="page-title">📸 התרגילים מהכיתה</h1><div id="list"></div>`;
  const units = await loadUnits(kid.id);
  const list = root.querySelector('#list');
  if (!list) return;
  const items = getProgress(kid.id).items;
  list.innerHTML = units.map((u) => `
    <p class="subtitle">${esc(u.source || u.title)}</p>
    ${u.groups.map((g) => `
      <h2 class="section">${esc(g.title)}</h2>
      <div class="col-list">${g.exercises.map((ex) => {
        const it = items[itemKey(ex)];
        return `<a class="col-item" href="${base}/solve/${ex.op}/${ex.a}/${ex.b}">
          <span class="col-ex">${ltr(`${exText(ex)} = ?`)}</span>
          <span class="col-state">${it?.right ? '✅ פתרתם' : '✏️ לפתור'}</span></a>`;
      }).join('')}</div>`).join('')}`).join('') || '<p class="subtitle">עוד אין תרגילים מהכיתה.</p>';
}

function solveClass(root, kid, base, ex) {
  solver(root, {
    back: `${base}/class`, list: [ex],
    onSolved: (e, mistakes, ms) => {
      const progress = getProgress(kid.id);
      progress.items[itemKey(e)] = review(progress.items[itemKey(e)], mistakes === 0, 0);
      saveProgress(progress);
      logSession(kid.id, { module: 'column', part: 'class', total: 1, correct: mistakes === 0 ? 1 : 0, ms });
    },
    again: () => solveClass(root, kid, base, ex),
    endLinks: `<a class="btn btn-soft" href="${base}/class">לרשימת התרגילים 📸</a>`,
  });
}

function watchOne(root, base, ex) {
  solver(root, {
    back: `${base}/howto`, list: [ex], watch: true,
    endLinks: `<a class="btn btn-soft" href="${base}/howto">חזרה לכללים 🧭</a><a class="btn" href="${base}/practice/${ex.op}">✏️ עכשיו אתם</a>`,
  });
}

// ---------- practice: new exercises in the style of the class ----------
const rnd = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
const regroups = (ex) => plan(ex).steps.filter((s) => s.patch.marks || s.from != null).length;

function genOne(op) {
  for (let t = 0; t < 200; t++) {
    let ex;
    if (op === 'add') ex = { op, a: rnd(1000, 8999), b: Math.random() < 0.3 ? rnd(100, 999) : rnd(1000, 8999) };
    else if (op === 'mul') ex = { op, a: Math.random() < 0.5 ? rnd(12, 99) : rnd(102, 999), b: rnd(3, 9) };
    else {
      let a = String(Math.random() < 0.3 ? rnd(300, 999) : rnd(2000, 9999));
      if (Math.random() < 0.4) { const i = rnd(1, a.length - 2); a = a.slice(0, i) + '0' + a.slice(i + 1); } // a 0 in the middle, like 6028
      ex = { op, a: +a, b: rnd(100, +a - 100) };
    }
    if (regroups(ex) >= (op === 'add' ? 2 : 1)) return ex;
  }
  return EXAMPLES[op];
}

function practice(root, kid, base, op) {
  const list = Array.from({ length: SESSION_SIZE }, () => genOne(op === 'mix' ? pick(['add', 'sub', 'mul']) : op));
  solver(root, {
    back: base, list,
    onDone: ({ right, total, ms }) => {
      logSession(kid.id, { module: 'column', part: op, total, correct: right, ms });
      finishScreen(root, {
        right, total,
        extra: '<p class="subtitle">(נכון בניסיון הראשון = תרגיל שנפתר בלי אף טעות)</p>',
        again: () => practice(root, kid, base, op),
        links: `<a class="btn btn-soft" href="${base}">לתפריט 🧮</a>`,
      });
    },
  });
}

// ---------- the solver: one board, steps right to left ----------
function checkLine(ex) {
  const r = resultOf(ex);
  if (ex.op === 'add') return `בדיקה בחיסור:<br>${eq(`${r} − ${ex.b} = ${ex.a}`)} ✔`;
  if (ex.op === 'sub') return `בדיקה בחיבור:<br>${eq(`${r} + ${ex.b} = ${ex.a}`)} ✔`;
  const mag = 10 ** (String(ex.a).length - 1);
  const est = Math.round(ex.a / mag) * mag;
  if (est === ex.a) return '';
  return `הערכה: ${eq(`${ex.a} ≈ ${est}`)}, ו-${eq(`${est} × ${ex.b} = ${est * ex.b}`)}. התשובה קרובה לזה, אז היא הגיונית ✔`;
}

function solver(outer, { back, list, watch = false, onSolved, onDone, again, endLinks = '' }) {
  outer.innerHTML = '<div class="solver"></div>';
  const root = outer.firstElementChild;
  root.innerHTML = `
    <a class="back" href="${back}">→ חזרה</a>
    ${list.length > 1 ? '<div class="progress-bar"><div class="progress-fill"></div></div>' : ''}
    <div class="col-wrap" id="board"></div>
    <div class="q-card col-card">
      <p class="col-note" id="note"></p>
      <div id="ask"></div>
      <div class="q-feedback" id="fb"></div>
    </div>
    <div id="pad"></div>
    <div class="row-center" id="act"></div>
    <div id="help"></div>`;
  const $ = (s) => root.querySelector(s);

  let n = -1, ex, P, state, si, cur, typed, locked, waiting, mistakes, begin, right = 0;
  const sessionStart = Date.now();

  const drawBoard = (active = -1, from = -1) => { $('#board').innerHTML = board(ex, P, state, active, from); };
  const setAct = (html, fn) => {
    $('#act').innerHTML = html;
    waiting = fn;
    const b = $('#act .btn-go');
    if (b) b.onclick = () => fn();
  };
  const goBtn = (label) => `<button class="btn btn-big btn-go">${label}</button>`;

  const loadEx = () => {
    n++;
    ex = list[n]; P = plan(ex); state = emptyState();
    si = 0; mistakes = 0; begin = Date.now();
    if (list.length > 1) $('.progress-fill').style.width = `${(n / list.length) * 100}%`;
    $('#help').innerHTML = '';
    $('#note').innerHTML = 'מתחילים מימין, מעמודת האחדות 👉';
    showStep();
  };

  const advance = (explain) => {
    if (explain) $('#note').innerHTML = `✔ ${explain}`;
    si++;
    showStep();
  };

  const drawAsk = () => {
    $('#ask').innerHTML = `
      <p class="q-ask">עמודת ה${PLACE[cur.place]}</p>
      <div class="q-text col-q ltr">${cur.q} = <span class="q-input">${typed || '?'}</span></div>`;
  };

  const showStep = () => {
    cur = P.steps[si];
    if (!cur) return finishEx();
    typed = ''; locked = false; waiting = null;
    $('#fb').textContent = ''; $('#fb').className = 'q-feedback';
    $('#help').innerHTML = '';
    $('#act').innerHTML = '';
    $('#pad').hidden = true;

    if (watch) {
      applyPatch(state, cur.patch);
      drawBoard(cur.place, cur.from);
      const what = cur.kind === 'info' ? cur.text
        : cur.kind === 'choice' ? `${cur.ask}<br><b>${cur.options.find((o) => o.value === cur.answer).html}</b> ${cur.explain}`
        : `${eq(`${cur.q} = ${cur.answer}`)}<br>${cur.explain}`;
      $('#note').innerHTML = '';
      $('#ask').innerHTML = `<p class="q-ask">עמודת ה${PLACE[cur.place]}</p><p class="col-say">${what}</p>`;
      setAct(goBtn('הצעד הבא ←'), () => advance());
      return;
    }
    if (cur.kind === 'info') {
      applyPatch(state, cur.patch);
      drawBoard(cur.place, cur.from);
      $('#ask').innerHTML = `<p class="col-say">💡 ${cur.text}</p>`;
      setAct(goBtn('הבנתי ←'), () => advance());
      return;
    }
    drawBoard(cur.place);
    if (cur.kind === 'choice') {
      $('#ask').innerHTML = `<p class="col-say">${cur.ask}</p>`;
      $('#act').innerHTML = cur.options.map((o, i) => `<button class="btn btn-soft col-opt" data-i="${i}">${o.html}</button>`).join('');
      $('#act').querySelectorAll('.col-opt').forEach((b) => {
        b.onclick = () => answer(cur.options[+b.dataset.i].value === cur.answer);
      });
      return;
    }
    drawAsk();
    $('#pad').hidden = false;
  };

  const answer = (ok) => {
    if (locked) return;
    locked = true;
    $('#pad').hidden = true;
    if (ok) {
      $('#fb').textContent = pick(PRAISE);
      $('#fb').className = 'q-feedback good';
      $('#act').innerHTML = '';
      applyPatch(state, cur.patch);
      drawBoard(cur.place);
      later(900, () => advance(cur.explain));
      return;
    }
    mistakes++;
    $('#fb').innerHTML = cur.kind === 'ask' ? `כמעט! ${eq(`${cur.q} = ${cur.answer}`)}` : `כמעט! ${cur.explain}`;
    $('#fb').className = 'q-feedback bad';
    const cont = () => { applyPatch(state, cur.patch); advance(cur.explain); };
    $('#help').innerHTML = `<div class="help-box">${cur.help()}${goBtn('הבנתי, ממשיכים ←')}</div>`;
    $('#help .btn-go').onclick = cont;
    setAct('', cont);
  };

  const finishEx = () => {
    const ms = Date.now() - begin;
    if (mistakes === 0) right++;
    drawBoard();
    onSolved?.(ex, mistakes, ms);
    $('#note').innerHTML = '';
    $('#fb').textContent = '';
    $('#ask').innerHTML = `
      <p class="q-ask">${watch ? 'זה הפתרון!' : mistakes ? '🎉 סיימתם את התרגיל!' : '🌟 פתרתם בלי אף טעות!'}</p>
      <div class="q-text col-done ltr">${exText(ex)} = ${resultOf(ex)}</div>
      <p class="col-say">${checkLine(ex)}</p>`;
    $('#help').innerHTML = '<h2 class="section">רואים את התרגיל בדרכים אחרות</h2><div id="viz"></div>';
    vizPanel($('#viz'), ex);
    if (n < list.length - 1) {
      setAct(goBtn('לתרגיל הבא ←'), loadEx);
    } else if (onDone) {
      setAct(goBtn('סיום ←'), () => onDone({ right, total: list.length, ms: Date.now() - sessionStart }));
    } else {
      $('#act').innerHTML = endLinks + (again ? '<button class="btn btn-soft" id="again">🔁 לפתור שוב</button>' : '');
      waiting = null;
      if (again) $('#again').onclick = again;
    }
  };

  // A rerun builds a new solver on the same screen; the old keypad listener must go quiet.
  const live = () => root.isConnected;
  keypad($('#pad'), {
    onDigit: (d) => { if (!live()) return; if (cur?.kind === 'ask' && !locked && !$('#pad').hidden && typed.length < 3) { typed += d; drawAsk(); } },
    onBack: () => { if (!live()) return; if (cur?.kind === 'ask' && !locked) { typed = typed.slice(0, -1); drawAsk(); } },
    onEnter: () => {
      if (!live()) return;
      if (waiting) return waiting();
      if (cur?.kind === 'ask' && !locked && typed && !$('#pad').hidden) answer(+typed === cur.answer);
    },
  });
  loadEx();
}
