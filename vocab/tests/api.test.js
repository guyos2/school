// API tests. Always run against the JSON-file store; also against Postgres when TEST_DATABASE_URL is set.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { handle } from '../api/_server.js';
import { fileDb, postgresDb } from '../api/_db.js';

const env = { TOKEN_SECRET: 'test-secret' };

function client(db) {
  return async (method, path, { body, auth } = {}) => {
    const headers = { 'Content-Type': 'application/json' };
    if (auth) headers.Authorization = auth;
    const r = await handle(new Request(`http://x/api/${path}`, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body),
    }), env, db);
    return { status: r.status, body: await r.json() };
  };
}

async function suite(t, db) {
  const call = client(db);
  const email = `p${Date.now()}@example.com`;

  await t.test('signup and login', async () => {
    assert.equal((await call('POST', 'signup', { body: { email, password: 'short' } })).status, 400);
    const s = await call('POST', 'signup', { body: { email, password: 'longenough1', name: 'אמא' } });
    assert.equal(s.status, 200);
    assert.equal((await call('POST', 'signup', { body: { email, password: 'longenough1' } })).status, 409);
    assert.equal((await call('POST', 'login', { body: { email, password: 'wrongpassword' } })).status, 401);
    const l = await call('POST', 'login', { body: { email: email.toUpperCase(), password: 'longenough1' } });
    assert.equal(l.status, 200);
    assert.ok(l.body.token);
  });

  const { body: { token } } = await call('POST', 'login', { body: { email, password: 'longenough1' } });
  const P = `Bearer ${token}`;
  let kid;

  await t.test('kids', async () => {
    assert.equal((await call('GET', 'me')).status, 401);
    assert.equal((await call('GET', 'me', { auth: 'Bearer abc.def' })).status, 401);
    assert.equal((await call('POST', 'kids', { auth: P, body: { name: 'נועה', grade: 9 } })).status, 400);
    const r = await call('POST', 'kids', { auth: P, body: { name: 'נועה', grade: 5, emoji: '🐼' } });
    assert.equal(r.status, 200);
    kid = r.body.kid;
    const p = await call('PATCH', `kids/${kid.id}`, { auth: P, body: { grade: 6 } });
    assert.equal(p.body.kid.grade, 6);
    assert.equal((await call('GET', 'me', { auth: P })).body.kids.length, 1);
    assert.equal((await call('GET', 'kids/not-an-id/tests', { auth: P })).status, 404);
  });

  await t.test('kid link and family link', async () => {
    const K = `Kid ${kid.linkToken}`;
    const me = await call('GET', 'kid', { auth: K });
    assert.equal(me.body.kid.name, 'נועה');
    assert.equal(me.body.kid.linkToken, undefined);
    assert.equal((await call('GET', 'me', { auth: K })).status, 401);
    const fresh = await call('POST', `kids/${kid.id}/link`, { auth: P });
    assert.notEqual(fresh.body.kid.linkToken, kid.linkToken);
    assert.equal((await call('GET', 'kid', { auth: K })).status, 401);
    kid = fresh.body.kid;

    const { body: { parent } } = await call('GET', 'me', { auth: P });
    const fam = await call('GET', `family/${parent.familyToken}`);
    assert.deepEqual(fam.body.kids.map((k) => k.linkToken), [kid.linkToken]);
    assert.equal((await call('GET', 'family/nope')).status, 404);
  });

  await t.test('progress with versions', async () => {
    const K = `Kid ${kid.linkToken}`;
    assert.equal((await call('GET', 'kid/progress', { auth: K })).body.version, 0);
    const data = { items: { 'w:cat': { box: 1, updated: 1 } }, sessions: [] };
    const a = await call('PUT', 'kid/progress', { auth: K, body: { data, version: 0 } });
    assert.equal(a.body.version, 1);
    assert.equal((await call('PUT', 'kid/progress', { auth: K, body: { data, version: 0 } })).status, 409);
    assert.equal((await call('PUT', 'kid/progress', { auth: K, body: { data, version: 1 } })).body.version, 2);
    const seen = await call('GET', `kids/${kid.id}/progress`, { auth: P });
    assert.deepEqual(seen.body.data.items, data.items);
  });

  await t.test('tests', async () => {
    const bad = await call('POST', `kids/${kid.id}/tests`, { auth: P, body: { title: 'x', date: 'soon', words: [] } });
    assert.equal(bad.status, 400);
    const r = await call('POST', `kids/${kid.id}/tests`, {
      auth: P, body: { title: 'מבחן יחידה 3', date: '2026-11-12', words: [{ en: 'river', he: 'נהר' }] },
    });
    assert.equal(r.status, 200);
    const list = await call('GET', 'kid', { auth: `Kid ${kid.linkToken}` });
    assert.equal(list.body.tests[0].date, '2026-11-12');
    assert.equal((await call('DELETE', `kids/${kid.id}/tests/${r.body.test.id}`, { auth: P })).status, 200);
    assert.equal((await call('GET', `kids/${kid.id}/tests`, { auth: P })).body.tests.length, 0);
  });

  await t.test('another parent cannot reach the kid', async () => {
    const other = await call('POST', 'signup', { body: { email: `o${email}`, password: 'longenough2' } });
    const O = `Bearer ${other.body.token}`;
    assert.equal((await call('GET', `kids/${kid.id}/progress`, { auth: O })).status, 404);
    assert.equal((await call('DELETE', `kids/${kid.id}`, { auth: O })).status, 404);
    assert.equal((await call('DELETE', `kids/${kid.id}`, { auth: P })).status, 200);
    assert.equal((await call('GET', 'kid', { auth: `Kid ${kid.linkToken}` })).status, 401);
  });
}

test('api on the file store', (t) => suite(t, fileDb(join(mkdtempSync(join(tmpdir(), 'vocab-')), 'db.json'))));

test('api on postgres', { skip: !process.env.TEST_DATABASE_URL && 'TEST_DATABASE_URL not set' }, async (t) => {
  const db = await postgresDb(process.env.TEST_DATABASE_URL);
  try { await suite(t, db); } finally { await db.end(); }
});
