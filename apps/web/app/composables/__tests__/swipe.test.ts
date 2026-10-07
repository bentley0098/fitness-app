import { describe, expect, it } from "vitest";
import { isHorizontalDrag, swipeDirection } from "../swipe";

describe("swipeDirection", () => {
  it("maps a long left drag to the next week and a right drag to the previous", () => {
    expect(swipeDirection(-80, 5)).toBe("next");
    expect(swipeDirection(80, -5)).toBe("prev");
  });

  it("ignores short drags and mostly-vertical ones", () => {
    expect(swipeDirection(-30, 0)).toBeNull();
    expect(swipeDirection(-70, 90)).toBeNull();
  });
});

describe("isHorizontalDrag", () => {
  it("needs some travel, mostly sideways", () => {
    expect(isHorizontalDrag(4, 0)).toBe(false);
    expect(isHorizontalDrag(20, 25)).toBe(false);
    expect(isHorizontalDrag(-20, 5)).toBe(true);
  });
});
