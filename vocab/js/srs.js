// Spaced repetition for words (Leitner boxes 0..7). Box 0 = never seen.
// A word only reaches KNOWN_BOX after the kid wrote (or said) the answer correctly at growing gaps of days;
// choosing from options moves it up to orange at most.
// From then on it comes back rarely (40 days, then 100), and a miss sends it back to practice.
const HOUR = 36e5;
const DAY = 24 * HOUR;
export const INTERVALS = [0, 4 * HOUR, DAY, 3 * DAY, 7 * DAY, 16 * DAY, 40 * DAY, 100 * DAY];
export const KNOWN_BOX = 5;
export const TOP_BOX = INTERVALS.length - 1;
const SLOW_MS = 15000;
const EARLY = 2 * HOUR;

// Which way a word is asked. Once the kid can recognise it, it is asked the other way round once:
// the Hebrew meaning, and the kid gives the English word.
export const directionFor = (item) => ((item?.box || 0) === 2 ? 'he-en' : 'en-he');

// The kid chooses how to answer: writing (or saying) the answer proves the word is really known;
// choosing from 4 options shows the word is known with less certainty, so it moves the word up to orange at most
// (CHOICE_CAP), and only writing makes a word green (KNOWN_BOX).
export const CHOICE_CAP = KNOWN_BOX - 1;

// mode: 'write' | 'choice'. maxInterval: in test preparation the next review must come before the test.
// claim: the kid said "we know this word" when it was new.
export function review(item, correct, ms, { now = Date.now(), maxInterval = Infinity, claim = false, mode = 'choice' } = {}) {
  const it = item ? { ...item } : { box: 0, seen: 0, right: 0, wrong: 0 };
  it.seen++;
  let interval;
  if (correct) {
    it.right++;
    if (mode === 'write') it.wr = (it.wr || 0) + 1; else it.cr = (it.cr || 0) + 1;
    if (claim) {
      // Known from before: skip the first steps, the next checks confirm it.
      it.box = Math.max(it.box, mode === 'write' ? 3 : 2);
    } else if (it.due && now < it.due - EARLY) {
      // Seen again before it was due (extra practice): right, but it does not prove long-term memory yet.
      it.box = Math.max(it.box, 1);
    } else if (ms >= SLOW_MS) {
      it.box = Math.max(it.box, 1);
    } else if (mode === 'write') {
      it.box = Math.min(TOP_BOX, it.box + 1);
    } else if (it.box >= CHOICE_CAP) {
      // Chosen, not written: stays where it is, and comes back sooner than a written answer would.
      interval = INTERVALS[CHOICE_CAP];
    } else {
      it.box += 1;
    }
  } else {
    it.wrong++;
    it.box = it.box >= KNOWN_BOX ? 2 : 1;
  }
  it.mode = mode;
  it.due = correct ? now + Math.min(interval ?? INTERVALS[it.box], maxInterval) : now;
  it.updated = now;
  return it;
}
