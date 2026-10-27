// Visualizations for present-simple sentence structure: how affirmative, negative and question sentences are built.
import { esc } from '../ui.js';

const eq = (s) => `<span class="eq">${s}</span>`;
const isDoes = (subject) => subject.person === 'does';
const negAux = (subject) => (isDoes(subject) ? "doesn't" : "don't");
const qAux = (subject) => (isDoes(subject) ? 'Does' : 'Do');
const affVerb = (subject, verb) => (isDoes(subject) ? verb.s : verb.base);
// Inside a question the subject is no longer first: "My sister" -> "my sister", but "I" stays.
export const inQuestion = (subject) => (subject.en === 'I' ? 'I' : subject.en[0].toLowerCase() + subject.en.slice(1));
export const yesNo = (subject, verb, obj) => `${qAux(subject)} ${inQuestion(subject)} ${verb.base} ${obj.en}?`;
export const whQuestion = (subject, verb, obj) => `${obj.wh} ${qAux(subject).toLowerCase()} ${inQuestion(subject)} ${verb.base}?`;
export const shortAnswer = (subject, yes) =>
  yes ? `Yes, ${subject.pronoun} ${isDoes(subject) ? 'does' : 'do'}.` : `No, ${subject.pronoun} ${negAux(subject)}.`;

function suffixOf(verb) {
  if (verb.s === `${verb.base}s`) return '-s';
  if (verb.s === `${verb.base}es`) return '-es';
  if (verb.base.endsWith('y') && verb.s === `${verb.base.slice(0, -1)}ies`) return '-ies (במקום ה-y)';
  return 'צורה מיוחדת';
}

// Colored chips laid out as the sentence is built, for affirmative and negative.
function blocks(subject, verb, obj) {
  const row = (parts) => `<div class="ps-row en">${parts.join('')}</div>`;
  const chip = (cls, text) => `<span class="ps-chip ${cls}">${esc(text)}</span>`;
  const affHtml = row([chip('ps-subj', subject.en), chip('ps-verb', affVerb(subject, verb)), chip('ps-obj', obj.en)]);
  const negHtml = row([chip('ps-subj', subject.en), chip('ps-aux', negAux(subject)), chip('ps-verb', verb.base), chip('ps-obj', obj.en)]);
  const qHtml = row([chip('ps-q', qAux(subject)), chip('ps-subj', inQuestion(subject)), chip('ps-verb', verb.base), chip('ps-obj', `${obj.en} ?`)]);
  return {
    html: `<p class="ps-label">חיוב (+)</p>${affHtml}<p class="ps-label">שלילה (-)</p>${negHtml}<p class="ps-label">שאלה (?)</p>${qHtml}`,
    caption: isDoes(subject)
      ? `אחרי <b class="en">${esc(subject.en)}</b> (גוף שלישי יחיד) מוסיפים לפועל ${suffixOf(verb)} בחיוב. בשלילה ובשאלה ה-s עוברת ל-does, והפועל חוזר לבסיס`
      : `אחרי <b class="en">${esc(subject.en)}</b> הפועל נשאר בסיסי בחיוב, בלי s. בשלילה אומרים don't + פועל, ובשאלה מתחילים ב-Do`,
  };
}

// A decision tree: which branch (do / does) does the current subject belong to.
function tree(subject, verb, obj) {
  const does = isDoes(subject);
  const branch = (active, title, affEx, negEx, qEx) => `
    <div class="ps-branch ${active ? 'active' : ''}">
      <div class="ps-branch-title en">${title}</div>
      <div class="ps-branch-rule">חיוב: ${eq(affEx)}<br>שלילה: ${eq(negEx)}<br>שאלה: ${eq(qEx)}</div>
    </div>`;
  return {
    html: `
      <p class="ps-tree-q">מי מבצע את הפעולה?</p>
      <div class="ps-tree-branches">
        ${branch(!does, 'I / You / We / They', `${verb.base} ${obj.en}`, `don't ${verb.base} ${obj.en}`, `Do ... ${verb.base} ${obj.en}?`)}
        ${branch(does, 'He / She / It', `${verb.s} ${obj.en}`, `doesn't ${verb.base} ${obj.en}`, `Does ... ${verb.base} ${obj.en}?`)}
      </div>`,
    caption: `הנושא <b class="en">${esc(subject.en)}</b> הוא ${does ? 'גוף שלישי יחיד (he / she / it)' : 'רבים, או I / you'}, אז פועלים לפי הענף המודגש`,
  };
}

// Affirmative vs. negative side by side, with the part that changes highlighted.
function compare(subject, verb, obj) {
  const affSentence = `${esc(subject.en)} <span class="ps-hl">${esc(affVerb(subject, verb))}</span> ${esc(obj.en)}`;
  const negSentence = `${esc(subject.en)} <span class="ps-hl">${negAux(subject)}</span> ${esc(verb.base)} ${esc(obj.en)}`;
  const qSentence = `<span class="ps-hl">${qAux(subject)}</span> ${esc(inQuestion(subject))} ${esc(verb.base)} ${esc(obj.en)}?`;
  return {
    html: `
      <div class="ps-compare-row en"><span class="ps-compare-label">חיוב (+)</span>${eq(affSentence)}</div>
      <div class="ps-compare-row en"><span class="ps-compare-label">שלילה (-)</span>${eq(negSentence)}</div>
      <div class="ps-compare-row en"><span class="ps-compare-label">שאלה (?)</span>${eq(qSentence)}</div>`,
    caption: 'הצבע מסמן את מה שמשתנה: בחיוב זו הסיומת של הפועל, בשלילה don\'t / doesn\'t, ובשאלה Do / Does שעוברת להתחלה',
  };
}

// A question and its two short answers, plus the wh-question version.
function qa(subject, verb, obj) {
  const line = (label, text, cls = '') => `<div class="ps-compare-row en"><span class="ps-compare-label">${label}</span><span class="eq ${cls}">${esc(text)}</span></div>`;
  return {
    html: `
      ${line('שאלה', yesNo(subject, verb, obj))}
      ${line('👍 כן', shortAnswer(subject, true), 'ps-yes')}
      ${line('👎 לא', shortAnswer(subject, false), 'ps-no')}
      <hr class="ps-sep">
      ${line(`${esc(obj.whHe)}?`, whQuestion(subject, verb, obj))}`,
    caption: `בתשובה קצרה חוזרים על אותה מילת עזר מהשאלה (${qAux(subject).toLowerCase()} / ${negAux(subject)}), בלי הפועל. במילת שאלה (${esc(obj.wh)}) הסדר הוא: מילת שאלה, ${qAux(subject).toLowerCase()}, נושא, פועל`,
  };
}

export const METHODS = [
  { id: 'blocks', name: 'מבנה המשפט', icon: '🧩', render: blocks },
  { id: 'tree', name: 'מי הנושא?', icon: '🌳', render: tree },
  { id: 'compare', name: 'חיוב, שלילה ושאלה', icon: '⚖️', render: compare },
  { id: 'qa', name: 'שאלה ותשובה', icon: '❓', render: qa },
];

// A reusable "show it another way" panel, like vizPanel but for subject+verb+object.
export function psVizPanel(container, subject, verb, obj, startIndex = 0) {
  let idx = startIndex;
  const draw = () => {
    const m = METHODS[idx];
    const { html, caption } = m.render(subject, verb, obj);
    container.innerHTML = `
      <div class="viz-tabs">${METHODS.map((x, i) =>
        `<button class="viz-tab ${i === idx ? 'active' : ''}" data-i="${i}">${x.icon} ${x.name}</button>`).join('')}</div>
      <div class="viz-box">${html}</div>
      <p class="viz-caption">${caption}</p>
      <button class="btn btn-soft viz-next">🔄 תראו לי בדרך אחרת</button>`;
  };
  container.addEventListener('click', (e) => {
    const tab = e.target.closest('.viz-tab');
    if (tab) { idx = +tab.dataset.i; draw(); }
    else if (e.target.closest('.viz-next')) { idx = (idx + 1) % METHODS.length; draw(); }
  });
  draw();
  return { set(ns, nv, no) { subject = ns; verb = nv; obj = no; draw(); } };
}

// A rule card for a single test sentence: which branch (do / does) and which row (+ / - / ?) it uses.
export function ruleCard(person, form) {
  const rows = (does) => [
    ['aff', '+', does ? 'plays' : 'play'],
    ['neg', '-', `${does ? "doesn't" : "don't"} play`],
    ['q', '?', `${does ? 'Does' : 'Do'} ... play?`],
  ].map(([f, sign, ex]) => `<div class="ps-rule-row ${does === (person === 'does') && f === form ? 'ps-hl' : ''}">${sign} ${eq(ex)}</div>`).join('');
  return `
    <div class="ps-tree-branches">
      <div class="ps-branch ${person === 'do' ? 'active' : ''}"><div class="ps-branch-title en">I / You / We / They</div>${rows(false)}</div>
      <div class="ps-branch ${person === 'does' ? 'active' : ''}"><div class="ps-branch-title en">He / She / It</div>${rows(true)}</div>
    </div>`;
}
