// Several ways to picture a × b ("a groups of b").
// Each method returns { html, caption } so the screen can switch between them.
import { COLORS } from '../ui.js';

const eq = (s) => `<span class="eq">${s}</span>`;

const EMOJI = ['🍎', '🍓', '⭐', '🐟', '🍪', '🌸', '🚗', '⚽', '🧁', '🦋'];
const svg = (w, h, body) =>
  `<svg viewBox="0 0 ${w} ${h}" class="viz-svg" role="img" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
const groupWord = (a) => (a === 1 ? 'קבוצה אחת' : `${a} קבוצות`);

function groups(a, b) {
  const emoji = EMOJI[(a * 7 + b) % EMOJI.length];
  const perRow = a <= 5 ? a : Math.ceil(a / 2);
  const cols = Math.ceil(Math.sqrt(b));
  const rows = Math.ceil(b / cols);
  const cell = 28, pad = 12, gap = 16, label = 30;
  const bw = cols * cell + pad * 2, bh = rows * cell + pad * 2;
  const nRows = Math.ceil(a / perRow);
  const W = perRow * bw + (perRow - 1) * gap + 20;
  const H = nRows * (bh + label + gap) + 4;
  let body = '';
  for (let g = 0; g < a; g++) {
    const gx = 10 + (g % perRow) * (bw + gap);
    const gy = 4 + Math.floor(g / perRow) * (bh + label + gap);
    const c = COLORS[g % COLORS.length];
    body += `<rect x="${gx}" y="${gy}" width="${bw}" height="${bh}" rx="18" fill="${c}" fill-opacity=".14" stroke="${c}" stroke-width="3"/>`;
    for (let k = 0; k < b; k++) {
      const cx = gx + pad + (k % cols) * cell + cell / 2;
      const cy = gy + pad + Math.floor(k / cols) * cell + cell / 2;
      body += `<text x="${cx}" y="${cy}" font-size="21" text-anchor="middle" dominant-baseline="central">${emoji}</text>`;
    }
    body += `<text x="${gx + bw / 2}" y="${gy + bh + 22}" class="viz-num" fill="${c}" text-anchor="middle">${(g + 1) * b}</text>`;
  }
  return {
    html: svg(W, H, body),
    caption: `${groupWord(a)}, ובכל קבוצה ${b}. סופרים בקפיצות של ${b}: ביחד ${a * b}`,
  };
}

function array(a, b) {
  const cell = 36, r = 13, labelW = 64;
  const W = b * cell + labelW + 10, H = a * cell + 10;
  let body = '';
  for (let i = 0; i < a; i++) {
    const c = COLORS[i % COLORS.length];
    for (let j = 0; j < b; j++) {
      body += `<circle cx="${10 + j * cell + cell / 2}" cy="${5 + i * cell + cell / 2}" r="${r}" fill="${c}"/>`;
    }
    body += `<text x="${10 + b * cell + 12}" y="${5 + i * cell + cell / 2}" class="viz-num" fill="${c}" dominant-baseline="central">${(i + 1) * b}</text>`;
  }
  return {
    html: svg(W, H, body),
    caption: `${a} שורות, ובכל שורה ${b} עיגולים: ביחד ${a * b}. אפשר גם לספור ${b} עמודות של ${a}!`,
  };
}

function jumps(a, b) {
  const total = a * b;
  const x0 = 24, x1 = 576, y = 160, W = 600, H = 200;
  const sx = (v) => x0 + (v / Math.max(total, 1)) * (x1 - x0);
  let body = `<line x1="${x0 - 10}" y1="${y}" x2="${x1 + 10}" y2="${y}" stroke="currentColor" stroke-width="3"/>`;
  for (let v = 0; v <= total; v++) {
    const major = v % b === 0;
    if (!major && total > 50) continue;
    body += `<line x1="${sx(v)}" y1="${y - (major ? 10 : 5)}" x2="${sx(v)}" y2="${y + (major ? 10 : 5)}" stroke="currentColor" stroke-width="${major ? 3 : 1.5}"/>`;
    // Label every jump landing, skipping some when they would overlap.
    const every = Math.ceil(34 / (sx(b) - sx(0)));
    if (major && (v / b) % every === 0) body += `<text x="${sx(v)}" y="${y + 34}" class="viz-num" text-anchor="middle">${v}</text>`;
  }
  const step = sx(b) - sx(0);
  const hgt = Math.min(62, 18 + step * 0.4);
  for (let i = 0; i < a; i++) {
    const xs = sx(i * b), xe = sx((i + 1) * b), c = COLORS[i % COLORS.length];
    body += `<path d="M ${xs} ${y - 4} Q ${(xs + xe) / 2} ${y - hgt * 2 + 4} ${xe} ${y - 4}" fill="none" stroke="${c}" stroke-width="4" stroke-linecap="round"/>`;
    body += `<circle cx="${xe}" cy="${y}" r="7" fill="${c}"/>`;
    if (step > 40) body += `<text x="${(xs + xe) / 2}" y="${y - hgt - 8}" class="viz-num" fill="${c}" text-anchor="middle">+${b}</text>`;
  }
  body += `<text x="${sx(total)}" y="${y - 26}" font-size="30" text-anchor="middle">🐸</text>`;
  return {
    html: svg(W, H, body),
    caption: `הצפרדע קופצת ${a} קפיצות, כל קפיצה ${b} צעדים, ומגיעה ל-${total}`,
  };
}

function repeatedAdd(a, b) {
  const chips = Array.from({ length: a }, (_, i) =>
    `<span class="chip" style="background:${COLORS[i % COLORS.length]}">${b}</span>`).join('<span class="op">+</span>');
  const sums = Array.from({ length: a }, (_, i) => `<span>${(i + 1) * b}</span>`).join('<span class="arrow">→</span>');
  return {
    html: `<div class="radd ltr">${chips}<span class="op">=</span><span class="chip chip-total">${a * b}</span></div>
           <div class="radd-steps ltr">${sums}</div>`,
    caption: `כפל הוא חיבור של אותו מספר שוב ושוב: מחברים ${b} בדיוק ${a} פעמים`,
  };
}

function area(a, b) {
  const cell = 32, off = 40;
  // Split a hard fact into two easier ones (by 5).
  const splitCols = b > 5 ? 5 : 0;
  const splitRows = !splitCols && a > 5 ? 5 : 0;
  const W = b * cell + off + 10, H = a * cell + off + 10;
  const partColor = (i, j) => ((splitCols && j >= splitCols) || (splitRows && i >= splitRows) ? COLORS[3] : COLORS[1]);
  let body = '';
  for (let i = 0; i < a; i++) {
    for (let j = 0; j < b; j++) {
      body += `<rect x="${off + j * cell}" y="${off + i * cell}" width="${cell}" height="${cell}" fill="${partColor(i, j)}" fill-opacity=".75" stroke="#fff" stroke-width="2"/>`;
    }
  }
  const t = (x, y, s, anchor = 'middle') => `<text x="${x}" y="${y}" class="viz-num" text-anchor="${anchor}" dominant-baseline="central">${s}</text>`;
  // Dimension labels: top for columns, side for rows.
  const colParts = splitCols ? [[0, splitCols], [splitCols, b]] : [[0, b]];
  const rowParts = splitRows ? [[0, splitRows], [splitRows, a]] : [[0, a]];
  for (const [s, e] of colParts) body += t(off + ((s + e) / 2) * cell, 18, e - s);
  for (const [s, e] of rowParts) body += t(18, off + ((s + e) / 2) * cell, e - s);
  if (splitCols || splitRows) {
    for (const [cs, ce] of colParts) for (const [rs, re] of rowParts) {
      body += `<text x="${off + ((cs + ce) / 2) * cell}" y="${off + ((rs + re) / 2) * cell}" class="viz-in" text-anchor="middle" dominant-baseline="central">${(ce - cs) * (re - rs)}</text>`;
    }
  }
  let caption;
  if (splitCols) {
    caption = `מפרקים לשני חלקים קלים:<br>${eq(`${a}×5 + ${a}×${b - 5} = ${a * 5} + ${a * (b - 5)} = ${a * b}`)}`;
  } else if (splitRows) {
    caption = `מפרקים לשני חלקים קלים:<br>${eq(`5×${b} + ${a - 5}×${b} = ${5 * b} + ${(a - 5) * b} = ${a * b}`)}`;
  } else {
    caption = `מלבן של ${a} על ${b} משבצות: השטח הוא ${a * b} משבצות`;
  }
  return { html: svg(W, H, body), caption };
}

export const METHODS = [
  { id: 'groups', name: 'קבוצות', icon: '🍎', render: groups },
  { id: 'array', name: 'מערך', icon: '🔴', render: array },
  { id: 'jumps', name: 'קפיצות על ציר', icon: '🐸', render: jumps },
  { id: 'add', name: 'חיבור חוזר', icon: '➕', render: repeatedAdd },
  { id: 'area', name: 'שטח ופירוק', icon: '🟧', render: area },
];

// A reusable "show it another way" panel.
export function vizPanel(container, a, b, startIndex = 0) {
  let idx = startIndex;
  const draw = () => {
    const m = METHODS[idx];
    const { html, caption } = m.render(a, b);
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
  return { set(na, nb) { a = na; b = nb; draw(); } };
}
