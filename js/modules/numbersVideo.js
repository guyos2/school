// מספרים טבעיים: an animated explainer "video" about place value and reading big numbers.
// Scenes play line by line with big subtitles; the device's Hebrew voice reads each line when there is one,
// otherwise every line stays on screen long enough to read. Used by numbers.js (#/kid/<kid>/numbers/video).
import { esc, later, viewSignal } from '../ui.js';
import { PLACES, PCOLOR, CLASS_NAME, fmt, words } from '../viz/numbers.js';
import { hasHebrewVoice, speakHe, stopSpeech } from '../speech.js';
import { logSession } from '../store.js';

// ---------- building blocks for the stage ----------
// A row of houses, one per digit (biggest place on the left). o: { labels, values, hl, vpop } are sets of places.
function houses(s, o = {}) {
  const has = (k, p) => o[k]?.has(p);
  const n = s.length;
  return `<div class="vh-row ltr">${[...s].map((d, i) => {
    const p = n - 1 - i;
    return `<div class="vh ${has('hl', p) ? 'on' : ''} ${has('dim', p) ? 'dim' : ''}" style="--c:${PCOLOR[p]}">
      <div class="vh-roof"></div>
      <div class="vh-body"><b>${d}</b></div>
      <div class="vh-label ${has('labels', p) ? 'show' : ''} ${has('popLabel', p) ? 'vpop' : ''}">${PLACES[p]}</div>
      <div class="vh-val ${has('values', p) ? 'show' : ''} ${has('pop', p) ? 'vpop' : ''}">${fmt(+d * 10 ** p)}</div>
    </div>`;
  }).join('')}</div>`;
}
const range = (a, b) => new Set(Array.from({ length: b - a + 1 }, (_, i) => a + i));
const one = (p) => new Set([p]);

// The ×10 chain: 1 → 10 → 100 → 1,000 (k = how many steps are shown).
function chain(k) {
  const items = [1, 10, 100, 1000].slice(0, k + 1);
  const card = (v, i) => `<div class="vc ${i === k ? 'vpop' : ''}" style="--c:${PCOLOR[i]}"><b>${fmt(v)}</b><small>${['אחת', 'עשרת', 'מאה', 'אלף'][i]}</small>${cubes(i)}</div>`;
  return `<div class="vc-row ltr">${items.map(card).reverse().join('<span class="vc-arrow">×10<br>←</span>')}</div>`;
}
// A small picture of the base-ten block for 1, 10, 100, 1000.
function cubes(i) {
  if (i === 0) return '<span class="vb vb1"></span>';
  if (i === 1) return '<span class="vb vb10"></span>';
  if (i === 2) return '<span class="vb vb100"></span>';
  return '<span class="vb vb1000"></span>';
}

// A big number split into classes; show: 'raw' | 'commas' | 'labels'; hl = class; said = classes whose words are shown.
function classRow(n, { show = 'labels', hl = -1, said = new Set(), popWord = -1 } = {}) {
  const s = String(n);
  if (show === 'raw') return `<div class="vg-raw ltr">${[...s].map((d, i) => `<span style="--c:${PCOLOR[s.length - 1 - i]}">${d}</span>`).join('')}</div>`;
  const chunks = [];
  for (let end = s.length; end > 0; end -= 3) chunks.unshift(s.slice(Math.max(0, end - 3), end));
  const wordOf = (cls) => {
    const v = Math.floor(n / 1000 ** cls) % 1000;
    return v ? words(v * 1000 ** cls) : '(לא קוראים)';
  };
  return `<div class="vg-row ltr">${chunks.map((d, i) => {
    const cls = chunks.length - 1 - i;
    return `${i ? '<span class="vg-comma vpop">,</span>' : ''}<div class="vg ${cls === hl ? 'on' : ''}" style="--c:${PCOLOR[cls * 3]}">
      <b>${d}</b>${show === 'labels' ? `<small class="vpop">${CLASS_NAME[cls]}</small>` : ''}
      ${said.has(cls) ? `<span class="vg-word ${cls === popWord ? 'vpop' : ''}">${esc(wordOf(cls))}</span>` : ''}</div>`;
  }).join('')}</div>`;
}

const title = (t) => `<h2 class="v-title">${t}</h2>`;

// ---------- the script ----------
// Each line: cap (the subtitle), say (what the voice reads; defaults to cap), view(): the stage.
const script = (name) => [
  { title: 'סוד המספרים', lines: [
    { cap: `שלום ${name}! 👋 היום נגלה את הסוד של המספרים.`, say: `שלום ${name}! היום נגלה את הסוד של המספרים.`,
      view: () => `${title('הסוד של המספרים 🔢')}<div class="vg-raw ltr v-float">${[2, 5, 4, 6, 2, 7].map((d, i) => `<span class="vpop" style="--c:${PCOLOR[5 - i]};animation-delay:${i * 0.15}s">${d}</span>`).join('')}</div>` },
    { cap: 'הסוד: לכל ספרה יש בית. הבית קובע כמה הספרה שווה.',
      view: () => `${title('לכל ספרה יש בית 🏠')}${houses('254627', { labels: range(0, 5), popLabel: range(0, 5) })}` },
  ] },
  { title: 'אותה ספרה, ערך אחר', lines: [
    { cap: 'הנה המספר 333.', say: 'הנה המספר שלוש מאות שלושים ושלוש.', view: () => houses('333') },
    { cap: 'שלוש ספרות זהות, אבל כל אחת שווה משהו אחר!', view: () => houses('333', { labels: range(0, 2), popLabel: range(0, 2) }) },
    { cap: 'ה-3 בבית האחדות שווה 3.', say: 'השלוש בבית האחדות שווה שלוש.', view: () => houses('333', { labels: range(0, 2), values: one(0), pop: one(0), hl: one(0) }) },
    { cap: 'ה-3 בבית העשרות שווה 30, כלומר שלוש עשרות.', say: 'השלוש בבית העשרות שווה שלושים. כלומר, שלוש עשרות.', view: () => houses('333', { labels: range(0, 2), values: range(0, 1), pop: one(1), hl: one(1) }) },
    { cap: 'וה-3 בבית המאות שווה 300!', say: 'והשלוש בבית המאות שווה שלוש מאות!', view: () => houses('333', { labels: range(0, 2), values: range(0, 2), pop: one(2), hl: one(2) }) },
    { cap: 'ביחד: 300 + 30 + 3 = 333', say: 'ביחד: שלוש מאות, ועוד שלושים, ועוד שלוש. זה שלוש מאות שלושים ושלוש.',
      view: () => `${houses('333', { labels: range(0, 2), values: range(0, 2) })}<div class="v-eq ltr vpop">300 + 30 + 3 = 333</div>` },
  ] },
  { title: 'כל בית פי 10', lines: [
    { cap: 'כל בית שווה פי 10 מהבית שמימין לו.', say: 'כל בית שווה פי עשר מהבית שמימין לו.', view: () => `${title('פי 10 ✖️')}${chain(0)}` },
    { cap: '10 אחדות הן עשרת אחת.', say: 'עשר אחדות הן עשרת אחת.', view: () => chain(1) },
    { cap: '10 עשרות הן מאה אחת.', say: 'עשר עשרות הן מאה אחת.', view: () => chain(2) },
    { cap: 'ו-10 מאות הן אלף!', say: 'ועשר מאות הן אלף!', view: () => chain(3) },
  ] },
  { title: 'מספר גדול', lines: [
    { cap: 'עכשיו מספר גדול: 254,627', say: `עכשיו מספר גדול: ${words(254627)}.`, view: () => houses('254627') },
    { cap: 'סופרים את הבתים מימין: אחדות, עשרות, מאות.', view: () => houses('254627', { labels: range(0, 2), popLabel: range(0, 2), hl: range(0, 2) }) },
    { cap: 'וממשיכים: אלפים, עשרות אלפים, מאות אלפים.', view: () => houses('254627', { labels: range(0, 5), popLabel: range(3, 5), hl: range(3, 5) }) },
    { cap: 'ספרת המאות היא 6. היא שווה 600.', say: 'ספרת המאות היא שש. היא שווה שש מאות.', view: () => houses('254627', { labels: range(0, 5), values: one(2), pop: one(2), hl: one(2) }) },
    { cap: 'ספרת האלפים היא 4. היא שווה 4,000.', say: 'ספרת האלפים היא ארבע. היא שווה ארבעת אלפים.', view: () => houses('254627', { labels: range(0, 5), values: range(2, 3), pop: one(3), hl: one(3) }) },
    { cap: 'וה-2 הראשון, בבית מאות האלפים, שווה 200,000!', say: 'והשתיים הראשונה, בבית מאות האלפים, שווה מאתיים אלף!', view: () => houses('254627', { labels: range(0, 5), values: range(0, 5), pop: one(5), hl: one(5) }) },
  ] },
  { title: 'האפס שומר מקום', lines: [
    { cap: 'ומה עושה ה-0? הוא שומר על בית ריק.', say: 'ומה עושה האפס? הוא שומר על בית ריק.', view: () => houses('507', { labels: range(0, 2) }) },
    { cap: 'ב-507 אין עשרות, וה-0 שומר להן את המקום.', say: 'בחמש מאות ושבע אין עשרות. האפס שומר להן את המקום.', view: () => houses('507', { labels: range(0, 2), hl: one(1), values: range(0, 2), pop: range(0, 2) }) },
    { cap: 'בלי ה-0 היינו מקבלים 57. זה מספר אחר לגמרי!', say: 'בלי האפס היינו מקבלים חמישים ושבע. זה מספר אחר לגמרי!',
      view: () => `${houses('507', { labels: range(0, 2) })}<div class="v-vs vpop"><span class="ltr">507</span> ≠ <span class="ltr struck">57</span></div>` },
  ] },
  { title: 'מחלקים לשלשות', lines: [
    { cap: 'איך קוראים מספר ארוך? מחלקים אותו לשלשות, ומתחילים מימין.', say: 'איך קוראים מספר ארוך? מחלקים אותו לשלשות, ומתחילים מימין.', view: () => classRow(1025041, { show: 'raw' }) },
    { cap: 'אחרי כל שלוש ספרות שמים פסיק: 1,025,041', say: 'אחרי כל שלוש ספרות שמים פסיק.', view: () => classRow(1025041, { show: 'commas' }) },
    { cap: 'כל שלשה היא מחלקה: יחידות, אלפים, מיליונים.', view: () => classRow(1025041) },
  ] },
  { title: 'קוראים שלשה אחרי שלשה', lines: [
    { cap: 'קוראים כל שלשה כמו מספר קטן, ואז את שם המחלקה.', view: () => classRow(1025041) },
    { cap: '1 במחלקת המיליונים: מיליון.', say: 'אחת במחלקת המיליונים: מיליון.', view: () => classRow(1025041, { hl: 2, said: one(2), popWord: 2 }) },
    { cap: '025 במחלקת האלפים: עשרים וחמישה אלף.', say: 'עשרים וחמש במחלקת האלפים: עשרים וחמישה אלף.', view: () => classRow(1025041, { hl: 1, said: range(1, 2), popWord: 1 }) },
    { cap: '041 במחלקת היחידות: ארבעים ואחת.', say: 'ארבעים ואחת במחלקת היחידות: ארבעים ואחת.', view: () => classRow(1025041, { hl: 0, said: range(0, 2), popWord: 0 }) },
    { cap: `ביחד: ${words(1025041)}.`, view: () => `${classRow(1025041, { said: range(0, 2) })}<div class="v-words vpop">${words(1025041)}</div>` },
  ] },
  { title: 'אפסים ושלוש ספרות', lines: [
    { cap: 'את האפסים בהתחלה של שלשה לא קוראים.', view: () => classRow(500006) },
    { cap: '500,006 קוראים: חמש מאות אלף ושש.', say: 'את המספר הזה קוראים: חמש מאות אלף ושש.', view: () => `${classRow(500006, { said: range(0, 1), popWord: 0 })}<div class="v-words vpop">חמש מאות אלף ושש</div>` },
    { cap: 'וכשכותבים, אחרי פסיק יש תמיד 3 ספרות. לכן את השש כותבים 006.', say: 'וכשכותבים, אחרי פסיק יש תמיד שלוש ספרות. לכן את השש כותבים אפס, אפס, שש.',
      view: () => `${classRow(500006, { hl: 0 })}<div class="v-vs vpop"><span class="ltr">500,006</span> ✔ · <span class="ltr struck">500,6</span> ✘</div>` },
  ] },
  { title: 'לסיכום', lines: [
    { cap: 'לסיכום, שלושה סודות:', view: () => summary(0) },
    { cap: '1. כל ספרה שווה לפי הבית שלה.', say: 'אחת: כל ספרה שווה לפי הבית שלה.', view: () => summary(1) },
    { cap: '2. מחלקים לשלשות מימין, עם פסיק.', say: 'שתיים: מחלקים לשלשות מימין, עם פסיק.', view: () => summary(2) },
    { cap: '3. קוראים כל שלשה, ואז את שם המחלקה.', say: 'שלוש: קוראים כל שלשה, ואז את שם המחלקה.', view: () => summary(3) },
    { cap: 'עכשיו תורכם! 💪', say: 'עכשיו תורכם!', view: () => summary(3) },
  ] },
];

function summary(k) {
  const tips = ['🏠 כל ספרה שווה לפי הבית שלה', '✂️ מחלקים לשלשות מימין, עם פסיק', '🗣️ קוראים כל שלשה, ואז את שם המחלקה'];
  return `${title('3 סודות')}<ol class="v-tips">${tips.slice(0, k).map((t, i) => `<li class="${i === k - 1 ? 'vpop' : ''}">${t}</li>`).join('')}</ol>`;
}

// ---------- the player ----------
export function video(outer, kid, base, { back = base } = {}) {
  const scenes = script(kid.name);
  const lines = scenes.flatMap((S, si) => S.lines.map((L, li) => ({ ...L, scene: si, first: li === 0 })));
  const voice = hasHebrewVoice();
  let i = 0, playing = false, sound = voice, token = 0;
  const begin = Date.now();
  viewSignal().addEventListener('abort', stopSpeech);

  outer.innerHTML = '<div class="v-player"></div>';
  const root = outer.firstElementChild;
  root.innerHTML = `
    <a class="back" href="${back}">→ חזרה</a>
    <h1 class="page-title">🎬 הסוד של המספרים</h1>
    <div class="v-screen">
      <div class="v-scene-name" id="scene"></div>
      <div class="v-stage" id="stage"></div>
      <div class="v-cap" id="cap"></div>
      <div class="v-start" id="start"><button class="v-bigplay" aria-label="הפעלה">▶</button><span>לחצו כדי להתחיל</span></div>
    </div>
    <div class="v-bar"><div class="v-fill" id="fill"></div></div>
    <div class="v-controls ltr">
      <button class="v-btn" id="prev" aria-label="אחורה">⏮</button>
      <button class="v-btn v-main" id="play" aria-label="הפעלה או עצירה">▶</button>
      <button class="v-btn" id="next" aria-label="קדימה">⏭</button>
      <button class="v-btn" id="snd" aria-label="קול" ${voice ? '' : 'disabled'}>${voice ? '🔊' : '🔇'}</button>
    </div>
    <div class="v-chapters">${scenes.map((S, k) => `<button class="v-chap" data-k="${k}">${k + 1}. ${esc(S.title)}</button>`).join('')}</div>
    ${voice ? '' : '<p class="subtitle small">במכשיר הזה אין קול בעברית, אז הסרטון מוצג עם כתוביות. אפשר לבקש ממבוגר להקריא אותן.</p>'}
    <div id="end"></div>`;
  const $ = (s) => root.querySelector(s);

  const draw = () => {
    const L = lines[i];
    $('#scene').textContent = `${L.scene + 1}. ${scenes[L.scene].title}`;
    $('#stage').innerHTML = L.view();
    $('#cap').textContent = L.cap;
    $('#cap').classList.remove('vpop'); void $('#cap').offsetWidth; $('#cap').classList.add('vpop');
    $('#fill').style.width = `${((i + 1) / lines.length) * 100}%`;
    root.querySelectorAll('.v-chap').forEach((b) => b.classList.toggle('on', +b.dataset.k === L.scene));
    $('#play').textContent = playing ? '⏸' : '▶';
  };

  // Show line i and, while playing, move on when the voice ends (or after a reading pause without voice).
  const run = () => {
    const my = ++token;
    draw();
    if (!playing) { stopSpeech(); return; }
    const L = lines[i];
    const step = () => { if (my !== token || !playing) return; if (i < lines.length - 1) { i++; run(); } else finish(); };
    const readMs = Math.max(2600, L.cap.length * 90);
    if (sound && speakHe(L.say || L.cap, { onend: () => later(L.first ? 900 : 600, step) })) {
      later(readMs + 6000, step); // in case the voice never reports that it ended
    } else later(readMs, step);
  };

  const finish = () => {
    playing = false;
    draw();
    logSession(kid.id, { module: 'numbers', part: 'video', total: 0, correct: 0, ms: Date.now() - begin });
    $('#end').innerHTML = `
      <div class="finish"><h1>🎉 סוף הסרטון!</h1>
        <div class="row-center">
          <a class="btn btn-big" href="${base}/write/lesson">📖 להסבר עם שאלות</a>
          <a class="btn" href="${base}/write/steps">🪜 לבנות בשלבים</a>
          <button class="btn btn-soft" id="replay">🔁 לראות שוב</button>
        </div></div>`;
  };

  const setPlaying = (v) => { playing = v; $('#start').hidden = true; $('#end').innerHTML = ''; run(); };

  root.addEventListener('click', (e) => {
    if (e.target.closest('#start')) return setPlaying(true);
    if (e.target.closest('#play')) return setPlaying(!playing);
    if (e.target.closest('#next')) { if (i < lines.length - 1) i++; return run(); }
    if (e.target.closest('#prev')) { if (i > 0) i--; return run(); }
    if (e.target.closest('#snd')) { sound = !sound; $('#snd').textContent = sound ? '🔊' : '🔇'; return run(); }
    if (e.target.closest('#replay')) { i = 0; return setPlaying(true); }
    const ch = e.target.closest('.v-chap');
    if (ch) { i = lines.findIndex((L) => L.scene === +ch.dataset.k); $('#start').hidden = true; run(); }
  });
  draw();
}
