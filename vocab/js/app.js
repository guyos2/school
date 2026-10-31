// Hash router.
//   #/                     home: the kids opened on this device, or the landing page
//   #/signup, #/login      parent account
//   #/parent               parent: kids, adding a kid, family link
//   #/parent/kid/<id>      parent: one kid (link, test preparation, progress, details)
//   #/k/<token>            kid: home ("today's mission")
//   #/k/<token>/free|test  kid: practice (free learning, or only the words of the coming test)
//   #/k/<token>/words      kid: my words
//   #/f/<token>            family link: pick a kid on a shared device
import { esc, newView } from './ui.js';
import { parentSession, rememberedKids, rememberKid, familyKids } from './api.js';
import { renderAuth, renderParentHome, renderParentKid } from './parent.js';
import { renderKidHome, renderKidPractice, renderKidWords } from './kid.js';

const app = document.getElementById('app');

function renderLanding(root) {
  const kids = rememberedKids();
  const parent = parentSession();
  root.innerHTML = `
    ${kids.length ? `
      <h1 class="page-title">מי מתרגל?</h1>
      <div class="kids">${kids.map((k) => `
        <a class="kid" href="#/k/${k.token}"><span class="kid-emoji">${esc(k.emoji)}</span><span class="kid-name">${esc(k.name)}</span></a>`).join('')}</div>
` : `
      <section class="hero">
        <div class="big-emoji">📚</div>
        <h1>אוצר מילים וזמנים באנגלית, לפי מה שלומדים בכיתה</h1>
        <p>לכיתות ד׳–ז׳. מספרים לנו באיזו כיתה הילדים ומה יש במבחן הקרוב,
        והאפליקציה בונה כל יום משימה קצרה: חוזרים על מה שקשה, מתקדמים כשמוכנים.</p>
        <div class="row-center">
          ${parent ? '<a class="btn btn-big" href="#/parent">לאזור ההורים</a>' : `
            <a class="btn btn-big" href="#/signup">הרשמה להורים</a>
            <a class="btn btn-soft" href="#/login">כניסה</a>`}
        </div>
      </section>
      <div class="features">
        <div class="feature"><b>🎯 הכנה למבחן</b><span>רשימת המילים של המבחן, מחולקת לימים עד התאריך, ומדד מוכנות.</span></div>
        <div class="feature"><b>🧠 חזרה מרווחת</b><span>מילה שקשה חוזרת מהר. מילה שיודעים היטב לא חוזרת שוב ושוב.</span></div>
        <div class="feature"><b>📈 מתקדמים לפי הילד</b><span>כשהמילים של הכיתה כבר ידועות, ממשיכים למילים של השלב הבא.</span></div>
      </div>`}`;
}

async function renderFamily(root, token) {
  root.innerHTML = '<p class="center muted">טוען…</p>';
  try {
    const { kids } = await familyKids(token);
    for (const k of kids) rememberKid(k.linkToken, k);
    location.replace('#/');
  } catch {
    root.innerHTML = '<div class="panel center"><h1>הלינק המשפחתי לא עובד</h1><p>אולי ההורה החליף אותו. בקשו לינק חדש.</p></div>';
  }
}

function route() {
  newView();
  window.scrollTo(0, 0);
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const [a, b, c, d] = parts;
  document.body.dataset.area = a === 'k' ? 'kid' : 'parent';
  // Kids never get a way into the parents' area: their logo leads back to their own home screen.
  document.querySelector('.home-link').href = a === 'k' && b ? `#/k/${b}` : parentSession() ? '#/parent' : '#/';
  const fail = (e) => { console.error(e); app.innerHTML = '<p class="center">משהו השתבש. נסו לרענן את הדף.</p>'; };
  try {
    if (!a) {
      // A device that only one kid uses opens straight to that kid.
      const kids = rememberedKids();
      if (kids.length === 1 && !parentSession()) { location.replace(`#/k/${kids[0].token}`); return; }
      return renderLanding(app);
    }
    if (a === 'signup' || a === 'login') return renderAuth(app, a);
    if (a === 'parent' && !b) return renderParentHome(app).catch(fail);
    if (a === 'parent' && b === 'kid' && c) return renderParentKid(app, c).catch(fail);
    if (a === 'f' && b) return renderFamily(app, b);
    if (a === 'k' && b && !c) return renderKidHome(app, b).catch(fail);
    if (a === 'k' && b && (c === 'free' || c === 'test')) return renderKidPractice(app, b, c).catch(fail);
    if (a === 'k' && b && c === 'words' && !d) return renderKidWords(app, b).catch(fail);
  } catch (e) { return fail(e); }
  location.replace('#/');
}

window.addEventListener('hashchange', route);
route();
