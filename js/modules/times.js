// לוח הכפל: learn with visualizations, practice with spaced repetition, progress map.
// Once the 1–10 table is mostly known by heart, practice sessions shift toward
// harder multiplication (single×two-digit, then two×two-digit), via a small
// adaptive ladder (see TIER/SUB state below) instead of drilling known facts.
import { esc, ltr, shuffle, pick, PRAISE, keypad, later } from '../ui.js';
import { vizPanel } from '../viz/multiply.js';
import { vizPanelBig, METHODS as BIG_METHODS } from '../viz/multiplyBig.js';
import { getProgress, saveProgress, logSession } from '../store.js';
import { review, pickSession, MASTERED_BOX } from '../srs.js';

const SESSION_SIZE = 12;
const key = (a, b) => `mul:${Math.min(a, b)}x${Math.max(a, b)}`;

// Easy tables first (1, 10, 2, 5), the hardest (6, 7, 8) last.
const WEIGHT = { 1: 0, 10: 1, 2: 2, 5: 3, 3: 4, 4: 5, 9: 6, 6: 7, 7: 8, 8: 9 };
const FACTS = [];
for (let a = 1; a <= 10; a++) for (let b = a; b <= 10; b++) FACTS.push([a, b]);
FACTS.sort(([a1, b1], [a2, b2]) =>
  (Math.max(WEIGHT[a1], WEIGHT[b1]) - Math.max(WEIGHT[a2], WEIGHT[b2])) ||
  (Math.min(WEIGHT[a1], WEIGHT[b1]) - Math.min(WEIGHT[a2], WEIGHT[b2])));
const FACT_KEYS = FACTS.map(([a, b]) => key(a, b));
const parseKey = (k) => k.slice(4).split('x').map(Number);

const masteredCount = (items) => FACT_KEYS.filter((k) => (items[k]?.box || 0) >= MASTERED_BOX).length;

// ---- difficulty ladder: tier 0 = the 1–10 table, tier 1 = single×two-digit,
// tier 2 = two×two-digit. Each tier beyond 0 has sub-levels that widen the
// number range. State lives in progress.items['mul:prog'] (merges like any item).
const TIER_UNLOCK_RATIO = 0.8;
const WIN_SIZE = 10;
const PROMOTE_RATIO = 0.8;
const DEMOTE_RATIO = 0.4;
const MAX_SUB = 2;
const SUB_RANGES = [[11, 20], [11, 50], [11, 99]];
const TIER0_SLOTS = 3; // keep a light maintenance dose of the base table once past tier 0
const RECENT_CAP = 40;

const TIER_NAMES = ['לוח הכפל (1–10)', 'כפל חד־ספרתי בדו־ספרתי', 'כפל דו־ספרתי בדו־ספרתי'];
const SUB_NAMES = ['(מספרים עד 20)', '(מספרים עד 50)', '(מספרים עד 99)'];
const stageLabel = (tier, sub) => (tier === 0 ? TIER_NAMES[0] : `${TIER_NAMES[tier]} ${SUB_NAMES[sub]}`);

function getTierState(items) {
  const s = items['mul:prog'];
  return { tier: s?.tier || 0, sub: s?.sub || 0, win: s?.win || [], recent: s?.recent || [] };
}
function saveTierState(progress, state) {
  progress.items['mul:prog'] = { ...state, updated: Date.now() };
}

const randInt = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
const bigKey = (a, b) => `big:${Math.min(a, b)}x${Math.max(a, b)}`;

function genBigProblem(tier, sub, exclude) {
  const [lo, hi] = SUB_RANGES[sub];
  let a, b, k;
  for (let tries = 0; tries < 40; tries++) {
    a = tier === 1 ? randInt(2, 9) : randInt(lo, hi);
    b = randInt(lo, hi);
    k = bigKey(a, b);
    if (!exclude.has(k)) break;
  }
  if (Math.random() < 0.5) [a, b] = [b, a];
  return { k, a, b, big: tier };
}

export function renderTimes(root, kid, [view = 'menu', ...args]) {
  const base = `#/kid/${kid.id}/times`;
  if (view === 'learn') return learn(root, kid, base, +args[0] || 3, +args[1] || 4);
  if (view === 'practice') return practice(root, kid, base);
  if (view === 'map') return map(root, kid, base);
  const items = getProgress(kid.id).items;
  const { tier, sub } = getTierState(items);
  root.innerHTML = `
    <h1 class="page-title">✖️ לוח הכפל</h1>
    <p class="subtitle">כבר בעל פה: ${masteredCount(items)} מתוך ${FACT_KEYS.length} תרגילים</p>
    ${tier > 0 ? `<p class="subtitle">🚀 השלב הנוכחי: ${esc(stageLabel(tier, sub))}</p>` : ''}
    <div class="cards">
      <a class="card" href="${base}/practice"><span class="card-icon">🎯</span><span class="card-title">תרגול יומי</span><span class="card-sub">${SESSION_SIZE} תרגילים, מותאם בדיוק בשבילך</span></a>
      <a class="card" href="${base}/learn"><span class="card-icon">🔍</span><span class="card-title">ללמוד ולראות</span><span class="card-sub">רואים כל תרגיל ב-5 דרכים</span></a>
      <a class="card" href="${base}/map"><span class="card-icon">🗺️</span><span class="card-title">המפה שלי</span><span class="card-sub">מה כבר יודעים ומה עוד לא</span></a>
    </div>`;
}

function learn(root, kid, base, a, b) {
  const stepper = (name, v) => `
    <div class="stepper" data-name="${name}">
      <button class="step" data-d="-1">−</button><span class="step-val">${v}</span><button class="step" data-d="1">+</button>
    </div>`;
  root.innerHTML = `
    <a class="back" href="${base}">→ חזרה</a>
    <h1 class="page-title">🔍 ללמוד ולראות</h1>
    <div class="learn-pick ltr">${stepper('a', a)}<span class="big-op">×</span>${stepper('b', b)}<span class="big-op">=</span><span class="learn-ans">?</span></div>
    <div class="row-center"><button class="btn btn-soft" id="flip">↔️ להפוך את הסדר</button><button class="btn" id="reveal">לגלות את התשובה</button></div>
    <div id="viz"></div>`;
  const panel = vizPanel(root.querySelector('#viz'), a, b);
  const ans = root.querySelector('.learn-ans');
  const update = () => {
    root.querySelector('[data-name=a] .step-val').textContent = a;
    root.querySelector('[data-name=b] .step-val').textContent = b;
    ans.textContent = '?';
    panel.set(a, b);
    history.replaceState(null, '', `${base}/learn/${a}/${b}`);
  };
  root.querySelector('.learn-pick').addEventListener('click', (e) => {
    const btn = e.target.closest('.step');
    if (!btn) return;
    const name = btn.closest('.stepper').dataset.name;
    const v = Math.min(10, Math.max(1, (name === 'a' ? a : b) + +btn.dataset.d));
    if (name === 'a') a = v; else b = v;
    update();
  });
  root.querySelector('#flip').onclick = () => { [a, b] = [b, a]; update(); };
  root.querySelector('#reveal').onclick = () => { ans.textContent = a * b; };
}

function practice(root, kid, base) {
  const progress = getProgress(kid.id);
  const items = progress.items;
  const before = masteredCount(items);
  const state = getTierState(items);

  const asTierQ = (k) => {
    const [x, y] = parseKey(k);
    return Math.random() < 0.5 ? { k, a: x, b: y } : { k, a: y, b: x };
  };
  let queue;
  if (state.tier === 0) {
    queue = shuffle(pickSession(items, FACT_KEYS, SESSION_SIZE)).map(asTierQ);
  } else {
    const tier0Q = pickSession(items, FACT_KEYS, TIER0_SLOTS, { maxNew: 1 }).map(asTierQ);
    const exclude = new Set(state.recent);
    const bigQ = [];
    for (let n = 0; n < SESSION_SIZE - tier0Q.length; n++) {
      const p = genBigProblem(state.tier, state.sub, exclude);
      exclude.add(p.k);
      bigQ.push(p);
    }
    state.recent = [...exclude].slice(-RECENT_CAP);
    queue = shuffle([...tier0Q, ...bigQ]);
  }
  const firstTotal = queue.length;
  const missed = new Set();
  const bigResults = []; // first-try correctness for this session's harder (tier ≥ 1) problems
  let i = 0, firstRight = 0, input = '', started = 0, locked = false;

  root.innerHTML = `
    <a class="back" href="${base}">→ חזרה</a>
    <div class="progress-bar"><div class="progress-fill"></div></div>
    <div class="q-card">
      <div class="q-text ltr"><span id="qa"></span> × <span id="qb"></span> = <span class="q-input" id="qi"></span></div>
      <div class="q-feedback" id="fb"></div>
    </div>
    <div id="pad"></div>
    <div id="help"></div>`;
  const $ = (s) => root.querySelector(s);

  const show = () => {
    const q = queue[i];
    input = ''; locked = false; started = Date.now();
    $('#qa').textContent = q.a; $('#qb').textContent = q.b; $('#qi').textContent = '';
    $('#fb').textContent = ''; $('#fb').className = 'q-feedback';
    $('#help').innerHTML = ''; $('#pad').hidden = false;
    $('.progress-fill').style.width = `${(i / queue.length) * 100}%`;
  };

  const submit = () => {
    if (locked || !input) return;
    locked = true;
    const q = queue[i];
    const ok = +input === q.a * q.b;
    const isFirst = !q.retry;
    if (isFirst) {
      if (q.big) bigResults.push(ok);
      else progress.items[q.k] = review(progress.items[q.k], ok, Date.now() - started);
      if (ok) firstRight++;
    }
    if (ok) {
      $('#fb').textContent = pick(PRAISE);
      $('#fb').className = 'q-feedback good';
      later(800, next);
    } else {
      $('#fb').innerHTML = `כמעט! התשובה היא ${ltr(`${q.a} × ${q.b} = ${q.a * q.b}`)}`;
      $('#fb').className = 'q-feedback bad';
      $('#pad').hidden = true;
      if (!missed.has(q.k)) { missed.add(q.k); queue.push({ ...q, retry: true }); }
      const help = $('#help');
      help.innerHTML = `<div class="help-box"><div id="hv"></div><button class="btn btn-big" id="go">הבנתי, ממשיכים ←</button></div>`;
      if (q.big) vizPanelBig(help.querySelector('#hv'), q.a, q.b, Math.floor(Math.random() * BIG_METHODS.length));
      else vizPanel(help.querySelector('#hv'), q.a, q.b, Math.floor(Math.random() * 5));
      help.querySelector('#go').onclick = next;
    }
  };

  let promoted = false, demoted = false;
  const updateTierState = () => {
    if (state.tier === 0) {
      if (masteredCount(progress.items) / FACT_KEYS.length >= TIER_UNLOCK_RATIO) {
        state.tier = 1; state.sub = 0; state.win = [];
        promoted = true;
      }
    } else if (bigResults.length) {
      state.win = [...state.win, ...bigResults].slice(-WIN_SIZE * 2);
      if (state.win.length >= WIN_SIZE) {
        const ratio = state.win.filter(Boolean).length / state.win.length;
        if (ratio >= PROMOTE_RATIO && (state.sub < MAX_SUB || state.tier < 2)) {
          if (state.sub < MAX_SUB) state.sub++;
          else { state.tier++; state.sub = 0; }
          state.win = []; promoted = true;
        } else if (ratio <= DEMOTE_RATIO && (state.sub > 0 || state.tier > 1)) {
          if (state.sub > 0) state.sub--;
          else { state.tier--; state.sub = MAX_SUB; }
          state.win = []; demoted = true;
        }
      }
    }
    saveTierState(progress, state);
  };

  const next = () => {
    i++;
    if (i < queue.length) return show();
    updateTierState();
    saveProgress(progress);
    logSession(kid.id, { module: 'times', total: firstTotal, correct: firstRight });
    finish();
  };

  const finish = () => {
    const after = masteredCount(getProgress(kid.id).items);
    const ratio = firstRight / Math.max(firstTotal, 1);
    const stars = ratio >= 0.9 ? 3 : ratio >= 0.6 ? 2 : 1;
    root.innerHTML = `
      <div class="finish">
        <div class="stars">${'⭐'.repeat(stars)}</div>
        <h1>סיימתם את הסיבוב!</h1>
        <p class="subtitle">${firstRight} נכונות בניסיון הראשון מתוך ${firstTotal}</p>
        ${after > before ? `<p class="subtitle">🎉 ${after - before} תרגילים חדשים נכנסו לרשימת היודעים בעל פה!</p>` : ''}
        ${promoted ? `<p class="subtitle">🚀 עולים לשלב הבא: ${esc(stageLabel(state.tier, state.sub))}!</p>` : ''}
        ${demoted ? `<p class="subtitle">💡 חוזרים לרגע לתרגול קל יותר כדי לחזק את הביטחון: ${esc(stageLabel(state.tier, state.sub))}</p>` : ''}
        <div class="row-center">
          <a class="btn btn-big" href="${base}/practice" id="again">עוד סיבוב</a>
          <a class="btn btn-soft" href="${base}/map">למפה שלי 🗺️</a>
        </div>
      </div>`;
    // Same hash as now → force a re-render.
    root.querySelector('#again').onclick = (e) => { e.preventDefault(); practice(root, kid, base); };
  };

  keypad($('#pad'), {
    onDigit: (d) => { if (!locked && input.length < 5) { input += d; $('#qi').textContent = input; } },
    onBack: () => { if (!locked) { input = input.slice(0, -1); $('#qi').textContent = input; } },
    onEnter: () => { if (!locked) submit(); else if ($('#go')) next(); },
  });
  show();
}

function map(root, kid, base) {
  const items = getProgress(kid.id).items;
  const LEVELS = ['עוד לא תרגלנו', 'מתחילים', 'מתקדמים', 'כמעט', 'יודעים', 'אלופים'];
  let cells = '<div class="tt-cell tt-head">×</div>';
  for (let b = 1; b <= 10; b++) cells += `<div class="tt-cell tt-head">${b}</div>`;
  for (let a = 1; a <= 10; a++) {
    cells += `<div class="tt-cell tt-head">${a}</div>`;
    for (let b = 1; b <= 10; b++) {
      const box = items[key(a, b)]?.box || 0;
      cells += `<a class="tt-cell lvl-${box}" href="${base}/learn/${a}/${b}" title="${LEVELS[box]}">${a * b}</a>`;
    }
  }
  root.innerHTML = `
    <a class="back" href="${base}">→ חזרה</a>
    <h1 class="page-title">🗺️ המפה של ${esc(kid.name)}</h1>
    <p class="subtitle">כבר בעל פה: ${masteredCount(items)} מתוך ${FACT_KEYS.length}. לחיצה על משבצת מראה אותה בציור.</p>
    <div class="tt-grid ltr">${cells}</div>
    <div class="legend">${LEVELS.map((l, i) => `<span><i class="lvl-${i}"></i>${l}</span>`).join('')}</div>`;
}
