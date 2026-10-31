// The kid's side: home screen ("today's mission") and practice, reached by the kid's personal link.
import { esc, viewSignal } from './ui.js';
import { kidCall, rememberKid, forgetKid, read, write } from './api.js';
import { getProgress, saveProgress, logSession, bindKid, sync } from './store.js';
import { loadBank, resolveTestWords, GRADE_NAME } from './bank.js';
import { review, KNOWN_BOX } from './srs.js';
import { planFree, planTest, activeTest, daysUntil, testMaxInterval, readiness, wordCounts, streak, key } from './plan.js';
import { runPractice, wordCard } from './practice.js';
import { wireSpeakButtons } from './speech.js';

// The kid's details and tests, from the server, or the last copy on this device when offline.
async function loadKid(token) {
  try {
    const data = await kidCall(token, 'GET', 'kid');
    write(`kid:${token}`, data);
    rememberKid(token, data.kid);
    return data;
  } catch (e) {
    if (e.status === 401) { forgetKid(token); throw e; }
    const cached = read(`kid:${token}`, null);
    if (cached) return cached;
    throw e;
  }
}

async function context(token) {
  const { kid, tests } = await loadKid(token);
  bindKid(kid.id, token);
  const bank = await loadBank();
  const test = activeTest(tests);
  const testWords = test ? resolveTestWords(test, bank) : [];
  // Every word the kid may meet: the bank and the words of all their tests.
  const words = new Map(bank.map((w) => [w.id, w]));
  for (const t of tests) for (const w of resolveTestWords(t, bank)) words.set(w.id, w);
  const pool = bank.filter((w) => w.grade >= kid.grade).map((w) => w.id);
  return { kid, tests, bank, test, testWords, words, pool };
}

const badLink = (root) => {
  root.innerHTML = `
    <div class="panel center">
      <div class="big-emoji">🔗</div>
      <h1>הלינק הזה לא עובד</h1>
      <p>אולי ההורה החליף אותו. בקשו מההורה לשלוח לינק חדש.</p>
    </div>`;
};

export async function renderKidHome(root, token) {
  root.innerHTML = '<p class="center muted">טוען…</p>';
  let ctx;
  try { ctx = await context(token); } catch (e) {
    if (e.status === 401) return badLink(root);
    root.innerHTML = '<p class="center">אין חיבור כרגע. נסו שוב עוד מעט.</p>';
    return;
  }
  const { kid, test, testWords, bank, pool } = ctx;
  sync().catch(() => {}).then(() => { if (!viewSignal().aborted) paint(); });

  function paint() {
    const p = getProgress(kid.id);
    const gradeIds = bank.filter((w) => w.grade === kid.grade).map((w) => w.id);
    const grade = wordCounts(p.items, gradeIds);
    const all = Object.values(p.items);
    const known = all.filter((it) => it.box >= KNOWN_BOX).length;
    const learning = all.filter((it) => it.box > 0 && it.box < KNOWN_BOX).length;
    const days = streak(p.sessions);
    const nextGrade = pool.find((id) => !p.items[key(id)]);
    const level = nextGrade ? bank.find((w) => w.id === nextGrade).grade : kid.grade;

    let main;
    if (test) {
      const left = daysUntil(test.date);
      const ready = Math.round(readiness(p.items, testWords.map((w) => w.id)) * 100);
      main = `
        <a class="mission test" href="#/k/${token}/test">
          <div class="mission-icon">📝</div>
          <div class="mission-title">מתכוננים למבחן</div>
          <div class="mission-sub">${esc(test.title)} · ${left === 0 ? 'היום!' : left === 1 ? 'מחר' : `עוד ${left} ימים`} · ${testWords.length} מילים</div>
          <div class="meter"><div style="width:${ready}%"></div></div>
          <div class="mission-sub">מוכנים ב-${ready}%</div>
        </a>
        <a class="btn btn-soft wide" href="#/k/${token}/free">רוצים עוד? לימוד חופשי</a>`;
    } else {
      main = `
        <a class="mission" href="#/k/${token}/free">
          <div class="mission-icon">🚀</div>
          <div class="mission-title">המשימה של היום</div>
          <div class="mission-sub">חזרה על מילים ומילים חדשות, בערך 10 דקות</div>
        </a>`;
    }

    root.innerHTML = `
      <div class="kid-hello"><span class="big-emoji">${esc(kid.emoji)}</span><h1>היי ${esc(kid.name)}!</h1></div>
      ${main}
      <div class="stats-row">
        <div class="stat"><b>${known}</b><span>מילים שיודעים היטב</span></div>
        <div class="stat"><b>${learning}</b><span>מילים בלימוד</span></div>
        <div class="stat"><b>${days}</b><span>ימים ברצף 🔥</span></div>
      </div>
      <p class="center muted">רמה: כיתה ${GRADE_NAME[level] || GRADE_NAME[kid.grade]} · מילים של כיתה ${GRADE_NAME[kid.grade]}: ${grade.known} מתוך ${grade.total} ידועות היטב</p>
      <div class="row-center"><a class="link-btn" href="#/k/${token}/words">המילים שלי</a></div>`;
  }
  paint();
}

export async function renderKidPractice(root, token, mode) {
  root.innerHTML = '<p class="center muted">טוען…</p>';
  let ctx;
  try { ctx = await context(token); } catch (e) { return e.status === 401 ? badLink(root) : renderKidHome(root, token); }
  const { kid, test, testWords, words, pool, bank } = ctx;
  if (mode === 'test' && !test) { location.hash = `#/k/${token}`; return; }

  const start = () => {
    const p = getProgress(kid.id);
    const plan = mode === 'test'
      ? planTest({ items: p.items, ids: testWords.map((w) => w.id), date: test.date })
      : planFree({ items: p.items, sessions: p.sessions, pool });
    if (!plan.length) {
      root.innerHTML = `
        <div class="finish">
          <div class="stars">🌟</div>
          <h1>אין מה לתרגל כרגע</h1>
          <p class="subtitle">כל המילים במצב טוב. חזרו מחר!</p>
          <div class="row-center"><a class="btn btn-big" href="#/k/${token}">חזרה</a></div>
        </div>`;
      return;
    }
    const maxInterval = mode === 'test' ? testMaxInterval(test.date) : Infinity;
    runPractice(root, {
      words, plan, items: p.items,
      all: mode === 'test' ? [...testWords, ...bank] : bank,
      back: `#/k/${token}`,
      onAnswer(id, ok, ms, { claim }) {
        const cur = getProgress(kid.id);
        cur.items[key(id)] = review(cur.items[key(id)], ok, ms, { maxInterval, claim });
        saveProgress(cur);
      },
      onDone({ right, total, ms, newIds }) {
        if (total) logSession(kid.id, { module: 'vocab', part: mode, total, correct: right, ms, ...(test && mode === 'test' ? { test: test.id } : {}) });
        const ratio = right / Math.max(total, 1);
        const stars = ratio >= 0.9 ? 3 : ratio >= 0.6 ? 2 : 1;
        const fresh = newIds.map((id) => words.get(id)).filter(Boolean);
        root.innerHTML = `
          <div class="finish">
            <div class="stars">${'⭐'.repeat(stars)}</div>
            <h1>סיימתם את המשימה!</h1>
            <p class="subtitle">${right} נכונות בניסיון הראשון מתוך ${total}</p>
            ${fresh.length ? `<h2 class="section">מילים חדשות היום</h2>
              <div class="vo-grid">${fresh.map((w) => `<div class="vo-tile"><span class="vo-tile-emoji">${w.emoji || '📝'}</span><b class="en">${esc(w.en)}</b><small>${esc(w.he)}</small></div>`).join('')}</div>` : ''}
            <div class="row-center">
              <a class="btn btn-big" href="#/k/${token}">סיימנו להיום</a>
              <button class="btn btn-soft" id="again">עוד סיבוב</button>
            </div>
          </div>`;
        root.querySelector('#again').onclick = start;
      },
    });
  };
  start();
}

// All the words the kid has started, weakest first.
export async function renderKidWords(root, token) {
  let ctx;
  try { ctx = await context(token); } catch (e) { return e.status === 401 ? badLink(root) : renderKidHome(root, token); }
  const p = getProgress(ctx.kid.id);
  const started = Object.entries(p.items).filter(([k]) => k.startsWith('w:'))
    .map(([k, it]) => ({ w: ctx.words.get(k.slice(2)), it })).filter((x) => x.w)
    .sort((a, b) => a.it.box - b.it.box);
  const color = (box) => (box >= KNOWN_BOX ? 'var(--good)' : box >= 3 ? '#f59e0b' : 'var(--bad)');
  // A fresh inner element, so the listeners below go away with the screen.
  root.innerHTML = '<div></div>';
  root = root.firstElementChild;
  root.innerHTML = `
    <a class="back" href="#/k/${token}">→ חזרה</a>
    <h1 class="page-title">המילים שלי</h1>
    <p class="subtitle">🔴 עוד לומדים · 🟠 כמעט · 🟢 יודעים היטב</p>
    ${started.length ? `<div class="vo-grid">${started.map(({ w, it }) => `
      <button class="vo-tile" data-id="${esc(w.id)}"><span class="vo-dot" style="background:${color(it.box)}"></span>
        <span class="vo-tile-emoji">${w.emoji || '📝'}</span><b class="en">${esc(w.en)}</b><small>${esc(w.he)}</small></button>`).join('')}</div>`
      : '<p class="center muted">עוד אין מילים. מתחילים במשימה של היום!</p>'}
    <div id="sheet"></div>`;
  wireSpeakButtons(root);
  root.querySelector('.vo-grid')?.addEventListener('click', (e) => {
    const t = e.target.closest('[data-id]');
    if (!t) return;
    const w = ctx.words.get(t.dataset.id);
    root.querySelector('#sheet').innerHTML = `<div class="viz-box sheet">${wordCard(w)}${w.ex ? `<div class="vo-sentence en">${esc(w.ex)}</div><div class="vo-sentence-he">${esc(w.exHe || '')}</div>` : ''}</div>`;
    root.querySelector('#sheet').scrollIntoView({ behavior: 'smooth' });
  });
}
