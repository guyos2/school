// מתמטיקה (Itamar, grade 8): review for the quiz on ratio, map scale, circles, percent, Pythagoras and corresponding angles.
// Material: unit with "kind": "math" (content/units/itamar/2026-11-24-math.json): rules, traps and the class sheet
// (each sheet item names a generator from mathGen.js with the sheet's own numbers). Practice draws fresh numbers.
// Item keys m8:<skill> and m8:sheet:<id>. Session parts: <topic>, mix, sheet, mock (with score).
// Views: menu, learn/<topic>, sheet[/<chapter>], practice/<topic|mix>, mock.
import { esc, shuffle, pick, PRAISE, viewSignal } from '../ui.js';
import { getProgress, saveProgress, logSession } from '../store.js';
import { review, pickSession, MASTERED_BOX } from '../srs.js';
import { panel, tx, fmt } from '../viz/math.js';
import { GEN, TOPICS, make, skillsOf } from './mathGen.js';

const cache = {};
async function loadUnit(kidId) {
  cache[kidId] ??= fetch(`content/units/${kidId}/index.json`).then((r) => r.json())
    .then(({ units }) => Promise.all(units.map((f) => fetch(`content/units/${kidId}/${f}`).then((r) => r.json()))))
    .then((all) => all.find((u) => u.kind === 'math') || null)
    .catch(() => { cache[kidId] = undefined; return null; });
  return cache[kidId];
}

// "Include the deeper questions (group A)": a per-device preference.
const DEEP_KEY = 'school:m8:deep';
const getDeep = () => { try { return localStorage.getItem(DEEP_KEY) !== '0'; } catch { return true; } };
const setDeep = (on) => { try { localStorage.setItem(DEEP_KEY, on ? '1' : '0'); } catch { /* ignore */ } };

const CH = Object.fromEntries(Object.entries(TOPICS).map(([id, t]) => [t.ch, id]));
const sheetItem = (it) => ({ ...make(it.gen, it.args), key: `m8:sheet:${it.id}`, sheet: it });
const sheetTopic = (it) => GEN[it.gen].topic;
const card = (href, icon, title, sub) => `<a class="card" href="${href}"><span class="card-icon">${icon}</span><span class="card-title">${title}</span><span class="card-sub">${sub}</span></a>`;
const ruleHtml = (s) => tx(s);

// ---------- answers ----------
function parseNum(raw) {
  let s = String(raw).trim().replace(/\s+/g, '').replace(/[%°₪]|ש"ח/g, '').replace('−', '-');
  if (!s) return NaN;
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
  else s = s.replace(',', '.');
  return /^-?(\d+\.?\d*|\.\d+)$/.test(s) ? Number(s) : NaN;
}
const close = (v, a, approx) => Math.abs(v - a) <= (approx ? Math.max(0.011, Math.abs(a) * 0.002) : 1e-6);
// → { ok, note }
function checkPart(p, vals) {
  if (p.kind === 'choice') return { ok: vals[0] === p.ans };
  const nums = vals.map(parseNum);
  if (nums.some(Number.isNaN)) return { ok: false, note: 'זה לא מספר' };
  if (p.kind === 'num') return { ok: close(nums[0], p.ans, p.approx) };
  const ok = nums.every((v, i) => v === p.ans[i]);
  if (ok) return { ok };
  const k = nums[0] / p.ans[0];
  if (k > 0 && nums.every((v, i) => Math.abs(v - p.ans[i] * k) < 1e-9)) return { ok: false, note: p.kind === 'frac' ? 'שבר שווה, אבל לא מצומצם' : 'יחס שווה, אבל לא מצומצם עד הסוף' };
  return { ok: false };
}
const ansText = (p) => (p.kind === 'ratio' ? tx(`$${p.ans.join(' : ')}$`) : p.kind === 'frac' ? tx(`$${p.ans[0]}/${p.ans[1]}$`)
  : p.kind === 'choice' ? esc(p.ans) : tx(`$${p.pre ? `${p.pre} ` : ''}${fmt(p.ans)}$`) + (p.unit ? ` ${esc(p.unit)}` : ''));

function partHtml(p, i) {
  let input;
  if (p.kind === 'num') input = `${p.pre ? `<span class="m8-pre">${esc(p.pre)}</span>` : ''}<input class="m8-box" inputmode="decimal" autocomplete="off" data-i="${i}">`;
  else if (p.kind === 'ratio') input = p.ans.map(() => `<input class="m8-box m8-sm" inputmode="numeric" autocomplete="off" data-i="${i}">`).join('<b class="m8-colon">:</b>');
  else if (p.kind === 'frac') input = `<span class="m8-frac"><input class="m8-box m8-sm" inputmode="numeric" data-i="${i}"><i></i><input class="m8-box m8-sm" inputmode="numeric" data-i="${i}"></span>`;
  else input = p.options.map((o) => `<button class="btn btn-soft m8-ch" data-i="${i}" data-v="${esc(o)}">${esc(o)}</button>`).join('');
  return `<div class="m8-part" data-i="${i}">
    ${p.label || p.q ? `<span class="m8-plabel">${p.label ? `<b>${p.label}.</b> ` : ''}${tx(p.q || '')}</span>` : ''}
    <span class="m8-ans"><span class="m8-in" dir="ltr">${input}</span>${p.unit ? `<span class="m8-unit">${esc(p.unit)}</span>` : ''}</span>
    <span class="m8-mark"></span></div>`;
}
const partValues = (root, i) => {
  const ch = root.querySelector(`.m8-ch.on[data-i="${i}"]`);
  if (root.querySelector(`.m8-ch[data-i="${i}"]`)) return [ch ? ch.dataset.v : ''];
  return [...root.querySelectorAll(`.m8-box[data-i="${i}"]`)].map((x) => x.value);
};
const stepsHtml = (steps, n = steps.length) => `<ol class="m8-steps">${steps.slice(0, n).map((s) => `<li>${tx(s)}</li>`).join('')}</ol>`;
const headHtml = (q) => `<div class="m8-head"><span class="m8-chip">${TOPICS[q.topic].icon} ${TOPICS[q.topic].title}</span>${q.sheet ? `<span class="m8-chip m8-sheet">📄 מהדף: פרק ${TOPICS[q.topic].ch}' שאלה ${esc(q.sheet.n)}</span>` : ''}${q.deep ? '<span class="m8-chip m8-deep">⭐ העמקה (הקבצה א\')</span>' : ''}</div>`;

// ---------- the practice engine: one question (with its parts) at a time ----------
// next(q) → a fresh question for a retry (new numbers) or the same one.
function runMath(outer, { back, questions, retry, onDone, kid }) {
  const progress = getProgress(kid.id);
  const queue = [...questions], total = questions.length, missed = new Set();
  const begin = Date.now();
  let i = 0, right = 0;
  outer.innerHTML = '<div class="quiz m8"></div>';
  const root = outer.firstElementChild;

  const show = () => {
    const q = queue[i];
    let shown = 0, done = false;
    root.innerHTML = `
      <a class="back" href="${back}">→ חזרה</a>
      <div class="progress-bar"><div class="progress-fill" style="width:${(i / queue.length) * 100}%"></div></div>
      <div class="q-card m8-card">${headHtml(q)}
        ${q.retry ? '<p class="m8-retry">🔁 עוד אחת מאותו סוג, עם מספרים אחרים</p>' : ''}
        <p class="m8-text">${tx(q.text)}</p>
        <div class="m8-parts">${q.parts.map(partHtml).join('')}</div>
        <div id="hints"></div>
        <div class="q-feedback" id="fb"></div>
        <div class="row-center" id="acts"><button class="btn btn-soft" id="hint">💡 רמז</button><button class="btn btn-soft" id="idk">🤷 לא יודעים</button><button class="btn btn-big" id="check">בדיקה ✓</button></div>
      </div>
      <div id="help"></div>`;
    const $ = (s) => root.querySelector(s);
    root.querySelector('.m8-box')?.focus({ preventScroll: true });
    const finish = (giveUp) => {
      const vals = q.parts.map((_, k) => partValues(root, k));
      if (!giveUp && vals.some((v) => v.some((x) => !String(x).trim()))) { $('#fb').textContent = 'מלאו את כל התשובות 🙂'; $('#fb').className = 'q-feedback'; return; }
      done = true;
      const res = q.parts.map((p, k) => (giveUp ? { ok: false } : checkPart(p, vals[k])));
      const ok = res.every((r) => r.ok);
      res.forEach((r, k) => {
        const el = root.querySelector(`.m8-part[data-i="${k}"]`);
        el.classList.add(r.ok ? 'ok' : 'no');
        el.querySelector('.m8-mark').innerHTML = r.ok ? '✓' : `✗ ${ansText(q.parts[k])}${r.note ? ` <small>(${r.note})</small>` : ''}`;
        el.querySelectorAll('input, .m8-ch').forEach((x) => { x.disabled = true; });
      });
      if (!q.retry) {
        progress.items[q.key] = review(progress.items[q.key], ok, ok && !shown ? 0 : 20000);
        if (ok) right++;
      }
      $('#hints').innerHTML = '';
      $('#acts').innerHTML = '<button class="btn btn-big" id="next">ממשיכים ←</button>';
      if (ok) {
        $('#fb').textContent = pick(PRAISE); $('#fb').className = 'q-feedback good';
        $('#help').innerHTML = `<details class="panel wide m8-sol"><summary>📝 הפתרון המלא</summary>${stepsHtml(q.steps)}</details>`;
      } else {
        $('#fb').textContent = 'כמעט! הנה הפתרון, צעד אחרי צעד 👇'; $('#fb').className = 'q-feedback bad';
        $('#help').innerHTML = `<div class="help-box"><div class="panel wide m8-sol">${stepsHtml(q.steps)}</div><div class="m8-help-viz"></div></div>`;
        panel($('.m8-help-viz'), q.viz, q.vstart || 0);
        if (!missed.has(q.key)) { missed.add(q.key); queue.push({ ...retry(q), retry: true }); }
      }
      $('#next').onclick = next;
      $('#next').focus({ preventScroll: true });
    };
    root.querySelector('.m8-card').addEventListener('click', (e) => {
      const ch = e.target.closest('.m8-ch');
      if (ch && !done) { root.querySelectorAll(`.m8-ch[data-i="${ch.dataset.i}"]`).forEach((b) => b.classList.toggle('on', b === ch)); return; }
      if (e.target.closest('#check')) finish(false);
      else if (e.target.closest('#idk')) finish(true);
      else if (e.target.closest('#hint')) {
        shown = Math.min(shown + 1, Math.max(1, q.steps.length - 1));
        $('#hints').innerHTML = `<div class="m8-hint">${stepsHtml(q.steps, shown)}</div>`;
        if (shown >= q.steps.length - 1) $('#hint').disabled = true;
      }
    });
    root.querySelector('.m8-parts').addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || done) return;
      const boxes = [...root.querySelectorAll('.m8-box')], at = boxes.indexOf(e.target);
      if (at >= 0 && at < boxes.length - 1 && !boxes[at + 1].value) boxes[at + 1].focus(); else finish(false);
    });
  };
  const next = () => { i++; if (i < queue.length) show(); else end(); };
  const end = () => {
    saveProgress(progress);
    onDone({ right, total, ms: Date.now() - begin });
  };
  document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && root.querySelector('#next') && !e.target.matches('input')) next(); }, { signal: viewSignal() });
  show();
}

function finish(root, base, { right, total }, again, extra = '') {
  const ratio = right / Math.max(total, 1);
  root.innerHTML = `<div class="finish"><div class="stars">${'⭐'.repeat(ratio >= 0.9 ? 3 : ratio >= 0.6 ? 2 : 1)}</div>
    <h1>סיימתם את הסיבוב!</h1><p class="subtitle">${right} נכונות בניסיון הראשון מתוך ${total}</p>${extra}
    <div class="row-center"><button class="btn btn-big" id="again">עוד סיבוב</button><a class="btn btn-soft" href="${base}">לתפריט 📐</a></div></div>`;
  root.querySelector('#again').onclick = again;
}

// ---------- routes ----------
export async function renderMath(root, kid, [view = 'menu', ...args]) {
  const base = `#/kid/${kid.id}/math`;
  const U = await loadUnit(kid.id);
  if (!U) { root.innerHTML = '<p class="subtitle">עוד אין חומר לנושא הזה.</p>'; return; }
  if (view === 'learn') return learn(root, base, U, TOPICS[args[0]] ? args[0] : 'ratio');
  if (view === 'sheet') return args[0] ? runSheet(root, kid, base, U, decodeURIComponent(args[0])) : sheetMenu(root, kid, base, U);
  if (view === 'practice') return practice(root, kid, base, U, args[0] || 'mix');
  if (view === 'mock') return mockIntro(root, kid, base, U);
  menu(root, kid, base, U);
}

function allKeys(U) { return [...Object.keys(GEN).map((s) => `m8:${s}`), ...U.sheet.map((s) => `m8:sheet:${s.id}`)]; }

function menu(root, kid, base, U) {
  const p = getProgress(kid.id);
  const keys = allKeys(U);
  const known = keys.filter((k) => (p.items[k]?.box || 0) >= MASTERED_BOX).length;
  const tests = p.sessions.filter((s) => s.module === 'math' && s.part === 'mock');
  const deep = getDeep();
  const weak = Object.keys(TOPICS).map((t) => {
    const ks = skillsOf(t).map((s) => `m8:${s}`).filter((k) => p.items[k]);
    const wr = ks.reduce((a, k) => a + (p.items[k].wrong || 0), 0), all = ks.reduce((a, k) => a + (p.items[k].seen || 0), 0);
    return { t, rate: all ? wr / all : null };
  });
  const mark = (t) => { const w = weak.find((x) => x.t === t); return w.rate == null ? 'עוד לא תרגלתם' : w.rate > 0.34 ? 'כדאי לחזק 💪' : 'הולך טוב ✅'; };
  root.innerHTML = `
    <h1 class="page-title">📐 מתמטיקה: חזרה לבוחן</h1>
    <p class="subtitle">${esc(U.source)}<br>בשליטה: ${known} מתוך ${keys.length}</p>
    <label class="m8-toggle"><input type="checkbox" id="deep" ${deep ? 'checked' : ''}> כולל שאלות העמקה ⭐ (הקבצה א')</label>
    <h2 class="section">1. דף החזרה מהכיתה</h2>
    <div class="cards">${card(`${base}/sheet`, '📄', 'דף החזרה', 'כל השאלות מהדף, אחת אחת, עם פתרון מלא')}</div>
    <h2 class="section">2. ללמוד: כללים, דוגמה פתורה, ו-4 דרכים לראות</h2>
    <div class="cards">${Object.entries(TOPICS).map(([id, t]) => card(`${base}/learn/${id}`, t.icon, t.title, `פרק ${t.ch}'`)).join('')}</div>
    <h2 class="section">3. תרגול עם מספרים חדשים בכל פעם</h2>
    <div class="cards">${card(`${base}/practice/mix`, '🎯', 'תרגול מעורב', 'כל הנושאים, יותר ממה שעוד קשה')}
      ${Object.entries(TOPICS).map(([id, t]) => card(`${base}/practice/${id}`, t.icon, t.title, mark(id))).join('')}</div>
    <h2 class="section">4. מבחן</h2>
    <div class="cards">${card(`${base}/mock`, '🏁', 'בוחן לדוגמה', `שאלה מכל פרק, ציון מתוך 100${tests.length ? `<br><small>אחרון: ${tests.at(-1).score}</small>` : ''}`)}</div>`;
  root.querySelector('#deep').onchange = (e) => setDeep(e.target.checked);
}

// ---------- learn ----------
function learn(root, base, U, topic) {
  const T = TOPICS[topic];
  const skills = skillsOf(topic, false);
  let si = 0;
  root.innerHTML = `
    <a class="back" href="${base}">→ חזרה</a>
    <h1 class="page-title">${T.icon} ${T.title}</h1>
    <div class="sc-tabs">${Object.entries(TOPICS).map(([id, t]) => `<a class="viz-tab ${id === topic ? 'active' : ''}" href="${base}/learn/${id}">${t.icon} ${t.title}</a>`).join('')}</div>
    <div class="panel wide m8-rules"><h2 class="m8-h">📌 מה צריך לדעת</h2><ul>${U.rules[topic].map((r) => `<li>${ruleHtml(r)}</li>`).join('')}</ul>
      <h2 class="m8-h">⚠️ מלכודות</h2><ul>${U.traps[topic].map((r) => `<li>${ruleHtml(r)}</li>`).join('')}</ul></div>
    <h2 class="section">דוגמה פתורה</h2>
    <div class="panel wide" id="ex"></div>
    <div id="viz"></div>
    <div class="row-center"><button class="btn btn-soft" id="other">🔄 דוגמה אחרת</button><a class="btn btn-big" href="${base}/practice/${topic}">לתרגל ✏️</a></div>`;
  let pn = null;
  const draw = () => {
    const q = make(skills[si % skills.length]);
    root.querySelector('#ex').innerHTML = `<p class="m8-text">${tx(q.text)}</p>
      <ul class="m8-exparts">${q.parts.map((p) => `<li>${p.label ? `<b>${p.label}.</b> ` : ''}${tx(p.q || '')} ${p.q ? '→' : ''} <b>${ansText(p)}</b></li>`).join('')}</ul>
      <p class="m8-h3">איך פותרים:</p>${stepsHtml(q.steps)}`;
    if (pn) pn.set(q.viz); else pn = panel(root.querySelector('#viz'), q.viz, 0);
  };
  root.querySelector('#other').onclick = () => { si++; draw(); };
  draw();
}

// ---------- the class sheet ----------
function sheetMenu(root, kid, base, U) {
  const p = getProgress(kid.id), deep = getDeep();
  root.innerHTML = `
    <a class="back" href="${base}">→ חזרה</a>
    <h1 class="page-title">📄 דף החזרה</h1>
    <p class="subtitle">השאלות מהדף עם המספרים של המורה. כל טעות מראה פתרון מלא וציור, ואז מנסים שאלה דומה.</p>
    <div class="cards">${card(`${base}/sheet/all`, '📄', 'כל הדף', `${U.sheet.filter((s) => deep || !GEN[s.gen].deep).length} שאלות לפי הסדר`)}
      ${Object.entries(TOPICS).map(([id, t]) => {
        const its = U.sheet.filter((s) => sheetTopic(s) === id && (deep || !GEN[s.gen].deep));
        const done = its.filter((s) => (p.items[`m8:sheet:${s.id}`]?.right || 0) > 0).length;
        return card(`${base}/sheet/${t.ch}`, t.icon, `פרק ${t.ch}': ${t.title}`, `${done} מתוך ${its.length} נפתרו נכון`);
      }).join('')}</div>`;
}
function runSheet(root, kid, base, U, ch) {
  const deep = getDeep();
  const topic = CH[ch];
  const items = U.sheet.filter((s) => (ch === 'all' || sheetTopic(s) === topic) && (deep || !GEN[s.gen].deep));
  runMath(root, { kid, back: `${base}/sheet`, questions: items.map(sheetItem), retry: (q) => make(q.skill),
    onDone: (r) => {
      logSession(kid.id, { module: 'math', part: 'sheet', unit: U.id, total: r.total, correct: r.right, ms: r.ms });
      finish(root, base, r, () => runSheet(root, kid, base, U, ch));
    } });
}

// ---------- practice ----------
function practice(root, kid, base, U, topic) {
  if (topic !== 'mix' && !TOPICS[topic]) topic = 'mix';
  const skills = skillsOf(topic, getDeep());
  const keys = skills.map((s) => `m8:${s}`);
  const n = topic === 'mix' ? 10 : Math.min(8, Math.max(6, skills.length));
  let chosen = pickSession(getProgress(kid.id).items, shuffle(keys), n, { maxNew: topic === 'mix' ? 5 : 8 });
  while (chosen.length < n) chosen.push(pick(keys)); // a topic has fewer skills than questions: repeat with new numbers
  chosen = shuffle(chosen);
  runMath(root, { kid, back: base, questions: chosen.map((k) => make(k.slice(3))), retry: (q) => make(q.skill),
    onDone: (r) => {
      logSession(kid.id, { module: 'math', part: topic, unit: U.id, total: r.total, correct: r.right, ms: r.ms });
      finish(root, base, r, () => practice(root, kid, base, U, topic), topic === 'mix' ? '' : `<div class="row-center"><a class="btn btn-soft" href="${base}/learn/${topic}">📖 לחזור לכללים</a></div>`);
    } });
}

// ---------- mock quiz ----------
function buildMock(deep) {
  const qs = [];
  for (const t of Object.keys(TOPICS)) {
    const basic = skillsOf(t, false).filter((s) => !GEN[s].deep);
    qs.push(make(pick(basic)));
    if (deep) qs.push(make(pick(skillsOf(t).filter((s) => GEN[s].deep))));
    else qs.push(make(pick(basic.filter((s) => s !== qs.at(-1).skill))));
  }
  return qs;
}
function mockIntro(root, kid, base, U) {
  const tests = getProgress(kid.id).sessions.filter((s) => s.module === 'math' && s.part === 'mock');
  const deep = getDeep();
  root.innerHTML = `
    <a class="back" href="${base}">→ חזרה</a>
    <h1 class="page-title">🏁 בוחן לדוגמה</h1>
    <div class="panel">
      <p>שש פרקים כמו בדף: יחס ופרופורציה, קנה מידה, מעגל ועיגול, אחוזים, פיתגורס וזוויות מתאימות. שתי שאלות בכל פרק${deep ? ', אחת מהן שאלת העמקה ⭐' : ''}.</p>
      <p>אין משוב באמצע. כדאי לפתור על דף ולהקליד את התשובות. בסוף מקבלים ציון מתוך 100, ציון לכל פרק, וכל טעות עם פתרון מלא וציור. כל בוחן נבנה מחדש עם מספרים אחרים.</p>
      ${tests.length ? `<p class="muted">בחנים קודמים: ${tests.slice(-5).map((s) => s.score).join(' · ')}</p>` : ''}
      <div class="row-center"><button class="btn btn-big" id="start">מתחילים ✍️</button></div>
    </div>`;
  root.querySelector('#start').onclick = () => runMock(root, kid, base, U, buildMock(deep));
}
function runMock(outer, kid, base, U, qs) {
  const begin = Date.now();
  outer.innerHTML = '<div class="mt m8"></div>';
  const root = outer.firstElementChild;
  let confirm = false, lastTopic = '';
  root.innerHTML = `<a class="back" href="${base}">→ חזרה</a><h1 class="page-title">🏁 בוחן לדוגמה</h1>
    ${qs.map((q, n) => {
      const head = q.topic !== lastTopic ? `<h2 class="mt-task">פרק ${TOPICS[q.topic].ch}': ${TOPICS[q.topic].title}</h2>` : '';
      lastTopic = q.topic;
      return `${head}<div class="mt-q m8-mq" data-q="${n}"><p class="m8-text"><b>${n + 1}.</b> ${q.deep ? '<span class="m8-chip m8-deep">⭐ העמקה</span> ' : ''}${tx(q.text)}</p>
        <div class="m8-parts">${q.parts.map((p, k) => partHtml(p, `${n}-${k}`)).join('')}</div></div>`;
    }).join('')}
    <p class="subtitle" id="msg"></p>
    <div class="row-center"><button class="btn btn-big" id="submit">הגשה ✅</button></div>`;
  root.addEventListener('click', (e) => {
    const ch = e.target.closest('.m8-ch');
    if (ch) { root.querySelectorAll(`.m8-ch[data-i="${ch.dataset.i}"]`).forEach((b) => b.classList.toggle('on', b === ch)); return; }
    if (!e.target.closest('#submit')) return;
    const vals = qs.map((q, n) => q.parts.map((_, k) => partValues(root, `${n}-${k}`)));
    const empty = vals.flat().filter((v) => v.some((x) => !String(x).trim())).length;
    if (empty && !confirm) { confirm = true; root.querySelector('#msg').textContent = `נשארו ${empty} תשובות ריקות. לוחצים שוב על הגשה כדי להגיש בכל זאת.`; return; }
    mockResults(outer, kid, base, U, qs, vals, Date.now() - begin);
  }, { signal: viewSignal() });
}
function mockResults(outer, kid, base, U, qs, vals, ms) {
  const progress = getProgress(kid.id);
  const by = {};
  let good = 0, all = 0;
  const res = qs.map((q, n) => {
    const r = q.parts.map((p, k) => (vals[n][k].some((x) => !String(x).trim()) ? { ok: false, empty: true } : checkPart(p, vals[n][k])));
    const ok = r.every((x) => x.ok);
    progress.items[q.key] = review(progress.items[q.key], ok, 20000);
    by[q.topic] ??= { good: 0, all: 0 };
    r.forEach((x) => { by[q.topic].all++; all++; if (x.ok) { by[q.topic].good++; good++; } });
    return { q, n, r, ok };
  });
  saveProgress(progress);
  const score = Math.round((100 * good) / all);
  logSession(kid.id, { module: 'math', part: 'mock', unit: U.id, score, total: qs.length, correct: res.filter((x) => x.ok).length, ms });
  const verdict = score >= 90 ? 'מצוין! אתם מוכנים לבוחן 🏆' : score >= 75 ? 'טוב מאוד! עוברים על הטעויות, והציון יעלה עוד 💪'
    : score >= 55 ? 'בדרך הנכונה. כדאי לחזור לכללים ולתרגל את הפרקים החלשים' : 'כדאי לחזור לכללים ולדף החזרה, ואז לנסות שוב 🙂';
  outer.innerHTML = '<div class="mt m8"></div>';
  const root = outer.firstElementChild;
  const wrong = res.filter((x) => !x.ok);
  root.innerHTML = `
    <div class="finish"><p class="subtitle">הציון בבוחן</p><div class="sp-grade">${score}</div><h1>${verdict}</h1>
      <p class="subtitle">${good} תשובות נכונות מתוך ${all} · ${Math.max(1, Math.round(ms / 6e4))} דקות</p></div>
    <div class="kpis">${Object.entries(by).map(([t, b]) => `<div class="kpi"><span class="kpi-num">${b.good}<small>/${b.all}</small></span><span class="kpi-label">${TOPICS[t].icon} ${TOPICS[t].title}</span></div>`).join('')}</div>
    ${wrong.length ? `<h2 class="section">הטעויות, עם פתרון מלא</h2><div class="mt-review">${wrong.map(({ q, n, r }) => `
      <div class="mt-mistake"><p class="m8-text"><b>${n + 1}.</b> ${tx(q.text)}</p>
        <ul class="m8-exparts">${q.parts.map((p, k) => `<li class="${r[k].ok ? 'ok' : 'no'}">${p.label ? `<b>${p.label}.</b> ` : ''}${tx(p.q || '')} ${r[k].ok ? '✓' : `✗ ${r[k].empty ? 'לא עניתם' : esc(vals[n][k].join(p.kind === 'ratio' ? ' : ' : p.kind === 'frac' ? '/' : ''))} · ✓ ${ansText(p)}${r[k].note ? ` <small>(${r[k].note})</small>` : ''}`}</li>`).join('')}</ul>
        ${stepsHtml(q.steps)}<div class="m8-mviz" data-n="${n}"></div></div>`).join('')}</div>` : '<p class="subtitle">🎉 אין אף טעות!</p>'}
    <div class="row-center"><button class="btn btn-big" id="again">בוחן נוסף</button><a class="btn btn-soft" href="${base}">לתפריט 📐</a></div>`;
  window.scrollTo(0, 0);
  root.querySelectorAll('.m8-mviz').forEach((el) => { const q = qs[+el.dataset.n]; panel(el, q.viz, q.vstart || 0); });
  root.querySelector('#again').onclick = () => mockIntro(outer, kid, base, U);
}
