import { esc, newView } from './ui.js';
import { renderTimes } from './modules/times.js';
import { renderEnglish } from './modules/english.js';
import { renderGrammar } from './modules/grammar.js';
import { renderFractions } from './modules/fractions.js';
import { renderDictation } from './modules/dictation.js';
import { renderStats } from './stats.js';
import { setApiUrl, isOnline, needsLogin, getSession, login, logout, syncKid, onSyncStatus } from './store.js';

// Modules without render are shown as "coming soon".
const MODULES = {
  times: { title: 'לוח הכפל', icon: '✖️', render: renderTimes },
  fractions: { title: 'שברים', icon: '🍕', render: renderFractions },
  numbers: { title: 'מספרים טבעיים', icon: '🔢' },
  dictation: { title: 'הכתבה', icon: '✏️', render: renderDictation },
  'english-letters': { title: 'אותיות וקריאה באנגלית', icon: '🔤', render: renderEnglish },
  grammar: { title: 'דקדוק באנגלית', icon: '📘', render: renderGrammar },
  speaking: { title: 'מדברים אנגלית', icon: '🗣️' },
  units: { title: 'חומר מהכיתה', icon: '📸' },
  counting: { title: 'סופרים ומשחקים', icon: '🧸' },
};

const PARENT = { id: 'parent', name: 'הורה', emoji: '👨‍👩‍👧‍👦', color: '#5b4cdb', grade: 'כניסת הורים' };

const app = document.getElementById('app');
let kids = [];

async function init() {
  const [kidsFile, config] = await Promise.all([
    fetch('content/kids.json').then((r) => r.json()),
    fetch('content/config.json').then((r) => r.json()).catch(() => ({})),
  ]);
  kids = kidsFile.kids;
  // Use the server only when it is up and configured; otherwise keep working on this device.
  if (config.apiUrl) {
    const status = await fetch(`${config.apiUrl}/status`).then((r) => r.json()).catch(() => ({}));
    if (status.configured) setApiUrl(config.apiUrl, { codes: status.codes });
  }
  window.addEventListener('hashchange', route);
  window.addEventListener('school:logout', () => { location.hash = '#/'; route(); });
  const statusEl = document.getElementById('sync-status');
  const LABEL = { local: '💾 נשמר במכשיר', syncing: '🔄 מסנכרן…', synced: '☁️ מסונכרן', error: '⚠️ אין סנכרון' };
  onSyncStatus((s) => { statusEl.textContent = isOnline() ? LABEL[s] : LABEL.local; });
  route();
}

// Without login codes everyone sees everything.
function allowedKids() {
  if (!needsLogin()) return kids;
  const user = getSession()?.user;
  return user === 'parent' ? kids : kids.filter((k) => k.id === user);
}

// With login codes only the parent sees the stats; without codes there is no way to tell, so it is open.
const canSeeStats = () => !needsLogin() || getSession()?.user === 'parent';

function route() {
  newView();
  window.scrollTo(0, 0);
  if (needsLogin() && !getSession()) return loginScreen();
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] === 'settings') return account();
  if (parts[0] === 'stats' && canSeeStats()) {
    document.documentElement.style.removeProperty('--kid');
    return renderStats(app, { kids, modules: MODULES, kidId: parts[1] });
  }
  if (parts[0] === 'kid') {
    const kid = allowedKids().find((k) => k.id === parts[1]);
    if (kid) {
      document.documentElement.style.setProperty('--kid', kid.color);
      if (!parts[2]) return kidPage(kid);
      const mod = MODULES[parts[2]];
      if (mod?.render && kid.modules.includes(parts[2])) return mod.render(app, kid, parts.slice(3));
      return kidPage(kid);
    }
  }
  document.documentElement.style.removeProperty('--kid');
  home();
}

const kidCard = (k, tag = 'a') => `
  <${tag} class="kid" ${tag === 'a' ? `href="#/kid/${k.id}"` : `data-id="${k.id}"`} style="--c:${k.color}">
    <span class="kid-emoji">${k.emoji}</span>
    <span class="kid-name">${esc(k.name)}</span>
    <span class="kid-grade">${esc(k.grade)}</span>
  </${tag}>`;

function home() {
  const list = allowedKids();
  if (list.length === 1) { location.replace(`#/kid/${list[0].id}`); return; }
  app.innerHTML = `
    <h1 class="page-title">של מי התור ללמוד?</h1>
    <div class="kids">${list.map((k) => kidCard(k)).join('')}</div>
    ${canSeeStats() ? '<div class="row-center"><a class="btn btn-soft" href="#/stats">📊 סטטיסטיקות להורים</a></div>' : ''}`;
}

function loginScreen() {
  app.innerHTML = `
    <h1 class="page-title">👋 מי נכנס?</h1>
    <p class="subtitle">לוחצים על התמונה ומקלידים את הקוד</p>
    <div class="kids">${[...kids, PARENT].map((k) => kidCard(k, 'button')).join('')}</div>`;
  app.querySelector('.kids').addEventListener('click', (e) => {
    const id = e.target.closest('.kid')?.dataset.id;
    if (id) codeScreen([...kids, PARENT].find((k) => k.id === id));
  });
}

function codeScreen(who) {
  const isParent = who.id === 'parent';
  document.documentElement.style.setProperty('--kid', who.color);
  app.innerHTML = `
    <button class="back" id="back">→ חזרה</button>
    <div class="login">
      <div class="kid-emoji">${who.emoji}</div>
      <h1 class="page-title">${esc(who.name)}</h1>
      <form id="f">
        <input id="pw" class="code-input" type="password" autocomplete="current-password"
          ${isParent ? '' : 'inputmode="numeric"'} placeholder="${isParent ? 'סיסמה' : 'הקוד שלי'}" dir="ltr" autofocus>
        <button class="btn btn-big" type="submit">כניסה</button>
      </form>
      <p id="msg" class="subtitle"></p>
    </div>`;
  app.querySelector('#back').onclick = () => { document.documentElement.style.removeProperty('--kid'); loginScreen(); };
  app.querySelector('#f').onsubmit = async (e) => {
    e.preventDefault();
    const msg = app.querySelector('#msg');
    msg.textContent = 'בודקים…';
    try {
      if (await login(who.id, app.querySelector('#pw').value)) {
        location.hash = isParent ? '#/' : `#/kid/${who.id}`;
        route();
      } else {
        msg.textContent = '🙈 הקוד לא נכון, נסו שוב';
        app.querySelector('#pw').value = '';
      }
    } catch {
      msg.textContent = '📡 אין חיבור לשרת. כדאי לבדוק את האינטרנט ולנסות שוב.';
    }
  };
}

function kidPage(kid) {
  syncKid(kid.id).catch(() => {}); // pull progress made on other devices
  app.innerHTML = `
    <h1 class="page-title">${kid.emoji} שלום ${esc(kid.name)}!</h1>
    <p class="subtitle">מה לומדים היום?</p>
    <div class="cards">${kid.modules.map((id) => {
      const m = MODULES[id];
      return m.render
        ? `<a class="card" href="#/kid/${kid.id}/${id}"><span class="card-icon">${m.icon}</span><span class="card-title">${m.title}</span></a>`
        : `<div class="card card-soon"><span class="card-icon">${m.icon}</span><span class="card-title">${m.title}</span><span class="badge">בקרוב</span></div>`;
    }).join('')}</div>`;
}

function account() {
  if (!isOnline()) {
    app.innerHTML = `
      <h1 class="page-title">⚙️ חשבון</h1>
      <div class="panel"><p>שרת הסנכרון עוד לא הוגדר, ולכן ההתקדמות נשמרת רק במכשיר הזה.</p>
        <div class="row-center"><a class="btn btn-soft" href="#/stats">📊 סטטיסטיקות</a></div></div>`;
    return;
  }
  if (!needsLogin()) {
    app.innerHTML = `
      <h1 class="page-title">⚙️ חשבון</h1>
      <div class="panel">
        <p>ההתקדמות נשמרת בגיט ועוברת בין כל המכשירים. הכניסה כרגע בלי קוד.</p>
        <div class="row-center"><button class="btn" id="sync">🔄 סנכרון עכשיו</button><a class="btn btn-soft" href="#/stats">📊 סטטיסטיקות</a></div>
        <p id="msg" class="subtitle"></p>
      </div>`;
    app.querySelector('#sync').onclick = () => syncAll(app.querySelector('#msg'));
    return;
  }
  const user = getSession().user;
  const who = user === 'parent' ? PARENT : kids.find((k) => k.id === user) ?? { name: user, emoji: '👤' };
  app.innerHTML = `
    <h1 class="page-title">⚙️ חשבון</h1>
    <div class="panel">
      <p>מחוברים בתור <b>${who.emoji} ${esc(who.name)}</b>. ההתקדמות נשמרת בגיט ועוברת בין כל המכשירים.</p>
      <div class="row-center">
        <button class="btn" id="sync">🔄 סנכרון עכשיו</button>
        ${user === 'parent' ? '<a class="btn btn-soft" href="#/stats">📊 סטטיסטיקות</a>' : ''}
        <button class="btn btn-soft" id="out">יציאה מהחשבון</button>
      </div>
      <p id="msg" class="subtitle"></p>
    </div>`;
  app.querySelector('#out').onclick = logout;
  app.querySelector('#sync').onclick = () => syncAll(app.querySelector('#msg'));
}

async function syncAll(msg) {
  msg.textContent = 'מסנכרן…';
  try {
    for (const k of allowedKids()) await syncKid(k.id);
    msg.textContent = '✅ הכול מסונכרן';
  } catch (e) {
    msg.textContent = `❌ הסנכרון נכשל (${e.message})`;
  }
}

document.addEventListener('visibilitychange', () => {
  const kidId = location.hash.match(/^#\/kid\/([a-z]+)/)?.[1];
  if (document.visibilityState === 'hidden' && kidId) syncKid(kidId).catch(() => {});
});

init();
