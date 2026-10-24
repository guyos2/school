import { esc, newView } from './ui.js';
import { renderTimes } from './modules/times.js';
import { getSettings, saveSettings, syncKid, onSyncStatus } from './store.js';

// Modules without render are shown as "coming soon".
const MODULES = {
  times: { title: 'לוח הכפל', icon: '✖️', render: renderTimes },
  fractions: { title: 'שברים', icon: '🍕' },
  numbers: { title: 'מספרים טבעיים', icon: '🔢' },
  'english-letters': { title: 'אותיות וקריאה באנגלית', icon: '🔤' },
  speaking: { title: 'מדברים אנגלית', icon: '🗣️' },
  units: { title: 'חומר מהכיתה', icon: '📸' },
  counting: { title: 'סופרים ומשחקים', icon: '🧸' },
};

const app = document.getElementById('app');
let kids = [];

async function init() {
  kids = (await (await fetch('content/kids.json')).json()).kids;
  window.addEventListener('hashchange', route);
  const statusEl = document.getElementById('sync-status');
  const LABEL = { local: '💾 נשמר במכשיר', syncing: '🔄 מסנכרן…', synced: '☁️ מסונכרן', error: '⚠️ אין סנכרון' };
  onSyncStatus((s) => { statusEl.textContent = getSettings().apiUrl ? LABEL[s] : LABEL.local; });
  route();
}

function route() {
  newView();
  window.scrollTo(0, 0);
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] === 'settings') return settings();
  if (parts[0] === 'kid') {
    const kid = kids.find((k) => k.id === parts[1]);
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

function home() {
  app.innerHTML = `
    <h1 class="page-title">של מי התור ללמוד?</h1>
    <div class="kids">${kids.map((k) => `
      <a class="kid" href="#/kid/${k.id}" style="--c:${k.color}">
        <span class="kid-emoji">${k.emoji}</span>
        <span class="kid-name">${esc(k.name)}</span>
        <span class="kid-grade">${esc(k.grade)}</span>
      </a>`).join('')}</div>`;
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

function settings() {
  const s = getSettings();
  app.innerHTML = `
    <h1 class="page-title">⚙️ הגדרות הורים</h1>
    <div class="panel">
      <p>ההתקדמות נשמרת תמיד במכשיר. כדי שתישמר גם בגיט ותעבור בין מכשירים, צריך להזין את כתובת שרת הסנכרון ואת סיסמת המשפחה (פעם אחת בכל מכשיר).</p>
      <label>כתובת שרת הסנכרון<input id="api" dir="ltr" placeholder="https://school-sync.xxx.workers.dev" value="${esc(s.apiUrl)}"></label>
      <label>סיסמת משפחה<input id="key" dir="ltr" type="password" value="${esc(s.familyKey)}"></label>
      <div class="row-center"><button class="btn" id="save">שמירה וסנכרון</button></div>
      <p id="msg" class="subtitle"></p>
    </div>`;
  app.querySelector('#save').onclick = async () => {
    saveSettings({ apiUrl: app.querySelector('#api').value.trim(), familyKey: app.querySelector('#key').value });
    const msg = app.querySelector('#msg');
    if (!getSettings().apiUrl) { msg.textContent = 'נשמר. עובדים רק על המכשיר הזה.'; return; }
    msg.textContent = 'מסנכרן…';
    try {
      for (const k of kids) await syncKid(k.id);
      msg.textContent = '✅ הסנכרון עובד!';
    } catch (e) {
      msg.textContent = `❌ הסנכרון נכשל (${e.message}). כדאי לבדוק את הכתובת ואת הסיסמה.`;
    }
  };
}

document.addEventListener('visibilitychange', () => {
  const kidId = location.hash.match(/^#\/kid\/([a-z]+)/)?.[1];
  if (document.visibilityState === 'hidden' && kidId) syncKid(kidId).catch(() => {});
});

init();
