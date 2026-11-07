// Visualizations for am / is / are, told as the class story: Grandpa "be" splits his three fields between seven grandchildren.
// A spec: { s: the subject as written ("Dana", "the books", "I"), who: i|he|she|it|you|we|they, en?: "Dana ___ at the park.", he?: "דנה _ בפארק.", img }
import { esc } from '../ui.js';

export const PRONOUNS = {
  i: { en: 'I', he: 'אני', be: 'am' },
  he: { en: 'he', he: 'הוא', be: 'is' },
  she: { en: 'she', he: 'היא', be: 'is' },
  it: { en: 'it', he: 'זה / זו', be: 'is' },
  you: { en: 'you', he: 'אתה / את / אתם / אתן', be: 'are' },
  we: { en: 'we', he: 'אנחנו', be: 'are' },
  they: { en: 'they', he: 'הם / הן', be: 'are' },
};
export const WHO = Object.keys(PRONOUNS);
export const FIELDS = {
  am: { who: ['i'], tag: '👤 יחיד', story: 'הנכד המפונק שאוהב שקט, לבד' },
  is: { who: ['he', 'she', 'it'], tag: '👤 יחיד', story: 'אי-שי-ת: אוהבים התייחסות אישית' },
  are: { who: ['you', 'we', 'they'], tag: '👥 רבים', story: 'תמיד ביחד עם אנשים' },
};
export const beOf = (who) => PRONOUNS[who].be;

// Why a noun subject is this pronoun.
const WHY_PRONOUN = {
  i: 'זה אני',
  he: 'בן או איש אחד',
  she: 'בת או אישה אחת',
  it: 'חיה, צמח או חפץ אחד',
  you: 'מדברים אליהם',
  we: 'כולל אותי, אז אנחנו',
  they: 'יותר מאחד',
};
// A sentence for subjects that come without one; the rest fits nouns of the same group too.
const EXAMPLE = {
  i: ['happy', 'שמח'], he: ['my friend', 'החבר שלי'], she: ['at school', 'בבית הספר'], it: ['big', 'גדול'],
  you: ['tall', 'גבוה'], we: ['friends', 'חברים'], they: ['here', 'כאן'],
};

const cap = (s) => s[0].toUpperCase() + s.slice(1);
export const isPronoun = (spec) => spec.s.toLowerCase() === PRONOUNS[spec.who].en.toLowerCase();
const chip = (cls, text) => `<span class="be-chip ${cls}">${esc(text)}</span>`;
const wordChip = (be, text = be) => chip(`be-${be}`, text);
const img = (spec, who, cls = '') => (spec.img ? `<img class="be-kid ${cls}" src="${spec.img}${who}.webp" alt="${PRONOUNS[who].en}">` : '');

// The sentence split around the gap: [subject, rest] in English, [before, after] in Hebrew.
function sentenceOf(spec) {
  if (spec.en) {
    const [a, b] = spec.en.split('___');
    const [ha, hb] = (spec.he || '').split('_');
    return { subj: a.trim(), rest: b.trim(), heA: ha?.trim() ?? '', heB: hb?.trim() ?? '' };
  }
  const [rest, heRest] = EXAMPLE[spec.who];
  const subj = spec.who === 'i' ? 'I' : cap(spec.s);
  return { subj, rest: `${rest}.`, heA: isPronoun(spec) ? PRONOUNS[spec.who].he.split(' / ')[0] : null, heB: `${heRest}.` };
}
export const fullSentence = (spec) => {
  const { subj, rest } = sentenceOf(spec);
  return `${subj} ${beOf(spec.who)} ${rest}`;
};

// 1. The three fields with the grandchildren standing in them; the subject's grandchild is highlighted.
function fields(spec) {
  const be = beOf(spec.who);
  const cols = Object.entries(FIELDS).map(([f, F]) => `
    <div class="be-field be-${f} ${f === be ? 'on' : ''}">
      <div class="be-field-name en">${f.toUpperCase()}</div>
      <div class="be-field-kids">${F.who.map((w) => `<span class="be-field-kid ${w === spec.who ? 'me' : ''}">${img(spec, w)}<b class="en">${PRONOUNS[w].en}</b></span>`).join('')}</div>
      <div class="be-field-tag">${F.tag}</div>
      ${f === be ? `<div class="be-here en">${esc(spec.s)}</div>` : ''}
    </div>`).join('');
  return {
    html: `<div class="be-fields">${cols}</div>`,
    caption: `${isPronoun(spec) ? '' : `<b class="en">${esc(spec.s)} = ${PRONOUNS[spec.who].en}</b> · `}<b class="en">${PRONOUNS[spec.who].en}</b> גר בשדה ${wordChip(be, be.toUpperCase())}: ${FIELDS[be].story}`,
  };
}

// 2. Replace the subject with its pronoun, then the pronoun picks its field.
function replace(spec) {
  const p = PRONOUNS[spec.who], be = p.be;
  const steps = isPronoun(spec)
    ? [chip('be-subj', spec.s), '<span class="be-arrow">←</span>', wordChip(be)]
    : [chip('be-subj', spec.s), '<span class="be-arrow">=</span>', `<span class="be-pron">${img(spec, spec.who, 'sm')}${chip('be-subj', p.en)}</span>`, '<span class="be-arrow">←</span>', wordChip(be)];
  return {
    html: `<div class="be-chain en">${steps.join('')}</div>
      ${isPronoun(spec) ? '' : `<p class="be-note">${esc(WHY_PRONOUN[spec.who])}, אז במקום <b class="en">${esc(spec.s)}</b> אפשר להגיד <b class="en">${p.en}</b> (${esc(p.he)})</p>`}`,
    caption: isPronoun(spec)
      ? `<b class="en">${esc(spec.s)}</b> הוא אחד משבעת הנכדים, והוא תמיד הולך עם ${wordChip(be)}`
      : 'כשהנושא הוא שם או כמה מילים, מחליפים אותו בנכד (he / she / it / we / they), ואז יודעים לאיזה שדה הוא הולך',
  };
}

// 3. A short decision path: I? you? one or many?
function count(spec) {
  const w = spec.who;
  const end = w === 'i' ? 0 : w === 'you' ? 1 : ['he', 'she', 'it'].includes(w) ? 2 : 3;
  const rows = [
    ['זה <b class="en">I</b> (אני)?', 'am'],
    ['זה <b class="en">you</b> (אתה, את, אתם)?', 'are'],
    ['זה <b>אחד</b>: הוא, היא, חיה או חפץ?', 'is'],
    ['אז זה <b>יותר מאחד</b> (רבים)', 'are'],
  ];
  return {
    html: `<div class="be-steps">${rows.map(([q, be], k) => `
      <div class="be-step ${k < end ? 'no' : k === end ? 'yes' : 'skip'}">
        <span class="be-step-q">${q}</span>
        <span class="be-step-a">${k < end ? 'לא ↓' : k === end ? `${k === 3 ? '' : 'כן ← '}${wordChip(be)}` : ''}</span>
      </div>`).join('')}</div>`,
    caption: w === 'you'
      ? 'יוצא מן הכלל: <b class="en">you</b> הולך תמיד ל-<b class="en">are</b>, גם כשמדברים לאחד בלבד'
      : `<b class="en">${esc(spec.s)}</b>: ${w === 'i' ? 'אני, לבד, בשדה AM' : end === 2 ? 'אחד, אז שדה IS' : 'רבים, אז שדה ARE'}`,
  };
}

// 4. The glue: subject + be + what we say about it. In Hebrew there is no word in the middle.
function glue(spec) {
  const { subj, rest } = sentenceOf(spec);
  const be = beOf(spec.who);
  return {
    html: `
      <div class="be-glue en">
        <span class="be-part">${chip('be-subj', subj)}<small>על מי מדברים?</small></span>
        <span class="be-plus">+</span>
        <span class="be-part">${wordChip(be)}<small>הדבק</small></span>
        <span class="be-plus">+</span>
        <span class="be-part">${chip('be-rest', rest.replace(/\.$/, ''))}<small>מה אומרים עליו?</small></span>
      </div>
      <p class="be-wrong en">${esc(subj)} ${esc(rest)} ❌</p>`,
    caption: 'בעברית אין מילה באמצע, אבל באנגלית חייבים את סבא be. הוא ה״דבק״ שמחבר בין מי שמדברים עליו לבין מה שאומרים עליו',
  };
}

// 5. Find the hole: the Hebrew sentence has an empty spot exactly where English needs am / is / are.
function hebrew(spec) {
  const s = sentenceOf(spec);
  const be = beOf(spec.who);
  const p = PRONOUNS[spec.who];
  const heA = s.heA ?? p.he.split(' / ')[0];
  const subjEn = s.heA === null ? cap(p.en) : s.subj;
  return {
    html: `
      ${s.heA === null ? `<p class="be-note"><b class="en">${esc(spec.s)} = ${p.en}</b> = ${esc(p.he)}</p>` : ''}
      <div class="be-he">${esc(heA)} <span class="be-hole"></span> ${esc(s.heB)}</div>
      <div class="be-down">↓</div>
      <div class="be-en en">${esc(subjEn)} ${wordChip(be)} ${esc(s.rest)}</div>`,
    caption: `איפה החור בעברית? בדיוק שם באנגלית שמים את ${wordChip(be)}`,
  };
}

export const METHODS = [
  { id: 'fields', name: 'השדות של סבא', icon: '🌾', render: fields },
  { id: 'replace', name: 'מי הנכד?', icon: '🔁', render: replace },
  { id: 'count', name: 'יחיד או רבים', icon: '👥', render: count },
  { id: 'glue', name: 'הדבק', icon: '🧩', render: glue },
  { id: 'hebrew', name: 'מצאו את החור', icon: '🕳️', render: hebrew },
];

export function vizPanel(container, spec, startIndex = 0) {
  let idx = startIndex % METHODS.length;
  const draw = () => {
    const { html, caption } = METHODS[idx].render(spec);
    container.innerHTML = `
      <div class="viz-tabs">${METHODS.map((m, i) =>
        `<button class="viz-tab ${i === idx ? 'active' : ''}" data-i="${i}">${m.icon} ${m.name}</button>`).join('')}</div>
      <div class="viz-box be-viz">${html}</div>
      <p class="viz-caption">${caption}</p>
      <button class="btn btn-soft viz-next">🔄 תראו לי בדרך אחרת</button>`;
  };
  container.addEventListener('click', (e) => {
    const tab = e.target.closest('.viz-tab');
    if (tab) { idx = +tab.dataset.i; draw(); }
    else if (e.target.closest('.viz-next')) { idx = (idx + 1) % METHODS.length; draw(); }
  });
  draw();
  return { set(s) { spec = s; draw(); } };
}
