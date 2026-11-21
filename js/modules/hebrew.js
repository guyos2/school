// הבנת הנקרא ולשון (Hillel): nouns, adjectives, verbs and tense, referring pronouns, and texts to find them in.
// Material: a unit with "kind": "hebrew" in content/units/<kid>/ (texts and a bank of short passages in word/tag markup,
// adjective agreement items and tense items). Item keys start with hb: (see keysOf below).
import { esc, shuffle, pick, viewSignal } from '../ui.js';
import { runQuiz, finishScreen } from '../quiz.js';
import { getProgress, saveProgress, logSession } from '../store.js';
import { review, pickSession, MASTERED_BOX } from '../srs.js';
import {
  CATS, TENSES, catOf, parseText, parseLine, pronounOf, targetPhrase, nounKey, sentenceHtml, chip, legend, vizPanel, METHODS, GN,
} from '../viz/hebrew.js';

const MOD = 'hebrew';
const ORDER = ['n', 'a', 'v', 'r'];
const box = (items, k) => items[k]?.box || 0;
const masteredOf = (items, keys) => keys.filter((k) => box(items, k) >= MASTERED_BOX).length;
const vizStart = (cat, id) => Math.max(0, METHODS[cat].findIndex((m) => m.id === id));

const RULES = {
  n: ['שם של <b>אדם, בעל חיים, צמח, חפץ, מקום</b>, או של רגש ורעיון (שמחה, חלום)', 'שואלים עליו <b>מי?</b> או <b>מה?</b>',
    'אפשר לספור אותו: כלב אחד, שני כלבים', 'שם של מישהו או משהו מסוים (יובל, ירושלים) הוא <b>שם עצם פרטי</b>',
    'לפעמים יש לפניו אות קטנה: <b>ה</b>כלב, <b>ו</b>הילדים, <b>ב</b>כוורת. זה עדיין שם עצם'],
  a: ['<b>מתאר</b> שם עצם: צבע, גודל, צורה, תכונה, הרגשה', 'עונה על השאלה <b>איזה? איזו? אילו?</b>',
    'בא בדרך כלל <b>אחרי</b> שם העצם: כלב קטן, פרחים צהובים', 'מתאים לשם העצם: <b>זכר או נקבה, אחד או כמה</b>, וגם בה׳: הכלבה הקטנה',
    'יכול לבוא גם אחרי ״היה״ או ״היא״: הים היה <b>שקט</b>, החתולה נראית <b>עייפה</b>'],
  v: ['מספר <b>מה עושים</b> או מה קורה: רץ, כתבה, יגדל', 'לכל פועל יש <b>זמן</b>: עבר (אתמול), הווה (עכשיו), עתיד (מחר)',
    'עבר: כתב<b>תי</b>, כתב<b>ה</b>, כתב<b>ו</b> · הווה: כותב, כותב<b>ת</b>, כותב<b>ים</b> · עתיד: <b>א</b>כתוב, <b>י</b>כתוב, <b>נ</b>כתוב (אית״ן)',
    'בודקים עם <b>אתמול / עכשיו / מחר</b> לפני הפועל', '<b>שם הפועל</b> (ללכת, לקרוא) מתחיל ב־ל ואין לו זמן'],
  r: ['מילה ש<b>מחליפה שם עצם</b> שכבר הופיע, כדי לא לחזור עליו', '<b>הוא, היא, הם, הן</b>, וגם: לו, שלה, אותם, עליהן, ממנו…',
    'כדי למצוא למי הוא מתייחס: <b>חוזרים אחורה</b> בטקסט', 'מחפשים שם עצם שמתאים: <b>זכר או נקבה, אחד או כמה</b>',
    'בודקים: <b>שמים את שם העצם במקומו</b>. אם המשפט הגיוני, מצאנו'],
};
const WHY = {
  n: 'אפשר לשאול עליו מי? או מה?, והוא שם של אדם, חיה, חפץ, מקום או רעיון.',
  a: 'הוא מתאר שם עצם ועונה על השאלה איזה? איזו? אילו?',
  v: 'הוא מספר מה עושים או מה קורה, ויש לו זמן.',
  r: 'הוא מחליף שם עצם שכבר הופיע בטקסט.',
};

// ---------- loading ----------
const cache = {};
async function loadUnit(kidId) {
  cache[kidId] ??= fetch(`content/units/${kidId}/index.json`).then((r) => r.json())
    .then(({ units }) => Promise.all(units.map((f) => fetch(`content/units/${kidId}/${f}`).then((r) => r.json()))))
    .then((all) => {
      const U = all.find((u) => u.kind === 'hebrew');
      if (!U) return null;
      const texts = U.texts.map(parseText);
      const bank = U.bank.map((line, k) => parseText({ id: `s${k + 1}`, paragraphs: [line], bank: true }));
      return { ...U, texts, bank, all: [...texts, ...bank] };
    })
    .catch(() => { cache[kidId] = undefined; return null; });
  return cache[kidId];
}

// Every sentence of every text and passage: { id, T, toks }.
const snipsOf = (U) => U.all.flatMap((T) => T.sents.map((ids, k) => ({ id: `${T.id}.${k + 1}`, T, toks: ids.map((i) => T.toks[i]) })));
const specOf = (toks, tok) => ({ toks, idx: toks.indexOf(tok) });
const wordsLine = (toks, opts) => sentenceHtml({ toks, idx: -1 }, { focus: [], ...opts });

// Did the kid point the pronoun at the right noun? Any earlier mention of the same thing counts.
function pointsTo(T, tok, i) {
  const t = T.toks[i];
  if (tok.targets.includes(i)) return true;
  const keys = new Set(tok.targets.map((j) => nounKey(T.toks[j])));
  return !!t && i < tok.i && catOf(t.tag) === 'n' && keys.has(nounKey(t));
}

// The passage a pronoun needs: from the sentence of the noun it points to up to its own sentence.
function contextOf(T, tok) {
  const first = Math.min(tok.sent, ...tok.targets.map((i) => T.toks[i].sent));
  const from = T.sents[Math.max(0, Math.min(first, tok.sent - 1))][0];
  const to = T.sents[tok.sent].at(-1);
  return T.toks.slice(from, to + 1);
}

// ---------- questions (for runQuiz) ----------
function helpBox(cat, spec, text, start = 0) {
  return {
    help: () => `<p class="hb-right">${text}</p><div class="hb-help-viz"></div>`,
    afterHelp: (el) => vizPanel(el.querySelector('.hb-help-viz'), cat, spec, start),
    viz: { cat, spec, start },
  };
}

// "Which word in the sentence is a noun?": one word of the kind, the others of no kind (or another kind).
function idPlan(snip, cat) {
  const right = snip.toks.filter((t) => catOf(t.tag) === cat);
  const others = snip.toks.filter((t) => !['x', cat].includes(catOf(t.tag)) && !right.some((r) => r.w === t.w));
  const distinct = [...new Map(others.map((t) => [t.w, t])).values()];
  return right.length && distinct.length >= 2 ? { right, distinct } : null;
}
function idQ(snip, cat) {
  const { right, distinct } = idPlan(snip, cat);
  const tok = pick(right);
  const opts = shuffle([tok, ...shuffle(distinct).slice(0, 3)]);
  return {
    key: `hb:${cat}:${snip.id}`, answer: String(tok.i),
    prompt: `<p class="q-ask">איזו מילה במשפט היא ${CATS[cat].icon} ${CATS[cat].name}?</p><div class="hb-q-text">${wordsLine(snip.toks)}</div>`,
    options: opts.map((t) => ({ html: esc(t.w), value: String(t.i) })),
    ...helpBox(cat, specOf(snip.toks, tok), `✓ <b>${esc(tok.w)}</b> ${cat === 'r' ? 'היא' : 'הוא'} ${chip(cat, CATS[cat].name)}: ${WHY[cat]}`,
      cat === 'v' ? vizStart('v', 'do') : 0),
  };
}

function tenseQ(snip) {
  const tok = pick(snip.toks.filter((t) => catOf(t.tag) === 'v'));
  const spec = specOf(snip.toks, tok);
  return {
    key: `hb:t:${snip.id}`, answer: tok.tag,
    prompt: `<p class="q-ask">באיזה זמן הפועל ״${esc(tok.w)}״?</p><div class="hb-q-text">${sentenceHtml(spec, { color: (t) => (t === tok ? 'v' : '') })}</div>`,
    options: Object.entries(TENSES).map(([k, T]) => ({ html: `${T.icon} ${T.name}`, value: k })),
    ...helpBox('v', spec, `✓ <b>${esc(tok.w)}</b> בזמן <b>${TENSES[tok.tag].name}</b>: אפשר לומר ״${TENSES[tok.tag].time} ${esc(tok.w)}״.`, vizStart('v', 'time')),
  };
}

function properQ(snip, tok) {
  const proper = tok.tag === 'p';
  return {
    key: `hb:pc:${tok.w}`, answer: proper ? 'p' : 'n',
    prompt: `<p class="q-ask">״${esc(tok.w)}״ הוא שם עצם פרטי או כללי?</p><div class="hb-q-text">${sentenceHtml(specOf(snip.toks, tok), { color: (t) => (t === tok ? 'n' : '') })}</div>`,
    options: [{ html: '🏷️ פרטי: שם של מישהו או משהו מסוים', value: 'p' }, { html: '📦 כללי: שם של כל אחד מהסוג', value: 'n' }],
    ...helpBox('n', specOf(snip.toks, tok), `✓ <b>${esc(tok.w)}</b> הוא שם עצם <b>${proper ? 'פרטי' : 'כללי'}</b>.`, vizStart('n', 'kind')),
  };
}

function agreeQ(it, k) {
  const right = it.forms[it.ans];
  const toks = parseLine(`${it.noun}/n ה${right}/a`);
  return {
    key: `hb:ag:${k}`, answer: right,
    prompt: `<p class="q-ask">איזה שם תואר מתאים?</p><div class="hb-q-text hb-big">${chip('n', it.noun)} ה<span class="hb-blank">___</span></div>`,
    options: it.forms.map((f) => ({ html: `ה${esc(f)}`, value: f })),
    ...helpBox('a', { toks, idx: 1, forms: it.forms }, `✓ <b>${esc(it.noun)} ה${esc(right)}</b>: ${GN[it.ans].short}, כמו שם העצם.${it.trap ? `<br>💡 ${esc(it.trap)}` : ''}`, vizStart('a', 'match')),
  };
}

function tenseFillQ(it, k) {
  const right = it.opts[0];
  const toks = parseLine(it.s.replace('___', `${right}/${it.tense}`));
  const idx = toks.findIndex((t) => t.tag);
  const shown = esc(it.s).replace(esc(it.time), `<mark class="hb-time">${esc(it.time)}</mark>`).replace('___', '<span class="hb-blank">___</span>');
  return {
    key: `hb:tf:${k}`, answer: right,
    prompt: `<p class="q-ask">השלימו את הפועל בזמן הנכון</p><div class="hb-q-text hb-line">${shown}</div>`,
    options: shuffle(it.opts).map((o) => ({ html: esc(o), value: o })),
    ...helpBox('v', { toks, idx }, `✓ ״${esc(it.time)}״ אומר <b>${TENSES[it.tense].name}</b>, ולכן: <b>${esc(right)}</b>.`, vizStart('v', 'time')),
  };
}

// "Who does ״הוא״ refer to?": the right noun phrase, the other nouns around it, and (for הם / הן) a single part of it.
function refPlan(T, tok) {
  if (!tok.targets.length) return null;
  const toks = contextOf(T, tok);
  const answer = targetPhrase(T.toks, tok);
  const same = new Set(tok.targets.map((i) => nounKey(T.toks[i])));
  const others = new Map(); // key → shown word
  // "הם" for "יובל ואמא": only one of them is a good wrong answer. Not for "היא" → "המדריכה רונית" (the same person).
  if (tok.targets.length > 1 && pronounOf(tok.w)?.k >= 2) tok.targets.forEach((i) => others.set(`one:${i}`, T.toks[i].base || T.toks[i].w));
  for (const t of [...toks, ...T.toks.slice(0, tok.i)].reverse()) {
    if (catOf(t.tag) === 'n' && t.i < tok.i && !same.has(nounKey(t)) && !others.has(nounKey(t))) others.set(nounKey(t), t.base || t.w);
  }
  const list = [...new Set(others.values())].filter((w) => w !== answer);
  return list.length >= 2 ? { toks, answer, others: list } : null;
}
function refQ(T, tok) {
  const { toks, answer, others } = refPlan(T, tok);
  const spec = specOf(toks, tok);
  return {
    key: `hb:r:${T.id}:${tok.i}`, answer,
    prompt: `<p class="q-ask">למי מתייחסת המילה ״${esc(tok.w)}״?</p><div class="hb-q-text">${sentenceHtml(spec, { color: (t) => (t === tok ? 'r' : '') })}</div>`,
    options: shuffle([answer, ...others.slice(0, 3)]).map((w) => ({ html: esc(w), value: w })),
    ...helpBox('r', spec, `✓ ״${esc(tok.w)}״ מזכירה את <b>${esc(answer)}</b>.`, vizStart('r', 'swap')),
  };
}

function fitQ(T, tok) {
  const pr = pronounOf(tok.w);
  const toks = contextOf(T, tok);
  const spec = specOf(toks, tok);
  return {
    key: `hb:rp:${T.id}:${tok.i}`, answer: tok.w,
    prompt: `<p class="q-ask">איזו מילה מתאימה במקום הקו?</p>
      <div class="hb-q-text">${sentenceHtml(spec, { focus: [], replace: { [spec.idx]: `${esc(pr.prefix)}<span class="hb-blank">___</span>` } })}</div>`,
    options: pr.fam.forms.map((f) => ({ html: esc(pr.prefix + f), value: pr.prefix + f })),
    ...helpBox('r', spec, `✓ <b>${esc(tok.w)}</b>: מזכירה את ״${esc(targetPhrase(T.toks, tok))}״, ${GN[pr.k].short}.`, vizStart('r', 'gender')),
  };
}

// All practice items of the unit: key → { cat, make }.
function itemsOf(U) {
  const out = new Map();
  const add = (key, cat, make) => out.set(key, { cat, make });
  const snips = snipsOf(U);
  for (const cat of ORDER.slice(0, 3)) {
    for (const s of snips) if (idPlan(s, cat)) add(`hb:${cat}:${s.id}`, cat, () => idQ(s, cat));
  }
  for (const s of snips) if (s.toks.some((t) => catOf(t.tag) === 'v')) add(`hb:t:${s.id}`, 'v', () => tenseQ(s));
  const seen = new Set();
  for (const s of snips) {
    for (const t of s.toks) {
      if (!(t.tag === 'p' || (t.tag === 'n' && s.T.bank && t.id)) || seen.has(t.w)) continue;
      seen.add(t.w);
      add(`hb:pc:${t.w}`, 'n', () => properQ(s, t));
    }
  }
  U.agree.forEach((it, k) => add(`hb:ag:${k}`, 'a', () => agreeQ(it, k)));
  U.tenses.forEach((it, k) => add(`hb:tf:${k}`, 'v', () => tenseFillQ(it, k)));
  for (const T of U.all) {
    for (const t of T.toks) {
      if (t.tag !== 'r') continue;
      if (refPlan(T, t)) add(`hb:r:${T.id}:${t.i}`, 'r', () => refQ(T, t));
      if (t.targets.length && pronounOf(t.w)) add(`hb:rp:${T.id}:${t.i}`, 'r', () => fitQ(T, t));
    }
  }
  return out;
}

// ---------- routes ----------
export async function renderHebrew(root, kid, [view = 'menu', ...args]) {
  const base = `#/kid/${kid.id}/hebrew`;
  const U = await loadUnit(kid.id);
  if (!U) { root.innerHTML = '<p class="subtitle">עוד אין חומר לנושא הזה.</p>'; return; }
  const ctx = { root, kid, base, U };
  if (view === 'topic' && CATS[args[0]]) return topic(ctx, args[0]);
  if (view === 'practice' && (CATS[args[0]] || args[0] === 'mix')) return practice(ctx, args[0]);
  if (view === 'find') return args[1] ? find(ctx, args[0], args[1], args[2]) : findMenu(ctx, args[0]);
  if (view === 'read') return args[0] ? read(ctx, args[0]) : readMenu(ctx);
  if (view === 'mock') return testIntro(ctx);
  menu(ctx);
}

function menu({ root, kid, base, U }) {
  const p = getProgress(kid.id);
  const keys = [...itemsOf(U).keys()];
  const mine = p.sessions.filter((s) => s.module === MOD);
  const tests = mine.filter((s) => s.part === 'mock');
  const card = (href, icon, title, sub) => `<a class="card" href="${href}"><span class="card-icon">${icon}</span><span class="card-title">${title}</span>${sub ? `<span class="card-sub">${sub}</span>` : ''}</a>`;
  root.innerHTML = `
    <h1 class="page-title">📖 הבנת הנקרא ולשון</h1>
    <p class="subtitle">${esc(U.source)}<br>בשליטה: ${masteredOf(p.items, keys)} מתוך ${keys.length}</p>
    ${legend()}
    <h2 class="section">1. לומדים כל נושא</h2>
    <div class="cards">${ORDER.map((c) => card(`${base}/topic/${c}`, CATS[c].icon, CATS[c].name, RULES[c][0].replace(/<[^>]+>/g, ''))).join('')}</div>
    <h2 class="section">2. מתרגלים</h2>
    <div class="cards">
      ${ORDER.map((c) => card(`${base}/practice/${c}`, '✏️', `תרגול: ${CATS[c].name}`, {
        n: 'מוצאים שם עצם, פרטי או כללי', a: 'מוצאים שם תואר, ומתאימים אותו לשם העצם',
        v: 'מוצאים פועל, באיזה זמן, ומשלימים בזמן הנכון', r: 'למי מתייחסת המילה? ואיזו מילה מתאימה?' }[c])).join('')}
      ${card(`${base}/practice/mix`, '🎯', 'תרגול מעורב', 'הכול ביחד, יותר ממה שעוד קשה')}
    </div>
    <h2 class="section">3. עם טקסט, כמו במבחן</h2>
    <div class="cards">
      ${card(`${base}/find`, '🔎', 'מוצאים בטקסט', 'מסמנים בטקסט שמות עצם, שמות תואר, פעלים וגופים מאזכרים')}
      ${card(`${base}/read`, '📖', 'קוראים ועונים', `${U.texts.length} טקסטים עם שאלות הבנה`)}
      ${card(`${base}/mock`, '🏁', 'מבחן לדוגמה', `טקסט, שאלות, ומציאת חלקי הדיבר. ציון מתוך 100${tests.length ? `<br><small>אחרון: ${tests.at(-1).score}</small>` : ''}`)}
    </div>`;
}

// ---------- topic: rules + an example seen in 4 ways ----------
function examplesOf(U, cat) {
  const out = [];
  for (const T of U.bank) {
    for (const ids of T.sents) {
      const toks = ids.map((i) => T.toks[i]);
      const hits = toks.filter((t) => catOf(t.tag) === cat && (cat !== 'r' || t.targets.length));
      if (!hits.length) continue;
      const tok = hits[0];
      out.push(cat === 'r' ? { toks: contextOf(T, tok), tok } : { toks, tok });
    }
  }
  return out;
}

function topic({ root, base, U }, cat) {
  const C = CATS[cat];
  const ex = shuffle(examplesOf(U, cat));
  let k = 0;
  root.innerHTML = `
    <a class="back" href="${base}">→ חזרה</a>
    <h1 class="page-title">${C.icon} ${C.name}</h1>
    <div class="panel hb-rules" style="--c:${C.color}"><ul>${RULES[cat].map((r) => `<li>${r}</li>`).join('')}</ul></div>
    <h2 class="section">דוגמה, בכמה דרכים</h2>
    <div class="row-center"><button class="btn btn-soft" id="other">🔀 דוגמה אחרת</button></div>
    <div id="viz"></div>
    <div class="row-center">
      <a class="btn btn-big" href="${base}/practice/${cat}">✏️ לתרגול</a>
      <a class="btn btn-soft" href="${base}/find/${cat}">🔎 למצוא בטקסט</a>
    </div>`;
  const specFor = (e) => specOf(e.toks, e.tok);
  const panel = vizPanel(root.querySelector('#viz'), cat, specFor(ex[0]));
  root.querySelector('#other').onclick = () => { k = (k + 1) % ex.length; panel.set(specFor(ex[k])); };
}

// ---------- practice ----------
const MODES = {
  n: { size: 10 }, a: { size: 10 }, v: { size: 10 }, r: { size: 10 }, mix: { size: 12 },
};
function practice({ root, kid, base, U }, mode) {
  const all = itemsOf(U);
  const pool = [...all].filter(([, it]) => mode === 'mix' || it.cat === mode);
  const keys = shuffle(pool.map(([k]) => k));
  const progress = getProgress(kid.id);
  const chosen = shuffle(pickSession(progress.items, keys, MODES[mode].size, { maxNew: mode === 'mix' ? 4 : 6 }));
  const before = masteredOf(progress.items, keys);
  runQuiz(root, {
    back: base, questions: chosen.map((k) => all.get(k).make()),
    onResult: (q, ok, ms) => { progress.items[q.key] = review(progress.items[q.key], ok, ms); },
    onDone: ({ right, total, ms }) => {
      saveProgress(progress);
      logSession(kid.id, { module: MOD, part: mode, unit: U.id, total, correct: right, ms });
      const gained = masteredOf(getProgress(kid.id).items, keys) - before;
      finishScreen(root, {
        right, total, again: () => practice({ root, kid, base, U }, mode),
        extra: gained > 0 ? `<p class="subtitle">🎉 ${gained} חדשים בשליטה!</p>` : '',
        links: `${CATS[mode] ? `<a class="btn btn-soft" href="${base}/topic/${mode}">${CATS[mode].icon} להסבר</a>` : ''}<a class="btn btn-soft" href="${base}">לתפריט 📖</a>`,
      });
    },
  });
}

// ---------- find in the text ----------
const FIND_CATS = {
  n: { cats: ['n'], title: 'שמות עצם', how: 'לחצו על כל שם עצם בטקסט. לחיצה נוספת מבטלת.' },
  a: { cats: ['a'], title: 'שמות תואר', how: 'לחצו על כל שם תואר בטקסט. לחיצה נוספת מבטלת.' },
  v: { cats: ['v'], title: 'פעלים וזמנים', how: 'לחצו על כל פועל, ובחרו באיזה זמן הוא.' },
  r: { cats: ['r'], title: 'גופים מאזכרים', how: 'לחצו על גוף מאזכר, ואז על המילה שהוא מזכיר.' },
  all: { cats: ORDER, title: 'הכול ביחד', how: 'בוחרים צבע למטה, ולוחצים על המילים בטקסט.' },
};

function findMenu({ root, kid, base, U }, cat) {
  if (!FIND_CATS[cat]) {
    root.innerHTML = `
      <a class="back" href="${base}">→ חזרה</a>
      <h1 class="page-title">🔎 מוצאים בטקסט</h1>
      <p class="subtitle">מה מחפשים?</p>
      <div class="cards">${Object.entries(FIND_CATS).map(([c, F]) => `
        <a class="card" href="${base}/find/${c}"><span class="card-icon">${CATS[c]?.icon || '🌈'}</span><span class="card-title">${F.title}</span><span class="card-sub">${F.how}</span></a>`).join('')}</div>`;
    return;
  }
  const done = getProgress(kid.id).sessions.filter((s) => s.module === MOD && s.part === 'find' && s.find === cat);
  root.innerHTML = `
    <a class="back" href="${base}/find">→ חזרה</a>
    <h1 class="page-title">🔎 ${FIND_CATS[cat].title}</h1>
    <p class="subtitle">באיזה טקסט?</p>
    <div class="cards">${U.texts.map((T) => {
      const last = done.filter((s) => s.text === T.id).at(-1);
      return `<a class="card" href="${base}/find/${cat}/${T.id}"><span class="card-icon">${T.emoji}</span><span class="card-title">${esc(T.title)}</span>
        <span class="card-sub">${last ? `✅ בפעם האחרונה: ${last.correct} מתוך ${last.total}` : `${T.paragraphs.length} פסקאות`}</span></a>`;
    }).join('')}</div>`;
}

// Tappable paragraphs; cls(t) adds classes and inner badges per word.
function tapText(T, paraIds, deco = () => ({})) {
  return paraIds.map((p) => `<p class="rd-p hb-p"><span class="rd-n">${p + 1}</span>${T.paras[p].map((i) => {
    const t = T.toks[i], d = deco(t);
    return `${esc(t.pre)}<span class="hb-t ${d.cls || ''}" data-i="${i}">${esc(t.w)}${d.badge || ''}</span>${esc(t.post)}`;
  }).join(' ')}</p>`).join('');
}

function find(ctx, cat, textId, paraArg) {
  const { root, kid, base, U } = ctx;
  const F = FIND_CATS[cat], T = U.texts.find((x) => x.id === textId);
  if (!F || !T) return findMenu(ctx, cat);
  const paras = paraArg && paraArg !== 'all' ? [Math.min(+paraArg || 0, T.paras.length - 1)] : T.paras.map((_, p) => p);
  const inView = new Set(paras.flatMap((p) => T.paras[p]));
  const goal = T.toks.filter((t) => inView.has(t.i) && F.cats.includes(catOf(t.tag)) && (catOf(t.tag) !== 'r' || t.targets.length));
  const marks = new Map(); // i → { cat, tense?, target? }
  let cur = F.cats[0], pending = null, checked = null;
  const begin = Date.now();
  const here = `${base}/find/${cat}/${T.id}`;

  root.innerHTML = `
    <a class="back" href="${base}/find/${cat}">→ חזרה</a>
    <h1 class="page-title">${T.emoji} ${esc(T.title)}</h1>
    <p class="subtitle">${F.how}</p>
    <div class="viz-tabs">${[...T.paras.map((_, p) => [String(p), `פסקה ${p + 1}`]), ['all', 'כל הטקסט']].map(([v, l]) =>
      `<a class="viz-tab ${(paraArg || 'all') === v ? 'active' : ''}" href="${here}/${v}">${l}</a>`).join('')}</div>
    ${F.cats.length > 1 ? `<div class="hb-palette">${F.cats.map((c) => `<button class="hb-pal hb-${c}" data-c="${c}">${CATS[c].icon} ${CATS[c].name}</button>`).join('')}</div>` : ''}
    <p class="hb-count" id="count"></p>
    <div class="panel wide hb-text" id="text"></div>
    <div class="hb-bar" id="bar"></div>
    <div id="sum"></div>
    <div class="row-center" id="btns">
      <button class="btn btn-big" id="check">בדיקה ✅</button>
      <button class="btn btn-soft" id="clear">ניקוי</button>
    </div>
    <div id="explain"></div>`;
  const $ = (s) => root.querySelector(s);

  const pronounNo = () => {
    const nums = new Map();
    [...marks].filter(([, m]) => m.cat === 'r').sort((a, b) => a[0] - b[0]).forEach(([i], k) => nums.set(i, k + 1));
    return nums;
  };
  const deco = (t) => {
    const m = marks.get(t.i), nums = pronounNo();
    const tgtOf = [...marks].filter(([, x]) => x.cat === 'r' && x.target === t.i).map(([i]) => nums.get(i));
    let cls = m ? `hb-m hb-${m.cat}` : '', badge = '';
    if (m?.cat === 'v' && m.tense) badge += `<sup class="hb-tag">${TENSES[m.tense].name}</sup>`;
    if (m?.cat === 'r') badge += `<sup class="hb-tag">${nums.get(t.i)}</sup>`;
    if (tgtOf.length) { cls += ' hb-tg'; badge += `<sup class="hb-tag hb-tg-n">${tgtOf.join(',')}</sup>`; }
    if (pending?.i === t.i) cls += ' hb-pending';
    if (checked) cls += ` ${checked.state.get(t.i) || ''}`;
    if (checked?.state.get(t.i) === 'hb-miss') badge += `<sup class="hb-tag hb-${catOf(t.tag)}-t">${CATS[catOf(t.tag)].name}</sup>`;
    return { cls, badge };
  };

  const draw = () => {
    $('#text').innerHTML = tapText(T, paras, deco);
    const counts = F.cats.map((c) => {
      const need = goal.filter((t) => catOf(t.tag) === c).length;
      const got = [...marks].filter(([, m]) => m.cat === c).length;
      return `${CATS[c].icon} ${CATS[c].plural}: יש ${need} · סימנתם ${got}`;
    });
    $('#count').innerHTML = counts.join('<br>');
    root.querySelectorAll('.hb-pal').forEach((b) => b.classList.toggle('on', b.dataset.c === cur));
    let bar = '';
    if (pending?.kind === 'tense') {
      bar = `<span>באיזה זמן ״${esc(T.toks[pending.i].w)}״?</span>${Object.entries(TENSES).map(([k, X]) => `<button class="btn btn-soft" data-tense="${k}">${X.icon} ${X.name}</button>`).join('')}`;
    } else if (pending?.kind === 'target') {
      bar = `<span>🔗 עכשיו לחצו על המילה ש״${esc(T.toks[pending.i].w)}״ מזכירה</span><button class="btn btn-soft" data-skip="1">אחר כך</button>`;
    }
    $('#bar').innerHTML = bar;
    $('#bar').classList.toggle('on', !!bar);
  };

  const check = () => {
    pending = null;
    const state = new Map();
    const tally = Object.fromEntries(F.cats.map((c) => [c, { need: 0, right: 0, half: 0, wrong: 0 }]));
    for (const t of goal) {
      const c = catOf(t.tag), m = marks.get(t.i), X = tally[c];
      X.need++;
      if (!m || m.cat !== c) { state.set(t.i, 'hb-miss'); continue; }
      const ok = c === 'v' ? m.tense === t.tag : c === 'r' ? pointsTo(T, t, m.target) : true;
      if (ok) { X.right++; state.set(t.i, 'hb-ok'); } else { X.half++; state.set(t.i, 'hb-half'); }
    }
    for (const [i, m] of marks) {
      if (state.has(i) && state.get(i) !== 'hb-miss') continue;
      const c = catOf(T.toks[i].tag);
      if (c === 'x' || (c === 'r' && !T.toks[i].targets.length)) { state.set(i, 'hb-neutral'); continue; }
      if (c !== m.cat) { tally[m.cat].wrong++; state.set(i, 'hb-bad'); }
    }
    const need = goal.length, right = Object.values(tally).reduce((s, X) => s + X.right, 0);
    const wrong = Object.values(tally).reduce((s, X) => s + X.wrong, 0);
    checked = { state };
    const progress = getProgress(kid.id);
    for (const c of F.cats) {
      const X = tally[c];
      if (!X.need) continue;
      const key = `hb:find:${T.id}:${c}`;
      progress.items[key] = review(progress.items[key], (X.right - X.wrong) / X.need >= 0.8, 5000);
    }
    saveProgress(progress);
    logSession(kid.id, { module: MOD, part: 'find', find: cat, text: T.id, unit: U.id, total: need, correct: right, ms: Date.now() - begin });
    $('#sum').innerHTML = `
      <div class="kpis">${F.cats.filter((c) => tally[c].need).map((c) => {
        const X = tally[c];
        return `<div class="kpi"><span class="kpi-num">${X.right}<small>/${X.need}</small></span><span class="kpi-label">${CATS[c].icon} ${CATS[c].plural}
          ${X.half ? `<br>${X.half} ${c === 'v' ? 'עם זמן לא נכון' : 'מזכירים מישהו אחר'}` : ''}${X.wrong ? `<br>${X.wrong} סימנתם בטעות` : ''}</span></div>`;
      }).join('')}</div>
      <p class="hb-key"><span class="hb-t hb-ok">נכון</span> <span class="hb-t hb-miss">פספסתם</span> <span class="hb-t hb-half">כמעט</span> <span class="hb-t hb-bad">טעות</span> · לוחצים על מילה כדי לראות הסבר</p>`;
    $('#btns').innerHTML = `<a class="btn btn-big" href="${here}/${paraArg || 'all'}" id="again">עוד פעם</a><a class="btn btn-soft" href="${base}/find/${cat}">טקסט אחר</a>`;
    $('#again').onclick = (e) => { e.preventDefault(); find(ctx, cat, textId, paraArg); };
    draw();
  };

  const explain = (t) => {
    const c = catOf(t.tag), m = marks.get(t.i);
    const toks = T.sents[t.sent].map((i) => T.toks[i]);
    let html;
    if (!c) html = `<p>״${esc(t.w)}״ היא לא שם עצם, לא שם תואר, לא פועל ולא גוף מאזכר (למשל מילת יחס או מילת קישור: על, את, של, ליד, אבל).</p>`;
    else if (c === 'x' || (c === 'r' && !t.targets.length)) html = `<p>את ״${esc(t.w)}״ לא סופרים בתרגיל הזה (שם פועל כמו ״ללכת״, מספר, או מילה על ״אנחנו״ שלא מזכירה מישהו מהטקסט).</p>`;
    else {
      const extra = c === 'v' ? ` בזמן <b>${TENSES[t.tag].name}</b>` : c === 'r' ? `, ומזכיר את <b>${esc(targetPhrase(T.toks, t))}</b>` : '';
      const yours = m && m.cat !== c ? ` סימנתם אותו כ${CATS[m.cat].name}.` : '';
      html = `<p>״${esc(t.w)}״ ${c === 'r' ? 'הוא גוף מאזכר' : `הוא ${CATS[c].name}`}${extra}.${yours} ${WHY[c]}</p><div id="ev"></div>`;
    }
    $('#explain').innerHTML = `<div class="help-box">${html}</div>`;
    const ev = $('#ev');
    if (ev) vizPanel(ev, c, c === 'r' ? specOf(contextOf(T, t), t) : specOf(toks, t), c === 'v' ? vizStart('v', 'time') : c === 'r' ? vizStart('r', 'arrow') : 0);
    $('#explain').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  root.addEventListener('click', (e) => {
    const pal = e.target.closest('.hb-pal');
    if (pal) { cur = pal.dataset.c; pending = null; draw(); return; }
    const tb = e.target.closest('[data-tense]');
    if (tb && pending) { marks.get(pending.i).tense = tb.dataset.tense; pending = null; draw(); return; }
    if (e.target.closest('[data-skip]')) { pending = null; draw(); return; }
    if (e.target.closest('#check')) { check(); return; }
    if (e.target.closest('#clear')) { marks.clear(); pending = null; draw(); return; }
    const w = e.target.closest('.hb-t[data-i]');
    if (!w) return;
    const i = +w.dataset.i;
    if (checked) { explain(T.toks[i]); return; }
    if (pending?.kind === 'target') {
      if (i !== pending.i) marks.get(pending.i).target = i;
      pending = null; draw(); return;
    }
    const m = marks.get(i);
    if (m && m.cat === cur) { marks.delete(i); pending = null; }
    else {
      marks.set(i, { cat: cur });
      pending = cur === 'v' ? { i, kind: 'tense' } : cur === 'r' ? { i, kind: 'target' } : null;
    }
    draw();
  }, { signal: viewSignal() });
  draw();
}

// ---------- read and answer ----------
function plainText(T, { mark = '', paras } = {}) {
  return (paras || T.paras.map((_, p) => p)).map((p) => {
    const s = T.paras[p].map((i) => T.toks[i]).map((t) => t.pre + t.w + t.post).join(' ');
    const at = mark ? s.indexOf(mark) : -1;
    const body = at < 0 ? esc(s) : `${esc(s.slice(0, at))}<mark class="rd-mark">${esc(mark)}</mark>${esc(s.slice(at + mark.length))}`;
    return `<p class="rd-p"><span class="rd-n">${p + 1}</span>${body}</p>`;
  }).join('');
}
const paraOf = (T, quote) => T.paras.findIndex((ids) => ids.map((i) => T.toks[i]).map((t) => t.pre + t.w + t.post).join(' ').includes(quote));

function readMenu({ root, kid, base, U }) {
  const done = getProgress(kid.id).sessions.filter((s) => s.module === MOD && s.part === 'read');
  root.innerHTML = `
    <a class="back" href="${base}">→ חזרה</a>
    <h1 class="page-title">📖 קוראים ועונים</h1>
    <p class="subtitle">קוראים את כל הטקסט פעם אחת, ואז עונים. לכל שאלה מחפשים את המשפט בטקסט.</p>
    <div class="cards">${U.texts.map((T) => {
      const last = done.filter((s) => s.text === T.id).at(-1);
      return `<a class="card" href="${base}/read/${T.id}"><span class="card-icon">${T.emoji}</span><span class="card-title">${esc(T.title)}</span>
        <span class="card-sub">${T.questions.length} שאלות${last ? `<br><small>✅ בפעם האחרונה: ${last.correct} מתוך ${last.total}</small>` : ''}</span></a>`;
    }).join('')}</div>`;
}

function textQ(T, q, k) {
  const right = q.options[0];
  return {
    key: `hb:q:${T.id}:${k}`, answer: right,
    prompt: `<p class="q-ask">${esc(q.q)}</p>`,
    options: shuffle(q.options).map((o) => ({ html: esc(o), value: o })),
    help: () => {
      const p = paraOf(T, q.evidence);
      return `<p class="hb-right">✓ ${esc(right)}</p>${q.why ? `<p>${esc(q.why)}</p>` : ''}
        <p class="muted">איפה זה כתוב (פסקה ${p + 1}):</p><div class="hb-text">${plainText(T, { mark: q.evidence, paras: [p] })}</div>`;
    },
  };
}

function read(ctx, textId) {
  const { root, kid, base, U } = ctx;
  const T = U.texts.find((x) => x.id === textId);
  if (!T) return readMenu(ctx);
  root.innerHTML = `
    <a class="back" href="${base}/read">→ חזרה</a>
    <h1 class="page-title">${T.emoji} ${esc(T.title)}</h1>
    <details class="panel wide hb-text" open><summary>הטקסט</summary>${plainText(T)}</details>
    <div id="quiz"></div>`;
  const progress = getProgress(kid.id);
  runQuiz(root.querySelector('#quiz'), {
    back: `${base}/read`, questions: T.questions.map((q, k) => textQ(T, q, k)),
    onResult: (q, ok, ms) => { progress.items[q.key] = review(progress.items[q.key], ok, ms); },
    onDone: ({ right, total, ms }) => {
      saveProgress(progress);
      logSession(kid.id, { module: MOD, part: 'read', text: T.id, unit: U.id, total, correct: right, ms });
      finishScreen(root, {
        right, total, again: () => read(ctx, textId),
        links: `<a class="btn btn-soft" href="${base}/find/all/${T.id}">🔎 לסמן בטקסט הזה</a><a class="btn btn-soft" href="${base}/read">טקסט אחר</a>`,
      });
    },
  });
}

// ---------- mock test ----------
// Part A (40): questions on the text. Part B (40): find in the text, like "סמנו בפסקה 2 שני שמות תואר".
// Part C (20): language questions without the text. No feedback until the end.
function taskList(T) {
  const tasks = [];
  const inPara = (p, f) => T.paras[p].map((i) => T.toks[i]).filter(f);
  const bestPara = (f, min) => shuffle(T.paras.map((_, p) => p)).find((p) => inPara(p, f).length >= min);
  const n = bestPara((t) => catOf(t.tag) === 'n', 4);
  if (n !== undefined) tasks.push({ kind: 'n', paras: [n], need: 3, text: `סמנו בפסקה ${n + 1} שלושה שמות עצם` });
  const a = bestPara((t) => t.tag === 'a', 2);
  if (a !== undefined) tasks.push({ kind: 'a', paras: [a], need: 2, text: `סמנו בפסקה ${a + 1} שני שמות תואר` });
  const tenses = shuffle(Object.keys(TENSES).filter((k) => T.toks.some((t) => t.tag === k)));
  for (const k of tenses.slice(0, 2)) {
    const p = bestPara((t) => t.tag === k, 1);
    tasks.push({ kind: 'v', tense: k, paras: [p], need: 1, text: `סמנו בפסקה ${p + 1} פועל בזמן ${TENSES[k].name}` });
  }
  const refs = shuffle(T.toks.filter((t) => t.tag === 'r' && t.targets.length));
  for (const t of refs.slice(0, 6 - tasks.length)) {
    const from = Math.min(t.para, ...t.targets.map((i) => T.toks[i].para));
    const paras = []; for (let p = from; p <= t.para; p++) paras.push(p);
    tasks.push({ kind: 'r', tok: t, paras, need: 1, text: `למי מתייחסת המילה ״${t.w}״ (פסקה ${t.para + 1})? סמנו את המילה שהיא מזכירה` });
  }
  return tasks.slice(0, 5);
}
const taskOk = (T, task, i) => {
  const t = T.toks[i];
  if (task.kind === 'v') return t.tag === task.tense;
  if (task.kind === 'r') return pointsTo(T, task.tok, i);
  return catOf(t.tag) === task.kind;
};

function languageItems(U) {
  const items = [];
  const ag = shuffle(U.agree.map((it, k) => [it, k]));
  const tf = shuffle(U.tenses.map((it, k) => [it, k]));
  const fits = shuffle(U.bank.flatMap((T) => T.toks.filter((t) => t.tag === 'r' && t.targets.length && pronounOf(t.w)).map((t) => [T, t])));
  items.push(agreeQ(...ag[0]), agreeQ(...ag[1]), tenseFillQ(...tf[0]), tenseFillQ(...tf[1]), fitQ(...fits[0]));
  return items;
}

function pickTestText(kid, U) {
  const used = getProgress(kid.id).sessions.filter((s) => s.module === MOD && s.part === 'mock').map((s) => s.text);
  return [...U.texts].sort((x, y) => used.lastIndexOf(x.id) - used.lastIndexOf(y.id))[0];
}

function testIntro(ctx) {
  const { root, kid, base } = ctx;
  const tests = getProgress(kid.id).sessions.filter((s) => s.module === MOD && s.part === 'mock');
  root.innerHTML = `
    <a class="back" href="${base}">→ חזרה</a>
    <h1 class="page-title">🏁 מבחן לדוגמה</h1>
    <div class="panel">
      <p>קוראים טקסט ועונים, <b>3 חלקים, 100 נקודות</b>:</p>
      <ol class="mt-plan">
        <li>שאלות על הטקסט (5 שאלות) · 40 נקודות</li>
        <li>מוצאים בטקסט: שמות עצם, שמות תואר, פעלים בזמן מסוים, ולמי מתייחס גוף מאזכר · 40 נקודות</li>
        <li>לשון: שם תואר מתאים, פועל בזמן הנכון, גוף מאזכר מתאים · 20 נקודות</li>
      </ol>
      <p>כמו במבחן אמיתי, אין משוב באמצע. בסוף מקבלים ציון, ורואים כל טעות עם התשובה הנכונה והסבר. כל מבחן נבנה מחדש, עם טקסט אחר מהקודם.</p>
      ${tests.length ? `<p class="muted">מבחנים קודמים: ${tests.slice(-5).map((s) => s.score).join(' · ')}</p>` : ''}
      <div class="row-center"><button class="btn btn-big" id="start">מתחילים ✍️</button></div>
    </div>`;
  root.querySelector('#start').onclick = () => runTest(ctx);
}

function runTest(ctx) {
  const { root: outer, kid, base, U } = ctx;
  const T = pickTestText(kid, U);
  const A = shuffle(T.questions.map((q, k) => ({ q, k, opts: shuffle(q.options) }))).slice(0, 5);
  const B = taskList(T);
  const C = languageItems(U);
  const ansA = A.map(() => null), ansB = B.map(() => []), ansC = C.map(() => null);
  const begin = Date.now();
  outer.innerHTML = '<div class="mt hb-test"></div>';
  const root = outer.firstElementChild;
  const optRow = (part, qi, opts) => `<div class="mt-opts">${opts.map((o, k) =>
    `<button class="mt-opt hb-opt" data-part="${part}" data-q="${qi}" data-k="${k}">${o}</button>`).join('')}</div>`;
  root.innerHTML = `
    <a class="back" href="${base}">→ חזרה</a>
    <h1 class="page-title">🏁 ${T.emoji} ${esc(T.title)}</h1>
    <div class="panel wide hb-text">${plainText(T)}</div>
    <h2 class="be-part-h">חלק א׳: ענו על השאלות <small class="muted">40 נקודות</small></h2>
    ${A.map(({ q, opts }, qi) => `<div class="mt-q"><p class="mt-qtext hb-qt">${qi + 1}. ${esc(q.q)}</p>${optRow('A', qi, opts.map(esc))}</div>`).join('')}
    <h2 class="be-part-h">חלק ב׳: מוצאים בטקסט <small class="muted">40 נקודות</small></h2>
    <p class="muted">לוחצים על המילים בפסקה. לחיצה נוספת מבטלת.</p>
    ${B.map((task, qi) => `<div class="mt-q hb-task" data-t="${qi}"><p class="mt-qtext hb-qt">${qi + 1}. ${esc(task.text)}</p>
      <div class="hb-text" data-task="${qi}"></div></div>`).join('')}
    <h2 class="be-part-h">חלק ג׳: לשון <small class="muted">20 נקודות</small></h2>
    ${C.map((q, qi) => `<div class="mt-q"><div class="hb-qt">${qi + 1}. ${q.prompt}</div>${optRow('C', qi, q.options.map((o) => o.html))}</div>`).join('')}
    <p class="subtitle" id="msg"></p>
    <div class="row-center"><button class="btn btn-big" id="submit">הגשה ✅</button></div>`;
  const drawTask = (qi) => {
    const task = B[qi];
    root.querySelector(`[data-task="${qi}"]`).innerHTML = tapText(T, task.paras, (t) => ({
      cls: `${ansB[qi].includes(t.i) ? 'hb-m hb-sel' : ''} ${task.kind === 'r' && t.i === task.tok.i ? 'hb-w hb-r' : ''}`,
    }));
  };
  B.forEach((_, qi) => drawTask(qi));
  let confirm = false;
  root.addEventListener('click', (e) => {
    const opt = e.target.closest('.hb-opt');
    if (opt) {
      const qi = +opt.dataset.q, k = +opt.dataset.k;
      (opt.dataset.part === 'A' ? ansA : ansC)[qi] = k;
      opt.parentElement.querySelectorAll('.hb-opt').forEach((b) => b.classList.toggle('on', b === opt));
      return;
    }
    const w = e.target.closest('.hb-t[data-i]');
    const taskEl = w?.closest('[data-task]');
    if (taskEl) {
      const qi = +taskEl.dataset.task, i = +w.dataset.i, sel = ansB[qi];
      if (B[qi].kind === 'r' && i === B[qi].tok.i) return;
      const at = sel.indexOf(i);
      if (at >= 0) sel.splice(at, 1);
      else { sel.push(i); if (sel.length > B[qi].need) sel.shift(); }
      drawTask(qi);
      return;
    }
    if (!e.target.closest('#submit')) return;
    const empty = ansA.filter((a) => a === null).length + ansC.filter((a) => a === null).length + ansB.filter((s) => !s.length).length;
    if (empty && !confirm) {
      confirm = true;
      root.querySelector('#msg').textContent = `נשארו ${empty} שאלות בלי תשובה. לוחצים שוב על הגשה כדי להגיש בכל זאת.`;
      return;
    }
    results(ctx, T, { A, B, C }, { ansA, ansB, ansC }, Date.now() - begin);
  }, { signal: viewSignal() });
}

function results(ctx, T, { A, B, C }, { ansA, ansB, ansC }, ms) {
  const { root: outer, kid, base, U } = ctx;
  const progress = getProgress(kid.id);
  const mistakes = [];
  let okA = 0, ptsB = 0, okC = 0;
  A.forEach(({ q, k, opts }, qi) => {
    const v = ansA[qi] === null ? null : opts[ansA[qi]];
    const good = v === q.options[0];
    progress.items[`hb:q:${T.id}:${k}`] = review(progress.items[`hb:q:${T.id}:${k}`], good, 5000);
    if (good) okA++; else mistakes.push({ part: 'A', qi, q, v });
  });
  B.forEach((task, qi) => {
    const good = ansB[qi].filter((i) => taskOk(T, task, i)).length;
    ptsB += Math.min(good, task.need) / task.need;
    if (good < task.need) mistakes.push({ part: 'B', qi, task, sel: ansB[qi] });
  });
  C.forEach((q, qi) => {
    const v = ansC[qi] === null ? null : q.options[ansC[qi]].value;
    const good = v === q.answer;
    progress.items[q.key] = review(progress.items[q.key], good, 5000);
    if (good) okC++; else mistakes.push({ part: 'C', qi, q, v });
  });
  const sA = Math.round((40 * okA) / A.length), sB = Math.round((40 * ptsB) / Math.max(B.length, 1)), sC = Math.round((20 * okC) / C.length);
  const score = sA + sB + sC;
  const total = A.length + B.length + C.length;
  const correct = okA + okC + B.filter((task, qi) => ansB[qi].filter((i) => taskOk(T, task, i)).length >= task.need).length;
  saveProgress(progress);
  logSession(kid.id, { module: MOD, part: 'mock', unit: U.id, text: T.id, score, total, correct, ms });
  const verdict = score >= 90 ? 'מצוין! אתם מוכנים למבחן 🏆' : score >= 75 ? 'טוב מאוד! עוברים על הטעויות, והציון יעלה עוד 💪'
    : score >= 55 ? 'בדרך הנכונה. כדאי לחזור להסברים ולתרגל את מה שקשה' : 'כדאי לחזור להסברים ולתרגל, ואז לנסות שוב. כל ניסיון מקרב 🙂';
  outer.innerHTML = '<div class="mt hb-test"></div>';
  const root = outer.firstElementChild;
  const kpi = (pts, of, label) => `<div class="kpi"><span class="kpi-num">${pts}<small>/${of}</small></span><span class="kpi-label">${label}</span></div>`;
  root.innerHTML = `
    <div class="finish">
      <p class="subtitle">הציון במבחן</p>
      <div class="sp-grade">${score}</div>
      <h1>${verdict}</h1>
      <p class="subtitle">${correct} תשובות נכונות מתוך ${total} · ${Math.max(1, Math.round(ms / 6e4))} דקות</p>
    </div>
    <div class="kpis">${kpi(sA, 40, `חלק א׳ · הבנת הטקסט · ${okA}/${A.length}`)}${kpi(sB, 40, 'חלק ב׳ · מוצאים בטקסט')}${kpi(sC, 20, `חלק ג׳ · לשון · ${okC}/${C.length}`)}</div>
    ${mistakes.length ? `<h2 class="section">הטעויות, עם התשובה הנכונה</h2><div class="mt-review">${mistakes.map((m, k) => mistakeHtml(T, m, k)).join('')}</div>`
      : '<p class="subtitle">🎉 אין אף טעות!</p>'}
    <div class="row-center">
      <button class="btn btn-big" id="again">מבחן נוסף</button>
      <a class="btn btn-soft" href="${base}">לתפריט 📖</a>
    </div>`;
  window.scrollTo(0, 0);
  root.querySelectorAll('.hb-mviz').forEach((el) => {
    const m = mistakes[+el.dataset.k];
    if (m.part === 'C') {
      const { cat, spec, start } = m.q.viz;
      vizPanel(el, cat, spec, start);
    } else if (m.part === 'B') {
      const { task } = m;
      const tok = task.kind === 'r' ? task.tok : T.paras[task.paras[0]].map((i) => T.toks[i]).find((t) => taskOk(T, task, t.i));
      const cat = task.kind;
      const toks = cat === 'r' ? contextOf(T, tok) : T.sents[tok.sent].map((i) => T.toks[i]);
      vizPanel(el, cat, specOf(toks, tok), cat === 'v' ? vizStart('v', 'time') : cat === 'r' ? vizStart('r', 'swap') : 0);
    }
  });
  root.querySelector('#again').onclick = () => testIntro(ctx);
}

function mistakeHtml(T, m, k) {
  if (m.part === 'A') {
    const p = paraOf(T, m.q.evidence);
    return `<div class="mt-mistake"><p><b>א׳ ${m.qi + 1}.</b> ${esc(m.q.q)}</p>
      <p class="mt-ans">✗ התשובה שלכם: ${m.v ? esc(m.v) : 'לא עניתם'}</p>
      <p class="mt-ans">✓ התשובה הנכונה: <b>${esc(m.q.options[0])}</b></p>
      ${m.q.why ? `<p>${esc(m.q.why)}</p>` : ''}
      <div class="hb-text">${plainText(T, { mark: m.q.evidence, paras: [p] })}</div></div>`;
  }
  if (m.part === 'B') {
    const { task, sel } = m;
    const deco = (t) => {
      const ok = taskOk(T, task, t.i), mine = sel.includes(t.i);
      if (mine) return { cls: ok ? 'hb-ok' : 'hb-bad' };
      if (ok) return { cls: 'hb-miss' };
      if (task.kind === 'r' && t.i === task.tok.i) return { cls: 'hb-w hb-r' };
      return {};
    };
    const what = task.kind === 'r' ? `״${esc(task.tok.w)}״ מזכירה את <b>${esc(targetPhrase(T.toks, task.tok))}</b>.`
      : task.kind === 'v' ? `פעלים בזמן ${TENSES[task.tense].name} מסומנים בקו.` : `כל ${{ n: 'שמות העצם', a: 'שמות התואר' }[task.kind]} בפסקה מסומנים בקו.`;
    return `<div class="mt-mistake"><p><b>ב׳ ${m.qi + 1}.</b> ${esc(task.text)}</p>
      <p class="mt-ans">${what} <span class="hb-t hb-ok">סימנתם נכון</span> <span class="hb-t hb-bad">טעות</span> <span class="hb-t hb-miss">תשובה נכונה</span></p>
      <div class="hb-text">${tapText(T, task.paras, deco)}</div><div class="hb-mviz" data-k="${k}"></div></div>`;
  }
  const q = m.q;
  const yours = m.v === null ? 'לא עניתם' : q.options.find((o) => o.value === m.v)?.html;
  return `<div class="mt-mistake"><p><b>ג׳ ${m.qi + 1}.</b></p>${q.prompt}
    <p class="mt-ans">✗ התשובה שלכם: ${yours}</p>${q.help().replace('<div class="hb-help-viz"></div>', '')}
    <div class="hb-mviz" data-k="${k}"></div></div>`;
}
