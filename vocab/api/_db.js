// Storage for the server. Postgres when DATABASE_URL is set (production and previews),
// otherwise a JSON file under .data/ for local development and tests.
// Both expose the same methods and return plain objects with camelCase fields.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCHEMA = join(HERE, '..', 'db', 'schema.sql');

const parentRow = (r) => r && ({ id: r.id, email: r.email, passHash: r.pass_hash, name: r.name, familyToken: r.family_token });
const kidRow = (r) => r && ({ id: r.id, parentId: r.parent_id, name: r.name, grade: r.grade, emoji: r.emoji, linkToken: r.link_token });
const day = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10));
const testRow = (r) => r && ({ id: r.id, kidId: r.kid_id, title: r.title, date: day(r.test_date), words: r.words });

export async function postgresDb(url) {
  const { default: postgres } = await import('postgres');
  const sql = postgres(url, { max: 1, idle_timeout: 20, onnotice: () => {} });
  await sql.unsafe(readFileSync(SCHEMA, 'utf8'));
  const one = async (q) => (await q)[0];
  return {
    kind: 'postgres',
    end: () => sql.end(),
    createParent: (p) => sql`insert into parents (id, email, pass_hash, name, family_token)
      values (${p.id}, ${p.email}, ${p.passHash}, ${p.name}, ${p.familyToken})`.then(() => p),
    parentByEmail: async (email) => parentRow(await one(sql`select * from parents where email = ${email}`)),
    parentById: async (id) => parentRow(await one(sql`select * from parents where id = ${id}`)),
    parentByFamilyToken: async (t) => parentRow(await one(sql`select * from parents where family_token = ${t}`)),
    setFamilyToken: (id, t) => sql`update parents set family_token = ${t} where id = ${id}`,

    kidsOf: async (parentId) => (await sql`select * from kids where parent_id = ${parentId} order by created_at`).map(kidRow),
    kidById: async (id) => kidRow(await one(sql`select * from kids where id = ${id}`)),
    kidByToken: async (t) => kidRow(await one(sql`select * from kids where link_token = ${t}`)),
    createKid: (k) => sql`insert into kids (id, parent_id, name, grade, emoji, link_token)
      values (${k.id}, ${k.parentId}, ${k.name}, ${k.grade}, ${k.emoji}, ${k.linkToken})`.then(() => k),
    updateKid: (id, f) => sql`update kids set name = ${f.name}, grade = ${f.grade}, emoji = ${f.emoji} where id = ${id}`,
    setKidToken: (id, t) => sql`update kids set link_token = ${t} where id = ${id}`,
    deleteKid: (id) => sql`delete from kids where id = ${id}`,

    async getProgress(kidId) {
      const r = await one(sql`select data, version from progress where kid_id = ${kidId}`);
      return r ? { data: r.data, version: r.version } : null;
    },
    // Writes only when the stored version is still `version` (0 = no row yet). Returns the new version, or null on conflict.
    async putProgress(kidId, data, version) {
      if (!version) {
        const r = await sql`insert into progress (kid_id, data) values (${kidId}, ${sql.json(data)})
          on conflict (kid_id) do nothing returning version`;
        return r[0]?.version ?? null;
      }
      const r = await sql`update progress set data = ${sql.json(data)}, version = version + 1, updated_at = now()
        where kid_id = ${kidId} and version = ${version} returning version`;
      return r[0]?.version ?? null;
    },

    testsOf: async (kidId) => (await sql`select * from tests where kid_id = ${kidId} order by test_date`).map(testRow),
    createTest: (t) => sql`insert into tests (id, kid_id, title, test_date, words)
      values (${t.id}, ${t.kidId}, ${t.title}, ${t.date}, ${sql.json(t.words)})`.then(() => t),
    deleteTest: (kidId, id) => sql`delete from tests where id = ${id} and kid_id = ${kidId}`,
  };
}

export function fileDb(path) {
  const empty = { parents: [], kids: [], progress: {}, tests: [] };
  const load = () => (existsSync(path) ? { ...empty, ...JSON.parse(readFileSync(path, 'utf8')) } : structuredClone(empty));
  const save = (db) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, JSON.stringify(db, null, 1)); };
  const edit = (fn) => { const db = load(); const out = fn(db); save(db); return out; };
  const copy = (x) => (x ? structuredClone(x) : null);
  return {
    kind: 'file',
    end: async () => {},
    createParent: async (p) => edit((db) => { db.parents.push(p); return p; }),
    parentByEmail: async (email) => copy(load().parents.find((p) => p.email === email)),
    parentById: async (id) => copy(load().parents.find((p) => p.id === id)),
    parentByFamilyToken: async (t) => copy(load().parents.find((p) => p.familyToken === t)),
    setFamilyToken: async (id, t) => edit((db) => { db.parents.find((p) => p.id === id).familyToken = t; }),

    kidsOf: async (parentId) => load().kids.filter((k) => k.parentId === parentId),
    kidById: async (id) => copy(load().kids.find((k) => k.id === id)),
    kidByToken: async (t) => copy(load().kids.find((k) => k.linkToken === t)),
    createKid: async (k) => edit((db) => { db.kids.push(k); return k; }),
    updateKid: async (id, f) => edit((db) => { Object.assign(db.kids.find((k) => k.id === id), f); }),
    setKidToken: async (id, t) => edit((db) => { db.kids.find((k) => k.id === id).linkToken = t; }),
    deleteKid: async (id) => edit((db) => {
      db.kids = db.kids.filter((k) => k.id !== id);
      db.tests = db.tests.filter((t) => t.kidId !== id);
      delete db.progress[id];
    }),

    getProgress: async (kidId) => copy(load().progress[kidId]),
    putProgress: async (kidId, data, version) => edit((db) => {
      const cur = db.progress[kidId];
      if ((cur?.version || 0) !== (version || 0)) return null;
      db.progress[kidId] = { data, version: (cur?.version || 0) + 1 };
      return db.progress[kidId].version;
    }),

    testsOf: async (kidId) => load().tests.filter((t) => t.kidId === kidId).sort((a, b) => a.date.localeCompare(b.date)),
    createTest: async (t) => edit((db) => { db.tests.push(t); return t; }),
    deleteTest: async (kidId, id) => edit((db) => { db.tests = db.tests.filter((t) => !(t.id === id && t.kidId === kidId)); }),
  };
}

let shared;
export function getDb(env = process.env) {
  if (!shared) {
    if (env.DATABASE_URL) shared = postgresDb(env.DATABASE_URL);
    else if (env.VERCEL_ENV) shared = Promise.reject(new Error('DATABASE_URL is not set'));
    else shared = Promise.resolve(fileDb(join(HERE, '..', '.data', 'db.json')));
    shared.catch(() => { shared = null; });
  }
  return shared;
}
