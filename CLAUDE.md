# CLAUDE.md

Family learning web app (Hebrew, RTL) for four kids. See README.md for the roadmap.

## Structure
- Plain HTML + ES modules, no build step. Served as static files (GitHub Pages).
- `content/kids.json`: kids and which modules each one sees.
- `js/app.js`: hash router, home, kid page, settings. Module catalog lives in `MODULES`.
- `js/modules/<module>.js`: one file per learning module, exporting `render(root, kid, routeArgs)`.
- `js/viz/<topic>.js`: visualizations. Each method returns `{ html, caption }`; `vizPanel` shows tabs plus "show another way".
- `js/srs.js`: Leitner spaced repetition. `js/store.js`: local progress plus sync.
- `content/config.json`: `apiUrl` of the sync server. Empty means single-device mode with no login.
- `worker/`: Cloudflare Worker holding secrets. It handles login (per-kid code, parent password → signed token) and stores progress at `progress/<kid>.json` on the `progress` branch. A kid's token can only access that kid's progress.

## Conventions
- The UI is Hebrew only. Address kids in **plural imperative / gender-neutral** forms ("נסו", "בחרו"), never gendered singular.
- Math expressions inside Hebrew text must be wrapped LTR (`ltr()` from ui.js or the `.eq` class).
- Every concept needs **at least 3 different visualizations**, switchable by the kid.
- Wrong answer → show the correct answer plus a visualization; never just "wrong".
- Register listeners on `document` with `{ signal: viewSignal() }`, and use `later()` instead of raw `setTimeout`, so nothing leaks between screens.
- Progress items carry an `updated` timestamp; merge is per item, newest wins.

## Adding material from photos
When the parent sends a photo of a test, worksheet or lesson: read it, identify the topic and level, then create a study unit (short explanation with visualizations, 20–40 graded exercises, a mock test in the teacher's style) under `content/units/<kid>/`. The unit format is defined when the `units` module is built (stage 6).
