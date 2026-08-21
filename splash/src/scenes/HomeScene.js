import { PALETTE } from '../engine/palette.js';
import { drawText, measureText, SIZE } from '../engine/text.js';
import { px, drawFrame, drawButton, hit } from '../art/widgets.js';
import { drawParkScene } from '../art/parkScene.js';
import { VW, VH } from '../engine/renderer.js';
import { Scene } from '../engine/scene.js';
import { HelpSheet } from './HelpSheet.js';

const SAVE_KEY = 'splash:save';

/** פריסת מסך הבית, בפיקסלים וירטואליים מתוך 180×390. */
const L = {
  help:      { x: 8,  y: 26,  w: 16, h: 16 },
  helpHit:   { x: 2,  y: 19,  w: 30, h: 30 }, // אזור המגע גדול מהאייקון — 44 CSS px גם ב-S הנמוך
  title:     { y: 62 },
  subtitle:  { y: 85 },
  newGame:   { x: 14, y: 272, w: 152, h: 30 },
  newGameSolo: { x: 14, y: 287, w: 152, h: 30 }, // כשאין משחק שמור — הבלוק מתאזן
  continue:  { x: 14, y: 308, w: 152, h: 25 },
  // הכפתור מצויר בגובה 25 כפי שהוגדר, אבל אזור המגע נמתח למרווח שסביבו:
  // בטלפון קצר (iPhone SE) פיקסל וירטואלי שווה 1.5 CSS px, ו-25 היו יוצאים 37 CSS px בלבד.
  continueHit: { x: 14, y: 304, w: 152, h: 30 },
  // המפרט נתן y=332, אבל כפתור "המשך משחק" מסתיים ב-333 והשורה נחתכה בתוכו.
  // הכפתורים נשארו בדיוק במקומם; רק השורה הזו ירדה למרווח הפנוי שמתחתיהם.
  surprise:  { y: 346 },
  surpriseHit: { x: 30, y: 336, w: 120, h: 30 },
  credit:    { y: 372 },
};

function readSave() {
  try {
    const params = new URLSearchParams(location.search);
    if (params.get('save') === '1') return { name: 'ספלאש בלאגן', month: 7 };
    if (params.get('save') === '0') return null;
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export class HomeScene extends Scene {
  constructor(onAction) {
    super();
    this.onAction = onAction ?? (() => {});
    this.save = readSave();
    this.pressed = null;
    this.sheet = new HelpSheet();
    this.bg = null; // סצנת הרקע נצרבת פעם אחת לקנבס משלה — אין טעם לצייר אותה מחדש כל פריים
  }

  get hasSave() { return !!this.save; }
  get newGameRect() { return this.hasSave ? L.newGame : L.newGameSolo; }
  get continueRect() { return this.hasSave ? L.continue : null; }

  buildBackground() {
    const c = document.createElement('canvas');
    c.width = VW;
    c.height = VH;
    const g = c.getContext('2d', { alpha: false });
    g.imageSmoothingEnabled = false;
    drawParkScene(g, VW, VH);
    this.bg = c;
  }

  /** קובייה זעירה מצוירת בפיקסלים — במקום אימוג'י, שלא ישבור את הסגנון. */
  drawDie(ctx, x, y) {
    px(ctx, x - 1, y - 1, 9, 9, PALETTE.ink);
    px(ctx, x, y, 7, 7, PALETTE.cream);
    px(ctx, x + 1, y + 1, 1, 1, PALETTE.ink);
    px(ctx, x + 3, y + 3, 1, 1, PALETTE.ink);
    px(ctx, x + 5, y + 5, 1, 1, PALETTE.ink);
  }

  draw(ctx) {
    if (!this.bg) this.buildBackground();
    ctx.drawImage(this.bg, 0, 0);

    // ❓
    px(ctx, L.help.x + 1, L.help.y + L.help.h, L.help.w - 2, 2, PALETTE.ink);
    drawFrame(ctx, L.help.x, L.help.y, L.help.w, L.help.h,
      this.pressed === 'help' ? PALETTE.panelDk : PALETTE.panel, PALETTE.line, true);
    drawText(ctx, '?', L.help.x + L.help.w / 2, L.help.y + L.help.h / 2 + 1, {
      size: 11, color: PALETTE.cream, dir: 'ltr', outline: PALETTE.ink,
    });

    // לוגו — מתאר כהה במקום שכבת כהות מעל הסצנה
    drawText(ctx, 'ספלאש', VW / 2, L.title.y, {
      size: SIZE.title, color: PALETTE.cream,
      outline: PALETTE.ink, outlineWidth: 2,
      shadow: PALETTE.coral2, shadowOffset: [2, 3],
    });
    drawText(ctx, 'סימולטור ניהול פארק מים', VW / 2, L.subtitle.y, {
      size: SIZE.tiny, color: PALETTE.cream, outline: PALETTE.ink,
    });

    drawButton(ctx, this.newGameRect, {
      label: 'משחק חדש', variant: 'primary', pressed: this.pressed === 'new',
    });

    if (this.hasSave) {
      drawButton(ctx, this.continueRect, {
        label: 'המשך משחק', variant: 'secondary', pressed: this.pressed === 'continue',
      });
    }

    // 🎲 או תפתיע אותי — הקובייה מצוירת, הטקסט מודפס
    const label = 'או תפתיע אותי';
    const tw = measureText(ctx, label, SIZE.small);
    const total = tw + 3 + 7;
    const right = VW / 2 + total / 2;
    this.drawDie(ctx, right - 7, L.surprise.y - 3);
    drawText(ctx, label, right - 7 - 3 - tw / 2, L.surprise.y, {
      size: SIZE.small,
      color: this.pressed === 'surprise' ? PALETTE.sun : PALETTE.cream,
      outline: PALETTE.ink,
    });

    drawText(ctx, 'Sagi G Haim', VW / 2, L.credit.y, {
      size: SIZE.tiny, color: PALETTE.credit, dir: 'ltr', outline: PALETTE.ink,
    });

    this.sheet.draw(ctx);
  }

  update(dt) {
    return this.sheet.update(dt);
  }

  hitTest(x, y) {
    if (hit(L.helpHit, x, y)) return 'help';
    if (hit(this.newGameRect, x, y)) return 'new';
    if (this.hasSave && hit(L.continueHit, x, y)) return 'continue';
    if (hit(L.surpriseHit, x, y)) return 'surprise';
    return null;
  }

  onPointer(x, y, phase) {
    if (this.sheet.visible) {
      const r = this.sheet.onPointer(x, y, phase);
      return r.redraw;
    }
    if (phase === 'escape') return false;
    if (phase === 'cancel') {
      const had = this.pressed !== null;
      this.pressed = null;
      return had;
    }

    const target = this.hitTest(x, y);

    if (phase === 'down') {
      this.pressed = target;
      return target !== null;
    }
    if (phase === 'move') {
      const next = this.pressed !== null && target === this.pressed ? target : null;
      const changed = next !== this.pressed;
      if (changed) this.pressed = next;
      return changed;
    }

    // up
    const activated = this.pressed !== null && target === this.pressed ? this.pressed : null;
    const had = this.pressed !== null;
    this.pressed = null;
    if (activated === 'help') this.sheet.open();
    else if (activated) this.onAction(activated, this.save);
    return had || activated !== null;
  }
}
