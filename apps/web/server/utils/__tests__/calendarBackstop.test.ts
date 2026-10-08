import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Building a date from `toISOString().slice(0, 10)` yields the UTC date, which
// is how "today" went wrong in the first place. The Calendar module is the one
// place allowed to do it (for plain-date arithmetic); everything else asks it.
const ROOT = resolve(__dirname, "../../..");
const ALLOWED = new Set(["shared/utils/calendar.ts"]);
const BANNED = /toISOString\(\)\s*\.slice\(\s*0\s*,\s*10\s*\)/;
const BANNED_ISO_DATE = /\bisoDate\(/;

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "__tests__" || name === "node_modules" ? [] : sources(path);
    return /\.(ts|vue)$/.test(name) ? [path] : [];
  });
}

describe("Calendar module backstop", () => {
  const files = ["server", "app", "shared"].flatMap((d) => sources(join(ROOT, d)));

  it("scans real source files", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("has no UTC-date formatting outside the Calendar module", () => {
    const offenders = files
      .filter((f) => !ALLOWED.has(relative(ROOT, f)))
      .filter((f) => BANNED.test(readFileSync(f, "utf8")) || BANNED_ISO_DATE.test(readFileSync(f, "utf8")))
      .map((f) => relative(ROOT, f));
    expect(offenders).toEqual([]);
  });
});
