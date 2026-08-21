import { PALETTE } from '../engine/palette.js';
import { px } from './widgets.js';

/**
 * סצנת פארק מים בשקיעה — מצוירת בקוד, לא תמונה.
 *
 * הקומפוזיציה: שמיים תכולים למעלה, שקיעה חמה באמצע, נהר שזורם לעבר הצופה
 * ומתרחב, מתקנים משני צדדיו, וצמחייה ירוקה שממלאת את התחתית.
 * אין שכבות כהות — הקריאוּת של הטקסט מגיעה ממתאר סביב האותיות.
 */

const HORIZON = 166;
const GROUND = 196;   // הקו שעליו עומדים המתקנים
const RIVER_X = 90;

/** מטריצת Bayer 4×4 — פיזור מסודר, זה מה שנותן מעבר גוון בלי צבעי ביניים. */
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

/** רעש דטרמיניסטי — אותה סצנה בכל טעינה, אבל בלי סדר מכני. */
function rnd(i) {
  const x = Math.sin(i * 127.1 + 3.7) * 43758.5453;
  return x - Math.floor(x);
}

/** מעבר מנוקד מלא בין שני גוונים לאורך גובה הפס. */
function dither(ctx, y, h, top, bottom, w) {
  for (let j = 0; j < h; j++) {
    const t = j / (h - 1 || 1);
    for (let i = 0; i < w; i++) {
      px(ctx, i, y + j, 1, 1, t > (BAYER[j & 3][i & 3] + 0.5) / 16 ? bottom : top);
    }
  }
}

/** חצי-רוחב הנהר בגובה נתון — מתרחב ככל שמתקרב לצופה. */
function riverHalf(y) {
  return 11 + Math.max(0, y - HORIZON) / (390 - HORIZON) * 26;
}

/** אליפסה מלאה עם הדגשה בחלק העליון — הבסיס לכל הצמחייה. */
function blob(ctx, cx, cy, rx, ry, dark, mid, light) {
  for (let y = -ry; y <= ry; y++) {
    for (let x = -rx; x <= rx; x++) {
      const d = (x * x) / (rx * rx) + (y * y) / (ry * ry);
      if (d > 1) continue;
      let c = mid;
      if (d > 0.66) c = dark;
      else if (y < -ry * 0.25 && x < rx * 0.35) c = light;
      px(ctx, cx + x, cy + y, 1, 1, c);
    }
  }
}

/** ענן — שלוש אליפסות שטוחות שנדבקות. */
function cloud(ctx, cx, cy, scale, color, light) {
  blob(ctx, cx, cy, 11 * scale, 3 * scale, color, color, light);
  blob(ctx, cx - 7 * scale, cy + 1, 7 * scale, 2 * scale, color, color, light);
  blob(ctx, cx + 8 * scale, cy + 1, 6 * scale, 2 * scale, color, color, light);
}

/** שמש — ליבה בהירה, טבעת מנוקדת, וקרניים אופקיות. */
function sun(ctx, cx, cy) {
  for (let r = 20; r >= 0; r--) {
    const c = r > 15 ? PALETTE.sunRing : r > 9 ? PALETTE.sun : PALETTE.sunCore;
    for (let y = -r; y <= r; y++) {
      if (r > 15 && (y + r) % 2 === 1) continue;
      const dx = Math.floor(Math.sqrt(r * r - y * y));
      px(ctx, cx - dx, cy + y, dx * 2 + 1, 1, c);
    }
  }
  for (const ray of [[-9, 34], [-3, 42], [4, 38], [11, 28]]) {
    for (let i = 0; i < ray[1]; i += 3) {
      px(ctx, cx - 26 - i, cy + ray[0], 2, 1, PALETTE.sunRing);
      px(ctx, cx + 25 + i, cy + ray[0], 2, 1, PALETTE.sunRing);
    }
  }
}

/** רכס הרים סגלגל. */
function ridge(ctx, w, baseY, height, color, seed) {
  for (let x = 0; x < w; x++) {
    const h = height * (0.55 + 0.45 * Math.abs(Math.sin(x * 0.055 + seed) * Math.cos(x * 0.021 + seed)));
    px(ctx, x, baseY - h, 1, h + 1, color);
  }
}

/** קו רקיע של עיר רחוקה. */
function skyline(ctx, baseY) {
  const towers = [[4, 13], [11, 8], [17, 17], [24, 10], [140, 11], [148, 16], [156, 9], [163, 14], [171, 8]];
  for (const t of towers) {
    px(ctx, t[0], baseY - t[1], 6, t[1], PALETTE.ridge2);
    for (let y = baseY - t[1] + 2; y < baseY - 1; y += 3) px(ctx, t[0] + 1, y, 1, 1, PALETTE.sun);
  }
}

/** הנהר. */
function river(ctx, h) {
  for (let y = HORIZON; y < h; y++) {
    const hw = Math.round(riverHalf(y));
    const t = (y - HORIZON) / (h - HORIZON);
    const base = t < 0.22 ? PALETTE.waterLt : t < 0.5 ? PALETTE.aqua : PALETTE.water;
    px(ctx, RIVER_X - hw, y, hw * 2, 1, base);
    px(ctx, RIVER_X - hw, y, 1, 1, PALETTE.waterDk);
    px(ctx, RIVER_X + hw - 1, y, 1, 1, PALETTE.waterDk);
  }

  // שובל השמש — רק בחלק הרחוק, ומתפוגג. רחב מדי והוא נראה כמו קופסאות צפות.
  for (let y = HORIZON; y < 214; y += 2) {
    const t = (y - HORIZON) / 48;
    const wref = Math.max(2, Math.round(9 * (1 - t)));
    if (rnd(y) < 0.3) continue;
    px(ctx, RIVER_X - wref / 2, y, wref, 1, rnd(y + 9) > 0.5 ? PALETTE.sunCore : PALETTE.sun);
  }

  // אדוות — מקטעים קצרים במרווחים לא סדירים, מתרחבים לכיוון הצופה
  let y = HORIZON + 10;
  let step = 5;
  while (y < h) {
    const hw = riverHalf(y) - 4;
    const count = 1 + Math.floor(rnd(y) * 3);
    for (let k = 0; k < count; k++) {
      const rx = (rnd(y * 3 + k) - 0.5) * 2 * hw;
      const len = 3 + Math.floor(rnd(y + k * 5) * 4);
      px(ctx, RIVER_X + rx, y, len, 1, PALETTE.waterLt);
    }
    step = 5 + rnd(y) * 5;
    y += step;
  }
}

/** גדות חול משני צדי הנהר. */
function banks(ctx, h) {
  for (let y = HORIZON; y < h; y++) {
    const hw = Math.round(riverHalf(y));
    const wide = 3 + (y - HORIZON) / 40;
    px(ctx, RIVER_X - hw - wide, y, wide, 1, PALETTE.sand);
    px(ctx, RIVER_X + hw, y, wide, 1, PALETTE.sand);
    px(ctx, RIVER_X - hw - wide, y, 1, 1, PALETTE.sand2);
    px(ctx, RIVER_X + hw + wide - 1, y, 1, 1, PALETTE.sand2);
  }
}

/** נקודה על עקומת בזייה ריבועית. */
function quad(p0, p1, p2, t) {
  const u = 1 - t;
  return [
    u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
    u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1],
  ];
}

/**
 * מגלשה: מסלול לאורך עקומה, עם מתאר כהה ועמודי תמיכה.
 * בלי המתאר והעמודים זה נראה כמו זרוע מרחפת ולא כמו מתקן.
 */
function slide(ctx, p0, p1, p2, main, shade, wTop, wBot) {
  const steps = 54;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const p = quad(p0, p1, p2, t);
    const w = wTop + (wBot - wTop) * t;
    px(ctx, p[0] - w / 2 - 1, p[1] - 1, w + 2, 5, PALETTE.ink);
  }
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const p = quad(p0, p1, p2, t);
    const w = wTop + (wBot - wTop) * t;
    px(ctx, p[0] - w / 2, p[1], w, 3, shade);
    px(ctx, p[0] - w / 2 + 1, p[1], w - 2, 2, main);
  }
  for (const t of [0.45, 0.75]) {
    const p = quad(p0, p1, p2, t);
    if (p[1] > GROUND - 6) continue;
    px(ctx, p[0] - 1, p[1] + 3, 3, GROUND - p[1] - 3, PALETTE.ink);
    px(ctx, p[0], p[1] + 3, 1, GROUND - p[1] - 3, PALETTE.stone);
  }
}

/** מגדל מגלשות — גוף רחב עם חלונות, מרפסת וגג. */
function tower(ctx, x, topY, roofColor, roofShade) {
  const w = 16;
  px(ctx, x - 1, topY + 9, w + 2, GROUND - topY - 9, PALETTE.ink);
  px(ctx, x, topY + 10, w, GROUND - topY - 10, PALETTE.cream);
  px(ctx, x, topY + 10, 4, GROUND - topY - 10, PALETTE.stone);
  for (let y = topY + 16; y < GROUND - 6; y += 9) {
    px(ctx, x + 5, y, 6, 4, PALETTE.panel);
    px(ctx, x + 6, y + 1, 4, 2, PALETTE.line);
  }
  // מרפסת
  px(ctx, x - 3, topY + 6, w + 6, 4, PALETTE.ink);
  px(ctx, x - 2, topY + 7, w + 4, 2, PALETTE.stone);
  // גג
  px(ctx, x - 4, topY + 1, w + 8, 5, PALETTE.ink);
  px(ctx, x - 3, topY + 2, w + 6, 3, roofColor);
  px(ctx, x, topY - 2, w, 4, roofShade);
  px(ctx, x + 7, topY - 7, 2, 6, PALETTE.stone);
  px(ctx, x + 9, topY - 7, 5, 3, PALETTE.sun);
}

/** בריכת נחיתה. */
function pool(ctx, cx, cy, rx) {
  blob(ctx, cx, cy, rx + 2, 8, PALETTE.sand2, PALETTE.sand, PALETTE.sand);
  blob(ctx, cx, cy, rx, 6, PALETTE.waterDk, PALETTE.aqua, PALETTE.waterLt);
}

/** מתחם המגלשות השמאלי — חם: קורל, אדום, צהוב. */
function leftPark(ctx) {
  pool(ctx, 32, 190, 24);
  tower(ctx, 24, 96, PALETTE.coral, PALETTE.coral2);
  slide(ctx, [24, 112], [2, 140], [22, 184], PALETTE.coral, PALETTE.coral2, 5, 9);
  slide(ctx, [40, 124], [64, 152], [46, 186], PALETTE.sun, PALETTE.sunRing, 4, 8);
  slide(ctx, [24, 130], [8, 160], [34, 188], PALETTE.red, PALETTE.coral2, 4, 7);
  for (const s of [[4, 190], [56, 188]]) {
    px(ctx, s[0], s[1], 13, 3, PALETTE.coral);
    px(ctx, s[0] + 6, s[1] + 3, 2, 6, PALETTE.sand2);
  }
}

/** מתחם המגלשות הימני — קר: תכלת וכחול. */
function rightPark(ctx) {
  pool(ctx, 148, 190, 24);
  tower(ctx, 140, 102, PALETTE.panel, PALETTE.panelDk);
  slide(ctx, [156, 118], [178, 146], [158, 186], PALETTE.aqua, PALETTE.water, 5, 9);
  slide(ctx, [140, 128], [116, 154], [134, 186], PALETTE.line, PALETTE.panel, 4, 8);
  slide(ctx, [156, 134], [172, 160], [146, 188], PALETTE.waterLt, PALETTE.water, 4, 7);
  for (const s of [[164, 190], [116, 188]]) {
    px(ctx, s[0], s[1], 13, 3, PALETTE.panel);
    px(ctx, s[0] + 6, s[1] + 3, 2, 6, PALETTE.sand2);
  }
}

/**
 * דקל — גזע חום וכתר ירוק.
 * בגודל הזה (כתר של 14–20 פיקסלים) כף-אחר-כף יוצא רעש; כתר מלא עם קצוות
 * בולטים נקרא הרבה יותר טוב.
 */
function palm(ctx, x, base, scale) {
  const hgt = Math.round(24 * scale);
  for (let i = 0; i < hgt; i++) {
    const trunkX = x + Math.round(Math.sin((i / hgt) * 1.2) * 3);
    px(ctx, trunkX - 1, base - i, 4, 1, PALETTE.ink);
    px(ctx, trunkX, base - i, 2, 1, i % 4 === 0 ? PALETTE.sand : PALETTE.sand2);
  }
  const tx = x + 3;
  const ty = base - hgt;
  const rx = Math.round(9 * scale);
  const ry = Math.round(5 * scale);

  // קצוות הכפות — יוצאים מהכתר כלפי מטה
  const tips = [];
  for (const dir of [-1, 1]) {
    tips.push([tx + dir * (rx - 1), ty + 1], [tx + dir * (rx - 4), ty + ry], [tx + dir * (rx + 2), ty - 1]);
  }
  for (const t of tips) px(ctx, t[0] - 1, t[1] - 1, 5, 4, PALETTE.ink);

  blob(ctx, tx, ty, rx + 1, ry + 1, PALETTE.ink, PALETTE.ink, PALETTE.ink);
  blob(ctx, tx, ty, rx, ry, PALETTE.leafDk, PALETTE.leaf, PALETTE.leafLt);
  for (const t of tips) px(ctx, t[0], t[1], 3, 2, PALETTE.leaf);

  px(ctx, tx - 4, ty - ry + 1, 4, 2, PALETTE.leafLt);
  px(ctx, tx - 2, ty + ry - 1, 2, 2, PALETTE.sunRing); // אשכול קוקוסים
}

/** שורת שיחים — גדלים, מיקומים וגוונים משתנים, אחרת זה נראה כמו רשת. */
function bushRow(ctx, y, baseR, spacing, w, seed, shades) {
  for (let i = -1; i * spacing < w + spacing * 2; i++) {
    const s = seed + i * 13;
    const x = i * spacing + (rnd(s) - 0.5) * spacing * 0.9;
    const rx = Math.round(baseR * (0.7 + rnd(s + 1) * 0.75));
    const ry = Math.round(rx * (0.55 + rnd(s + 2) * 0.3));
    const yy = y + Math.round((rnd(s + 3) - 0.5) * baseR * 0.8);
    if (Math.abs(x - RIVER_X) < riverHalf(yy) + rx * 0.72 + 3) continue;
    blob(ctx, x, yy, rx, ry, shades[0], shades[1], shades[2]);
    if (rnd(s + 4) > 0.55) px(ctx, x - rx / 3, yy - ry + 1, 3, 2, PALETTE.leafLt);
  }
}

/** צמחייה — שכבות שמתעבות ומתקרבות לצופה. */
function foliage(ctx, w) {
  const far = [PALETTE.leafDp, PALETTE.leafDk, PALETTE.leaf];
  const near = [PALETTE.leafDp, PALETTE.leafDk, PALETTE.leafLt];
  bushRow(ctx, 200, 8, 11, w, 5, far);
  bushRow(ctx, 216, 10, 13, w, 41, far);
  bushRow(ctx, 240, 13, 16, w, 77, far);
  bushRow(ctx, 272, 16, 19, w, 113, near);
  bushRow(ctx, 308, 19, 23, w, 149, near);
  bushRow(ctx, 348, 23, 27, w, 191, near);
  bushRow(ctx, 388, 27, 31, w, 233, near);
  // הדקלים אחרונים — אחרת שורות השיחים קוברות אותם והגזעים נראים כמו מקלות
  palm(ctx, 150, 236, 0.9);
  palm(ctx, 24, 244, 0.95);
  palm(ctx, 6, 322, 1.3);
  palm(ctx, 166, 312, 1.2);
}

/** דמויות זעירות על הגדות. */
function people(ctx) {
  const spots = [
    [64, 196, PALETTE.cream], [112, 200, PALETTE.coral], [72, 212, PALETTE.sun],
    [108, 218, PALETTE.waterLt], [86, 184, PALETTE.sun], [96, 178, PALETTE.cream],
  ];
  for (const s of spots) {
    px(ctx, s[0] - 1, s[1] - 5, 4, 6, PALETTE.ink);
    px(ctx, s[0], s[1] - 4, 2, 1, PALETTE.sand);
    px(ctx, s[0], s[1] - 3, 2, 3, s[2]);
  }
}

/**
 * מצייר את הסצנה המלאה.
 * @param {CanvasRenderingContext2D} ctx
 */
export function drawParkScene(ctx, w, h) {
  dither(ctx, 0, 58, PALETTE.skyTop, PALETTE.skyMid, w);
  dither(ctx, 58, 44, PALETTE.skyMid, PALETTE.cloud2, w);
  dither(ctx, 102, 34, PALETTE.cloud2, PALETTE.skyLow, w);
  dither(ctx, 136, 30, PALETTE.skyLow, PALETTE.sunRing, w);

  cloud(ctx, 42, 70, 1.1, PALETTE.cloud, PALETTE.cloud2);
  cloud(ctx, 138, 58, 0.9, PALETTE.cloud, PALETTE.cloud2);
  cloud(ctx, 96, 96, 1.3, PALETTE.cloud2, PALETTE.skyLow);
  cloud(ctx, 20, 112, 0.8, PALETTE.cloud2, PALETTE.skyLow);

  sun(ctx, RIVER_X, 148);

  ridge(ctx, w, HORIZON + 2, 26, PALETTE.ridge, 0.8);
  ridge(ctx, w, HORIZON + 3, 17, PALETTE.ridge2, 2.4);
  skyline(ctx, HORIZON + 3);

  px(ctx, 0, HORIZON, w, h - HORIZON, PALETTE.leafDk);
  banks(ctx, h);
  river(ctx, h);

  leftPark(ctx);
  rightPark(ctx);
  people(ctx);
  foliage(ctx, w);
}
