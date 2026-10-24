// Several ways to see a fraction: pie, bar, number line, group of objects.
// Plus combined views for addition (two fractions merging into one) and comparison (two side by side).
import { COLORS } from '../ui.js';

const eq = (s) => `<span class="eq">${s}</span>`;
const svg = (w, h, body) =>
  `<svg viewBox="0 0 ${w} ${h}" class="viz-svg" role="img" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;

export function gcd(a, b) { return b ? gcd(b, a % b) : a; }
export function simplify(n, d) { const g = gcd(n, d) || 1; return [n / g, d / g]; }

// A numerator that may exceed d, written as a reduced whole/mixed/proper fraction label ("1 1/3", "2", "3/4").
export function mixedLabel(total, d) {
  const whole = Math.floor(total / d), rem = total % d;
  if (!rem) return `${whole}`;
  const [rn, rd] = simplify(rem, d);
  return whole ? `${whole} ${rn}/${rd}` : `${rn}/${rd}`;
}

// A sector of a pie, d slices total, slice index i.
function sectorPath(cx, cy, r, a0, a1) {
  const toXY = (a) => [cx + r * Math.sin(a), cy - r * Math.cos(a)];
  const [x0, y0] = toXY(a0);
  const [x1, y1] = toXY(a1);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`;
}

// ---------- single fraction (0 <= n <= d) ----------
function pie(n, d) {
  const cx = 110, cy = 110, r = 95, slice = (2 * Math.PI) / d;
  let body = '';
  for (let i = 0; i < d; i++) {
    const filled = i < n;
    body += `<path d="${sectorPath(cx, cy, r, i * slice, (i + 1) * slice)}" fill="${filled ? COLORS[4] : '#fff'}" fill-opacity="${filled ? '.85' : '1'}" stroke="currentColor" stroke-width="2.5"/>`;
  }
  return { html: svg(220, 220, body), caption: `העוגה מחולקת ל-${d} חלקים שווים, ו-${n} מהם צבועים: ${eq(`${n}/${d}`)}` };
}

function bar(n, d) {
  const W = 320, H = 70, x0 = 10, y0 = 10, cellW = (W - 2 * x0) / d;
  let body = '';
  for (let i = 0; i < d; i++) {
    const filled = i < n;
    body += `<rect x="${x0 + i * cellW}" y="${y0}" width="${cellW}" height="${H - 2 * y0}" fill="${filled ? COLORS[1] : '#fff'}" fill-opacity="${filled ? '.85' : '1'}" stroke="currentColor" stroke-width="2"/>`;
  }
  return { html: svg(W, H, body), caption: `הפס מחולק ל-${d} חלקים שווים, ו-${n} מהם צבועים: ${eq(`${n}/${d}`)}` };
}

function line(n, d) {
  const x0 = 20, x1 = 580, y = 70, W = 600, H = 110;
  const sx = (v) => x0 + (v / d) * (x1 - x0);
  let body = `<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="currentColor" stroke-width="3"/>`;
  for (let i = 0; i <= d; i++) {
    body += `<line x1="${sx(i)}" y1="${y - 10}" x2="${sx(i)}" y2="${y + 10}" stroke="currentColor" stroke-width="2"/>`;
    if (i === 0 || i === d) body += `<text x="${sx(i)}" y="${y + 34}" class="viz-num" text-anchor="middle">${i === 0 ? '0' : '1'}</text>`;
  }
  body += `<circle cx="${sx(n)}" cy="${y}" r="9" fill="${COLORS[5]}"/>`;
  body += `<text x="${sx(n)}" y="${y - 22}" class="viz-num" fill="${COLORS[5]}" text-anchor="middle">${n}/${d}</text>`;
  return { html: svg(W, H, body), caption: `מסמנים את המקום של ${eq(`${n}/${d}`)} על הציר, בין 0 ל-1` };
}

function group(n, d) {
  const cols = Math.min(d, 5), cell = 44, rows = Math.ceil(d / cols);
  const W = cols * cell + 20, H = rows * cell + 20;
  let body = '';
  for (let i = 0; i < d; i++) {
    const cx = 10 + (i % cols) * cell + cell / 2, cy = 10 + Math.floor(i / cols) * cell + cell / 2;
    const filled = i < n;
    body += `<circle cx="${cx}" cy="${cy}" r="18" fill="${filled ? COLORS[2] : '#fff'}" fill-opacity="${filled ? '.85' : '1'}" stroke="currentColor" stroke-width="2"/>`;
    if (filled) body += `<text x="${cx}" y="${cy}" font-size="20" text-anchor="middle" dominant-baseline="central">✔️</text>`;
  }
  return { html: svg(W, H, body), caption: `מתוך ${d} עצמים, ${n} מסומנים: ${eq(`${n}/${d}`)}` };
}

export const METHODS = [
  { id: 'pie', name: 'עוגה', icon: '🍰', render: pie },
  { id: 'bar', name: 'פס', icon: '▭', render: bar },
  { id: 'line', name: 'ציר מספרים', icon: '📏', render: line },
  { id: 'group', name: 'קבוצה', icon: '⭐', render: group },
];

// A reusable "show it another way" panel for a single fraction.
export function vizPanel(container, n, d, startIndex = 0) {
  let idx = startIndex;
  const draw = () => {
    const m = METHODS[idx];
    const { html, caption } = m.render(n, d);
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
  return { set(nn, nd) { n = nn; d = nd; draw(); } };
}

// ---------- addition: n1/d + n2/d, drawn as filled cells across one or two wholes ----------
function barCombine(n1, n2, d) {
  const total = n1 + n2, bars = Math.max(1, Math.ceil(total / d));
  const cellW = 26, gap = 3, pad = 8, barGap = 14, cellH = 34;
  const W = d * (cellW + gap) - gap + 2 * pad, H = bars * (cellH + barGap) + 6;
  let body = '';
  for (let b = 0; b < bars; b++) {
    const y0 = 6 + b * (cellH + barGap);
    for (let i = 0; i < d; i++) {
      const idx = b * d + i;
      const fill = idx < n1 ? COLORS[1] : idx < total ? COLORS[6] : '#fff';
      body += `<rect x="${pad + i * (cellW + gap)}" y="${y0}" width="${cellW}" height="${cellH}" fill="${fill}" fill-opacity="${fill === '#fff' ? 1 : .85}" stroke="currentColor" stroke-width="2"/>`;
    }
  }
  return { html: svg(W, H, body), caption: addCaption(n1, n2, d) };
}

function pieCombine(n1, n2, d) {
  const total = n1 + n2, pies = Math.max(1, Math.ceil(total / d));
  const r = 60, gap = 20, cx = r + 10;
  let body = '';
  for (let p = 0; p < pies; p++) {
    const cy = r + 10 + p * (2 * r + gap), slice = (2 * Math.PI) / d;
    for (let i = 0; i < d; i++) {
      const idx = p * d + i;
      const fill = idx < n1 ? COLORS[1] : idx < total ? COLORS[6] : '#fff';
      body += `<path d="${sectorPath(cx, cy, r, i * slice, (i + 1) * slice)}" fill="${fill}" fill-opacity="${fill === '#fff' ? 1 : .85}" stroke="currentColor" stroke-width="2.5"/>`;
    }
  }
  return { html: svg(2 * r + 20, pies * (2 * r + gap), body), caption: addCaption(n1, n2, d) };
}

function lineJump(n1, n2, d) {
  const total = n1 + n2, maxV = Math.max(d, total);
  const x0 = 20, x1 = 580, y = 130, W = 600, H = 180;
  const sx = (v) => x0 + (v / maxV) * (x1 - x0);
  let body = `<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="currentColor" stroke-width="3"/>`;
  for (let i = 0; i <= maxV; i++) {
    const major = i % d === 0;
    body += `<line x1="${sx(i)}" y1="${y - (major ? 10 : 5)}" x2="${sx(i)}" y2="${y + (major ? 10 : 5)}" stroke="currentColor" stroke-width="${major ? 3 : 1.5}"/>`;
    if (major) body += `<text x="${sx(i)}" y="${y + 28}" class="viz-num" text-anchor="middle">${i / d}</text>`;
  }
  const jump = (from, to, c) => {
    let s = `<path d="M ${sx(from)} ${y - 4} Q ${(sx(from) + sx(to)) / 2} ${y - 50} ${sx(to)} ${y - 4}" fill="none" stroke="${c}" stroke-width="4" stroke-linecap="round"/>`;
    s += `<text x="${(sx(from) + sx(to)) / 2}" y="${y - 56}" class="viz-num" fill="${c}" text-anchor="middle">${to - from}/${d}</text>`;
    return s;
  };
  body += jump(0, n1, COLORS[1]) + jump(n1, total, COLORS[6]);
  body += `<circle cx="${sx(total)}" cy="${y}" r="7" fill="${COLORS[4]}"/>`;
  return { html: svg(W, H, body), caption: addCaption(n1, n2, d) };
}

function addCaption(n1, n2, d) {
  return eq(`${n1}/${d} + ${n2}/${d} = ${mixedLabel(n1 + n2, d)}`);
}

export const METHODS_ADD = [
  { id: 'bar', name: 'פס', icon: '▭', render: barCombine },
  { id: 'pie', name: 'עוגה', icon: '🍰', render: pieCombine },
  { id: 'line', name: 'ציר', icon: '📏', render: lineJump },
];

// ---------- comparison: n1/d1 vs n2/d2, drawn to the same scale ----------
function barCompare(n1, d1, n2, d2) {
  const W = 360, cellH = 46, pad = 10, rowGap = 56;
  const row = (n, d, y) => {
    const cellW = (W - 2 * pad) / d;
    let s = '';
    for (let i = 0; i < d; i++) {
      const filled = i < n;
      s += `<rect x="${pad + i * cellW}" y="${y}" width="${cellW}" height="${cellH}" fill="${filled ? COLORS[1] : '#fff'}" fill-opacity="${filled ? '.85' : '1'}" stroke="currentColor" stroke-width="2"/>`;
    }
    return `${s}<text x="${W / 2}" y="${y + cellH + 24}" class="viz-num" text-anchor="middle">${n}/${d}</text>`;
  };
  const body = row(n1, d1, 10) + row(n2, d2, cellH + rowGap + 10);
  return { html: svg(W, 2 * cellH + 2 * rowGap, body), caption: 'שני הפסים באותו אורך (שלם אחד), ורואים איזה חלק גדול יותר' };
}

function pieCompare(n1, d1, n2, d2) {
  const r = 70, gap = 30;
  const draw = (n, d, cx, cy) => {
    const slice = (2 * Math.PI) / d;
    let s = '';
    for (let i = 0; i < d; i++) {
      const filled = i < n;
      s += `<path d="${sectorPath(cx, cy, r, i * slice, (i + 1) * slice)}" fill="${filled ? COLORS[1] : '#fff'}" fill-opacity="${filled ? '.85' : '1'}" stroke="currentColor" stroke-width="2.5"/>`;
    }
    return `${s}<text x="${cx}" y="${cy + r + 26}" class="viz-num" text-anchor="middle">${n}/${d}</text>`;
  };
  const body = draw(n1, d1, r + 10, r + 10) + draw(n2, d2, 3 * r + 10 + gap, r + 10);
  return { html: svg(4 * r + gap + 20, 2 * r + 50, body), caption: 'שתי עוגות באותו גודל, מחולקות למספר חלקים אחר' };
}

function lineCompare(n1, d1, n2, d2) {
  const x0 = 20, x1 = 580, y = 70, W = 600, H = 120;
  const sx = (v) => x0 + v * (x1 - x0);
  const v1 = n1 / d1, v2 = n2 / d2;
  let body = `<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="currentColor" stroke-width="3"/>`;
  body += `<text x="${sx(0)}" y="${y + 30}" class="viz-num" text-anchor="middle">0</text>`;
  body += `<text x="${sx(1)}" y="${y + 30}" class="viz-num" text-anchor="middle">1</text>`;
  const close = Math.abs(sx(v1) - sx(v2)) < 40;
  body += `<circle cx="${sx(v1)}" cy="${y}" r="9" fill="${COLORS[1]}"/><text x="${sx(v1)}" y="${y - 18}" class="viz-num" fill="${COLORS[1]}" text-anchor="middle">${n1}/${d1}</text>`;
  body += `<circle cx="${sx(v2)}" cy="${y}" r="9" fill="${COLORS[6]}"/><text x="${sx(v2)}" y="${y - 18 - (close ? 26 : 0)}" class="viz-num" fill="${COLORS[6]}" text-anchor="middle">${n2}/${d2}</text>`;
  return { html: svg(W, H, body), caption: 'מסמנים את שני השברים על אותו ציר: השבר שקרוב יותר ל-1 הוא הגדול יותר' };
}

export const METHODS_COMPARE = [
  { id: 'bar', name: 'פס', icon: '▭', render: barCompare },
  { id: 'pie', name: 'עוגה', icon: '🍰', render: pieCompare },
  { id: 'line', name: 'ציר', icon: '📏', render: lineCompare },
];

// ---------- fraction names (Hebrew) ----------
const NAMES = {
  2: { one: 'חצי' },
  3: { masc: true, one: 'שליש', many: 'שלישים' },
  4: { masc: true, one: 'רבע', many: 'רבעים' },
  5: { one: 'חמישית', many: 'חמישיות' },
  6: { one: 'שישית', many: 'שישיות' },
  7: { one: 'שביעית', many: 'שביעיות' },
  8: { one: 'שמינית', many: 'שמיניות' },
  9: { one: 'תשיעית', many: 'תשיעיות' },
  10: { one: 'עשירית', many: 'עשיריות' },
};
const NUM_MASC = { 2: 'שני', 3: 'שלושה', 4: 'ארבעה', 5: 'חמישה', 6: 'שישה', 7: 'שבעה', 8: 'שמונה', 9: 'תשעה' };
const NUM_FEM = { 2: 'שתי', 3: 'שלוש', 4: 'ארבע', 5: 'חמש', 6: 'שש', 7: 'שבע', 8: 'שמונה', 9: 'תשע' };

export function fracName(n, d) {
  const info = NAMES[d];
  if (n === 1) return info.one;
  const word = info.masc ? NUM_MASC[n] : NUM_FEM[n];
  return `${word} ${info.many}`;
}
