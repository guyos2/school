// A kid's progress: saved on the device at once, and synced to the server a few seconds later.
// Each item carries `updated`; when two devices practised, the newest version of each item wins
// and sessions are joined. The server keeps a version number, so a stale device merges instead of overwriting.
import { read, write, kidCall } from './api.js';
import { KNOWN_BOX } from './srs.js';

const MAX_SESSIONS = 1000;
const empty = (kidId) => ({ kid: kidId, version: 1, items: {}, sessions: [], updated: 0 });

export function getProgress(kidId) {
  const p = read(`progress:${kidId}`, null);
  return p ? { ...empty(kidId), ...p } : empty(kidId);
}

let current = null; // { kidId, token }
export function bindKid(kidId, token) { current = { kidId, token }; }

export function saveProgress(p) {
  p.updated = Date.now();
  write(`progress:${p.kid}`, p);
  scheduleSync();
}

export function logSession(kidId, session) {
  const p = getProgress(kidId);
  const mastered = Object.values(p.items).filter((it) => (it.box || 0) >= KNOWN_BOX).length;
  p.sessions.push({ id: crypto.randomUUID?.() ?? String(Math.random()).slice(2), at: Date.now(), mastered, ...session });
  saveProgress(p);
}

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

let timer;
function scheduleSync() {
  clearTimeout(timer);
  timer = setTimeout(() => sync().catch(() => {}), 3000);
}

const same = (a, b) => JSON.stringify([a.items, a.sessions]) === JSON.stringify([b.items, b.sessions]);

// Pull, merge, push. Returns 'synced', or throws when offline (the device copy stays and syncs next time).
export async function sync() {
  if (!current) return 'local';
  const { kidId, token } = current;
  for (let attempt = 0; attempt < 3; attempt++) {
    const remote = await kidCall(token, 'GET', 'kid/progress');
    const local = getProgress(kidId);
    const merged = remote.data ? mergeProgress(local, remote.data) : local;
    write(`progress:${kidId}`, merged);
    if (remote.data && same(merged, remote.data)) return 'synced';
    try {
      await kidCall(token, 'PUT', 'kid/progress', { data: merged, version: remote.version });
      return 'synced';
    } catch (e) {
      if (e.status !== 409) throw e; // someone else saved meanwhile: merge again
    }
  }
  throw new Error('conflict');
}
