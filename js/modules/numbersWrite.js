// מספרים טבעיים, "קוראים וכותבים": a short lesson in slides with quick checks, and a step-by-step practice that builds
// a number one class at a time (words → digits, and digits → words). Used by numbers.js.
import { esc, shuffle, pick, PRAISE, keypad, later } from '../ui.js';
import { finishScreen } from '../quiz.js';
import { PCOLOR, CLASS_NAME, fmt, words, numberWords, groupBoxes, vizPanel } from '../viz/numbers.js';
import { getProgress, saveProgress, logSession } from '../store.js';
import { review } from '../srs.js';

const eq = (s) => `<span class="eq">${s}</span>`;
const rnd = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
const clean = (v) => String(v ?? '').replace(/[^0-9]/g, '');
const big = (s) => `<div class="nu-big ltr">${s}</div>`;
const STEPS_SIZE = 6;

// A number with len digits, often with a whole class of zeros (like 500,006 or 3,000,200).
function genNum(len) {
  let s = String(rnd(1, 9));
  for (let i = 1; i < len; i++) s += Math.random() < 0.35 ? '0' : rnd(1, 9);
  if (len > 4 && Math.random() < 0.3) { const k = len - 4 - rnd(0, Math.min(2, len - 5)); s = s.slice(0, k + 1).padEnd(len - 3, '0') + s.slice(len - 3); }
  return +s;
}

// Each class of n from the biggest: [{ cls, v, text }]; an empty class has text ''.
function classes(n) {
  const top = Math.floor((String(n).length - 1) / 3);
  const { groups } = numberWords(n);
  return Array.from({ length: top + 1 }, (_, i) => {
    const cls = top - i;
    return { cls, v: Math.floor(n / 1000 ** cls) % 1000, text: groups.find((g) => g.cls === cls)?.text || '' };
  });
}
const pad3 = (v, first) => (first ? String(v) : String(v).padStart(3, '0'));

// ---------- the hub ----------
export function writeHub(root, kid, base) {
  const p = getProgress(kid.id);
  const did = (part) => p.sessions.some((s) => s.module === 'numbers' && s.part === part);
  root.innerHTML = `
    <a class="back" href="${base}">→ חזרה</a>
    <h1 class="page-title">✍️ קוראים וכותבים מספרים גדולים</h1>
    <p class="subtitle">כדאי לעבור לפי הסדר: הסבר, בונים בשלבים, ואז תרגול</p>
    <div class="cards">
      <a class="card" href="${base}/write/lesson"><span class="card-icon">📖</span><span class="card-title">1. ההסבר</span>
        <span class="card-sub">איך קוראים ואיך כותבים, עם שאלות קטנות בדרך<br><small>${did('lesson') ? '✅ עברתם' : 'כ-5 דקות'}</small></span></a>
      <a class="card" href="${base}/write/steps"><span class="card-icon">🪜</span><span class="card-title">2. בונים בשלבים</span>
        <span class="card-sub">מחלקה אחרי מחלקה: מיליונים, אלפים, יחידות<br><small>${did('steps') ? '✅ תרגלתם' : '6 מספרים'}</small></span></a>
      <a class="card" href="${base}/practice/write"><span class="card-icon">✏️</span><span class="card-title">3. תרגול</span>
        <span class="card-sub">כמו במבדק: כל המספר בבת אחת</span></a>
    </div>`;
}

// ---------- the lesson ----------
const chip = (text, cls, extra = '') => `<span class="nu-wchip ${extra}" style="--c:${PCOLOR[cls * 3]}">${esc(text)}</span>`;

const SLIDES = [
  {
    title: 'מספר גדול מתחלק לשלשות',
    body: () => `
      <p>במספר גדול שמים <b>פסיק</b> אחרי כל שלוש ספרות, <b>מימין לשמאל</b>. כל שלשה נקראת <b>מחלקה</b>:</p>
      ${groupBoxes(1025041, { withWords: false })}
      <p>מימין: מחלקת <b>היחידות</b>, אחריה מחלקת <b>האלפים</b>, ואחריה מחלקת <b>המיליונים</b>.<br>
        רק המחלקה הראשונה משמאל יכולה להיות קצרה (כאן יש בה רק ${eq(1)}).</p>`,
    check: { q: `כמה מחלקות יש במספר ${eq('254,627')}?`, options: ['2', '3', '6'], answer: '2', n: 254627,
      why: 'יש פסיק אחד, ולכן שתי שלשות: 254 במחלקת האלפים ו-627 במחלקת היחידות.' },
  },
  {
    title: 'קוראים כל שלשה, ואז את שם המחלקה',
    body: () => `
      <p>את כל שלשה קוראים כמו מספר קטן (עד 999), ומיד אחריה אומרים את שם המחלקה: <b>מיליון</b> או <b>אלף</b>.
        את מחלקת היחידות קוראים בלי שם.</p>
      ${groupBoxes(1025041)}
      <p class="nu-say">${chip('מיליון', 2)} ${chip('עשרים וחמישה אלף', 1)} ${chip('ארבעים ואחת', 0)}</p>`,
    check: { q: `איך קוראים את ${eq('348,000')}?`, options: ['שלוש מאות ארבעים ושמונה אלף', 'שלושת אלפים ארבע מאות שמונים', 'שלוש מאות ארבעים ושמונה'], n: 348000,
      why: 'השלשה 348 יושבת במחלקת האלפים, ולכן אחריה אומרים "אלף". את 000 לא קוראים.' },
  },
  {
    title: 'אפסים: את 0 לא קוראים',
    body: () => `
      <p>אפסים בתחילת שלשה לא קוראים: ${eq('025')} = עשרים וחמש, ${eq('006')} = שש.<br>
        ושלשה שכולה ${eq('000')} לא קוראים בכלל, גם לא את שם המחלקה.</p>
      ${groupBoxes(500006)}
      <p class="nu-say">${chip('חמש מאות אלף', 1)} ${chip('ושש', 0)}</p>`,
    check: { q: `איך קוראים את ${eq('3,000,200')}?`, options: ['שלושה מיליון ומאתיים', 'שלושה מיליון מאתיים אלף', 'שלוש מאות אלף ומאתיים'], n: 3000200,
      why: 'מחלקת האלפים היא 000, ולכן לא אומרים "אלף" בכלל. נשארים שלושה מיליון, ומאתיים.' },
  },
  {
    title: 'מילים מיוחדות לאלפים ולמיליונים',
    body: () => `
      <div class="nu-words-table">
        ${[[1000, 'אלף'], [2000, 'אלפיים'], [3000, 'שלושת אלפים'], [5000, 'חמשת אלפים'], [8000, 'שמונת אלפים'], [10000, 'עשרת אלפים'],
          [11000, 'אחד עשר אלף'], [25000, 'עשרים וחמישה אלף'], [100000, 'מאה אלף'], [1000000, 'מיליון'], [2000000, 'שני מיליון'], [7000000, 'שבעה מיליון']]
          .map(([v, w]) => `<div><b class="ltr">${fmt(v)}</b><span>${w}</span></div>`).join('')}
      </div>
      <p>מ-3 עד 10 אלפים יש מילה מיוחדת: <b>שלושת</b> אלפים, <b>ארבעת</b> אלפים... ומ-11 אלף אומרים <b>אלף</b>: עשרים אלף, מאה אלף.</p>`,
    check: { q: 'איך כותבים בספרות: <b>שבעת אלפים</b>?', options: ['7,000', '70,000', '700'], n: 7000,
      why: '"שבעת אלפים" = 7 אלפים = 7,000.' },
  },
  {
    title: 'ממילים לספרות: "מיליון" ו"אלף" הם הפסיקים',
    body: () => `
      <ol class="nu-howto">
        <li>מחלקים את המילים לחלקים: מה שלפני <b>מיליון</b>, מה שלפני <b>אלף</b>, ומה שנשאר.</li>
        <li>כותבים כל חלק כמספר.</li>
        <li>כל מחלקה אחרי הראשונה היא <b>בדיוק 3 ספרות</b>. אם חסר, משלימים <b>0 משמאל</b>. מחלקה שלא הוזכרה = ${eq('000')}.</li>
      </ol>
      <p class="nu-say">${chip('שני מיליון', 2)} ${chip('עשרים וחמש אלף', 1)} ${chip('וארבע', 0)}</p>
      <div class="nu-steps-ex ltr">
        <span style="--c:${PCOLOR[6]}"><b>2</b><small>2</small></span><span class="nu-comma">,</span>
        <span style="--c:${PCOLOR[3]}"><b>025</b><small>25 ← 025</small></span><span class="nu-comma">,</span>
        <span style="--c:${PCOLOR[0]}"><b>004</b><small>4 ← 004</small></span>
      </div>
      <p>ביחד: ${eq('2,025,004')}</p>`,
    check: { q: 'איך כותבים בספרות: <b>חמש מאות אלף ושש</b>?', options: ['500,006', '5,006', '50,006'], n: 500006,
      why: 'חמש מאות אלף = 500 במחלקת האלפים. ושש = 6 במחלקת היחידות, שצריכה 3 ספרות: 006. ביחד 500,006.' },
  },
  {
    title: 'בדיקה: סופרים ספרות',
    body: () => `
      <p>בסוף כדאי לבדוק כמה ספרות יצאו:</p>
      <ul class="nu-howto">
        <li>מספר עם <b>מיליון</b>: 7 ספרות (1,000,000 עד 9,999,999).</li>
        <li>מספר עם <b>מאות אלפים</b>: 6 ספרות (100,000 עד 999,999).</li>
        <li>מספר עם <b>עשרות אלפים</b>: 5 ספרות. עם <b>אלפים</b>: 4 ספרות.</li>
      </ul>
      <p>טעות נפוצה: לכתוב <span class="struck">${eq('2,25,4')}</span> במקום ${eq('2,025,004')}. אחרי כל פסיק חייבות להיות 3 ספרות!</p>`,
    check: { q: 'כמה ספרות יש במספר <b>שני מיליון ושלוש</b>?', options: ['7', '4', '2'], n: 2000003,
      why: 'זה 2,000,003: מיליונים = 7 ספרות. האלפים והמאות הם 0, אבל הם עדיין כתובים.' },
  },
];

export function lesson(outer, kid, base) {
  outer.innerHTML = '<div class="nu-lesson"></div>';
  const root = outer.firstElementChild;
  const begin = Date.now();
  let i = 0, right = 0;
  const firstTry = new Set();

  const draw = () => {
    const S = SLIDES[i];
    const opts = shuffle(S.check.options);
    root.innerHTML = `
      <a class="back" href="${base}/write">→ חזרה</a>
      <div class="progress-bar"><div class="progress-fill" style="width:${(i / SLIDES.length) * 100}%"></div></div>
      <div class="panel wide nu-slide">
        <p class="nu-tag">שלב ${i + 1} מתוך ${SLIDES.length}</p>
        <h2>${S.title}</h2>
        ${S.body()}
      </div>
      <div class="q-card nu-check">
        <p class="q-ask">🤔 בדקו את עצמכם: ${S.check.q}</p>
        <div class="choices ${Math.max(...opts.map((o) => o.length)) > 12 ? 'nu-wide' : ''}">${opts.map((o) => `<button class="choice" data-o="${esc(o)}"><span class="${/^[0-9,]+$/.test(o) ? 'ltr' : ''}">${esc(o)}</span></button>`).join('')}</div>
        <div class="q-feedback" id="fb"></div>
        <div id="help"></div>
      </div>
      <div class="row-center">
        ${i ? '<button class="btn btn-soft" id="prev">→ הקודם</button>' : ''}
        <button class="btn btn-big" id="next" hidden>${i < SLIDES.length - 1 ? 'הלאה ←' : 'סיימתי ✅'}</button>
      </div>`;
    window.scrollTo(0, 0);
  };

  root.addEventListener('click', (e) => {
    const c = e.target.closest('.choice');
    if (c && !c.disabled) {
      const S = SLIDES[i], answer = S.check.answer ?? S.check.options[0], ok = c.dataset.o === answer;
      if (!firstTry.has(i)) { firstTry.add(i); if (ok) right++; }
      root.querySelectorAll('.choice').forEach((b) => {
        b.disabled = true;
        b.classList.add(b.dataset.o === answer ? 'correct' : b === c ? 'wrong' : 'dim');
      });
      const fb = root.querySelector('#fb');
      fb.textContent = ok ? pick(PRAISE) : 'כמעט! הנה למה 👇';
      fb.className = `q-feedback ${ok ? 'good' : 'bad'}`;
      root.querySelector('#help').innerHTML = `<p class="nu-why">${S.check.why}</p>${ok ? '' : '<div id="viz"></div>'}`;
      if (!ok) vizPanel(root.querySelector('#viz'), { kind: 'number', n: S.check.n }, 2);
      root.querySelector('#next').hidden = false;
      return;
    }
    if (e.target.closest('#prev')) { i--; draw(); return; }
    if (e.target.closest('#next')) {
      if (i < SLIDES.length - 1) { i++; draw(); return; }
      logSession(kid.id, { module: 'numbers', part: 'lesson', total: SLIDES.length, correct: right, ms: Date.now() - begin });
      outer.innerHTML = `
        <div class="finish">
          <div class="stars">📖</div>
          <h1>סיימתם את ההסבר!</h1>
          <p class="subtitle">${right} מתוך ${SLIDES.length} שאלות נכונות בניסיון הראשון</p>
          <div class="row-center">
            <a class="btn btn-big" href="${base}/write/steps">🪜 עכשיו בונים בשלבים</a>
            <a class="btn btn-soft" href="${base}/write">חזרה</a>
          </div>
        </div>`;
    }
  });
  draw();
}

// ---------- step by step ----------
// Words → digits: for each class, type how many (2 מיליון → 2, עשרים וחמש אלף → 25); the box then shows it as 3 digits.
// Digits → words: for each class, pick how its three digits are read.
function readOptions(v, cls) {
  const right = words(v * 1000 ** cls);
  const ok = (x) => x > 0 && x < 1e7;
  const cands = new Set();
  if (cls < 2) {
    const s = String(v).padStart(3, '0');
    for (const t of [s[1] + s[2] + s[0], s[2] + s[1] + s[0], s[0] + s[2] + s[1], s[1] + s[0] + s[2]]) if (+t !== v && ok(+t * 1000 ** cls)) cands.add(words(+t * 1000 ** cls));
  }
  if (cls > 0) cands.add(words(v)); // forgot the class name
  if (ok(v * 1000 ** (cls + 1))) cands.add(words(v * 1000 ** (cls + 1))); // the wrong class
  if (cls === 2) cands.add(words(v * 1000));
  cands.add(words(((v % (cls === 2 ? 9 : 999)) + 1) * 1000 ** cls));
  const wrong = shuffle([...cands].filter((w) => w !== right)).slice(0, 2);
  return shuffle([right, ...wrong]);
}

function buildPlan(n, mode) {
  const cl = classes(n);
  return cl.map((c, idx) => ({ ...c, first: idx === 0, mode }));
}

export function steps(outer, kid, base) {
  const list = Array.from({ length: STEPS_SIZE }, (_, k) => ({ n: genNum(rnd(5, 7)), mode: k % 2 ? 'tw' : 'td' }));
  outer.innerHTML = '<div class="quiz nu"></div>';
  const root = outer.firstElementChild;
  root.innerHTML = `
    <a class="back" href="${base}/write">→ חזרה</a>
    <div class="progress-bar"><div class="progress-fill"></div></div>
    <div class="q-card">
      <p class="q-ask" id="title"></p>
      <div id="src"></div>
      <div id="build"></div>
      <div class="nu-ask" id="ask"></div>
      <div class="q-feedback" id="fb"></div>
    </div>
    <div id="ans"></div>
    <div id="pad"></div>
    <div id="help"></div>`;
  const $ = (s) => root.querySelector(s);
  const begin = Date.now();
  let k = -1, item, plan, si, typed, locked, mistakes, opts, right = 0, started;

  const drawSrc = () => {
    if (item.mode === 'td') {
      $('#src').innerHTML = `<p class="nu-say">${plan.map((c, j) => (c.text
        ? chip(c.text, c.cls, j === si ? 'on' : j < si ? 'done' : '')
        : chip(`(אין ${CLASS_NAME[c.cls]})`, c.cls, `empty ${j === si ? 'on' : ''}`))).join(' ')}</p>`;
    } else {
      $('#src').innerHTML = groupBoxes(item.n, { withWords: false, hl: si < plan.length ? plan[si].cls : -1 });
    }
  };
  const drawBuild = () => {
    if (item.mode === 'td') {
      $('#build').innerHTML = `<div class="nu-steps-ex ltr">${plan.map((c, j) => `<span style="--c:${PCOLOR[c.cls * 3]}" class="${j === si ? 'on' : ''}">
        <b>${j < si ? pad3(c.v, c.first) : j === si ? (typed || '?') : '…'}</b><small>${CLASS_NAME[c.cls]}</small></span>`).join('<span class="nu-comma">,</span>')}</div>`;
    } else {
      $('#build').innerHTML = `<p class="nu-say">${plan.slice(0, si).map((c) => (c.text ? chip(c.text, c.cls, 'done') : '')).join(' ')}${si < plan.length ? ' <span class="muted">…</span>' : ''}</p>`;
    }
  };

  const loadItem = () => {
    k++;
    if (k >= list.length) return finish();
    item = list[k]; plan = buildPlan(item.n, item.mode); si = 0; mistakes = 0; started = Date.now();
    $('.progress-fill').style.width = `${(k / list.length) * 100}%`;
    $('#title').textContent = item.mode === 'td' ? 'כתבו בספרות, מחלקה אחרי מחלקה' : 'קראו את המספר, שלשה אחרי שלשה';
    showStep();
  };

  const showStep = () => {
    typed = ''; locked = false;
    $('#fb').textContent = ''; $('#fb').className = 'q-feedback';
    $('#help').innerHTML = '';
    $('#ans').innerHTML = '';
    $('#pad').hidden = true;
    if (si >= plan.length) return doneItem();
    const c = plan[si];
    drawSrc(); drawBuild();
    if (item.mode === 'td') {
      $('#ask').innerHTML = c.text
        ? `כמה <b>${CLASS_NAME[c.cls]}</b>? הקלידו את המספר שכתוב ב${c.cls ? `מילים שלפני "${c.cls === 2 ? 'מיליון' : 'אלף'}"` : 'חלק האחרון'}.`
        : `אין ${CLASS_NAME[c.cls]} במילים. כמה ${CLASS_NAME[c.cls]} יש? 🤔`;
      $('#pad').hidden = false;
    } else if (!c.text) {
      $('#ask').innerHTML = `במחלקת ה${CLASS_NAME[c.cls]} יש ${eq('000')}. את זה לא קוראים בכלל, גם לא את שם המחלקה.`;
      $('#ans').innerHTML = '<div class="row-center"><button class="btn btn-big" id="ok">הבנתי ←</button></div>';
    } else {
      $('#ask').innerHTML = `איך קוראים את השלשה ${eq(pad3(c.v, c.first))} במחלקת ה${CLASS_NAME[c.cls]}?`;
      opts = readOptions(c.v, c.cls);
      $('#ans').innerHTML = `<div class="choices nu-wide">${opts.map((o, j) => `<button class="choice" data-j="${j}">${esc(o)}</button>`).join('')}</div>`;
    }
  };

  const answer = (ok, shown) => {
    if (locked) return;
    locked = true;
    $('#pad').hidden = true;
    const c = plan[si];
    if (ok) {
      $('#fb').textContent = pick(PRAISE);
      $('#fb').className = 'q-feedback good';
      if (item.mode === 'td' && !c.first && String(c.v).length < 3) $('#fb').innerHTML += `<br><small>${eq(c.v)} במחלקת ה${CLASS_NAME[c.cls]} נכתב ${eq(pad3(c.v, false))}: תמיד 3 ספרות.</small>`;
      si++;
      later(item.mode === 'td' && !c.first && String(c.v).length < 3 ? 1900 : 1000, showStep);
      return;
    }
    mistakes++;
    $('#fb').textContent = 'כמעט! הנה התשובה 👇';
    $('#fb').className = 'q-feedback bad';
    const why = item.mode === 'td'
      ? (c.text ? `"${esc(c.text)}" = ${eq(c.v)} ${CLASS_NAME[c.cls]}${c.first ? '' : `, ובמספר כותבים ${eq(pad3(c.v, false))}`}.`
        : `לא הוזכרו ${CLASS_NAME[c.cls]}, ולכן יש 0 ${CLASS_NAME[c.cls]}, ובמספר כותבים ${eq('000')}.`)
      : `${eq(pad3(c.v, c.first))} במחלקת ה${CLASS_NAME[c.cls]} קוראים <b>${esc(words(c.v * 1000 ** c.cls))}</b>${shown ? `, ולא "${esc(shown)}"` : ''}.`;
    $('#help').innerHTML = `<div class="help-box"><p class="nu-why">${why}</p><div id="viz"></div><button class="btn btn-big" id="go">הבנתי, ממשיכים ←</button></div>`;
    vizPanel($('#viz'), { kind: 'number', n: item.n }, 2);
  };

  const doneItem = () => {
    drawSrc(); drawBuild();
    const ok = mistakes === 0;
    if (ok) right++;
    const p = getProgress(kid.id);
    const key = `nu:st:${item.mode}`;
    p.items[key] = review(p.items[key], ok, Date.now() - started);
    saveProgress(p);
    $('#ask').innerHTML = `${ok ? '🌟 בלי אף טעות!' : '🎉 בנינו את המספר!'}<br>${big(fmt(item.n))}<span class="nu-words">${esc(words(item.n))}</span>`;
    $('#ans').innerHTML = `<div class="row-center"><button class="btn btn-big" id="nextItem">${k < list.length - 1 ? 'למספר הבא ←' : 'סיום ←'}</button></div>`;
  };

  const finish = () => {
    logSession(kid.id, { module: 'numbers', part: 'steps', total: list.length, correct: right, ms: Date.now() - begin });
    finishScreen(outer, {
      right, total: list.length,
      extra: '<p class="subtitle">(נכון בניסיון הראשון = מספר שנבנה בלי אף טעות)</p>',
      again: () => steps(outer, kid, base),
      links: `<a class="btn" href="${base}/practice/write">✏️ לתרגול כמו במבדק</a>`,
    });
  };

  root.addEventListener('click', (e) => {
    if (e.target.closest('#go')) { si++; showStep(); return; }
    if (e.target.closest('#ok')) { si++; showStep(); return; }
    if (e.target.closest('#nextItem')) { loadItem(); return; }
    const c = e.target.closest('.choice');
    if (c && !locked) {
      const j = +c.dataset.j, rightText = words(plan[si].v * 1000 ** plan[si].cls);
      root.querySelectorAll('.choice').forEach((b, x) => b.classList.add(opts[x] === rightText ? 'correct' : x === j ? 'wrong' : 'dim'));
      answer(opts[j] === rightText, opts[j]);
    }
  });
  const live = () => root.isConnected;
  keypad($('#pad'), {
    onDigit: (d) => { if (live() && !locked && !$('#pad').hidden && typed.length < 3) { typed += d; drawBuild(); } },
    onBack: () => { if (live() && !locked) { typed = typed.slice(0, -1); drawBuild(); } },
    onEnter: () => {
      if (!live()) return;
      if ($('#go')) { si++; showStep(); return; }
      if ($('#nextItem')) { loadItem(); return; }
      if (!locked && typed && !$('#pad').hidden) answer(+typed === plan[si].v);
    },
  });
  loadItem();
}
