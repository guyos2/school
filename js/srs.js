// Spaced repetition (Leitner boxes). Box 0 = never seen, 5 = solid.
const HOUR = 36e5;
const DAY = 24 * HOUR;
const INTERVALS = [0, 4 * HOUR, DAY, 3 * DAY, 7 * DAY, 14 * DAY];
const SLOW_MS = 10000;

export const MASTERED_BOX = 4;

export function review(item, correct, ms, now = Date.now()) {
  const it = item ? { ...item } : { box: 0, seen: 0, right: 0, wrong: 0 };
  it.seen++;
  if (correct) {
    it.right++;
    // A correct but very slow answer is not yet "known by heart".
    it.box = ms < SLOW_MS ? Math.min(5, it.box + 1) : Math.max(it.box, 1);
    it.due = now + INTERVALS[it.box];
  } else {
    it.wrong++;
    it.box = 1;
    it.due = now;
  }
  it.updated = now;
  return it;
}

// facts: keys in introduction order. Returns up to n keys for one session.
export function pickSession(items, facts, n, { maxNew = 4, now = Date.now() } = {}) {
  const seen = facts.filter((k) => items[k]);
  const due = seen.filter((k) => items[k].due <= now).sort((a, b) => items[a].due - items[b].due);
  const fresh = facts.filter((k) => !items[k]);
  const out = due.slice(0, n);
  const rest = seen.filter((k) => !out.includes(k)).sort((a, b) => items[a].box - items[b].box);
  // Introduce a few new facts at a time, more only when there is nothing else to review.
  const room = n - out.length;
  const newCount = Math.min(fresh.length, room, Math.max(maxNew, room - rest.length));
  out.push(...fresh.slice(0, newCount));
  // Still room: add the weakest not-yet-due facts.
  out.push(...rest.slice(0, n - out.length));
  return out;
}
