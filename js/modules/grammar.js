// דקדוק באנגלית: sentence-structure explanations + quiz practice, one topic file per tense/rule.
import { esc, mixed, shuffle, pick } from '../ui.js';
import { METHODS as PS_METHODS, psVizPanel, inQuestion, yesNo, whQuestion, shortAnswer } from '../viz/grammar.js';
import { runQuiz, finishScreen } from '../quiz.js';
import { getProgress, saveProgress, logSession } from '../store.js';
import { review, pickSession, MASTERED_BOX } from '../srs.js';

const TOPICS = [
  { id: 'present-simple', title: 'הווה פשוט – Present Simple', icon: '📗' },
];

const cache = {};
function loadTopic(id) {
  cache[id] ??= fetch(`content/grammar/${id}.json`).then((r) => r.json());
  return cache[id];
}

const box = (items, k) => items[k]?.box || 0;
const mastered = (items, keys) => keys.filter((k) => box(items, k) >= MASTERED_BOX).length;

// Affirmative/negative facts are gr:<topic>:<subject>:<verb>; questions add ":q" (not for "I", "Do I...?" is rare).
const MODES = {
  mix: { title: 'תרגול מעורב', sub: 'חיוב, שלילה ושאלות' },
  statements: { title: 'חיוב ושלילה', sub: 'בוחרים את המשפט הנכון' },
  questions: { title: 'שאלות', sub: 'Do / Does, מילות שאלה ותשובות קצרות' },
};
function factKeys(topicId, D, mode = 'mix') {
  const keys = [];
  for (let si = 0; si < D.subjects.length; si++) {
    for (let vi = 0; vi < D.verbs.length; vi++) {
      if (mode !== 'questions') keys.push(`gr:${topicId}:${si}:${vi}`);
      if (mode !== 'statements' && D.subjects[si].en !== 'I') keys.push(`gr:${topicId}:${si}:${vi}:q`);
    }
  }
  return keys;
}
const parseKey = (k) => { const [, , si, vi, form] = k.split(':'); return { si: +si, vi: +vi, form }; };

export async function renderGrammar(root, kid, [view = 'menu', ...args]) {
  const base = `#/kid/${kid.id}/grammar`;
  if (view === 'menu') return menu(root, base);
  const topicId = args[0];
  const D = await loadTopic(topicId);
  if (view === 'topic') return topicPage(root, kid, base, topicId, D);
  if (view === 'learn') return learn(root, base, topicId, D, +args[1] || 0, +args[2] || 0);
  if (view === 'practice') return practice(root, kid, base, topicId, D, MODES[args[1]] ? args[1] : 'mix');
  return menu(root, base);
}

function menu(root, base) {
  root.innerHTML = `
    <h1 class="page-title">📘 דקדוק באנגלית</h1>
    <p class="subtitle">בוחרים נושא ללמוד</p>
    <div class="cards">${TOPICS.map((t) =>
      `<a class="card" href="${base}/topic/${t.id}"><span class="card-icon">${t.icon}</span><span class="card-title">${esc(t.title)}</span></a>`).join('')}</div>`;
}

function topicPage(root, kid, base, topicId, D) {
  const topic = TOPICS.find((t) => t.id === topicId);
  const keys = factKeys(topicId, D);
  const items = getProgress(kid.id).items;
  root.innerHTML = `
    <a class="back" href="${base}">→ חזרה</a>
    <h1 class="page-title">${topic.icon} ${esc(topic.title)}</h1>
    <p class="subtitle">בעל פה: ${mastered(items, keys)} מתוך ${keys.length}</p>
    <div class="cards">
      <a class="card" href="${base}/learn/${topicId}/0/0"><span class="card-icon">🔍</span><span class="card-title">מבנה המשפט</span><span class="card-sub">חיוב, שלילה ושאלה, בארבע דרכי המחשה</span></a>
      ${Object.entries(MODES).map(([id, m]) => `<a class="card" href="${base}/practice/${topicId}/${id}"><span class="card-icon">${{ mix: '🎯', statements: '➕', questions: '❓' }[id]}</span><span class="card-title">${m.title}</span><span class="card-sub">${esc(m.sub)}</span></a>`).join('')}
    </div>`;
}

// ---------- learn ----------
function learn(root, base, topicId, D, si, vi) {
  const draw = () => {
    const subject = D.subjects[si], verb = D.verbs[vi], obj = verb.objects[0];
    root.innerHTML = `
      <a class="back" href="${base}/topic/${topicId}">→ חזרה</a>
      <h1 class="page-title">🔍 מבנה המשפט</h1>
      <div class="panel">
        <p><b class="en">I / You / We / They:</b> ${mixed(D.rule.do)}</p>
        <p><b class="en">He / She / It:</b> ${mixed(D.rule.does)}</p>
        <p><b class="en">?</b> ${mixed(D.rule.question)}</p>
      </div>
      <p class="subtitle">בוחרים נושא ופועל, ורואים איך המשפט נבנה</p>
      <div class="learn-pick ltr">
        <div class="stepper" data-name="s"><button class="step" data-d="-1">−</button><span class="step-val en">${esc(subject.en)}</span><button class="step" data-d="1">+</button></div>
        <div class="stepper" data-name="v"><button class="step" data-d="-1">−</button><span class="step-val en">${esc(verb.base)}</span><button class="step" data-d="1">+</button></div>
      </div>
      <div id="viz"></div>`;
    const panel = psVizPanel(root.querySelector('#viz'), subject, verb, obj);
    root.querySelector('.learn-pick').addEventListener('click', (e) => {
      const btn = e.target.closest('.step');
      if (!btn) return;
      const name = btn.closest('.stepper').dataset.name;
      const d = +btn.dataset.d;
      if (name === 's') si = (si + d + D.subjects.length) % D.subjects.length;
      else vi = (vi + d + D.verbs.length) % D.verbs.length;
      const ns = D.subjects[si], nv = D.verbs[vi];
      root.querySelector('[data-name=s] .step-val').textContent = ns.en;
      root.querySelector('[data-name=v] .step-val').textContent = nv.base;
      panel.set(ns, nv, nv.objects[0]);
      history.replaceState(null, '', `${base}/learn/${topicId}/${si}/${vi}`);
    });
  };
  draw();
}

// ---------- practice ----------
const sentence = (subject, verbForm, obj) => `${subject.en} ${verbForm} ${obj.en}`;

function affirmativeVariants(subject, verb, obj) {
  const does = subject.person === 'does';
  const correct = sentence(subject, does ? verb.s : verb.base, obj);
  const pool = [
    sentence(subject, does ? verb.base : verb.s, obj), // missing / wrongly added -s
    sentence(subject, `${does ? 'does' : 'do'} ${verb.base}`, obj), // unneeded do/does in affirmative
    sentence(subject, `${does ? "doesn't" : "don't"} ${verb.base}`, obj), // negative aux instead
    sentence(subject, `${verb.base}s`, obj), // naive +s spelling
  ];
  return { correct, wrongs: shuffle([...new Set(pool)].filter((s) => s !== correct)).slice(0, 3) };
}

function negativeVariants(subject, verb, obj) {
  const does = subject.person === 'does';
  const correctAux = does ? "doesn't" : "don't";
  const correct = sentence(subject, `${correctAux} ${verb.base}`, obj);
  const pool = [
    sentence(subject, `${does ? "don't" : "doesn't"} ${verb.base}`, obj), // wrong aux for this subject
    sentence(subject, `${correctAux} ${does ? verb.s : verb.base}`, obj), // verb keeps -s after the aux
    sentence(subject, `not ${verb.base}`, obj), // missing do/does entirely
    sentence(subject, `${correctAux} ${verb.base}s`, obj), // naive +s spelling after the aux
  ];
  return { correct, wrongs: shuffle([...new Set(pool)].filter((s) => s !== correct)).slice(0, 3) };
}

const capital = (s) => s[0].toUpperCase() + s.slice(1);

function yesNoVariants(subject, verb, obj) {
  const does = subject.person === 'does';
  const subj = inQuestion(subject);
  const correct = yesNo(subject, verb, obj);
  const pool = [
    `${does ? 'Do' : 'Does'} ${subj} ${verb.base} ${obj.en}?`, // wrong aux for this subject
    `${does ? 'Does' : 'Do'} ${subj} ${does ? verb.s : `${verb.base}s`} ${obj.en}?`, // verb keeps -s after the aux
    `${capital(subj)} ${does ? verb.s : verb.base} ${obj.en}?`, // statement with a question mark
    `${does ? 'Is' : 'Are'} ${subj} ${verb.base} ${obj.en}?`, // be instead of do
  ];
  return { correct, wrongs: shuffle([...new Set(pool)].filter((s) => s !== correct)).slice(0, 3) };
}

function whVariants(subject, verb, obj) {
  const does = subject.person === 'does';
  const subj = inQuestion(subject);
  const aux = does ? 'does' : 'do';
  const correct = whQuestion(subject, verb, obj);
  const pool = [
    `${obj.wh} ${does ? 'do' : 'does'} ${subj} ${verb.base}?`, // wrong aux
    `${obj.wh} ${aux} ${subj} ${does ? verb.s : `${verb.base}s`}?`, // verb keeps -s
    `${obj.wh} ${subj} ${aux} ${verb.base}?`, // subject before the aux
    `${obj.wh} ${subj} ${does ? verb.s : verb.base}?`, // no aux at all
  ];
  return { correct, wrongs: shuffle([...new Set(pool)].filter((s) => s !== correct)).slice(0, 3) };
}

function shortVariants(subject, yes) {
  const does = subject.person === 'does';
  const p = subject.pronoun;
  const correct = shortAnswer(subject, yes);
  const pool = yes
    ? [`Yes, ${p} ${does ? 'do' : 'does'}.`, `Yes, ${p} ${does ? 'is' : p === 'I' ? 'am' : 'are'}.`, `Yes, ${does ? 'does' : 'do'} ${p}.`]
    : [`No, ${p} ${does ? "don't" : "doesn't"}.`, `No, ${p} ${does ? "isn't" : p === 'I' ? "'m not" : "aren't"}.`.replace(' \'m', "'m"), `No, ${p} not.`];
  return { correct, wrongs: pool.filter((s) => s !== correct) };
}

const optionsFrom = (wrongs, correct) =>
  shuffle([correct, ...wrongs]).map((s) => ({ html: `<span class="en ps-choice">${esc(s)}</span>`, value: s }));
const clueLine = (subject, verb, obj) => `<p class="q-sub en">${esc(subject.he)} ${esc(verb.he)} ${esc(obj.he)}</p>`;
const quizHelp = (subject, verb, obj, method = 0) => {
  const { html, caption } = PS_METHODS[method].render(subject, verb, obj);
  return `<div class="viz-box">${html}</div><p class="viz-caption">${caption}</p>`;
};

function questionForm(subject, verb, obj, key) {
  const type = pick(['yn', 'wh', 'short', 'toq']);
  const qaIdx = PS_METHODS.findIndex((m) => m.id === 'qa');
  if (type === 'yn' || type === 'toq') {
    const { correct, wrongs } = yesNoVariants(subject, verb, obj);
    const prompt = type === 'yn'
      ? `<p class="q-ask">איזו שאלה נכונה?</p><p class="q-sub">${esc(subject.he)} ${esc(verb.he)} ${esc(obj.he)}?</p>`
      : `<p class="q-ask">הופכים את המשפט לשאלה</p><div class="ps-shown en">${esc(sentence(subject, subject.person === 'does' ? verb.s : verb.base, obj))}</div>`;
    return { key, answer: correct, options: optionsFrom(wrongs, correct), prompt, help: () => quizHelp(subject, verb, obj, 0) };
  }
  if (type === 'wh') {
    const { correct, wrongs } = whVariants(subject, verb, obj);
    return { key, answer: correct, options: optionsFrom(wrongs, correct), help: () => quizHelp(subject, verb, obj, qaIdx),
      prompt: `<p class="q-ask">איזו שאלה נכונה?</p><p class="q-sub">${esc(obj.whHe)} ${esc(subject.he)} ${esc(verb.he)}? (התשובה: ${esc(obj.he)})</p>` };
  }
  const yes = Math.random() < 0.5;
  const { correct, wrongs } = shortVariants(subject, yes);
  return { key, answer: correct, options: optionsFrom(wrongs, correct), help: () => quizHelp(subject, verb, obj, qaIdx),
    prompt: `<p class="q-ask">עונים בתשובה קצרה: ${yes ? 'כן 👍' : 'לא 👎'}</p><div class="ps-shown en">${esc(yesNo(subject, verb, obj))}</div>` };
}

function question(D, key) {
  const { si, vi, form } = parseKey(key);
  const subject = D.subjects[si], verb = D.verbs[vi], obj = pick(verb.objects);
  if (form === 'q') return questionForm(subject, verb, obj, key);
  const type = pick(['aff', 'neg', 'transform']);
  const help = () => quizHelp(subject, verb, obj);
  if (type === 'aff') {
    const { correct, wrongs } = affirmativeVariants(subject, verb, obj);
    return { key, answer: correct, options: optionsFrom(wrongs, correct), help,
      prompt: `<p class="q-ask">איזה משפט חיוב (+) נכון?</p>${clueLine(subject, verb, obj)}` };
  }
  if (type === 'neg') {
    const { correct, wrongs } = negativeVariants(subject, verb, obj);
    return { key, answer: correct, options: optionsFrom(wrongs, correct), help,
      prompt: `<p class="q-ask">איזה משפט שלילה (-) נכון?</p>${clueLine(subject, verb, obj)}` };
  }
  const toNegative = Math.random() < 0.5;
  const shown = toNegative ? affirmativeVariants(subject, verb, obj).correct : negativeVariants(subject, verb, obj).correct;
  const target = toNegative ? negativeVariants(subject, verb, obj) : affirmativeVariants(subject, verb, obj);
  return { key, answer: target.correct, options: optionsFrom(target.wrongs, target.correct), help,
    prompt: `
      <p class="q-ask">${toNegative ? 'הופכים את המשפט לשלילה' : 'הופכים את המשפט לחיוב'}</p>
      <div class="ps-shown en">${esc(shown)}</div>` };
}

function practice(root, kid, base, topicId, D, mode) {
  const progress = getProgress(kid.id);
  const keys = factKeys(topicId, D, mode);
  const before = mastered(progress.items, keys);
  const session = shuffle(pickSession(progress.items, keys, 10, { maxNew: mode === 'mix' ? 3 : 4 }));
  runQuiz(root, {
    back: `${base}/topic/${topicId}`,
    questions: session.map((k) => question(D, k)),
    onResult: (q, ok, ms) => { progress.items[q.key] = review(progress.items[q.key], ok, ms); },
    onDone: ({ right, total, ms }) => {
      saveProgress(progress);
      logSession(kid.id, { module: 'grammar', part: topicId, total, correct: right, ms });
      const gained = mastered(getProgress(kid.id).items, keys) - before;
      finishScreen(root, {
        right, total,
        extra: gained > 0 ? `<p class="subtitle">🎉 ${gained} משפטים חדשים נכנסו לרשימה של מה שיודעים!</p>` : '',
        again: () => practice(root, kid, base, topicId, D, mode),
        links: `<a class="btn btn-soft" href="${base}/learn/${topicId}/0/0">מבנה המשפט 🔍</a>`,
      });
    },
  });
}
