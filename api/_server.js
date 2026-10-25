// Family sync server (Vercel functions; files starting with "_" are not routes).
// Keeps the secrets (GitHub token, Claude API key) off the kids' devices
// and stores each child's progress as progress/<kid>.json on a separate git branch,
// so progress commits don't redeploy the site.
//
// Env: GH_TOKEN, optional GH_REPO (default guyos2/school) and GH_BRANCH.
// ANTHROPIC_API_KEY turns on grading of dictation photos; without it the kids check by hand.
// Login codes are off unless LOGIN_CODES=on; then USERS (JSON {"hillel":"<code>",...,"parent":"<password>"})
// and TOKEN_SECRET are required too.
// Production writes to the "progress" branch, previews to "progress-preview", so testing
// a preview never touches the kids' real progress.
//
// GET  /api/status -> {configured, codes}
// POST /api/login {user, password} -> {token, user}. Other calls send "Authorization: Bearer <token>".
// A kid may only touch their own progress; "parent" may touch everyone's.
// POST /api/dictation {words, image (base64 JPEG), mediaType} -> {results: [{written, legible, ok}]}

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

// ---- dictation grading: Claude reads the handwritten page, the comparison is done here ----
const NIKUD = /[\u0591-\u05C7]/g;
// Spelling is what counts: ignore nikud, spaces and punctuation such as the dot after a numbered line.
const normalize = (s) => String(s).replace(NIKUD, '').replace(/[^\u05D0-\u05EA]/g, '');

const GRADE_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: { n: { type: 'integer' }, written: { type: 'string' }, legible: { type: 'boolean' } },
        required: ['n', 'written', 'legible'],
        additionalProperties: false,
      },
    },
  },
  required: ['items'],
  additionalProperties: false,
};

async function gradeDictation(env, { words, image, mediaType = 'image/jpeg' }) {
  if (!env.ANTHROPIC_API_KEY) return json({ error: 'grading not configured' }, 501);
  const okWords = Array.isArray(words) && words.length >= 1 && words.length <= 40
    && words.every((w) => typeof w === 'string' && w.length <= 40);
  if (!okWords || typeof image !== 'string' || image.length > 5e6
    || !['image/jpeg', 'image/png', 'image/webp'].includes(mediaType)) return json({ error: 'bad request' }, 400);

  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const list = words.map((w, i) => `${i + 1}. ${w}`).join('\n');
  const response = await client.beta.messages.create({
    model: 'claude-opus-5-5',
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'high', format: { type: 'json_schema', schema: GRADE_SCHEMA } },
    system: 'You read photos of a Hebrew spelling dictation handwritten by a 10-year-old. '
      + 'You copy exactly what the child wrote, letter by letter. You never fix the child\'s spelling.',
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
        {
          type: 'text',
          text: `The child was dictated these ${words.length} words, in this order:\n${list}\n\n`
            + `For each number from 1 to ${words.length}, find what the child wrote for that item (usually the line marked with that number, `
            + 'otherwise the line in that position) and copy it exactly as written: the same letters, including mistakes such as '
            + 'כ instead of ח, ת instead of ט, א instead of ע or ה, a missing or extra ו or י, and a regular letter where a final form '
            + '(ן ם ץ ף ך) belongs or the reverse. The expected word only tells you which line to look at; never let it change what you copy. '
            + 'Skip crossed-out text and the line numbers. Return an empty string when an item is missing. '
            + 'Set legible to false when you cannot read the letters of an item with confidence.',
        },
      ],
    }],
  });
  if (response.stop_reason === 'refusal') return json({ error: 'refused' }, 502);
  const text = response.content.find((b) => b.type === 'text')?.text;
  if (!text) return json({ error: 'no answer' }, 502);
  const { items } = JSON.parse(text);
  const results = words.map((w, i) => {
    const it = items.find((x) => x.n === i + 1);
    const written = it?.written?.trim() || '';
    return { written, legible: it ? it.legible : false, ok: !!written && normalize(written) === normalize(w) };
  });
  return json({ results });
}

const KIDS = ['hillel', 'niri', 'itamar', 'dani'];
const codesOn = (env) => env.LOGIN_CODES === 'on';
const configured = (env) => !!(env.GH_TOKEN && (!codesOn(env) || (env.TOKEN_SECRET && env.USERS)));

export async function handle(req, env = process.env) {
  const path = new URL(req.url).pathname.replace(/\/$/, '');
  if (path === '/api/status') return json({ configured: configured(env), codes: codesOn(env) });
  if (!configured(env)) return json({ error: 'server not configured' }, 500);
  if (codesOn(env) && path === '/api/login' && req.method === 'POST') return login(env, await req.json());

  // Without codes everyone is trusted like a parent.
  const user = codesOn(env) ? await userFromRequest(req, env) : 'parent';
  if (!user) return json({ error: 'unauthorized' }, 401);
  if (path === '/api/dictation' && req.method === 'POST') {
    try { return await gradeDictation(env, await req.json()); } catch (e) { return json({ error: String(e.message || e) }, 502); }
  }
  const m = path.match(/^\/api\/progress\/([a-z]+)$/);
  if (m && KIDS.includes(m[1])) {
    if (user !== 'parent' && user !== m[1]) return json({ error: 'forbidden' }, 403);
    if (req.method === 'GET') return getProgress(env, m[1]);
    if (req.method === 'PUT') return putProgress(env, m[1], await req.json());
  }
  return json({ error: 'not found' }, 404);
}
