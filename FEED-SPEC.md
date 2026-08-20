# מפרט מימוש — פיד מרכזי לפארק המים

> מסמך הנחיה ל-Claude Code. נכתב מול `index.html` בגרסה מ-2026-08-20 (150,519 בתים, 2,821 שורות).
> קבצי ההדגמה `feed-demo-v3.html` (בתיקיית הפרויקט) הם **הרפרנס הוויזואלי והתנהגותי המחייב**.
> כשיש ספק לגבי מראה או ניסוח — לפתוח את ההדגמה ולהעתיק משם.

---

## 0. מה הבעיה שאנחנו פותרים

התוכן הפרודי של המשחק קיים ואיכותי, אבל הוא **קבור ונמחק**:

1. כל האירועים מוצגים רק בתוך `renderReportOverlay()` — overlay שנפתח פעם בחודש
2. בלחיצה על "המשך" הקוד מריץ `G.pendingEvents = []` (שורה ~2036) והתוכן נעלם לנצח
3. `renderDashboard()` הוא גיליון מספרים: KPI, קיבולת, מחיר, שני כפתורי ניווט

**המטרה:** להפוך את מרכז המסך הראשי לפיד חי ומתמשך שבו קורים דברים — כך שהפן הפרודי תמיד מול השחקן.

---

## 1. סדר מימוש (5 שלבים עצמאיים)

כל שלב עומד בפני עצמו וניתן לבדיקה לפני המעבר לבא. **לא לקפוץ קדימה.**

| שלב | תוכן | סיכון |
|---|---|---|
| **א** | תשתית: `G.feed`, פונקציות `pushFeed`/`renderFeed`, שמירה וגזימה | נמוך |
| **ב** | דשבורד חדש: KPI מתכווץ, פיד במרכז, סרגל תחתון | **גבוה — שובר את ה-Tour** |
| **ג** | הדוח החודשי עובר מ-overlay לקלף בפיד; דילמה לסלוט דביק | בינוני |
| **ד** | מאגרי תוכן: תגובות לאירועים, רעש שכונתי, ביקורות, לחישות צוות | נמוך |
| **ה** | רותי עש + מד טמפרטורת רשת + פילטרים + באדג' | בינוני |

מומלץ ענף נפרד לכל שלב, או לפחות קומיט נפרד.

---

## 2. שינויים ב-`G` (מצב המשחק)

### 2.1 שדות חדשים ב-`newGame()` (שורה ~589)

```js
// --- feed ---
feed: [],              // ראה מבנה בסעיף 3
feedSeq: 0,            // מונה רץ למזהי פריטים
unseenEvents: 0,       // לבאדג' על טאב האירועים
feedFilter: "all",     // all | events | crowd | report

// --- רותי עש ---
ruti: { heat:0, stage:0, members:0, lastTickHeat:null, everPeaked:0 },

// --- תגובות מתעכבות (מגיעות חודש אחרי) ---
queuedReactions: [],   // [{kind:'staff'|'review', payload}]

// --- זיכרון אנטי-חזרתיות ---
recentEventIds: { bad:[], good:[] },
```

### 2.2 `migrateSave()` (שורה ~638) — חובה

שמירות קיימות של שחקנים לא יכילו את השדות האלה. **בלי זה המשחק ייפול בטעינה.**

```js
function migrateSave(g){
  if(!g || typeof g!=="object") return g;
  if(g.ticketPrice==null) g.ticketPrice = ECON.ticketDefault;
  if(g.insuranceSpikeUntil==null) g.insuranceSpikeUntil = 0;
  // --- feed ---
  if(!Array.isArray(g.feed)) g.feed = [];
  if(g.feedSeq==null) g.feedSeq = 0;
  if(g.unseenEvents==null) g.unseenEvents = 0;
  if(g.feedFilter==null) g.feedFilter = "all";
  if(!g.ruti) g.ruti = {heat:0,stage:0,members:0,lastTickHeat:null,everPeaked:0};
  if(!Array.isArray(g.queuedReactions)) g.queuedReactions = [];
  if(!g.recentEventIds) g.recentEventIds = {bad:[],good:[]};
  return g;
}
```

### 2.3 גזימה — קריטי ל-`localStorage`

`saveGame()` עושה `JSON.stringify(G)` על כל המצב. פיד שגדל בלי גבול ינפח את השמירה למאות KB ובסוף יזרוק `QuotaExceededError` (שנבלע ב-`catch` — כלומר **המשחק פשוט יפסיק להישמר בשקט**).

**חובה** להוסיף גזימה בסוף `resolveMonth()`, אחרי בניית הפיד:

```js
// אירועים ודוחות נשמרים ארוך; רעש נגזם אגרסיבית
function pruneFeed(){
  const KEEP_MONTHS_NOISE = 6;
  const KEEP_ITEMS_TOTAL  = 160;
  const cutoff = G.turn - KEEP_MONTHS_NOISE;
  G.feed = G.feed.filter(it =>
    it.kind === "event" || it.kind === "report" || it.turn >= cutoff
  );
  if(G.feed.length > KEEP_ITEMS_TOTAL){
    G.feed = G.feed.slice(0, KEEP_ITEMS_TOTAL); // הפיד שמור חדש→ישן
  }
}
```

> אזהרה נוספת: `G.history` כבר נגזם ל-36 (`if(G.history.length>36) G.history.shift()`).
> אל תשבור את זה — קלף הדוח בפיד צריך להחזיק **עותק** של המספרים שהוא מציג, לא הפניה ל-`history`.

---

## 3. מבנה פריט פיד

**עיקרון מנחה: לא לשמור HTML.** לשמור נתונים, לרנדר מהם.

```js
{
  id: "f42",              // `f${G.feedSeq++}`
  turn: 7,                // G.turn שבו נוצר
  monthIdx: 6, year: 1,   // לכותרת הפרק
  kind: "event",          // event | crowd | report | noise | ruti | decision
  tier: 1,                // 1=מבזק (כרטיס בולט) 2=כרטיס רגיל 3=שורה אפורה
  type: "news_bad",       // ראה טבלה למטה
  parentId: null,         // אם מלא — הפריט מוצג מוזח בשרשור תחת ההורה
  late: false,            // true → תגית "⏳ מגיב על החודש שעבר"
  payload: { ... }        // תלוי type
}
```

### 3.1 טבלת `type` ל-`payload`

| `type` | `kind` | `tier` | `payload` |
|---|---|---|---|
| `news_bad` / `news_good` | event | 1 | `{emoji, name, headline, sub, chips:[[טקסט,'b'\|'g'\|'p']]}` |
| `wa` | crowd | 2 | `{group, members, msgs:[{who,color,text,time}]}` |
| `review` | crowd | 2 | `{who, stars, text, days, ownerReply:null}` |
| `staff` | crowd | 2 | `{who, text, time}` |
| `viral` | crowd | 2 | `{caption, views, likes}` |
| `report` | report | 1 | עותק שטוח של רשומת `history` של אותו חודש |
| `ticker` | noise | 3 | `{text}` |
| `ruti` | ruti | 2 (שלב 4 → tier 1, kind `event`) | `{stage, heat, members, text, who}` |
| `decision` | event | 2 | `{question, outcome}` |

### 3.2 סדר וכיוון

- **הפיד שמור חדש→ישן** (`G.feed[0]` הוא החדש ביותר) — כדי ש-`slice` לגזימה יהיה טריוויאלי
- **ברינדור מקבצים לפי חודש** ל-`section`, וחודשים חדשים למעלה
- **בתוך חודש הסדר כרונולוגי** (מלמעלה למטה לפי סדר ההתרחשות), והדוח החודשי אחרון
  > זה במכוון הפוך מקונבנציית פיד רגילה. בלי זה השחקן קורא את התגובה לפני הסיבה.

---

## 4. שינויים ב-`resolveMonth()` (שורה ~936)

הפונקציה נשארת **כמעט ללא שינוי**. התוספות בסוף, אחרי `G.history.push({...})`:

```js
// היה: G.pendingEvents = news;  ← להשאיר לתאימות אחורה, אבל הפיד הוא מקור האמת
G.pendingEvents = news;
G.pendingDilemma = dilemma;

buildMonthFeed({ news, triggered, historyRow: G.history[G.history.length-1] });
pruneFeed();
```

### 4.1 `buildMonthFeed()` — סדר הכנסה

```js
function buildMonthFeed({news, triggered, historyRow}){
  const items = [];   // בסדר כרונולוגי, נהפוך בסוף
  const m = G.monthIdx, y = G.year, t = G.turn;

  // 1. פתיח — שורת טיקר
  items.push(mkTicker());

  // 2. תגובות שהתעכבו מהחודש שעבר
  G.queuedReactions.splice(0).forEach(q => items.push(mkFromQueue(q)));

  // 3. אירועים + שרשור התגובות שלהם
  triggered.forEach((e, i) => {
    const parent = mkEventItem(e, news[i]);
    items.push(parent);
    if(e.reactions) items.push(...mkReactions(e, parent.id));
    if(!e.good) G.unseenEvents++;
  });

  // 4. רותי עש
  const res = rutiTick(triggered.some(e => !isGreen(e)));
  const rc  = mkRutiItem(res);
  if(rc) items.push(rc);

  // 5. רעש שכונתי (מודע למצב הפארק — סעיף 5.2)
  if(chance(0.85)) items.push(mkWA());
  if(chance(0.55)) items.push(mkReview());
  if(chance(0.50)) items.push(mkStaff());
  if(chance(0.45)) items.push(mkTicker());

  // 6. חודש שקט
  if(!triggered.length && items.length <= 2) items.push(mkQuiet());

  // 7. הדוח סוגר את החודש
  items.push(mkReportItem(historyRow));

  // הפיד שמור חדש→ישן
  G.feed.unshift(...items.reverse());
}
```

### 4.2 בחירת אירוע בלי חזרות

`buildEventPool()` (שורה ~765) נשאר כמו שהוא. מה שמשתנה הוא **ה-roll**: להוסיף סינון לפי `G.recentEventIds` לפני `rollFrom`, עם חלון של חצי מגודל המאגר (מינימום 2), וזיכרון נפרד ל-RED ול-GREEN.

> בלי זה אותה כותרת מופיעה בשני חודשים רצופים והבדיחה מתה. אימתתי את זה בהדגמה.
> **הזיכרון חייב לשבת ב-`G`** (לא במשתנה מודול) אחרת אחרי טעינת שמירה מקבלים כפילויות.

---

## 5. מאגרי תוכן

### 5.1 תגובות לאירועים — הרחבה אדיטיבית

לכל אירוע ב-`RED` וב-`GREEN` בתוך `buildEventPool()` להוסיף שדה `reactions`. **לא לגעת ב-`chance` וב-`apply()`.**

```js
{id:"slide_malfunction", light:false, name:"תקלה במגלשה", emoji:"🔧",
 chance: ..., headline: ..., apply(){...},
 reactions: {
   wa: ["הילדים ביקשו את המגלשה הגדולה. אמרתי שנחכה שיתקנו אותה 🙃",
        "היא תייגה את משרד הבריאות. בפוסט. בפייסבוק."],
   rev: {s:1, t:"הבן שלי היה תקוע עשרים דקות באמצע המגלשה. עשרים. דקות. צירפתי תמונות."},
   staff: {who:"אבי · תחזוקה", t:"אמרתי. אמרתי שהמשאבה עושה רעש. יש לי הודעה קולית מפברואר."}
 }}
```

**את הטקסטים המלאים לכל 15 האירועים יש להעתיק מ-`feed-demo-v3.html`** — מהמערכים `EVENTS_BAD` ו-`EVENTS_GOOD` (חפש `const EVENTS_BAD`). הם כבר כתובים, ערוכים ומאומתים.

מיפוי מזהים בין ההדגמה ל-`index.html`:

| הדגמה | `index.html` |
|---|---|
| `chair` | `chair_fight` |
| `chair_riot` | `chair_riot` |
| `poop` | `pool_poop` |
| `fire` | `nargila_fire` |
| `falafel` | `falafel_poisoning` |
| `slide_kid` | `slide_stuck_kid` |
| `tube_kid` | `tube_stuck_kid` |
| `slide` | `slide_malfunction` |
| `health` | `health_inspection` |
| `influencer_story` | `influencer_story` |
| `water_bill` | `water_billing_glitch` |
| `influencer_friend` | `influencer_friend` |
| `celeb` | `celebrity` |
| `news` | `local_news` |
| `grant` | `council_grant` |

לאירועים שקיימים ב-`index.html` ואין להם מקבילה בהדגמה (`bad_review`, `lost_child`, `weather_damage`, `theft`, `viral_negative`, `birthday`, `ad_overperform`, `travel_mag`) — לכתוב `reactions` באותו טון. `reactions` הוא **אופציונלי**: אירוע בלעדיו פשוט לא מייצר שרשור.

### 5.2 רעש שכונתי מודע-מצב

הפוסטים חייבים לדעת מה נבנה בפארק, אחרת מישהי מתלוננת על צל כשיש 8 שמשיות.

```js
const WA_NOISE = [
  {t:"מישהו יודע אם יש שם צל היום? אני לא נוסעת שוב לשבת על בטון 😤",
   cond:()=> shadeCapacity() < visitorsPerDay()*0.25},
  {t:"עדכון לכולן: הוסיפו שמשיות! ישבתי בצל שעתיים ולא נלחמתי על זה 🌴",
   cond:()=> shadeCapacity() >= visitorsPerDay()*0.25},
  {t:"התור לאוכל שם זה משהו שלא יאומן. הילד שלי גדל בתור.",
   cond:()=> activeBuilt("food").length < 2},
  {t:"מוכרים כסאות כתר בסביבה? הפארק כאילו קנה את כל המלאי בארץ 😂"},  // בלי cond = תמיד זמין
];
const pickNoise = () => pick(WA_NOISE.filter(n => !n.cond || n.cond()));
```

הפונקציות `shadeCapacity()` / `visitorsPerDay()` — לחלץ מהלוגיקה הקיימת ב-`resolveMonth` (חיפוש `shadeCap`).

את המאגרים `WA_NOISE`, `WA_REPLY`, `REVIEWS`, `STAFF`, `TICKER`, `NEIGHBORS`, `REVIEWERS` להעתיק מההדגמה.

> **הרחבה נדרשת:** בהדגמה יש ~12 פוסטים ו-6 ביקורות. בעונה של 12–24 חודשים זה מתחיל לחזור על עצמו סביב החודש הרביעי. **מומלץ להגיע ל-40+ בכל קטגוריה** לפני שחרור, או להשתמש בתבניות עם משתנים.

---

## 6. רותי עש — מנוע הנמסיס

נמסיס מתמשכת עם זיכרון, לא אירוע אקראי. הטקסטים המלאים לכל השלבים נמצאים באובייקט `RUTI` בהדגמה.

### 6.1 מד החום

```js
function rutiTick(hadBadEvent){
  const R = G.ruti;
  let d = 0;
  if(G.satisfaction < 45)      d += 18;
  else if(G.satisfaction < 55) d += 9;
  else if(G.satisfaction > 72) d -= 16;
  else if(G.satisfaction > 62) d -= 8;
  if(hadBadEvent)              d += 10;
  if(G.ticketPrice > 45)       d += 6;
  if(G.rating < 3)             d += 7;

  // ההשוואה היא לחום בסגירת החודש הקודם — כך שגם פעולות שחקן
  // באמצע החודש (תשובה מתחכמת, העלאת מחיר) נספרות כחימום
  const prev = (R.lastTickHeat == null) ? R.heat : R.lastTickHeat;
  R.heat = clamp(R.heat + d, 0, 100);
  const rising = R.heat > prev || R.heat >= 95;   // נעוץ בתקרה = עדיין עולה
  R.lastTickHeat = R.heat;

  const ns = R.heat>=88 ? 4 : R.heat>=62 ? 3 : R.heat>=36 ? 2 : R.heat>=16 ? 1 : 0;
  const old = R.stage;
  R.stage = ns;
  if(ns > R.everPeaked) R.everPeaked = ns;

  // הקבוצה מגייסת רק בזמן חימום, ומדממת חברים בקירור
  if(ns >= 3){
    if(!R.members) R.members = randi(24,60);
    else R.members = Math.round(R.members * (rising ? 1.35 : 0.7));
    if(ns === 4 && rising) R.members = Math.max(R.members, randi(180,420));
  } else if(R.members){
    R.members = Math.round(R.members * 0.55);
    if(R.members < 8) R.members = 0;
  }
  return {old, now:ns, up:ns>old, down:ns<old};
}
```

> **מלכודת שנתקלתי בה:** אם קובעים `rising` לפי הדריפט החודשי `d` בלבד, הקבוצה של רותי **גדלה גם כשהיא נרגעת**. ההשוואה חייבת להיות לחום בסגירת החודש הקודם (`lastTickHeat`).
> **מלכודת שנייה:** בלי התנאי `|| R.heat >= 95`, ברגע שהחום ננעץ ב-100 הקבוצה מתחילה להתכווץ בשיא הזעם.
> **מלכודת שלישית (התגלתה בפלייטסט של 12 משחקים):** חום ננעץ ב-100 ⇒ שלב 4 נשאר עד סוף העונה. אם ההסלמה יורה **בכל חודש** מתקבל לולאת מוות — הקנס מוריד שביעות רצון, שביעות הרצון הנמוכה מחזיקה את החום למעלה, וזה יורה את הקנס הבא. נמדדו 16–22 הסלמות למשחק של 24 חודשים וגירעונות של 5 מיליון ₪. הפתרון: `RUTI_ESCALATE_GAP = 4` — הסלמה בכניסה לשלב, ואז אחת ל-4 חודשים; בחודשים שביניהם קלף `pressure` בלי השפעה כספית.
> **מלכודת רביעית:** `members × 1.35` בכל חודש מגיע ל-170,000 חברים בקבוצה שכונתית. `RUTI_MAX_MEMBERS = 9000` שומר על הבדיחה.

### 6.2 ארבעת השלבים

| שלב | טווח חום | ביטוי | השפעה מכנית |
|---|---|---|---|
| 0 | 0–15 | לא קיימת | — |
| 1 · 👀 | 16–35 | תגובה עוקצנית בוואטסאפ השכונתי | אין |
| 2 · ⭐ | 36–61 | ביקורת גוגל 1★ חתומה בשמה | הביקורת נספרת בדירוג |
| 3 · 📢 | 62–87 | פותחת "נפגעי [שם הפארק] — קבוצת מידע 🕵️‍♀️", מונה חברים גדל | לחץ מתמשך |
| 4 · 🔥 | 88–100 | תלונה לרישוי עסקים / כתבה חוקרת | **קנס ₪20K–140K + 9–11 שביעות רצון**, בכניסה לשלב ואז אחת ל-4 חודשים |

הירידה במדרגות עם טקסט נסיגה (`RUTI.down`) — היא לא נעלמת, היא נסוגה בחן.

### 6.3 קלט מפעולות השחקן (מחוץ ל-tick החודשי)

| פעולה | שינוי חום |
|---|---|
| תגובה מנומסת לביקורת | −5 |
| תגובה "בסטייל" לביקורת | **+12** |
| העלאת מחיר מעל ₪45 | +8 |
| בנייה שפותרת תלונה קיימת (צל/חניה/הסעדה) | −8 |

---

## 7. שינויים ב-`renderDashboard()` (שורה ~1357)

### 7.1 מבנה חדש מלמעלה למטה

```
[topstrip]      שם הפארק · 💰 כסף · ⭐ דירוג · 🕵️‍♀️ שלב רותי · חץ פתיחה
                └ פאנל מתקפל: מבקרים · שביעות רצון · קיבולת · ביקוש · מחיר · ביקורות
[mood]          מד טמפרטורת רשת — פס 🤬 ← 😍
[warnbar]       אזהרת "X אנשים יחזרו הביתה" / גירעון   (רק כשרלוונטי)
[dilslot]       דילמה — דביק, מחוץ לגלילה, חוסם "סגור חודש"   (רק כשפתוחה)
[tabs]          הכל · 🚨 אירועים(באדג') · 💬 קהל · 📊 דוחות
[feed]          ← האזור הגליל. זה רוב המסך.
[bottombar]     🏗️ בנייה · 🎟️ מחיר · [➡️ סגור חודש]
```

`capacityCard()` ו-`priceCard()` **לא נמחקות** — הן עוברות ל-bottom sheet שנפתח מכפתור 🎟️.

### 7.2 מד טמפרטורת רשת

```js
const mood = clamp(Math.round(
  G.satisfaction*0.65 + (G.rating/5*100)*0.35 - G.ruti.heat*0.18
), 0, 100);
// >78 😍 · >60 🙂 · >42 😐 · >25 😠 · אחרת 🤬
```

---

## 8. הדוח החודשי — מ-overlay לקלף בפיד

ב-`renderReportOverlay()` (שורה ~1924) יש היום המרה של רשומת `history` ל-HTML. **לשמר את כל הלוגיקה** (פירוט כספי מתקפל, פירוק שביעות רצון, "נשלחו הביתה") ולהעביר אותה לפונקציה `renderReportCard(historyRow)` שמחזירה קלף פיד במקום overlay.

### 8.1 שינויים חובה

1. **למחוק** את `G.pendingEvents = []` מכפתור "המשך" (שורה ~2036). זה מה שמחק את התוכן.
2. `checkEndConditions()` ממשיך לרוץ אחרי סגירת חודש — לא לשבור את זה.
3. הטריגר `Tour.trigger("FIRST_MONTHLY_REPORT")` עובר מה-overlay לרגע שבו קלף הדוח נכנס לפיד.
4. סעיף "🗞️ הידיעות החמות" בתוך הדוח **נמחק** — האירועים כבר בפיד כקלפים עצמאיים.

---

## 9. ⚠️ סיכונים ומלכודות

### 9.1 ה-Tour ישבר — הסיכון הגדול ביותר

מערכת ההדרכה (שורות ~2118–2810, ומפרט ב-`onboarding-tutorial-spec.md`) נתלית על סלקטורים `data-tour`. שינוי מבנה הדשבורד ישבור אותם **בשקט** — `findTarget` פשוט לא ימצא ואז `waitForTarget` יפוג.

| `data-tour` | שורה | מצב אחרי השינוי |
|---|---|---|
| `park-header` | 1542 | עובר ל-`.topstrip` |
| `kpi-money` | 1386 | עובר לצ'יפ 💰 בשורה העליונה |
| `kpi-rating` | 1385 | עובר לצ'יפ ⭐ בשורה העליונה |
| `kpi-visitors` | 1384 | **בעיה** — עובר לפאנל המתקפל |
| `nav-build` | 1394 | עובר לכפתור 🏗️ בסרגל התחתון |
| `next-month-btn` | 1418 | עובר לכפתור בסרגל התחתון |
| `event-sheet` | 1895 | עובר ל-`.dilslot` |
| `report-financials` | 1964 | עובר לתוך קלף הדוח בפיד |
| `build-tabs` | 1648 | ללא שינוי |
| `construction-progress` | 1610 | ללא שינוי |
| `help-btn` | 1545 | ללא שינוי |

**`kpi-visitors` דורש טיפול מיוחד:** הפאנל המתקפל הוא `max-height:0`, ובדיקת `isUsable(node)` ב-Tour עלולה לפסול אותו כלא-נראה. שתי אפשרויות — או שהצעד פותח את הפאנל לפני שהוא מצביע עליו, או שהוא מצביע במקום זאת על קלף הדוח בפיד. **לבחור אחת ולתעד ב-`onboarding-tutorial-spec.md`.**

צעדים חדשים שכדאי להוסיף: הסבר על הפיד עצמו, והצגה של רותי עש בפעם הראשונה שהיא מגיעה לשלב 2.

### 9.2 `localStorage` — כישלון שקט

`saveGame()` עוטף הכל ב-`try{}catch(e){}` ריק. חריגת מכסה **לא תיראה בשום מקום** — המשחק פשוט יפסיק להישמר. חובה `pruneFeed()` (סעיף 2.3). מומלץ גם:

```js
function saveGame(){
  try{ localStorage.setItem(SAVE_KEY, JSON.stringify(G)); }
  catch(e){
    pruneFeed();
    try{ localStorage.setItem(SAVE_KEY, JSON.stringify(G)); }
    catch(e2){ toast("⚠️ לא הצלחנו לשמור — הפיד ארוך מדי"); }
  }
}
```

### 9.3 סיגנל מול רעש

זו הסכנה העיצובית המרכזית. אם קנס של ₪88,000 נראה כמו עוד פוסט וואטסאפ, השחקן יפספס אותו. **שלוש הדרגות הוויזואליות אינן קישוט** — הן המנגנון שמונע את זה:

- **tier 1** — כרטיס עם פס צבע בצד, כותרת גדולה, וצ'יפים של מספרים (`-₪88,000`, `-7 שביעות רצון`)
- **tier 2** — כרטיס רגיל, בלי פס
- **tier 3** — שורה אפורה אחת, בלי כרטיס בכלל

### 9.4 ביצועים

פיד ארוך = הרבה DOM. מעל ~200 קלפים בנייד מתחיל גמגום בגלילה. `pruneFeed()` מטפל בזה. אם בכל זאת יש בעיה — לרנדר רק 3 חודשים אחרונים ולהוסיף כפתור "טען עוד".

### 9.5 שני דירוגים

בהדגמה יש "דירוג גוגל" נפרד מ-`G.rating`. **בקוד האמיתי לא ליצור שני מקורות אמת** — או שהמספר שמוצג בפיד נגזר מ-`G.rating`, או שמוותרים עליו. שני מדדים שזזים אחרת יבלבלו.

### 9.6 RTL

כל הצגה של סכום כסף בתוך פריסת RTL צריכה `unicode-bidi:isolate; direction:ltr` על האלמנט, אחרת `₪1.45M` מתהפך. ראה את ה-CSS בהדגמה (`.ts-stat span, .rep-kpi b, .fr span:last-child, .chip`).

---

## 10. CSS

להעתיק מ-`feed-demo-v3.html` את הבלוקים:
`.topstrip` · `.mood` · `.dilslot` · `.tabs` · `.feed` · `.month` / `.mhead` (כותרת פרק דביקה) ·
`.c` ונגזרותיו · `.t1` / `.t3` (דרגות) · `.thread` (שרשור) · `.wa` · `.rev` · `.staff` · `.viral` ·
`.report` · `.rutic` (רותי) · `.quiet` · `.bottombar` · `.late`

משתני הצבע כבר קיימים ב-`:root` של `index.html`. התוספת היחידה:

```css
--ruti:#6d28d9;  --ruti2:#4c1d95;
```

---

## 11. בדיקות קבלה

לפני סגירת כל שלב:

- [ ] סגירת 12 חודשים רצופים בלי שגיאות קונסולה
- [ ] רענון דף באמצע — הפיד חוזר במלואו, רותי שומרת על שלב וחום
- [ ] `JSON.stringify(G).length` אחרי 24 חודשים נשאר מתחת ל-**300KB**
- [ ] אותה כותרת אירוע לא מופיעה בשני חודשים רצופים
- [ ] דילמה פתוחה — "סגור חודש" מושבת ולא ניתן ללחיצה
- [ ] פילטר "🚨 אירועים" מסתיר רעש, וחודשים שנשארו ריקים לא מציגים כותרת פרק
- [ ] רותי עולה 0→4 כששביעות הרצון נמוכה, ויורדת 4→1 כשמתקנים
- [ ] הקבוצה של רותי **מתכווצת** בזמן ירידה (הבאג שתפסתי)
- [ ] כל 11 צעדי ה-Tour מוצאים את היעד שלהם במשחק חדש
- [ ] מבזק כלכלי נראה שונה מובהק מפוסט וואטסאפ במבט חטוף
- [ ] ב-iPhone SE (375px) — הכותרת הדביקה, הסרגל התחתון והפיד לא נחתכים

---

## 12. מה שלא נכלל ונשאר פתוח

- **ארכיון סוף עונה** — "הפוסט הכי ויראלי של העונה" במסך הסיום
- **דמויות חוזרות נוספות** מעבר לרותי — אורית 🌸, דודו המציל, אבי מהתחזוקה כבר מופיעים כשמות בפול אבל בלי המשכיות אמיתית
- **הרחבת מאגרי הרעש ל-40+ פריטים** לכל קטגוריה (סעיף 5.2)
- **תגובה של השחקן לפוסט וואטסאפ** (היום רק לביקורות גוגל)
