import type { H3Event } from "h3";
import { describe, expect, it } from "vitest";
import { requestToday, requestZone } from "../requestZone";

const eventWith = (cookie?: string) => ({ node: { req: { headers: cookie ? { cookie } : {} } } }) as unknown as H3Event;

describe("requestZone", () => {
  it("reads the tz cookie", () => {
    expect(requestZone(eventWith("tz=America%2FNew_York; other=1"))).toBe("America/New_York");
  });

  it("falls back to Irish time with no cookie or a garbage one", () => {
    expect(requestZone(eventWith())).toBe("Europe/Dublin");
    expect(requestZone(eventWith("tz=garbage"))).toBe("Europe/Dublin");
  });
});

describe("requestToday", () => {
  const now = new Date("2026-09-10T03:00:00Z");

  it("is today in the cookie's zone", () => {
    expect(requestToday(eventWith("tz=America%2FLos_Angeles"), now)).toBe("2026-09-09");
    expect(requestToday(eventWith(), now)).toBe("2026-09-10");
  });
});
