// Pure geometry for the long-press drag on the Plan screen. No DOM, no Vue —
// the fiddly parts are the bits worth testing, and they don't need either.

export interface DropTarget {
  key: string;
  top: number;
  bottom: number;
}

export interface Point {
  x: number;
  y: number;
}

/**
 * Which target the pointer is over, or null when it's past either end.
 *
 * The day list is a single vertical column, so `y` alone decides it — no need
 * to care how wide a row is or whether the finger has strayed sideways, which
 * it always does mid-drag.
 */
export function hitTestVertical(targets: DropTarget[], y: number): string | null {
  for (const t of targets) {
    if (y >= t.top && y < t.bottom) return t.key;
  }
  return null;
}

/**
 * Like hitTestVertical, but forgiving just past either end of the list.
 *
 * The list doesn't reach the bottom of the page — there's padding, the
 * full-plan button and the tab bar below it — so holding a card against the
 * bottom edge to auto-scroll leaves the pointer in dead space under the last
 * row, and a drop there would do nothing at all. Within `slackPx` of an end,
 * aim at the row nearest it; beyond that, the user has dragged away from the
 * list and means to cancel.
 */
export function nearestTarget(targets: DropTarget[], y: number, slackPx: number): string | null {
  const inside = hitTestVertical(targets, y);
  if (inside) return inside;
  if (!targets.length) return null;

  const first = targets[0]!;
  const last = targets[targets.length - 1]!;
  if (y < first.top && first.top - y <= slackPx) return first.key;
  if (y >= last.bottom && y - last.bottom <= slackPx) return last.key;
  return null;
}

/** Has the pointer moved far enough that this is a scroll, not a press? */
export function exceedsTolerance(start: Point, current: Point, tolerancePx: number): boolean {
  const dx = current.x - start.x;
  const dy = current.y - start.y;
  return dx * dx + dy * dy > tolerancePx * tolerancePx;
}

/**
 * Top-left for the dragged card so it keeps the same spot under the finger it
 * was grabbed by, clamped so it can't be dragged off-screen entirely.
 */
export function ghostPosition(
  pointer: Point,
  grabOffset: Point,
  size: { width: number; height: number },
  viewport: { width: number; height: number },
): Point {
  const x = pointer.x - grabOffset.x;
  const y = pointer.y - grabOffset.y;
  return {
    x: Math.min(Math.max(x, 0), Math.max(viewport.width - size.width, 0)),
    y: Math.min(Math.max(y, 0), Math.max(viewport.height - size.height, 0)),
  };
}
