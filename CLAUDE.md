# CLAUDE.md

Family learning web app (Hebrew, RTL) for four kids. See README.md for the roadmap.

## Structure
- Plain HTML + ES modules, no build step. Hosted on Vercel (production = `main`, https://school-pearl-eight.vercel.app).
- `content/kids.json`: kids and which modules each one sees.
- `js/app.js`: hash router, home, kid page, settings. Module catalog lives in `MODULES`.
- `js/modules/<module>.js`: one file per learning module, exporting `render(root, kid, routeArgs)`.
- `js/viz/<topic>.js`: visualizations. Each method returns `{ html, caption }`; `vizPanel` shows tabs plus "show another way".
- `js/quiz.js`: shared multiple-choice engine (`runQuiz`, `finishScreen`). Use it for new practice modes.
- `js/speech.js`: English TTS (`say`, `speakBtn`). `content/english/`: letters (sound hints, tips, confusable groups) and word lists (`cvc`, `sight`). Add words from class material here.
- `content/dictation/`: Hebrew dictation word lists (`index.json` + one file per list: syllables as [sound with nikud, letters], traps, wrong spellings). `js/modules/dictation.js` + `js/viz/spelling.js`; `sayHe` in speech.js. Photo grading: `POST /api/dictation` (Claude reads the page, needs env `ANTHROPIC_API_KEY`; the comparison is done in code).
- `js/stats.js`: parent stats page (`#/stats`, `#/stats/<kid>`), computed from saved sessions and items. Sessions carry `module`, `part`, `total`, `correct`, `ms` (duration) and `mastered` (items in box ≥ 4 right after the session); new modules should log the same fields. Item key prefixes map to modules in `PREFIX_MODULE`.
- `js/srs.js`: Leitner spaced repetition. `js/store.js`: local progress plus sync.
- `content/config.json`: `apiUrl` (`/api`). The app enables sync only when `GET /api/status` reports `configured`; otherwise it runs in single-device mode. Login codes apply only when status reports `codes` (env `LOGIN_CODES=on`); currently off, so anyone picks a kid.
- `api/`: Vercel functions. `_server.js` holds all logic: optional login (per-kid code, parent password → signed token) and progress at `progress/<kid>.json`, on the `progress` branch in production and `progress-preview` in previews. Only the kid ids in `KIDS` are accepted; with codes on, a kid's token can only access that kid's progress. Secrets live in Vercel env vars.

## Workflow
- Never commit features straight to `main`; it is what the kids use. Work on a feature branch, push it (Vercel builds a preview), and merge only after the parent approves the preview.

## Conventions
- The UI is Hebrew only. Address kids in **plural imperative / gender-neutral** forms ("נסו", "בחרו"), never gendered singular.
- Math expressions inside Hebrew text must be wrapped LTR (`ltr()` from ui.js or the `.eq` class).
- Every concept needs **at least 3 different visualizations**, switchable by the kid.
- Wrong answer → show the correct answer plus a visualization; never just "wrong".
- Register listeners on `document` with `{ signal: viewSignal() }`, and use `later()` instead of raw `setTimeout`, so nothing leaks between screens.
- Progress items carry an `updated` timestamp; merge is per item, newest wins.

## Adding material from photos
When the parent sends a photo of a test, worksheet or lesson: read it, identify the topic and level, then create a study unit (short explanation with visualizations, 20–40 graded exercises, a mock test in the teacher's style) under `content/units/<kid>/`. The unit format is defined when the `units` module is built (stage 6).
