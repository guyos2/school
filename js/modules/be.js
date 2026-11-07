// am / is / are (Niri): the class story of Grandpa "be" and his three fields, an explorer, the lesson's own exercises,
// spaced-repetition practice and a mock test. Material comes from content/units/<kid>/ (units with kind "be").
// Item keys: be:f:<subject> (which field) and be:s:<sentence> (sentences with ___).
import { esc, mixed, shuffle, pick, viewSignal } from '../ui.js';
import { runQuiz, finishScreen } from '../quiz.js';
import { say, speakBtn, wireSpeakButtons } from '../speech.js';
import { getProgress, saveProgress, logSession } from '../store.js';
import { review, pickSession, MASTERED_BOX } from '../srs.js';
import { PRONOUNS, WHO, FIELDS, beOf, isPronoun, fullSentence, vizPanel, METHODS } from '../viz/be.js';

const BES = ['am', 'is', 'are'];
const VIZ = Object.fromEntries(METHODS.map((m, i) => [m.id, i]));

const cache = {};
async function loadUnit(kidId) {
  cache[kidId] ??= fetch(`content/units/${kidId}/index.json`).then((r) => r.json())
    .then(({ units }) => Promise.all(units.map((f) => fetch(`content/units/${kidId}/${f}`).then((r) => r.json()))))
    .then((all) => all.find((u) => u.kind === 'be') || null)
    .catch(() => { cache[kidId] = undefined; return null; });
  return cache[kidId];
}

const keyOf = (it) => (it.type === 'field' ? `be:f:${it.s}` : `be:s:${it.en}`);
const specOf = (U, it) => ({ s: it.s ?? it.en.split('___')[0].trim(), who: it.who, en: it.en, he: it.he, img: U.img });
const colorBe = (s) => esc(s).replace(/\b(am|is|are)\b/gi, (w) => `<b class="be-w be-${w.toLowerCase()}">${w}</b>`);
const heText = (he) => he.replace(/\s*_\s*/, ' ');
const heGap = (he) => esc(he).replace(/\s*_\s*/, ' <span class="be-hole"></span> ');
const enGap = (en) => esc(en).replace('___', '<span class="be-blank">?</span>');
const beBtn = (be, upper) => ({ html: `<span class="be-opt be-${be} en">${upper ? be.toUpperCase() : be}</span>`, value: be });
const box = (items, k) => items[k]?.box || 0;
const masteredOf = (items, keys) => keys.filter((k) => box(items, k) >= MASTERED_BOX).length;

function why(spec) {
  const p = PRONOUNS[spec.who], be = p.be;
  const pron = isPronoun(spec) ? '' : `<b class="en">${esc(spec.s)} = ${p.en}</b> · `;
  return `${pron}<b class="en">${p.en}</b> בשדה <b class="be-w be-${be} en">${be.toUpperCase()}</b>: ${FIELDS[be].story}.`;
}

// ---------- questions (for runQuiz) ----------
function helpFor(spec, start) {
  return {
    help: () => `<p class="be-right">✓ <span class="en">${colorBe(fullSentence(spec))}</span> ${speakBtn(fullSentence(spec))}</p>
      <p class="be-why">${why(spec)}</p><div class="be-help-viz"></div>`,
    afterHelp: (el) => vizPanel(el.querySelector('.be-help-viz'), spec, start),
  };
}

function fieldQ(U, it) {
  const spec = specOf(U, it);
  return {
    key: keyOf(it), answer: beOf(it.who), options: BES.map((b) => beBtn(b, true)),
    prompt: `<p class="q-ask">לאיזה שדה הולך הנכד?</p><div class="be-q-subj en">${esc(it.s)} ${speakBtn(it.s)}</div>`,
    after: () => say(`${it.s} ${beOf(it.who)}`),
    ...helpFor(spec, isPronoun(spec) ? VIZ.fields : VIZ.replace),
  };
}

function fillQ(U, it, style = it.type === 'gap' ? 'gap' : pick(['gap', 'plain'])) {
  const spec = specOf(U, it);
  const prompt = style === 'gap'
    ? `<p class="q-ask">מצאו את החור! איזו מילה ממלאת אותו באנגלית?</p>
       <div class="be-q-he">${heGap(it.he)}</div><div class="be-q-sent en">${enGap(it.en)}</div>`
    : `<p class="q-ask">השלימו: am, is או are?</p><div class="be-q-sent en">${enGap(it.en)}</div><p class="q-sub">${esc(heText(it.he))}</p>`;
  return {
    key: keyOf(it), answer: beOf(it.who), options: BES.map((b) => beBtn(b)), prompt,
    after: () => say(fullSentence(spec)),
    ...helpFor(spec, style === 'gap' ? VIZ.hebrew : isPronoun(spec) ? VIZ.fields : VIZ.replace),
  };
}

// Which sentence is right: the correct one, one without "be" at all, and the two other forms.
function sentenceQ(U, it) {
  const spec = specOf(U, it);
  const right = fullSentence(spec);
  const wrongs = [it.en.replace(' ___', ''), ...BES.filter((b) => b !== beOf(it.who)).map((b) => it.en.replace('___', b))];
  return {
    key: keyOf(it), answer: right,
    options: shuffle([right, ...wrongs]).map((s) => ({ html: `<span class="en be-sent-opt">${esc(s)}</span>`, value: s })),
    prompt: `<p class="q-ask">איזה משפט נכון?</p><div class="be-q-he">${esc(heText(it.he))}</div>`,
    after: () => say(right),
    ...helpFor(spec, VIZ.glue),
  };
}

function questionFor(U, it, mode) {
  if (it.type === 'field') return fieldQ(U, it);
  if (mode === 'fill') return fillQ(U, it);
  if (mode === 'sentence') return sentenceQ(U, it);
  return pick([() => fillQ(U, it, 'gap'), () => fillQ(U, it, 'plain'), () => sentenceQ(U, it)])();
}

const MODES = {
  field: { title: 'לאיזה שדה הולך הנכד?', icon: '🌾', sub: 'I, she, Dana, my friends... AM, IS או ARE', size: 10, types: ['field'] },
  fill: { title: 'השלימו את המשפט', icon: '✏️', sub: 'am, is או are במשפט, גם ״מצאו את החור״', size: 10, types: ['fill', 'gap'] },
  sentence: { title: 'איזה משפט נכון?', icon: '✅', sub: 'בלי הדבק, או עם הדבק הלא נכון', size: 8, types: ['fill', 'gap'] },
  mix: { title: 'תרגול מעורב', icon: '🎯', sub: 'הכול ביחד, יותר ממה שעוד קשה', size: 12, types: ['field', 'fill', 'gap'] },
};

// ---------- routes ----------
export async function renderBe(root, kid, [view = 'menu', ...args]) {
  const base = `#/kid/${kid.id}/be`;
  const U = await loadUnit(kid.id);
  if (!U) { root.innerHTML = '<p class="subtitle">עוד אין חומר לנושא הזה.</p>'; return; }
  if (view === 'story') return story(root, kid, base, U, +args[0] || 0);
  if (view === 'learn') return learn(root, base, U, args[0]);
  if (view === 'class') return classLesson(root, kid, base, U);
  if (view === 'practice' && MODES[args[0]]) return practice(root, kid, base, U, args[0]);
  if (view === 'mock') return testIntro(root, kid, base, U);
  menu(root, kid, base, U);
}

function menu(root, kid, base, U) {
  const p = getProgress(kid.id);
  const keys = U.items.map(keyOf);
  const mine = p.sessions.filter((s) => s.module === 'be');
  const tests = mine.filter((s) => s.part === 'mock');
  const classDone = mine.some((s) => s.part === 'class');
  root.innerHTML = `
    <h1 class="page-title">🌾 am / is / are</h1>
    <p class="subtitle">${esc(U.source)}<br>בעל פה: ${masteredOf(p.items, keys)} מתוך ${keys.length}</p>
    <div class="be-banner">${['am', 'is', 'are'].map((b) => `<span class="be-opt be-${b} en">${b.toUpperCase()}</span>`).join('')}</div>
    <div class="cards">
      <a class="card" href="${base}/story"><span class="card-icon">📖</span><span class="card-title">הסיפור של סבא be</span><span class="card-sub">שלושה שדות ושבעה נכדים, כמו בשיעור</span></a>
      <a class="card" href="${base}/learn"><span class="card-icon">🔍</span><span class="card-title">לראות ולהבין</span><span class="card-sub">בוחרים נושא ורואים לאיזה שדה הוא הולך, ב-5 דרכים</span></a>
      <a class="card" href="${base}/class"><span class="card-icon">📸</span><span class="card-title">התרגילים מהשיעור</span>
        <span class="card-sub">מצאו את החור, לאיזה שדה, השלימו<br><small>${classDone ? '✅ כבר פתרתם, אפשר שוב' : '17 תרגילים מהמצגת'}</small></span></a>
      ${Object.entries(MODES).map(([id, m]) => `<a class="card" href="${base}/practice/${id}"><span class="card-icon">${m.icon}</span><span class="card-title">${m.title}</span><span class="card-sub">${esc(m.sub)}</span></a>`).join('')}
      <a class="card" href="${base}/mock"><span class="card-icon">🏁</span><span class="card-title">מבחן לדוגמה</span>
        <span class="card-sub">כמו התרגילים בשיעור, ציון מתוך 100${tests.length ? `<br><small>אחרון: ${tests.at(-1).score}</small>` : ''}</span></a>
    </div>`;
}

// ---------- story ----------
function kidsRow(U, grouped) {
  const kidImg = (w) => `<span class="be-story-kid"><img src="${U.img}${w}.webp" alt="${PRONOUNS[w].en}"><b class="en">${PRONOUNS[w].en}</b></span>`;
  if (!grouped) return `<div class="be-story-kids">${WHO.map(kidImg).join('')}</div>`;
  return `<div class="be-fields">${Object.entries(FIELDS).map(([f, F]) => `
    <div class="be-field be-${f} on"><div class="be-field-name en">${f.toUpperCase()}</div>
      <div class="be-field-kids">${F.who.map(kidImg).join('')}</div><div class="be-field-tag">${F.tag}</div></div>`).join('')}</div>`;
}

function story(root, kid, base, U, n) {
  const slides = U.story;
  n = Math.min(Math.max(n, 0), slides.length - 1);
  const S = slides[n];
  root.innerHTML = `
    <a class="back" href="${base}">→ חזרה</a>
    <div class="be-slide ${S.field ? `be-${S.field}` : ''}">
      <h1 class="be-slide-title">${mixed(S.title)}</h1>
      ${S.img ? `<img class="be-slide-img ${S.wide ? 'wide' : ''}" src="${U.img}${S.img}.webp" alt="">` : ''}
      ${S.kids ? kidsRow(U, S.kids === 'fields') : ''}
      ${S.text.map((t) => `<p class="be-slide-text">${mixed(t)}</p>`).join('')}
      ${S.big ? `<div class="be-slide-big en">${colorBe(S.big)} ${S.say ? speakBtn(S.say) : ''}</div>` : ''}
      ${S.tags ? `<div class="be-banner">${S.tags.map((b) => `<span class="be-opt be-${b} en">${b.toUpperCase()}</span>`).join('')}</div>` : ''}
    </div>
    <div class="be-dots">${slides.map((_, k) => `<a class="be-dot ${k === n ? 'on' : ''}" href="${base}/story/${k}" aria-label="${k + 1}"></a>`).join('')}</div>
    <div class="row-center">
      ${n > 0 ? `<a class="btn btn-soft" href="${base}/story/${n - 1}">→ הקודם</a>` : ''}
      ${n < slides.length - 1 ? `<a class="btn btn-big" href="${base}/story/${n + 1}">הבא ←</a>`
        : `<a class="btn btn-big" href="${base}/class" id="done">לתרגילים מהשיעור ✏️</a>`}
    </div>`;
  wireSpeakButtons(root);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' && n < slides.length - 1) location.hash = `${base}/story/${n + 1}`;
    if (e.key === 'ArrowRight' && n > 0) location.hash = `${base}/story/${n - 1}`;
  }, { signal: viewSignal() });
}

// ---------- learn: pick a subject, see it 5 ways ----------
function learn(root, base, U, start) {
  const subjects = [...WHO.map((w) => ({ s: PRONOUNS[w].en, who: w })),
    ...U.items.filter((it) => it.type === 'field' && !WHO.includes(it.s.toLowerCase())).map((it) => ({ s: it.s, who: it.who }))];
  let cur = subjects.find((x) => x.s === decodeURIComponent(start || '')) || subjects[4];
  root.innerHTML = `
    <a class="back" href="${base}">→ חזרה</a>
    <h1 class="page-title">🔍 לראות ולהבין</h1>
    <div class="be-rules">${Object.entries(FIELDS).map(([f, F]) => `
      <div class="be-rule be-${f}"><span class="be-opt be-${f} en">${f.toUpperCase()}</span>
        <b class="en">${F.who.map((w) => PRONOUNS[w].en).join(', ')}</b><small>${esc(F.story)}</small></div>`).join('')}</div>
    <p class="subtitle">בוחרים נושא, ורואים לאיזה שדה הוא הולך ולמה</p>
    <div class="be-pick en">${subjects.map((x, k) => `<button class="be-pick-btn" data-k="${k}">${esc(x.s)}</button>`).join('')}</div>
    <div id="viz"></div>`;
  const spec = (x) => ({ s: x.s, who: x.who, img: U.img });
  const panel = vizPanel(root.querySelector('#viz'), spec(cur));
  const mark = () => root.querySelectorAll('.be-pick-btn').forEach((b) => b.classList.toggle('on', subjects[+b.dataset.k] === cur));
  mark();
  root.querySelector('.be-pick').addEventListener('click', (e) => {
    const b = e.target.closest('.be-pick-btn');
    if (!b) return;
    cur = subjects[+b.dataset.k];
    panel.set(spec(cur));
    mark();
    say(`${cur.s} ${beOf(cur.who)}`);
    history.replaceState(null, '', `${base}/learn/${encodeURIComponent(cur.s)}`);
  });
}

// ---------- quizzes ----------
function quiz(root, kid, base, U, { questions, part, again }) {
  const progress = getProgress(kid.id);
  const keys = U.items.map(keyOf);
  const before = masteredOf(progress.items, keys);
  runQuiz(root, {
    back: base, questions,
    onResult: (q, ok, ms) => { progress.items[q.key] = review(progress.items[q.key], ok, ms); },
    onDone: ({ right, total, ms }) => {
      saveProgress(progress);
      logSession(kid.id, { module: 'be', part, unit: U.id, total, correct: right, ms });
      const gained = masteredOf(getProgress(kid.id).items, keys) - before;
      finishScreen(root, {
        right, total, again,
        extra: gained > 0 ? `<p class="subtitle">🎉 ${gained} חדשים נכנסו לרשימה של מה שיודעים בעל פה!</p>` : '',
        links: `<a class="btn btn-soft" href="${base}/learn">🔍 לראות ולהבין</a><a class="btn btn-soft" href="${base}">לתפריט 🌾</a>`,
      });
    },
  });
}

function classLesson(root, kid, base, U) {
  const order = ['gap', 'field', 'fill'];
  const items = U.items.filter((it) => it.class).sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
  quiz(root, kid, base, U, {
    part: 'class', again: () => classLesson(root, kid, base, U),
    questions: items.map((it) => (it.type === 'field' ? fieldQ(U, it) : fillQ(U, it, it.type === 'gap' ? 'gap' : 'plain'))),
  });
}

function practice(root, kid, base, U, mode) {
  const M = MODES[mode];
  const pool = U.items.filter((it) => M.types.includes(it.type));
  const byKey = new Map(pool.map((it) => [keyOf(it), it]));
  const keys = shuffle([...byKey.keys()]);
  const chosen = shuffle(pickSession(getProgress(kid.id).items, keys, M.size, { maxNew: mode === 'mix' ? 4 : 6 }));
  quiz(root, kid, base, U, {
    part: mode, again: () => practice(root, kid, base, U, mode),
    questions: chosen.map((k) => questionFor(U, byKey.get(k), mode)),
  });
}

// ---------- mock test ----------
// Like the three exercises in the lesson: which field (30), find the hole (30), complete the sentences (40). No feedback until the end.
function buildTest(U) {
  const fieldsAll = U.items.filter((it) => it.type === 'field');
  const pron = shuffle(fieldsAll.filter((it) => WHO.includes(it.s.toLowerCase())));
  const nouns = shuffle(fieldsAll.filter((it) => !WHO.includes(it.s.toLowerCase())));
  const sents = shuffle(U.items.filter((it) => it.type !== 'field'));
  return [
    { title: 'לאיזה שדה הולך הנכד? בחרו AM, IS או ARE', points: 30, upper: true, qs: shuffle([...pron.slice(0, 3), ...nouns.slice(0, 3)]) },
    { title: 'מצאו את החור! איזו מילה ממלאת אותו באנגלית?', points: 30, gap: true, qs: sents.slice(0, 5) },
    { title: 'השלימו את המשפטים: am, is או are', points: 40, qs: sents.slice(5, 13) },
  ];
}

function testIntro(root, kid, base, U) {
  const tests = getProgress(kid.id).sessions.filter((s) => s.module === 'be' && s.part === 'mock');
  root.innerHTML = `
    <a class="back" href="${base}">→ חזרה</a>
    <h1 class="page-title">🏁 מבחן לדוגמה: am / is / are</h1>
    <div class="panel">
      <p>המבחן בנוי כמו התרגילים בשיעור, <b>3 חלקים, 100 נקודות</b>:</p>
      <ol class="mt-plan">
        <li>לאיזה שדה הולך הנכד? (6 נושאים) · 30 נקודות</li>
        <li>מצאו את החור (5 משפטים בעברית ובאנגלית) · 30 נקודות</li>
        <li>השלימו את המשפטים (8 משפטים) · 40 נקודות</li>
      </ol>
      <p>כמו במבחן אמיתי, אין משוב באמצע. בסוף מקבלים ציון, ורואים כל טעות עם התשובה הנכונה, הסבר וציור. כל מבחן נבנה מחדש.</p>
      ${tests.length ? `<p class="muted">מבחנים קודמים: ${tests.slice(-5).map((s) => s.score).join(' · ')}</p>` : ''}
      <div class="row-center"><button class="btn btn-big" id="start">מתחילים ✍️</button></div>
    </div>`;
  root.querySelector('#start').onclick = () => runTest(root, kid, base, U, buildTest(U));
}

function testQ(P, it) {
  if (it.type === 'field') return `<div class="be-t-subj en">${esc(it.s)}</div>`;
  if (P.gap) return `<div class="be-t-gap"><span class="be-q-he">${heGap(it.he)}</span><span class="be-arrow">←</span><span class="en be-t-sent">${enGap(it.en)}</span></div>`;
  return `<span class="en be-t-sent">${enGap(it.en).replace('<span class="be-blank">?</span>', '<span class="be-blank wide">______</span>')}</span>`;
}

function runTest(outer, kid, base, U, parts) {
  const begin = Date.now();
  const answers = parts.map((P) => P.qs.map(() => null));
  outer.innerHTML = '<div class="mt be-test"></div>';
  const root = outer.firstElementChild;
  let confirm = false;
  root.innerHTML = `
    <a class="back" href="${base}">→ חזרה</a>
    <h1 class="page-title">🏁 מבחן לדוגמה</h1>
    ${parts.map((P, pi) => `
      <section class="be-section">
        <h2 class="be-part-h"><span class="be-circle">${pi + 1}</span> ${mixed(P.title)} <small class="muted">${P.points} נקודות</small></h2>
        ${P.qs.map((it, i) => `
          <div class="be-t-q">
            <span class="be-t-num">${i + 1}.</span>${testQ(P, it)}
            <span class="be-t-opts">${BES.map((b) => `<button class="be-t-opt" data-p="${pi}" data-i="${i}" data-b="${b}"><span class="be-opt be-${b} en">${P.upper ? b.toUpperCase() : b}</span></button>`).join('')}</span>
          </div>`).join('')}
      </section>`).join('')}
    <p class="subtitle" id="msg"></p>
    <div class="row-center"><button class="btn btn-big" id="submit">הגשה ✅</button></div>`;
  root.addEventListener('click', (e) => {
    const opt = e.target.closest('.be-t-opt');
    if (opt) {
      answers[+opt.dataset.p][+opt.dataset.i] = opt.dataset.b;
      opt.parentElement.querySelectorAll('.be-t-opt').forEach((b) => b.classList.toggle('on', b === opt));
      return;
    }
    if (!e.target.closest('#submit')) return;
    const empty = answers.flat().filter((a) => a === null).length;
    if (empty && !confirm) {
      confirm = true;
      root.querySelector('#msg').textContent = `נשארו ${empty} תשובות ריקות. לוחצים שוב על הגשה כדי להגיש בכל זאת.`;
      return;
    }
    results(outer, kid, base, U, parts, answers, Date.now() - begin);
  }, { signal: viewSignal() });
}

function results(outer, kid, base, U, parts, answers, ms) {
  const progress = getProgress(kid.id);
  let score = 0, total = 0, correct = 0;
  const rows = [], mistakes = [];
  parts.forEach((P, pi) => {
    let ok = 0;
    P.qs.forEach((it, i) => {
      const v = answers[pi][i], good = v === beOf(it.who);
      progress.items[keyOf(it)] = review(progress.items[keyOf(it)], good, 5000);
      total++;
      if (good) { ok++; correct++; } else mistakes.push({ label: `${pi + 1}.${i + 1}`, P, it, v });
    });
    const pts = Math.round((P.points * ok) / P.qs.length);
    score += pts;
    rows.push(`<div class="kpi"><span class="kpi-num">${pts}<small>/${P.points}</small></span><span class="kpi-label">חלק ${pi + 1} · ${ok} מתוך ${P.qs.length}</span></div>`);
  });
  saveProgress(progress);
  logSession(kid.id, { module: 'be', part: 'mock', unit: U.id, score, total, correct, ms });
  const verdict = score >= 90 ? 'מצוין! אתם מוכנים למבחן 🏆' : score >= 75 ? 'טוב מאוד! עוברים על הטעויות, והציון יעלה עוד 💪'
    : score >= 55 ? 'בדרך הנכונה. כדאי לקרוא שוב את הסיפור של סבא be ולתרגל' : 'כדאי לחזור לסיפור ולתרגל, ואז לנסות שוב. כל ניסיון מקרב 🙂';
  outer.innerHTML = '<div class="mt be-test"></div>';
  const root = outer.firstElementChild;
  root.innerHTML = `
    <div class="finish">
      <p class="subtitle">הציון במבחן</p>
      <div class="sp-grade">${score}</div>
      <h1>${verdict}</h1>
      <p class="subtitle">${correct} תשובות נכונות מתוך ${total} · ${Math.max(1, Math.round(ms / 6e4))} דקות</p>
    </div>
    <div class="kpis">${rows.join('')}</div>
    ${mistakes.length ? `
      <h2 class="section">הטעויות, עם התשובה הנכונה</h2>
      <div class="mt-review">${mistakes.map(({ label, P, it, v }, k) => {
        const spec = specOf(U, it);
        return `
        <div class="mt-mistake">
          <p class="be-t-num"><b>${label}</b> ${mixed(P.title)}</p>
          ${testQ(P, it)}
          <p class="mt-ans">✗ התשובה שלכם: ${v ? `<b class="be-w be-${v} en">${v}</b>` : 'לא עניתם'}</p>
          <p class="mt-ans">✓ התשובה הנכונה: <span class="en">${colorBe(fullSentence(spec))}</span> ${speakBtn(fullSentence(spec))}</p>
          <p class="be-why">${why(spec)}</p>
          <div class="be-mviz" data-k="${k}"></div>
        </div>`;
      }).join('')}</div>` : '<p class="subtitle">🎉 אין אף טעות!</p>'}
    <div class="row-center">
      <button class="btn btn-big" id="again">מבחן נוסף</button>
      <a class="btn btn-soft" href="${base}">לתפריט 🌾</a>
    </div>`;
  wireSpeakButtons(root);
  window.scrollTo(0, 0);
  root.querySelectorAll('.be-mviz').forEach((el) => {
    const { P, it } = mistakes[+el.dataset.k];
    const spec = specOf(U, it);
    vizPanel(el, spec, P.gap ? VIZ.hebrew : isPronoun(spec) ? VIZ.fields : VIZ.replace);
  });
  root.querySelector('#again').onclick = () => testIntro(outer, kid, base, U);
}
