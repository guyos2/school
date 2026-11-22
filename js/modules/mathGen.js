// Question generators for Itamar's math review (grade 8). Every generator takes optional fixed numbers
// (the class sheet in content/units/itamar/2026-11-24-math.json uses them) and otherwise picks fresh ones.
// A question: { skill, topic, deep, text, parts: [{ label, q, kind: num|ratio|frac|choice, ans, unit, approx, pre, options }], steps, viz, vstart }.
// Text uses $…$ for math (rendered LTR by tx() in viz/math.js).
import { fmt, gcd } from '../viz/math.js';
import { shuffle, pick } from '../ui.js';

const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const R2 = (n) => Math.round(n * 100) / 100;
const PI = 3.14;
const coprime = (max = 9) => { for (;;) { const p = rnd(1, max), q = rnd(1, max); if (p !== q && gcd(p, q) === 1) return [p, q]; } };
// a·x + b written like the teacher: 3x + 15, 4x − 10
const ex = (a, b, v = 'x') => `${a === 1 ? '' : a}${v}${b ? (b > 0 ? ` + ${b}` : ` − ${-b}`) : ''}`;
const num = (label, q, ans, unit = '', o = {}) => ({ label, q, kind: 'num', ans, unit, ...o });
const km = (cm) => fmt(cm / 100000);

export const TOPICS = {
  ratio: { title: 'יחס ופרופורציה', icon: '⚖️', ch: 'א' },
  scale: { title: 'קנה מידה במפה', icon: '🗺️', ch: 'ב' },
  circle: { title: 'היקף מעגל ושטח עיגול', icon: '⭕', ch: 'ג' },
  percent: { title: 'אחוזים', icon: '💯', ch: 'ד' },
  pyth: { title: 'משפט פיתגורס', icon: '📐', ch: 'ה' },
  angles: { title: 'זוויות מתאימות', icon: '📏', ch: 'ו' },
};

export const GEN = {
  // ---------------- ratio ----------------
  'r-simp': { topic: 'ratio', name: 'צמצום יחס', make: (o = {}) => {
    let a = o.a, b = o.b;
    if (a == null) { const [p, q] = coprime(); const g = rnd(2, 9); a = p * g; b = q * g; }
    const g = gcd(a, b), p = a / g, q = b / g;
    return { text: `צמצמו את היחס ליחס הפשוט ביותר (במספרים שלמים): $${a} : ${b}$`,
      parts: [{ kind: 'ratio', ans: [p, q] }],
      steps: [`המחלק המשותף הגדול ביותר של $${a}$ ושל $${b}$ הוא $${g}$.`, `מחלקים את שני החלקים ב-$${g}$, כלומר $${a} ÷ ${g} = ${p}$, $${b} ÷ ${g} = ${q}$.`, `היחס הפשוט: $${p} : ${q}$`],
      viz: { t: 'ratio', parts: [p, q], k: g, from: [a, b] }, vstart: 2 };
  } },
  'r-dec': { topic: 'ratio', name: 'יחס עם עשרוניים', make: (o = {}) => {
    let a = o.a, b = o.b;
    if (a == null) { const [p, q] = coprime(6); const u = pick([0.1, 0.2, 0.3, 0.4, 0.5]); a = R2(p * u); b = R2(q * u); }
    const A = Math.round(a * 10), B = Math.round(b * 10), g = gcd(A, B);
    return { text: `צמצמו את היחס ליחס הפשוט ביותר (במספרים שלמים): $${fmt(a)} : ${fmt(b)}$`,
      parts: [{ kind: 'ratio', ans: [A / g, B / g] }],
      steps: [`כדי להיפטר מהנקודה כופלים את שני החלקים ב-$10$, כלומר $${A} : ${B}$.`, `מחלקים ב-$${g}$, כלומר $${A / g} : ${B / g}$`],
      viz: { t: 'ratio', parts: [A / g, B / g], k: R2((g / 10)), from: [a, b] }, vstart: 2 };
  } },
  'r-units': { topic: 'ratio', name: 'יחס עם המרת יחידות', make: (o = {}) => {
    const U = [{ s: 'דקות', b: 'שעות', b1: 'שעה', f: 60 }, { s: 'ס"מ', b: 'מטרים', b1: 'מטר', f: 100 }, { s: 'גרם', b: 'ק"ג', b1: 'ק"ג', f: 1000 }, { s: 'שניות', b: 'דקות', b1: 'דקה', f: 60 }];
    let u = U[o.u ?? 0], S = o.S, B = o.B;
    if (S == null) {
      for (;;) {
        u = pick(U); B = rnd(1, 4); const [p, q] = coprime(10);
        if (p < q && (B * u.f * p) % q === 0) { S = (B * u.f * p) / q; break; }
      }
    }
    const L = B * u.f, g = gcd(S, L);
    return { text: `מה היחס בין ${S} ${u.s} ל-${B === 1 ? u.b1 : `${B} ${u.b}`}? (המירו תחילה ליחידות זהות)`,
      parts: [{ kind: 'ratio', ans: [S / g, L / g] }],
      steps: [`ממירים ל${u.s}: $${B} × ${u.f} = ${L}$ ${u.s}.`, `היחס: $${S} : ${L}$`, `מחלקים ב-$${g}$, כלומר $${S / g} : ${L / g}$`],
      viz: { t: 'ratio', parts: [S / g, L / g], k: g, from: [S, L], names: [u.s, `${u.s} (במקום ${u.b})`] }, vstart: 2 };
  } },
  'r-prop': { topic: 'ratio', name: 'מציאת x בפרופורציה', make: (o = {}) => {
    // a : b = c : d with one of c/d unknown (o.v = 0 → x is c, 1 → x is d)
    let { a, b, c, d } = o;
    if (a == null) {
      const [p, q] = coprime(); const m = rnd(2, 8), f = rnd(1, 2);
      a = p * f; b = q * f; if (Math.random() < 0.5) { d = q * m; c = null; } else { c = p * m; d = null; }
    }
    const x = c == null ? (a * d) / b : (b * c) / a;
    const L = c == null ? `${a} : ${b} = x : ${d}` : o.flip ? `${c} : x = ${a} : ${b}` : `${a} : ${b} = ${c} : x`;
    const steps = c == null
      ? [`כפל בהצלבה: $${a} × ${d} = ${b} × x$`, `$${a * d} = ${b}x$`, `$x = ${a * d} ÷ ${b} = ${fmt(x)}$`]
      : [`כפל בהצלבה: $${a} × x = ${b} × ${c}$`, `$${a}x = ${b * c}$`, `$x = ${b * c} ÷ ${a} = ${fmt(x)}$`];
    const g = gcd(a, b);
    steps.push(`בדיקה: מצמצמים את שני היחסים ומקבלים את אותו יחס $${a / g} : ${b / g}$.`);
    return { text: `מצאו את x: $${L}$`, parts: [num('', '', x)], steps,
      viz: { t: 'ratio', parts: [a / g, b / g], k: c == null ? d / (b / g) : c / (a / g) }, vstart: 3 };
  } },
  'r-alg': { topic: 'ratio', deep: true, name: 'פרופורציה עם ביטוי', make: (o = {}) => {
    let { add, den, c, d } = o;
    if (add == null) { [c, d] = coprime(7); const m = rnd(2, 4); den = d * m; add = rnd(1, Math.max(1, c * m - 1)); }
    const m = den / d, x = c * m - add;
    return { text: `מצאו את x: $(x + ${add}) / ${den} = ${c} / ${d}$`, parts: [num('', '', x)],
      steps: [`כפל בהצלבה: $${d} × (x + ${add}) = ${den} × ${c}$`, `$${d}(x + ${add}) = ${den * c}$`, `מחלקים ב-$${d}$, כלומר $x + ${add} = ${den * c / d}$`, `$x = ${den * c / d} − ${add} = ${x}$`],
      viz: { t: 'ratio', parts: [c, d], k: m }, vstart: 3 };
  } },
  'r-share': { topic: 'ratio', name: 'חלוקה לפי יחס', make: (o = {}) => {
    const NAMES = [['בנים', 'בנות', 'בכיתה לומדים {T} תלמידים. היחס בין מספר הבנים למספר הבנות הוא {R}.'], ['כדורים כחולים', 'כדורים אדומים', 'בקופסה {T} כדורים, כחולים ואדומים. היחס בין הכחולים לאדומים הוא {R}.'], ['גרם קמח', 'גרם סוכר', 'בעוגה {T} גרם קמח וסוכר יחד, ביחס של {R}.']];
    let { p, q, k, n = rnd(0, NAMES.length - 1) } = o;
    if (p == null) { [p, q] = coprime(7); k = rnd(2, 12); }
    const T = (p + q) * k, [A, B, story] = NAMES[n];
    return { text: `${story.replace('{T}', T).replace('{R}', `$${p} : ${q}$`)} כמה ${A} וכמה ${B}?`,
      parts: [num('', A, p * k), num('', B, q * k)],
      steps: [`מספר החלקים: $${p} + ${q} = ${p + q}$`, `חלק אחד: $${T} ÷ ${p + q} = ${k}$`, `${A}: $${p} × ${k} = ${p * k}$`, `${B}: $${q} × ${k} = ${q * k}$`, `בדיקה: $${p * k} + ${q * k} = ${T}$ ✓`],
      viz: { t: 'ratio', parts: [p, q], k, names: [A, B] }, vstart: 0 };
  } },
  'r-change': { topic: 'ratio', name: 'יחס חדש אחרי שינוי', make: (o = {}) => {
    let { p, q, k, add } = o;
    if (p == null) { [p, q] = coprime(6); k = rnd(2, 8); add = rnd(1, 3) * q; }
    const A = p * k + add, B = q * k, g = gcd(A, B);
    return { text: `בכיתה לומדים ${(p + q) * k} תלמידים. היחס בין מספר הבנים למספר הבנות הוא $${p} : ${q}$. כמה בנים וכמה בנות לומדים בכיתה? ואם יצטרפו לכיתה עוד ${add} בנים, מה יהיה היחס החדש בין מספר הבנים למספר הבנות?`,
      parts: [num('א', 'בנים', p * k), num('', 'בנות', q * k), { label: 'ב', q: 'היחס החדש (בנים : בנות), מצומצם', kind: 'ratio', ans: [A / g, B / g] }],
      steps: [`חלק אחד: $${(p + q) * k} ÷ ${p + q} = ${k}$. בנים: $${p} × ${k} = ${p * k}$, בנות: $${q} × ${k} = ${q * k}$.`, `אחרי ההצטרפות: בנים $${p * k} + ${add} = ${A}$, הבנות נשארות $${B}$.`, `היחס: $${A} : ${B}$, מחלקים ב-$${g}$, כלומר $${A / g} : ${B / g}$`],
      viz: { t: 'ratio', parts: [p, q], k, names: ['בנים', 'בנות'] }, vstart: 0 };
  } },
  'r-share3': { topic: 'ratio', deep: true, name: 'חלוקה לשלושה', make: (o = {}) => {
    let { r, k } = o;
    if (!r) { r = pick([[4, 3, 2], [5, 3, 2], [3, 2, 1], [5, 4, 1], [6, 3, 1], [4, 2, 1]]); k = rnd(2, 10) * 10; }
    const T = r.reduce((a, b) => a + b) * k, n = r.reduce((a, b) => a + b);
    return { text: `סכום של ${T} ש"ח חולק בין שלושה אחים ביחס של $${r.join(' : ')}$. כמה שקלים קיבל כל אח?`,
      parts: r.map((x, i) => num('', ['האח הראשון', 'האח השני', 'האח השלישי'][i], x * k, 'ש"ח')),
      steps: [`מספר החלקים: $${r.join(' + ')} = ${n}$`, `חלק אחד: $${T} ÷ ${n} = ${k}$`, ...r.map((x, i) => `${['הראשון', 'השני', 'השלישי'][i]}: $${x} × ${k} = ${x * k}$`)],
      viz: { t: 'ratio', parts: r, k, names: ['אח א', 'אח ב', 'אח ג'] }, vstart: 0 };
  } },

  // ---------------- map scale ----------------
  's-real': { topic: 'scale', name: 'ממפה למציאות', make: (o = {}) => {
    let { n, map } = o;
    if (n == null) { n = pick([20000, 25000, 50000, 100000, 200000, 250000, 500000]); map = rnd(2, 20); }
    const real = map * n, small = real < 100000;
    return { text: `במפה שקנה המידה שלה $1 : ${fmt(n)}$ המרחק בין שתי נקודות הוא ${map} ס"מ. מהו המרחק במציאות?`,
      parts: [num('א', 'בס"מ', real, 'ס"מ'), small ? num('ב', 'במטרים', real / 100, 'מ\'') : num('ב', 'בק"מ', real / 100000, 'ק"מ')],
      steps: [`כל ס"מ במפה = $${fmt(n)}$ ס"מ במציאות.`, `$${map} × ${fmt(n)} = ${fmt(real)}$ ס"מ`, small ? `$${fmt(real)} ÷ 100 = ${fmt(real / 100)}$ מטר` : `$${fmt(real)} ÷ 100,000 = ${km(real)}$ ק"מ (מוחקים 5 אפסים)`],
      viz: { t: 'scale', n, map, real }, vstart: 0 };
  } },
  's-map': { topic: 'scale', name: 'ממציאות למפה', make: (o = {}) => {
    let { n, map } = o;
    if (n == null) { n = pick([50000, 100000, 200000, 250000, 500000]); map = rnd(2, 16); }
    const real = map * n;
    return { text: `המרחק במציאות בין שני מקומות הוא ${km(real)} ק"מ. מה יהיה המרחק ביניהם במפה שקנה המידה שלה $1 : ${fmt(n)}$?`,
      parts: [num('', 'המרחק במפה', map, 'ס"מ')],
      steps: [`ממירים לס"מ: $${km(real)}$ ק"מ $= ${km(real)} × 100,000 = ${fmt(real)}$ ס"מ`, `מחלקים בקנה המידה: $${fmt(real)} ÷ ${fmt(n)} = ${map}$ ס"מ`],
      viz: { t: 'scale', n, map, real }, vstart: 1 };
  } },
  's-find': { topic: 'scale', name: 'מציאת קנה המידה', make: (o = {}) => {
    let { map, real, inM } = o; // real in cm
    if (map == null) { const n = pick([10000, 20000, 25000, 40000, 50000, 200000, 400000]); map = rnd(2, 12); real = map * n; inM = real < 100000; }
    const n = real / map;
    return { text: `במפה המרחק בין שני בתים הוא ${map} ס"מ, ובמציאות ${inM ? `${fmt(real / 100)} מטר` : `${km(real)} ק"מ`}. מהו קנה המידה של המפה?`,
      parts: [num('', 'קנה המידה', n, '', { pre: '1 :' })],
      steps: [`ממירים לס"מ: ${inM ? `$${fmt(real / 100)} × 100 = ${fmt(real)}$` : `$${km(real)} × 100,000 = ${fmt(real)}$`} ס"מ`, `$${fmt(real)} ÷ ${map} = ${fmt(n)}$`, `קנה המידה: $1 : ${fmt(n)}$`],
      viz: { t: 'scale', n, map, real }, vstart: 3 };
  } },
  's-two': { topic: 'scale', deep: true, name: 'שתי מפות', make: (o = {}) => {
    let { realKm, mapA, nB } = o;
    if (realKm == null) { const nA = pick([200000, 400000, 500000]); mapA = rnd(3, 12); realKm = (mapA * nA) / 100000; nB = pick([100000, 200000, 300000, 600000].filter((x) => (realKm * 100000) % x === 0 && x !== nA)) || 100000; }
    const real = realKm * 100000, nA = real / mapA, mapB = real / nB;
    return { text: `המרחק האמיתי בין שני יישובים הוא ${realKm} ק"מ. במפה א' המרחק ביניהם הוא ${mapA} ס"מ, ובמפה ב' קנה המידה הוא $1 : ${fmt(nB)}$.`,
      parts: [num('א', 'מהו קנה המידה של מפה א\'?', nA, '', { pre: '1 :' }), num('ב', 'מה יהיה המרחק במפה ב\'?', mapB, 'ס"מ')],
      steps: [`$${realKm}$ ק"מ $= ${fmt(real)}$ ס"מ`, `מפה א': $${fmt(real)} ÷ ${mapA} = ${fmt(nA)}$, כלומר $1 : ${fmt(nA)}$`, `מפה ב': $${fmt(real)} ÷ ${fmt(nB)} = ${fmt(mapB)}$ ס"מ`],
      viz: { t: 'scale', n: nA, map: mapA, real }, vstart: 3 };
  } },

  // ---------------- circle (π ≈ 3.14) ----------------
  'c-wheel': { topic: 'circle', name: 'גלגל מסתובב', make: (o = {}) => {
    let { d, turns } = o;
    if (d == null) { d = pick([40, 50, 60, 70, 80]); turns = pick([10, 20, 50, 100]); }
    const r = d / 2, P = R2(PI * d), dist = R2((P * turns) / 100);
    return { text: `קוטרו של גלגל אופניים הוא ${d} ס"מ.`,
      parts: [num('א', 'מהו רדיוס הגלגל?', r, 'ס"מ'), num('ב', 'מהו היקף הגלגל?', P, 'ס"מ', { approx: true }), num('ג', `איזה מרחק (במטרים) יעברו האופניים ב-${turns} סיבובים מלאים?`, dist, 'מ\'', { approx: true })],
      steps: [`$R = d ÷ 2 = ${d} ÷ 2 = ${r}$ ס"מ`, `$P = 2 × π × R = 2 × 3.14 × ${r} = ${fmt(P)}$ ס"מ`, `בכל סיבוב הגלגל עובר היקף אחד: $${turns} × ${fmt(P)} = ${fmt(R2(P * turns))}$ ס"מ`, `$${fmt(R2(P * turns))} ÷ 100 = ${fmt(dist)}$ מטר`],
      viz: { t: 'circle', r, unit: 'ס"מ', turns }, vstart: 1 };
  } },
  'c-garden': { topic: 'circle', name: 'ערוגה עגולה', make: (o = {}) => {
    let { d } = o;
    if (d == null) d = pick([4, 6, 8, 10, 12, 20]);
    const r = d / 2;
    return { text: `לפניכם ערוגת פרחים עגולה שקוטרה ${d} מטרים.`,
      parts: [num('א', 'רוצים לגדר את הערוגה מסביב. מהו אורך הגדר?', R2(PI * d), 'מ\'', { approx: true }), num('ב', 'רוצים לפזר דשן על כל הערוגה. מהו שטח הערוגה?', R2(PI * r * r), 'מ"ר', { approx: true })],
      steps: [`גדר מסביב = היקף: $P = π × d = 3.14 × ${d} = ${fmt(R2(PI * d))}$ מ'`, `דשן על כל הערוגה = שטח. קודם רדיוס: $R = ${d} ÷ 2 = ${r}$`, `$S = π × R² = 3.14 × ${r} × ${r} = ${fmt(R2(PI * r * r))}$ מ"ר`],
      viz: { t: 'circle', r, unit: 'מ\'' }, vstart: 4 };
  } },
  'c-area-d': { topic: 'circle', name: 'שטח כשנתון קוטר', make: (o = {}) => {
    let { d } = o;
    if (d == null) d = pick([6, 10, 14, 16, 18, 30]);
    const r = d / 2;
    return { text: `קוטרו של עיגול הוא ${d} ס"מ. חשבו את שטח העיגול.`, parts: [num('', 'שטח העיגול', R2(PI * r * r), 'סמ"ר', { approx: true })],
      steps: [`זהירות, נתון קוטר! $R = ${d} ÷ 2 = ${r}$`, `$S = 3.14 × ${r}² = 3.14 × ${r * r} = ${fmt(R2(PI * r * r))}$ סמ"ר`],
      viz: { t: 'circle', r, unit: 'ס"מ' }, vstart: 3 };
  } },
  'c-r': { topic: 'circle', name: 'היקף ושטח מרדיוס', make: (o = {}) => {
    let { r } = o;
    if (r == null) r = pick([2, 3, 5, 7, 9, 11, 15]);
    return { text: `רדיוס של עיגול הוא ${r} ס"מ.`,
      parts: [num('א', 'היקף המעגל', R2(2 * PI * r), 'ס"מ', { approx: true }), num('ב', 'שטח העיגול', R2(PI * r * r), 'סמ"ר', { approx: true })],
      steps: [`$P = 2 × 3.14 × ${r} = ${fmt(R2(2 * PI * r))}$`, `$S = 3.14 × ${r} × ${r} = ${fmt(R2(PI * r * r))}$`],
      viz: { t: 'circle', r, unit: 'ס"מ' }, vstart: 4 };
  } },
  'c-compare': { topic: 'circle', name: 'קוטר מול רדיוס', make: (o = {}) => {
    let { a } = o;
    if (a == null) a = pick([4, 6, 8, 10, 12]);
    const PA = R2(PI * a), PB = R2(2 * PI * a), SA = R2(PI * (a / 2) ** 2), SB = R2(PI * a * a);
    return { text: `קוטרו של עיגול א' הוא ${a} ס"מ, ורדיוסו של עיגול ב' הוא ${a} ס"מ.`,
      parts: [num('א', 'היקף עיגול א\'', PA, 'ס"מ', { approx: true }), num('', 'היקף עיגול ב\'', PB, 'ס"מ', { approx: true }), num('', 'פי כמה גדול היקף ב\'?', 2, ''),
        num('ב', 'שטח עיגול א\'', SA, 'סמ"ר', { approx: true }), num('', 'שטח עיגול ב\'', SB, 'סמ"ר', { approx: true }), num('', 'פי כמה גדול שטח ב\'?', 4, '')],
      steps: [`עיגול א': $R = ${a / 2}$. עיגול ב': $R = ${a}$, פי 2.`, `היקפים: $${fmt(PA)}$ ו-$${fmt(PB)}$, היחס $${fmt(PB)} ÷ ${fmt(PA)} = 2$`, `שטחים: $3.14 × ${a / 2}² = ${fmt(SA)}$ ו-$3.14 × ${a}² = ${fmt(SB)}$, היחס $4$`, 'כשהרדיוס גדל פי 2, ההיקף גדל פי 2 והשטח פי $2 × 2 = 4$.'],
      viz: { t: 'circle', r: a, unit: 'ס"מ' }, vstart: 3 };
  } },
  'c-square': { topic: 'circle', deep: true, name: 'עיגול בתוך ריבוע', make: (o = {}) => {
    let { a } = o;
    if (a == null) a = pick([8, 10, 12, 14, 20]);
    const r = a / 2, Sc = R2(PI * r * r);
    return { text: `נתון ריבוע שאורך צלעו ${a} ס"מ, ובתוכו חסום עיגול המשיק לכל צלעותיו (קוטר העיגול שווה לצלע הריבוע).`,
      parts: [num('א', 'שטח הריבוע', a * a, 'סמ"ר'), num('', 'שטח העיגול', Sc, 'סמ"ר', { approx: true }), num('ב', 'השטח שבין הריבוע לעיגול', R2(a * a - Sc), 'סמ"ר', { approx: true })],
      steps: [`ריבוע: $${a} × ${a} = ${a * a}$`, `קוטר העיגול $${a}$, ולכן $R = ${r}$, כלומר $S = 3.14 × ${r}² = ${fmt(Sc)}$`, `השטח שביניהם: $${a * a} − ${fmt(Sc)} = ${fmt(R2(a * a - Sc))}$`],
      viz: { t: 'circle', r, unit: 'ס"מ' }, vstart: 3 };
  } },
  'c-back': { topic: 'circle', deep: true, name: 'מההיקף לקוטר', make: (o = {}) => {
    let { d } = o;
    if (d == null) d = pick([5, 10, 20, 30, 50]);
    const P = R2(PI * d);
    return { text: `היקף של מעגל הוא ${fmt(P)} ס"מ. מהו הקוטר שלו? ומה הרדיוס?`,
      parts: [num('', 'הקוטר', d, 'ס"מ', { approx: true }), num('', 'הרדיוס', d / 2, 'ס"מ', { approx: true })],
      steps: [`$P = π × d$, ולכן $d = P ÷ π$`, `$d = ${fmt(P)} ÷ 3.14 = ${d}$`, `$R = ${d} ÷ 2 = ${fmt(d / 2)}$`],
      viz: { t: 'circle', r: d / 2, unit: 'ס"מ' }, vstart: 1 };
  } },

  // ---------------- percent ----------------
  'p-conv': { topic: 'percent', name: 'אחוז, שבר ועשרוני', make: (o = {}) => {
    let { p, given } = o;
    if (p == null) { p = pick([4, 5, 8, 10, 12, 15, 20, 25, 30, 35, 40, 50, 60, 75, 80]); given = pick(['p', 'f', 'd']); }
    const g = gcd(p, 100), f = [p / g, 100 / g], d = p / 100;
    const show = { p: `$${p}%$`, f: `$${f[0]}/${f[1]}$`, d: `$${fmt(d)}$` }[given];
    const parts = [];
    if (given !== 'p') parts.push(num('', 'אחוז', p, '%'));
    if (given !== 'f') parts.push({ label: '', q: 'שבר פשוט מצומצם', kind: 'frac', ans: f });
    if (given !== 'd') parts.push(num('', 'שבר עשרוני', d));
    return { text: `השלימו: ${show} = ? (אחוז, שבר פשוט מצומצם ושבר עשרוני)`, parts,
      steps: [`אחוז הוא שבר עם מכנה 100: $${p}% = ${p}/100$`, `מצמצמים ב-$${g}$, כלומר $${f[0]}/${f[1]}$`, `שבר עשרוני: $${p} ÷ 100 = ${fmt(d)}$`],
      viz: { t: 'percent', p, whole: 100 }, vstart: 3 };
  } },
  'p-of': { topic: 'percent', name: 'אחוז מתוך כמות', make: (o = {}) => {
    let { p, N } = o;
    if (p == null) { p = pick([5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 80]); const st = 100 / gcd(p, 100); N = st * rnd(1, Math.max(1, Math.floor(400 / st))); if (N < 20) N *= 4; }
    return { text: `חשבו: $${p}%$ מתוך $${N}$`, parts: [num('', '', R2((p * N) / 100))],
      steps: [`$1% = ${N} ÷ 100 = ${fmt(N / 100)}$`, `$${p}% = ${p} × ${fmt(N / 100)} = ${fmt(R2((p * N) / 100))}$`, `או: $${p}/100 × ${N} = ${fmt(R2((p * N) / 100))}$`],
      viz: { t: 'percent', p, whole: N }, vstart: 2 };
  } },
  'p-disc': { topic: 'percent', name: 'הנחה', make: (o = {}) => {
    let { N, p } = o;
    if (N == null) { p = pick([10, 15, 20, 25, 30, 40, 50]); N = pick([80, 120, 150, 180, 200, 240, 300, 360, 400]); if ((N * p) % 100) N = 200; }
    const off = (N * p) / 100;
    return { text: `מחירו המקורי של תיק הוא ${N} ש"ח. לקראת סוף העונה יש הנחה של $${p}%$ על התיק.`,
      parts: [num('א', 'מהו סכום ההנחה?', off, 'ש"ח'), num('ב', 'מהו המחיר אחרי ההנחה?', N - off, 'ש"ח')],
      steps: [`ההנחה: $${p}% × ${N} = ${p}/100 × ${N} = ${off}$ ש"ח`, `המחיר החדש: $${N} − ${off} = ${N - off}$ ש"ח`, `דרך נוספת: משלמים $${100 - p}%$, כלומר $${100 - p}/100 × ${N} = ${N - off}$`],
      viz: { t: 'percent', p, whole: N }, vstart: 1 };
  } },
  'p-what': { topic: 'percent', name: 'כמה אחוזים?', make: (o = {}) => {
    let { k, N } = o;
    if (k == null) { N = pick([10, 20, 25, 40, 50, 200]); const st = N / gcd(N, 100); k = st * rnd(1, Math.floor(N / st) - 1 || 1); }
    const p = (100 * k) / N;
    return { text: `במבחן היו ${N} שאלות. נועה ענתה נכון על ${k} שאלות. כמה אחוזים מהשאלות היא פתרה נכון?`, parts: [num('', '', p, '%')],
      steps: [`החלק מתוך השלם: $${k}/${N}$`, `מרחיבים למכנה 100: $${k}/${N} = ${fmt(p)}/100$`, `כלומר $${fmt(p)}%$ (או: $${k} ÷ ${N} × 100 = ${fmt(p)}$)`],
      viz: { t: 'percent', p, whole: N }, vstart: 0 };
  } },
  'p-whole': { topic: 'percent', deep: true, name: 'מציאת השלם', make: (o = {}) => {
    let { k, p } = o;
    if (k == null) { p = pick([10, 20, 25, 30, 40, 60, 75]); const st = 100 / gcd(p, 100); const W = st * rnd(2, 12); k = (W * p) / 100; }
    const W = (100 * k) / p;
    return { text: `בחוג כדורסל משתתפים ${k} תלמידים, והם $${p}%$ מכל התלמידים בשכבה. כמה תלמידים לומדים בשכבה?`, parts: [num('', '', W, 'תלמידים')],
      steps: [`$${p}% = ${k}$`, `$1% = ${k} ÷ ${p} = ${fmt(k / p)}$`, `$100% = ${fmt(k / p)} × 100 = ${fmt(W)}$`, `בדיקה: $${p}%$ מתוך $${fmt(W)}$ הם $${k}$ ✓`],
      viz: { t: 'percent', p, whole: W }, vstart: 1 };
  } },

  // ---------------- Pythagoras ----------------
  'y-hyp': { topic: 'pyth', name: 'מציאת היתר', make: (o = {}) => {
    let { a, b } = o;
    if (a == null) { const [x, y] = tri(); a = x; b = y; }
    const c = Math.sqrt(a * a + b * b);
    return { text: `במשולש ישר-זווית הניצבים הם ${a} ס"מ ו-${b} ס"מ. מצאו את אורך היתר x.`, parts: [num('', 'x', c, 'ס"מ')],
      steps: [`$${a}² + ${b}² = x²$`, `$${a * a} + ${b * b} = ${c * c}$`, `$x = √${c * c} = ${c}$`],
      viz: { t: 'pyth', a, b, c, find: 'c' }, vstart: 0 };
  } },
  'y-leg': { topic: 'pyth', name: 'מציאת ניצב', make: (o = {}) => {
    let { a, c } = o;
    if (a == null) { const [x, , z] = tri(); a = x; c = z; }
    const b = Math.sqrt(c * c - a * a);
    return { text: `במשולש ישר-זווית ניצב אחד ${a} ס"מ והיתר ${c} ס"מ. מצאו את הניצב השני x.`, parts: [num('', 'x', b, 'ס"מ')],
      steps: [`$${a}² + x² = ${c}²$`, `$x² = ${c * c} − ${a * a} = ${b * b}$`, `$x = √${b * b} = ${b}$`],
      viz: { t: 'pyth', a, b, c, find: 'b' }, vstart: 2 };
  } },
  'y-ladder': { topic: 'pyth', name: 'הסולם', make: (o = {}) => {
    let { c, b } = o;
    if (c == null) { const [x, y, z] = pick([[6, 8, 10], [3, 4, 5], [5, 12, 13], [9, 12, 15]]); c = z; b = Math.random() < 0.5 ? x : y; }
    const a = Math.sqrt(c * c - b * b);
    return { text: `סולם שאורכו ${c} מטרים נשען על קיר אנכי. רגל הסולם רחוקה ${b} מטרים מבסיס הקיר. באיזה גובה נשען הקצה העליון של הסולם?`, parts: [num('', 'הגובה', a, 'מ\'')],
      steps: ['הקיר והרצפה יוצרים זווית ישרה. הסולם הוא היתר (מול הזווית הישרה).', `$x² + ${b}² = ${c}²$`, `$x² = ${c * c} − ${b * b} = ${a * a}$`, `$x = ${a}$ מטרים`],
      viz: { t: 'pyth', a, b, c, find: 'a' }, vstart: 0 };
  } },
  'y-rect': { topic: 'pyth', name: 'אלכסון מלבן', make: (o = {}) => {
    let { L, W } = o;
    if (L == null) { const [x, y] = tri(); L = Math.max(x, y); W = Math.min(x, y); }
    const d = Math.sqrt(L * L + W * W);
    return { text: `אורכו של מלבן ${L} ס"מ ורוחבו ${W} ס"מ.`,
      parts: [num('א', 'אורך האלכסון', d, 'ס"מ'), num('ב', 'היקף המלבן', 2 * (L + W), 'ס"מ'), num('', 'שטח המלבן', L * W, 'סמ"ר')],
      steps: [`האלכסון חוצה את המלבן לשני משולשים ישרי-זווית: $${L}² + ${W}² = x²$`, `$${L * L} + ${W * W} = ${d * d}$, $x = ${d}$`, `היקף: $2 × (${L} + ${W}) = ${2 * (L + W)}$`, `שטח: $${L} × ${W} = ${L * W}$`],
      viz: { t: 'pyth', a: W, b: L, c: d, find: 'c' }, vstart: 1 };
  } },
  'y-iso': { topic: 'pyth', deep: true, name: 'משולש שווה-שוקיים', make: (o = {}) => {
    let { s, base } = o;
    if (s == null) { const [x, y, z] = pick([[5, 12, 13], [3, 4, 5], [6, 8, 10], [8, 15, 17], [9, 12, 15]]); s = z; base = 2 * (Math.random() < 0.5 ? x : y); }
    const h = Math.sqrt(s * s - (base / 2) ** 2);
    return { text: `במשולש שווה-שוקיים כל שוק ${s} ס"מ והבסיס ${base} ס"מ. (הגובה לבסיס הוא גם תיכון: הוא חוצה את הבסיס.)`,
      parts: [num('א', 'הגובה לבסיס', h, 'ס"מ'), num('ב', 'שטח המשולש', (base * h) / 2, 'סמ"ר')],
      steps: [`הגובה חוצה את הבסיס: $${base} ÷ 2 = ${base / 2}$`, `משולש ישר-זווית עם יתר $${s}$ וניצב $${base / 2}$, כלומר $h² = ${s * s} − ${(base / 2) ** 2} = ${h * h}$, $h = ${h}$`, `שטח: $${base} × ${h} ÷ 2 = ${(base * h) / 2}$`],
      viz: { t: 'pyth', a: h, b: base / 2, c: s, find: 'a' }, vstart: 0 };
  } },
  'y-conv': { topic: 'pyth', deep: true, name: 'האם ישר-זווית?', make: (o = {}) => {
    let { a, b, c } = o;
    if (a == null) { [a, b, c] = pick([[7, 24, 25], [8, 15, 17], [5, 12, 13], [6, 8, 10], [9, 12, 15]]); if (Math.random() < 0.5) c += pick([1, -1]); }
    const yes = a * a + b * b === c * c;
    return { text: `אורכי הצלעות של משולש הם ${a} ס"מ, ${b} ס"מ ו-${c} ס"מ. האם המשולש ישר-זווית? (משפט פיתגורס ההפוך)`,
      parts: [{ label: '', q: '', kind: 'choice', options: ['כן, ישר-זווית', 'לא ישר-זווית'], ans: yes ? 'כן, ישר-זווית' : 'לא ישר-זווית' }],
      steps: [`בודקים: האם ריבוע הצלע הארוכה שווה לסכום ריבועי שתי האחרות?`, `$${a}² + ${b}² = ${a * a} + ${b * b} = ${a * a + b * b}$`, `$${c}² = ${c * c}$`, yes ? 'שווים, ולכן המשולש ישר-זווית (הזווית הישרה מול הצלע הארוכה).' : 'לא שווים, ולכן המשולש אינו ישר-זווית.'],
      viz: { t: 'pyth', a, b, c, find: 'none' }, vstart: 2 };
  } },

  // ---------------- corresponding angles ----------------
  'a-basic': { topic: 'angles', name: 'מתאימה וצמודה', make: (o = {}) => {
    let { A } = o;
    if (A == null) A = pick([35, 40, 55, 62, 70, 75, 110, 125, 130]);
    return { text: `שני ישרים מקבילים נחתכים על-ידי ישר שלישי. אחת הזוויות היא $${A}°$.`,
      parts: [num('א', 'מה גודל הזווית המתאימה לה?', A, '°'), num('ב', 'מה גודל הזווית הצמודה לה?', 180 - A, '°')],
      steps: ['זוויות מתאימות בין ישרים מקבילים שוות.', `מתאימה: $${A}°$`, `זוויות צמודות משלימות ל-$180°$, כלומר $180 − ${A} = ${180 - A}°$`],
      viz: { t: 'angles', a: A }, vstart: 0 };
  } },
  'a-corr': { topic: 'angles', name: 'מתאימות: ביטוי = מספר', make: (o = {}) => {
    let { m, n, A } = o;
    if (m == null) { for (;;) { m = rnd(2, 5); const x = rnd(5, 30); n = pick([5, 10, 15, 20, -10, -5, 25]); A = m * x + n; if (A > 20 && A < 160) break; } }
    const x = (A - n) / m;
    return { text: `זוג זוויות מתאימות בין ישרים מקבילים: הראשונה שווה ל-$(${ex(m, n)})°$ והמתאימה לה שווה ל-$${A}°$.`,
      parts: [num('א', 'מצאו את x', x), num('ב', 'מה גודל הזווית הצמודה לזוויות אלו?', 180 - A, '°')],
      steps: [`מתאימות → שוות: $${ex(m, n)} = ${A}$`, `$${m}x = ${A} ${n >= 0 ? '−' : '+'} ${Math.abs(n)} = ${A - n}$`, `$x = ${A - n} ÷ ${m} = ${x}$`, `צמודה: $180 − ${A} = ${180 - A}°$ (צמודות משלימות ל-180)`],
      viz: { t: 'angles', a: A, eqLines: [`${ex(m, n)} = ${A}`, `${m}x = ${A - n}`, `x = ${x}`] }, vstart: 3 };
  } },
  'a-corr2': { topic: 'angles', name: 'מתאימות: ביטוי = ביטוי', make: (o = {}) => {
    let { m1, n1, m2, n2 } = o;
    if (m1 == null) { for (;;) { m2 = rnd(1, 3); m1 = m2 + rnd(1, 3); const x = rnd(5, 30); n1 = pick([-20, -10, -5, 0, 5, 10]); const A = m1 * x + n1; n2 = A - m2 * x; if (A > 20 && A < 160 && n2 !== 0) break; } }
    const x = (n2 - n1) / (m1 - m2), A = m1 * x + n1;
    return { text: `שתי זוויות מתאימות בין ישרים מקבילים: האחת $(${ex(m1, n1)})°$ והשנייה $(${ex(m2, n2)})°$.`,
      parts: [num('א', 'מצאו את x', x), num('ב', 'מה גודל כל אחת מהזוויות?', A, '°')],
      steps: [`מתאימות → שוות: $${ex(m1, n1)} = ${ex(m2, n2)}$`, `מעבירים אגפים: $${m1}x − ${m2}x = ${n2} − (${n1})$`, `$${m1 - m2}x = ${n2 - n1}$, $x = ${x}$`, `מציבים: $${m1} × ${x} ${n1 >= 0 ? '+' : '−'} ${Math.abs(n1)} = ${A}°$`],
      viz: { t: 'angles', a: A, eqLines: [`${ex(m1, n1)} = ${ex(m2, n2)}`, `${m1 - m2}x = ${n2 - n1}`, `x = ${x}`] }, vstart: 0 };
  } },
  'a-three': { topic: 'angles', deep: true, name: 'מתאימות ואז צמודה', make: (o = {}) => {
    let { m1, n1, m2, n2, p, q } = o;
    if (m1 == null) {
      for (;;) {
        m2 = rnd(1, 3); m1 = m2 + rnd(1, 3); const x = rnd(5, 25); n1 = pick([-20, -10, 0, 10]); const A = m1 * x + n1; n2 = A - m2 * x;
        p = pick([2, 3, 4]); const B = 180 - A; q = pick([10, 20, -10, 5]);
        if (A > 20 && A < 160 && (B - q) % p === 0 && (B - q) / p > 0) break;
      }
    }
    const x = (n2 - n1) / (m1 - m2), A = m1 * x + n1, B = 180 - A, y = (B - q) / p;
    return { text: `ישר חותך שני ישרים מקבילים. זווית אחת $(${ex(m1, n1)})°$, והמתאימה לה $(${ex(m2, n2)})°$. זווית שלישית, הצמודה לזווית המתאימה, שווה ל-$(${ex(p, q, 'y')})°$.`,
      parts: [num('א', 'x', x), num('', 'גודל הזוויות המתאימות', A, '°'), num('ב', 'y', y)],
      steps: [`מתאימות שוות: $${ex(m1, n1)} = ${ex(m2, n2)}$ → $${m1 - m2}x = ${n2 - n1}$ → $x = ${x}$`, `הזוויות: $${A}°$`, `צמודות משלימות ל-180: $${ex(p, q, 'y')} + ${A} = 180$`, `$${p}y = ${180 - A} ${q >= 0 ? '−' : '+'} ${Math.abs(q)} = ${B - q}$ → $y = ${y}$`],
      viz: { t: 'angles', a: A }, vstart: 2 };
  } },
  'a-adjcorr': { topic: 'angles', deep: true, name: 'צמודה למתאימה', make: (o = {}) => {
    let { m1, n1, m2, n2 } = o;
    if (m1 == null) { for (;;) { m1 = rnd(1, 3); m2 = rnd(2, 4); n1 = pick([5, 10, 15, 20]); n2 = pick([15, 25, 35, 45]); const x = (180 - n1 - n2) / (m1 + m2); const A = m1 * x + n1; if (Number.isInteger(x) && x > 0 && A < 90) break; } }
    const x = (180 - n1 - n2) / (m1 + m2), A = m1 * x + n1;
    return { text: `ישר חותך שני ישרים מקבילים a ו-b. זווית חדה על ישר a שווה ל-$(${ex(m1, n1)})°$, והזווית הצמודה לזווית המתאימה לה על ישר b שווה ל-$(${ex(m2, n2)})°$. מצאו את x ואת גודל הזוויות.`,
      parts: [num('', 'x', x), num('', 'הזווית החדה', A, '°'), num('', 'הזווית הקהה', 180 - A, '°')],
      steps: [`המתאימה על b שווה לזווית על a: $${ex(m1, n1)}$. היא והצמודה לה משלימות ל-180:`, `$${ex(m1, n1)} + ${ex(m2, n2)} = 180$`, `$${m1 + m2}x + ${n1 + n2} = 180$ → $${m1 + m2}x = ${180 - n1 - n2}$ → $x = ${x}$`, `החדה: $${A}°$, הקהה: $180 − ${A} = ${180 - A}°$. בצומת יש 4 זוויות של $${A}°$ ו-4 של $${180 - A}°$.`],
      viz: { t: 'angles', a: A }, vstart: 1 };
  } },
};

function tri() {
  const [a, b, c] = pick([[3, 4, 5], [6, 8, 10], [5, 12, 13], [9, 12, 15], [8, 15, 17], [12, 16, 20], [7, 24, 25], [15, 20, 25]]);
  return Math.random() < 0.5 ? [a, b, c] : [b, a, c];
}

// A fresh (or fixed) question for a skill, with its key and topic.
export function make(skill, args) {
  const g = GEN[skill];
  const q = g.make(args ? { ...args } : {});
  return { skill, key: `m8:${skill}`, topic: g.topic, deep: !!g.deep, ...q };
}
export const skillsOf = (topic, deep = true) => Object.keys(GEN).filter((k) => (topic === 'mix' || GEN[k].topic === topic) && (deep || !GEN[k].deep));
export { shuffle };
