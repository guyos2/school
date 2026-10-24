// Visualizations for present-simple sentence structure: how affirmative and negative sentences are built.
import { esc } from '../ui.js';

const eq = (s) => `<span class="eq">${s}</span>`;
const isDoes = (subject) => subject.person === 'does';
const negAux = (subject) => (isDoes(subject) ? "doesn't" : "don't");
const affVerb = (subject, verb) => (isDoes(subject) ? verb.s : verb.base);

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
  return {
    html: `<p class="ps-label">חיוב (+)</p>${affHtml}<p class="ps-label">שלילה (-)</p>${negHtml}`,
    caption: isDoes(subject)
      ? `אחרי <b class="en">${esc(subject.en)}</b> (גוף שלישי יחיד) מוסיפים לפועל ${suffixOf(verb)} בחיוב, ובשלילה אומרים doesn't + פועל בסיס בלי ה-s`
      : `אחרי <b class="en">${esc(subject.en)}</b> הפועל נשאר בסיסי בחיוב, בלי s. בשלילה אומרים don't + פועל`,
  };
}

// A decision tree: which branch (do / does) does the current subject belong to.
function tree(subject, verb, obj) {
  const does = isDoes(subject);
  const branch = (active, title, affEx, negEx) => `
    <div class="ps-branch ${active ? 'active' : ''}">
      <div class="ps-branch-title en">${title}</div>
      <div class="ps-branch-rule">חיוב: ${eq(affEx)}<br>שלילה: ${eq(negEx)}</div>
    </div>`;
  return {
    html: `
      <p class="ps-tree-q">מי מבצע את הפעולה?</p>
      <div class="ps-tree-branches">
        ${branch(!does, 'I / You / We / They', `${verb.base} ${obj.en}`, `don't ${verb.base} ${obj.en}`)}
        ${branch(does, 'He / She / It', `${verb.s} ${obj.en}`, `doesn't ${verb.base} ${obj.en}`)}
      </div>`,
    caption: `הנושא <b class="en">${esc(subject.en)}</b> הוא ${does ? 'גוף שלישי יחיד (he / she / it)' : 'רבים, או I / you'}, אז פועלים לפי הענף המודגש`,
  };
}

// Affirmative vs. negative side by side, with the part that changes highlighted.
function compare(subject, verb, obj) {
  const affSentence = `${esc(subject.en)} <span class="ps-hl">${esc(affVerb(subject, verb))}</span> ${esc(obj.en)}`;
  const negSentence = `${esc(subject.en)} <span class="ps-hl">${negAux(subject)}</span> ${esc(verb.base)} ${esc(obj.en)}`;
  return {
    html: `
      <div class="ps-compare-row en"><span class="ps-compare-label">חיוב (+)</span>${eq(affSentence)}</div>
      <div class="ps-compare-row en"><span class="ps-compare-label">שלילה (-)</span>${eq(negSentence)}</div>`,
    caption: 'הצבע מסמן את מה שמשתנה בין חיוב לשלילה: בחיוב זו הסיומת של הפועל, ובשלילה זו המילה don\'t / doesn\'t',
  };
}

export const METHODS = [
  { id: 'blocks', name: 'מבנה המשפט', icon: '🧩', render: blocks },
  { id: 'tree', name: 'מי הנושא?', icon: '🌳', render: tree },
  { id: 'compare', name: 'חיוב מול שלילה', icon: '⚖️', render: compare },
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
