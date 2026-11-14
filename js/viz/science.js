// Visualizations for the science unit (atom, charges, elements, periodic table, metals).
// Every concept has several views; a panel shows tabs plus "show another way".
import { esc } from '../ui.js';

export const C = { p: '#ef4444', n: '#94a3b8', e: '#3b82f6' };
export const POS = (z) => (z === 1 ? [1, 1] : z === 2 ? [1, 18] : z <= 4 ? [2, z - 2] : z <= 10 ? [2, z + 8] : z <= 12 ? [3, z - 10] : z <= 18 ? [3, z] : [4, z - 18]);
const NONMETAL = [1, 2, 6, 7, 8, 9, 10, 15, 16, 17, 18, 34, 35, 36];
const SEMI = [5, 14, 32, 33];
export const typeOf = (z) => (NONMETAL.includes(z) ? 'n' : SEMI.includes(z) ? 'x' : 'm');
const FAMILIES = { 1: ['alk', 'מתכות אלקליות', '#f59e0b'], 2: ['ear', 'מתכות אדמה אלקליות', '#fb923c'], 17: ['hal', 'הלוגנים', '#10b981'], 18: ['nob', 'גזים אצילים', '#8b5cf6'] };

export const shellsOf = (z) => { // electrons per shell, for z up to 20
  const out = []; let left = z;
  for (const cap of [2, 8, 8, 2]) { if (left <= 0) break; out.push(Math.min(cap, left)); left -= cap; }
  return out;
};

// ---------- the atom ----------
function bohr(el) {
  const sh = shellsOf(el.e ?? el.z), cx = 150, cy = 150;
  const nuc = [];
  const total = el.z + el.n;
  const order = Array.from({ length: total }, (_, i) => (i % 2 === 0 ? 'p' : 'n')).slice(0, total);
  // mix protons and neutrons: fill by ratio
  let p = el.z, n = el.n;
  const seq = [];
  while (p + n > 0) { if (p >= n && p > 0) { seq.push('p'); p--; } else if (n > 0) { seq.push('n'); n--; } else { seq.push('p'); p--; } }
  seq.forEach((t, i) => {
    const r = 4.4 * Math.sqrt(i + 0.5), a = i * 2.4;
    nuc.push(`<circle cx="${cx + r * Math.cos(a)}" cy="${cy + r * Math.sin(a)}" r="4.2" fill="${C[t]}" stroke="#fff" stroke-width=".8"/>`);
  });
  void order;
  const rings = sh.map((c, k) => {
    const r = 42 + 30 * k;
    const dots = Array.from({ length: c }, (_, i) => {
      const a = (i / c) * 2 * Math.PI - Math.PI / 2 + k * 0.4;
      return `<circle cx="${cx + r * Math.cos(a)}" cy="${cy + r * Math.sin(a)}" r="6.5" fill="${C.e}"/><text x="${cx + r * Math.cos(a)}" y="${cy + r * Math.sin(a) + 4}" text-anchor="middle" font-size="11" font-weight="800" fill="#fff">−</text>`;
    }).join('');
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#c7c3e6" stroke-dasharray="4 4"/>${dots}`;
  }).join('');
  return `<svg class="viz-svg" viewBox="0 0 300 300" role="img" aria-label="מודל אטום">${rings}${nuc.join('')}</svg>`;
}
const legend = () => `<div class="sc-legend"><span><i style="background:${C.p}"></i> פרוטון (+) בגרעין</span><span><i style="background:${C.n}"></i> נויטרון (0) בגרעין</span><span><i style="background:${C.e}"></i> אלקטרון (−) בענן</span></div>`;
const name = (el) => `${esc(el.he)} <span class="en">(${el.s})</span>`;

export const ATOM_METHODS = [
  { id: 'bohr', name: 'ציור האטום', icon: '⚛️', ok: (el) => el.z <= 20,
    render: (el) => ({ html: `<div class="sc-bohr">${bohr(el)}</div>${legend()}`,
      caption: `אטום ${name(el)}: בגרעין ${el.z} פרוטונים ו-${el.n} נויטרונים. סביבו ${el.z} אלקטרונים.` }) },
  { id: 'card', name: 'תעודת זהות', icon: '🪪',
    render: (el) => ({ html: `<table class="sc-card"><tr><th>שם</th><td>${name(el)}</td></tr>
      <tr><th>סימול כימי</th><td class="en">${el.s}</td></tr>
      <tr><th>מספר אטומי</th><td><b>${el.z}</b></td></tr>
      <tr><th>פרוטונים (+)</th><td><b style="color:${C.p}">${el.z}</b> · כמו המספר האטומי</td></tr>
      <tr><th>אלקטרונים (−)</th><td><b style="color:${C.e}">${el.z}</b> · באטום ניטרלי, כמו הפרוטונים</td></tr>
      <tr><th>נויטרונים (0)</th><td>${el.n}</td></tr></table>`,
      caption: `המספר האטומי של ${name(el)} הוא ${el.z}. לכן בגרעין ${el.z} פרוטונים, ובאטום ניטרלי ${el.z} אלקטרונים.` }) },
  { id: 'balance', name: 'איזון מטענים', icon: '⚖️',
    render: (el) => {
      const row = (cls, ch, n, color) => `<div class="sc-row"><span class="sc-row-l">${cls}</span><span class="sc-toks">${Array.from({ length: n }, () => `<i class="sc-tok" style="background:${color}">${ch}</i>`).join('')}</span></div>`;
      return { html: `<div class="sc-balance">${row('פרוטונים', '+', el.z, C.p)}${row('אלקטרונים', '−', el.z, C.e)}<div class="sc-eq">${el.z} (+) ו-${el.z} (−) ← מטען כולל <b>0</b>, אטום ניטרלי</div></div>`,
        caption: `כל פרוטון (+) מקבל אלקטרון (−). לכן באטום ניטרלי: מספר הפרוטונים = מספר האלקטרונים.` };
    } },
  { id: 'mass', name: 'מסה וגודל', icon: '⚖️',
    render: () => ({ html: `<table class="sc-cmp"><tr><th>החלקיק</th><th>סימול</th><th>מטען</th><th>מסה (יחסית)</th><th>גודל (יחסי)</th></tr>
      <tr><td>אלקטרון</td><td class="en">e⁻</td><td>−1</td><td>1</td><td>1</td></tr>
      <tr><td>פרוטון</td><td class="en">p⁺</td><td>+1</td><td>1,840</td><td>1,000</td></tr>
      <tr><td>נויטרון</td><td class="en">n</td><td>0</td><td>1,840</td><td>1,000</td></tr></table>`,
      caption: 'פרוטון ונויטרון כבדים בהרבה מאלקטרון. לכן מסת האטום נקבעת בעיקר לפי הפרוטונים והנויטרונים שבגרעין.' }) },
  { id: 'scale', name: 'בקנה מידה', icon: '🏟️',
    render: () => ({ html: `<svg class="viz-svg" viewBox="0 0 300 200"><ellipse cx="150" cy="100" rx="140" ry="85" fill="#dcfce7" stroke="#86efac" stroke-width="3"/>
      <ellipse cx="150" cy="100" rx="70" ry="38" fill="#4ade80" opacity=".5"/><text x="150" y="35" text-anchor="middle" font-size="14" fill="currentColor">האצטדיון: האטום כולו, ברובו חלל ריק</text>
      <text x="150" y="104" text-anchor="middle" font-size="26">🐜</text><text x="150" y="132" text-anchor="middle" font-size="13" fill="currentColor">הנמלה: הגרעין</text>
      <circle cx="30" cy="100" r="3.5" fill="${C.e}"/><circle cx="270" cy="100" r="3.5" fill="${C.e}"/></svg>`,
      caption: 'קוטר הגרעין כ-10⁻¹⁵ מ׳ וקוטר האטום כ-10⁻¹⁰ מ׳: האטום גדול פי מאה אלף. הגרעין לאטום כנמלה באצטדיון.' }) },
];

// ---------- charges ----------
const arrow = (x1, x2, y, color) => `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${color}" stroke-width="4" marker-end="url(#ah)"/>`;
function pairSvg(a, b, rows = false) {
  const col = (s) => (s === '+' ? C.p : s === '−' ? C.e : C.n);
  const ball = (x, y, s) => `<circle cx="${x}" cy="${y}" r="18" fill="${col(s)}"/><text x="${x}" y="${y + 7}" text-anchor="middle" font-size="22" font-weight="800" fill="#fff">${s}</text>`;
  const same = a === b && a !== '0';
  const none = a === '0' || b === '0';
  const word = none ? 'אין כוח חשמלי' : same ? 'דחייה' : 'משיכה';
  const ar = none ? '' : same ? arrow(110, 70, 0, '#16a34a').replace('y1="0"', 'y1="0"') : '';
  void ar; void rows;
  return { svg: `<g>${ball(60, 30, a)}${ball(240, 30, b)}
    ${none ? '' : same
      ? `<line x1="95" y1="30" x2="75" y2="30" stroke="#16a34a" stroke-width="4"/><line x1="205" y1="30" x2="225" y2="30" stroke="#16a34a" stroke-width="4"/>
         <path d="M85 22 L75 30 L85 38" fill="none" stroke="#16a34a" stroke-width="4"/><path d="M215 22 L225 30 L215 38" fill="none" stroke="#16a34a" stroke-width="4"/>`
      : `<line x1="85" y1="30" x2="115" y2="30" stroke="#16a34a" stroke-width="4"/><line x1="215" y1="30" x2="185" y2="30" stroke="#16a34a" stroke-width="4"/>
         <path d="M108 22 L116 30 L108 38" fill="none" stroke="#16a34a" stroke-width="4"/><path d="M192 22 L184 30 L192 38" fill="none" stroke="#16a34a" stroke-width="4"/>`}
    <text x="150" y="35" text-anchor="middle" font-size="15" font-weight="800" fill="currentColor">${word}</text></g>` };
}
const pairs = [['+', '+'], ['−', '−'], ['+', '−'], ['0', '−']];
export const CHARGE_METHODS = [
  { id: 'pairs', name: 'זוגות מטענים', icon: '➕➖',
    render: () => ({ html: `<svg class="viz-svg" viewBox="0 0 300 ${pairs.length * 70}">${pairs.map((p, i) => `<g transform="translate(0 ${i * 70 + 10})">${pairSvg(p[0], p[1]).svg}</g>`).join('')}</svg>`,
      caption: 'שווים דוחים (דחייה חשמלית). שונים מושכים (משיכה חשמלית). נויטרון (0) לא מושך ולא דוחה.' }) },
  { id: 'magnet', name: 'כמו מגנטים', icon: '🧲',
    render: () => ({ html: `<svg class="viz-svg" viewBox="0 0 300 150">
      ${[[10, 'N', 'S', 'N', 'S', 'משיכה'], [85, 'N', 'S', 'S', 'N', 'משיכה']].slice(0, 0).join('')}
      <g font-weight="800" font-size="16" text-anchor="middle" fill="#fff">
        <rect x="20" y="15" width="50" height="30" rx="5" fill="#ef4444"/><text x="45" y="36">N</text><rect x="70" y="15" width="50" height="30" rx="5" fill="#3b82f6"/><text x="95" y="36">S</text>
        <rect x="170" y="15" width="50" height="30" rx="5" fill="#3b82f6"/><text x="195" y="36">S</text><rect x="225" y="15" width="50" height="30" rx="5" fill="#ef4444"/><text x="250" y="36">N</text>
        <rect x="20" y="85" width="50" height="30" rx="5" fill="#ef4444"/><text x="45" y="106">N</text><rect x="85" y="85" width="50" height="30" rx="5" fill="#ef4444"/><text x="110" y="106">N</text>
      </g>
      <text x="95" y="68" text-anchor="middle" font-size="13" fill="currentColor">שונים: צמודים</text><text x="222" y="68" text-anchor="middle" font-size="13" fill="currentColor">שונים: צמודים</text>
      <text x="70" y="138" text-anchor="middle" font-size="13" fill="currentColor">שווים: נדחפים</text></svg>`,
      caption: 'כמו במגנטים: קטבים שונים נמשכים, קטבים שווים נדחים. אותו דבר קורה במטענים חשמליים.' }) },
  { id: 'hold', name: 'למה האטום מחזיק', icon: '⚛️',
    render: () => ({ html: `<svg class="viz-svg" viewBox="0 0 300 200"><circle cx="150" cy="100" r="70" fill="none" stroke="#c7c3e6" stroke-dasharray="4 4"/>
      <circle cx="150" cy="100" r="16" fill="${C.p}"/><text x="150" y="107" text-anchor="middle" font-size="20" font-weight="800" fill="#fff">+</text>
      <circle cx="220" cy="100" r="11" fill="${C.e}"/><text x="220" y="105" text-anchor="middle" font-size="16" font-weight="800" fill="#fff">−</text>
      <circle cx="80" cy="100" r="11" fill="${C.e}"/><text x="80" y="105" text-anchor="middle" font-size="16" font-weight="800" fill="#fff">−</text>
      <line x1="205" y1="100" x2="175" y2="100" stroke="#16a34a" stroke-width="4"/><path d="M182 93 L174 100 L182 107" fill="none" stroke="#16a34a" stroke-width="4"/>
      <line x1="95" y1="100" x2="125" y2="100" stroke="#16a34a" stroke-width="4"/><path d="M118 93 L126 100 L118 107" fill="none" stroke="#16a34a" stroke-width="4"/>
      <text x="150" y="30" text-anchor="middle" font-size="14" fill="currentColor">הגרעין (+) מושך את האלקטרונים (−)</text>
      <text x="150" y="185" text-anchor="middle" font-size="14" fill="currentColor">האלקטרונים דוחים זה את זה</text></svg>`,
      caption: 'הגרעין החיובי מושך את האלקטרונים השליליים: משיכה חשמלית. בין האלקטרונים עצמם יש דחייה.' }) },
];

// ---------- elements ----------
const atomDot = (c, x, y) => `<circle cx="${x}" cy="${y}" r="9" fill="${c}"/>`;
export const ELEMENT_METHODS = [
  { id: 'same', name: 'סוג אחד של אטומים', icon: '🔴',
    render: () => {
      const grid = (cols, fn) => cols.map((c, i) => atomDot(c, 20 + (i % 4) * 26, 22 + Math.floor(i / 4) * 26)).join('');
      void grid;
      const box = (x, cols, label) => `<g transform="translate(${x} 0)"><rect x="0" y="0" width="110" height="110" rx="12" fill="none" stroke="#c7c3e6" stroke-width="2"/>${cols.map((c, i) => atomDot(c, 22 + (i % 4) * 22, 22 + Math.floor(i / 4) * 22)).join('')}<text x="55" y="132" text-anchor="middle" font-size="13" font-weight="700" fill="currentColor">${label}</text></g>`;
      const r = '#ef4444', b = '#3b82f6';
      return { html: `<svg class="viz-svg" viewBox="0 0 330 145">${box(0, Array(16).fill(r), 'יסוד')}${box(110, [r, b, r, b, b, r, b, r, r, b, r, b, b, r, b, r], 'לא יסוד')}${box(220, Array(16).fill(b), 'יסוד')}</svg>`,
        caption: 'יסוד: כל האטומים מאותו סוג. אם יש שני סוגי אטומים, זה כבר לא יסוד.' };
    } },
  { id: 'split', name: 'אפשר לפרק?', icon: '✂️',
    render: () => ({ html: `<div class="sc-split"><div class="sc-split-row"><b>מים</b> <span class="en">H₂O</span> → <b>מימן</b> + <b>חמצן</b> <span class="sc-ok">אפשר לפרק: לא יסוד</span></div>
      <div class="sc-split-row"><b>מימן</b> <span class="en">H</span> → <span class="sc-no">אי אפשר לפרק לחומרים אחרים: יסוד</span></div>
      <div class="sc-split-row"><b>חמצן</b> <span class="en">O</span> → <span class="sc-no">אי אפשר לפרק לחומרים אחרים: יסוד</span></div></div>`,
      caption: 'מים אפשר לפרק למימן ולחמצן. מימן וחמצן אי אפשר לפרק לחומרים אחרים, ולכן הם יסודות.' }) },
  { id: 'gallery', name: 'דוגמאות', icon: '🧪',
    render: () => ({ html: `<div class="sc-gallery">${[['H', 'מימן'], ['C', 'פחמן'], ['O', 'חמצן'], ['N', 'חנקן'], ['Fe', 'ברזל'], ['Al', 'אלומיניום'], ['Cu', 'נחושת'], ['Cl', 'כלור'], ['S', 'גופרית']].map(([s, h]) => `<div class="sc-gal"><b class="en">${s}</b><small>${h}</small></div>`).join('')}</div>`,
      caption: 'תשעת היסודות שהמורה הזכירה: מימן, פחמן, חמצן, חנקן, ברזל, אלומיניום, נחושת, כלור, גופרית.' }) },
];

// ---------- particles of matter ----------
const ball = (x, y, c, r = 9) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" stroke="#fff" stroke-width="1"/>`;
const mol2 = (x, y, c, r = 8) => ball(x - r, y, c, r) + ball(x + r, y, c, r);
const h2o = (x, y) => ball(x, y, '#ef4444', 9) + ball(x - 11, y + 9, '#e2e8f0', 6) + ball(x + 11, y + 9, '#e2e8f0', 6);
const frame = (x, w, label, inner) => `<g transform="translate(${x} 0)"><rect width="${w}" height="110" rx="12" fill="none" stroke="#c7c3e6" stroke-width="2"/>${inner}<text x="${w / 2}" y="132" text-anchor="middle" font-size="12.5" font-weight="700" fill="currentColor">${label}</text></g>`;
export const PARTICLE_METHODS = [
  { id: 'am', name: 'אטומים ומולקולות', icon: '🫧',
    render: () => ({ html: `<svg class="viz-svg" viewBox="0 0 330 145">${frame(0, 105, 'הליום: אטומים', [[25, 30], [70, 25], [55, 65], [25, 85], [80, 90]].map(([x, y]) => ball(x, y, '#fb923c')).join(''))}
      ${frame(112, 105, 'חמצן: מולקולות', [[40, 28], [75, 60], [38, 78]].map(([x, y]) => mol2(x, y, '#b91c1c')).join(''))}
      ${frame(224, 105, 'מים: מולקולות H₂O', [[30, 30], [70, 36], [38, 74], [78, 82]].map(([x, y]) => h2o(x, y)).join(''))}</svg>`,
      caption: 'אטום: החלקיק הקטן ביותר. מולקולה: שני אטומים או יותר המחוברים ביניהם. חלקיקי החומר הם אטומים או מולקולות.' }) },
  { id: 'struct', name: 'איך בנויים יסודות', icon: '🧱',
    render: () => {
      const grid = Array.from({ length: 16 }, (_, i) => ball(24 + (i % 4) * 22, 22 + Math.floor(i / 4) * 22, '#3b82f6', 10)).join('');
      return { html: `<svg class="viz-svg" viewBox="0 0 330 145">${frame(0, 105, 'אטומים בודדים: He, Ne, Ar', [[25, 28], [72, 40], [45, 78], [80, 85]].map(([x, y]) => ball(x, y, '#a78bfa')).join(''))}
        ${frame(112, 105, 'מולקולות: O₂, H₂, N₂', [[40, 28], [72, 58], [38, 82]].map(([x, y]) => mol2(x, y, '#ef4444')).join(''))}
        ${frame(224, 105, 'מבנה ענק (סריג): C, Fe', grid)}</svg>`,
        caption: 'כל אלה יסודות: בכל אחד האטומים מאותו סוג. אבל הם יכולים להיות בודדים, בזוגות (מולקולות) או בסריג ענק.' };
    } },
  { id: 'carbon', name: 'יהלום וגרפיט', icon: '💎',
    render: () => {
      const dia = [[0, 0], [1, 0], [2, 0], [0.5, 1], [1.5, 1], [1, 2]].map(([a, b]) => ball(30 + a * 40, 20 + b * 30, '#334155', 6)).join('') + '<path d="M30 20 L70 20 L110 20 M50 50 L90 50 M70 80 M30 20 L50 50 L70 20 L90 50 L110 20 M50 50 L70 80 L90 50" fill="none" stroke="#334155" stroke-width="2"/>';
      const gra = [20, 55, 90].map((y) => Array.from({ length: 5 }, (_, i) => ball(20 + i * 20, y + (i % 2) * 10, '#334155', 5)).join('') + `<path d="M20 ${y} L40 ${y + 10} L60 ${y} L80 ${y + 10} L100 ${y}" fill="none" stroke="#334155" stroke-width="2"/>`).join('');
      return { html: `<svg class="viz-svg" viewBox="0 0 330 145">${frame(0, 160, 'יהלום: סריג תלת-ממדי', dia)}${frame(170, 160, 'גרפיט: שכבות', gra)}</svg>
        <table class="sc-cmp"><tr><th></th><th>יהלום</th><th>גרפיט</th></tr><tr><th>חשמל</th><td>לא מוליך</td><td>מוליך</td></tr><tr><th>מראה</th><td>שקוף ומבריק</td><td>אפור, רך (עיפרון)</td></tr></table>`,
        caption: 'שניהם עשויים רק מאטומי פחמן. סידור האטומים שונה, ולכן התכונות שונות.' };
    } },
  { id: 'tiny', name: 'כמה קטן?', icon: '🔬',
    render: () => ({ html: `<div class="sc-gallery"><div class="sc-gal"><span class="sc-big">🧂</span><small>גרגיר מלח או חול: כ-10¹⁸ אטומים</small></div>
      <div class="sc-gal"><span class="sc-big">✏️</span><small>קו עיפרון: כ-3 מיליון אטומי פחמן לרוחב</small></div>
      <div class="sc-gal"><span class="sc-big">🔭</span><small>ראו אטומים רק במיקרוסקופ אלקטרונים</small></div></div>`,
      caption: 'האטומים זעירים: אי אפשר לראות אותם בעין או במיקרוסקופ פשוט.' }) },
];

// ---------- periodic table ----------
function table(symbols, mode, hi) {
  const cells = Array.from({ length: 4 }, () => Array(18).fill(''));
  symbols.forEach((s, i) => {
    const z = i + 1, [r, c] = POS(z);
    let cls = '', extra = '';
    if (mode === 'type') cls = `sc-t-${typeOf(z)}`;
    else if (mode === 'cols') { const f = FAMILIES[c]; cls = f && !(z === 1) ? `sc-f-${f[0]}` : 'sc-t-0'; }
    else cls = 'sc-t-0';
    if (z === hi) cls += ' sc-hi';
    cells[r - 1][c - 1] = `<div class="sc-cell ${cls}" style="grid-row:${r};grid-column:${c}" ${extra}><small>${z}</small><b>${s}</b></div>`;
  });
  const heads = mode === 'cols' ? Array.from({ length: 18 }, (_, i) => `<div class="sc-h" style="grid-row:5;grid-column:${i + 1}">${i + 1}</div>`).join('') : '';
  const rows = mode === 'rows' ? [1, 2, 3, 4].map((r) => `<div class="sc-rn" style="grid-row:${r};grid-column:19">${r}</div>`).join('') : '';
  return `<div class="sc-tablewrap"><div class="sc-table ltr">${cells.flat().join('')}${heads}${rows}</div></div>`;
}
export function tableMethods(symbols) {
  return [
    { id: 'type', name: 'מתכות ואל-מתכות', icon: '🎨',
      render: (el, hi) => ({ html: `${table(symbols, 'type', hi)}<div class="sc-legend"><span><i style="background:#60a5fa"></i> מתכות</span><span><i style="background:#fbbf24"></i> אל-מתכות</span><span><i style="background:#cbd5e1"></i> באמצע (לא נלמד)</span></div>`,
        caption: 'מתכות בצד שמאל ובמרכז, אל-מתכות בצד ימין. מימן (H) חריג: אל-מתכת בצד שמאל. קו מדרגות מפריד ביניהן.' }) },
    { id: 'rows', name: 'שורות: מספר אטומי עולה', icon: '➡️',
      render: (el, hi) => ({ html: `${table(symbols, 'rows', hi)}<p class="sc-note">המספר הקטן בכל משבצת הוא המספר האטומי. בכל שורה הוא עולה ב-1 בכל צעד ימינה.</p>`,
        caption: 'השורות מסודרות לפי מספר אטומי עולה: 1, 2, 3, 4... כל יסוד מוסיף עוד פרוטון אחד.' }) },
    { id: 'cols', name: 'טורים: משפחות', icon: '👪',
      render: (el, hi) => ({ html: `${table(symbols, 'cols', hi)}<div class="sc-legend">${Object.values(FAMILIES).map(([, n, c]) => `<span><i style="background:${c}"></i> ${n}</span>`).join('')}</div>`,
        caption: 'כל טור הוא משפחה כימית: יסודות עם תכונות דומות. טור 1: אלקליות · טור 17: הלוגנים · טור 18: גזים אצילים.' }) },
  ];
}

// ---------- metals ----------
export const METAL_METHODS = [
  { id: 'props', name: 'השוואת תכונות', icon: '📋',
    render: () => ({ html: `<table class="sc-cmp"><tr><th></th><th style="background:#dbeafe">מתכות</th><th style="background:#fef3c7">אל-מתכות</th></tr>
      <tr><th>מראה</th><td>מבריקות</td><td>מטות</td></tr>
      <tr><th>חשמל</th><td>מוליכות</td><td>מבודדות</td></tr>
      <tr><th>חום</th><td>מוליכות</td><td>לא מוליכות</td></tr>
      <tr><th>עיבוד</th><td>גמישות, אפשר לכופף ולמתוח</td><td>שבירות (במוצק)</td></tr>
      <tr><th>דוגמאות</th><td>ברזל, אלומיניום, נחושת</td><td>חמצן, גופרית, פחמן</td></tr></table>`,
      caption: 'כדי להחליט אם חומר הוא מתכת: בדקו ברק, מוליכות חשמל וחום, וגמישות.' }) },
  { id: 'life', name: 'בחיים', icon: '🏠',
    render: () => ({ html: `<div class="sc-gallery"><div class="sc-gal"><span class="sc-big">🔌</span><small>כבל: נחושת מוליכה חשמל. הפלסטיק מבודד</small></div>
      <div class="sc-gal"><span class="sc-big">🍳</span><small>סיר ממתכת מוליך חום. ידית פלסטיק לא</small></div>
      <div class="sc-gal"><span class="sc-big">🥫</span><small>פח ואלומיניום: מתכות שמכופפים לצורה</small></div>
      <div class="sc-gal"><span class="sc-big">🔥</span><small>גופרית ופחמן: אל-מתכות שבירות ומטות</small></div></div>`,
      caption: 'מתכות מוליכות חום וחשמל, ולכן עושים מהן סירים וכבלים. מבודדים (אל-מתכות) מגנים עלינו.' }) },
];

// ---------- panel ----------
export function panel(container, methods, spec, start = 0) {
  let idx = start % methods.length;
  const draw = () => {
    const m = methods[idx];
    const { html, caption } = m.render(spec.el, spec.hi);
    container.innerHTML = `
      <div class="viz-tabs">${methods.map((x, i) => `<button class="viz-tab ${i === idx ? 'active' : ''}" data-i="${i}">${x.icon} ${x.name}</button>`).join('')}</div>
      <div class="viz-box sc-viz">${html}</div>
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
