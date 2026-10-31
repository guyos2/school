// Checks a typed or spoken Hebrew meaning against the accepted meanings of a word.
// A word has `he` (the main meaning, may list several separated by commas) and `accept` (other fine answers).
const FINAL = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };

// No nikud, quotes or punctuation, final letters as regular ones, and no leading ל on a word ("לשלב" = "שלב").
const canon = (s) => String(s).replace(/[֑-ׇ]/g, '').replace(/[׳'"״”“’`.,!?()\-–־]/g, ' ')
  .replace(/[ךםןףץ]/g, (c) => FINAL[c]).split(/\s+/).filter(Boolean)
  .map((w) => (w.length > 3 && w[0] === 'ל' ? w.slice(1) : w)).join(' ');

function distance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

export const acceptedMeanings = (w) => [...new Set([...w.he.split(/[,;]/), ...(w.accept || [])].map((x) => x.trim()).filter(Boolean))];

// `answers`: what the kid wrote, plus what speech recognition heard (several guesses are fine).
export function meaningMatch(answers, w) {
  const accepted = acceptedMeanings(w).map(canon).filter(Boolean);
  const segments = [answers].flat().flatMap((a) => String(a).split(/[,;/\n]| או /)).map(canon).filter(Boolean);
  return segments.some((seg) => {
    if (/(^| )לא( |$)/.test(seg)) return false;
    return accepted.some((a) => seg === a
      || (a.length >= 3 && ` ${seg} `.includes(` ${a} `))
      || (a.length >= 4 && distance(seg, a) <= (a.length >= 8 ? 2 : 1)));
  });
}
