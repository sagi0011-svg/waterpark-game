/**
 * מסך אחד במשחק.
 *
 * @typedef {'down'|'move'|'up'|'cancel'|'escape'} PointerPhase
 *
 * interface Scene {
 *   draw(ctx): void                              ציור מלא של המסך
 *   onPointer(x, y, phase): boolean               true = משהו השתנה, צריך לצייר מחדש
 *   update(dt): boolean                           dt בשניות. true = צריך לצייר מחדש
 * }
 */
export class Scene {
  /** @param {CanvasRenderingContext2D} _ctx */
  draw(_ctx) {}
  /** @param {number} _x @param {number} _y @param {PointerPhase} _phase @returns {boolean} */
  onPointer(_x, _y, _phase) { return false; }
  /** @param {number} _dt @returns {boolean} */
  update(_dt) { return false; }
}
