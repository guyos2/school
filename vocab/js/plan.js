// Builds the kid's daily session. Pure functions, so they are tested in node (tests/plan.test.js).
//
// Two modes:
// - free: the open word bank, from the kid's grade upward. Words due for review come first. New words are added
//   by how well the kid is doing: few when recent answers are mostly wrong or many words are still shaky,
//   more when the kid is doing well. Words already known well never fill a session.
// - test: only the words of the coming test. New words are spread so that all of them are met a day or two
//   before the test, and every word not yet solid keeps coming back until the test.
import { KNOWN_BOX } from './srs.js';

const DAY = 864e5;
export const key = (id) => `w:${id}`;

// Share of right first answers in the last two weeks, or null when there are too few answers to tell.
export function recentAccuracy(sessions, now = Date.now()) {
  let total = 0, correct = 0;
  for (const s of sessions || []) {
    if (s.at >= now - 14 * DAY) { total += s.total || 0; correct += s.correct || 0; }
  }
  return total >= 10 ? correct / total : null;
}

export function newWordsAllowed(items, sessions, now = Date.now()) {
  const shaky = Object.values(items).filter((it) => it.box >= 1 && it.box <= 2).length;
  if (shaky >= 20) return 0;
  const acc = recentAccuracy(sessions, now);
  if (acc === null) return 4;
  if (acc < 0.7) return 1;
  if (acc < 0.85) return 3;
  return 6;
}

// pool: word ids in the order new words should come. Returns [{id, isNew}].
export function planFree({ items, sessions, pool, now = Date.now(), size = 12 }) {
  const started = Object.keys(items).filter((k) => k.startsWith('w:')).map((k) => k.slice(2));
  const due = started.filter((id) => items[key(id)].due <= now)
    .sort((a, b) => items[key(a)].box - items[key(b)].box || items[key(a)].due - items[key(b)].due);
  const fresh = pool.filter((id) => !items[key(id)]);
  const allowed = Math.min(newWordsAllowed(items, sessions, now), fresh.length);

  // Keep room for a couple of new words even on a heavy review day, so there is always something new.
  const reviews = due.slice(0, Math.max(0, size - Math.min(allowed, 2)));
  const out = reviews.map((id) => ({ id, isNew: false }));
  out.push(...fresh.slice(0, Math.min(allowed, size - out.length)).map((id) => ({ id, isNew: true })));
  // Still room: the weakest words that are not due yet (never the ones already known well).
  if (out.length < size) {
    const taken = new Set(out.map((x) => x.id));
    const weak = started.filter((id) => !taken.has(id) && items[key(id)].box < KNOWN_BOX)
      .sort((a, b) => items[key(a)].box - items[key(b)].box || items[key(a)].due - items[key(b)].due);
    out.push(...weak.slice(0, size - out.length).map((id) => ({ id, isNew: false })));
  }
  return out;
}

export const daysUntil = (date, now = Date.now()) =>
  Math.ceil((new Date(`${date}T00:00:00`).getTime() - now) / DAY);

// The next test that has not happened yet (a test is active on its own day too).
export function activeTest(tests, now = Date.now()) {
  return [...(tests || [])].filter((t) => daysUntil(t.date, now) >= 0).sort((a, b) => a.date.localeCompare(b.date))[0] || null;
}

// Reviews must come back before the test: cut the gap to half the time left (at least 4 hours).
export const testMaxInterval = (date, now = Date.now()) =>
  Math.max(4 * 36e5, (new Date(`${date}T00:00:00`).getTime() - now) / 2);

// ids: the test's word ids. A word counts as ready once the kid chose the English word right (box 3 and up).
export function readiness(items, ids) {
  if (!ids.length) return 0;
  return ids.filter((id) => (items[key(id)]?.box || 0) >= 3).length / ids.length;
}

export function planTest({ items, ids, date, now = Date.now(), size = 15 }) {
  const left = Math.max(1, daysUntil(date, now));
  const fresh = ids.filter((id) => !items[key(id)]);
  // Meet every word by the day before the test (on the last day: all that are left).
  const perDay = Math.min(10, Math.max(3, Math.ceil(fresh.length / Math.max(1, left - 1))));
  const started = ids.filter((id) => items[key(id)]);
  const due = started.filter((id) => items[key(id)].due <= now)
    .sort((a, b) => items[key(a)].box - items[key(b)].box || items[key(a)].due - items[key(b)].due);

  const out = due.slice(0, Math.max(0, size - Math.min(perDay, fresh.length, 3))).map((id) => ({ id, isNew: false }));
  out.push(...fresh.slice(0, Math.min(perDay, size - out.length)).map((id) => ({ id, isNew: true })));
  // Before a test every word that is not solid yet is worth another look.
  if (out.length < size) {
    const taken = new Set(out.map((x) => x.id));
    const weak = started.filter((id) => !taken.has(id) && items[key(id)].box < KNOWN_BOX)
      .sort((a, b) => items[key(a)].box - items[key(b)].box);
    out.push(...weak.slice(0, size - out.length).map((id) => ({ id, isNew: false })));
  }
  return out;
}

// Counts for the kid's home screen and the parent: known well, still learning, and how many of the grade's words.
export function wordCounts(items, ids) {
  let known = 0, learning = 0;
  for (const id of ids) {
    const box = items[key(id)]?.box || 0;
    if (box >= KNOWN_BOX) known++;
    else if (items[key(id)]) learning++;
  }
  return { known, learning, total: ids.length };
}

// Days in a row with at least one session, counting today or yesterday as the last one.
export function streak(sessions, now = Date.now()) {
  const days = new Set((sessions || []).map((s) => new Date(s.at).toDateString()));
  const d = new Date(now);
  if (!days.has(d.toDateString())) d.setDate(d.getDate() - 1);
  let n = 0;
  while (days.has(d.toDateString())) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
