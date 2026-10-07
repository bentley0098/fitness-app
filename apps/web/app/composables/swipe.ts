// A drag counts as a week swipe only when it is mostly sideways and long
// enough; anything else is a tap or a vertical scroll.
export const SWIPE_THRESHOLD_PX = 60;

export function swipeDirection(dx: number, dy: number, threshold = SWIPE_THRESHOLD_PX): "next" | "prev" | null {
  if (Math.abs(dx) < threshold || Math.abs(dx) <= Math.abs(dy)) return null;
  // Dragging left pulls the next week in.
  return dx < 0 ? "next" : "prev";
}

/** Sideways intent, decided early enough to start following the finger. */
export function isHorizontalDrag(dx: number, dy: number, slop = 8): boolean {
  return Math.abs(dx) > slop && Math.abs(dx) > Math.abs(dy);
}
