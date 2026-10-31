// Spaced repetition for words (Leitner boxes 0..7). Box 0 = never seen.
// The exercise gets harder as the box grows (choose the meaning → choose the English → write the meaning),
// so a word only reaches KNOWN_BOX after the kid wrote its meaning correctly at growing gaps of days.
// From then on it comes back rarely (40 days, then 100), and a miss sends it back to practice.
const HOUR = 36e5;
const DAY = 24 * HOUR;
export const INTERVALS = [0, 4 * HOUR, DAY, 3 * DAY, 7 * DAY, 16 * DAY, 40 * DAY, 100 * DAY];
export const KNOWN_BOX = 5;
export const TOP_BOX = INTERVALS.length - 1;
const SLOW_MS = 15000;
const EARLY = 2 * HOUR;

// Which exercise a word gets, by how well it is known.
export function exerciseFor(item) {
  const box = item?.box || 0;
  if (box <= 1) return 'mc-he';   // English word → choose the Hebrew meaning
  if (box === 2) return 'mc-en';  // Hebrew meaning → choose the English word
  return 'write';                 // English word → write (or say) the meaning
}

// maxInterval: in test preparation the next review must come before the test, so long gaps are cut short.
export function review(item, correct, ms, { now = Date.now(), maxInterval = Infinity, claim = false } = {}) {
  const it = item ? { ...item } : { box: 0, seen: 0, right: 0, wrong: 0 };
  it.seen++;
  if (correct) {
    it.right++;
    if (claim) {
      // "We already know this word" and wrote the meaning right: skip the easy steps, the next checks confirm it.
      it.box = Math.max(it.box, 3);
    } else if (it.due && now < it.due - EARLY) {
      // Seen again before it was due (extra practice): right, but it does not prove long-term memory yet.
      it.box = Math.max(it.box, 1);
    } else {
      it.box = ms < SLOW_MS ? Math.min(TOP_BOX, it.box + 1) : Math.max(it.box, 1);
    }
  } else {
    it.wrong++;
    it.box = it.box >= KNOWN_BOX ? 2 : 1;
  }
  it.due = correct ? now + Math.min(INTERVALS[it.box], maxInterval) : now;
  it.updated = now;
  return it;
}
