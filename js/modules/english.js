// אותיות וקריאה באנגלית: letters (4 visualizations each), sound blending, sight words, practice.
import { esc, shuffle, pick } from '../ui.js';
import { letterPanel, blendPanel, hebSounds } from '../viz/letters.js';
import { canSpeak, say, speakBtn } from '../speech.js';
import { runQuiz, finishScreen } from '../quiz.js';
import { getProgress, saveProgress, logSession } from '../store.js';
import { review, pickSession, MASTERED_BOX } from '../srs.js';

let dataPromise;
function loadData() {
  dataPromise ??= Promise.all([
    fetch('content/english/letters.json').then((r) => r.json()),
    fetch('content/english/words.json').then((r) => r.json()),
  ]).then(([letters, words]) => {
    const byLetter = Object.fromEntries(letters.letters.map((d) => [d.l.toLowerCase(), d]));
    const order = [...letters.order];
    const readKeys = [];
    for (let i = 0; i < Math.max(words.cvc.length, words.sight.length); i++) {
      if (words.cvc[i]) readKeys.push(`en:W:${words.cvc[i].w}`);
      if (words.sight[i]) readKeys.push(`en:S:${words.sight[i].w}`);
    }
    return { ...letters, ...words, byLetter, order, letterKeys: order.map((l) => `en:L:${l}`), readKeys };
  });
  return dataPromise;
}

const box = (items, k) => items[k]?.box || 0;
const mastered = (items, keys) => keys.filter((k) => box(items, k) >= MASTERED_BOX).length;

export async function renderEnglish(root, kid, [view = 'menu', arg]) {
  const D = await loadData();
  const base = `#/kid/${kid.id}/english-letters`;
  const items = getProgress(kid.id).items;
  if (view === 'letters') return lettersGrid(root, base, D, items);
  if (view === 'letter') return letterView(root, base, D, (arg || 'A').toUpperCase());
  if (view === 'practice') return letterPractice(root, kid, base, D);
  if (view === 'blend') return arg ? blendView(root, base, D, arg) : blendList(root, base, D, items);
  if (view === 'sight') return sightList(root, base, D, items);
  if (view === 'reading') return readingPractice(root, kid, base, D);
  root.innerHTML = `
    <h1 class="page-title">🔤 אותיות וקריאה</h1>
    <p class="subtitle">אותיות: ${mastered(items, D.letterKeys)} מתוך 26 · מילים: ${mastered(items, D.readKeys)} מתוך ${D.readKeys.length}</p>
    <h2 class="section">שלב 1: האותיות</h2>
    <div class="cards">
      <a class="card" href="${base}/letters"><span class="card-icon">🔤</span><span class="card-title">מכירים את האותיות</span><span class="card-sub">כל אות ב-4 דרכים: תמונה, צליל, גדולה וקטנה, כתיבה</span></a>
      <a class="card" href="${base}/practice"><span class="card-icon">🎯</span><span class="card-title">תרגול אותיות</span><span class="card-sub">שומעים, מזהים, מתאימים</span></a>
    </div>
    <h2 class="section">שלב 2: קוראים מילים</h2>
    <div class="cards">
      <a class="card" href="${base}/blend"><span class="card-icon">🧲</span><span class="card-title">מחברים צלילים</span><span class="card-sub">c + a + t = cat 🐱</span></a>
      <a class="card" href="${base}/sight"><span class="card-icon">👀</span><span class="card-title">מילים שרואים הרבה</span><span class="card-sub">the, is, and… מכירים בעל פה</span></a>
      <a class="card" href="${base}/reading"><span class="card-icon">📖</span><span class="card-title">תרגול קריאה</span><span class="card-sub">קוראים ומתאימים לתמונה</span></a>
    </div>
    ${canSpeak ? '' : '<p class="subtitle">⚠️ במכשיר הזה אין השמעה קולית, ולכן חלק מהתרגילים יוצגו בלי שמע.</p>'}`;
}

// ---------- letters ----------
function lettersGrid(root, base, D, items) {
  const all = D.letters.map((d) => d.l);
  root.innerHTML = `
    <a class="back" href="${base}">→ חזרה</a>
    <h1 class="page-title">🔤 האותיות</h1>
    <p class="subtitle">לוחצים על אות כדי לראות, לשמוע ולכתוב אותה. הצבע מראה כמה כבר מכירים.</p>
    <div class="abc en">${all.map((l) =>
      `<a class="abc-tile lvl-${box(items, `en:L:${l}`)}" href="${base}/letter/${l}">${l}<small>${l.toLowerCase()}</small></a>`).join('')}</div>`;
}

function letterView(root, base, D, L) {
  const data = D.byLetter[L.toLowerCase()];
  if (!data) return lettersGrid(root, base, D, {});
  const all = D.letters.map((d) => d.l);
  const i = all.indexOf(L);
  root.innerHTML = `
    <a class="back" href="${base}/letters">→ לכל האותיות</a>
    <div class="letter-nav en">
      <a class="btn btn-soft" href="${base}/letter/${all[(i + 25) % 26]}">← ${all[(i + 25) % 26]}</a>
      <h1 class="page-title">${L} ${L.toLowerCase()}</h1>
      <a class="btn btn-soft" href="${base}/letter/${all[(i + 1) % 26]}">${all[(i + 1) % 26]} →</a>
    </div>
    <div id="panel"></div>`;
  letterPanel(root.querySelector('#panel'), L, data, D.tips);
  say(`${L}.|${data.word}`);
}

// Pick n distractors, preferring letters that are easy to confuse with l.
function letterDistractors(D, l, n) {
  const similar = D.confusable.filter((g) => g.includes(l)).join('').replace(new RegExp(l, 'g'), '');
  const out = shuffle([...new Set(similar)]).slice(0, 2);
  for (const c of shuffle(D.order.map((x) => x.toLowerCase()))) {
    if (out.length >= n) break;
    if (c !== l && !out.includes(c)) out.push(c);
  }
  return out.slice(0, n);
}

function letterHelp(L, d) {
  return `
    <div class="viz-box help-letter">
      <div class="lt-big en">${L}${L.toLowerCase()}</div>
      <div class="lt-word en">${d.emoji} <b>${esc(d.word[0])}</b>${esc(d.word.slice(1))} ${speakBtn(`${L}.`, '🔤', 'השמעת האות')} ${speakBtn(d.word, '🔊', 'השמעת המילה')}</div>
      <p class="viz-caption">האות ${L} נשמעת כמו <b>${d.heb}</b></p>
    </div>`;
}

function letterQuestion(D, key) {
  const L = key.slice(5), l = L.toLowerCase(), d = D.byLetter[l];
  const types = canSpeak ? ['hear', 'case', 'first'] : ['case', 'case', 'first'];
  const type = pick(types);
  const others = letterDistractors(D, l, 3);
  const upper = Math.random() < 0.5;
  const opts = (asUpper) => shuffle([l, ...others]).map((c) =>
    ({ html: `<span class="en">${asUpper ? c.toUpperCase() : c}</span>`, value: c }));
  const base = { key, answer: l, help: () => letterHelp(L, d) };
  if (type === 'hear') {
    return { ...base, speak: `${L}.`, options: opts(upper),
      prompt: `<div class="q-big">${speakBtn(`${L}.`, '🔊')}</div><p class="q-ask">איזו אות שמעתם?</p>` };
  }
  if (type === 'case') {
    return { ...base, options: opts(!upper),
      prompt: `<div class="q-big en">${upper ? L : l}</div><p class="q-ask">מצאו את אותה אות ${upper ? 'הקטנה' : 'הגדולה'}</p>` };
  }
  return { ...base, speak: canSpeak ? d.word : null, options: opts(false), after: () => say(d.word),
    prompt: `<div class="q-big">${d.emoji} ${speakBtn(d.word, '🔊')}</div><p class="q-ask">באיזו אות מתחילה המילה?</p>` };
}

function letterPractice(root, kid, base, D) {
  const progress = getProgress(kid.id);
  const before = mastered(progress.items, D.letterKeys);
  const keys = shuffle(pickSession(progress.items, D.letterKeys, 12, { maxNew: 3 }));
  runQuiz(root, {
    back: base,
    questions: keys.map((k) => letterQuestion(D, k)),
    onResult: (q, ok, ms) => { progress.items[q.key] = review(progress.items[q.key], ok, ms); },
    onDone: ({ right, total, ms }) => {
      saveProgress(progress);
      logSession(kid.id, { module: 'english-letters', part: 'letters', total, correct: right, ms });
      const gained = mastered(getProgress(kid.id).items, D.letterKeys) - before;
      finishScreen(root, {
        right, total,
        extra: gained > 0 ? `<p class="subtitle">🎉 ${gained} אותיות חדשות נכנסו לרשימה של מה שמכירים!</p>` : '',
        again: () => letterPractice(root, kid, base, D),
        links: `<a class="btn btn-soft" href="${base}/letters">לכל האותיות 🔤</a>`,
      });
    },
  });
}

// ---------- words ----------
function blendList(root, base, D, items) {
  root.innerHTML = `
    <a class="back" href="${base}">→ חזרה</a>
    <h1 class="page-title">🧲 מחברים צלילים</h1>
    <p class="subtitle">בוחרים מילה, אומרים כל צליל ומחברים</p>
    <div class="word-grid en">${D.cvc.map((w) =>
      `<a class="word-tile lvl-${box(items, `en:W:${w.w}`)}" href="${base}/blend/${w.w}">${esc(w.w)}</a>`).join('')}</div>`;
}

function blendView(root, base, D, word) {
  const i = D.cvc.findIndex((w) => w.w === word);
  if (i < 0) return blendList(root, base, D, {});
  const nextWord = D.cvc[(i + 1) % D.cvc.length].w;
  root.innerHTML = `
    <a class="back" href="${base}/blend">→ לכל המילים</a>
    <div id="panel"></div>
    <div class="row-center"><a class="btn btn-soft" href="${base}/blend/${nextWord}">למילה הבאה ←</a></div>`;
  blendPanel(root.querySelector('#panel'), D.cvc[i], D.byLetter);
}

function sightList(root, base, D, items) {
  root.innerHTML = `
    <a class="back" href="${base}">→ חזרה</a>
    <h1 class="page-title">👀 מילים שרואים הרבה</h1>
    <p class="subtitle">את המילים האלה לא מפרקים לצלילים, אלא מכירים אותן בעל פה. לוחצים על מילה כדי לשמוע אותה ולראות מה היא אומרת.</p>
    <div class="word-grid en">${D.sight.map((w) =>
      `<button class="word-tile lvl-${box(items, `en:S:${w.w}`)}" data-w="${esc(w.w)}">${esc(w.w)}</button>`).join('')}</div>
    <div id="meaning" class="viz-caption"></div>`;
  root.querySelector('.word-grid').addEventListener('click', (e) => {
    const t = e.target.closest('[data-w]');
    if (!t) return;
    const w = D.sight.find((x) => x.w === t.dataset.w);
    say(w.w);
    root.querySelector('#meaning').innerHTML = `<span class="en big-word">${esc(w.w)}</span> = ${esc(w.he)}`;
  });
}

// Words that differ from w in exactly one position make the best distractors (cat / hat / cut).
function nearWords(list, w, n) {
  const diff = (a, b) => (a.length !== b.length ? 9 : [...a].filter((c, i) => c !== b[i]).length);
  const sorted = shuffle(list.filter((x) => x.w !== w)).sort((a, b) => diff(a.w, w) - diff(b.w, w));
  return sorted.slice(0, n);
}

function wordHelp(item, D) {
  const letters = [...item.w];
  return `
    <div class="viz-box">
      <div class="blend joined en">${letters.map((ch) =>
        `<span class="tile"><span class="tile-l">${esc(ch)}</span><span class="tile-h">${D.byLetter[ch.toLowerCase()]?.heb ?? ''}</span></span>`).join('')}</div>
      <div class="lt-word en">${item.e ?? ''} ${esc(item.w)} ${speakBtn(item.w)}</div>
      <p class="viz-caption">${item.e ? `קוראים: <b>${hebSounds(item.w, D.byLetter).join('')}</b> · ` : ''}פירוש: ${esc(item.he)}</p>
    </div>`;
}

function readingQuestion(D, key) {
  const isSight = key.startsWith('en:S:');
  const w = key.slice(5);
  if (isSight) {
    const item = D.sight.find((x) => x.w === w);
    const opts = shuffle([item, ...nearWords(D.sight, w, 3)]);
    const listen = canSpeak && Math.random() < 0.7;
    return {
      key, answer: w, help: () => wordHelp(item, D),
      speak: listen ? w : null,
      options: opts.map((x) => (listen
        ? { html: `<span class="en">${esc(x.w)}</span>`, value: x.w }
        : { html: `<span class="choice-text">${esc(x.he)}</span>`, value: x.w })),
      prompt: listen
        ? `<div class="q-big">${speakBtn(w, '🔊')}</div><p class="q-ask">איזו מילה שמעתם?</p>`
        : `<div class="q-big en">${esc(w)}</div><p class="q-ask">מה פירוש המילה?</p>`,
      after: () => say(w),
    };
  }
  const item = D.cvc.find((x) => x.w === w);
  const help = () => wordHelp(item, D);
  if (!canSpeak || Math.random() < 0.5) {
    // Read the word, choose the picture.
    const opts = shuffle([item, ...shuffle(D.cvc.filter((x) => x.w !== w)).slice(0, 2)]);
    return { key, answer: w, help, after: () => say(w),
      options: opts.map((x) => ({ html: `<span class="choice-emoji">${x.e}</span>`, value: x.w })),
      prompt: `<div class="q-big en">${esc(w)}</div><p class="q-ask">קראו את המילה. איזו תמונה מתאימה?</p>` };
  }
  // See the picture and hear the word, choose how it is written.
  const opts = shuffle([item, ...nearWords(D.cvc, w, 2)]);
  return { key, answer: w, help, speak: w,
    options: opts.map((x) => ({ html: `<span class="en">${esc(x.w)}</span>`, value: x.w })),
    prompt: `<div class="q-big">${item.e} ${speakBtn(w, '🔊')}</div><p class="q-ask">איך כותבים את המילה?</p>` };
}

function readingPractice(root, kid, base, D) {
  const progress = getProgress(kid.id);
  const before = mastered(progress.items, D.readKeys);
  const keys = shuffle(pickSession(progress.items, D.readKeys, 10, { maxNew: 3 }));
  runQuiz(root, {
    back: base,
    questions: keys.map((k) => readingQuestion(D, k)),
    onResult: (q, ok, ms) => { progress.items[q.key] = review(progress.items[q.key], ok, ms); },
    onDone: ({ right, total, ms }) => {
      saveProgress(progress);
      logSession(kid.id, { module: 'english-letters', part: 'reading', total, correct: right, ms });
      const gained = mastered(getProgress(kid.id).items, D.readKeys) - before;
      finishScreen(root, {
        right, total,
        extra: gained > 0 ? `<p class="subtitle">🎉 ${gained} מילים חדשות נכנסו לרשימה של מה שיודעים לקרוא!</p>` : '',
        again: () => readingPractice(root, kid, base, D),
        links: `<a class="btn btn-soft" href="${base}/blend">מחברים צלילים 🧲</a>`,
      });
    },
  });
}
