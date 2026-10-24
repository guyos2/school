// Visualizations for English letters and words.
import { esc } from '../ui.js';
import { speakBtn, wireSpeakButtons, say } from '../speech.js';

// Hebrew approximation of how a simple word sounds: c-a-t → ק-אַ-ט.
export function hebSounds(word, byLetter) {
  const parts = [...word.toLowerCase()].map((ch) => byLetter[ch]?.heb ?? ch);
  return parts.filter((p, i) => p !== parts[i - 1]);
}

function picture(L, data) {
  const word = data.word;
  return {
    html: `
      <div class="lt-big en">${L}${L.toLowerCase()}</div>
      <div class="lt-emoji">${data.emoji}</div>
      <div class="lt-word en"><b>${esc(word[0])}</b>${esc(word.slice(1))} ${speakBtn(`${L}. ${word}`)}</div>`,
    caption: `${esc(data.he)} באנגלית זה ${'<span class="en">' + esc(word) + '</span>'}, והמילה מתחילה באות ${L}`,
  };
}

function sound(L, data) {
  return {
    html: `
      <div class="lt-sound"><span class="en lt-mid">${L}${L.toLowerCase()}</span><span class="lt-eq">⟵ נשמעת כמו ⟵</span><span class="heb-big">${data.heb}</span></div>
      <div class="lt-word en"><b>${esc(data.word[0])}</b>${esc(data.word.slice(1))} ${data.emoji} ${speakBtn(data.word)}</div>`,
    caption: `האות ${L} נשמעת כמו <b>${data.heb}</b>, כמו בהתחלה של המילה <span class="en">${esc(data.word)}</span>${data.note ? `<br>💡 ${esc(data.note)}` : ''}`,
  };
}

// Letters look different in different fonts (especially a and g): show several.
function cases(L, data, tips) {
  const l = L.toLowerCase();
  const fonts = [['Rubik', 'רגיל'], ['Georgia, serif', 'בספר'], ['"Comic Sans MS", "Chalkboard SE", cursive', 'בכתב יד']];
  return {
    html: `
      <div class="lt-pair en"><span>${L}</span><span class="lt-arrow">↔</span><span>${l}</span></div>
      <div class="lt-fonts">${fonts.map(([f, name]) =>
        `<div><span class="en" style="font-family:${f}">${L}${l}</span><small>${name}</small></div>`).join('')}</div>`,
    caption: `${L} היא האות הגדולה, ו-${'<span class="en">' + l + '</span>'} היא האות הקטנה. זו אותה אות!${tips[l] ? `<br>💡 ${esc(tips[l])}` : ''}`,
  };
}

function trace(L) {
  return {
    html: `
      <div class="trace-switch"><button class="btn btn-soft" data-case="U">${L}</button><button class="btn btn-soft" data-case="l">${L.toLowerCase()}</button></div>
      <canvas class="trace" width="300" height="300"></canvas>
      <button class="btn btn-soft trace-clear">🧽 למחוק</button>`,
    caption: 'עוברים עם האצבע (או עם העכבר) על האות האפורה',
    mount(box) {
      const canvas = box.querySelector('canvas');
      const ctx = canvas.getContext('2d');
      const dpr = window.devicePixelRatio || 1;
      canvas.width = 300 * dpr; canvas.height = 300 * dpr;
      ctx.scale(dpr, dpr);
      let ch = L;
      const guide = () => {
        ctx.clearRect(0, 0, 300, 300);
        ctx.fillStyle = '#e6e2f5';
        ctx.font = '700 240px Rubik, Arial, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(ch, 150, ch === ch.toLowerCase() && /[gjpqy]/.test(ch) ? 120 : 160);
        ctx.strokeStyle = getComputedStyle(canvas).getPropertyValue('--kid').trim() || '#5b4cdb';
        ctx.lineWidth = 14; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      };
      let drawing = false;
      const pos = (e) => { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) * 300 / r.width, (e.clientY - r.top) * 300 / r.height]; };
      canvas.addEventListener('pointerdown', (e) => { drawing = true; canvas.setPointerCapture(e.pointerId); ctx.beginPath(); ctx.moveTo(...pos(e)); });
      canvas.addEventListener('pointermove', (e) => { if (drawing) { ctx.lineTo(...pos(e)); ctx.stroke(); } });
      canvas.addEventListener('pointerup', () => { drawing = false; });
      box.querySelector('.trace-clear').onclick = guide;
      box.querySelectorAll('[data-case]').forEach((b) => {
        b.onclick = () => { ch = b.dataset.case === 'U' ? L : L.toLowerCase(); guide(); };
      });
      guide();
    },
  };
}

const LETTER_METHODS = [
  { name: 'תמונה ומילה', icon: '🖼️', render: picture },
  { name: 'איך זה נשמע', icon: '👂', render: sound },
  { name: 'גדולה וקטנה', icon: '🔠', render: cases },
  { name: 'כותבים', icon: '✏️', render: trace },
];

export function letterPanel(container, L, data, tips, startIndex = 0) {
  let idx = startIndex;
  const draw = () => {
    const m = LETTER_METHODS[idx];
    const out = m.render(L, data, tips);
    container.innerHTML = `
      <div class="viz-tabs">${LETTER_METHODS.map((x, i) =>
        `<button class="viz-tab ${i === idx ? 'active' : ''}" data-i="${i}">${x.icon} ${x.name}</button>`).join('')}</div>
      <div class="viz-box">${out.html}</div>
      <p class="viz-caption">${out.caption}</p>
      <button class="btn btn-soft viz-next">🔄 תראו לי בדרך אחרת</button>`;
    out.mount?.(container.querySelector('.viz-box'));
  };
  container.addEventListener('click', (e) => {
    const tab = e.target.closest('.viz-tab');
    if (tab) { idx = +tab.dataset.i; draw(); }
    else if (e.target.closest('.viz-next')) { idx = (idx + 1) % LETTER_METHODS.length; draw(); }
  });
  wireSpeakButtons(container);
  draw();
}

// Sound blending: letter tiles with their Hebrew sound, then "join" them into the word.
export function blendPanel(container, item, byLetter) {
  const letters = [...item.w];
  const sounds = letters.map((ch) => byLetter[ch.toLowerCase()]?.heb ?? ch);
  container.innerHTML = `
    <div class="viz-box">
      <div class="blend en">${letters.map((ch, i) =>
        `<button class="tile" data-i="${i}"><span class="tile-l">${esc(ch)}</span><span class="tile-h">${sounds[i]}</span></button>`).join('')}</div>
      <div class="blend-result" hidden>
        <div class="lt-emoji">${item.e ?? ''}</div>
        <div class="lt-word en">${esc(item.w)} ${speakBtn(item.w)}</div>
        <div class="blend-heb">קוראים: <b>${hebSounds(item.w, byLetter).join('')}</b>${item.he ? ` · פירוש: ${esc(item.he)}` : ''}</div>
      </div>
    </div>
    <p class="viz-caption">לוחצים על כל אות ואומרים את הצליל שלה, ואז מחברים</p>
    <div class="row-center"><button class="btn btn-big blend-go">🧲 לחבר!</button></div>`;
  const blend = container.querySelector('.blend');
  blend.addEventListener('click', (e) => {
    const t = e.target.closest('.tile');
    if (!t) return;
    t.classList.remove('pop'); void t.offsetWidth; t.classList.add('pop');
  });
  container.querySelector('.blend-go').onclick = () => {
    const tiles = [...blend.children];
    tiles.forEach((t, i) => setTimeout(() => t.classList.add('pop'), i * 450));
    setTimeout(() => {
      blend.classList.add('joined');
      container.querySelector('.blend-result').hidden = false;
      say(item.w);
    }, tiles.length * 450 + 200);
  };
  wireSpeakButtons(container);
}
