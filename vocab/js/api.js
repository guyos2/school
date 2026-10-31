// Calls to the server, the parent's login on this device, and the kids whose links were opened on it.
const LS = 'vocab:v1:';

export const read = (k, fallback) => {
  try { return JSON.parse(localStorage.getItem(LS + k)) ?? fallback; } catch { return fallback; }
};
export const write = (k, v) => {
  try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch { /* storage full or blocked */ }
};
const remove = (k) => { try { localStorage.removeItem(LS + k); } catch { /* ignore */ } };

export class ApiError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}

async function call(method, path, { body, auth } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) headers.Authorization = auth;
  const r = await fetch(`/api/${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError(r.status, data.error || `http ${r.status}`);
  return data;
}

// ---- parent ----
export const parentSession = () => read('parent', null);
const parentAuth = () => `Bearer ${parentSession()?.token}`;

export async function signup(email, password, name) {
  const s = await call('POST', 'signup', { body: { email, password, name } });
  write('parent', { token: s.token, email: s.parent.email });
  return s;
}
export async function login(email, password) {
  const s = await call('POST', 'login', { body: { email, password } });
  write('parent', { token: s.token, email: s.parent.email });
  return s;
}
export const logout = () => remove('parent');

export async function parentCall(method, path, body) {
  try {
    return await call(method, path, { body, auth: parentAuth() });
  } catch (e) {
    if (e.status === 401) { logout(); location.hash = '#/login'; }
    throw e;
  }
}

// ---- kid ----
export const kidCall = (token, method, path, body) => call(method, path, { body, auth: `Kid ${token}` });
export const familyKids = (token) => call('GET', `family/${token}`);

// Kids opened on this device, so the home screen can show them without the link.
export const rememberedKids = () => read('kids', []);
export function rememberKid(token, kid) {
  const list = rememberedKids().filter((k) => k.token !== token);
  list.push({ token, name: kid.name, emoji: kid.emoji });
  write('kids', list);
}
export const forgetKid = (token) => write('kids', rememberedKids().filter((k) => k.token !== token));
