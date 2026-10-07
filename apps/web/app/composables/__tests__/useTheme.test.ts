import { describe, expect, it } from "vitest";
import { resolveDark } from "../useTheme";

describe("resolveDark", () => {
  it("follows the device when set to system", () => {
    expect(resolveDark("system", true)).toBe(true);
    expect(resolveDark("system", false)).toBe(false);
  });

  it("an explicit choice beats the device", () => {
    expect(resolveDark("light", true)).toBe(false);
    expect(resolveDark("dark", false)).toBe(true);
  });
});
