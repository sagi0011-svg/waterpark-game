import { PALETTE, SHADE } from '../engine/palette.js';
import { drawText, wrapText, SIZE } from '../engine/text.js';
import { px, drawFrame, drawButton, hit } from '../art/widgets.js';
import { VW, VH } from '../engine/renderer.js';

const PAD = 14;
const BODY_TOP = 48;    // מרחק מראש הפאנל לשורת הטקסט הראשונה
const LINE = 13;        // גובה שורה
const OK_H = 25;        // גובה כפתור הסגירה
const OPEN_TIME = 0.22;
const CLOSE_TIME = 0.16;

const TEXT = 'אתה מנהל פארק מים בישראל. כל תור הוא חודש אחד. המטרה: לשרוד עונה בלי לפשוט רגל, ובלי שיקרעו אותך בגוגל.';

/** חלון תחתון (bottom sheet) שמצויר על הקנבס — לא DOM. עולה מלמטה, נסגר בכפתור או בלחיצה מחוץ למלבן. */
export class HelpSheet {
  constructor() {
    this.state = 'closed';      // closed | opening | open | closing
    this.progress = 0;          // 0 = מתחת למסך, 1 = פתוח
    this.pressed = null;
    // שוברים לשורות פעם אחת (הפונט כבר טעון בשלב הזה) וגוזרים מזה את גובה הפאנל,
    // כדי שלא יישאר חלל מת בין הטקסט לכפתור.
    const probe = document.createElement('canvas').getContext('2d');
    this.lines = wrapText(probe, TEXT, VW - PAD * 2, SIZE.small);
    this.height = BODY_TOP + this.lines.length * LINE + PAD + OK_H + PAD;
  }

  get visible() { return this.state !== 'closed'; }

  open() {
    if (this.state === 'open' || this.state === 'opening') return;
    this.state = 'opening';
  }

  close() {
    if (!this.visible || this.state === 'closing') return;
    this.state = 'closing';
    this.pressed = null;
  }

  /** @returns {boolean} האם צריך לצייר מחדש */
  update(dt) {
    if (this.state === 'opening') {
      this.progress = Math.min(1, this.progress + dt / OPEN_TIME);
      if (this.progress === 1) this.state = 'open';
      return true;
    }
    if (this.state === 'closing') {
      this.progress = Math.max(0, this.progress - dt / CLOSE_TIME);
      if (this.progress === 0) this.state = 'closed';
      return true;
    }
    return false;
  }

  /** ease-out — נכנס מהר ומתמתן */
  get eased() { const p = this.progress; return 1 - (1 - p) * (1 - p); }

  get top() { return Math.round(VH - this.height * this.eased); }

  get okRect() { return { x: PAD, y: this.top + this.height - PAD - OK_H, w: VW - PAD * 2, h: OK_H }; }

  draw(ctx) {
    if (!this.visible) return;
    const top = this.top;

    // רקע מעומעם מאחורי החלון
    ctx.globalAlpha = this.eased;
    px(ctx, 0, 0, VW, VH, SHADE.scrim);
    ctx.globalAlpha = 1;

    drawFrame(ctx, 0, top, VW, this.height + 4, PALETTE.panel, PALETTE.line, true);

    // ידית גרירה
    px(ctx, VW / 2 - 10, top + 6, 20, 2, PALETTE.line);

    drawText(ctx, 'מה זה ספלאש?', VW / 2, top + 22, {
      size: SIZE.button, color: PALETTE.sun, outline: PALETTE.ink,
    });
    px(ctx, PAD, top + 33, VW - PAD * 2, 1, PALETTE.line);

    this.lines.forEach((line, i) => {
      drawText(ctx, line, VW / 2, top + BODY_TOP + i * LINE, {
        size: SIZE.small, color: PALETTE.cream,
      });
    });

    drawButton(ctx, this.okRect, {
      label: 'הבנתי, יאללה', variant: 'primary', pressed: this.pressed === 'ok',
    });
  }

  /** @returns {{redraw:boolean, closed:boolean}} */
  onPointer(x, y, phase) {
    if (this.state !== 'open') return { redraw: false, closed: false };

    if (phase === 'escape') { this.close(); return { redraw: true, closed: true }; }
    if (phase === 'cancel') {
      const had = this.pressed !== null;
      this.pressed = null;
      return { redraw: had, closed: false };
    }

    const onOk = hit(this.okRect, x, y);
    const outside = y < this.top;

    if (phase === 'down') {
      this.pressed = onOk ? 'ok' : null;
      return { redraw: onOk, closed: false };
    }
    if (phase === 'move') {
      const next = onOk && this.pressed !== null ? 'ok' : null;
      const changed = next !== this.pressed;
      if (this.pressed !== null) this.pressed = next;
      return { redraw: changed, closed: false };
    }
    // up
    const wasPressed = this.pressed === 'ok';
    this.pressed = null;
    if (wasPressed && onOk) { this.close(); return { redraw: true, closed: true }; }
    if (outside) { this.close(); return { redraw: true, closed: true }; }
    return { redraw: true, closed: false };
  }
}
