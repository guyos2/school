// Hebrew language for reading comprehension (Hillel): nouns, adjectives, verbs and their tense, referring pronouns.
// Texts are written with light markup, one tag per word: "יובל/p#yuval הלך/vp ... הוא/r>yuval" (see the unit's "markup").
// A spec for the visualizations: { toks: tokens of a sentence or short passage, idx: index (in toks) of the word in focus }.
import { esc } from '../ui.js';

export const CATS = {
  n: { name: 'שם עצם', plural: 'שמות עצם', icon: '📦', color: '#3b82f6' },
  a: { name: 'שם תואר', plural: 'שמות תואר', icon: '🎨', color: '#10b981' },
  v: { name: 'פועל', plural: 'פעלים', icon: '🏃', color: '#f97316' },
  r: { name: 'גוף מאזכר', plural: 'גופים מאזכרים', icon: '🔗', color: '#8b5cf6' },
};
export const TENSES = {
  vp: { name: 'עבר', time: 'אתמול', icon: '⏪' },
  vh: { name: 'הווה', time: 'עכשיו', icon: '⏺️' },
  vf: { name: 'עתיד', time: 'מחר', icon: '⏩' },
};
export const catOf = (tag) => ({ n: 'n', p: 'n', a: 'a', vp: 'v', vh: 'v', vf: 'v', r: 'r', x: 'x' }[tag] || '');

// ---------- parsing ----------
const TOKEN = /^([״"(]*)(.+?)(?:\/(n|p|a|vp|vh|vf|r|x)(?:=([\u0590-\u05FF]+))?(?:#(\w+))?(?:>([\w,]+))?)?([.,!?:;״")]*)$/;

// A paragraph string → tokens { w, pre, post, tag, base, id, to[], end (ends a sentence) }.
export function parseLine(line) {
  return line.trim().split(/\s+/).map((chunk) => {
    const m = chunk.match(TOKEN);
    const [, pre, w, tag = '', base, id, to, post] = m;
    return { w, pre, post, tag, base: base || '', id: id || '', to: to ? to.split(',') : [], end: /[.!?]/.test(post) };
  });
}

// A text → { ...T, toks (all tokens, each with i, para, sent), paras: [[i...]], sents: [[i...]] }.
export function parseText(T) {
  const toks = [], paras = [], sents = [];
  let sent = [];
  T.paragraphs.forEach((line, p) => {
    const ids = [];
    for (const t of parseLine(line)) {
      t.i = toks.length; t.para = p; t.sent = sents.length;
      toks.push(t); ids.push(t.i); sent.push(t.i);
      if (t.end) { sents.push(sent); sent = []; }
    }
    if (sent.length) { sents.push(sent); sent = []; }
    paras.push(ids);
  });
  const byId = Object.fromEntries(toks.filter((t) => t.id).map((t) => [t.id, t.i]));
  for (const t of toks) t.targets = t.to.map((id) => byId[id]).filter((x) => x !== undefined);
  return { ...T, toks, paras, sents };
}

export const plainOf = (toks) => toks.map((t) => t.pre + t.w + t.post).join(' ');

// ---------- referring pronouns ----------
// Each family: the four forms (he, she, they m., they f.) and how to put the noun back in its place.
export const FAMILIES = [
  { forms: ['הוא', 'היא', 'הם', 'הן'], prep: '' },
  { forms: ['לו', 'לה', 'להם', 'להן'], prep: 'ל' },
  { forms: ['שלו', 'שלה', 'שלהם', 'שלהן'], prep: 'של ' },
  { forms: ['אותו', 'אותה', 'אותם', 'אותן'], prep: 'את ' },
  { forms: ['עליו', 'עליה', 'עליהם', 'עליהן'], prep: 'על ' },
  { forms: ['בו', 'בה', 'בהם', 'בהן'], prep: 'ב' },
  { forms: ['ממנו', 'ממנה', 'מהם', 'מהן'], prep: 'מ' },
  { forms: ['איתו', 'איתה', 'איתם', 'איתן'], prep: 'עם ' },
  { forms: ['אליו', 'אליה', 'אליהם', 'אליהן'], prep: 'אל ' },
];
export const GN = [
  { g: 'זכר', n: 'יחיד', short: 'זכר, אחד' },
  { g: 'נקבה', n: 'יחידה', short: 'נקבה, אחת' },
  { g: 'זכר', n: 'רבים', short: 'זכר, כמה' },
  { g: 'נקבה', n: 'רבות', short: 'נקבה, כמה' },
];

// "והוא" → { prefix: 'ו', fam, k (0..3), form: 'הוא' }, or null.
export function pronounOf(word) {
  for (const prefix of ['', 'ו', 'ש', 'כש', 'וכש']) {
    if (prefix && !word.startsWith(prefix)) continue;
    const rest = word.slice(prefix.length);
    for (const fam of FAMILIES) {
      const k = fam.forms.indexOf(rest);
      if (k >= 0) return { prefix, fam, k, form: rest };
    }
  }
  return null;
}

// The words a pronoun points to, as one phrase ("יובל ואמא"), without a leading prefix ("כשהדבורה" → "הדבורה").
export function targetPhrase(toks, t) {
  if (!t.targets?.length) return '';
  const lo = Math.min(...t.targets), hi = Math.max(...t.targets);
  return toks.filter((x) => x.i >= lo && x.i <= hi).map((x, k) => (k ? x.w : x.base || x.w)).join(' ');
}
// Two mentions of the same thing ("כלבלב", "הכלבלב", "בכוורת") share a key.
export const nounKey = (t) => (t.base || t.w).replace(/^ה/, '');

// Put the noun back instead of the pronoun: "לו" + "הכלבלב" → "לכלבלב".
export function swapIn(pr, phrase) {
  const { prep } = pr.fam;
  let p = phrase;
  if ((prep === 'ל' || prep === 'ב') && p.startsWith('ה')) p = p.slice(1);
  return pr.prefix + prep + p;
}

// ---------- sentence rendering ----------
export const chip = (cat, text, cls = '') => `<span class="hb-chip hb-${cat} ${cls}">${esc(text)}</span>`;
export const legend = (cats = ['n', 'a', 'v', 'r']) =>
  `<div class="hb-legend">${cats.map((c) => chip(c, `${CATS[c].icon} ${CATS[c].name}`)).join('')}</div>`;

// The words of spec.toks; color(t, k) returns a category to paint, focus gets a ring.
function line(spec, { color = () => '', focus = [spec.idx], replace = {} } = {}) {
  return `<p class="hb-line">${spec.toks.map((t, k) => {
    if (replace[k] !== undefined) return `${esc(t.pre)}${replace[k]}${esc(t.post)}`;
    const c = color(t, k);
    const cls = `${c ? `hb-w hb-${c}` : ''} ${focus.includes(k) ? 'hb-focus' : ''}`.trim();
    return `${esc(t.pre)}${cls ? `<span class="${cls}">${esc(t.w)}</span>` : esc(t.w)}${esc(t.post)}`;
  }).join(' ')}</p>`;
}
export const sentenceHtml = (spec, opts) => line(spec, opts);
const focusTok = (spec) => spec.toks[spec.idx];
const allColors = (t) => (['n', 'a', 'v', 'r'].includes(catOf(t.tag)) ? catOf(t.tag) : '');

// 0. Shared by all four: the whole sentence painted by part of speech.
function painted(cat) {
  return (spec) => ({
    html: `${legend()}${line(spec, { color: allColors })}`,
    caption: `כל מילה בצבע שלה. <b>${esc(focusTok(spec).w)}</b> ${cat === 'r' ? 'היא' : 'הוא'} ${chip(cat, CATS[cat].name)}${cat === 'v' ? ` בזמן ${TENSES[focusTok(spec).tag]?.name || ''}` : ''}`,
  });
}

// The nearest noun before the word (or after it), inside the same short passage.
function nounNear(spec) {
  const { toks, idx } = spec;
  for (let k = idx - 1; k >= 0; k--) if (catOf(toks[k].tag) === 'n') return k;
  for (let k = idx + 1; k < toks.length; k++) if (catOf(toks[k].tag) === 'n') return k;
  return -1;
}
const PREFIXES = ['וכש', 'ומה', 'וה', 'וב', 'ול', 'ומ', 'שה', 'כש', 'מה', 'בה', 'לה', 'ו', 'ה', 'ב', 'ל', 'מ', 'כ', 'ש'];
// A guess at the prefix letters (ה, ו, ב, ל...) only when the tag gives a base word.
const baseOf = (t) => t.base || t.w;

// ---------- nouns ----------
const KINDS = [['👤', 'אדם'], ['🐾', 'בעל חיים'], ['🌳', 'צמח'], ['🎒', 'חפץ'], ['🏠', 'מקום'], ['💭', 'רגש או רעיון']];

function nounAsk(spec) {
  const t = focusTok(spec);
  const hasPrefix = PREFIXES.some((p) => t.w.startsWith(p) && t.w.length > p.length + 2);
  return {
    html: `
      <div class="hb-big">${chip('n', t.w)}</div>
      <div class="hb-asks"><span class="hb-ask">מי זה?</span><span class="hb-ask">מה זה?</span><span class="hb-arrow">←</span><b>זה ${esc(baseOf(t))}</b></div>
      <div class="hb-kinds">${KINDS.map(([i, k]) => `<span class="hb-kind">${i} ${k}</span>`).join('')}</div>
      ${hasPrefix ? '<p class="hb-note">💡 לפעמים יש לפני שם העצם אות קטנה: ה, ו, ב, ל, מ, ש. היא לא משנה את סוג המילה: בכוורת, והילדים, מהצוף.</p>' : ''}`,
    caption: 'שם עצם הוא שם של אדם, בעל חיים, צמח, חפץ, מקום או רגש. אפשר לשאול עליו <b>מי?</b> או <b>מה?</b>',
  };
}

// Three quick tests, next to a word from the same sentence that fails them.
function nounTests(spec) {
  const t = focusTok(spec);
  const other = spec.toks.find((x) => ['v', 'a'].includes(catOf(x.tag)));
  const rows = [
    ['שואלים: מי? מה?', `${esc(baseOf(t))} ✔`, other ? `${esc(other.w)} ✘` : ''],
    ['סופרים: אחד, שניים', `${esc(baseOf(t))} אחד, שניים ✔`, other ? `״שני ${esc(other.w)}״ ✘` : ''],
  ];
  if (!other || catOf(other.tag) === 'v') rows.push(['מוסיפים ה׳ הידיעה', '✔', other ? `״ה${esc(other.w)}״ ✘` : '']);
  return {
    html: `<table class="hb-table"><thead><tr><th>הבדיקה</th><th>${chip('n', t.w)}</th>${other ? `<th>${chip(catOf(other.tag), other.w)}</th>` : ''}</tr></thead>
      <tbody>${rows.map(([a, b, c]) => `<tr><td>${a}</td><td>${b}</td>${other ? `<td>${c}</td>` : ''}</tr>`).join('')}</tbody></table>`,
    caption: `שלוש בדיקות קטנות. שם עצם עובר אותן${other ? `, ו״${esc(other.w)}״ (${CATS[catOf(other.tag)].name}) לא` : ''}`,
  };
}

function nounKind(spec) {
  const t = focusTok(spec);
  const proper = t.tag === 'p';
  return {
    html: `
      <div class="hb-two">
        <div class="hb-box ${proper ? '' : 'on'}"><b>שם עצם כללי</b><span>ילד, עיר, כלב, ספר</span><small>שם של כל אחד מהסוג</small></div>
        <div class="hb-box ${proper ? 'on' : ''}"><b>שם עצם פרטי</b><span>יובל, ירושלים, רונית</span><small>שם של מישהו או משהו מסוים אחד</small></div>
      </div>
      <p class="hb-line">${chip('n', t.w)} ← ${proper ? 'פרטי' : 'כללי'}</p>`,
    caption: 'גם שם של אדם או של מקום הוא שם עצם: שם עצם <b>פרטי</b>',
  };
}

// ---------- adjectives ----------
function adjWhich(spec) {
  const t = focusTok(spec), k = nounNear(spec);
  const noun = k >= 0 ? baseOf(spec.toks[k]) : '';
  return {
    html: noun ? `
      <div class="hb-asks"><span class="hb-ask">${GN_ASK(t.w)} ${esc(noun)}?</span><span class="hb-arrow">←</span>${chip('n', noun)} ${chip('a', t.w)}</div>
      ${line(spec, { color: (x, j) => (j === k ? 'n' : j === spec.idx ? 'a' : ''), focus: [spec.idx, k] })}`
      : `<div class="hb-big">${chip('a', t.w)}</div>`,
    caption: 'שם תואר מתאר שם עצם: איך הוא נראה, איזה צבע, איזה גודל, מה התכונה שלו. שואלים <b>איזה? איזו? אילו?</b>',
  };
}
// The question word that fits the adjective's ending.
function GN_ASK(w) {
  const k = adjGN(w);
  return k >= 2 ? 'אילו' : k === 1 ? 'איזו' : 'איזה';
}
function adjGN(w) {
  const s = w.replace(/^ו?ה?/, '');
  if (s.endsWith('ים')) return 2;
  if (s.endsWith('ות')) return 3;
  if (/(ה|ית)$/.test(s) && !/^(גבוה|יפה)$/.test(s)) return 1;
  return 0;
}

function adjWithout(spec) {
  const t = focusTok(spec);
  const without = { ...spec, toks: spec.toks.filter((_, k) => k !== spec.idx) };
  return {
    html: `
      <p class="hb-label">בלי שם התואר:</p>${line({ ...without, idx: -1 })}
      <p class="hb-label">עם שם התואר:</p>${line(spec, { color: (x, k) => (k === spec.idx ? 'a' : '') })}`,
    caption: `בלי ״${esc(t.w)}״ המשפט עדיין נכון, אבל יודעים פחות. שם התואר <b>מוסיף פרטים</b> על שם העצם`,
  };
}

const MATCH_EX = [['ילד', 'גדול'], ['ילדה', 'גדולה'], ['ילדים', 'גדולים'], ['ילדות', 'גדולות']];
function adjMatch(spec, forms) {
  const t = focusTok(spec), k = forms ? forms.indexOf(t.w.replace(/^ה/, '')) : adjGN(t.w);
  const kk = k < 0 ? adjGN(t.w) : k;
  const ex = forms ? null : MATCH_EX;
  return {
    html: `<div class="hb-grid">${GN.map((g, j) => `
      <div class="hb-cell ${j === kk ? 'on' : ''}"><small>${g.short}</small>
        <b>${forms ? esc(forms[j]) : `${ex[j][0]} ${ex[j][1]}`}</b>${j === kk ? chip('a', t.w) : ''}</div>`).join('')}</div>`,
    caption: `שם התואר מתאים לשם העצם: זכר או נקבה, אחד או כמה. גם ה׳ הידיעה עוברת: הכלב <b>ה</b>קטן`,
  };
}

// ---------- verbs ----------
function verbTime(spec) {
  const t = focusTok(spec), tense = t.tag;
  return {
    html: `<div class="hb-timeline">${Object.entries(TENSES).map(([k, T]) => `
      <div class="hb-slot ${k === tense ? 'on' : ''}"><span class="hb-slot-i">${T.icon}</span><b>${T.name}</b><small>${T.time}</small>
        ${k === tense ? chip('v', t.w) : '<span class="hb-q">?</span>'}</div>`).join('<span class="hb-tl-arrow">←</span>')}</div>
      ${TENSES[tense] ? `<p class="hb-line">${TENSES[tense].time} ${chip('v', t.w)} ✔</p>` : ''}`,
    caption: 'מוסיפים לפני הפועל <b>אתמול</b>, <b>עכשיו</b> או <b>מחר</b>, ובודקים מה נשמע נכון',
  };
}

// Where the tense shows in the word (a guess for the highlight; the table always shows all the signs).
function markSigns(w, tense) {
  const s = w.replace(/^(ו|ש|כש)/, '');
  const pre = w.slice(0, w.length - s.length);
  if (tense === 'vf' && /^[איתנ]/.test(s)) return `${esc(pre)}<u>${s[0]}</u>${esc(s.slice(1))}`;
  const end = { vp: /(תי|נו|תם|תן|ת|ו|ה)$/, vh: /(ים|ות|ת|ה)$/ }[tense];
  const m = end && s.match(end);
  if (m) return `${esc(pre + s.slice(0, m.index))}<u>${m[0]}</u>`;
  return esc(w);
}
function verbSigns(spec) {
  const t = focusTok(spec);
  const rows = [
    ['vp', 'בסוף: ־תי, ־ת, ־נו, ־תם, ־ו, ־ה', 'כתבתי, כתבנו, כתבו, כתבה'],
    ['vh', 'בסוף: ־ים, ־ות, ־ת, ־ה', 'כותב, כותבת, כותבים, כותבות'],
    ['vf', 'בהתחלה: א, י, ת, נ (אית״ן)', 'אכתוב, יכתוב, תכתוב, נכתוב'],
  ];
  return {
    html: `<div class="hb-big"><span class="hb-chip hb-v hb-signs">${markSigns(t.w, t.tag)}</span></div>
      <table class="hb-table"><tbody>${rows.map(([k, sign, ex]) => `
        <tr class="${k === t.tag ? 'on' : ''}"><td><b>${TENSES[k].name}</b></td><td>${sign}</td><td>${ex}</td></tr>`).join('')}</tbody></table>`,
    caption: 'אותיות בתחילת המילה או בסופה מגלות את הזמן',
  };
}

function verbDo(spec) {
  const t = focusTok(spec);
  return {
    html: `
      <div class="hb-asks"><span class="hb-ask">מה עושים?</span><span class="hb-ask">מה קרה?</span><span class="hb-arrow">←</span>${chip('v', t.w)}</div>
      ${line(spec, { color: (x, k) => (catOf(x.tag) === 'v' ? 'v' : '') })}
      <p class="hb-note">💡 ״ללכת, לקרוא, לשחק״ הם <b>שם הפועל</b>: מתחילים ב־ל ואין להם זמן.</p>`,
    caption: 'פועל מספר מה עושים או מה קורה. לכל פועל יש זמן: עבר, הווה או עתיד',
  };
}

// ---------- referring pronouns ----------
function refArrow(spec) {
  const t = focusTok(spec);
  const ks = t.targets.map((i) => spec.toks.findIndex((x) => x.i === i)).filter((k) => k >= 0);
  const phrase = targetPhrase(spec.toks, t);
  return {
    html: `${line(spec, { color: (x, k) => (k === spec.idx ? 'r' : ks.includes(k) ? 'n' : ''), focus: [spec.idx, ...ks] })}
      <div class="hb-asks">${chip('r', t.w)}<span class="hb-arrow">→ חוזרים אחורה →</span>${chip('n', phrase)}</div>`,
    caption: 'גוף מאזכר מחליף שם עצם שכבר הופיע בטקסט, כדי לא לחזור עליו. חוזרים אחורה ומחפשים את מי הוא מזכיר',
  };
}

function refSwap(spec) {
  const t = focusTok(spec), pr = pronounOf(t.w);
  const phrase = targetPhrase(spec.toks, t);
  const swapped = pr ? swapIn(pr, phrase) : phrase;
  return {
    html: `${line(spec, { color: (x, k) => (k === spec.idx ? 'r' : ''), focus: [] })}
      <div class="hb-down">↓ מחליפים ↓</div>
      ${line(spec, { focus: [], replace: { [spec.idx]: `<s class="hb-struck">${esc(t.w)}</s> ${chip('n', swapped)}` } })}`,
    caption: 'שמים את שם העצם במקום הגוף המאזכר וקוראים שוב. אם המשפט נשמע הגיוני, מצאנו',
  };
}

function refGender(spec) {
  const t = focusTok(spec), pr = pronounOf(t.w);
  const fam = pr?.fam || FAMILIES[0];
  return {
    html: `<div class="hb-grid">${GN.map((g, j) => `
      <div class="hb-cell ${pr && j === pr.k ? 'on' : ''}"><small>${g.short}</small><b>${fam.forms[j]}</b>
        ${pr && j === pr.k ? chip('n', targetPhrase(spec.toks, t)) : ''}</div>`).join('')}</div>`,
    caption: pr ? `<b>${esc(pr.form)}</b> = ${GN[pr.k].short}. מחפשים לפניו שם עצם שהוא ${GN[pr.k].short}` : 'הוא, היא, הם, הן: זכר או נקבה, אחד או כמה',
  };
}

function refFamily(spec) {
  const pr = pronounOf(focusTok(spec).w);
  return {
    html: `<table class="hb-table hb-fam"><thead><tr><th></th>${GN.map((g) => `<th>${g.short}</th>`).join('')}</tr></thead>
      <tbody>${FAMILIES.map((f) => `<tr class="${pr?.fam === f ? 'on' : ''}"><td>${f.prep ? esc(f.prep.trim()) + '…' : 'מי?'}</td>
        ${f.forms.map((w, j) => `<td class="${pr?.fam === f && pr.k === j ? 'hb-hit' : ''}">${w}</td>`).join('')}</tr>`).join('')}</tbody></table>`,
    caption: 'לא רק הוא והיא: גם לו, שלה, אותם, עליהן הם גופים מאזכרים. כולם מזכירים מישהו שכבר הופיע',
  };
}

export const METHODS = {
  n: [
    { id: 'ask', name: 'מי? מה?', icon: '❓', render: nounAsk },
    { id: 'paint', name: 'צובעים את המשפט', icon: '🖍️', render: painted('n') },
    { id: 'tests', name: 'שלוש בדיקות', icon: '✅', render: nounTests },
    { id: 'kind', name: 'פרטי או כללי', icon: '🏷️', render: nounKind },
  ],
  a: [
    { id: 'which', name: 'איזה?', icon: '❓', render: adjWhich },
    { id: 'paint', name: 'צובעים את המשפט', icon: '🖍️', render: painted('a') },
    { id: 'without', name: 'בלי ועם', icon: '✂️', render: adjWithout },
    { id: 'match', name: 'מתאים לשם העצם', icon: '⚖️', render: (s) => adjMatch(s, s.forms) },
  ],
  v: [
    { id: 'time', name: 'ציר הזמן', icon: '⏳', render: verbTime },
    { id: 'signs', name: 'סימני הזמן', icon: '🔍', render: verbSigns },
    { id: 'do', name: 'מה עושים?', icon: '🏃', render: verbDo },
    { id: 'paint', name: 'צובעים את המשפט', icon: '🖍️', render: painted('v') },
  ],
  r: [
    { id: 'arrow', name: 'חץ אחורה', icon: '🔗', render: refArrow },
    { id: 'swap', name: 'מחליפים', icon: '🔁', render: refSwap },
    { id: 'gender', name: 'זכר או נקבה, אחד או כמה', icon: '⚖️', render: refGender },
    { id: 'family', name: 'המשפחה', icon: '👪', render: refFamily },
  ],
};

export function vizPanel(container, cat, spec, startIndex = 0) {
  const list = METHODS[cat];
  let idx = startIndex % list.length;
  const draw = () => {
    const { html, caption } = list[idx].render(spec);
    container.innerHTML = `
      <div class="viz-tabs">${list.map((m, i) =>
        `<button class="viz-tab ${i === idx ? 'active' : ''}" data-i="${i}">${m.icon} ${m.name}</button>`).join('')}</div>
      <div class="viz-box hb-viz">${html}</div>
      <p class="viz-caption">${caption}</p>
      <button class="btn btn-soft viz-next">🔄 תראו לי בדרך אחרת</button>`;
  };
  container.addEventListener('click', (e) => {
    const tab = e.target.closest('.viz-tab');
    if (tab) { idx = +tab.dataset.i; draw(); }
    else if (e.target.closest('.viz-next')) { idx = (idx + 1) % list.length; draw(); }
  });
  draw();
  return { set(s) { spec = s; draw(); } };
}
