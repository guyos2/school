// הכתבה: word lists from class. Learn how each word is written, practice choosing the right spelling,
// and a dictation: the app reads the words, the kid writes on paper and photographs the page for a grade.
import { esc, shuffle, later, viewSignal } from '../ui.js';
import { spellingVizPanel, trapsHelp } from '../viz/spelling.js';
import { runQuiz, finishScreen } from '../quiz.js';
import { hasHebrewVoice, sayHe } from '../speech.js';
import { getProgress, saveProgress, logSession, isOnline, apiFetch } from '../store.js';
import { review, MASTERED_BOX } from '../srs.js';

const cache = {};
const load = (file) => (cache[file] ??= fetch(`content/dictation/${file}.json`).then((r) => r.json()));

const keyOf = (listId, i) => `dc:${listId}:${i}`;
const box = (items, k) => items[k]?.box || 0;
const nikud = (w) => w.syllables.map(([s]) => s).join('');

export async function renderDictation(root, kid, [view = 'menu', listId, ...args]) {
  const base = `#/kid/${kid.id}/dictation`;
  const index = await load('index');
  const lists = index.lists.filter((l) => l.kid === kid.id);
  const meta = lists.find((l) => l.id === listId);
  if (!meta) return menu(root, base, lists);
  const L = await load(listId);
  if (view === 'learn') return learn(root, base, L, +args[0] || 0);
  if (view === 'practice') return practice(root, kid, base, L);
  if (view === 'test') return test(root, kid, base, L);
  return listPage(root, kid, base, meta, L);
}

function menu(root, base, lists) {
  root.innerHTML = `
    <h1 class="page-title">✏️ הכתבה</h1>
    <p class="subtitle">בוחרים רשימת מילים</p>
    <div class="cards">${lists.map((l) =>
      `<a class="card" href="${base}/list/${l.id}"><span class="card-icon">${l.icon}</span><span class="card-title">${esc(l.title)}</span></a>`).join('')}</div>`;
}

function listPage(root, kid, base, meta, L) {
  const items = getProgress(kid.id).items;
  const keys = L.words.map((_, i) => keyOf(L.id, i));
  const known = keys.filter((k) => box(items, k) >= MASTERED_BOX).length;
  root.innerHTML = `
    <a class="back" href="${base}">→ חזרה</a>
    <h1 class="page-title">${meta.icon} ${esc(L.title)}</h1>
    <p class="subtitle">${L.words.length} מילים · יודעים לכתוב: ${known} מתוך ${L.words.length}</p>
    <div class="cards">
      <a class="card" href="${base}/learn/${L.id}/0"><span class="card-icon">🔍</span><span class="card-title">לומדים את המילים</span><span class="card-sub">איך כל מילה נכתבת לפי הצלילים</span></a>
      <a class="card" href="${base}/practice/${L.id}"><span class="card-icon">🎯</span><span class="card-title">תרגול</span><span class="card-sub">שומעים ובוחרים איך כותבים</span></a>
      <a class="card" href="${base}/test/${L.id}"><span class="card-icon">📝</span><span class="card-title">הכתבה</span><span class="card-sub">כותבים על דף, מצלמים ומקבלים ציון</span></a>
    </div>
    <h2 class="section">המילים</h2>
    <div class="word-grid sp-grid">${L.words.map((w, i) => {
      const k = box(items, keys[i]);
      return `<a class="word-tile sp-tile ${k >= MASTERED_BOX ? 'sp-known' : ''}" href="${base}/learn/${L.id}/${i}">${esc(w.word)}</a>`;
    }).join('')}</div>`;
}

// ---------- learn ----------
function learn(root, base, L, i) {
  const w = L.words[i];
  const voice = hasHebrewVoice();
  root.innerHTML = `
    <a class="back" href="${base}/list/${L.id}">→ חזרה</a>
    <div class="letter-nav">
      <a class="btn btn-soft" href="${base}/learn/${L.id}/${(i + L.words.length - 1) % L.words.length}">→ הקודמת</a>
      <span class="muted">${i + 1} / ${L.words.length}</span>
      <a class="btn btn-soft" href="${base}/learn/${L.id}/${(i + 1) % L.words.length}">הבאה ←</a>
    </div>
    <div class="sp-head">
      <div class="sp-big">${esc(w.word)}</div>
      ${voice ? '<button class="speak" id="say" aria-label="השמעה">🔊</button>' : ''}
    </div>
    <div id="viz"></div>`;
  spellingVizPanel(root.querySelector('#viz'), w);
  root.querySelector('#say')?.addEventListener('click', () => sayHe(w.word));
  if (voice) later(300, () => sayHe(w.word));
}

// ---------- practice: hear the word, pick the right spelling ----------
function blankSentence(w) {
  return esc(w.sentence).replace(esc(w.word), '<span class="sp-blank">_____</span>');
}

function question(root, L, i) {
  const w = L.words[i];
  const wrongs = shuffle(w.wrong).slice(0, 3);
  return {
    key: keyOf(L.id, i),
    answer: w.word,
    onShow: () => {
      later(250, () => sayHe(w.word));
      root.querySelector('.sp-say')?.addEventListener('click', () => sayHe(w.word));
    },
    options: shuffle([w.word, ...wrongs]).map((s) => ({ html: `<span class="sp-choice">${esc(s)}</span>`, value: s })),
    prompt: `
      <p class="q-ask">איך כותבים את המילה?</p>
      ${hasHebrewVoice() ? `<button class="speak sp-say" aria-label="השמעה">🔊</button>` : ''}
      <p class="q-sub">${esc(w.meaning)}</p>
      <p class="q-sub">${blankSentence(w)}</p>`,
    help: () => trapsHelp(w),
  };
}

function practice(root, kid, base, L) {
  const progress = getProgress(kid.id);
  // Words not yet known first, so the weak ones get the most practice.
  const order = shuffle(L.words.map((_, i) => i)).sort((a, b) =>
    box(progress.items, keyOf(L.id, a)) - box(progress.items, keyOf(L.id, b)));
  const questions = order.map((i) => question(root, L, i));
  runQuiz(root, {
    back: `${base}/list/${L.id}`,
    questions,
    onResult: (q, ok, ms) => { progress.items[q.key] = review(progress.items[q.key], ok, ms); },
    onDone: ({ right, total, ms }) => {
      saveProgress(progress);
      logSession(kid.id, { module: 'dictation', part: 'spell', total, correct: right, ms });
      finishScreen(root, {
        right, total,
        again: () => practice(root, kid, base, L),
        links: `<a class="btn btn-soft" href="${base}/test/${L.id}">להכתבה 📝</a>`,
      });
    },
  });
}

// ---------- dictation test ----------
function test(root, kid, base, L) {
  const back = `${base}/list/${L.id}`;
  const order = shuffle(L.words.map((_, i) => i));
  const voice = hasHebrewVoice();
  const begin = Date.now();
  let photo = null; // { dataUrl, b64 }

  const intro = () => {
    root.innerHTML = `
      <a class="back" href="${back}">→ חזרה</a>
      <h1 class="page-title">📝 הכתבה</h1>
      <div class="panel">
        <p>1. קחו דף ועיפרון.</p>
        <p>2. ${voice ? 'נקריא' : 'מבוגר יקריא'} ${L.words.length} מילים, אחת אחרי השנייה. כתבו כל מילה בשורה חדשה עם המספר שלה.</p>
        <p>3. בסוף מצלמים את הדף ומקבלים ציון.</p>
        ${voice ? '' : '<p class="muted">במכשיר הזה אין קול בעברית, אז מבוגר מקריא: לוחצים על ״👀 למבוגר שמקריא״ כדי לראות את המילה.</p>'}
      </div>
      <div class="row-center"><button class="btn btn-big" id="go">מתחילים ✏️</button></div>`;
    root.querySelector('#go').onclick = () => word(0);
  };

  const word = (n) => {
    const w = L.words[order[n]];
    const last = n === order.length - 1;
    root.innerHTML = `
      <a class="back" href="${back}">→ יציאה</a>
      <div class="progress-bar"><div class="progress-fill" style="width:${(n / order.length) * 100}%"></div></div>
      <div class="q-card sp-dict">
        <p class="q-ask">מילה מספר</p>
        <div class="sp-num">${n + 1}</div>
        <p class="muted">כתבו בשורה ${n + 1}</p>
        <div class="row-center">
          ${voice ? '<button class="btn btn-soft" id="again">🔊 שוב</button><button class="btn btn-soft" id="sent">💬 במשפט</button>' : ''}
          <button class="btn btn-soft" id="peek">👀 למבוגר שמקריא</button>
        </div>
        <div id="peeked" class="sp-peek" hidden><div class="sp-word">${esc(nikud(w))}</div><p>${esc(w.sentence)}</p></div>
      </div>
      <div class="row-center">
        ${n > 0 ? '<button class="btn btn-soft" id="prev">→ הקודמת</button>' : ''}
        <button class="btn btn-big" id="next">${last ? 'סיימתי ✓' : 'כתבתי, הבאה ←'}</button>
      </div>`;
    const $ = (s) => root.querySelector(s);
    if (voice) {
      later(400, () => sayHe(`${w.word}|${w.sentence}|${w.word}`));
      $('#again').onclick = () => sayHe(w.word);
      $('#sent').onclick = () => sayHe(w.sentence);
    }
    $('#peek').onclick = () => { $('#peeked').hidden = !$('#peeked').hidden; };
    if ($('#prev')) $('#prev').onclick = () => word(n - 1);
    $('#next').onclick = () => (last ? snap() : word(n + 1));
  };

  const snap = () => {
    if (window.speechSynthesis) speechSynthesis.cancel();
    root.innerHTML = `
      <a class="back" href="${back}">→ יציאה</a>
      <h1 class="page-title">📸 מצלמים את הדף</h1>
      <p class="subtitle">צלמו מלמעלה, באור טוב, כך שכל המילים נראות</p>
      <div class="row-center">
        <label class="btn btn-big sp-file">📷 צילום הדף<input type="file" accept="image/*" capture="environment" id="file" hidden></label>
      </div>
      <div id="preview"></div>
      <div class="row-center"><button class="btn btn-soft" id="self">בלי צילום: בודקים לבד ✓</button></div>`;
    root.querySelector('#self').onclick = () => results(null);
    root.querySelector('#file').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try { photo = await shrink(file); } catch { photo = null; }
      if (!photo) return;
      root.querySelector('#preview').innerHTML = `
        <img class="sp-photo" src="${photo.dataUrl}" alt="הדף שצילמתם">
        <div class="row-center"><button class="btn btn-big" id="check">בדיקה ✓</button></div>`;
      root.querySelector('#check').onclick = grade;
    });
  };

  const grade = async () => {
    const signal = viewSignal();
    root.innerHTML = `<h1 class="page-title">🔍 בודקים…</h1><p class="subtitle">קוראים את מה שכתבתם, זה לוקח כמה שניות</p><img class="sp-photo" src="${photo.dataUrl}" alt="">`;
    let found = null, problem = 'אין חיבור לשרת';
    if (isOnline()) {
      try {
        const r = await apiFetch('/dictation', {
          method: 'POST',
          body: JSON.stringify({ words: order.map((i) => L.words[i].word), image: photo.b64, mediaType: 'image/jpeg' }),
        });
        if (r.ok) found = (await r.json()).results;
        else problem = r.status === 501 ? 'הבדיקה האוטומטית עוד לא הופעלה' : 'הבדיקה לא הצליחה';
      } catch { problem = 'הבדיקה לא הצליחה'; }
    }
    if (signal.aborted) return;
    results(found, found ? '' : `${problem}, אז בודקים לבד: משווים כל מילה לדף ולוחצים ✓ או ✗.`);
  };

  // found: [{ written, ok, legible }] in dictation order, or null for checking by hand.
  const results = (found, note = 'משווים כל מילה לדף ולוחצים ✓ או ✗.') => {
    const marks = order.map((_, n) => (found ? found[n]?.ok ?? null : null));
    const draw = () => {
      const done = marks.every((m) => m !== null);
      const right = marks.filter(Boolean).length;
      const grade = Math.round((100 * right) / order.length);
      root.innerHTML = `
        <a class="back" href="${back}">→ יציאה</a>
        <h1 class="page-title">📝 תוצאות ההכתבה</h1>
        ${done ? `<div class="sp-grade">${grade}</div><p class="subtitle">${right} מתוך ${order.length} מילים נכונות</p>` : ''}
        ${note ? `<p class="subtitle">${note}</p>` : ''}
        ${found ? '<p class="subtitle small">המחשב טעה בקריאה? לוחצים על ✓ או ✗ כדי לתקן.</p>' : ''}
        ${photo ? `<details class="sp-photo-box"><summary>הדף שצילמתם</summary><img class="sp-photo" src="${photo.dataUrl}" alt=""></details>` : ''}
        <div class="sp-results">${order.map((i, n) => {
          const w = L.words[i], f = found?.[n];
          return `
            <div class="sp-res ${marks[n] === true ? 'ok' : marks[n] === false ? 'bad' : ''}">
              <span class="sp-res-n">${n + 1}</span>
              <span class="sp-res-word">${esc(w.word)}</span>
              ${f ? `<span class="sp-res-written">כתבתם: <b>${esc(f.written || '—')}</b>${f.legible ? '' : ' <span class="muted">(לא ברור)</span>'}</span>` : ''}
              <span class="sp-res-btns"><button class="sp-mark ${marks[n] === true ? 'on' : ''}" data-n="${n}" data-v="1" aria-label="נכון">✓</button><button class="sp-mark ${marks[n] === false ? 'on' : ''}" data-n="${n}" data-v="0" aria-label="לא נכון">✗</button></span>
              ${marks[n] === false ? `<div class="sp-res-help">${trapsHelp(w)}</div>` : ''}
            </div>`;
        }).join('')}</div>
        <div class="row-center"><button class="btn btn-big" id="save" ${done ? '' : 'disabled'}>שמירת הציון ✓</button></div>`;
      root.querySelector('.sp-results').addEventListener('click', (e) => {
        const b = e.target.closest('.sp-mark');
        if (!b) return;
        marks[+b.dataset.n] = b.dataset.v === '1';
        draw();
      });
      root.querySelector('#save').onclick = () => save(marks);
    };
    draw();
  };

  const save = (marks) => {
    const progress = getProgress(kid.id);
    order.forEach((i, n) => {
      const k = keyOf(L.id, i);
      progress.items[k] = review(progress.items[k], marks[n], 0);
    });
    saveProgress(progress);
    const right = marks.filter(Boolean).length;
    logSession(kid.id, { module: 'dictation', part: 'test', total: order.length, correct: right, ms: Date.now() - begin });
    const missed = order.filter((_, n) => !marks[n]).map((i) => L.words[i].word);
    finishScreen(root, {
      right, total: order.length,
      extra: `<div class="sp-grade">${Math.round((100 * right) / order.length)}</div>${missed.length
        ? `<p class="subtitle">כדאי לחזור על: ${missed.map(esc).join(', ')}</p>`
        : '<p class="subtitle">🎉 כל המילים נכונות!</p>'}`,
      again: () => test(root, kid, base, L),
      links: `<a class="btn btn-soft" href="${base}/practice/${L.id}">תרגול המילים 🎯</a>`,
    });
  };

  intro();
}

// Phone photos are large; scale down so the upload stays small while the handwriting stays readable.
function shrink(file, maxSide = 1800) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * scale);
      c.height = Math.round(img.naturalHeight * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      const dataUrl = c.toDataURL('image/jpeg', 0.85);
      resolve({ dataUrl, b64: dataUrl.split(',')[1] });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad image')); };
    img.src = url;
  });
}
