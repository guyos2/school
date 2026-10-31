// Parent statistics: how often each kid practices and how fast they progress.
// Everything is computed from the saved progress (sessions + items), so it works offline too.
import { esc, ltr, viewSignal } from './ui.js';
import { getProgress, isOnline, syncKid } from './store.js';
import { MASTERED_BOX } from './srs.js';

const DAY = 864e5;
const PART_TITLES = {
  letters: 'אותיות', reading: 'קריאה',
  part: 'חלק משלם', name: 'שם השבר', add: 'חיבור', compare: 'השוואה',
  'present-simple': 'הווה פשוט',
  spell: 'איות', test: 'הכתבה',
  sub: 'חיסור', mul: 'כפל', mix: 'מעורב', class: 'מהכיתה',
  vocab: 'אוצר מילים', meaning: 'פירוש מילים', typed: 'כתיבת פירוש', grammar: 'דקדוק', unseen: 'Unseen', mock: 'מבחן דמה', gtest: 'מבחן דקדוק', mywords: 'המילים שסימנו',
};
const PREFIX_MODULE = { mul: 'times', en: 'english-letters', fr: 'fractions', gr: 'grammar', dc: 'dictation', col: 'column',
  vo: 'units', ug: 'units', rd: 'units', uw: 'units' };

const dayStart = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const weekStart = (t) => { const d = new Date(dayStart(t)); d.setDate(d.getDate() - d.getDay()); return d.getTime(); };
const addDays = (t, n) => { const d = new Date(t); d.setDate(d.getDate() + n); return d.getTime(); };
const pct = (right, total) => (total ? Math.round((100 * right) / total) : null);
const pctText = (p) => (p == null ? '—' : ltr(`${p}%`));
const minutes = (ms) => Math.round(ms / 6e4);
const dateText = (t) => new Date(t).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });

function ago(t) {
  if (!t) return 'עוד לא תרגלו';
  const days = Math.round((dayStart(Date.now()) - dayStart(t)) / DAY);
  if (days === 0) return 'היום';
  if (days === 1) return 'אתמול';
  return `לפני ${days} ימים`;
}

function summarize(sessions, from) {
  const list = sessions.filter((s) => s.at >= from);
  const total = list.reduce((n, s) => n + (s.total || 0), 0);
  const right = list.reduce((n, s) => n + (s.correct || 0), 0);
  const timed = list.filter((s) => s.ms);
  return {
    count: list.length, total, right, acc: pct(right, total),
    days: new Set(list.map((s) => dayStart(s.at))).size,
    ms: timed.reduce((n, s) => n + Math.min(s.ms, 30 * 6e4), 0), // cap: a tab left open is not practice
    timed: timed.length,
  };
}

// Consecutive days with practice, ending today (or yesterday, so the streak is not lost before today's practice).
function streak(sessions) {
  const days = new Set(sessions.map((s) => dayStart(s.at)));
  let d = dayStart(Date.now());
  if (!days.has(d)) d = addDays(d, -1);
  let n = 0;
  while (days.has(d)) { n++; d = addDays(d, -1); }
  return n;
}

const masteredNow = (items) => Object.values(items).filter((it) => (it.box || 0) >= MASTERED_BOX).length;

export async function renderStats(root, { kids, modules, kidId }) {
  const signal = viewSignal();
  const kid = kids.find((k) => k.id === kidId);
  const draw = () => (kid ? detail(root, kid, modules) : overview(root, kids));
  draw();
  if (!isOnline()) return;
  // Show what is on this device right away, then refresh with progress from the other devices.
  await Promise.allSettled((kid ? [kid] : kids).map((k) => syncKid(k.id)));
  if (!signal.aborted) draw();
}

// ---- all kids ----
function overview(root, kids) {
  const today = dayStart(Date.now());
  const weekAgo = addDays(today, -6);
  root.innerHTML = `
    <h1 class="page-title">📊 סטטיסטיקות</h1>
    <p class="subtitle">כמה כל אחד מתרגל ואיך מתקדמים. לוחצים על ילד לפרטים.</p>
    <div class="stats-kids">${kids.map((k) => {
      const p = getProgress(k.id);
      const w = summarize(p.sessions, weekAgo);
      const last = p.sessions.at(-1)?.at;
      const active = new Set(p.sessions.map((s) => dayStart(s.at)));
      const dots = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13))
        .map((d) => `<span class="dot ${active.has(d) ? 'on' : ''}" title="${dateText(d)}"></span>`).join('');
      return `
        <a class="stats-kid" href="#/stats/${k.id}" style="--c:${k.color}">
          <div class="stats-kid-head"><span class="kid-emoji-sm">${k.emoji}</span><b>${esc(k.name)}</b>
            <span class="muted">תרגול אחרון: ${ago(last)}</span></div>
          <div class="dots ltr" aria-label="ימי תרגול בשבועיים האחרונים">${dots}</div>
          <div class="mini-kpis">
            <span><b>${w.days}</b>/7 ימים</span>
            <span><b>${w.total}</b> תרגילים</span>
            <span><b>${pctText(w.acc)}</b> דיוק</span>
            <span><b>${masteredNow(p.items)}</b> בשליטה</span>
          </div>
        </a>`;
    }).join('')}</div>
    <p class="subtitle small">הנתונים של 7 הימים האחרונים. "בשליטה" = פריטים שנענו נכון ומהר כמה פעמים ברצף.</p>`;
}

// ---- one kid ----
function detail(root, kid, modules) {
  const p = getProgress(kid.id);
  const s = p.sessions;
  const today = dayStart(Date.now());
  const w = summarize(s, addDays(today, -6));
  const m = summarize(s, addDays(today, -29));
  const prevW = summarize(s.filter((x) => x.at < addDays(today, -6)), addDays(today, -13));

  const trend = (now, before) => {
    if (!before) return '';
    const diff = now - before;
    return diff > 0 ? `<small class="up">▲ ${ltr(diff)} משבוע שעבר</small>`
      : diff < 0 ? `<small class="down">▼ ${ltr(-diff)} משבוע שעבר</small>` : '<small class="muted">כמו שבוע שעבר</small>';
  };

  root.innerHTML = `
    <a class="back" href="#/stats">→ כל הילדים</a>
    <h1 class="page-title">${kid.emoji} ${esc(kid.name)}</h1>
    <p class="subtitle">תרגול אחרון: ${ago(s.at(-1)?.at)}</p>
    ${s.length ? '' : '<div class="panel"><p>עוד אין תרגולים שמורים. הנתונים יופיעו כאן אחרי הסיבוב הראשון.</p></div>'}
    <div class="kpis">
      <div class="kpi"><span class="kpi-num">${w.days}<small>/7</small></span><span class="kpi-label">ימי תרגול השבוע</span>${trend(w.days, prevW.days)}</div>
      <div class="kpi"><span class="kpi-num">${streak(s)}</span><span class="kpi-label">ימים ברצף</span></div>
      <div class="kpi"><span class="kpi-num">${w.total}</span><span class="kpi-label">תרגילים השבוע</span>${trend(w.total, prevW.total)}</div>
      <div class="kpi"><span class="kpi-num">${w.timed ? minutes(w.ms) : '—'}</span><span class="kpi-label">דקות תרגול השבוע</span></div>
      <div class="kpi"><span class="kpi-num">${pctText(m.acc)}</span><span class="kpi-label">דיוק בניסיון ראשון (30 יום)</span></div>
      <div class="kpi"><span class="kpi-num">${masteredNow(p.items)}</span><span class="kpi-label">פריטים בשליטה</span></div>
    </div>

    <h2 class="stats-h">📅 ימי תרגול ב-12 השבועות האחרונים</h2>
    <div class="panel wide">${heatmap(s, today)}</div>

    <h2 class="stats-h">📈 תרגילים ודיוק לפי שבוע</h2>
    <div class="panel wide">${weeklyBars(s, today)}</div>

    <h2 class="stats-h">🌱 קצב ההתקדמות: פריטים בשליטה לאורך זמן</h2>
    <div class="panel wide">${masteryChart(s, p.items)}</div>

    <h2 class="stats-h">📚 לפי נושא (30 הימים האחרונים)</h2>
    <div class="panel wide">${moduleTable(kid, s, p.items, modules, addDays(today, -29))}</div>

    <h2 class="stats-h">💪 כדאי לחזק</h2>
    <div class="panel wide" id="weak">${weakSpots(p.items, modules, {})}</div>

    ${unknownWords(p.items)}

    <h2 class="stats-h">🕒 סיבובים אחרונים</h2>
    <div class="panel wide">${recent(s, modules)}</div>`;

  // Grammar items are stored as indexes; load the sentences to name them.
  const topics = [...new Set(Object.keys(p.items).filter((k) => k.startsWith('gr:')).map((k) => k.split(':')[1]))];
  if (topics.length) {
    const signal = viewSignal();
    Promise.all(topics.map((t) => fetch(`content/grammar/${t}.json`).then((r) => r.json()).then((d) => [t, d]).catch(() => [t, null])))
      .then((pairs) => {
        if (signal.aborted) return;
        root.querySelector('#weak').innerHTML = weakSpots(p.items, modules, Object.fromEntries(pairs));
      });
  }
}

function heatmap(sessions, today) {
  const perDay = new Map();
  for (const x of sessions) perDay.set(dayStart(x.at), (perDay.get(dayStart(x.at)) || 0) + (x.total || 0));
  const first = addDays(weekStart(today), -77);
  const level = (n) => (!n ? 0 : n <= 10 ? 1 : n <= 25 ? 2 : n <= 50 ? 3 : 4);
  const cells = [];
  for (let d = first; d <= addDays(weekStart(today), 6); d = addDays(d, 1)) {
    const n = perDay.get(d) || 0;
    cells.push(d > today ? '<span class="cell future"></span>'
      : `<span class="cell l${level(n)}" title="${dateText(d)}: ${n} תרגילים"></span>`);
  }
  return `
    <div class="heat-wrap">
      <div class="heat-days"><span>א׳</span><span></span><span>ג׳</span><span></span><span>ה׳</span><span></span><span>ש׳</span></div>
      <div class="heat ltr">${cells.join('')}</div>
    </div>
    <div class="legend">פחות <span class="cell l0"></span><span class="cell l1"></span><span class="cell l2"></span><span class="cell l3"></span><span class="cell l4"></span> יותר</div>`;
}

function weeklyBars(sessions, today) {
  const weeks = Array.from({ length: 8 }, (_, i) => addDays(weekStart(today), (i - 7) * 7));
  const data = weeks.map((w) => {
    const list = sessions.filter((x) => x.at >= w && x.at < addDays(w, 7));
    const total = list.reduce((n, x) => n + (x.total || 0), 0);
    const right = list.reduce((n, x) => n + (x.correct || 0), 0);
    return { w, total, acc: pct(right, total) };
  });
  const max = Math.max(10, ...data.map((d) => d.total));
  return `
    <div class="bars ltr">${data.map((d) => `
      <div class="bar-col" title="שבוע ${dateText(d.w)}: ${d.total} תרגילים">
        <span class="bar-val">${d.total || ''}</span>
        <div class="bar" style="height:${(100 * d.total) / max}%"></div>
        <span class="bar-acc">${d.acc == null ? '' : `${d.acc}%`}</span>
        <span class="bar-label">${dateText(d.w)}</span>
      </div>`).join('')}</div>
    <p class="small muted">העמודה: תרגילים באותו שבוע (השבוע מתחיל ביום ראשון). המספר מתחת: אחוז התשובות הנכונות בניסיון הראשון.</p>`;
}

function masteryChart(sessions, items) {
  const pts = sessions.filter((x) => typeof x.mastered === 'number').map((x) => [x.at, x.mastered]);
  pts.push([Date.now(), masteredNow(items)]);
  if (pts.length < 2) {
    return '<p class="muted">הגרף נבנה מעכשיו: אחרי כל סיבוב נשמר כמה פריטים בשליטה, וכאן יופיע קצב ההתקדמות.</p>';
  }
  const W = 600, H = 200, PAD = 34;
  const t0 = pts[0][0], t1 = pts.at(-1)[0];
  const max = Math.max(5, ...pts.map((q) => q[1]));
  const x = (t) => PAD + ((W - 2 * PAD) * (t - t0)) / Math.max(t1 - t0, 1);
  const y = (v) => H - PAD - ((H - 2 * PAD) * v) / max;
  const line = pts.map(([t, v]) => `${x(t).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const gained = pts.at(-1)[1] - pts[0][1];
  const days = Math.max(1, Math.round((t1 - t0) / DAY));
  return `
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="פריטים בשליטה לאורך זמן">
      <line x1="${PAD}" y1="${H - PAD}" x2="${W - PAD}" y2="${H - PAD}" class="axis"/>
      <line x1="${PAD}" y1="${y(max)}" x2="${W - PAD}" y2="${y(max)}" class="grid"/>
      <text x="${PAD - 6}" y="${y(max) + 5}" class="tick" text-anchor="end">${max}</text>
      <text x="${PAD - 6}" y="${H - PAD + 5}" class="tick" text-anchor="end">0</text>
      <polyline points="${PAD},${H - PAD} ${line} ${x(t1)},${H - PAD}" class="area"/>
      <polyline points="${line}" class="line"/>
      <circle cx="${x(t1)}" cy="${y(pts.at(-1)[1])}" r="5" class="end"/>
      <text x="${PAD}" y="${H - 8}" class="tick">${dateText(t0)}</text>
      <text x="${W - PAD}" y="${H - 8}" class="tick" text-anchor="end">היום</text>
    </svg>
    <p class="small">${gained >= 0 ? `נוספו <b>${gained}</b>` : `ירדו <b>${-gained}</b>`} פריטים בשליטה ב-${days} ימים.
      <span class="muted">פריט יורד מהשליטה כשטועים בו, ולכן הקו יכול גם לרדת.</span></p>`;
}

function moduleTable(kid, sessions, items, modules, from) {
  const rows = kid.modules.filter((id) => modules[id]?.render).map((id) => {
    const list = sessions.filter((x) => x.module === id);
    const sum = summarize(list, from);
    const its = Object.entries(items).filter(([k]) => PREFIX_MODULE[k.split(':')[0]] === id).map(([, v]) => v);
    const mastered = its.filter((it) => (it.box || 0) >= MASTERED_BOX).length;
    return `
      <tr>
        <td>${modules[id].icon} ${modules[id].title}</td>
        <td>${sum.count}</td>
        <td>${sum.total}</td>
        <td>${pctText(sum.acc)}</td>
        <td>${its.length ? `${mastered} מתוך ${its.length}` : '—'}</td>
        <td>${ago(list.at(-1)?.at)}</td>
      </tr>`;
  });
  return `
    <div class="table-scroll"><table class="stats-table">
      <thead><tr><th>נושא</th><th>סיבובים</th><th>תרגילים</th><th>דיוק</th><th>בשליטה מתוך מה שהתחילו</th><th>אחרון</th></tr></thead>
      <tbody>${rows.join('')}</tbody>
    </table></div>`;
}

function itemLabel(key, grammar) {
  const [prefix, a, b, c] = key.split(':');
  if (prefix === 'mul') return ltr(a.replace('x', ' × '));
  if (prefix === 'fr') return `${a === 'n' ? 'שם השבר ' : ''}${ltr(b)}`;
  if (prefix === 'col') return ltr(`${b} ${{ add: '+', sub: '−', mul: '×' }[a]} ${c}`);
  if (prefix === 'en') return ltr(esc(a === 'L' ? `${b} ${b.toLowerCase()}` : b));
  if (prefix === 'uw') return ltr(esc(a));
  if (prefix === 'vo') return ltr(esc(a.replace(/-/g, ' ')));
  if (prefix === 'ug') return `דקדוק, תרגיל ${+b + 1}`;
  if (prefix === 'rd') return `${ltr(esc(a))}, שאלה ${+b + 1}`;
  if (prefix === 'gr') {
    const d = grammar[a];
    const q = key.endsWith(':q') ? ' ?' : '';
    return d?.subjects[b] && d?.verbs[c] ? ltr(esc(`${d.subjects[b].en} + ${d.verbs[c].base}${q}`)) : 'משפט';
  }
  return esc(key);
}

function weakSpots(items, modules, grammar) {
  const weak = Object.entries(items)
    .filter(([k, it]) => !k.startsWith('uw:') && it.wrong > 0 && (it.box || 0) < MASTERED_BOX)
    .sort(([, x], [, y]) => (x.box || 0) - (y.box || 0) || y.wrong / y.seen - x.wrong / x.seen)
    .slice(0, 12);
  if (!weak.length) return '<p class="muted">אין כרגע פריטים שחוזרים על עצמם בטעויות. 🎉</p>';
  return `
    <div class="weak-list">${weak.map(([k, it]) => {
      const mod = modules[PREFIX_MODULE[k.split(':')[0]]];
      return `<span class="weak" title="${mod?.title ?? ''}">${mod?.icon ?? ''} ${itemLabel(k, grammar)}
        <small>${it.wrong} טעויות מתוך ${it.seen}</small></span>`;
    }).join('')}</div>
    <p class="small muted">פריטים שהיו בהם טעויות ועוד לא בשליטה. התרגול היומי כבר מחזיר אותם יותר, ואפשר גם לעבור עליהם יחד.</p>`;
}

// Words the kid tapped as unknown while reading: general words (uw:) and words from a unit's list (vo: with marked).
function unknownWords(items) {
  const rows = Object.entries(items).filter(([k, it]) => (k.startsWith('uw:') || k.startsWith('vo:')) && it.marked)
    .map(([k, it]) => ({
      en: k.startsWith('uw:') ? it.w : k.slice(3).replace(/-/g, ' '), he: it.he, list: k.startsWith('vo:'),
      n: it.marked, learned: (it.box || 0) >= MASTERED_BOX, updated: it.updated || 0,
    }))
    .sort((a, b) => a.learned - b.learned || b.updated - a.updated);
  if (!rows.length) return '';
  const left = rows.filter((r) => !r.learned).length;
  return `
    <h2 class="stats-h">📌 מילים שסימנו שלא מכירים בקריאה</h2>
    <div class="panel wide">
      <p class="small muted">${left ? `${left} מילים עוד לא בשליטה` : 'כל המילים כבר בשליטה 🎉'}. מילים מהרשימה של המבחן חוזרות בתרגול המילים, והשאר בתרגול "המילים שלי".</p>
      <div class="weak-list">${rows.map((r) => `
        <span class="weak ${r.learned ? 'weak-ok' : ''}">${ltr(esc(r.en))}
          <small>${r.he ? `${esc(r.he)} · ` : ''}${r.list ? 'מהרשימה · ' : ''}סומנה ${r.n === 1 ? 'פעם אחת' : `${r.n} פעמים`}${r.learned ? ' · ✓ בשליטה' : ''}</small></span>`).join('')}</div>
    </div>`;
}

function recent(sessions, modules) {
  if (!sessions.length) return '<p class="muted">אין עדיין.</p>';
  return `<ul class="recent">${sessions.slice(-10).reverse().map((x) => {
    const mod = modules[x.module];
    const when = new Date(x.at).toLocaleString('he-IL', { weekday: 'short', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
    return `<li>
      <span>${mod?.icon ?? ''} ${mod?.title ?? esc(x.module)}${x.part ? ` · ${PART_TITLES[x.part] ?? esc(x.part)}` : ''}</span>
      <span class="muted">${when}</span>
      <span>${ltr(`${x.correct}/${x.total}`)}${x.ms ? ` · ${Math.max(1, minutes(x.ms))} דק׳` : ''}</span>
    </li>`;
  }).join('')}</ul>`;
}
