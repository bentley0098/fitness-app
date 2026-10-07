import { describe, expect, it } from "vitest";
import { sessionHref } from "../sessionHref";

describe("sessionHref", () => {
  it("opens the matched activity when there is one", () => {
    expect(sessionHref({ id: "s1", completion: { activityIds: ["a9", "a10"] } })).toBe("/activity/a9");
  });

  it("opens the planned view when nothing matched", () => {
    expect(sessionHref({ id: "s1", completion: { activityIds: [] } })).toBe("/activity/s1?planned=1");
    expect(sessionHref({ id: "s1", completion: {} })).toBe("/activity/s1?planned=1");
  });
});
