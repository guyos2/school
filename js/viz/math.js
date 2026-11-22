// Visualizations for Itamar's math review (grade 8): ratio, map scale, circles, percent, Pythagoras, corresponding angles.
// Each method: { id, name, icon, ok?(spec), render(spec) → { html, caption } }. A spec carries `t` (the topic).
import { esc } from '../ui.js';

export const fmt = (n) => (typeof n === 'number' ? Number(n.toFixed(4)).toLocaleString('en-US', { maximumFractionDigits: 3 }) : String(n));
export const eq = (s) => `<span class="eq">${s}</span>`;
// Text with math between $…$: Hebrew is escaped, every $…$ run becomes an LTR math span.
export const tx = (s) => String(s).split('$').map((x, i) => (i % 2 ? eq(esc(x)) : esc(x))).join('');
export const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
const R2 = (n) => Math.round(n * 100) / 100;
const PI = 3.14;
const COL = { a: '#3b82f6', b: '#f97316', c: '#10b981', d: '#8b5cf6', hi: '#ef4444', soft: '#e4e0f7' };
const T = (x, y, s, o = '') => `<text x="${x}" y="${y}" text-anchor="middle" class="m8-t" ${o}>${s}</text>`;
const svg = (w, h, body, label = '') => `<svg class="viz-svg m8-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${label}">${body}</svg>`;

// ================= ratio =================
// spec: { t:'ratio', parts:[p,q(,r)] simplest, k: value of one part, names?: [], from?: [a,b] }
const PALETTE = [COL.a, COL.b, COL.c];
const nameOf = (s, i) => (s.names?.[i] ? esc(s.names[i]) : ['חלק א', 'חלק ב', 'חלק ג'][i]);
export const RATIO_METHODS = [
  { id: 'bar', name: 'מודל פסים', icon: '🟦',
    render: (s) => {
      const max = Math.max(...s.parts);
      const big = max > 12;
      const rows = s.parts.map((p, i) => `<div class="m8-barrow"><span class="m8-barname" style="color:${PALETTE[i]}">${nameOf(s, i)}</span>
        <span class="m8-boxes">${Array.from({ length: big ? Math.min(p, 10) : p }, () => `<i style="background:${PALETTE[i]}">${fmt(s.k)}</i>`).join('')}${big && p > 10 ? '<b>…</b>' : ''}</span>
        <span class="m8-bartot">${eq(`${p} × ${fmt(s.k)} = ${fmt(p * s.k)}`)}</span></div>`).join('');
      const sum = s.parts.reduce((a, b) => a + b, 0);
      return { html: `<div class="m8-bars">${rows}</div>`,
        caption: `כל קוביה היא חלק אחד ושווה ${eq(fmt(s.k))}. יש ${eq(s.parts.join(' + ') + ' = ' + sum)} חלקים, ובסך הכול ${eq(fmt(sum * s.k))}.` };
    } },
  { id: 'table', name: 'טבלת יחסים שווים', icon: '📋',
    render: (s) => {
      const k = s.k;
      const cols = Number.isInteger(k) && k <= 8 ? Array.from({ length: Math.max(k, 4) }, (_, i) => i + 1) : [1, 2, 3, k];
      return { html: `<table class="m8-table"><tr><th></th>${cols.map((c) => `<th>${eq('×' + fmt(c))}</th>`).join('')}</tr>
        ${s.parts.map((p, i) => `<tr><th style="color:${PALETTE[i]}">${nameOf(s, i)}</th>${cols.map((c) => `<td class="${c === k ? 'm8-on' : ''}">${fmt(p * c)}</td>`).join('')}</tr>`).join('')}</table>`,
        caption: `מכפילים את כל חלקי היחס ${eq(s.parts.join(' : '))} באותו מספר ומקבלים יחס שווה. העמודה המסומנת: פי ${eq(fmt(k))}.` };
    } },
  { id: 'divide', name: 'מצמצמים כמו שבר', icon: '➗',
    render: (s) => {
      const from = s.from || s.parts.map((p) => R2(p * s.k));
      const dec = from.some((x) => !Number.isInteger(x));
      const m = dec ? 10 ** Math.max(...from.map((x) => (String(x).split('.')[1] || '').length)) : 1;
      const ints = from.map((x) => Math.round(x * m));
      const g = ints.reduce(gcd);
      const lines = [];
      if (dec) lines.push(`${from.join(' : ')} <small>×${m}</small> → ${ints.join(' : ')}`);
      lines.push(`${ints.join(' : ')} <small>÷${g}</small> → <b>${ints.map((x) => x / g).join(' : ')}</b>`);
      return { html: `<div class="m8-lines">${lines.map((l) => `<div>${eq(l)}</div>`).join('')}</div>`,
        caption: dec ? `קודם מכפילים ב-${eq(m)} כדי להיפטר מהנקודה העשרונית, ואז מחלקים את שני החלקים במחלק המשותף הגדול ${eq(g)}.`
          : `מחלקים את כל חלקי היחס באותו מספר, המחלק המשותף הגדול ביותר: ${eq(g)}. כמו בצמצום שבר.` };
    } },
  { id: 'cross', name: 'כפל בהצלבה', icon: '✖️', ok: (s) => s.parts.length === 2,
    render: (s) => {
      const [p, q] = s.parts, a = R2(p * s.k), b = R2(q * s.k);
      return { html: `<div class="m8-cross"><span class="m8-fr"><b>${p}</b><i></i><b>${q}</b></span><span class="m8-eqs">=</span><span class="m8-fr"><b>${fmt(a)}</b><i></i><b>${fmt(b)}</b></span></div>
        <div class="m8-lines"><div>${eq(`${p} × ${fmt(b)} = ${q} × ${fmt(a)}`)}</div><div>${eq(`${fmt(p * b)} = ${fmt(q * a)}`)} ✓</div></div>`,
        caption: `בפרופורציה ${eq('a/b = c/d')} מתקיים ${eq('a × d = b × c')}. כשחסר מספר, כופלים בהצלבה ומחלקים.` };
    } },
];

// ================= map scale =================
// spec: { t:'scale', n, map (cm), real (cm) }
const unitText = (cm) => (cm >= 100000 ? `${fmt(cm / 100000)} ק"מ` : cm >= 100 ? `${fmt(cm / 100)} מ'` : `${fmt(cm)} ס"מ`);
export const SCALE_METHODS = [
  { id: 'ruler', name: 'סרגל המפה', icon: '📏',
    render: (s) => {
      const n = Math.max(1, Math.min(Math.round(s.map), 30)), W = 560, x0 = 30, step = W / n;
      const every = n <= 10 ? 1 : n <= 20 ? 2 : 5;
      let ticks = '';
      for (let i = 0; i <= n; i++) ticks += `<line x1="${x0 + i * step}" y1="40" x2="${x0 + i * step}" y2="${i % every ? 52 : 58}" stroke="currentColor" stroke-width="2"/>${i % every ? '' : T(x0 + i * step, 76, i)}`;
      return { html: svg(620, 150, `<rect x="${x0}" y="28" width="${W}" height="12" rx="4" fill="${COL.a}" opacity=".25"/>
        <rect x="${x0}" y="28" width="${step}" height="12" rx="4" fill="${COL.b}"/>${ticks}
        ${T(x0 + W / 2, 18, 'ס"מ על המפה')}
        ${T(x0 + step / 2, 104, `1 ס"מ = ${fmt(s.n)} ס"מ`, `fill="${COL.b}" font-weight="700"`)}
        ${T(x0 + W / 2, 136, `${fmt(s.map)} ס"מ במפה = ${fmt(s.map)} × ${fmt(s.n)} = ${fmt(s.real)} ס"מ = ${unitText(s.real)}`, 'font-weight="700"')}`, 'סרגל מפה'),
        caption: `קנה מידה ${eq('1 : ' + fmt(s.n))}: כל ס"מ אחד במפה הוא ${eq(fmt(s.n))} ס"מ במציאות (${unitText(s.n)}).` };
    } },
  { id: 'ladder', name: 'סולם יחידות', icon: '🪜',
    render: (s) => ({ html: `<div class="m8-ladder">
        <div class="m8-step" style="--c:${COL.a}"><b>${fmt(s.real)}</b><small>ס"מ</small></div><span class="m8-arr">${eq('÷100')}<br>←</span>
        <div class="m8-step" style="--c:${COL.b}"><b>${fmt(s.real / 100)}</b><small>מטר</small></div><span class="m8-arr">${eq('÷1,000')}<br>←</span>
        <div class="m8-step" style="--c:${COL.c}"><b>${fmt(s.real / 100000)}</b><small>ק"מ</small></div></div>
        <p class="m8-note">${eq('1 m = 100 cm')} · ${eq('1 km = 1,000 m = 100,000 cm')}</p>`,
      caption: `מס"מ למטרים מחלקים ב-${eq(100)}, וממטרים לק"מ מחלקים ב-${eq('1,000')}. מס"מ ישר לק"מ: מוחקים 5 אפסים (${eq('÷100,000')}).` }) },
  { id: 'table', name: 'טבלת פרופורציה', icon: '📋',
    render: (s) => ({ html: `<table class="m8-table"><tr><th>במפה (ס"מ)</th><th>במציאות (ס"מ)</th></tr>
        <tr><td>1</td><td>${fmt(s.n)}</td></tr><tr><td class="m8-on">${fmt(s.map)}</td><td class="m8-on">${fmt(s.real)}</td></tr></table>
        <p class="m8-note">${eq(`×${fmt(s.map)}`)} בשתי העמודות</p>`,
      caption: `קנה מידה הוא יחס. מה שעושים לעמודה של המפה, עושים גם לעמודה של המציאות: ${eq(`${fmt(s.map)} × ${fmt(s.n)} = ${fmt(s.real)}`)}.` }) },
  { id: 'triangle', name: 'שלוש הנוסחאות', icon: '🔺',
    render: (s) => ({ html: `<div class="m8-lines">
        <div>מציאות = מפה × n: ${eq(`${fmt(s.map)} × ${fmt(s.n)} = ${fmt(s.real)}`)}</div>
        <div>מפה = מציאות ÷ n: ${eq(`${fmt(s.real)} ÷ ${fmt(s.n)} = ${fmt(s.map)}`)}</div>
        <div>n = מציאות ÷ מפה: ${eq(`${fmt(s.real)} ÷ ${fmt(s.map)} = ${fmt(s.n)}`)}</div></div>`,
      caption: 'שלושתן אותה נוסחה. חשוב: המרחק במפה והמרחק במציאות חייבים להיות באותן יחידות (ס"מ) לפני שמחלקים.' }) },
];

// ================= circle =================
// spec: { t:'circle', r, unit, ask: 'P'|'S'|'both', turns? }
const circleDraw = (s, extra = '') => {
  const cx = 150, cy = 120, R = 90;
  return `<circle cx="${cx}" cy="${cy}" r="${R}" fill="${COL.a}" fill-opacity=".12" stroke="${COL.a}" stroke-width="4"/>
    <line x1="${cx - R}" y1="${cy}" x2="${cx + R}" y2="${cy}" stroke="${COL.b}" stroke-width="3" stroke-dasharray="7 5"/>
    <line x1="${cx}" y1="${cy}" x2="${cx + R * Math.cos(-1)}" y2="${cy + R * Math.sin(-1)}" stroke="${COL.hi}" stroke-width="4"/>
    <circle cx="${cx}" cy="${cy}" r="4" fill="currentColor"/>
    ${T(cx + 40, cy - 46, `R = ${fmt(s.r)}`, `fill="${COL.hi}" font-weight="700"`)}
    ${T(cx - 40, cy + 26, `d = ${fmt(2 * s.r)}`, `fill="${COL.b}" font-weight="700"`)}${extra}`;
};
export const CIRCLE_METHODS = [
  { id: 'draw', name: 'רדיוס וקוטר', icon: '⭕',
    render: (s) => ({ html: svg(300, 240, circleDraw(s), 'עיגול עם רדיוס וקוטר'),
      caption: `הקוטר עובר דרך המרכז מצד לצד, והוא פעמיים הרדיוס: ${eq(`d = 2R = ${fmt(2 * s.r)}`)}. כשנתון קוטר, הרדיוס הוא חצי: ${eq(`R = ${fmt(2 * s.r)} ÷ 2 = ${fmt(s.r)}`)}.` }) },
  { id: 'unroll', name: 'פורשים את ההיקף', icon: '🛞',
    render: (s) => {
      const d = 150, x0 = 20, y = 150, L = PI * d;
      const marks = [0, 1, 2, 3].map((i) => `<line x1="${x0 + i * d}" y1="${y - 12}" x2="${x0 + i * d}" y2="${y + 12}" stroke="currentColor" stroke-width="2"/>`).join('');
      const segs = [0, 1, 2].map((i) => T(x0 + i * d + d / 2, y + 32, `d = ${fmt(2 * s.r)}`, `fill="${COL.b}" font-weight="700"`)).join('');
      return { html: svg(520, 200, `<circle cx="${x0 + d / 2}" cy="${y - d / 2 - 4}" r="${d / 2 - 4}" fill="none" stroke="${COL.a}" stroke-width="4" opacity=".5"/>
        <line x1="${x0}" y1="${y}" x2="${x0 + L}" y2="${y}" stroke="${COL.a}" stroke-width="6"/>${marks}
        <line x1="${x0 + L}" y1="${y - 12}" x2="${x0 + L}" y2="${y + 12}" stroke="${COL.hi}" stroke-width="3"/>${segs}
        ${T(x0 + 3 * d + (L - 3 * d) / 2, y - 18, '0.14', `fill="${COL.hi}" font-weight="700"`)}`, 'היקף פרוש'),
        caption: `אם "פורשים" את המעגל לקו ישר, הוא ארוך קצת יותר מ-3 קטרים: ${eq('3.14')} קטרים. לכן ${eq(`P = π × d = 3.14 × ${fmt(2 * s.r)} = ${fmt(R2(PI * 2 * s.r))}`)}${s.turns ? `. בכל סיבוב הגלגל מתקדם היקף אחד, ב-${s.turns} סיבובים: ${eq(`${s.turns} × ${fmt(R2(PI * 2 * s.r))}`)}` : ''}.` };
    } },
  { id: 'sectors', name: 'עיגול שהופך למלבן', icon: '🍕',
    render: (s) => {
      const cx = 90, cy = 110, R = 70, n = 12;
      let pie = '';
      for (let i = 0; i < n; i++) {
        const a1 = (i / n) * 2 * Math.PI, a2 = ((i + 1) / n) * 2 * Math.PI;
        pie += `<path d="M${cx},${cy} L${cx + R * Math.cos(a1)},${cy + R * Math.sin(a1)} A${R},${R} 0 0 1 ${cx + R * Math.cos(a2)},${cy + R * Math.sin(a2)} Z" fill="${i % 2 ? COL.a : COL.b}" opacity=".75" stroke="#fff"/>`;
      }
      const w = (PI * R) / (n / 2), x0 = 200, y0 = 75;
      let rect = '';
      for (let i = 0; i < n / 2; i++) {
        const x = x0 + i * w;
        rect += `<path d="M${x},${y0 + R} L${x + w / 2},${y0} L${x + w},${y0 + R} Z" fill="${COL.b}" opacity=".75" stroke="#fff"/>`;
        rect += `<path d="M${x + w / 2},${y0} L${x + w},${y0 + R} L${x + 1.5 * w},${y0} Z" fill="${COL.a}" opacity=".75" stroke="#fff"/>`;
      }
      return { html: svg(460, 210, `${pie}${rect}
        ${T(x0 + (PI * R) / 2, y0 + R + 24, `π × R`, `font-weight="700"`)}
        <line x1="${x0 - 10}" y1="${y0}" x2="${x0 - 10}" y2="${y0 + R}" stroke="${COL.hi}" stroke-width="3"/>${T(x0 - 26, y0 + R / 2 + 5, 'R', `fill="${COL.hi}" font-weight="700"`)}`, 'עיגול שנחתך לגזרות'),
        caption: `חותכים את העיגול לפרוסות ומסדרים אותן הפוך-ישר: יוצא כמעט מלבן. הגובה ${eq('R')} והאורך חצי היקף ${eq('π × R')}. לכן ${eq(`S = π × R × R = 3.14 × ${fmt(s.r)}² = ${fmt(R2(PI * s.r * s.r))}`)}.` };
    } },
  { id: 'squares', name: 'ריבועי רדיוס', icon: '🟧',
    render: (s) => ({ html: svg(300, 240, `${circleDraw(s)}<rect x="150" y="30" width="90" height="90" fill="${COL.b}" fill-opacity=".35" stroke="${COL.b}" stroke-width="3"/>${T(195, 82, 'R²', `font-weight="800" fill="${COL.b}"`)}`, 'ריבוע על הרדיוס'),
      caption: `הריבוע הכתום הוא ${eq('R × R')}. שטח העיגול שווה בערך ל-${eq('3.14')} ריבועים כאלה: ${eq(`S = 3.14 × ${fmt(s.r)} × ${fmt(s.r)} = ${fmt(R2(PI * s.r * s.r))}`)}. קוטר בנוסחת השטח? טעות! תמיד רדיוס.` }) },
  { id: 'formula', name: 'מציבים בנוסחה', icon: '🧮',
    render: (s) => {
      const d = 2 * s.r;
      return { html: `<div class="m8-lines">
        <div>${eq(`d = ${fmt(d)} → R = ${fmt(d)} ÷ 2 = ${fmt(s.r)}`)}</div>
        <div><b>היקף:</b> ${eq(`P = 2 × π × R = 2 × 3.14 × ${fmt(s.r)} = ${fmt(R2(2 * PI * s.r))}`)}</div>
        <div><b>שטח:</b> ${eq(`S = π × R² = 3.14 × ${fmt(s.r)} × ${fmt(s.r)} = ${fmt(R2(PI * s.r * s.r))}`)}</div></div>`,
        caption: `היקף נמדד ביחידות אורך (${esc(s.unit || 'ס"מ')}), ושטח ביחידות ריבועיות (${esc(s.unit || 'ס"מ')} רבוע).` };
    } },
];

// ================= percent =================
// spec: { t:'percent', p, whole }
export const PERCENT_METHODS = [
  { id: 'grid', name: 'לוח מאה', icon: '💯', ok: (s) => s.p > 0 && s.p <= 100,
    render: (s) => {
      const full = Math.floor(s.p);
      return { html: `<div class="m8-grid">${Array.from({ length: 100 }, (_, i) => `<i class="${i < full ? 'on' : ''}"></i>`).join('')}</div>`,
        caption: `${eq(s.p + '%')} פירושו ${eq(s.p)} מתוך ${eq(100)}. אם השלם הוא ${eq(fmt(s.whole))}, כל משבצת שווה ${eq(fmt(s.whole / 100))}, ו-${eq(s.p)} משבצות שוות ${eq(fmt(R2((s.p * s.whole) / 100)))}.` };
    } },
  { id: 'bar', name: 'פס אחוזים', icon: '📊',
    render: (s) => {
      const W = 520, x0 = 40, part = R2((s.p * s.whole) / 100), w = Math.min(1, s.p / 100) * W;
      let ticks = '';
      for (let i = 0; i <= 10; i++) ticks += `<line x1="${x0 + (i * W) / 10}" y1="50" x2="${x0 + (i * W) / 10}" y2="${i % 5 ? 58 : 64}" stroke="currentColor"/>${i % 5 ? '' : T(x0 + (i * W) / 10, 80, `${i * 10}%`)}`;
      return { html: svg(600, 150, `<rect x="${x0}" y="20" width="${W}" height="30" rx="6" fill="${COL.soft}"/><rect x="${x0}" y="20" width="${w}" height="30" rx="6" fill="${COL.a}"/>${ticks}
        ${T(x0 + W, 104, `100% = ${fmt(s.whole)}`, 'font-weight="700"')}${T(x0 + Math.max(w, 90) / 2, 128, `${s.p}% = ${fmt(part)}`, `fill="${COL.a}" font-weight="700"`)}`, 'פס אחוזים'),
        caption: `כל הפס הוא השלם (${eq('100%')}). החלק הכחול הוא ${eq(s.p + '%')} ממנו.` };
    } },
  { id: 'one', name: 'דרך 1%', icon: '1️⃣',
    render: (s) => {
      const one = s.whole / 100, ten = s.whole / 10;
      return { html: `<div class="m8-lines"><div>${eq(`100% = ${fmt(s.whole)}`)}</div><div>${eq(`10% = ${fmt(s.whole)} ÷ 10 = ${fmt(ten)}`)}</div>
        <div>${eq(`1% = ${fmt(s.whole)} ÷ 100 = ${fmt(one)}`)}</div><div><b>${eq(`${s.p}% = ${s.p} × ${fmt(one)} = ${fmt(R2(s.p * one))}`)}</b></div></div>`,
        caption: 'מוצאים כמה זה 1% (מחלקים ב-100), ואז כופלים במספר האחוזים. לפעמים קל יותר דרך 10%.' };
    } },
  { id: 'frac', name: 'אחוז = שבר = עשרוני', icon: '🔁',
    render: (s) => {
      const g = gcd(Math.round(s.p * 100), 10000), num = Math.round(s.p * 100) / g, den = 10000 / g;
      return { html: `<div class="m8-trio"><span style="--c:${COL.a}"><b>${eq(s.p + '%')}</b><small>אחוז</small></span>=
        <span style="--c:${COL.b}"><b>${eq(`${num}/${den}`)}</b><small>שבר מצומצם</small></span>=
        <span style="--c:${COL.c}"><b>${eq(fmt(s.p / 100))}</b><small>עשרוני</small></span></div>
        <div class="m8-lines"><div>${eq(`${fmt(s.p / 100)} × ${fmt(s.whole)} = ${fmt(R2((s.p * s.whole) / 100))}`)}</div></div>`,
        caption: `אחוז הוא שבר עם מכנה 100: ${eq(`${s.p}% = ${s.p}/100`)}. כדי למצוא חלק מהשלם כופלים את השבר בשלם.` };
    } },
];

// ================= Pythagoras =================
// spec: { t:'pyth', a, b, c, find: 'a'|'b'|'c' }
const triPts = (s, W, H, pad = 30) => {
  const k = Math.min((W - 2 * pad) / s.b, (H - 2 * pad) / s.a);
  return { A: [pad, H - pad - s.a * k], C: [pad, H - pad], B: [pad + s.b * k, H - pad], k };
};
const lbl = (s, side) => (s.find === side ? 'x' : fmt(s[side]));
export const PYTH_METHODS = [
  { id: 'tri', name: 'המשולש', icon: '📐',
    render: (s) => {
      const { A, B, C } = triPts(s, 360, 240, 40);
      return { html: svg(360, 240, `<polygon points="${A} ${B} ${C}" fill="${COL.a}" fill-opacity=".1" stroke="currentColor" stroke-width="3"/>
        <line x1="${A[0]}" y1="${A[1]}" x2="${B[0]}" y2="${B[1]}" stroke="${COL.hi}" stroke-width="5"/>
        <rect x="${C[0]}" y="${C[1] - 16}" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"/>
        ${T(C[0] - 18, (A[1] + C[1]) / 2, lbl(s, 'a'), `font-weight="700" fill="${COL.a}"`)}
        ${T((C[0] + B[0]) / 2, C[1] + 26, lbl(s, 'b'), `font-weight="700" fill="${COL.b}"`)}
        ${T((A[0] + B[0]) / 2 + 18, (A[1] + B[1]) / 2 - 8, lbl(s, 'c'), `font-weight="800" fill="${COL.hi}"`)}`, 'משולש ישר זווית'),
        caption: `היתר (באדום) הוא הצלע שמול הזווית הישרה, והוא תמיד הצלע הארוכה ביותר. שתי הצלעות שיוצרות את הזווית הישרה הן הניצבים.` };
    } },
  { id: 'squares', name: 'ריבועים על הצלעות', icon: '🟩',
    render: (s) => {
      const k = 120 / Math.max(s.a, s.b), pts = [];
      const C = [170, 230], A = [C[0], C[1] - s.a * k], B = [C[0] + s.b * k, C[1]];
      const sq = (P, Q, col, txt) => { // square on segment PQ, outward (to the right of P→Q)
        const dx = Q[0] - P[0], dy = Q[1] - P[1];
        const R = [Q[0] + dy, Q[1] - dx], S = [P[0] + dy, P[1] - dx];
        pts.push(P, Q, R, S);
        const cx = (P[0] + Q[0] + R[0] + S[0]) / 4, cy = (P[1] + Q[1] + R[1] + S[1]) / 4;
        return `<polygon points="${P} ${Q} ${R} ${S}" fill="${col}" fill-opacity=".3" stroke="${col}" stroke-width="2"/>${T(cx, cy + 6, txt, `font-weight="800" fill="${col}"`)}`;
      };
      const ar = (side) => (s.find === side ? `x²` : `${fmt(s[side])}² = ${fmt(s[side] ** 2)}`);
      const body = `${sq(C, A, COL.a, ar('a'))}${sq(B, C, COL.b, ar('b'))}${sq(A, B, COL.hi, ar('c'))}
        <polygon points="${A} ${B} ${C}" fill="var(--card)" stroke="currentColor" stroke-width="3"/>`;
      const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]), x0 = Math.min(...xs) - 10, y0 = Math.min(...ys) - 10;
      return { html: `<svg class="viz-svg m8-svg" viewBox="${x0} ${y0} ${Math.max(...xs) - x0 + 10} ${Math.max(...ys) - y0 + 10}" role="img" aria-label="ריבועים על צלעות המשולש">${body}</svg>`,
        caption: Math.abs(s.a ** 2 + s.b ** 2 - s.c ** 2) < 1e-9
          ? `שטח הריבוע על היתר שווה לסכום השטחים של הריבועים על הניצבים: ${eq(`${fmt(s.a ** 2)} + ${fmt(s.b ** 2)} = ${fmt(s.c ** 2)}`)}.`
          : `כאן ${eq(`${fmt(s.a ** 2)} + ${fmt(s.b ** 2)} = ${fmt(s.a ** 2 + s.b ** 2)}`)}, אבל ${eq(`${fmt(s.c)}² = ${fmt(s.c ** 2)}`)}. הריבועים לא מתאימים, ולכן המשולש לא ישר-זווית.` };
    } },
  { id: 'steps', name: 'המשוואה', icon: '🧮',
    render: (s) => {
      if (s.find === 'none') {
        const c2 = Math.round(s.c ** 2);
        return { html: `<div class="m8-lines"><div>${eq(`${s.a}² + ${s.b}² = ${s.a ** 2} + ${s.b ** 2} = ${s.a ** 2 + s.b ** 2}`)}</div><div>${eq(`c² = ${c2}`)}</div></div>`,
          caption: 'משפט פיתגורס ההפוך: אם ריבוע הצלע הארוכה שווה לסכום ריבועי שתי האחרות, המשולש ישר-זווית. אחרת, לא.' };
      }
      const L = s.find === 'c'
        ? [`${s.a}² + ${s.b}² = x²`, `${s.a ** 2} + ${s.b ** 2} = x²`, `${s.a ** 2 + s.b ** 2} = x²`, `x = √${s.c ** 2} = ${s.c}`]
        : [`${s.find === 'a' ? 'x' : s.a}² + ${s.find === 'b' ? 'x' : s.b}² = ${s.c}²`, `x² = ${s.c ** 2} − ${s[s.find === 'a' ? 'b' : 'a'] ** 2}`, `x² = ${s[s.find] ** 2}`, `x = √${s[s.find] ** 2} = ${s[s.find]}`];
      return { html: `<div class="m8-lines">${L.map((l) => `<div>${eq(l)}</div>`).join('')}</div>`,
        caption: s.find === 'c' ? 'מחפשים יתר: מחברים את ריבועי הניצבים ומוציאים שורש.' : 'מחפשים ניצב: מחסרים מריבוע היתר את ריבוע הניצב הידוע, ומוציאים שורש. (חיסור! לא חיבור)' };
    } },
  { id: 'triples', name: 'שלשות מוכרות', icon: '🔢',
    render: (s) => {
      const TR = [[3, 4, 5], [6, 8, 10], [5, 12, 13], [9, 12, 15], [8, 15, 17], [12, 16, 20], [7, 24, 25], [10, 24, 26]];
      const key = [s.a, s.b].sort((x, y) => x - y).concat(s.c).join();
      return { html: `<div class="m8-triples">${TR.map((t) => `<span class="${t.join() === key ? 'm8-on' : ''}">${eq(t.join(', '))}</span>`).join('')}</div>`,
        caption: 'שלשות פיתגוריות שכדאי לזכור. כפולה של שלשה היא גם שלשה: 3, 4, 5 → 6, 8, 10 → 9, 12, 15 → 12, 16, 20. זו דרך מהירה לבדוק את התשובה.' };
    } },
];

// ================= corresponding angles =================
// spec: { t:'angles', a: the angle above-right at each crossing (degrees), show: 'corr'|'adj', names?: {…} }
function linesSvg(s, mode) {
  const a = Math.max(25, Math.min(155, s.a)), th = (a * Math.PI) / 180;
  const ys = [80, 200], W = 460, dx = Math.cos(th), dy = -Math.sin(th);
  const cxs = ys.map((y) => 230 + (y - 140) * (dx / dy) * 1);
  const tx1 = cxs[0] + dx * 110, ty1 = ys[0] + dy * 110, tx2 = cxs[1] - dx * 110, ty2 = ys[1] - dy * 110;
  const arc = (cx, cy, from, to, col, label, r = 30) => {
    const p1 = [cx + r * Math.cos(from), cy - r * Math.sin(from)], p2 = [cx + r * Math.cos(to), cy - r * Math.sin(to)];
    const mid = (from + to) / 2, big = to - from > Math.PI ? 1 : 0;
    return `<path d="M${cx},${cy} L${p1} A${r},${r} 0 ${big} 0 ${p2} Z" fill="${col}" fill-opacity=".45" stroke="${col}" stroke-width="2"/>${T(cx + (r + 22) * Math.cos(mid), cy - (r + 22) * Math.sin(mid) + 6, label, `font-weight="800" fill="${col}" font-size="17"`)}`;
  };
  const A = s.a, B = 180 - s.a;
  const angs = (cx, cy, i) => {
    const marks = [];
    const ar = 'above-right', al = 'above-left', bl = 'below-left', br = 'below-right';
    const val = { [ar]: A, [al]: B, [bl]: A, [br]: B };
    const range = { [ar]: [0, th], [al]: [th, Math.PI], [bl]: [Math.PI, Math.PI + th], [br]: [Math.PI + th, 2 * Math.PI] };
    const pick = mode === 'all' ? [ar, al, bl, br] : mode === 'adj' ? (i === 0 ? [] : [ar, al]) : [ar];
    for (const pos of pick) {
      const col = pos === ar || pos === bl ? COL.a : COL.b;
      const name = s.names?.[`${i}${pos}`];
      marks.push(arc(cx, cy, range[pos][0], range[pos][1], col, name ? esc(name) : `${fmt(val[pos])}°`, pos === ar || pos === bl ? 28 : 22));
    }
    return marks.join('');
  };
  return svg(W, 280, `<line x1="20" y1="${ys[0]}" x2="${W - 20}" y2="${ys[0]}" stroke="currentColor" stroke-width="3"/><line x1="20" y1="${ys[1]}" x2="${W - 20}" y2="${ys[1]}" stroke="currentColor" stroke-width="3"/>
    ${T(W - 14, ys[0] - 8, 'a')}${T(W - 14, ys[1] - 8, 'b')}
    <line x1="${tx1}" y1="${ty1}" x2="${tx2}" y2="${ty2}" stroke="${COL.d}" stroke-width="3"/>${T(tx2 + 10, ty2 + 4, 'c', `fill="${COL.d}"`)}
    ${angs(cxs[0], ys[0], 0)}${angs(cxs[1], ys[1], 1)}
    <path d="M60,${ys[0] - 6} l8,6 l-8,6 M60,${ys[1] - 6} l8,6 l-8,6" fill="none" stroke="currentColor" stroke-width="2"/>`, 'ישרים מקבילים וחותך');
}
export const ANGLE_METHODS = [
  { id: 'corr', name: 'זוויות מתאימות', icon: '🟦',
    render: (s) => ({ html: linesSvg(s, 'corr'),
      caption: `זוויות מתאימות נמצאות "באותו מקום" בשתי נקודות החיתוך (כאן: מעל הישר ומימין לחותך). כשהישרים מקבילים הן <b>שוות</b>: ${eq(`${fmt(s.a)}° = ${fmt(s.a)}°`)}.` }) },
  { id: 'slide', name: 'מחליקים את הצומת', icon: '⬇️',
    render: (s) => ({ html: linesSvg(s, 'all'),
      caption: 'אפשר "להחליק" את הישר העליון למטה לאורך החותך עד שהוא מתלבש על התחתון. כל זווית נוחתת בדיוק על הזווית המתאימה לה, ולכן הצמתים זהים: אותן 4 זוויות בכל צומת.' }) },
  { id: 'adj', name: 'זוויות צמודות', icon: '🌗',
    render: (s) => ({ html: linesSvg(s, 'adj'),
      caption: `זוויות צמודות יושבות זו ליד זו על ישר אחד, ויחד הן חצי סיבוב: ${eq(`${fmt(s.a)}° + ${fmt(180 - s.a)}° = 180°`)}. לכן הצמודה = ${eq(`180° − ${fmt(s.a)}°`)}.` }) },
  { id: 'eq', name: 'המשוואה', icon: '⚖️',
    render: (s) => ({ html: `<div class="m8-lines">${(s.eqLines || [`מתאימות: שוות → ביטוי = ביטוי`, `צמודות: ביטוי + ביטוי = 180`]).map((l) => `<div>${eq(esc(l))}</div>`).join('')}</div>`,
      caption: 'מתאימות → כותבים שהביטויים <b>שווים</b>. צמודות → כותבים שהסכום שלהן <b>180</b>. פותרים את המשוואה, ואז מציבים את x בחזרה כדי למצוא את הזווית.' }) },
];

export const METHODS = { ratio: RATIO_METHODS, scale: SCALE_METHODS, circle: CIRCLE_METHODS, percent: PERCENT_METHODS, pyth: PYTH_METHODS, angles: ANGLE_METHODS };

// Tabs + "show another way". Returns { set(spec) }.
export function panel(container, spec, start = 0) {
  let methods = [], idx = 0;
  const setup = (s) => { spec = s; methods = METHODS[s.t].filter((m) => !m.ok || m.ok(s)); };
  setup(spec);
  idx = Math.min(start, methods.length - 1);
  const draw = () => {
    const m = methods[idx];
    const { html, caption } = m.render(spec);
    container.innerHTML = `
      <div class="viz-tabs">${methods.map((x, i) => `<button class="viz-tab ${i === idx ? 'active' : ''}" data-i="${i}">${x.icon} ${x.name}</button>`).join('')}</div>
      <div class="viz-box m8-viz">${html}</div>
      <p class="viz-caption">${caption}</p>
      <button class="btn btn-soft viz-next">🔄 תראו לי בדרך אחרת</button>`;
  };
  container.onclick = (e) => {
    const tab = e.target.closest('.viz-tab');
    if (tab) { idx = +tab.dataset.i; draw(); } else if (e.target.closest('.viz-next')) { idx = (idx + 1) % methods.length; draw(); }
  };
  draw();
  return { set(s) { setup(s); idx = Math.min(idx, methods.length - 1); draw(); } };
}
