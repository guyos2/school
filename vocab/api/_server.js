// All server logic (Vercel functions; files starting with "_" are not routes).
//
// Parents sign up with email + password and get a signed token ("Authorization: Bearer <token>").
// A kid never logs in: each kid has a personal link with a random token ("Authorization: Kid <token>"),
// which opens only that kid's practice. A family link lists the kids for a shared device.
// The parent can replace either link at any time; the old one stops working at once.
//
// Env: DATABASE_URL (Postgres), TOKEN_SECRET (long random string). Locally both are optional.
//
// GET    /api/status                      -> {ok, db}
// POST   /api/signup {email, password, name} -> {token, parent, kids}
// POST   /api/login  {email, password}    -> {token, parent, kids}
// GET    /api/me                          -> {parent, kids}                    (parent)
// POST   /api/kids {name, grade, emoji}   -> {kid}                             (parent)
// PATCH  /api/kids/<id> {name, grade, emoji} -> {kid}                          (parent)
// DELETE /api/kids/<id>                                                        (parent)
// POST   /api/kids/<id>/link              -> {kid} with a new link token       (parent)
// POST   /api/family-link                 -> {parent} with a new family token  (parent)
// GET    /api/kids/<id>/progress          -> {data, version}                   (parent)
// GET    /api/kids/<id>/tests             -> {tests}                           (parent)
// POST   /api/kids/<id>/tests {title, date, words: [{en, he, id?}]} -> {test} (parent)
// DELETE /api/kids/<id>/tests/<testId>                                         (parent)
// GET    /api/family/<token>              -> {kids: [{name, emoji, linkToken}]}
// GET    /api/kid                         -> {kid, tests}                      (kid)
// GET    /api/kid/progress                -> {data, version}                   (kid)
// PUT    /api/kid/progress {data, version} -> {version}, 409 when someone saved meanwhile (kid)
import { randomBytes, randomUUID, scrypt, timingSafeEqual, createHmac } from 'node:crypto';
import { getDb } from './_db.js';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const fail = (status, error) => json({ error }, status);

// ---- secrets & tokens ----
const newToken = () => randomBytes(24).toString('base64url');

function secret(env) {
  if (env.TOKEN_SECRET) return env.TOKEN_SECRET;
  if (env.VERCEL_ENV) throw new Error('TOKEN_SECRET is not set');
  return 'local-dev-secret';
}

const TOKEN_DAYS = 180;
const hmac = (env, s) => createHmac('sha256', secret(env)).update(s).digest('base64url');

function parentToken(env, parentId) {
  const payload = Buffer.from(JSON.stringify({ p: parentId, exp: Date.now() + TOKEN_DAYS * 864e5 })).toString('base64url');
  return `${payload}.${hmac(env, payload)}`;
}

function parentIdFrom(env, token) {
  const [payload, sig] = String(token).split('.');
  if (!payload || !sig) return null;
  const want = Buffer.from(hmac(env, payload));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  const { p, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
  return exp > Date.now() ? p : null;
}

const scryptAsync = (pw, salt) => new Promise((ok, no) => scrypt(pw, salt, 32, (e, k) => (e ? no(e) : ok(k))));
async function hashPassword(pw) {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString('base64url')}$${(await scryptAsync(pw, salt)).toString('base64url')}`;
}
async function checkPassword(pw, stored) {
  const [, salt, hash] = String(stored).split('$');
  const got = await scryptAsync(pw, Buffer.from(salt, 'base64url'));
  const want = Buffer.from(hash, 'base64url');
  return got.length === want.length && timingSafeEqual(got, want);
}

// ---- validation ----
const isId = (s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s || '');
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const str = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.trim().length <= max;
const MAX_PROGRESS = 2e6;

function kidFields(b) {
  const grade = Number(b.grade);
  if (!str(b.name, 30) || !Number.isInteger(grade) || grade < 4 || grade > 7) return null;
  const emoji = str(b.emoji, 16) ? b.emoji.trim() : '🦊';
  return { name: b.name.trim(), grade, emoji };
}

function testFields(b) {
  if (!str(b.title, 80) || !/^\d{4}-\d{2}-\d{2}$/.test(b.date || '') || !Array.isArray(b.words)) return null;
  if (b.words.length < 1 || b.words.length > 200) return null;
  const words = [];
  for (const w of b.words) {
    if (!str(w?.en, 60) || !str(w?.he, 80)) return null;
    words.push({ en: w.en.trim(), he: w.he.trim(), ...(str(w.id, 60) ? { id: w.id } : {}) });
  }
  return { title: b.title.trim(), date: b.date, words };
}

const publicParent = (p) => ({ id: p.id, email: p.email, name: p.name, familyToken: p.familyToken });
const publicKid = (k) => ({ id: k.id, name: k.name, grade: k.grade, emoji: k.emoji, linkToken: k.linkToken });
const slow = () => new Promise((r) => setTimeout(r, 600)); // slows down password guessing

// ---- routes ----
async function signup(env, db, b) {
  const email = String(b.email || '').trim().toLowerCase();
  if (!EMAIL.test(email) || email.length > 120) return fail(400, 'email');
  if (typeof b.password !== 'string' || b.password.length < 8 || b.password.length > 200) return fail(400, 'password');
  if (await db.parentByEmail(email)) return fail(409, 'exists');
  const parent = await db.createParent({
    id: randomUUID(), email, passHash: await hashPassword(b.password),
    name: str(b.name, 60) ? b.name.trim() : '', familyToken: newToken(),
  });
  return json({ token: parentToken(env, parent.id), parent: publicParent(parent), kids: [] });
}

async function login(env, db, b) {
  const parent = await db.parentByEmail(String(b.email || '').trim().toLowerCase());
  if (!parent || typeof b.password !== 'string' || !(await checkPassword(b.password, parent.passHash))) {
    await slow();
    return fail(401, 'bad login');
  }
  const kids = await db.kidsOf(parent.id);
  return json({ token: parentToken(env, parent.id), parent: publicParent(parent), kids: kids.map(publicKid) });
}

async function parentRoutes(req, env, db, parent, parts) {
  const { method } = req;
  const body = method === 'POST' || method === 'PATCH' ? await req.json().catch(() => ({})) : null;

  if (parts[0] === 'me' && method === 'GET') {
    return json({ parent: publicParent(parent), kids: (await db.kidsOf(parent.id)).map(publicKid) });
  }
  if (parts[0] === 'family-link' && method === 'POST') {
    await db.setFamilyToken(parent.id, newToken());
    return json({ parent: publicParent(await db.parentById(parent.id)) });
  }
  if (parts[0] !== 'kids') return null;

  if (parts.length === 1 && method === 'POST') {
    const f = kidFields(body);
    if (!f) return fail(400, 'kid');
    if ((await db.kidsOf(parent.id)).length >= 8) return fail(400, 'too many kids');
    const kid = await db.createKid({ id: randomUUID(), parentId: parent.id, linkToken: newToken(), ...f });
    return json({ kid: publicKid(kid) });
  }

  const kid = isId(parts[1]) && await db.kidById(parts[1]);
  if (!kid || kid.parentId !== parent.id) return fail(404, 'no such kid');
  const id = kid.id;
  const rest = parts.slice(2).join('/');

  if (rest === '' && method === 'PATCH') {
    const f = kidFields({ ...kid, ...body });
    if (!f) return fail(400, 'kid');
    await db.updateKid(id, f);
    return json({ kid: publicKid({ ...kid, ...f }) });
  }
  if (rest === '' && method === 'DELETE') { await db.deleteKid(id); return json({ ok: true }); }
  if (rest === 'link' && method === 'POST') {
    await db.setKidToken(id, newToken());
    return json({ kid: publicKid(await db.kidById(id)) });
  }
  if (rest === 'progress' && method === 'GET') return json(await db.getProgress(id) || { data: null, version: 0 });
  if (rest === 'tests' && method === 'GET') return json({ tests: await db.testsOf(id) });
  if (rest === 'tests' && method === 'POST') {
    const f = testFields(body);
    if (!f) return fail(400, 'test');
    return json({ test: await db.createTest({ id: randomUUID(), kidId: id, ...f }) });
  }
  if (parts[2] === 'tests' && isId(parts[3]) && parts.length === 4 && method === 'DELETE') { await db.deleteTest(id, parts[3]); return json({ ok: true }); }
  return null;
}

async function kidRoutes(req, db, kid, parts) {
  const rest = parts.slice(1).join('/');
  if (rest === '' && req.method === 'GET') {
    const { linkToken, ...me } = publicKid(kid);
    return json({ kid: me, tests: await db.testsOf(kid.id) });
  }
  if (rest === 'progress' && req.method === 'GET') return json(await db.getProgress(kid.id) || { data: null, version: 0 });
  if (rest === 'progress' && req.method === 'PUT') {
    const text = await req.text();
    if (text.length > MAX_PROGRESS) return fail(413, 'too big');
    const { data, version } = JSON.parse(text);
    if (!data || typeof data !== 'object' || !Array.isArray(data.sessions) || typeof data.items !== 'object') return fail(400, 'progress');
    const v = await db.putProgress(kid.id, data, Number(version) || 0);
    return v ? json({ version: v }) : fail(409, 'conflict');
  }
  return null;
}

export async function handle(req, env = process.env, dbOverride) {
  try {
    const url = new URL(req.url);
    // vercel.json rewrites /api/<path> to /api/main?path=<path>; the local dev server calls with the real path.
    const route = (url.searchParams.get('path') ?? url.pathname.replace(/^\/api\/?/, '')).replace(/\/+$/, '');
    const parts = route.split('/').filter(Boolean);
    const db = dbOverride || await getDb(env);

    if (route === 'status') return json({ ok: true, db: db.kind });
    if (route === 'signup' && req.method === 'POST') return await signup(env, db, await req.json());
    if (route === 'login' && req.method === 'POST') return await login(env, db, await req.json());
    if (parts[0] === 'family' && parts[1] && req.method === 'GET') {
      const parent = await db.parentByFamilyToken(parts[1]);
      if (!parent) { await slow(); return fail(404, 'no such link'); }
      const kids = await db.kidsOf(parent.id);
      return json({ kids: kids.map(({ name, emoji, linkToken }) => ({ name, emoji, linkToken })) });
    }

    const auth = req.headers.get('Authorization') || '';
    if (parts[0] === 'kid') {
      const kid = auth.startsWith('Kid ') && await db.kidByToken(auth.slice(4));
      if (!kid) { await slow(); return fail(401, 'unknown kid link'); }
      return (await kidRoutes(req, db, kid, parts)) || fail(404, 'not found');
    }

    const parentId = auth.startsWith('Bearer ') && parentIdFrom(env, auth.slice(7));
    const parent = parentId && await db.parentById(parentId);
    if (!parent) return fail(401, 'unauthorized');
    return (await parentRoutes(req, env, db, parent, parts)) || fail(404, 'not found');
  } catch (e) {
    console.error(e);
    return fail(e instanceof SyntaxError ? 400 : 500, e instanceof SyntaxError ? 'bad json' : 'server error');
  }
}
