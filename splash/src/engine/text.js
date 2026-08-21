/**
 * ציור טקסט — הנקודה הרגישה של המשחק.
 *
 * אין פונטי פיקסל טובים בעברית, ולכן לא מחפשים אחד: מציירים Heebo רגיל
 * ישירות לקנבס ה-180×390 בגדלים קטנים, וההגדלה השלמה היא זו שהופכת אותו לפיקסלי.
 *
 * כל טקסט במשחק עובר דרך drawText. שום ctx.fillText ישיר בקוד המסכים.
 */

import { PALETTE } from './palette.js';

export const FONT_FAMILY = "Heebo, Arial, sans-serif";

/** הגדלים המותרים, בפיקסלים וירטואליים. מתחת ל-8 לא קריא. */
export const SIZE = { title: 26, button: 12, body: 10, small: 9, tiny: 8 };

/** טוען מראש את כל המשקלים/הגדלים שבשימוש, כדי שהפריים הראשון לא ייצא בפונט ברירת מחדל. */
export async function ensureFonts() {
  if (!document.fonts) return;
  // חייבים להעביר טקסט לדוגמה: Google Fonts מפצל את Heebo לתת-קבוצות לפי unicode-range,
  // ובלי תווים עבריים בבקשה תת-הקבוצה העברית פשוט לא נטענת.
  const sample = 'ספלאשםילוטרנהיפקבגדוזחטךכלמןסעףפץצקרת ?0123456789SagiGHaim';
  const specs = ['900 26px Heebo', '900 12px Heebo', '900 11px Heebo', '700 10px Heebo', '700 9px Heebo', '700 8px Heebo'];
  await Promise.all(specs.map((s) => document.fonts.load(s, sample).catch(() => {})));
  await document.fonts.ready;
}

function fontFor(size, weight) {
  return `${weight || (size >= 12 ? 900 : 700)} ${size}px ${FONT_FAMILY}`;
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text
 * @param {number} x  קואורדינטה וירטואלית
 * @param {number} y  קואורדינטה וירטואלית — מרכז השורה (textBaseline=middle)
 * @param {{size?:number,color?:string,align?:'center'|'left'|'right',dir?:'rtl'|'ltr',
 *          weight?:number,shadow?:string,shadowOffset?:[number,number],
 *          outline?:string,outlineWidth?:number}} [opt]
 *
 * outline: מתאר סביב האותיות. זה מה שמחליף את שכבות הכהות בעיצוב הבהיר —
 * טקסט בהיר עם מתאר כהה נשאר קריא מעל סצנה צבעונית ועמוסה.
 *
 * dir: עברית = 'rtl'. מספרים, ₪ ומחרוזות לטיניות ('Sagi G Haim') חייבים 'ltr'
 * בקריאה נפרדת — אחרת ה-BiDi הופך אותם. זה באג שקורה תמיד.
 */
export function drawText(ctx, text, x, y, opt = {}) {
  const size = opt.size ?? SIZE.body;
  const align = opt.align ?? 'center';
  ctx.save();
  ctx.direction = opt.dir ?? 'rtl';
  ctx.textAlign = align;       // left/right פיזיים, לא start/end — כדי לא להסתבך עם RTL
  ctx.textBaseline = 'middle';
  ctx.font = fontFor(size, opt.weight);
  if (opt.shadow) {
    const [dx, dy] = opt.shadowOffset ?? [1, 1];
    ctx.fillStyle = opt.shadow;
    ctx.fillText(text, Math.round(x) + dx, Math.round(y) + dy);
  }
  if (opt.outline) {
    const o = opt.outlineWidth ?? 1;
    ctx.fillStyle = opt.outline;
    for (let dx = -o; dx <= o; dx++) {
      for (let dy = -o; dy <= o; dy++) {
        if (dx || dy) ctx.fillText(text, Math.round(x) + dx, Math.round(y) + dy);
      }
    }
  }
  ctx.fillStyle = opt.color ?? PALETTE.cream;
  ctx.fillText(text, Math.round(x), Math.round(y));
  ctx.restore();
}

/** רוחב טקסט בפיקסלים וירטואליים — לבדיקות פריסה ולגלישת שורות. */
export function measureText(ctx, text, size, weight) {
  ctx.save();
  ctx.font = fontFor(size, weight);
  const w = ctx.measureText(text).width;
  ctx.restore();
  return w;
}

/** שובר טקסט לשורות שנכנסות ל-maxWidth. שובר על רווחים בלבד. */
export function wrapText(ctx, text, maxWidth, size, weight) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? line + ' ' + word : word;
    if (line && measureText(ctx, next, size, weight) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}
