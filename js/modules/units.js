// חומר מהכיתה: study units made from photos of class material, in content/units/<kid>/ (index.json lists the files).
// A unit has wordGroups (vocabulary lists), grammar (test-style items), reading (Unseen texts with questions)
// and grammarTopic (the matching topic in the grammar module). Units without these (e.g. column exercises) belong to other modules.
import { esc, mixed, shuffle, pick, PRAISE, later, viewSignal } from '../ui.js';
import { runQuiz, finishScreen } from '../quiz.js';
import { say, canSpeak, speakBtn, wireSpeakButtons } from '../speech.js';
import { getProgress, saveProgress, logSession } from '../store.js';
import { review, pickSession, MASTERED_BOX } from '../srs.js';
import { vocabPanel, wordHelp, spoken, gapAnswer, fillGap } from '../viz/vocab.js';
import { textHtml, strategyPanel } from '../viz/reading.js';
import { ruleCard } from '../viz/grammar.js';

const cache = {};
function loadUnits(kidId) {
  cache[kidId] ??= fetch(`content/units/${kidId}/index.json`).then((r) => r.json())
    .then(({ units }) => Promise.all(units.map((f) => fetch(`content/units/${kidId}/${f}`).then((r) => r.json()))))
    .then((list) => list.filter((u) => u.wordGroups || u.reading))
    .catch(() => { delete cache[kidId]; return []; });
  return cache[kidId];
}

const box = (items, k) => items[k]?.box || 0;
const mastered = (items, keys) => keys.filter((k) => box(items, k) >= MASTERED_BOX).length;
const allWords = (u) => (u.wordGroups || []).flatMap((g) => g.words);
const vKey = (w) => `vo:${w.id}`;
const gKey = (u, i) => `ug:${u.id}:${i}`;
const rKey = (T, i) => `rd:${T.id}:${i}`;
const blank = (s) => esc(s).replace('___', '<span class="vo-blank">_____</span>');
const dateText = (d) => (d ? new Date(d).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', year: 'numeric' }) : '');

export async function renderUnits(root, kid, [unitId, view = 'home', ...args]) {
  const base = `#/kid/${kid.id}/units`;
  const units = await loadUnits(kid.id);
  const u = units.find((x) => x.id === unitId);
  if (!u) return list(root, base, units);
  const ub = `${base}/${u.id}`;
  if (view === 'words') return wordList(root, kid, ub, u);
  if (view === 'word') return wordView(root, ub, u, args[0]);
  if (view === 'vocab') return vocabPractice(root, kid, ub, u, args[0] ?? 'all');
  if (view === 'grammar') return grammarPractice(root, kid, ub, u);
  if (view === 'howto') return howto(root, ub);
  if (view === 'read') return args[0] ? readText(root, kid, ub, u, args[0]) : readingList(root, kid, ub, u);
  if (view === 'test') return testIntro(root, kid, ub, u);
  unitHome(root, kid, base, ub, u);
}

function list(root, base, units) {
  root.innerHTML = `
    <h1 class="page-title">📸 חומר מהכיתה</h1>
    <p class="subtitle">${units.length ? 'יחידות לימוד שנבנו מהחומר של הכיתה' : 'עוד אין כאן יחידות. שולחים צילום של מבחן או דף עבודה, ונבנית יחידה חדשה.'}</p>
    <div class="cards">${units.map((u) => `
      <a class="card" href="${base}/${u.id}"><span class="card-icon">${u.icon ?? '📚'}</span>
        <span class="card-title">${esc(u.title)}</span><span class="card-sub">${dateText(u.date)}</span></a>`).join('')}</div>`;
}

function unitHome(root, kid, base, ub, u) {
  const p = getProgress(kid.id);
  const wk = allWords(u).map(vKey);
  const gk = (u.grammar || []).map((_, i) => gKey(u, i));
  const rk = (u.reading || []).flatMap((T) => T.questions.map((_, i) => rKey(T, i)));
  const rightOnce = rk.filter((k) => p.items[k]?.right > 0).length;
  const tests = p.sessions.filter((s) => s.module === 'units' && s.part === 'mock' && s.unit === u.id);
  const card = (href, icon, title, sub) =>
    `<a class="card" href="${href}"><span class="card-icon">${icon}</span><span class="card-title">${title}</span><span class="card-sub">${sub}</span></a>`;
  root.innerHTML = `
    <a class="back" href="${base}">→ חזרה</a>
    <h1 class="page-title">📸 ${esc(u.title)}</h1>
    <p class="subtitle">${esc(u.source)}</p>
    <h2 class="section">1. אוצר מילים · ${mastered(p.items, wk)} מתוך ${wk.length} בעל פה</h2>
    <div class="cards">
      ${card(`${ub}/words`, '📖', 'המילים', 'כל מילה ב-4 דרכים: תמונה, משפט, מילים קרובות, הברות ואיות')}
      ${card(`${ub}/vocab/all`, '🎯', 'תרגול מילים', 'פירוש, השלמת משפט ואיות. מילים שטועים בהן חוזרות יותר')}
    </div>
    <h2 class="section">2. דקדוק: Present Simple · ${mastered(p.items, gk)} מתוך ${gk.length} בעל פה</h2>
    <div class="cards">
      ${kid.modules.includes('grammar') && u.grammarTopic
        ? card(`#/kid/${kid.id}/grammar/topic/${u.grammarTopic}`, '🔍', 'מבנה המשפט', 'חיוב, שלילה ושאלה, עם המחשות ותרגול') : ''}
      ${card(`${ub}/grammar`, '📝', 'תרגילים בסגנון המבחן', 'השלמת פועל, do / does, שלילה, שאלות ותשובות קצרות')}
    </div>
    <h2 class="section">3. Unseen · ${rightOnce} מתוך ${rk.length} שאלות כבר נענו נכון</h2>
    <div class="cards">
      ${card(`${ub}/howto`, '🧭', 'איך ניגשים ל-Unseen', 'השלבים, מילות שאלה, דוגמה ומלכודות')}
      ${card(`${ub}/read`, '📰', 'קטעי קריאה', `${u.reading.length} קטעים ברמת כיתה ח׳, עם שאלות`)}
    </div>
    <h2 class="section">4. מבחן דמה</h2>
    <div class="cards">
      ${card(`${ub}/test`, '🏁', 'מבחן דמה', tests.length
        ? `ציון אחרון: ${tests.at(-1).score} · ${tests.length === 1 ? 'מבחן אחד' : `${tests.length} מבחנים`} עד עכשיו`
        : 'קריאה, אוצר מילים ודקדוק. ציון מתוך 100')}
    </div>`;
}

// ---------- words ----------
function wordList(root, kid, ub, u) {
  const items = getProgress(kid.id).items;
  root.innerHTML = `
    <a class="back" href="${ub}">→ חזרה</a>
    <h1 class="page-title">📖 המילים</h1>
    <p class="subtitle">לוחצים על מילה כדי לראות אותה ב-4 דרכים. הנקודה הצבעונית מראה כמה כבר יודעים</p>
    ${u.wordGroups.map((g, gi) => `
      <h2 class="section">${esc(g.title)}</h2>
      <div class="vo-grid">${g.words.map((w) => `
        <a class="vo-tile" href="${ub}/word/${w.id}"><i class="vo-dot lvl-${box(items, vKey(w))}"></i>
          <span class="vo-tile-emoji">${w.emoji}</span><b class="en">${esc(w.en)}</b><small>${esc(w.he)}</small></a>`).join('')}</div>
      <div class="row-center"><a class="btn btn-soft" href="${ub}/vocab/${gi}">🎯 תרגול רק של המילים האלה</a></div>`).join('')}`;
}

function wordView(root, ub, u, id) {
  const words = allWords(u);
  let i = Math.max(0, words.findIndex((w) => w.id === id));
  root.innerHTML = `
    <a class="back" href="${ub}/words">→ לכל המילים</a>
    <div class="letter-nav">
      <button class="btn btn-soft" data-d="-1">→ הקודמת</button>
      <span class="muted" id="count"></span>
      <button class="btn btn-soft" data-d="1">הבאה ←</button>
    </div>
    <div id="viz"></div>`;
  const panel = vocabPanel(root.querySelector('#viz'), words[i]);
  const count = () => { root.querySelector('#count').textContent = `${i + 1} / ${words.length}`; };
  count();
  root.querySelector('.letter-nav').addEventListener('click', (e) => {
    const d = +e.target.closest('[data-d]')?.dataset.d;
    if (!d) return;
    i = (i + d + words.length) % words.length;
    panel.set(words[i]);
    count();
    say(spoken(words[i].en));
    history.replaceState(null, '', `${ub}/word/${words[i].id}`);
  });
}

// Distractors that cannot also be right: same part of speech first, never a word marked as fitting the same gap.
function distractors(w, pool, n = 3) {
  const ok = pool.filter((x) => x.id !== w.id && !(w.gapNo || []).includes(x.id) && !(x.gapNo || []).includes(w.id));
  return [...shuffle(ok.filter((x) => x.pos === w.pos)), ...shuffle(ok.filter((x) => x.pos !== w.pos))].slice(0, n);
}

const enChoice = (s) => ({ html: `<span class="en choice-text">${esc(s)}</span>`, value: s });

function vocabQuestion(w, pool) {
  const key = vKey(w);
  const ds = distractors(w, pool);
  const type = pick(['en-he', 'he-en', 'gap', 'gap', 'spell']);
  if (type === 'en-he') {
    return { key, answer: w.he, speak: spoken(w.en), help: () => wordHelp(w, 'sentence'),
      prompt: `<p class="q-ask">מה הפירוש?</p><div class="vo-q en">${esc(w.en)} ${speakBtn(spoken(w.en))}</div>`,
      options: shuffle([w, ...ds]).map((x) => ({ html: `<span class="choice-text">${esc(x.he)}</span>`, value: x.he })) };
  }
  if (type === 'he-en') {
    return { key, answer: spoken(w.en), help: () => wordHelp(w, 'sentence'), after: () => say(spoken(w.en)),
      prompt: `<p class="q-ask">איך אומרים באנגלית?</p><div class="vo-q">${esc(w.he)}</div>`,
      options: shuffle([w, ...ds]).map((x) => enChoice(spoken(x.en))) };
  }
  if (type === 'gap') {
    return { key, answer: gapAnswer(w), help: () => wordHelp(w, 'sentence'), after: () => say(fillGap(w)),
      prompt: `<p class="q-ask">איזו מילה משלימה את המשפט?</p><div class="ps-shown en">${blank(w.gap)}</div>`,
      options: shuffle([w, ...ds]).map((x) => enChoice(gapAnswer(x))) };
  }
  return { key, answer: w.en, speak: spoken(w.en), help: () => wordHelp(w, 'sound'),
    prompt: `<p class="q-ask">איך כותבים את המילה?</p><div class="vo-q">${esc(w.he)} ${speakBtn(spoken(w.en))}</div>`,
    options: shuffle([w.en, ...w.wrong]).map(enChoice) };
}

function vocabPractice(root, kid, ub, u, g) {
  const progress = getProgress(kid.id);
  const all = allWords(u);
  const words = u.wordGroups[g]?.words ?? all;
  const keys = words.map(vKey);
  const byKey = Object.fromEntries(all.map((w) => [vKey(w), w]));
  const before = mastered(progress.items, keys);
  const session = shuffle(pickSession(progress.items, keys, 12, { maxNew: 5 }));
  runQuiz(root, {
    back: ub,
    questions: session.map((k) => vocabQuestion(byKey[k], all)),
    onResult: (q, ok, ms) => { progress.items[q.key] = review(progress.items[q.key], ok, ms); },
    onDone: ({ right, total, ms }) => {
      saveProgress(progress);
      logSession(kid.id, { module: 'units', part: 'vocab', unit: u.id, total, correct: right, ms });
      const gained = mastered(getProgress(kid.id).items, keys) - before;
      finishScreen(root, {
        right, total,
        extra: gained > 0 ? `<p class="subtitle">🎉 ${gained} מילים חדשות נכנסו לרשימה של מה שיודעים!</p>` : '',
        again: () => vocabPractice(root, kid, ub, u, g),
        links: `<a class="btn btn-soft" href="${ub}/words">📖 המילים</a>`,
      });
    },
  });
}

// ---------- grammar, test style ----------
const TASKS = {
  verb: ['Complete with the correct form of the verb in brackets.', 'משלימים בצורה הנכונה של הפועל שבסוגריים'],
  aux: ["Complete with do / does / don't / doesn't.", 'משלימים במילת העזר המתאימה'],
  neg: ['Choose the correct negative sentence.', 'בוחרים את משפט השלילה הנכון'],
  question: ['Choose the correct question.', 'בוחרים את השאלה הנכונה'],
  short: ['Choose the correct short answer.', 'בוחרים את התשובה הקצרה הנכונה'],
  fix: ['Which sentence is correct?', 'איזה משפט נכון?'],
};

// The full correct sentence: the gap filled in (without the "(verb)" hint), or the chosen sentence itself.
const solved = (it) => (it.q.includes('___') ? it.q.replace('___', it.options[0]).replace(/\s*\([^)]*\)/, '') : it.options[0]);
const grammarHelp = (it) => `
  <div class="viz-box"><p class="ps-shown en">✓ ${esc(solved(it))}</p>${ruleCard(it.person, it.form)}</div>
  <p class="viz-caption">${mixed(it.why)}</p>`;
const grammarPrompt = (it) => (it.q ? `<div class="ps-shown en">${blank(it.q)}</div>` : '');

function grammarQuestion(u, i) {
  const it = u.grammar[i];
  const [en, he] = TASKS[it.task];
  return { key: gKey(u, i), answer: it.options[0], help: () => grammarHelp(it),
    prompt: `<p class="q-ask en">${esc(en)}</p><p class="q-sub">${he}</p>${grammarPrompt(it)}`,
    options: shuffle(it.options).map((o) => ({ html: `<span class="en ps-choice">${esc(o)}</span>`, value: o })) };
}

function grammarPractice(root, kid, ub, u) {
  const progress = getProgress(kid.id);
  const keys = u.grammar.map((_, i) => gKey(u, i));
  const session = shuffle(pickSession(progress.items, keys, 10, { maxNew: 6 }));
  runQuiz(root, {
    back: ub,
    questions: session.map((k) => grammarQuestion(u, keys.indexOf(k))),
    onResult: (q, ok, ms) => { progress.items[q.key] = review(progress.items[q.key], ok, ms); },
    onDone: ({ right, total, ms }) => {
      saveProgress(progress);
      logSession(kid.id, { module: 'units', part: 'grammar', unit: u.id, total, correct: right, ms });
      finishScreen(root, {
        right, total,
        again: () => grammarPractice(root, kid, ub, u),
        links: kid.modules.includes('grammar') ? `<a class="btn btn-soft" href="#/kid/${kid.id}/grammar/topic/${u.grammarTopic}">🔍 מבנה המשפט</a>` : '',
      });
    },
  });
}

// ---------- Unseen ----------
function howto(root, ub) {
  root.innerHTML = `
    <a class="back" href="${ub}">→ חזרה</a>
    <h1 class="page-title">🧭 איך ניגשים ל-Unseen</h1>
    <div id="viz"></div>
    <div class="row-center"><a class="btn btn-big" href="${ub}/read">📰 לקטעי הקריאה</a></div>`;
  strategyPanel(root.querySelector('#viz'));
}

function readingList(root, kid, ub, u) {
  const items = getProgress(kid.id).items;
  root.innerHTML = `
    <a class="back" href="${ub}">→ חזרה</a>
    <h1 class="page-title">📰 קטעי קריאה</h1>
    <p class="subtitle">קוראים את הקטע ועונים על השאלות. מילים מהרשימה מסומנות, ולחיצה עליהן מראה את הפירוש</p>
    <div class="cards">${u.reading.map((T) => {
      const keys = T.questions.map((_, i) => rKey(T, i));
      const seen = keys.filter((k) => items[k]);
      const right = keys.filter((k) => items[k]?.box > 0).length;
      return `<a class="card" href="${ub}/read/${T.id}"><span class="card-icon">${T.emoji}</span>
        <span class="card-title en">${esc(T.title)}</span>
        <span class="card-sub">${seen.length ? `בפעם האחרונה: ${right} מתוך ${keys.length} נכונות` : `${keys.length} שאלות · עוד לא קראו`}</span></a>`;
    }).join('')}</div>
    <div class="row-center"><a class="btn btn-soft" href="${ub}/howto">🧭 איך ניגשים ל-Unseen</a></div>`;
}

// Tapping a marked word shows its meaning; the text can also be read aloud.
function wireText(root, words) {
  const byId = Object.fromEntries(words.map((w) => [w.id, w]));
  wireSpeakButtons(root);
  root.addEventListener('click', (e) => {
    const b = e.target.closest('.rd-w');
    if (!b) return;
    const w = byId[b.dataset.w];
    const bar = root.querySelector('#gloss-bar');
    bar.innerHTML = `${w.emoji} <b class="en">${esc(w.en)}</b> = ${esc(w.he)} ${speakBtn(spoken(w.en))}`;
    bar.hidden = false;
  });
  viewSignal().addEventListener('abort', () => { if (canSpeak) speechSynthesis.cancel(); });
}

const listenBtn = (T) => (canSpeak ? `<button class="btn btn-soft rd-listen" data-text="${esc(T.paragraphs.join(' | '))}">🔊 להקשיב לקטע</button>` : '');

function readText(outer, kid, ub, u, id) {
  const T = u.reading.find((t) => t.id === id);
  if (!T) return readingList(outer, kid, ub, u);
  const words = allWords(u);
  const progress = getProgress(kid.id);
  const begin = Date.now();
  let qi = 0, right = 0, started = Date.now(), locked = false, marks = true;
  // A fresh inner element, so listeners never pile up on the shared root.
  outer.innerHTML = '<div class="rd"></div>';
  const root = outer.firstElementChild;
  root.innerHTML = `
    <a class="back" href="${ub}/read">→ לכל הקטעים</a>
    <h1 class="page-title en">${T.emoji} ${esc(T.title)}</h1>
    <div class="row-center">
      <button class="btn btn-soft" id="marks"></button>
      ${listenBtn(T)}
    </div>
    <div class="rd-text en" id="text"></div>
    <div class="rd-gloss" id="gloss-bar" hidden></div>
    <div class="progress-bar"><div class="progress-fill"></div></div>
    <div class="q-card rd-card"><div id="prompt"></div><div class="q-feedback" id="fb"></div></div>
    <div class="choices rd-choices" id="choices"></div>
    <div id="help"></div>`;
  const $ = (s) => root.querySelector(s);
  wireText(root, words);
  const drawText = (mark = '') => {
    $('#text').innerHTML = textHtml(T, { words: marks ? words : [], mark });
    $('#marks').textContent = marks ? '💡 להסתיר את סימון המילים' : '💡 לסמן מילים מהרשימה';
  };
  $('#marks').onclick = () => { marks = !marks; drawText(locked ? $('.rd-mark')?.textContent : ''); };
  $('.rd-listen')?.addEventListener('click', (e) => say(e.currentTarget.dataset.text, { rate: 0.85 }));

  const show = () => {
    const q = T.questions[qi];
    locked = false; started = Date.now();
    q.shown = shuffle(q.options);
    drawText();
    $('.progress-fill').style.width = `${(qi / T.questions.length) * 100}%`;
    $('#prompt').innerHTML = `<p class="q-sub">שאלה ${qi + 1} מתוך ${T.questions.length}</p><p class="rd-q en">${esc(q.q)}</p>`;
    $('#fb').textContent = ''; $('#fb').className = 'q-feedback';
    $('#help').innerHTML = '';
    $('#choices').innerHTML = q.shown.map((o, n) => `<button class="choice" data-n="${n}"><span class="en choice-text">${esc(o)}</span></button>`).join('');
  };
  const next = () => {
    qi++;
    if (qi < T.questions.length) return show();
    saveProgress(progress);
    logSession(kid.id, { module: 'units', part: 'unseen', unit: u.id, text: T.id, total: T.questions.length, correct: right, ms: Date.now() - begin });
    const others = u.reading.filter((t) => t.id !== T.id);
    finishScreen(root, {
      right, total: T.questions.length,
      again: () => readText(outer, kid, ub, u, id),
      links: others.map((t) => `<a class="btn btn-soft en" href="${ub}/read/${t.id}">${t.emoji} ${esc(t.title)}</a>`).join(''),
    });
  };
  $('#choices').addEventListener('click', (e) => {
    const b = e.target.closest('.choice');
    if (!b || locked) return;
    locked = true;
    const q = T.questions[qi];
    const ok = q.shown[+b.dataset.n] === q.options[0];
    progress.items[rKey(T, qi)] = review(progress.items[rKey(T, qi)], ok, Date.now() - started);
    root.querySelectorAll('.choice').forEach((c, k) => {
      c.classList.add(q.shown[k] === q.options[0] ? 'correct' : c === b ? 'wrong' : 'dim');
    });
    if (ok) {
      right++;
      $('#fb').textContent = pick(PRAISE); $('#fb').className = 'q-feedback good';
      later(1100, next);
      return;
    }
    $('#fb').textContent = 'כמעט! הנה התשובה הנכונה 👇'; $('#fb').className = 'q-feedback bad';
    drawText(q.evidence);
    $('#help').innerHTML = `<div class="help-box">${readingHelp(q)}<button class="btn btn-big" id="go">הבנתי, ממשיכים ←</button></div>`;
    $('#go').onclick = next;
  });
  show();
}

const readingHelp = (q) => `
  <div class="viz-box rd-help">
    <p>✓ התשובה הנכונה: <b class="en">${esc(q.options[0])}</b></p>
    <p>📍 התשובה כתובה בטקסט (מסומנת בצהוב למעלה):</p>
    <blockquote class="rd-quote en">“${esc(q.evidence)}”</blockquote>
  </div>
  ${q.why ? `<p class="viz-caption">${mixed(q.why)}</p>` : ''}`;

// ---------- mock test ----------
// Like the teacher's test: Part A reading (40), Part B vocabulary from a word box (30), Part C grammar (30).
// No feedback until the end; then a grade and every mistake with the right answer and a visualization.
function buildTest(u, lastText) {
  const fresh = u.reading.filter((t) => t.id !== lastText);
  const T = pick(fresh.length ? fresh : u.reading);
  const words = allWords(u);
  const chosen = shuffle(words).slice(0, 10);
  const bank = shuffle([...chosen, ...shuffle(words.filter((w) => !chosen.includes(w))).slice(0, 2)]);
  // Grammar: two from every task type in turn, so the part covers +, -, ? and short answers.
  const byTask = Object.keys(TASKS).map((t) => shuffle(u.grammar.map((it, i) => i).filter((i) => u.grammar[i].task === t)));
  const gram = [];
  for (let r = 0; gram.length < 10 && r < 4; r++) for (const list of byTask) if (list[r] !== undefined && gram.length < 10) gram.push(list[r]);
  gram.sort((a, b) => Object.keys(TASKS).indexOf(u.grammar[a].task) - Object.keys(TASKS).indexOf(u.grammar[b].task) || a - b);
  return { T, bank, parts: [
    { title: 'Part A – Reading Comprehension', he: 'הבנת הנקרא', points: 40, intro: 'Read the text and answer the questions.',
      qs: T.questions.map((q, i) => ({ key: rKey(T, i), prompt: esc(q.q), options: shuffle(q.options), answer: q.options[0],
        explain: () => readingHelp(q).replace(' (מסומנת בצהוב למעלה)', '') })) },
    { title: 'Part B – Vocabulary', he: 'אוצר מילים', points: 30, intro: 'Complete the sentences with words from the box. There are two extra words.',
      qs: chosen.map((w) => ({ key: vKey(w), prompt: blank(w.gap), answer: gapAnswer(w),
        options: shuffle([w, ...distractors(w, bank)]).map(gapAnswer), explain: () => wordHelp(w, 'sentence') })) },
    { title: 'Part C – Grammar', he: 'דקדוק', points: 30, intro: 'Present Simple',
      qs: gram.map((i) => {
        const it = u.grammar[i];
        return { key: gKey(u, i), task: it.task, prompt: it.q ? blank(it.q) : '', options: shuffle(it.options), answer: it.options[0],
          explain: () => grammarHelp(it) };
      }) },
  ] };
}

function testIntro(root, kid, ub, u) {
  const tests = getProgress(kid.id).sessions.filter((s) => s.module === 'units' && s.part === 'mock' && s.unit === u.id);
  root.innerHTML = `
    <a class="back" href="${ub}">→ חזרה</a>
    <h1 class="page-title">🏁 מבחן דמה</h1>
    <div class="panel">
      <p>המבחן בנוי כמו מבחן בכיתה, בשלושה חלקים:</p>
      <ul class="mt-plan">
        <li><b class="en">Part A – Reading</b> · קטע Unseen ו-8 שאלות · 40 נקודות</li>
        <li><b class="en">Part B – Vocabulary</b> · 10 משפטים להשלים ממחסן מילים · 30 נקודות</li>
        <li><b class="en">Part C – Grammar</b> · 10 שאלות Present Simple · 30 נקודות</li>
      </ul>
      <p>כמו במבחן אמיתי, אין משוב באמצע. בסוף מקבלים ציון, ורואים כל טעות עם התשובה הנכונה והסבר. כדאי להקדיש לזה כחצי שעה, בשקט, בלי לחפש בספר.</p>
      ${tests.length ? `<p class="muted">מבחנים קודמים: ${tests.slice(-5).map((s) => s.score).join(' · ')}</p>` : ''}
      <div class="row-center"><button class="btn btn-big" id="start">מתחילים ✍️</button></div>
    </div>`;
  root.querySelector('#start').onclick = () => runTest(root, kid, ub, u, buildTest(u, tests.at(-1)?.text));
}

function runTest(root, kid, ub, u, test) {
  const { T, bank, parts } = test;
  const answers = parts.map((p) => p.qs.map(() => null));
  const begin = Date.now();
  let pi = 0, confirm = false;
  root.innerHTML = '<div class="mt"></div>';
  const el = root.firstElementChild;

  const draw = () => {
    const P = parts[pi];
    const n0 = parts.slice(0, pi).reduce((s, p) => s + p.qs.length, 0);
    let lastTask = null;
    const qHtml = P.qs.map((q, i) => {
      const head = q.task && q.task !== lastTask ? `<h3 class="mt-task en">${esc(TASKS[q.task][0])}</h3>` : '';
      lastTask = q.task ?? lastTask;
      return `${head}
        <div class="mt-q">
          <p class="mt-qtext en"><b>${n0 + i + 1}.</b> ${q.prompt}</p>
          <div class="mt-opts en">${q.options.map((o, k) => `
            <button class="mt-opt ${answers[pi][i] === k ? 'on' : ''}" data-i="${i}" data-k="${k}"><b>${'abcd'[k]}.</b> ${esc(o)}</button>`).join('')}</div>
        </div>`;
    }).join('');
    el.innerHTML = `
      <div class="mt-head"><span>חלק ${pi + 1} מתוך ${parts.length}</span><span class="muted">${P.he} · ${P.points} נקודות</span></div>
      <h2 class="mt-title en">${esc(P.title)}</h2>
      <p class="mt-intro en">${esc(P.intro)}</p>
      ${pi === 0 ? `<div class="rd-text en"><h3 class="rd-title">${esc(T.title)}</h3>${textHtml(T)}</div>` : ''}
      ${pi === 1 ? `<div class="mt-bank en">${bank.map((w) => `<span>${esc(gapAnswer(w))}</span>`).join('')}</div>` : ''}
      ${qHtml}
      <p class="subtitle" id="msg"></p>
      <div class="row-center">
        ${pi > 0 ? '<button class="btn btn-soft" id="prev">→ לחלק הקודם</button>' : ''}
        ${pi < parts.length - 1 ? '<button class="btn" id="next">לחלק הבא ←</button>' : '<button class="btn btn-big" id="submit">הגשה ✅</button>'}
      </div>`;
    window.scrollTo(0, 0);
  };

  el.addEventListener('click', (e) => {
    const opt = e.target.closest('.mt-opt');
    if (opt) {
      const i = +opt.dataset.i, k = +opt.dataset.k;
      answers[pi][i] = k;
      opt.parentElement.querySelectorAll('.mt-opt').forEach((b) => b.classList.toggle('on', b === opt));
      confirm = false;
      return;
    }
    if (e.target.closest('#prev')) { pi--; draw(); }
    else if (e.target.closest('#next')) { pi++; draw(); }
    else if (e.target.closest('#submit')) {
      const empty = answers.flat().filter((a) => a === null).length;
      if (empty && !confirm) {
        confirm = true;
        el.querySelector('#msg').textContent = `נשארו ${empty} שאלות בלי תשובה (אפשר לחזור לחלקים הקודמים). לוחצים שוב על הגשה כדי להגיש בכל זאת.`;
        return;
      }
      results(root, kid, ub, u, test, answers, Date.now() - begin);
    }
  });
  draw();
}

function results(outer, kid, ub, u, { T, parts }, answers, ms) {
  const progress = getProgress(kid.id);
  let total = 0, correct = 0, score = 0, n = 0;
  const rows = [], mistakes = [];
  parts.forEach((P, pi) => {
    const ok = P.qs.filter((q, i) => {
      const right = answers[pi][i] !== null && q.options[answers[pi][i]] === q.answer;
      progress.items[q.key] = review(progress.items[q.key], right, 5000);
      n++;
      if (!right) mistakes.push({ n, q, given: answers[pi][i] === null ? null : q.options[answers[pi][i]] });
      return right;
    }).length;
    const pts = Math.round((P.points * ok) / P.qs.length);
    total += P.qs.length; correct += ok; score += pts;
    rows.push(`<div class="kpi"><span class="kpi-num">${pts}<small>/${P.points}</small></span><span class="kpi-label">${P.he} · ${ok} מתוך ${P.qs.length}</span></div>`);
  });
  saveProgress(progress);
  logSession(kid.id, { module: 'units', part: 'mock', unit: u.id, text: T.id, score, total, correct, ms });
  const verdict = score >= 90 ? 'מצוין! אתם מוכנים למבחן 🏆' : score >= 75 ? 'טוב מאוד! עוברים על הטעויות, והציון יעלה עוד 💪'
    : score >= 55 ? 'בדרך הנכונה. כדאי לתרגל את החלק שבו היו הכי הרבה טעויות' : 'כדאי לחזור על המילים ועל הדקדוק ולנסות שוב. כל ניסיון מקרב 🙂';
  outer.innerHTML = '<div class="mt"></div>';
  const root = outer.firstElementChild;
  root.innerHTML = `
    <div class="finish">
      <p class="subtitle">הציון במבחן הדמה</p>
      <div class="sp-grade">${score}</div>
      <h1>${verdict}</h1>
      <p class="subtitle">${correct} תשובות נכונות מתוך ${total} · ${Math.max(1, Math.round(ms / 6e4))} דקות</p>
    </div>
    <div class="kpis">${rows.join('')}</div>
    ${mistakes.length ? `
      <h2 class="section">הטעויות, עם התשובה הנכונה</h2>
      <div class="mt-review">${mistakes.map(({ n: num, q, given }) => `
        <div class="mt-mistake">
          <p class="mt-qtext en"><b>${num}.</b> ${q.prompt || ''}</p>
          <p class="mt-ans">✗ התשובה שלכם: ${given === null ? 'לא עניתם' : `<span class="en struck">${esc(given)}</span>`}</p>
          <p class="mt-ans">✓ התשובה הנכונה: <b class="en">${esc(q.answer)}</b></p>
          ${q.explain()}
        </div>`).join('')}</div>` : '<p class="subtitle">🎉 אין אף טעות!</p>'}
    <div class="row-center">
      <button class="btn btn-big" id="again">מבחן נוסף, עם קטע אחר</button>
      <a class="btn btn-soft" href="${ub}">חזרה ליחידה</a>
    </div>`;
  wireSpeakButtons(root);
  window.scrollTo(0, 0);
  root.querySelector('#again').onclick = () => runTest(outer, kid, ub, u, buildTest(u, T.id));
}
