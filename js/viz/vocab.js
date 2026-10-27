// Visualizations for an English vocabulary word: picture and meaning, in a sentence, related words, sound and spelling.
import { esc, mixed } from '../ui.js';
import { canSpeak, speakBtn, wireSpeakButtons } from '../speech.js';

export const POS = { n: 'שם עצם', v: 'פועל', adj: 'תואר', prep: 'מילת יחס', phrase: 'ביטוי' };

// "be located (in)" is spoken and filled in as "be located in".
export const spoken = (en) => en.replace(/[()]/g, '');
export const gapAnswer = (w) => w.gapAns || spoken(w.en);
export const fillGap = (w) => w.gap.replace('___', gapAnswer(w));

// A pattern that finds the word inside a sentence, also with an ending (lands, activities, located).
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export function wordPattern(w) {
  const core = spoken(w.gapAns || w.en).replace(/^be /, '').replace(/ in$/, '');
  return core.endsWith('y') ? `${reEsc(core.slice(0, -1))}(?:y|ies)` : `${reEsc(core)}\\w*`;
}

export function highlight(sentence, w, cls = 'vo-hl') {
  const m = sentence.match(new RegExp(`\\b${wordPattern(w)}`, 'i'));
  if (!m) return esc(sentence);
  const i = m.index;
  return `${esc(sentence.slice(0, i))}<span class="${cls}">${esc(m[0])}</span>${esc(sentence.slice(i + m[0].length))}`;
}

function meaning(w) {
  const rel = [w.syn && `דומה: ${mixed(w.syn)}`, w.opp && `הפך: ${mixed(w.opp)}`].filter(Boolean);
  return {
    html: `
      <div class="vo-card">
        <div class="vo-emoji">${w.emoji}</div>
        <div class="vo-word en">${esc(w.en)} ${speakBtn(spoken(w.en))}</div>
        <div class="vo-pos">${POS[w.pos] ?? ''}</div>
        <div class="vo-he">${esc(w.he)}</div>
      </div>`,
    caption: rel.length ? rel.join(' · ') : 'מסתכלים על התמונה ואומרים את המילה בקול. כך קל יותר לזכור',
  };
}

function inSentence(w) {
  return {
    html: `
      <div class="vo-sentence en">${highlight(w.ex, w)} ${speakBtn(w.ex)}</div>
      <div class="vo-sentence-he">${esc(w.exHe)}</div>
      <div class="vo-sentence en vo-second">${highlight(fillGap(w), w)} ${speakBtn(fillGap(w))}</div>`,
    caption: 'המילה בשני משפטים מהחיים. נסו להגיד משפט משלכם עם המילה',
  };
}

// Word family, synonyms and opposites around the word; words without a family get a second example instead.
function related(w) {
  const family = (w.family || []).filter(([en]) => en !== w.syn);
  const items = [
    ...family.map(([en, he]) => ({ en, he, tag: 'מאותה משפחה' })),
    ...(w.syn ? [{ en: w.syn, he: 'אותו דבר בערך', tag: 'דומה' }] : []),
    ...(w.opp ? [{ en: w.opp.replace(/\s*\(.*\)/, ''), he: w.opp.match(/\((.*)\)/)?.[1] ?? '', tag: 'הפך' }] : []),
  ];
  if (!items.length) {
    return {
      html: `<div class="vo-family"><div class="vo-root en">${esc(w.en)}</div></div>
        <p class="vo-tip">${mixed(w.tip)}</p>`,
      caption: 'למילה הזו אין ברשימה מילים מאותה משפחה, אז הנה טיפ לזכור אותה',
    };
  }
  return {
    html: `
      <div class="vo-family">
        <div class="vo-root en">${esc(w.en)}</div>
        <div class="vo-branches">${items.map((x) => `
          <div class="vo-branch"><span class="vo-tag">${x.tag}</span><b class="en">${esc(x.en)}</b><span>${esc(x.he)}</span></div>`).join('')}</div>
      </div>`,
    caption: 'מי שמכיר מילה אחת מהמשפחה מנחש בקלות את האחרות',
  };
}

// Syllables with the stressed one marked (it is written in capitals in the data), plus a spelling tip.
function sound(w) {
  const parts = w.syl.split(/([·\s]+)/);
  const chips = parts.map((p) => {
    if (/^[·\s]+$/.test(p)) return p.includes(' ') ? '<span class="vo-space"></span>' : '';
    const stressed = p.length > 1 && p === p.toUpperCase();
    return `<span class="vo-syl ${stressed ? 'vo-stress' : ''}">${esc(p.toLowerCase())}</span>`;
  }).join('');
  return {
    html: `
      <div class="vo-syls en">${chips}</div>
      ${canSpeak ? `<div class="row-center"><button class="btn btn-soft" data-say="${esc(spoken(w.en))}">🔊 להקשיב</button></div>` : ''}
      <p class="vo-tip">💡 ${mixed(w.tip)}</p>`,
    caption: 'ההברה המודגשת היא זו שאומרים חזק יותר',
  };
}

export const METHODS = [
  { id: 'meaning', name: 'תמונה ופירוש', icon: '🖼️', render: meaning },
  { id: 'sentence', name: 'במשפט', icon: '📝', render: inSentence },
  { id: 'related', name: 'מילים קרובות', icon: '🌳', render: related },
  { id: 'sound', name: 'הברות ואיות', icon: '🔊', render: sound },
];

// The card shown after a wrong answer: the picture and meaning, plus a second visualization (the sentence by default).
export function wordHelp(w, methodId = 'sentence') {
  const { html } = meaning(w);
  const more = METHODS.find((m) => m.id === methodId).render(w);
  return `<div class="viz-box">${html}</div><div class="viz-box">${more.html}</div><p class="viz-caption">${more.caption}</p>`;
}

export function vocabPanel(container, w, startIndex = 0) {
  let idx = startIndex;
  const draw = () => {
    const m = METHODS[idx];
    const { html, caption } = m.render(w);
    container.innerHTML = `
      <div class="viz-tabs">${METHODS.map((x, i) =>
        `<button class="viz-tab ${i === idx ? 'active' : ''}" data-i="${i}">${x.icon} ${x.name}</button>`).join('')}</div>
      <div class="viz-box">${html}</div>
      <p class="viz-caption">${caption}</p>
      <button class="btn btn-soft viz-next">🔄 תראו לי בדרך אחרת</button>`;
  };
  wireSpeakButtons(container);
  container.addEventListener('click', (e) => {
    const tab = e.target.closest('.viz-tab');
    if (tab) { idx = +tab.dataset.i; draw(); }
    else if (e.target.closest('.viz-next')) { idx = (idx + 1) % METHODS.length; draw(); }
  });
  draw();
  return { set(nw) { w = nw; draw(); } };
}
