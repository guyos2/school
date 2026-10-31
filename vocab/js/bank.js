// The word bank by grade (content/bank/grade<N>.json), and turning a test's word list into practice words.
export const GRADES = [4, 5, 6, 7];
export const GRADE_NAME = { 4: 'ד׳', 5: 'ה׳', 6: 'ו׳', 7: 'ז׳' };

const cache = {};
export async function loadGrade(g) {
  cache[g] ??= fetch(`content/bank/grade${g}.json`).then((r) => r.json()).then((d) => d.words.map((w) => ({ ...w, grade: g })));
  return cache[g];
}

// All grades, in level order. Used for new words in free learning (from the kid's grade up) and for distractors.
export async function loadBank() {
  const lists = await Promise.all(GRADES.map(loadGrade));
  return lists.flat();
}

export const norm = (en) => String(en).trim().toLowerCase().replace(/\s+/g, ' ');
const slug = (en) => norm(en).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// A test word matches a bank word by its English: it keeps the bank's picture and sentence, and the meaning
// the parent typed comes first (the bank's meanings also count). Other words get their own id.
export function resolveTestWords(test, bank) {
  const byEn = new Map(bank.map((w) => [norm(w.en), w]));
  return test.words.map((tw) => {
    const b = (tw.id && bank.find((w) => w.id === tw.id)) || byEn.get(norm(tw.en));
    if (b) {
      const accept = [...new Set([b.he, ...(b.accept || [])])].filter((m) => m !== tw.he);
      return { ...b, he: tw.he, accept };
    }
    return { id: `c-${slug(tw.en)}`, en: tw.en.trim(), he: tw.he, emoji: '📝', pos: '' };
  });
}

// The parent's word list, one word per line: "river - נהר", "river: נהר", "נהר river", or just "river"
// (a word that is in the bank gets the bank's meaning). Returns {words, errors}.
export function parseWordLines(text, bank) {
  const byEn = new Map(bank.map((w) => [norm(w.en), w]));
  const words = [], errors = [], seen = new Set();
  for (const raw of String(text).split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const en = (line.match(/[A-Za-z][A-Za-z'’ .-]*[A-Za-z.]|[A-Za-z]/) || [])[0]?.trim();
    const he = line.replace(en || '', ' ').replace(/[-–—:=|\t]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!en) { errors.push(line); continue; }
    const meaning = /[א-ת]/.test(he) ? he : byEn.get(norm(en))?.he;
    if (!meaning) { errors.push(line); continue; }
    if (seen.has(norm(en))) continue;
    seen.add(norm(en));
    words.push({ en, he: meaning });
  }
  return { words, errors };
}
