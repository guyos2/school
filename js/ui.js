// Small shared UI helpers.

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Math expressions must render left-to-right inside the RTL page.
export const ltr = (s) => `<span class="ltr">${s}</span>`;

export const COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#84cc16', '#6366f1'];

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export const PRAISE = ['כל הכבוד! 🎉', 'מעולה! ⭐', 'יופי! 👏', 'נכון! 💪', 'אלופים! 🏆', 'בדיוק! ✨'];

// Every route gets a fresh AbortSignal so listeners and timers from the
// previous screen stop when the user navigates away.
let viewCtrl = new AbortController();
export function newView() {
  viewCtrl.abort();
  viewCtrl = new AbortController();
  return viewCtrl.signal;
}
export const viewSignal = () => viewCtrl.signal;

export function later(ms, fn) {
  const signal = viewSignal();
  setTimeout(() => { if (!signal.aborted) fn(); }, ms);
}

// On-screen numeric keypad; keyboard digits work too.
export function keypad(container, { onDigit, onBack, onEnter }) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '✓'];
  container.innerHTML = `<div class="keypad ltr">${keys.map((k) =>
    `<button class="key ${k === '✓' ? 'key-enter' : ''}" data-k="${k}">${k}</button>`).join('')}</div>`;
  container.querySelector('.keypad').addEventListener('click', (e) => {
    const k = e.target.closest('.key')?.dataset.k;
    if (!k) return;
    if (k === '⌫') onBack(); else if (k === '✓') onEnter(); else onDigit(k);
  });
  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea')) return;
    if (/^[0-9]$/.test(e.key)) onDigit(e.key);
    else if (e.key === 'Backspace') onBack();
    else if (e.key === 'Enter') onEnter();
  }, { signal: viewSignal() });
}
