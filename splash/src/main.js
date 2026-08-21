import { createRenderer } from './engine/renderer.js';
import { attachInput } from './engine/input.js';
import { ensureFonts } from './engine/text.js';
import { HomeScene } from './scenes/HomeScene.js';

async function boot() {
  const canvas = document.getElementById('game');
  let dirty = true;
  const invalidate = () => { dirty = true; };
  const renderer = createRenderer(canvas, invalidate);

  // בלי זה הפריים הראשון מצויר בפונט ברירת מחדל ונראה שונה לגמרי
  await ensureFonts();

  const scene = new HomeScene((action) => {
    // הסבב הזה בונה רק את מסך הבית — שאר המסכים עוד לא קיימים
    console.info('[splash] action:', action);
  });

  attachInput(canvas, renderer, (x, y, phase) => {
    if (scene.onPointer(x, y, phase)) invalidate();
  });

  window.addEventListener('resize', () => { renderer.resize(); invalidate(); });
  window.addEventListener('orientationchange', () => { renderer.resize(); invalidate(); });
  document.fonts?.addEventListener?.('loadingdone', invalidate);

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (scene.update(dt)) dirty = true;
    if (dirty) {
      scene.draw(renderer.ctx);
      renderer.present();
      dirty = false;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // וו דיבאג לפיתוח מקומי בלבד — מאפשר לצייר פריים ידנית מכלי בדיקה חיצוני
  if (['localhost', '127.0.0.1'].includes(location.hostname)) {
    window.__splash = {
      renderer, scene, invalidate,
      redraw() { renderer.resize(); scene.draw(renderer.ctx); renderer.present(); },
    };
  }

  // נעילה לאנכי — נתמך רק בחלק מהדפדפנים, נכשל בשקט במקומות אחרים
  screen.orientation?.lock?.('portrait').catch(() => {});
}

boot();
