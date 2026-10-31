import { test } from 'node:test';
import assert from 'node:assert/strict';
import { review, exerciseFor, KNOWN_BOX, INTERVALS } from '../js/srs.js';
import { planFree, planTest, newWordsAllowed, activeTest, readiness, streak, key } from '../js/plan.js';

const DAY = 864e5;
const NOW = new Date('2026-11-01T10:00:00').getTime();
const ids = (n, p = 'w') => Array.from({ length: n }, (_, i) => `${p}${i}`);
const sessionsWith = (correct, total) => [{ at: NOW - DAY, correct, total }];

test('a word becomes known only after right answers at growing gaps', () => {
  let it, t = NOW;
  for (let i = 0; i < KNOWN_BOX; i++) {
    it = review(it, true, 3000, { now: t });
    t = it.due;
  }
  assert.equal(it.box, KNOWN_BOX);
  // Practising again before it is due does not push it further.
  const early = review({ ...it }, true, 3000, { now: it.due - 3 * DAY });
  assert.equal(early.box, KNOWN_BOX);
  // A miss on a known word sends it back to practice, but not to the very start.
  assert.equal(review(it, false, 3000, { now: t }).box, 2);
  assert.equal(review({ box: 3, due: NOW }, false, 1000, { now: NOW }).box, 1);
});

test('exercise gets harder with the box', () => {
  assert.equal(exerciseFor(undefined), 'mc-he');
  assert.equal(exerciseFor({ box: 2 }), 'mc-en');
  assert.equal(exerciseFor({ box: 4 }), 'write');
});

test('"already known" skips ahead only when the meaning was written right', () => {
  assert.equal(review(undefined, true, 2000, { now: NOW, claim: true }).box, 3);
  assert.equal(review(undefined, false, 2000, { now: NOW, claim: true }).box, 1);
});

test('test mode keeps reviews before the test', () => {
  const it = review({ box: 5, due: NOW }, true, 1000, { now: NOW, maxInterval: 2 * DAY });
  assert.equal(it.due, NOW + 2 * DAY);
  assert.ok(INTERVALS[it.box] > 2 * DAY);
});

test('new words follow how the kid is doing', () => {
  assert.equal(newWordsAllowed({}, [], NOW), 4);
  assert.equal(newWordsAllowed({}, sessionsWith(6, 10), NOW), 1);
  assert.equal(newWordsAllowed({}, sessionsWith(8, 10), NOW), 3);
  assert.equal(newWordsAllowed({}, sessionsWith(19, 20), NOW), 6);
  const shaky = Object.fromEntries(ids(20).map((id) => [key(id), { box: 1, due: NOW + DAY }]));
  assert.equal(newWordsAllowed(shaky, sessionsWith(19, 20), NOW), 0);
});

test('free plan: due first, then new, never drills known words', () => {
  const items = {
    [key('a')]: { box: 1, due: NOW - 1 },
    [key('b')]: { box: 3, due: NOW + DAY },
    [key('k')]: { box: 6, due: NOW + 30 * DAY },
  };
  const plan = planFree({ items, sessions: sessionsWith(19, 20), pool: ['a', 'b', 'k', ...ids(10)], now: NOW });
  assert.deepEqual(plan[0], { id: 'a', isNew: false });
  assert.equal(plan.filter((x) => x.isNew).length, 6);
  assert.ok(plan.some((x) => x.id === 'b'));
  assert.ok(!plan.some((x) => x.id === 'k'));
});

test('free plan keeps room for new words on a heavy review day', () => {
  const items = Object.fromEntries(ids(30, 'r').map((id) => [key(id), { box: 3, due: NOW - 1 }]));
  const plan = planFree({ items, sessions: sessionsWith(19, 20), pool: ids(10), now: NOW, size: 12 });
  assert.equal(plan.length, 12);
  assert.equal(plan.filter((x) => x.isNew).length, 2);
});

test('test plan meets all words before the test and stays on the list', () => {
  const words = ids(30, 't');
  const date = new Date(NOW + 4 * DAY).toISOString().slice(0, 10);
  const plan = planTest({ items: { [key('other')]: { box: 1, due: NOW - 1 } }, ids: words, date, now: NOW });
  assert.equal(plan.filter((x) => x.isNew).length, 10);
  assert.ok(plan.every((x) => words.includes(x.id)));
});

test('active test and readiness', () => {
  const today = new Date(NOW).toISOString().slice(0, 10);
  const tests = [{ date: '2026-10-01' }, { date: '2026-12-01' }, { date: today }];
  assert.equal(activeTest(tests, NOW).date, today);
  assert.equal(readiness({ [key('a')]: { box: 3 }, [key('b')]: { box: 1 } }, ['a', 'b']), 0.5);
});

test('streak counts days in a row', () => {
  const s = [0, 1, 2, 4].map((d) => ({ at: NOW - d * DAY }));
  assert.equal(streak(s, NOW), 3);
  assert.equal(streak([{ at: NOW - DAY }], NOW), 1);
  assert.equal(streak([{ at: NOW - 2 * DAY }], NOW), 0);
});
