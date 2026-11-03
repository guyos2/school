// מספרים טבעיים: number words in Hebrew, and the visualizations for place value, comparing, composing and ordering.
// Every method returns { html, caption }; vizPanel(container, spec) shows the methods for spec.kind with tabs.
// spec kinds: number { n, hl? }, compare { a, b }, missing { a, rel, b } (one side holds '_'), compose { parts: [[count, place]] },
// digits { digits, goal: 'max'|'min' }, order { list }.

const eq = (s) => `<span class="eq">${s}</span>`;
const eqw = (s) => `<span class="eq nu-wrap">${s}</span>`; // a long LTR chain that may wrap
const svg = (w, h, body) =>
  `<svg viewBox="0 0 ${w} ${h}" class="viz-svg" style="direction:ltr" role="img" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;

export const PLACES = ['אחדות', 'עשרות', 'מאות', 'אלפים', 'עשרות אלפים', 'מאות אלפים', 'מיליונים'];
export const PCOLOR = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#ef4444'];
const CLASS_NAME = ['יחידות', 'אלפים', 'מיליונים'];

// 1234567 → "1,234,567"; works on digit strings with '_' too.
export function fmt(n) {
  const s = String(n);
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (i && (s.length - i) % 3 === 0) out += ',';
    out += s[i];
  }
  return out;
}
// A number string with '_' shows the blank as a box.
export const fmtBlank = (s) => fmt(s).replace('_', '<span class="nu-blank">?</span>');
const placeValue = (p) => 10 ** p;

// ---------- Hebrew number words ----------
const F_UNITS = ['', 'אחת', 'שתיים', 'שלוש', 'ארבע', 'חמש', 'שש', 'שבע', 'שמונה', 'תשע'];
const M_UNITS = ['', 'אחד', 'שניים', 'שלושה', 'ארבעה', 'חמישה', 'שישה', 'שבעה', 'שמונה', 'תשעה'];
const F_TEENS = ['עשר', 'אחת עשרה', 'שתים עשרה', 'שלוש עשרה', 'ארבע עשרה', 'חמש עשרה', 'שש עשרה', 'שבע עשרה', 'שמונה עשרה', 'תשע עשרה'];
const M_TEENS = ['עשרה', 'אחד עשר', 'שנים עשר', 'שלושה עשר', 'ארבעה עשר', 'חמישה עשר', 'שישה עשר', 'שבעה עשר', 'שמונה עשר', 'תשעה עשר'];
const TENS = ['', '', 'עשרים', 'שלושים', 'ארבעים', 'חמישים', 'שישים', 'שבעים', 'שמונים', 'תשעים'];
const HUNDREDS = ['', 'מאה', 'מאתיים', 'שלוש מאות', 'ארבע מאות', 'חמש מאות', 'שש מאות', 'שבע מאות', 'שמונה מאות', 'תשע מאות'];
const SMALL_THOUSANDS = ['', 'אלף', 'אלפיים', 'שלושת אלפים', 'ארבעת אלפים', 'חמשת אלפים', 'ששת אלפים', 'שבעת אלפים', 'שמונת אלפים', 'תשעת אלפים', 'עשרת אלפים'];

// The parts of 1–999: hundreds, then tens / teens, then units. Counting is feminine; thousands and millions are counted in masculine.
function elems(n, masc) {
  const out = [];
  const h = Math.floor(n / 100), r = n % 100;
  if (h) out.push(HUNDREDS[h]);
  if (r >= 10 && r < 20) out.push((masc ? M_TEENS : F_TEENS)[r - 10]);
  else {
    if (r >= 20) out.push(TENS[Math.floor(r / 10)]);
    if (r % 10) out.push((masc ? M_UNITS : F_UNITS)[r % 10]);
  }
  return out;
}
// "ו" comes before the last part inside a group, and before a one-part group when it ends the number.
function joinParts(parts, vav) {
  if (parts.length > 1) return `${parts.slice(0, -1).join(' ')} ו${parts.at(-1)}`;
  return (vav ? 'ו' : '') + parts[0];
}

// Words for 1 – 9,999,999, split into groups (millions, thousands, units) as they are read.
export function numberWords(n) {
  const m = Math.floor(n / 1e6), k = Math.floor(n / 1000) % 1000, u = n % 1000;
  const groups = [];
  if (m) groups.push({ cls: 2, n: m, parts: [m === 1 ? 'מיליון' : `${m === 2 ? 'שני' : M_UNITS[m]} מיליון`] });
  if (k) groups.push({ cls: 1, n: k, parts: k <= 10 ? [SMALL_THOUSANDS[k]] : elems(k, true), suffix: k > 10 ? ' אלף' : '' });
  if (u) groups.push({ cls: 0, n: u, parts: elems(u, false) });
  groups.forEach((g, i) => {
    g.text = joinParts(g.parts, i > 0 && i === groups.length - 1 && g.parts.length === 1) + (g.suffix || '');
  });
  return { groups, text: groups.map((g) => g.text).join(' ') };
}
export const words = (n) => numberWords(n).text;

// ---------- the place-value table ----------
// rows: [{ s: digit string (may hold '_'), label? }]; marks: { 'row:place': css class }
function pvTable(rows, { hl = -1, marks = {}, width = 0 } = {}) {
  const W = Math.max(3, width, ...rows.map((r) => r.s.length));
  const places = Array.from({ length: W }, (_, i) => W - 1 - i);
  const classes = [];
  for (const p of places) {
    const c = Math.min(2, Math.floor(p / 3));
    if (classes.at(-1)?.c === c) classes.at(-1).span++; else classes.push({ c, span: 1 });
  }
  const anyLabel = rows.some((r) => r.label);
  const head1 = classes.map(({ c, span }) => `<th colspan="${span}" class="nu-cls">${CLASS_NAME[c]}</th>`).join('');
  const head2 = places.map((p) => `<th class="nu-ph ${p === hl ? 'nu-hl' : ''}" style="--c:${PCOLOR[p]}">${PLACES[p]}</th>`).join('');
  const body = rows.map((r, ri) => {
    const cells = places.map((p) => {
      const ch = r.s[r.s.length - 1 - p];
      const cls = [marks[`${ri}:${p}`] || '', p === hl ? 'nu-hl' : '', p % 3 === 0 && p ? 'nu-sep' : ''].join(' ');
      const shown = ch === undefined ? '' : ch === '_' ? '<span class="nu-blank">?</span>' : ch;
      return `<td class="${cls}" style="--c:${PCOLOR[p]}">${shown}</td>`;
    }).join('');
    return `<tr class="${r.cls || ''}">${anyLabel ? `<td class="nu-rl">${r.label || ''}</td>` : ''}${cells}</tr>`;
  }).join('');
  const pad = anyLabel ? '<th></th>' : '';
  return `<div class="table-scroll"><table class="nu-pv"><tr>${pad}${head1}</tr><tr>${pad}${head2}</tr>${body}</table></div>`;
}

const digitsOf = (s) => String(s).split('').reverse(); // place 0 first

// The terms of the expanded form, biggest first: [[place, digit]]
const terms = (n) => digitsOf(n).map((d, p) => [p, +d]).filter(([, d]) => d).reverse();
const termChip = (p, d, extra = '') =>
  `<span class="nu-term ${extra}" style="--c:${PCOLOR[p]}"><b>${fmt(d * placeValue(p))}</b><small>${d} ${PLACES[p]}</small></span>`;

// ---------- number ----------
function nTable({ n, hl = -1 }) {
  const s = String(n);
  return {
    html: pvTable([{ s }], { hl }),
    caption: hl >= 0
      ? `בעמודת ה${PLACES[hl]} יושבת הספרה ${eq(s[s.length - 1 - hl] ?? 0)}. סופרים עמודות מימין: אחדות, עשרות, מאות, אלפים...`
      : 'כל ספרה יושבת בעמודה שלה. כל שלוש עמודות הן מחלקה: יחידות, אלפים, מיליונים.',
  };
}

function nExpanded({ n, hl = -1 }) {
  const t = terms(n);
  const zeros = digitsOf(n).map((d, p) => [p, d]).filter(([, d]) => d === '0').map(([p]) => PLACES[p]);
  return {
    html: `<div class="nu-exp ltr">${t.map(([p, d], i) => `${i ? '<span class="nu-plus">+</span>' : ''}${termChip(p, d, p === hl ? 'nu-hl' : '')}`).join('')}</div>`,
    caption: `${eqw(`${t.map(([p, d]) => fmt(d * placeValue(p))).join(' + ')} = ${fmt(n)}`)}${zeros.length
      ? `<br>אין ${zeros.join(', ')}, ולכן שם כותבים <b>0</b>. ה-0 שומר על המקום.` : ''}`,
  };
}

function nGroups({ n }) {
  const s = String(n);
  const { groups, text } = numberWords(n);
  const chunks = [];
  for (let end = s.length; end > 0; end -= 3) chunks.unshift({ d: s.slice(Math.max(0, end - 3), end), cls: chunks.length });
  chunks.forEach((c, i) => { c.cls = chunks.length - 1 - i; });
  const box = (c) => {
    const g = groups.find((x) => x.cls === c.cls);
    return `<div class="nu-g" style="--c:${PCOLOR[c.cls * 3]}"><span class="nu-g-d">${c.d}</span>
      <span class="nu-g-name">${CLASS_NAME[c.cls]}</span><span class="nu-g-w">${g ? g.text : 'כלום, לא קוראים'}</span></div>`;
  };
  return {
    html: `<div class="nu-groups ltr">${chunks.map(box).join('')}</div>`,
    caption: `מחלקים לשלשות מימין, וקוראים כל שלשה עם שם המחלקה שלה:<br><b>${text}</b>`,
  };
}

function nDisks({ n }) {
  const d = digitsOf(n).map(Number);
  const W = d.length, colW = 88, r = 11, H = 150;
  let body = '';
  for (let i = 0; i < W; i++) {
    const p = W - 1 - i, x0 = i * colW, c = PCOLOR[p];
    body += `<rect x="${x0 + 3}" y="2" width="${colW - 6}" height="${H - 4}" rx="10" fill="${c}" fill-opacity=".08" stroke="${c}" stroke-width="2"/>`;
    body += `<text x="${x0 + colW / 2}" y="22" font-size="14" font-weight="700" fill="${c}" text-anchor="middle">${fmt(placeValue(p))}</text>`;
    for (let k = 0; k < d[p]; k++) {
      const cx = x0 + colW / 2 + ((k % 3) - 1) * (2 * r + 4), cy = 48 + Math.floor(k / 3) * (2 * r + 6);
      body += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${c}"/>`;
    }
    body += `<text x="${x0 + colW / 2}" y="${H - 12}" class="viz-num" text-anchor="middle">${d[p]}</text>`;
  }
  return {
    html: svg(W * colW, H, body),
    caption: `בכל עמודה סופרים אסימונים: כמה ${terms(n).map(([p, x]) => `${x} של ${fmt(placeValue(p))}`).join(', ')}. עמודה ריקה = 0.`,
  };
}

// ---------- compare ----------
const relOf = (a, b) => (a < b ? '<' : a > b ? '>' : '=');
const firstDiff = (a, b) => {
  const s = String(a), t = String(b);
  if (s.length !== t.length) return -1;
  for (let i = 0; i < s.length; i++) if (s[i] !== t[i]) return s.length - 1 - i;
  return null;
};

function cAlign({ a, b }) {
  const p = firstDiff(a, b);
  const marks = {};
  if (p != null && p >= 0) { marks[`0:${p}`] = 'nu-diff'; marks[`1:${p}`] = 'nu-diff'; }
  const sa = String(a), sb = String(b);
  let caption;
  if (p === -1) caption = `ל-${eq(fmt(a))} יש ${sa.length} ספרות, ול-${eq(fmt(b))} יש ${sb.length}. למספר עם יותר ספרות יש ערך גדול יותר.`;
  else if (p === null) caption = 'כל הספרות זהות, אז המספרים שווים.';
  else caption = `משווים משמאל, עמודה אחרי עמודה. ההבדל הראשון בעמודת ה${PLACES[p]}: ${eq(`${sa[sa.length - 1 - p]} ${relOf(+sa[sa.length - 1 - p], +sb[sb.length - 1 - p])} ${sb[sb.length - 1 - p]}`)}`;
  return {
    html: pvTable([{ s: sa, label: 'א' }, { s: sb, label: 'ב' }], { marks }),
    caption: `${caption}<br>${eq(`${fmt(a)} ${relOf(a, b)} ${fmt(b)}`)}`,
  };
}

// A number line from lo to hi with labelled points; values: [{ v, label, color }]
function numberLine(values, { band } = {}) {
  const all = values.map((x) => x.v).concat(band || []);
  const min = Math.min(...all), max = Math.max(...all);
  let step = 10 ** Math.floor(Math.log10(Math.max(1, max - min)));
  let lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
  if (hi === lo) hi += step;
  if ((hi - lo) / step <= 2) { step /= 2; lo = Math.floor(min / step) * step; hi = Math.ceil(max / step) * step; if (hi === lo) hi += step; }
  const W = 640, x0 = 40, x1 = 600, y = 110;
  const sx = (v) => x0 + ((v - lo) / (hi - lo)) * (x1 - x0);
  let body = `<line x1="${x0 - 10}" y1="${y}" x2="${x1 + 14}" y2="${y}" stroke="currentColor" stroke-width="3"/>`;
  body += `<path d="M ${x1 + 14} ${y - 7} L ${x1 + 26} ${y} L ${x1 + 14} ${y + 7} Z" fill="currentColor"/>`;
  const ticks = Math.round((hi - lo) / step);
  for (let i = 0; i <= ticks; i++) {
    const v = lo + i * step;
    body += `<line x1="${sx(v)}" y1="${y - 7}" x2="${sx(v)}" y2="${y + 7}" stroke="currentColor" stroke-width="2"/>`;
    if (i === 0 || i === ticks || ticks <= 4) body += `<text x="${sx(v)}" y="${y + 28}" font-size="14" fill="currentColor" text-anchor="middle">${fmt(v)}</text>`;
  }
  if (band) body += `<rect x="${sx(band[0])}" y="${y - 9}" width="${Math.max(6, sx(band[1]) - sx(band[0]))}" height="18" rx="6" fill="#fde047" fill-opacity=".8" stroke="#ca8a04"/>`;
  values.forEach(({ v, label, color }, i) => {
    const up = i % 2 === 0, ty = up ? y - 40 - (i % 4 === 2 ? 22 : 0) : y + 52 + (i % 4 === 3 ? 22 : 0);
    body += `<circle cx="${sx(v)}" cy="${y}" r="8" fill="${color}"/>`;
    body += `<line x1="${sx(v)}" y1="${y}" x2="${sx(v)}" y2="${up ? ty + 6 : ty - 18}" stroke="${color}" stroke-width="2" stroke-dasharray="3 3"/>`;
    body += `<text x="${Math.min(W - 40, Math.max(40, sx(v)))}" y="${ty}" font-size="17" font-weight="800" fill="${color}" text-anchor="middle">${label}</text>`;
  });
  return svg(W, 200, body);
}

function cLine({ a, b }) {
  return {
    html: numberLine([{ v: a, label: fmt(a), color: PCOLOR[4] }, { v: b, label: fmt(b), color: PCOLOR[1] }]),
    caption: a === b ? 'שתי הנקודות באותו מקום: המספרים שווים.'
      : `על ציר המספרים, מספר שנמצא <b>ימינה יותר</b> גדול יותר. ${eq(fmt(Math.max(a, b)))} ימינה יותר.<br>${eq(`${fmt(a)} ${relOf(a, b)} ${fmt(b)}`)}`,
  };
}

function cExpanded({ a, b }) {
  const ta = terms(a), tb = terms(b);
  const same = (t, other) => other.some(([p, d]) => p === t[0] && d === t[1]);
  const row = (t, other) => `<div class="nu-exp ltr">${t.map(([p, d], i) =>
    `${i ? '<span class="nu-plus">+</span>' : ''}${termChip(p, d, same([p, d], other) ? 'nu-dim' : 'nu-hl')}`).join('')}</div>`;
  return {
    html: `${row(ta, tb)}<div class="nu-vs">${eq(relOf(a, b))}</div>${row(tb, ta)}`,
    caption: 'מפרקים את שני המספרים. החלקים האפורים שווים בשניהם, אז משווים רק את החלקים הצבעוניים, מהגדול לקטן.',
  };
}

// ---------- missing digit ----------
export function missingFits({ a, rel, b }) {
  const out = [];
  for (let d = 0; d <= 9; d++) {
    const A = String(a).replace('_', d), B = String(b).replace('_', d);
    if (A[0] === '0' || B[0] === '0') continue;
    if (relOf(+A, +B) === rel) out.push(d);
  }
  return out;
}

function mTry(spec) {
  const fits = missingFits(spec);
  const rows = [];
  for (let d = 0; d <= 9; d++) {
    const A = String(spec.a).replace('_', d), B = String(spec.b).replace('_', d);
    if (A[0] === '0' || B[0] === '0') continue;
    const ok = fits.includes(d);
    rows.push(`<div class="nu-try ${ok ? 'ok' : 'no'}"><span class="ltr">${fmt(A)} ${spec.rel} ${fmt(B)}</span><span>${ok ? '✔' : '✘'}</span></div>`);
  }
  return {
    html: `<div class="nu-tries">${rows.join('')}</div>`,
    caption: `מנסים כל ספרה במקום ה-?. מתאימות: ${eq(fits.join(', '))}`,
  };
}

function mAlign(spec) {
  const sa = String(spec.a), sb = String(spec.b);
  const blankIn = sa.includes('_') ? sa : sb, other = sa.includes('_') ? sb : sa;
  const bp = blankIn.length - 1 - blankIn.indexOf('_');
  const marks = { [`0:${bp}`]: 'nu-diff', [`1:${bp}`]: 'nu-diff' };
  const fits = missingFits(spec);
  const od = other[other.length - 1 - bp];
  let before = true;
  for (let p = blankIn.length - 1; p > bp; p--) if (blankIn[blankIn.length - 1 - p] !== other[other.length - 1 - p]) before = false;
  const caption = blankIn.length !== other.length
    ? 'למספרים יש מספר שונה של ספרות, אז כבר מספר הספרות מחליט.'
    : before
      ? `כל הספרות משמאל ל-? שוות. לכן ה-? נבדק מול ה-${eq(od)} שמתחתיו: אם ? שונה מ-${eq(od)}, הוא מחליט מי גדול. אם ? = ${eq(od)}, ממשיכים לספרות שמימין.`
      : 'יש הבדל עוד לפני ה-?, משמאל, ולכן הוא כבר מחליט. ה-? יכול להיות כל ספרה.';
  return {
    html: pvTable([{ s: sa, label: 'א' }, { s: sb, label: 'ב' }], { marks }),
    caption: `${caption}<br>ספרות שמתאימות: ${eq(fits.join(', '))}`,
  };
}

function mLine(spec) {
  const sa = String(spec.a), sb = String(spec.b);
  const blankIn = sa.includes('_') ? sa : sb, other = +(sa.includes('_') ? sb : sa);
  const lo = +blankIn.replace('_', blankIn[0] === '_' ? 1 : 0), hi = +blankIn.replace('_', 9);
  return {
    html: numberLine([{ v: other, label: fmt(other), color: PCOLOR[1] }, { v: lo, label: fmt(String(lo)), color: PCOLOR[4] }, { v: hi, label: fmt(String(hi)), color: PCOLOR[4] }], { band: [lo, hi] }),
    caption: `המספר עם ה-? יכול להיות כל מספר בפס הצהוב, מ-${eq(fmt(String(lo)))} עד ${eq(fmt(String(hi)))}. בודקים איפה הוא ביחס ל-${eq(fmt(other))}.`,
  };
}

// ---------- compose: "54 עשרות ו-2 יחידות" ----------
export const composeValue = (parts) => parts.reduce((s, [c, p]) => s + c * placeValue(p), 0);
export const composeText = (parts) => parts.map(([c, p], i) => `${i ? 'ו-' : ''}${c} ${PLACES[p] === 'אחדות' ? 'יחידות' : PLACES[p]}`).join(' ');

function kMoney({ parts }) {
  const rows = parts.map(([c, p]) => {
    const v = placeValue(p);
    const chips = Array.from({ length: c }, () => `<span class="nu-chip" style="--c:${PCOLOR[p]}">${fmt(v)}</span>`);
    const groups = [];
    for (let i = 0; i < chips.length; i += 10) {
      const g = chips.slice(i, i + 10).join('');
      groups.push(i + 10 <= chips.length && c >= 10 ? `<span class="nu-ten" title="${fmt(10 * v)}">${g}<small>= ${fmt(10 * v)}</small></span>` : `<span class="nu-loose">${g}</span>`);
    }
    return `<div class="nu-money"><div class="nu-money-h">${c} של ${fmt(v)} ₪ = <b class="ltr">${fmt(c * v)} ₪</b></div><div class="nu-chips ltr">${groups.join('')}</div></div>`;
  });
  return {
    html: rows.join(''),
    caption: `כמו כסף: ${parts.map(([c, p]) => `${c} ${p ? `שטרות של ${fmt(placeValue(p))}` : 'מטבעות של 1'}`).join(' ועוד ')}. כל 10 שטרות מתחלפים בשטר אחד גדול פי 10.<br>ביחד: ${eq(`${fmt(composeValue(parts))} ₪`)}`,
  };
}

function kColumn({ parts }) {
  const total = composeValue(parts);
  const rows = parts.map(([c, p]) => ({ s: String(c * placeValue(p)), label: `${c} ${PLACES[p]}` }));
  rows.push({ s: String(total), label: 'ביחד', cls: 'nu-sum' });
  return {
    html: pvTable(rows, { width: String(total).length }),
    caption: `${parts.map(([c, p]) => `${eq(c)} ${PLACES[p]}: הספרה האחרונה של ${eq(c)} נכנסת לעמודת ה${PLACES[p]}`).join('<br>')}<br>ואז מחברים: ${eqw(`${parts.map(([c, p]) => fmt(c * placeValue(p))).join(' + ')} = ${fmt(total)}`)}`,
  };
}

function kCalc({ parts }) {
  const total = composeValue(parts);
  const lines = parts.map(([c, p]) => eq(`${c} × ${fmt(placeValue(p))} = ${fmt(c * placeValue(p))}`));
  const zeroNote = String(total).includes('0') ? '<br>שימו לב ל-0: הוא שומר מקום של עמודה ריקה.' : '';
  return {
    html: `<div class="nu-lines">${lines.map((l) => `<div>${l}</div>`).join('')}<div class="nu-total">${eq(`${parts.map(([c, p]) => fmt(c * placeValue(p))).join(' + ')} = ${fmt(total)}`)}</div></div>`,
    caption: `עשרות = כפול 10 (מוסיפים 0), מאות = כפול 100 (מוסיפים 00), אלפים = כפול 1,000.${zeroNote}`,
  };
}

// ---------- digits: biggest / smallest ----------
export function digitsAnswer(digits, goal) {
  const s = [...digits].sort((x, y) => (goal === 'max' ? y - x : x - y));
  if (goal === 'min' && s[0] === 0) {
    const i = s.findIndex((d) => d !== 0);
    [s[0], s[i]] = [s[i], s[0]];
  }
  return +s.join('');
}

function dCards({ digits, goal }) {
  const ans = String(digitsAnswer(digits, goal));
  const n = ans.length;
  const cards = ans.split('').map((d, i) => `<span class="nu-card" style="--c:${PCOLOR[n - 1 - i]}"><b>${d}</b><small>${PLACES[n - 1 - i]}</small></span>`).join('');
  const zero = goal === 'min' && digits.includes(0);
  return {
    html: `<div class="nu-cards ltr">${cards}</div>`,
    caption: goal === 'max'
      ? 'למספר הכי גדול: הספרה הכי גדולה הולכת לעמודה הכי גדולה (משמאל), ואחריה הספרות מהגדולה לקטנה.'
      : `למספר הכי קטן: הספרות מהקטנה לגדולה, משמאל לימין.${zero ? ' אבל 0 לא יכול לפתוח מספר! לכן מתחילים בספרה הכי קטנה שאינה 0, ומיד אחריה ה-0.' : ''}`,
  };
}

function dTable({ digits, goal }) {
  const ans = digitsAnswer(digits, goal);
  return {
    html: pvTable([{ s: String(ans) }]),
    caption: `${eq(fmt(ans))}: הספרה בעמודה השמאלית שווה הכי הרבה (${eq(fmt(String(ans)[0] * placeValue(String(ans).length - 1)))}), ולכן היא זו שקובעת ${goal === 'max' ? 'כמה גדול' : 'כמה קטן'} המספר.`,
  };
}

function dSwap({ digits, goal }) {
  const ans = String(digitsAnswer(digits, goal));
  let alt;
  if (goal === 'min' && digits.includes(0)) alt = [...digits].sort((x, y) => x - y).join('');
  else {
    const i = ans.split('').findIndex((d, k) => k < ans.length - 1 && d !== ans[k + 1]);
    alt = i < 0 ? ans : ans.slice(0, i) + ans[i + 1] + ans[i] + ans.slice(i + 2);
  }
  const zeroLead = alt[0] === '0';
  return {
    html: `<div class="nu-lines"><div class="nu-total">${eq(fmt(ans))} ✔</div><div class="nu-alt">${eq(zeroLead ? alt : fmt(alt))} ✘</div></div>`,
    caption: zeroLead
      ? `${eq(alt)} מתחיל ב-0, ולכן הוא בכלל לא מספר בן ${ans.length} ספרות (קוראים אותו ${eq(fmt(+alt))}).`
      : `אם מחליפים שתי ספרות, מקבלים ${eq(fmt(alt))}, וזה ${goal === 'max' ? 'קטן' : 'גדול'} יותר. ${eq(`${fmt(ans)} ${relOf(+ans, +alt)} ${fmt(alt)}`)}`,
  };
}

// ---------- order ----------
function oLine({ list }) {
  const s = [...list].sort((x, y) => x - y);
  return {
    html: numberLine(s.map((v, i) => ({ v, label: fmt(v), color: PCOLOR[i % PCOLOR.length] }))),
    caption: `על הציר, משמאל לימין = מהקטן לגדול:<br>${eqw(s.map(fmt).join(' &lt; '))}`,
  };
}

function oAlign({ list }) {
  const s = [...list].sort((x, y) => x - y);
  const marks = {};
  s.forEach((v, i) => { if (i) { const p = firstDiff(s[i - 1], v); if (p != null && p >= 0) marks[`${i}:${p}`] = 'nu-diff'; } });
  return {
    html: pvTable(s.map((v, i) => ({ s: String(v), label: i + 1 })), { marks }),
    caption: 'כותבים את המספרים מהקטן לגדול, זה מתחת לזה, ומשווים משמאל. הספרה המסומנת היא המקום הראשון שבו המספר גדול מזה שמעליו.',
  };
}

function oPairs({ list }) {
  const s = [...list].sort((x, y) => x - y);
  const lines = s.slice(1).map((v, i) => {
    const u = s[i], p = firstDiff(u, v);
    const why = p === -1 ? `ל-${eq(fmt(v))} יש יותר ספרות` : p === null ? 'שווים' : `בעמודת ה${PLACES[p]}: ${eq(`${String(u)[String(u).length - 1 - p]} < ${String(v)[String(v).length - 1 - p]}`)}`;
    return `<div>${eq(`${fmt(u)} < ${fmt(v)}`)} <small class="muted">${why}</small></div>`;
  });
  return { html: `<div class="nu-lines">${lines.join('')}</div>`, caption: 'בודקים כל זוג שכנים: מי קטן יותר, ולמה.' };
}

export const METHODS = {
  number: [
    { name: 'טבלת ערך המקום', icon: '🗂️', render: nTable },
    { name: 'פירוק', icon: '🧩', render: nExpanded },
    { name: 'קוראים בשלשות', icon: '🗣️', render: nGroups },
    { name: 'אסימונים', icon: '🪙', render: nDisks },
  ],
  compare: [
    { name: 'עמודה מול עמודה', icon: '🗂️', render: cAlign },
    { name: 'ציר המספרים', icon: '📏', render: cLine },
    { name: 'פירוק', icon: '🧩', render: cExpanded },
  ],
  missing: [
    { name: 'מנסים כל ספרה', icon: '🔎', render: mTry },
    { name: 'עמודה מול עמודה', icon: '🗂️', render: mAlign },
    { name: 'ציר המספרים', icon: '📏', render: mLine },
  ],
  compose: [
    { name: 'כסף', icon: '💰', render: kMoney },
    { name: 'טבלת ערך המקום', icon: '🗂️', render: kColumn },
    { name: 'חשבון', icon: '✖️', render: kCalc },
  ],
  digits: [
    { name: 'כרטיסי ספרות', icon: '🃏', render: dCards },
    { name: 'טבלת ערך המקום', icon: '🗂️', render: dTable },
    { name: 'מה אם מחליפים?', icon: '🔁', render: dSwap },
  ],
  order: [
    { name: 'ציר המספרים', icon: '📏', render: oLine },
    { name: 'זה מתחת לזה', icon: '🗂️', render: oAlign },
    { name: 'זוג אחרי זוג', icon: '👫', render: oPairs },
  ],
};

export function vizPanel(container, spec, startIndex = 0) {
  const methods = METHODS[spec.kind];
  let idx = startIndex % methods.length;
  const draw = () => {
    const { html, caption } = methods[idx].render(spec);
    container.innerHTML = `
      <div class="viz-tabs">${methods.map((m, i) =>
        `<button class="viz-tab ${i === idx ? 'active' : ''}" data-i="${i}">${m.icon} ${m.name}</button>`).join('')}</div>
      <div class="viz-box">${html}</div>
      <p class="viz-caption">${caption}</p>
      <button class="btn btn-soft viz-next">🔄 תראו לי בדרך אחרת</button>`;
  };
  container.addEventListener('click', (e) => {
    const tab = e.target.closest('.viz-tab');
    if (tab) { idx = +tab.dataset.i; draw(); }
    else if (e.target.closest('.viz-next')) { idx = (idx + 1) % methods.length; draw(); }
  });
  draw();
  return { set(s) { spec = s; draw(); } };
}
