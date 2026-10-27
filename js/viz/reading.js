// Reading comprehension (Unseen): the text with the unit's words marked, and how to approach the questions.
import { esc } from '../ui.js';
import { wordPattern } from './vocab.js';

// One regex for all the unit's words; the longest first, so "tour guide" wins over "tour".
function wordMatcher(words) {
  const pats = words.map((w) => ({ w, re: new RegExp(`^${wordPattern(w)}$`, 'i'), src: wordPattern(w) }))
    .sort((a, b) => b.src.length - a.src.length);
  const all = new RegExp(`\\b(?:${pats.map((p) => p.src).join('|')})\\b`, 'gi');
  return (text) => {
    let out = '', last = 0;
    for (const m of text.matchAll(all)) {
      const hit = pats.find((p) => p.re.test(m[0]));
      out += esc(text.slice(last, m.index)) + (hit ? `<button class="rd-w en" data-w="${hit.w.id}">${esc(m[0])}</button>` : esc(m[0]));
      last = m.index + m[0].length;
    }
    return out + esc(text.slice(last));
  };
}

// Paragraphs numbered as on a test page; `mark` (a quote from the text) is highlighted.
export function textHtml(T, { words = [], mark = '' } = {}) {
  const tag = words.length ? wordMatcher(words) : esc;
  return T.paragraphs.map((p, i) => {
    const at = mark ? p.indexOf(mark) : -1;
    const body = at < 0 ? tag(p)
      : `${tag(p.slice(0, at))}<mark class="rd-mark">${tag(mark)}</mark>${tag(p.slice(at + mark.length))}`;
    return `<p class="rd-p"><span class="rd-n">${i + 1}</span>${body}</p>`;
  }).join('');
}

// ---------- how to approach an Unseen: 4 ways to see it ----------
function steps() {
  const list = [
    ['👀', 'קוראים את הכותרת', 'מה הנושא? מה כבר יודעים עליו?'],
    ['❓', 'קוראים את השאלות לפני הטקסט', 'כך יודעים מה לחפש בזמן הקריאה'],
    ['📖', 'קוראים את כל הטקסט פעם אחת', 'לא נתקעים על מילה לא מוכרת. ממשיכים, ולרוב מבינים מההקשר'],
    ['🔎', 'לכל שאלה מוצאים את המשפט בטקסט', 'מחפשים בטקסט מילה מהשאלה. התשובה לרוב באותו משפט או במשפט שאחריו'],
    ['✅', 'בודקים שהתשובה עונה על השאלה', 'Where ← מקום, When ← זמן, Why ← סיבה'],
  ];
  return {
    html: `<ol class="rd-steps">${list.map(([icon, t, d]) => `<li><span class="rd-step-i">${icon}</span><b>${t}</b><span>${d}</span></li>`).join('')}</ol>`,
    caption: 'חמישה שלבים קבועים. עושים אותם בכל Unseen, באותו סדר',
  };
}

function questionWords() {
  const rows = [
    ['What', 'מה', 'דבר, פעולה'], ['Where', 'איפה, לאן', 'מקום: in, at, near'], ['When', 'מתי', 'זמן: in October, at six'],
    ['Why', 'למה', 'סיבה: because, so'], ['Who', 'מי', 'אדם או שם'], ['How often', 'באיזו תדירות', 'every day, once a month'],
    ['How many', 'כמה', 'מספר'],
  ];
  return {
    html: `<table class="rd-table"><thead><tr><th>מילת השאלה</th><th>פירוש</th><th>מה מחפשים בטקסט</th></tr></thead>
      <tbody>${rows.map(([en, he, look]) => `<tr><td class="en"><b>${en}</b></td><td>${he}</td><td>${look}</td></tr>`).join('')}</tbody></table>`,
    caption: 'מילת השאלה אומרת איזה סוג תשובה לחפש',
  };
}

function example() {
  return {
    html: `
      <p class="rd-ex-q en">Why do Yoni's tours start <span class="rd-key">early</span>?</p>
      <p class="rd-ex-t en">Yoni's tours start <span class="rd-key">early</span>, at six in the morning, <mark class="rd-mark">because the desert gets very hot at noon</mark>.</p>
      <p class="rd-ex-a">1️⃣ מילת השאלה <b class="en">Why</b>, אז מחפשים סיבה.<br>
        2️⃣ מוצאים בטקסט את המילה <b class="en">early</b> מהשאלה.<br>
        3️⃣ מיד אחריה <b class="en">because</b>, ושם התשובה.</p>`,
    caption: 'מילת מפתח מהשאלה מובילה אל המשפט הנכון בטקסט',
  };
}

function traps() {
  const list = [
    ['NOT', 'What does Tamar NOT do?', 'מחפשים את התשובה היחידה שלא כתובה בטקסט'],
    ['only / all / never', 'True or False? Noa takes pictures only of places.', 'מילה חזקה כזו הופכת משפט לא נכון בקלות. בודקים מילה במילה'],
    ['they / it / he', '"They" refers to ___', 'מחפשים את מה שהוזכר לפני המילה, בדרך כלל במשפט הקודם'],
    ['Find a word that means', 'Find a word in paragraph 2 that means...', 'מחפשים רק בפסקה שכתובה בשאלה, ומנסים להחליף את המילה בפירוש'],
  ];
  return {
    html: `<div class="rd-traps">${list.map(([k, q, tip]) => `
      <div class="rd-trap"><b class="en">${k}</b><span class="en rd-trap-q">${esc(q)}</span><span>${tip}</span></div>`).join('')}</div>`,
    caption: 'ארבע מלכודות שחוזרות בכל מבחן',
  };
}

export const METHODS = [
  { id: 'steps', name: 'השלבים', icon: '🪜', render: steps },
  { id: 'words', name: 'מילות שאלה', icon: '❓', render: questionWords },
  { id: 'example', name: 'דוגמה', icon: '🔎', render: example },
  { id: 'traps', name: 'מלכודות', icon: '🪤', render: traps },
];

export function strategyPanel(container, startIndex = 0) {
  let idx = startIndex;
  const draw = () => {
    const { html, caption } = METHODS[idx].render();
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
