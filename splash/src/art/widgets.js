import { PALETTE } from '../engine/palette.js';
import { drawText, SIZE } from '../engine/text.js';

/** מלבן פיקסלי — כל הציור במשחק עובר דרך כאן, תמיד על גבול פיקסל שלם. */
export function px(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

/** מסגרת בעובי פיקסל אחד עם מילוי. rounded = מורידים את 4 פיקסלי הפינה. */
export function drawFrame(ctx, x, y, w, h, fill, edge, rounded) {
  if (!rounded) {
    px(ctx, x, y, w, h, edge);
    px(ctx, x + 1, y + 1, w - 2, h - 2, fill);
    return;
  }
  px(ctx, x + 1, y, w - 2, h, edge);
  px(ctx, x, y + 1, w, h - 2, edge);
  px(ctx, x + 2, y + 1, w - 4, h - 2, fill);
  px(ctx, x + 1, y + 2, w - 2, h - 4, fill);
}

/** מסגרת חלולה — 4 קווים בעובי פיקסל. */
export function drawOutline(ctx, x, y, w, h, edge) {
  px(ctx, x, y, w, 1, edge);
  px(ctx, x, y + h - 1, w, 1, edge);
  px(ctx, x, y, 1, h, edge);
  px(ctx, x + w - 1, y, 1, h, edge);
}

/** כרטיס/פאנל — רקע כחול עם מסגרת בהירה. */
export function drawPanel(ctx, x, y, w, h) {
  drawFrame(ctx, x, y, w, h, PALETTE.panel, PALETTE.line, true);
}

/**
 * כפתור. אין DOM — זה מלבן עם hit-test.
 * primary = קורל, secondary = כחול. שניהם אטומים: מעל סצנה בהירה ועמוסה
 * כפתור שקוף פשוט לא קריא.
 * @param {{x:number,y:number,w:number,h:number}} rect
 * @param {{label:string,variant?:'primary'|'secondary',pressed?:boolean,size?:number}} opt
 */
export function drawButton(ctx, rect, opt) {
  const { x, y, w, h } = rect;
  const secondary = opt.variant === 'secondary';
  const size = opt.size ?? SIZE.button;
  const fill = secondary
    ? (opt.pressed ? PALETTE.panelDk : PALETTE.panel)
    : (opt.pressed ? PALETTE.coral2 : PALETTE.coral);
  const edge = secondary ? PALETTE.line : PALETTE.coral2;

  // צל מתחת לכפתור — מנתק אותו מהרקע הצבעוני
  px(ctx, x + 1, y + h, w - 2, 2, PALETTE.ink);
  drawFrame(ctx, x, y, w, h, fill, edge, true);
  if (!opt.pressed) {
    px(ctx, x + 3, y + 2, w - 6, 1, secondary ? PALETTE.line : PALETTE.sun);
  }
  drawText(ctx, opt.label, x + w / 2, y + h / 2, {
    size,
    color: PALETTE.cream,
    outline: PALETTE.ink,
    align: 'center',
  });
}

/** בדיקת פגיעה במלבן. */
export function hit(rect, x, y) {
  return !!rect && x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}
