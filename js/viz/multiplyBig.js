// Visualizations for multi-digit multiplication (single×two-digit, two×two-digit).
// Unlike the single-digit visualizations, these never draw one shape per unit —
// they decompose by place value so the picture stays readable at any size.
import { COLORS } from '../ui.js';

const eq = (s) => `<span class="eq">${s}</span>`;
const svg = (w, h, body) =>
  `<svg viewBox="0 0 ${w} ${h}" class="viz-svg" role="img" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;

// 47 -> [40, 7], 6 -> [6], 40 -> [40].
function parts(n) {
  if (n < 10) return [n];
  const tens = Math.floor(n / 10) * 10, ones = n % 10;
  return ones > 0 ? [tens, ones] : [tens];
}

function box(a, b) {
  const aParts = parts(a), bParts = parts(b);
  const cell = 70, gap = 6, off = 46;
  const wUnit = (cell * bParts.length + gap * (bParts.length - 1)) / b;
  const hUnit = (cell * aParts.length + gap * (aParts.length - 1)) / a;
  const W = off + bParts.length * cell + gap * (bParts.length - 1) + 14;
  const H = off + aParts.length * cell + gap * (aParts.length - 1) + 14;
  const t = (x, y, s, cls = 'viz-num') =>
    `<text x="${x}" y="${y}" class="${cls}" text-anchor="middle" dominant-baseline="central">${s}</text>`;
  let body = '', y = off;
  aParts.forEach((ap, i) => {
    const h = ap * hUnit;
    let x = off;
    bParts.forEach((bp, j) => {
      const w = bp * wUnit;
      const c = COLORS[(i * bParts.length + j) % COLORS.length];
      body += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${c}" fill-opacity=".22" stroke="${c}" stroke-width="3"/>`;
      body += t(x + w / 2, y + h / 2, ap * bp, 'viz-in');
      x += w + gap;
    });
    body += t(off - 24, y + h / 2, ap, 'viz-num-sm');
    y += h + gap;
  });
  let x = off;
  bParts.forEach((bp) => { body += t(x + (bp * wUnit) / 2, off - 26, bp, 'viz-num-sm'); x += bp * wUnit + gap; });
  const terms = aParts.flatMap((ap) => bParts.map((bp) => `${ap}×${bp}`));
  const sums = aParts.flatMap((ap) => bParts.map((bp) => ap * bp));
  return {
    html: svg(W, H, body),
    caption: `מפרקים לפי עשרות ויחידות:<br>${eq(`${terms.join(' + ')} = ${sums.join(' + ')} = ${a * b}`)}`,
  };
}

function expanded(a, b) {
  const aParts = parts(a), bParts = parts(b);
  const terms = aParts.flatMap((ap) => bParts.map((bp) => [ap, bp]));
  const rows = terms.map(([ap, bp], idx) => {
    const c = COLORS[idx % COLORS.length];
    return `<div class="radd exp-row"><span class="chip" style="background:${c}">${ap}</span><span class="op">×</span>` +
      `<span class="chip" style="background:${c}">${bp}</span><span class="op">=</span>` +
      `<span class="chip chip-total" style="background:${c}">${ap * bp}</span></div>`;
  }).join('');
  const sum = terms.map(([ap, bp]) => ap * bp).join(' + ');
  return {
    html: `<div class="exp-rows ltr">${rows}</div>`,
    caption: `כופלים כל חלק בנפרד, ואז מחברים:<br>${eq(`${sum} = ${a * b}`)}`,
  };
}

// Jumps grouped by place value: a few big jumps of 10×b, then a few small jumps of b.
function jumpsBig(a, b) {
  const steps = parts(a).map((p) => (p >= 10 ? { size: 10 * b, count: p / 10 } : { size: b, count: p }));
  const total = a * b;
  const x0 = 24, x1 = 576, y = 160, W = 600, H = 200;
  const sx = (v) => x0 + (v / Math.max(total, 1)) * (x1 - x0);
  const nJumps = steps.reduce((s, st) => s + st.count, 0);
  const labelEvery = nJumps > 10 ? 2 : 1;
  let body = `<line x1="${x0 - 10}" y1="${y}" x2="${x1 + 10}" y2="${y}" stroke="currentColor" stroke-width="3"/>`;
  body += `<text x="${sx(0)}" y="${y + 34}" class="viz-num-sm" text-anchor="middle">0</text>`;
  let pos = 0, jumpIdx = 0;
  steps.forEach((step, si) => {
    const c = COLORS[si % COLORS.length];
    for (let i = 0; i < step.count; i++, jumpIdx++) {
      const xs = sx(pos), xe = sx(pos + step.size);
      const hgt = Math.min(62, 18 + (xe - xs) * 0.4);
      body += `<path d="M ${xs} ${y - 4} Q ${(xs + xe) / 2} ${y - hgt * 2 + 4} ${xe} ${y - 4}" fill="none" stroke="${c}" stroke-width="4" stroke-linecap="round"/>`;
      body += `<circle cx="${xe}" cy="${y}" r="7" fill="${c}"/>`;
      pos += step.size;
      const isLast = si === steps.length - 1 && i === step.count - 1;
      if (isLast || jumpIdx % labelEvery === 0) {
        body += `<text x="${sx(pos)}" y="${y + 34}" class="viz-num-sm" text-anchor="middle">${pos}</text>`;
      }
    }
  });
  body += `<text x="${sx(total)}" y="${y - 70}" font-size="30" text-anchor="middle">🐸</text>`;
  const desc = steps.map((s) => `${s.count}×${s.size}`).join(' + ');
  return { html: svg(W, H, body), caption: `מפרקים את הקפיצות:<br>${eq(`${desc} = ${total}`)}` };
}

export const METHODS = [
  { id: 'box', name: 'קופסאות', icon: '🟧', render: box },
  { id: 'expanded', name: 'פירוק לחלקים', icon: '➕', render: expanded },
  { id: 'jumps', name: 'קפיצות על ציר', icon: '🐸', render: jumpsBig },
];

export function vizPanelBig(container, a, b, startIndex = 0) {
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
