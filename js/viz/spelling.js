// Visualizations for Hebrew spelling: how a word's sounds turn into letters, and where it is easy to slip.
// A word: { word, syllables: [[sound with nikud, letters]], meaning, sentence, traps: [{ t, not?, tip }] }.
import { esc } from '../ui.js';

const TRAP_COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b'];

// For every letter of the word, the index of the trap that covers it (every occurrence), or -1.
function trapMap(w) {
  const map = Array(w.word.length).fill(-1);
  w.traps.forEach((tr, ti) => {
    for (let at = w.word.indexOf(tr.t); at !== -1; at = w.word.indexOf(tr.t, at + 1)) {
      for (let k = at; k < at + tr.t.length; k++) if (map[k] === -1) map[k] = ti;
    }
  });
  return map;
}

const letterSpan = (ch, ti) => (ti === -1 || ch === ' '
  ? esc(ch)
  : `<span class="sp-trap" style="--t:${TRAP_COLORS[ti % TRAP_COLORS.length]}">${esc(ch)}</span>`);

// The word with its tricky letters colored; from..to picks a slice (one syllable).
function marked(w, from = 0, to = w.word.length) {
  const map = trapMap(w);
  return [...w.word.slice(from, to)].map((ch, i) => letterSpan(ch, map[from + i])).join('');
}

const nikud = (w) => w.syllables.map(([s]) => s).join('');

// Lays out one cell per syllable, keeping each word of a phrase together on its own line if it must wrap.
function byWord(w, cell) {
  const words = [[]];
  let at = 0;
  w.syllables.forEach(([s, letters]) => {
    if (s === ' ') words.push([]);
    else words.at(-1).push(cell(s, at, at + letters.length));
    at += letters.length;
  });
  return words.map((cells) => `<div class="sp-group">${cells.join('')}</div>`).join('');
}

// Syllable chips read one after another, then the whole word.
function syllables(w) {
  const chips = byWord(w, (s) => `<span class="sp-chip">${esc(s)}</span>`);
  return {
    html: `<div class="sp-row">${chips}</div><div class="sp-arrow">⬇</div><div class="sp-word">${esc(w.word)}</div>`,
    caption: `קוראים לאט, הברה אחרי הברה: ${w.syllables.filter(([s]) => s !== ' ').map(([s]) => esc(s)).join(' · ')}`,
  };
}

// Each sound on top, the letters that write it underneath.
function soundToLetters(w) {
  const cols = byWord(w, (s, from, to) =>
    `<div class="sp-col"><span class="sp-sound">${esc(s)}</span><span class="sp-down">⬇</span><span class="sp-letters">${marked(w, from, to)}</span></div>`);
  return {
    html: `<div class="sp-row sp-cols">${cols}</div>`,
    caption: 'כל צליל נכתב באותיות. האותיות הצבעוניות הן המקומות שבהם קל לטעות',
  };
}

// The tricky letters, each with what to write and what not to.
function traps(w) {
  const cards = w.traps.map((tr, ti) => `
    <div class="sp-trap-card" style="--t:${TRAP_COLORS[ti % TRAP_COLORS.length]}">
      <span class="sp-trap-letter">${esc(tr.t)} ✓</span>
      ${tr.not ? `<span class="sp-trap-not">${esc(tr.not)} ✗</span>` : ''}
      <span class="sp-trap-tip">${esc(tr.tip)}</span>
    </div>`).join('');
  return {
    html: `<div class="sp-word">${marked(w)}</div><div class="sp-trap-list">${cards}</div>`,
    caption: 'שימו לב לאותיות הצבעוניות. אלה המלכודות של המילה',
  };
}

// Meaning and an example sentence with the word highlighted.
function inSentence(w) {
  const sentence = esc(w.sentence).replace(esc(w.word), `<b class="sp-hl">${esc(w.word)}</b>`);
  return {
    html: `<div class="sp-word sp-nikud">${esc(nikud(w))}</div><p class="sp-meaning">${esc(w.meaning)}</p><p class="sp-sentence">${sentence}</p>`,
    caption: 'כשמבינים מה המילה אומרת, קל יותר לזכור איך כותבים אותה',
  };
}

export const METHODS = [
  { id: 'syllables', name: 'בהברות', icon: '🧩', render: syllables },
  { id: 'sounds', name: 'מצליל לאותיות', icon: '🔤', render: soundToLetters },
  { id: 'traps', name: 'מלכודות', icon: '⚠️', render: traps },
  { id: 'sentence', name: 'במשפט', icon: '💬', render: inSentence },
];

export const trapsHelp = (w) => {
  const { html, caption } = traps(w);
  return `<div class="viz-box">${html}</div><p class="viz-caption">${caption}</p>`;
};

export function spellingVizPanel(container, w, startIndex = 0) {
  let idx = startIndex;
  const draw = () => {
    const { html, caption } = METHODS[idx].render(w);
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
}
