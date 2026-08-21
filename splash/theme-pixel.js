/* =========================================================================
   ספלאש — מתג ערכת הנושא "פיקסל"
   =========================================================================
   אחראי על שלושה דברים בלבד:
     1. להחליט אם ערכת הנושא דלוקה (פרמטר URL → localStorage → ברירת מחדל)
     2. להציב את התכונה data-theme="pixel" על תגית ה-html
     3. להזריק את סצנת הפארק כרקע, ולוודא שהיא שורדת רינדור מחדש של המשחק

   הקובץ לא נוגע בלוגיקת המשחק ולא בשום אלמנט ממשק.
   כל כשל כאן נבלע בשקט — המשחק חייב לעלות גם אם ערכת הנושא נשברת.

   שליטה:
     ?theme=pixel     הדלקה (נשמר)
     ?theme=classic   כיבוי (נשמר)
     splashTheme('pixel' | 'classic')   מהקונסולה
   ========================================================================= */

const KEY = 'splash:theme';
const DEFAULT = 'pixel'; // שנה ל-'classic' כדי שהמשחק יעלה במראה המקורי
const root = document.documentElement;

function resolve() {
  try {
    const q = new URLSearchParams(location.search).get('theme');
    if (q === 'pixel' || q === 'classic') {
      localStorage.setItem(KEY, q);
      return q;
    }
    return localStorage.getItem(KEY) || DEFAULT;
  } catch {
    return DEFAULT;
  }
}

function apply(mode) {
  if (mode === 'pixel') root.setAttribute('data-theme', 'pixel');
  else root.removeAttribute('data-theme');
}

/** מצייר את סצנת הפארק פעם אחת ומחזיר data URI. */
async function buildSceneUrl() {
  const { drawParkScene } = await import('./src/art/parkScene.js');
  const c = document.createElement('canvas');
  c.width = 180;
  c.height = 390;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  drawParkScene(ctx, 180, 390);
  return c.toDataURL('image/png');
}

/**
 * המשחק מרנדר מחדש לתוך #app ומוחק את תוכנו.
 * הרקע יושב *מחוץ* ל-#app כדי לא להימחק, ו-observer מחזיר אותו אם בכל זאת ירד.
 */
function mountBackground(url) {
  const put = () => {
    if (document.getElementById('pixel-bg')) return;
    const app = document.getElementById('app');
    if (!app || !app.parentNode) return;
    const img = document.createElement('img');
    img.id = 'pixel-bg';
    img.src = url;
    img.alt = '';
    img.setAttribute('aria-hidden', 'true');
    app.parentNode.insertBefore(img, app);
  };
  put();
  new MutationObserver(put).observe(document.body, { childList: true });
}

/**
 * בונה ומרכיב את הרקע, פעם אחת בלבד.
 * נקרא גם בעלייה וגם בכל מעבר לרטרו — שחקן שהתחיל במצב חדשני והחליף
 * לרטרו חייב לקבל את הסצנה, ובעלייה היא לא נבנתה.
 */
let scenePromise = null;
function ensureBackground() {
  if (!scenePromise) {
    scenePromise = buildSceneUrl()
      .then(mountBackground)
      .catch(() => { scenePromise = null; /* בלי רקע — שאר הסגנון עובד */ });
  }
  return scenePromise;
}

let current = 'pixel';

/** המצב הנוכחי — לשימוש הבוחר במסך הפתיחה ובתפריט. */
window.splashThemeGet = () => current;

/** החלפה חיה, בלי טעינה מחדש. */
window.splashTheme = function splashTheme(mode) {
  const next = mode === 'classic' ? 'classic' : 'pixel';
  current = next;
  try { localStorage.setItem(KEY, next); } catch { /* מצב פרטי */ }
  apply(next);
  if (next === 'pixel') ensureBackground();
  return next;
};

try {
  current = resolve();
  apply(current);
  if (current === 'pixel') ensureBackground();

  /* המודול הזה נטען כ-type="module", כלומר הוא רץ *אחרי* הסקריפט של
     המשחק. ברינדור הראשון window.splashTheme עוד לא היה קיים, ולכן
     בוחר העיצוב לא הוצג. רינדור נוסף — עכשיו כשה-API זמין — מציג אותו. */
  if (typeof window.render === 'function') window.render();
} catch { /* המשחק ממשיך כרגיל */ }
