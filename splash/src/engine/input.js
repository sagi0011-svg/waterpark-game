/**
 * המרת אירועי מצביע לקואורדינטות וירטואליות.
 * המקום הנפוץ לבאגים כאן הוא ה-letterbox ו-getBoundingClientRect — שניהם מטופלים ב-renderer.toVirtual.
 */
export function attachInput(canvas, renderer, onPointer) {
  let activeId = null;

  function send(e, phase) {
    const p = renderer.toVirtual(e.clientX, e.clientY);
    if (!p) {
      // נגיעה על ה-letterbox: לא מסך המשחק. שולחים cancel כדי לשחרר מצב "לחוץ".
      if (phase !== 'down') onPointer(-1, -1, 'cancel');
      return false;
    }
    return onPointer(p.x, p.y, phase);
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (activeId !== null) return;
    activeId = e.pointerId;
    try { canvas.setPointerCapture(e.pointerId); } catch { /* מצביע סינתטי/לא תקף */ }
    send(e, 'down');
  });

  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId !== activeId) return;
    send(e, 'move');
  });

  canvas.addEventListener('pointerup', (e) => {
    if (e.pointerId !== activeId) return;
    activeId = null;
    send(e, 'up');
  });

  const cancel = (e) => {
    if (e.pointerId !== activeId) return;
    activeId = null;
    onPointer(-1, -1, 'cancel');
  };
  canvas.addEventListener('pointercancel', cancel);
  canvas.addEventListener('lostpointercapture', cancel);

  // מקלדת — נגישות בסיסית: Escape סוגר שכבות.
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') onPointer(-1, -1, 'escape');
  });
}
