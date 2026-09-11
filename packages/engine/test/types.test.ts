import { describe, expect, it } from "vitest";
import type { Verdict } from "../src/index.js";

describe("engine package scaffold", () => {
  it("exposes the Verdict union", () => {
    const verdicts: Verdict[] = ["progress", "hold", "regress", "stop"];
    expect(verdicts).toHaveLength(4);
  });
});
