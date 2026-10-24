// Family sync server (Cloudflare Worker).
// Keeps the secrets (GitHub token, later the Claude API key) off the kids' devices
// and stores each child's progress as progress/<kid>.json on a separate git branch,
// so progress commits don't redeploy the site.
//
// Secrets/vars: FAMILY_KEY, GH_TOKEN, GH_REPO ("owner/repo"), GH_BRANCH (default "progress").

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,PUT,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,X-Family-Key',
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const b64encode = (s) => {
  let bin = '';
  for (const byte of new TextEncoder().encode(s)) bin += String.fromCharCode(byte);
  return btoa(bin);
};
const b64decode = (s) =>
  new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\n/g, '')), (c) => c.charCodeAt(0)));

function gh(env, path, init = {}) {
  return fetch(`https://api.github.com/repos/${env.GH_REPO}/contents/${path}`, {
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
  const branch = env.GH_BRANCH || 'progress';
  const r = await gh(env, `progress/${kid}.json?ref=${branch}`);
  if (r.status === 404) return json({ data: null, sha: null });
  if (!r.ok) return json({ error: `github ${r.status}` }, 502);
  const file = await r.json();
  return json({ data: JSON.parse(b64decode(file.content)), sha: file.sha });
}

async function putProgress(env, kid, { data, sha }) {
  const branch = env.GH_BRANCH || 'progress';
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

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (!env.FAMILY_KEY || req.headers.get('X-Family-Key') !== env.FAMILY_KEY) {
      return json({ error: 'unauthorized' }, 401);
    }
    const m = new URL(req.url).pathname.match(/^\/progress\/([a-z]+)$/);
    if (m) {
      if (req.method === 'GET') return getProgress(env, m[1]);
      if (req.method === 'PUT') return putProgress(env, m[1], await req.json());
    }
    return json({ error: 'not found' }, 404);
  },
};
