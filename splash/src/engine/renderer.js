import { PALETTE } from './palette.js';

/** רזולוציה וירטואלית קבועה — 9:19.5, טלפון אנכי. כל קואורדינטה בקוד היא בפיקסלים האלה. */
export const VW = 180;
export const VH = 390;

/**
 * קנבס כפול: מציירים ל-offscreen בגודל 180×390,
 * ומעתיקים לתצוגה בהגדלה של מספר שלם בלבד (letterbox סביב).
 *
 * ההגדלה מחושבת בפיקסלי מכשיר (device pixels) ולא ב-CSS pixels:
 * כך על מסך dpr=3 נקבל S=6 במקום S=2, המשחק ממלא הרבה יותר מהמסך,
 * והפיקסלים נשארים חדים לגמרי כי S עדיין שלם.
 */
export function createRenderer(displayCanvas, onResize) {
  const buffer = document.createElement('canvas');
  buffer.width = VW;
  buffer.height = VH;

  const ctx = buffer.getContext('2d', { alpha: false });
  const out = displayCanvas.getContext('2d', { alpha: false });
  ctx.imageSmoothingEnabled = false;
  out.imageSmoothingEnabled = false;

  let scale = 1;   // פיקסלי מכשיר לכל פיקסל וירטואלי
  let offX = 0;    // היסט ה-letterbox, בפיקסלי מכשיר
  let offY = 0;

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = displayCanvas.getBoundingClientRect();
    const dw = Math.max(1, Math.round(rect.width * dpr));
    const dh = Math.max(1, Math.round(rect.height * dpr));

    if (displayCanvas.width !== dw || displayCanvas.height !== dh) {
      displayCanvas.width = dw;
      displayCanvas.height = dh;
      out.imageSmoothingEnabled = false; // מתאפס בכל שינוי גודל של הקנבס
    }

    scale = Math.max(1, Math.floor(Math.min(dw / VW, dh / VH)));
    offX = Math.floor((dw - VW * scale) / 2);
    offY = Math.floor((dh - VH * scale) / 2);
  }

  /** מעתיק את ה-buffer למסך, ממורכז, עם letterbox בצבע הרקע. */
  function present() {
    out.imageSmoothingEnabled = false;
    out.fillStyle = PALETTE.frame;
    out.fillRect(0, 0, displayCanvas.width, displayCanvas.height);
    out.drawImage(buffer, offX, offY, VW * scale, VH * scale);
  }

  /** אירוע מצביע → קואורדינטות וירטואליות. מחזיר null אם הנגיעה נפלה על ה-letterbox. */
  function toVirtual(clientX, clientY) {
    const dpr = window.devicePixelRatio || 1;
    const rect = displayCanvas.getBoundingClientRect();
    const x = ((clientX - rect.left) * dpr - offX) / scale;
    const y = ((clientY - rect.top) * dpr - offY) / scale;
    if (x < 0 || y < 0 || x >= VW || y >= VH) return null;
    return { x, y };
  }

  resize();
  // הקנבס נמדד לפעמים לפני שהפריסה מוכנה (גיליון סגנון חיצוני שעדיין נטען),
  // ואז getBoundingClientRect מחזיר 0. ResizeObserver סוגר את הפינה הזו.
  const observer = new ResizeObserver(() => {
    resize();
    onResize?.();
  });
  observer.observe(displayCanvas);

  return {
    ctx,
    present,
    resize,
    toVirtual,
    get scale() { return scale; },
  };
}
