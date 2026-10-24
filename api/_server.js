// Family sync server (Vercel functions; files starting with "_" are not routes).
// Keeps the secrets (GitHub token, later the Claude API key) off the kids' devices
// and stores each child's progress as progress/<kid>.json on a separate git branch,
// so progress commits don't redeploy the site.
//
// Env: USERS (JSON {"hillel":"<code>",...,"parent":"<password>"}), TOKEN_SECRET, GH_TOKEN,
//      optional GH_REPO (default guyos2/school) and GH_BRANCH.
// Production writes to the "progress" branch, previews to "progress-preview", so testing
// a preview never touches the kids' real progress.
//
// GET  /api/status -> {configured}
// POST /api/login {user, password} -> {token, user}. Other calls send "Authorization: Bearer <token>".
// A kid may only touch their own progress; "parent" may touch everyone's.

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

const repo = (env) => env.GH_REPO || 'guyos2/school';
const progressBranch = (env) => env.GH_BRANCH || (env.VERCEL_ENV === 'production' ? 'progress' : 'progress-preview');

const b64encode = (s) => {
  let bin = '';
  for (const byte of new TextEncoder().encode(s)) bin += String.fromCharCode(byte);
  return btoa(bin);
};
const b64decode = (s) =>
  new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\n/g, '')), (c) => c.charCodeAt(0)));

// ---- login tokens: base64url(payload).HMAC-SHA256 ----
const enc = new TextEncoder();
const TOKEN_DAYS = 365;
const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s) => atob(s.replace(/-/g, '+').replace(/_/g, '/'));

async function sign(env, data) {
  const key = await crypto.subtle.importKey('raw', enc.encode(env.TOKEN_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}

async function makeToken(env, user) {
  const payload = b64url(enc.encode(JSON.stringify({ u: user, exp: Date.now() + TOKEN_DAYS * 864e5 })));
  return `${payload}.${await sign(env, payload)}`;
}

async function userFromRequest(req, env) {
  const [payload, sig] = (req.headers.get('Authorization') || '').replace(/^Bearer /, '').split('.');
  if (!payload || !sig || sig !== await sign(env, payload)) return null;
  const { u, exp } = JSON.parse(fromB64url(payload));
  return exp > Date.now() ? u : null;
}

async function login(env, { user, password }) {
  const users = JSON.parse(env.USERS || '{}');
  if (!user || !password || users[user] !== String(password)) {
    await new Promise((r) => setTimeout(r, 800)); // slow down guessing
    return json({ error: 'bad login' }, 401);
  }
  return json({ token: await makeToken(env, user), user });
}

function gh(env, path, init = {}) {
  return fetch(`https://api.github.com/repos/${repo(env)}/contents/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.GH_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'school-sync',
    },
  });
}

async function getProgress(env, kid) {
  const branch = progressBranch(env);
  const r = await gh(env, `progress/${kid}.json?ref=${branch}`);
  if (r.status === 404) return json({ data: null, sha: null });
  if (!r.ok) return json({ error: `github ${r.status}` }, 502);
  const file = await r.json();
  return json({ data: JSON.parse(b64decode(file.content)), sha: file.sha });
}

async function putProgress(env, kid, { data, sha }) {
  const branch = progressBranch(env);
  const r = await gh(env, `progress/${kid}.json`, {
    method: 'PUT',
    body: JSON.stringify({
      message: `progress: ${kid}`,
      content: b64encode(JSON.stringify(data, null, 1)),
      branch,
      ...(sha ? { sha } : {}),
    }),
  });
  // GitHub answers 409/422 when the file changed since we read it.
  if (r.status === 409 || r.status === 422) return json({ error: 'conflict' }, 409);
  if (!r.ok) return json({ error: `github ${r.status}` }, 502);
  return json({ ok: true, sha: (await r.json()).content.sha });
}

const configured = (env) => !!(env.TOKEN_SECRET && env.GH_TOKEN && env.USERS);

export async function handle(req, env = process.env) {
  const path = new URL(req.url).pathname.replace(/\/$/, '');
  if (path === '/api/status') return json({ configured: configured(env) });
  if (!configured(env)) return json({ error: 'server not configured' }, 500);
  if (path === '/api/login' && req.method === 'POST') return login(env, await req.json());

  const user = await userFromRequest(req, env);
  if (!user) return json({ error: 'unauthorized' }, 401);
  const m = path.match(/^\/api\/progress\/([a-z]+)$/);
  if (m) {
    if (user !== 'parent' && user !== m[1]) return json({ error: 'forbidden' }, 403);
    if (req.method === 'GET') return getProgress(env, m[1]);
    if (req.method === 'PUT') return putProgress(env, m[1], await req.json());
  }
  return json({ error: 'not found' }, 404);
}
