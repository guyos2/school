// Column arithmetic (חיבור, חיסור וכפל במאונך): the solving plan, the board, and visualizations.
// plan(ex) turns an exercise { op: 'add'|'sub'|'mul', a, b } into the ordered steps a kid
// does on paper, right to left. Each step carries a patch that the board applies once done.
const eq = (s) => `<span class="eq">${s}</span>`;
const svg = (w, h, body) =>
  `<svg viewBox="0 0 ${w} ${h}" class="viz-svg" style="direction:ltr" role="img" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;

export const PLACE = ['אחדות', 'עשרות', 'מאות', 'אלפים', 'עשרות אלפים'];
export const PLACE_COLOR = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];
export const SYM = { add: '+', sub: '−', mul: '×' };

const digits = (n) => String(n).split('').reverse().map(Number);
export const resultOf = ({ op, a, b }) => (op === 'add' ? a + b : op === 'sub' ? a - b : a * b);
export const exText = (ex) => `${ex.a} ${SYM[ex.op]} ${ex.b}`;

// ---------- the plan ----------
export function plan(ex) {
  const { op, a, b } = ex;
  const A = digits(a), B = digits(b);
  const resLen = String(resultOf(ex)).length;
  const W = Math.max(A.length, B.length, resLen);
  const steps = [];
  const col = (p) => `עמודת ה${PLACE[p]}`;

  if (op === 'add') {
    const n = Math.max(A.length, B.length);
    let carry = 0;
    for (let p = 0; p < n; p++) {
      const terms = [];
      if (p < A.length) terms.push({ n: A[p], c: PLACE_COLOR[p] });
      if (p < B.length) terms.push({ n: B[p], c: '#64748b' });
      if (carry) terms.push({ n: carry, c: '#ef4444' });
      const s = terms.reduce((x, t) => x + t.n, 0);
      const patch = { res: { [p]: s % 10 } };
      if (s >= 10) patch.marks = { [p + 1]: 1 };
      const explain = s >= 10
        ? `יצא ${s}: כותבים ${s % 10} למטה, ומעבירים 1 קטן ל${col(p + 1)}.`
        : `כותבים ${s} למטה ב${col(p)}.`;
      if (terms.length === 1) {
        steps.push({ kind: 'info', place: p, patch, text: `ב${col(p)} יש רק ${s}, אין מה לחבר אליו. מורידים אותו למטה.` });
      } else {
        const q = terms.map((t) => t.n).join(' + ');
        steps.push({
          kind: 'ask', place: p, q, answer: s, explain, patch,
          help: () => helpBox(tenFrames(terms.map((t) => ({ n: t.n, color: t.c }))),
            `${eq(`${q} = ${s}`)}${s >= 10 ? `<br>עשר נקודות הן עשרת שלמה, והיא עוברת ל${col(p + 1)}.` : ''}`),
        });
      }
      carry = s >= 10 ? 1 : 0;
    }
    if (carry) steps.push({ kind: 'info', place: n, patch: { res: { [n]: 1 } }, text: `ב${col(n)} יש רק את ה-1 שהעברנו, אז כותבים אותו למטה.` });
  }

  if (op === 'sub') {
    const top = [...A];
    for (let p = 0; p < A.length; p++) {
      const leading = p >= resLen; // a zero at the start of the answer is not written
      if (p >= B.length) {
        steps.push(leading
          ? { kind: 'info', place: p, patch: {}, text: `ב${col(p)} נשאר 0. בתחילת מספר לא כותבים 0.` }
          : { kind: 'info', place: p, patch: { res: { [p]: top[p] } }, text: `ב${col(p)} אין מה לחסר, אז מורידים את ה-${top[p]} למטה.` });
        continue;
      }
      const d = B[p];
      const t = top[p];
      const need = t < d;
      steps.push({
        kind: 'choice', place: p, q: `${t} − ${d}`,
        ask: `${col(p)}: אפשר לחסר ${eq(`${t} − ${d}`)} בלי לפרוט?`,
        options: [{ html: 'כן, אפשר ✅', value: false }, { html: 'לא, צריך לפרוט 🔄', value: true }],
        answer: need,
        explain: need ? `${t} קטן מ-${d}, אז צריך לפרוט.` : `${t} לא קטן מ-${d}, אז מחסרים ישר.`,
        patch: {},
        help: () => helpBox(tenFrames([{ n: t, color: PLACE_COLOR[p] }]),
          need ? `יש רק ${t}, ואי אפשר להוריד מהן ${d}. לכן פורטים.` : `יש ${t}, ואפשר להוריד מהן ${d}. לא צריך לפרוט.`),
      });
      if (need) {
        let j = p + 1;
        while (top[j] === 0) j++;
        const tops = { [j]: top[j] - 1, [p]: t + 10 };
        for (let k = p + 1; k < j; k++) tops[k] = 9;
        let text = `לוקחים 1 מ${col(j)}: ה-${top[j]} הופך ל-${top[j] - 1}.`;
        if (j > p + 1) {
          const zeros = Array.from({ length: j - p - 1 }, (_, k) => PLACE[p + 1 + k]);
          text = `ב${zeros.map((z) => `עמודת ה${z}`).join(' וב')} יש 0, אז ממשיכים שמאלה עד ${col(j)}. ${text} ` +
            `כל 0 בדרך הופך ל-10, נותן 1 הלאה ונשאר 9.`;
        }
        text += ` ה-${t} ב${col(p)} מקבל 10 והופך ל-${t + 10}.`;
        steps.push({ kind: 'info', place: p, from: j, patch: { top: tops }, text });
        Object.assign(top, tops);
      }
      const v = top[p] - d;
      const skip = leading && v === 0;
      steps.push({
        kind: 'ask', place: p, q: `${top[p]} − ${d}`, answer: v,
        explain: skip ? 'יצא 0, ובתחילת מספר לא כותבים 0.' : `כותבים ${v} למטה ב${col(p)}.`,
        patch: skip ? {} : { res: { [p]: v } },
        help: () => helpBox(tenFrames([{ n: top[p] - d, color: PLACE_COLOR[p] }, { n: d, color: '#94a3b8', crossed: true }]),
          `מתוך ${top[p]} מורידים ${d} (המחוקות), ונשארות ${v}.<br>${eq(`${top[p]} − ${d} = ${v}`)}`),
      });
    }
  }

  if (op === 'mul') {
    let carry = 0;
    for (let p = 0; p < A.length; p++) {
      const last = p === A.length - 1;
      const prod = A[p] * b;
      const v = prod + carry;
      const write = last
        ? { res: v >= 10 ? { [p]: v % 10, [p + 1]: Math.floor(v / 10) } : { [p]: v } }
        : { res: { [p]: v % 10 }, ...(v >= 10 ? { marks: { [p + 1]: Math.floor(v / 10) } } : {}) };
      const writeText = last
        ? `זו הספרה האחרונה, אז כותבים את כל ה-${v} למטה.`
        : v >= 10 ? `יצא ${v}: כותבים ${v % 10} למטה, ומעבירים ${Math.floor(v / 10)} קטן ל${col(p + 1)}.` : `כותבים ${v} למטה ב${col(p)}.`;
      steps.push({
        kind: 'ask', place: p, q: `${A[p]} × ${b}`, answer: prod,
        explain: carry ? `עכשיו מוסיפים את ה-${carry} שהעברנו.` : writeText,
        patch: carry ? {} : write,
        help: () => helpBox(dotArray(A[p], b, PLACE_COLOR[p]), `${A[p]} שורות של ${b}:<br>${eq(`${A[p]} × ${b} = ${prod}`)}`),
      });
      if (carry) {
        steps.push({
          kind: 'ask', place: p, q: `${prod} + ${carry}`, answer: v, explain: writeText, patch: write,
          help: () => helpBox(tenFrames([{ n: prod, color: PLACE_COLOR[p] }, { n: carry, color: '#ef4444' }]),
            `ל-${prod} מוסיפים את ה-${carry} שהעברנו (באדום):<br>${eq(`${prod} + ${carry} = ${v}`)}`),
        });
      }
      carry = last ? 0 : Math.floor(v / 10);
    }
  }
  return { W, A, B, steps };
}

const helpBox = (html, caption) => `<div class="viz-box">${html}</div><p class="viz-caption">${caption}</p>`;

// Board state: res/marks/top are maps place -> digit; struck marks top digits changed by borrowing.
export const emptyState = () => ({ res: {}, marks: {}, top: {} });
export function applyPatch(state, patch) {
  for (const k of ['res', 'marks', 'top']) Object.assign(state[k], patch[k] || {});
}

export function finalState(ex) {
  const s = emptyState();
  for (const st of plan(ex).steps) applyPatch(s, st.patch);
  return s;
}

// ---------- the board: digits in place-value columns, like on paper ----------
export function board(ex, { W, A, B }, state, active = -1, from = -1) {
  const places = Array.from({ length: W }, (_, i) => W - 1 - i); // left to right: highest place first
  const cell = (p, inner, cls = '') => {
    const on = p === active ? ' on' : p === from ? ' from' : '';
    return `<td class="${cls}${on}" style="--pc:${PLACE_COLOR[p] || '#999'}">${inner}</td>`;
  };
  const head = places.map((p) => cell(p, PLACE[p] ?? '', 'col-h')).join('');
  const marks = places.map((p) => cell(p, state.top[p] ?? state.marks[p] ?? '', 'col-m')).join('');
  const top = places.map((p) => cell(p, p < A.length ? A[p] : '', state.top[p] != null ? 'col-d struck' : 'col-d')).join('');
  const bottom = places.map((p) => cell(p, p < B.length ? B[p] : '', 'col-d')).join('');
  const res = places.map((p) => cell(p, state.res[p] ?? '', 'col-d col-r')).join('');
  return `
    <table class="col-board ltr">
      <tr class="col-head"><td></td>${head}</tr>
      <tr class="col-marks"><td></td>${marks}</tr>
      <tr><td></td>${top}</tr>
      <tr><td class="col-op">${SYM[ex.op]}</td>${bottom}</tr>
      <tr class="col-line"><td></td>${res}</tr>
    </table>`;
}

// ---------- small step pictures ----------
// Dots in ten-frames (2 rows of 5), so a full frame reads as "one ten".
function tenFrames(groups) {
  const dots = groups.flatMap((g) => Array.from({ length: g.n }, () => g));
  const frames = Math.max(1, Math.ceil(dots.length / 10));
  const perRow = Math.min(frames, 5), r = 11, cell = 28, fw = cell * 5 + 8, fh = cell * 2 + 8, gap = 14;
  const W = perRow * fw + (perRow - 1) * gap, H = Math.ceil(frames / 5) * (fh + gap) - gap;
  let body = '';
  for (let f = 0; f < frames; f++) {
    const fx = (f % 5) * (fw + gap), fy = Math.floor(f / 5) * (fh + gap);
    body += `<rect x="${fx}" y="${fy}" width="${fw}" height="${fh}" rx="8" fill="none" stroke="currentColor" stroke-opacity=".3" stroke-width="2"/>`;
    for (let k = 0; k < 10; k++) {
      const g = dots[f * 10 + k];
      const cx = fx + 4 + cell * (k % 5) + cell / 2, cy = fy + 4 + cell * Math.floor(k / 5) + cell / 2;
      if (!g) continue;
      body += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${g.color}" fill-opacity="${g.crossed ? 0.35 : 1}"/>`;
      if (g.crossed) body += `<path d="M ${cx - r} ${cy - r} L ${cx + r} ${cy + r}" stroke="#ef4444" stroke-width="3"/>`;
    }
  }
  return svg(W, H, body);
}

function dotArray(rows, cols, color) {
  const cell = 30, r = 11;
  let body = '';
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
    body += `<circle cx="${j * cell + cell / 2}" cy="${i * cell + cell / 2}" r="${r}" fill="${color}"/>`;
  }
  return svg(Math.max(cols, 1) * cell, Math.max(rows, 1) * cell, body);
}

// ---------- whole-exercise visualizations (at least 3 per operation) ----------
// Place-value table: every digit as that many small squares in its column.
function pvTable(W, rows) {
  const places = Array.from({ length: W }, (_, i) => W - 1 - i);
  const sq = (n, c) => `<span class="pv-dots">${Array.from({ length: n }, () => `<i style="background:${c}"></i>`).join('')}</span>`;
  return `<table class="pv-table ltr">
    <tr>${places.map((p) => `<th style="color:${PLACE_COLOR[p]}">${PLACE[p]}</th>`).join('')}<th></th></tr>
    ${rows.map((r) => `<tr class="${r.cls || ''}">${places.map((p) => {
      const n = r.cells[p];
      return `<td>${n == null ? '' : `<b>${n}</b>${n <= 19 ? sq(n, PLACE_COLOR[p]) : ''}`}</td>`;
    }).join('')}<td class="pv-label">${r.label}</td></tr>`).join('')}
  </table>`;
}

const toCells = (D) => Object.fromEntries(D.map((d, p) => [p, d]));

function blocks(ex) {
  const { W, A, B } = plan(ex);
  const R = digits(resultOf(ex));
  if (ex.op === 'add') {
    const sums = {};
    for (let p = 0; p < Math.max(A.length, B.length); p++) sums[p] = (A[p] || 0) + (B[p] || 0);
    const over = Object.entries(sums).filter(([, s]) => s >= 10).map(([p]) => `ב${PLACE[p]}`);
    return {
      html: pvTable(W, [
        { label: ex.a, cells: toCells(A) },
        { label: `+ ${ex.b}`, cells: toCells(B) },
        { label: 'ביחד', cells: sums, cls: 'pv-mid' },
        { label: '= אחרי ההעברה', cells: toCells(R), cls: 'pv-res' },
      ]),
      caption: over.length
        ? `מחברים כל עמודה. ${over.join(', ')} יצא 10 או יותר: כל 10 קוביות הופכות לקובייה אחת בעמודה שמשמאל.`
        : 'מחברים כל עמודה בנפרד. אף עמודה לא הגיעה ל-10, אז אין מה להעביר.',
    };
  }
  if (ex.op === 'sub') {
    const fs = finalState(ex);
    const after = Object.fromEntries(A.map((d, p) => [p, fs.top[p] ?? d]));
    return {
      html: pvTable(W, [
        { label: ex.a, cells: toCells(A) },
        { label: 'אחרי הפריטה', cells: after, cls: 'pv-mid' },
        { label: `− ${ex.b}`, cells: toCells(B) },
        { label: '=', cells: toCells(R), cls: 'pv-res' },
      ]),
      caption: Object.keys(fs.top).length
        ? 'כשאין מספיק קוביות בעמודה, פורטים: קובייה אחת מהעמודה שמשמאל הופכת ל-10 קוביות אצלנו. אחר כך מורידים בכל עמודה.'
        : 'בכל עמודה יש מספיק קוביות, אז מורידים בכל עמודה בלי לפרוט.',
    };
  }
  // mul: the multiplicand's digits, each column multiplied by b, then regrouped
  const prods = toCells(A.map((d) => d * ex.b));
  return {
    html: pvTable(W, [
      { label: ex.a, cells: toCells(A) },
      { label: `כל עמודה × ${ex.b}`, cells: prods, cls: 'pv-mid' },
      { label: '= אחרי ההעברה', cells: toCells(R), cls: 'pv-res' },
    ]),
    caption: `כופלים כל עמודה ב-${ex.b}. כשיוצא 10 או יותר, כל 10 עוברות כקובייה אחת לעמודה שמשמאל.`,
  };
}

// 8650 -> [[3, 8000], [2, 600], [1, 50], [0, 0]], highest place first.
const placeParts = (D) => D.map((d, p) => [p, d * 10 ** p]).reverse();

function expanded(ex) {
  const { A, B } = plan(ex);
  const row = (p, l, op, r, res) => {
    const c = PLACE_COLOR[p];
    return `<div class="radd exp-row"><span class="chip" style="background:${c}">${l}</span><span class="op">${op}</span>` +
      `<span class="chip" style="background:${c}">${r}</span><span class="op">=</span><span class="chip chip-total" style="background:${c}">${res}</span></div>`;
  };
  let rows, parts, caption;
  if (ex.op === 'add') {
    const n = Math.max(A.length, B.length);
    parts = Array.from({ length: n }, (_, i) => n - 1 - i).map((p) => [p, (A[p] || 0) * 10 ** p, (B[p] || 0) * 10 ** p]);
    rows = parts.map(([p, x, y]) => row(p, x, '+', y, x + y)).join('');
    caption = `מפרקים כל מספר לאלפים, מאות, עשרות ואחדות, ומחברים כל סוג לחוד:<br>${eq(`${parts.map(([, x, y]) => x + y).join(' + ')} = ${resultOf(ex)}`)}`;
  } else if (ex.op === 'sub') {
    const fs = finalState(ex);
    const top = A.map((d, p) => fs.top[p] ?? d);
    parts = Array.from({ length: A.length }, (_, i) => A.length - 1 - i).map((p) => [p, top[p] * 10 ** p, (B[p] || 0) * 10 ** p]);
    rows = parts.map(([p, x, y]) => row(p, x, '−', y, x - y)).join('');
    const split = parts.map(([, x]) => x).join(' + ');
    caption = `${Object.keys(fs.top).length ? `קודם פורטים: ${eq(`${ex.a} = ${split}`)}<br>` : ''}ואז מחסרים כל סוג לחוד:<br>${eq(`${parts.map(([, x, y]) => x - y).join(' + ')} = ${resultOf(ex)}`)}`;
  } else {
    parts = placeParts(A).filter(([, x]) => x > 0);
    rows = parts.map(([p, x]) => row(p, x, '×', ex.b, x * ex.b)).join('');
    caption = `כופלים כל חלק ב-${ex.b} ומחברים:<br>${eq(`${parts.map(([, x]) => x * ex.b).join(' + ')} = ${resultOf(ex)}`)}`;
  }
  return { html: `<div class="exp-rows ltr">${rows}</div>`, caption };
}

// Jumps on a number line; drawn schematically (equal widths) so small jumps stay readable.
function jumpLine(start, jumps) {
  const W = 620, x0 = 30, x1 = 590, y = 150;
  const step = (x1 - x0) / jumps.length;
  let body = `<line x1="${x0 - 14}" y1="${y}" x2="${x1 + 14}" y2="${y}" stroke="currentColor" stroke-width="3"/>`;
  body += `<circle cx="${x0}" cy="${y}" r="7" fill="currentColor"/>`;
  body += `<text x="${x0}" y="${y + 34}" class="viz-num-sm" text-anchor="middle">${start}</text>`;
  let pos = start;
  jumps.forEach((j, i) => {
    const xs = x0 + i * step, xe = xs + step;
    const h = 30 + 50 * j.weight;
    body += `<path d="M ${xs} ${y - 4} Q ${(xs + xe) / 2} ${y - h * 2 + 4} ${xe} ${y - 4}" fill="none" stroke="${j.color}" stroke-width="4" stroke-linecap="round"/>`;
    body += `<text x="${(xs + xe) / 2}" y="${y - h - 8}" class="viz-num-sm" text-anchor="middle" fill="${j.color}">${j.label}</text>`;
    pos += j.size;
    body += `<circle cx="${xe}" cy="${y}" r="7" fill="${j.color}"/>`;
    body += `<text x="${xe}" y="${y + (i % 2 ? 58 : 34)}" class="viz-num-sm" text-anchor="middle">${pos}</text>`;
  });
  return svg(W, 220, body);
}

function jumps(ex) {
  if (ex.op === 'mul') {
    const js = Array.from({ length: ex.b }, (_, i) => ({ size: ex.a, label: `+${ex.a}`, weight: 0.6, color: PLACE_COLOR[i % PLACE_COLOR.length] }));
    return {
      html: jumpLine(0, js),
      caption: `כפל הוא חיבור חוזר: ${ex.b} קפיצות של ${ex.a}.<br><b class="ltr">${Array(ex.b).fill(ex.a).join(' + ')} = ${resultOf(ex)}</b>`,
    };
  }
  const sign = ex.op === 'add' ? 1 : -1;
  const B = digits(ex.b);
  const js = placeParts(B).filter(([, x]) => x > 0).map(([p, x]) => ({
    size: sign * x, label: `${sign > 0 ? '+' : '−'}${x}`, weight: p / Math.max(B.length - 1, 1), color: PLACE_COLOR[p],
  }));
  return {
    html: jumpLine(ex.a, js),
    caption: `מתחילים ב-${ex.a} ו${sign > 0 ? 'קופצים קדימה' : 'קופצים אחורה'} לפי החלקים של ${ex.b}: ${eq(js.map((j) => j.label).join(' '))}<br>(הקפיצות לא בקנה מידה)`,
  };
}

function boxModel(ex) {
  const parts = placeParts(digits(ex.a)).filter(([, x]) => x > 0);
  const total = ex.a, H = 110, top = 40, side = 40, min = 70, full = 540;
  const widths = parts.map(([, x]) => Math.max(min, (x / total) * full));
  const W = side + widths.reduce((s, w) => s + w + 6, 0) + 10;
  let body = `<text x="${side / 2}" y="${top + H / 2}" class="viz-num-sm" text-anchor="middle" dominant-baseline="central">${ex.b}</text>`;
  let x = side;
  parts.forEach(([p, v], i) => {
    const c = PLACE_COLOR[p], w = widths[i];
    body += `<rect x="${x}" y="${top}" width="${w}" height="${H}" rx="10" fill="${c}" fill-opacity=".22" stroke="${c}" stroke-width="3"/>`;
    body += `<text x="${x + w / 2}" y="${top - 16}" class="viz-num-sm" text-anchor="middle">${v}</text>`;
    body += `<text x="${x + w / 2}" y="${top + H / 2}" class="viz-num" text-anchor="middle" dominant-baseline="central">${v * ex.b}</text>`;
    x += w + 6;
  });
  return {
    html: svg(W, top + H + 10, body),
    caption: `מלבן ברוחב ${ex.a} וגובה ${ex.b}, מחולק לפי ערך המקום:<br>${eq(`${parts.map(([, v]) => v * ex.b).join(' + ')} = ${resultOf(ex)}`)}`,
  };
}

export const METHODS = {
  add: [
    { name: 'קוביות', icon: '🧊', render: blocks },
    { name: 'פירוק', icon: '🧩', render: expanded },
    { name: 'קפיצות על ציר', icon: '🐸', render: jumps },
  ],
  sub: [
    { name: 'קוביות', icon: '🧊', render: blocks },
    { name: 'פירוק', icon: '🧩', render: expanded },
    { name: 'קפיצות על ציר', icon: '🐸', render: jumps },
  ],
  mul: [
    { name: 'מלבן', icon: '🟧', render: boxModel },
    { name: 'פירוק', icon: '🧩', render: expanded },
    { name: 'קוביות', icon: '🧊', render: blocks },
    { name: 'חיבור חוזר', icon: '🐸', render: jumps },
  ],
};

export function vizPanel(container, ex, startIndex = 0) {
  const methods = METHODS[ex.op];
  let idx = startIndex % methods.length;
  const draw = () => {
    const { html, caption } = methods[idx].render(ex);
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
}
