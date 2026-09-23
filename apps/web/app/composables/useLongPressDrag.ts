import { computed, readonly, ref, type Ref } from "vue";
import { exceedsTolerance, ghostPosition, nearestTarget, type DropTarget, type Point } from "./dragGeometry";

// Press-and-hold, then drag — the phone gesture for moving a card between
// days. Built on pointer events rather than HTML5 drag-and-drop, which does
// not fire on touch at all.

const LONG_PRESS_MS = 400;
/** Move further than this before the timer fires and it was a scroll. */
const MOVE_TOLERANCE_PX = 8;
/** How close to a screen edge starts auto-scrolling, and how fast it goes. */
const EDGE_ZONE_PX = 96;
const EDGE_SPEED_PX = 12;
/** How far past the ends of the list still counts as aiming at it. */
const TARGET_SLACK_PX = 140;

export interface LongPressDragOptions {
  /** Container whose `[data-drop-key]` descendants are the drop targets. */
  container: Ref<HTMLElement | null>;
  onDrop: (from: string, to: string) => void;
}

export function useLongPressDrag({ container, onDrop }: LongPressDragOptions) {
  const activeKey = ref<string | null>(null);
  const overKey = ref<string | null>(null);
  const ghost = ref<{ x: number; y: number; width: number; height: number } | null>(null);
  const isDragging = computed(() => activeKey.value !== null);

  let timer: ReturnType<typeof setTimeout> | null = null;
  let pendingKey: string | null = null;
  let startPoint: Point = { x: 0, y: 0 };
  let grabOffset: Point = { x: 0, y: 0 };
  let sourceSize = { width: 0, height: 0 };
  let targets: DropTarget[] = [];
  let capturedEl: HTMLElement | null = null;
  let capturedPointerId: number | null = null;
  let scrollFrame: number | null = null;
  let lastClientY = 0;
  // Auto-scroll stays disarmed until the pointer has been clear of both edge
  // zones. Otherwise picking up a card that already sits near the bottom of
  // the screen — Saturday and Sunday usually do — sends the page scrolling
  // the instant it lifts, before the finger has moved at all.
  let edgeArmed = false;

  /**
   * How far past the list still counts as aiming at it.
   *
   * Normally a modest margin, so dragging well clear of the list and letting
   * go still cancels. But once the page has scrolled as far as it can, the
   * pointer held in the edge zone is stranded in the dead space below the last
   * row — the button, the hint line and the tab bar — with no way to get any
   * closer. There, anything past the end means the end.
   */
  function targetSlack(): number {
    const doc = document.documentElement;
    const atBottom = window.scrollY + window.innerHeight >= doc.scrollHeight - 1;
    const atTop = window.scrollY <= 0;
    return atBottom || atTop ? Number.POSITIVE_INFINITY : TARGET_SLACK_PX;
  }

  /**
   * Stop the browser scrolling the page while a card is in hand.
   *
   * This is the whole reason touch drag works at all, and none of the obvious
   * alternatives do the job:
   *
   *   - `touch-action: none` is read when the touch STARTS. Setting it once
   *     the card lifts, 400ms in, is too late for the touch already in
   *     flight, and the browser will take that touch for a scroll and fire
   *     pointercancel at us instead.
   *   - `preventDefault()` on a pointermove does not stop touch scrolling.
   *
   * A non-passive touchmove listener does, but only if it is attached before
   * the finger moves — Chrome treats document-level touchmove as passive by
   * default, and passive preventDefault() is silently ignored. So it goes on
   * at pointerdown and only starts refusing once the card is actually lifted,
   * which leaves a pre-lift drag free to scroll the page as it should.
   */
  function blockTouchScroll(event: TouchEvent) {
    if (isDragging.value && event.cancelable) event.preventDefault();
  }

  function snapshotTargets(): DropTarget[] {
    const root = container.value;
    if (!root) return [];
    // Taken once, at pickup. The dragged card is lifted into a fixed-position
    // ghost rather than pulled out of the flow, so nothing reflows underneath.
    // Stored in document coordinates, not viewport ones, so that auto-scroll
    // can move the page mid-drag without invalidating them.
    const scrollY = window.scrollY;
    return [...root.querySelectorAll<HTMLElement>("[data-drop-key]")].map((el) => {
      const r = el.getBoundingClientRect();
      return { key: el.dataset.dropKey!, top: r.top + scrollY, bottom: r.bottom + scrollY };
    });
  }

  /**
   * Scroll the page while a card is held near the top or bottom edge.
   *
   * Without this the week's last rows are unreachable: seven cards plus the
   * header run taller than a phone screen, and the page can't be scrolled by
   * hand while a card is in hand.
   */
  function edgeScroll() {
    scrollFrame = requestAnimationFrame(edgeScroll);
    if (!isDragging.value) return;

    const fromTop = lastClientY;
    const fromBottom = window.innerHeight - lastClientY;
    if (!edgeArmed) {
      if (fromTop >= EDGE_ZONE_PX && fromBottom >= EDGE_ZONE_PX) edgeArmed = true;
      return;
    }
    let dy = 0;
    if (fromTop < EDGE_ZONE_PX) dy = -EDGE_SPEED_PX * (1 - fromTop / EDGE_ZONE_PX);
    else if (fromBottom < EDGE_ZONE_PX) dy = EDGE_SPEED_PX * (1 - fromBottom / EDGE_ZONE_PX);
    if (dy === 0) return;

    const before = window.scrollY;
    window.scrollBy(0, dy);
    // The pointer hasn't moved, but the page under it has.
    if (window.scrollY !== before) overKey.value = nearestTarget(targets, lastClientY + window.scrollY, targetSlack());
  }

  function begin(el: HTMLElement) {
    const rect = el.getBoundingClientRect();
    sourceSize = { width: rect.width, height: rect.height };
    grabOffset = { x: startPoint.x - rect.left, y: startPoint.y - rect.top };
    targets = snapshotTargets();

    activeKey.value = pendingKey;
    overKey.value = pendingKey;
    edgeArmed = false;
    ghost.value = { x: rect.left, y: rect.top, width: rect.width, height: rect.height };

    // Nice-to-have confirmation that the card is now in hand; absent on iOS
    // Safari and that's fine.
    navigator.vibrate?.(10);

    if (scrollFrame === null) scrollFrame = requestAnimationFrame(edgeScroll);
  }

  function onPointerDown(event: PointerEvent, key: string) {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    const el = (event.currentTarget as HTMLElement) ?? null;
    if (!el) return;

    reset();
    pendingKey = key;
    startPoint = { x: event.clientX, y: event.clientY };

    capturedEl = el;
    capturedPointerId = event.pointerId;
    el.setPointerCapture(event.pointerId);
    document.addEventListener("touchmove", blockTouchScroll, { passive: false });

    timer = setTimeout(() => {
      timer = null;
      begin(el);
    }, LONG_PRESS_MS);
  }

  function onPointerMove(event: PointerEvent) {
    const here = { x: event.clientX, y: event.clientY };
    lastClientY = event.clientY;

    // Still deciding: any real travel means the user is scrolling the page.
    if (timer) {
      if (exceedsTolerance(startPoint, here, MOVE_TOLERANCE_PX)) reset();
      return;
    }
    if (!isDragging.value) return;

    // Holding a card, so the page must not scroll under it.
    event.preventDefault();

    const at = ghostPosition(here, grabOffset, sourceSize, {
      width: window.innerWidth,
      height: window.innerHeight,
    });
    ghost.value = { ...at, ...sourceSize };
    overKey.value = nearestTarget(targets, here.y + window.scrollY, targetSlack());
  }

  function onPointerUp() {
    const from = activeKey.value;
    const to = overKey.value;
    reset();
    if (from && to && from !== to) onDrop(from, to);
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape") reset();
  }

  function reset() {
    document.removeEventListener("touchmove", blockTouchScroll);
    if (timer) clearTimeout(timer);
    timer = null;
    if (scrollFrame !== null) cancelAnimationFrame(scrollFrame);
    scrollFrame = null;
    edgeArmed = false;
    pendingKey = null;
    targets = [];
    activeKey.value = null;
    overKey.value = null;
    ghost.value = null;

    if (capturedEl && capturedPointerId !== null && capturedEl.hasPointerCapture?.(capturedPointerId)) {
      capturedEl.releasePointerCapture(capturedPointerId);
    }
    capturedEl = null;
    capturedPointerId = null;
  }

  return {
    activeKey: readonly(activeKey),
    overKey: readonly(overKey),
    ghost: readonly(ghost),
    isDragging,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onKeyDown,
    cancel: reset,
  };
}
