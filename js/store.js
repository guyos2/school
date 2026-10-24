// Progress storage: always saved locally, and synced to the git repo
// (through the family sync server) when one is configured in settings.
const LS = 'school:v1:';
const MAX_SESSIONS = 300;

const read = (k, fallback) => {
  try { return JSON.parse(localStorage.getItem(LS + k)) ?? fallback; } catch { return fallback; }
};
const write = (k, v) => {
  try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch { /* storage full or blocked */ }
};

export const getSettings = () => read('settings', { apiUrl: '', familyKey: '' });
export const saveSettings = (s) => write('settings', s);

const empty = (kid) => ({ kid, version: 1, items: {}, sessions: [], updated: 0 });

export function getProgress(kid) {
  const p = read('progress:' + kid, null);
  return p ? { ...empty(kid), ...p } : empty(kid);
}

export function saveProgress(p) {
  p.updated = Date.now();
  write('progress:' + p.kid, p);
  scheduleSync(p.kid);
}

export function logSession(kid, session) {
  const p = getProgress(kid);
  p.sessions.push({ id: crypto.randomUUID?.() ?? String(Math.random()).slice(2), at: Date.now(), ...session });
  saveProgress(p);
}

// Per item the newest version wins; sessions are a union.
export function mergeProgress(a, b) {
  const items = { ...a.items };
  for (const [k, v] of Object.entries(b.items || {})) {
    if (!items[k] || (v.updated || 0) > (items[k].updated || 0)) items[k] = v;
  }
  const byId = new Map();
  for (const s of [...(a.sessions || []), ...(b.sessions || [])]) byId.set(s.id, s);
  const sessions = [...byId.values()].sort((x, y) => x.at - y.at).slice(-MAX_SESSIONS);
  return { ...a, items, sessions, updated: Math.max(a.updated || 0, b.updated || 0) };
}

// ---- sync ----
const listeners = new Set();
let status = 'local';
export const onSyncStatus = (fn) => { listeners.add(fn); fn(status); };
const setStatus = (s) => { status = s; listeners.forEach((fn) => fn(s)); };

const timers = {};
function scheduleSync(kid) {
  if (!getSettings().apiUrl) return;
  clearTimeout(timers[kid]);
  timers[kid] = setTimeout(() => syncKid(kid).catch(() => {}), 3000);
}

const sameContent = (a, b) => JSON.stringify([a.items, a.sessions]) === JSON.stringify([b.items, b.sessions]);

export async function syncKid(kid) {
  const { apiUrl, familyKey } = getSettings();
  if (!apiUrl) { setStatus('local'); return 'local'; }
  const url = `${apiUrl.replace(/\/$/, '')}/progress/${kid}`;
  const headers = { 'Content-Type': 'application/json', 'X-Family-Key': familyKey };
  setStatus('syncing');
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const r = await fetch(url, { headers });
      if (!r.ok) throw new Error(`GET ${r.status}`);
      const { data, sha } = await r.json();
      const local = getProgress(kid);
      const merged = data ? mergeProgress(local, data) : local;
      write('progress:' + kid, merged);
      if (data && sameContent(merged, data)) { setStatus('synced'); return 'synced'; }
      const put = await fetch(url, { method: 'PUT', headers, body: JSON.stringify({ data: merged, sha }) });
      if (put.status === 409) continue; // someone else saved meanwhile: merge again
      if (!put.ok) throw new Error(`PUT ${put.status}`);
      setStatus('synced');
      return 'synced';
    }
    throw new Error('conflict');
  } catch (e) {
    setStatus('error');
    throw e;
  }
}
