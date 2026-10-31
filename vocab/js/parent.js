// The parent's side: sign up / log in, kids, each kid's personal link, test preparation and progress.
import { esc } from './ui.js';
import { signup, login, logout, parentSession, parentCall, ApiError } from './api.js';
import { GRADES, GRADE_NAME, loadBank, parseWordLines, resolveTestWords } from './bank.js';
import { KNOWN_BOX } from './srs.js';
import { readiness, daysUntil, streak } from './plan.js';
import qrcode from './vendor/qrcode.js';

const EMOJIS = ['🦊', '🐼', '🦁', '🐯', '🐸', '🐙', '🦄', '🐬', '🦉', '🐝', '🚀', '⚽'];
const kidUrl = (token) => `${location.origin}${location.pathname}#/k/${token}`;
const familyUrl = (token) => `${location.origin}${location.pathname}#/f/${token}`;

const ERRORS = {
  email: 'כתובת המייל לא תקינה', password: 'הסיסמה צריכה להיות באורך 8 תווים לפחות',
  exists: 'כבר יש חשבון עם המייל הזה. נסו להיכנס', 'bad login': 'המייל או הסיסמה לא נכונים',
};
const errorText = (e) => (e instanceof ApiError ? ERRORS[e.code] || 'משהו השתבש. נסו שוב' : 'אין חיבור לשרת. נסו שוב');

// ---- landing, sign up, log in ----
export function renderAuth(root, mode) {
  const isSignup = mode === 'signup';
  root.innerHTML = `
    <div class="panel">
      <h1 class="center">${isSignup ? 'הרשמה' : 'כניסת הורים'}</h1>
      <form id="f">
        ${isSignup ? '<label>השם שלכם<input name="name" autocomplete="name"></label>' : ''}
        <label>מייל<input name="email" type="email" required autocomplete="email" dir="ltr"></label>
        <label>סיסמה<input name="password" type="password" required minlength="8" autocomplete="${isSignup ? 'new-password' : 'current-password'}" dir="ltr"></label>
        <p class="error" id="err"></p>
        <button class="btn btn-big wide">${isSignup ? 'יצירת חשבון' : 'כניסה'}</button>
      </form>
      <p class="center">${isSignup ? 'כבר רשומים? <a class="link" href="#/login">כניסה</a>' : 'עוד אין חשבון? <a class="link" href="#/signup">הרשמה</a>'}</p>
    </div>`;
  root.querySelector('#f').onsubmit = async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    try {
      await (isSignup ? signup(f.email, f.password, f.name) : login(f.email, f.password));
      location.hash = '#/parent';
    } catch (err) {
      root.querySelector('#err').textContent = errorText(err);
      btn.disabled = false;
    }
  };
}

// ---- kids ----
function kidForm(kid = {}) {
  const emoji = kid.emoji || EMOJIS[0];
  return `
    <label>שם<input name="name" required maxlength="30" value="${esc(kid.name || '')}"></label>
    <label>כיתה
      <select name="grade">${GRADES.map((g) => `<option value="${g}" ${kid.grade === g ? 'selected' : ''}>${GRADE_NAME[g]}</option>`).join('')}</select>
    </label>
    <div class="label">דמות</div>
    <div class="emoji-pick">${EMOJIS.map((e) => `
      <label><input type="radio" name="emoji" value="${e}" ${e === emoji ? 'checked' : ''}><span>${e}</span></label>`).join('')}</div>`;
}

async function kidSummary(kid) {
  try {
    const { data } = await parentCall('GET', `kids/${kid.id}/progress`);
    const items = Object.values(data?.items || {});
    const last = data?.sessions?.at(-1);
    return {
      known: items.filter((it) => it.box >= KNOWN_BOX).length,
      learning: items.filter((it) => it.box > 0 && it.box < KNOWN_BOX).length,
      last: last ? new Date(last.at).toLocaleDateString('he-IL') : null,
      streak: streak(data?.sessions || []),
      data,
    };
  } catch { return null; }
}

// Each render draws into a fresh inner element, so re-rendering in place never doubles the listeners.
function fresh(outer) {
  outer.innerHTML = '<div><p class="center muted">טוען…</p></div>';
  return outer.firstElementChild;
}

export async function renderParentHome(outer) {
  if (!parentSession()) { location.hash = '#/login'; return; }
  const root = fresh(outer);
  const { parent, kids } = await parentCall('GET', 'me');
  const summaries = await Promise.all(kids.map(kidSummary));
  root.innerHTML = `
    <h1 class="page-title">שלום${parent.name ? ` ${esc(parent.name)}` : ''}</h1>
    <p class="subtitle">${kids.length ? 'בחרו ילד כדי לשלוח את הלינק, להכין למבחן או לראות התקדמות' : 'נתחיל: הוסיפו את הילד הראשון'}</p>
    <div class="kids">${kids.map((k, n) => {
      const s = summaries[n];
      return `
        <a class="kid" href="#/parent/kid/${k.id}">
          <span class="kid-emoji">${esc(k.emoji)}</span>
          <span class="kid-name">${esc(k.name)}</span>
          <span class="kid-grade">כיתה ${GRADE_NAME[k.grade]}</span>
          <span class="kid-grade">${s ? `${s.known} מילים ידועות היטב · ${s.last ? `תרגול אחרון ${s.last}` : 'עוד לא תרגלו'}` : ''}</span>
        </a>`;
    }).join('')}</div>
    <details class="panel add-kid" ${kids.length ? '' : 'open'}>
      <summary>➕ הוספת ילד</summary>
      <form id="add">${kidForm()}<p class="error" id="err"></p><button class="btn wide">הוספה</button></form>
    </details>
    ${kids.length > 1 ? `
      <div class="panel">
        <h2>לינק משפחתי</h2>
        <p class="muted">למחשב או לטאבלט שכל הילדים משתמשים בו: הלינק פותח מסך בחירה בין הילדים.</p>
        ${shareBlock(familyUrl(parent.familyToken), 'לינק משפחתי ללימוד מילים באנגלית')}
        <button class="link-btn" id="newfam">החלפת הלינק המשפחתי</button>
      </div>` : ''}
    <p class="center muted small">באפליקציה של הילדים אין קישור לאזור ההורים. כדי לחזור לכאן שמרו במועדפים את הכתובת
      <span class="en">${esc(`${location.origin}${location.pathname}#/parent`)}</span>.
      במכשיר שגם הילדים משתמשים בו, כדאי לצאת מהחשבון בסוף.</p>
    <div class="row-center"><button class="link-btn" id="logout">יציאה מהחשבון</button></div>`;

  wireShare(root);
  root.querySelector('#add').onsubmit = async (e) => {
    e.preventDefault();
    try {
      const { kid } = await parentCall('POST', 'kids', Object.fromEntries(new FormData(e.target)));
      location.hash = `#/parent/kid/${kid.id}`;
    } catch (err) { root.querySelector('#err').textContent = errorText(err); }
  };
  root.querySelector('#newfam')?.addEventListener('click', async () => {
    if (!confirm('הלינק המשפחתי הנוכחי יפסיק לעבוד. להמשיך?')) return;
    await parentCall('POST', 'family-link');
    renderParentHome(outer);
  });
  root.querySelector('#logout').onclick = () => { logout(); location.hash = '#/'; };
}

// ---- sharing a link: copy, WhatsApp, the phone's share sheet, QR ----
function shareBlock(url, text) {
  const wa = `https://wa.me/?text=${encodeURIComponent(`${text}:\n${url}`)}`;
  return `
    <div class="share" data-url="${esc(url)}" data-text="${esc(text)}">
      <input class="link-field" readonly value="${esc(url)}" dir="ltr">
      <div class="row-center">
        <button class="btn btn-soft" data-act="copy">📋 העתקה</button>
        <a class="btn btn-soft" href="${wa}" target="_blank" rel="noopener">💬 וואטסאפ</a>
        ${navigator.share ? '<button class="btn btn-soft" data-act="share">📤 שיתוף</button>' : ''}
        <button class="btn btn-soft" data-act="qr">🔳 QR</button>
      </div>
      <div class="qr" hidden></div>
    </div>`;
}

function wireShare(root) {
  root.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    const box = b?.closest('.share');
    if (!box) return;
    const { url, text } = box.dataset;
    if (b.dataset.act === 'copy') {
      try { await navigator.clipboard.writeText(url); b.textContent = '✓ הועתק'; } catch { box.querySelector('input').select(); }
    } else if (b.dataset.act === 'share') {
      navigator.share({ title: text, text, url }).catch(() => {});
    } else if (b.dataset.act === 'qr') {
      const qr = box.querySelector('.qr');
      if (qr.hidden) {
        const q = qrcode(0, 'M');
        q.addData(url);
        q.make();
        qr.innerHTML = `${q.createSvgTag(6, 2)}<p class="muted">סורקים במצלמה של הטאבלט או הטלפון של הילד</p>`;
      }
      qr.hidden = !qr.hidden;
    }
  });
}

// ---- one kid ----
export async function renderParentKid(outer, id) {
  if (!parentSession()) { location.hash = '#/login'; return; }
  const root = fresh(outer);
  const { kids } = await parentCall('GET', 'me');
  const kid = kids.find((k) => k.id === id);
  if (!kid) { location.hash = '#/parent'; return; }
  const [{ tests }, summary, bank] = await Promise.all([parentCall('GET', `kids/${id}/tests`), kidSummary(kid), loadBank()]);
  const items = summary?.data?.items || {};
  const upcoming = tests.filter((t) => daysUntil(t.date) >= 0);
  const words = new Map(bank.map((w) => [w.id, w]));
  for (const t of tests) for (const w of resolveTestWords(t, bank)) words.set(w.id, w);
  const weak = Object.entries(items).filter(([k, it]) => k.startsWith('w:') && it.wrong >= 2 && it.box < 3)
    .map(([k]) => words.get(k.slice(2))).filter(Boolean).slice(0, 20);

  root.innerHTML = `
    <a class="back" href="#/parent">→ כל הילדים</a>
    <h1 class="page-title">${esc(kid.emoji)} ${esc(kid.name)}</h1>
    <p class="subtitle">כיתה ${GRADE_NAME[kid.grade]}</p>

    <section class="panel">
      <h2>הלינק של ${esc(kid.name)}</h2>
      <p class="muted">שלחו את הלינק לילד או פתחו אותו במכשיר שלו. הלינק נכנס ישר לתרגול, בלי סיסמה, והמכשיר זוכר אותו.
      כדאי להוסיף אותו למסך הבית.</p>
      ${shareBlock(kidUrl(kid.linkToken), `${kid.name}, זה הלינק שלך ללימוד מילים באנגלית`)}
      <button class="link-btn" id="newlink">הלינק דלף? החלפת לינק</button>
    </section>

    <section class="panel">
      <h2>📝 הכנה למבחן</h2>
      ${upcoming.length ? upcoming.map((t) => {
        const ids = resolveTestWords(t, bank).map((w) => w.id);
        const left = daysUntil(t.date);
        return `
          <div class="test-row">
            <div><b>${esc(t.title)}</b><br><span class="muted">${new Date(`${t.date}T00:00:00`).toLocaleDateString('he-IL')} · ${left === 0 ? 'היום' : `עוד ${left} ימים`} · ${t.words.length} מילים</span></div>
            <div class="test-ready">${Math.round(readiness(items, ids) * 100)}%<small>מוכנות</small></div>
            <button class="link-btn" data-del="${t.id}">מחיקה</button>
          </div>`;
      }).join('') : '<p class="muted">אין מבחן קרוב. עד שיהיה, הילד לומד בלימוד חופשי לפי הכיתה שלו.</p>'}
      <details ${upcoming.length ? '' : 'open'}>
        <summary>מבחן חדש</summary>
        <form id="test">
          <label>על מה המבחן?<input name="title" required maxlength="80" placeholder="למשל: JET יחידה 3"></label>
          <label>תאריך המבחן<input name="date" type="date" required></label>
          <label>המילים למבחן, מילה בכל שורה
            <textarea name="words" rows="8" placeholder="river - נהר&#10;forest - יער&#10;mountain" dir="auto"></textarea>
          </label>
          <p class="muted small">מילה ופירוש בכל שורה. מילה שכבר במאגר אפשר לכתוב בלי פירוש.</p>
          <p class="error" id="terr"></p>
          <button class="btn wide">שמירת המבחן</button>
        </form>
        <p class="soon">בקרוב: לספר על המבחן בחופשיות, בכתיבה, בהקלטה או בצילום של דף החומר, והאפליקציה תבנה את רשימת המילים והנושאים.</p>
      </details>
    </section>

    <section class="panel">
      <h2>📷 מילים מהכיתה</h2>
      <p class="soon">בקרוב: מצלמים את רשימת המילים מהמחברת או מהלוח, והמילים נכנסות לתרגול של ${esc(kid.name)} כבר מהיום.</p>
    </section>

    <section class="panel">
      <h2>📊 התקדמות</h2>
      ${summary ? `
        <div class="stats-row">
          <div class="stat"><b>${summary.known}</b><span>ידועות היטב</span></div>
          <div class="stat"><b>${summary.learning}</b><span>בלימוד</span></div>
          <div class="stat"><b>${summary.streak}</b><span>ימים ברצף</span></div>
        </div>
        <p class="muted">${summary.last ? `תרגול אחרון: ${summary.last}` : 'עוד לא תרגלו.'}</p>
        ${weak.length ? `<h3>מילים שכדאי לחזק</h3><p>${weak.map((w) => `<span class="en">${esc(w.en)}</span> (${esc(w.he)})`).join(' · ')}</p>` : ''}`
        : '<p class="muted">אין נתונים עדיין.</p>'}
    </section>

    <details class="panel">
      <summary>⚙️ פרטי הילד</summary>
      <form id="edit">${kidForm(kid)}<button class="btn wide">שמירה</button></form>
      <button class="link-btn danger" id="delete">מחיקת ${esc(kid.name)} וכל ההתקדמות</button>
    </details>`;

  wireShare(root);
  const reload = () => renderParentKid(outer, id);
  root.querySelector('#newlink').onclick = async () => {
    if (!confirm('הלינק הנוכחי יפסיק לעבוד, ותצטרכו לשלוח לינק חדש. להמשיך?')) return;
    await parentCall('POST', `kids/${id}/link`);
    reload();
  };
  root.querySelector('#test').onsubmit = async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    const { words: list, errors } = parseWordLines(f.words, bank);
    const err = root.querySelector('#terr');
    if (errors.length) { err.textContent = `חסר פירוש או מילה באנגלית בשורות: ${errors.join(' · ')}`; return; }
    if (!list.length) { err.textContent = 'כתבו לפחות מילה אחת'; return; }
    try {
      await parentCall('POST', `kids/${id}/tests`, { title: f.title, date: f.date, words: list });
      reload();
    } catch (x) { err.textContent = errorText(x); }
  };
  root.querySelectorAll('[data-del]').forEach((b) => {
    b.onclick = async () => {
      if (!confirm('למחוק את המבחן?')) return;
      await parentCall('DELETE', `kids/${id}/tests/${b.dataset.del}`);
      reload();
    };
  });
  root.querySelector('#edit').onsubmit = async (e) => {
    e.preventDefault();
    await parentCall('PATCH', `kids/${id}`, Object.fromEntries(new FormData(e.target)));
    reload();
  };
  root.querySelector('#delete').onclick = async () => {
    if (!confirm(`למחוק את ${kid.name}? כל ההתקדמות תימחק ולא ניתן לשחזר.`)) return;
    await parentCall('DELETE', `kids/${id}`);
    location.hash = '#/parent';
  };
}

