import { describe, expect, it } from "vitest";
import { exceedsTolerance, ghostPosition, hitTestVertical, nearestTarget, type DropTarget } from "../dragGeometry";

// Seven 60px rows starting at y=100, as the day list lays out.
const targets: DropTarget[] = Array.from({ length: 7 }, (_, i) => ({
  key: `day-${i}`,
  top: 100 + i * 60,
  bottom: 160 + i * 60,
}));

describe("hitTestVertical", () => {
  it("finds the row under the pointer", () => {
    expect(hitTestVertical(targets, 100)).toBe("day-0");
    expect(hitTestVertical(targets, 159)).toBe("day-0");
    expect(hitTestVertical(targets, 220)).toBe("day-2");
    expect(hitTestVertical(targets, 519)).toBe("day-6");
  });

  it("puts a boundary pixel in exactly one row", () => {
    expect(hitTestVertical(targets, 160)).toBe("day-1");
    expect(hitTestVertical(targets, 220)).toBe("day-2");
  });

  it("returns null past either end", () => {
    expect(hitTestVertical(targets, 99)).toBeNull();
    expect(hitTestVertical(targets, 520)).toBeNull();
  });

  it("returns null with nothing to hit", () => {
    expect(hitTestVertical([], 200)).toBeNull();
  });
});

describe("exceedsTolerance", () => {
  const start = { x: 100, y: 100 };

  it("ignores a small wobble", () => {
    expect(exceedsTolerance(start, { x: 104, y: 104 }, 8)).toBe(false);
    expect(exceedsTolerance(start, { x: 100, y: 100 }, 8)).toBe(false);
  });

  it("trips once the pointer really travels", () => {
    expect(exceedsTolerance(start, { x: 100, y: 130 }, 8)).toBe(true);
    expect(exceedsTolerance(start, { x: 70, y: 100 }, 8)).toBe(true);
  });

  it("measures distance, not per-axis drift", () => {
    // 6px on each axis is ~8.49px of travel — over an 8px tolerance.
    expect(exceedsTolerance(start, { x: 106, y: 106 }, 8)).toBe(true);
  });
});

describe("ghostPosition", () => {
  const size = { width: 300, height: 80 };
  const viewport = { width: 390, height: 844 };

  it("keeps the card under the point it was grabbed by", () => {
    const at = ghostPosition({ x: 120, y: 400 }, { x: 50, y: 40 }, size, viewport);
    expect(at).toEqual({ x: 70, y: 360 });
  });

  it("clamps so the card can't leave the screen", () => {
    expect(ghostPosition({ x: 5, y: 5 }, { x: 50, y: 40 }, size, viewport)).toEqual({ x: 0, y: 0 });
    expect(ghostPosition({ x: 389, y: 843 }, { x: 0, y: 0 }, size, viewport)).toEqual({ x: 90, y: 764 });
  });

  it("doesn't produce a negative clamp on a viewport smaller than the card", () => {
    expect(ghostPosition({ x: 10, y: 10 }, { x: 0, y: 0 }, size, { width: 200, height: 50 })).toEqual({ x: 0, y: 0 });
  });
});

describe("nearestTarget", () => {
  it("behaves like a plain hit test inside the list", () => {
    expect(nearestTarget(targets, 220, 140)).toBe("day-2");
    expect(nearestTarget(targets, 100, 140)).toBe("day-0");
  });

  it("aims at the end row when the pointer sits just past it", () => {
    // Dead space below the last row, where holding to auto-scroll leaves you.
    expect(nearestTarget(targets, 560, 140)).toBe("day-6");
    expect(nearestTarget(targets, 60, 140)).toBe("day-0");
  });

  it("gives up once the pointer is clearly away from the list", () => {
    expect(nearestTarget(targets, 800, 140)).toBeNull();
    expect(nearestTarget(targets, -200, 140)).toBeNull();
  });

  it("respects the slack boundary exactly", () => {
    expect(nearestTarget(targets, 520 + 140, 140)).toBe("day-6");
    expect(nearestTarget(targets, 520 + 141, 140)).toBeNull();
  });

  it("returns null with no targets", () => {
    expect(nearestTarget([], 200, 140)).toBeNull();
  });
});

describe("nearestTarget with unbounded slack", () => {
  it("always lands on an end row, however far past the list the pointer is", () => {
    expect(nearestTarget(targets, 5000, Number.POSITIVE_INFINITY)).toBe("day-6");
    expect(nearestTarget(targets, -5000, Number.POSITIVE_INFINITY)).toBe("day-0");
  });

  it("still prefers the row actually under the pointer", () => {
    expect(nearestTarget(targets, 220, Number.POSITIVE_INFINITY)).toBe("day-2");
  });
});
