# CLAUDE.md (vocab app)

A product for parents: English vocabulary and tenses for grades 4–7 (ד׳–ז׳), driven by what the class learns.
Separate from the family app in the repo root: never import from `../js`, copy what is needed. See README.md for the roadmap.

## Structure
- Plain HTML + ES modules, no build step. Deployed as its own Vercel project with Root Directory `vocab`.
- Server: `api/_server.js` (all routes, documented at the top), `api/_db.js` (Postgres via `DATABASE_URL`, JSON file locally), `db/schema.sql`. `vercel.json` rewrites `/api/<path>` to `api/main.js`.
- Parents: email + password (scrypt), signed token (`TOKEN_SECRET`). Kids never log in: each kid has a random link token (`#/k/<token>`, header `Kid <token>`) that reaches only that kid's data; the family link (`#/f/<token>`) lists the kids. Both can be replaced by the parent.
- Words: `content/bank/grade<N>.json` (`id`, `en`, `pos`, `he`, `accept`, `emoji`, `ex`, `exHe`). Item key `w:<word id>`. Test words that are not in the bank get id `c-<slug>` (`resolveTestWords` in `js/bank.js`).
- Learning logic is pure and tested in node: `js/srs.js` (boxes 0–7, `KNOWN_BOX` = 5, exercise by box) and `js/plan.js` (free plan, test plan, readiness, counts). Keep it that way and extend `tests/plan.test.js`.
- Progress: one JSON document per kid (`items`, `sessions`), merged per item (newest `updated` wins) on the device, versioned on the server. Sessions log `module: 'vocab'`, `part: 'free' | 'test'`, `total`, `correct`, `ms`, `mastered`.

## Pedagogy rules
- During test preparation the daily mission is only the test's words; free learning stays available but is never mixed in.
- A word counts as known only after the meaning was written right at growing gaps; known words are not drilled again and again.
- New words in free learning depend on recent accuracy and on how many words are still shaky.

## Conventions
- UI in Hebrew; all strings may later be translated (Arabic, Russian), so keep words data with a per-language meaning field when adding one.
- Address kids in plural imperative / gender-neutral forms ("נסו", "בחרו").
- Wrong answer → show the correct answer plus the word card and sentence; never just "wrong".
- `#app` outlives each screen: draw into a fresh inner element before adding listeners on it, register `document` listeners with `{ signal: viewSignal() }`, and use `later()` instead of raw `setTimeout`.
- Run `npm test` (and the app in a browser) before pushing.
