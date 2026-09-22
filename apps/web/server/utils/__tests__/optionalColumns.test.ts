import { describe, expect, it, vi } from "vitest";
import {
  ACTIVITY_OPTIONAL_KEYS,
  isMissingColumnError,
  selectTolerant,
  writeTolerant,
} from "../optionalColumns";

const missing = { code: "42703", message: "column activities.vo2_max does not exist" };
const messageOnly = { code: null, message: 'column "sleep_score" does not exist' };
const otherError = { code: "23505", message: "duplicate key value violates unique constraint" };

describe("isMissingColumnError", () => {
  it("matches PostgREST's undefined_column by code and by message", () => {
    expect(isMissingColumnError(missing)).toBe(true);
    expect(isMissingColumnError(messageOnly)).toBe(true);
  });

  it("does not swallow unrelated errors", () => {
    expect(isMissingColumnError(otherError)).toBe(false);
    expect(isMissingColumnError(null)).toBe(false);
  });
});

describe("selectTolerant", () => {
  it("uses the full column list when the schema is current", async () => {
    const run = vi.fn(async (cols: string) => ({ data: [{ cols }], error: null }));
    const result = await selectTolerant("activities", "a, b, vo2_max", "a, b", run);

    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith("a, b, vo2_max");
    expect(result.error).toBeNull();
  });

  it("retries with base columns when a column is missing", async () => {
    const run = vi.fn(async (cols: string) =>
      cols.includes("vo2_max") ? { data: null, error: missing } : { data: [{ cols }], error: null },
    );
    const result = await selectTolerant("activities", "a, b, vo2_max", "a, b", run);

    expect(run).toHaveBeenCalledTimes(2);
    expect(run).toHaveBeenLastCalledWith("a, b");
    expect(result.error).toBeNull();
    expect(result.data).toEqual([{ cols: "a, b" }]);
  });

  it("does not retry on an unrelated error", async () => {
    const run = vi.fn(async () => ({ data: null, error: otherError }));
    const result = await selectTolerant("activities", "a, vo2_max", "a", run);

    expect(run).toHaveBeenCalledTimes(1);
    expect(result.error).toBe(otherError);
  });

  // The degraded state must not be cached: a sticky flag would keep serving
  // reduced columns after the migration finally ran, until a redeploy.
  it("re-attempts the full list on every call", async () => {
    let schemaFixed = false;
    const run = vi.fn(async (cols: string) =>
      cols.includes("vo2_max") && !schemaFixed ? { data: null, error: missing } : { data: [{ cols }], error: null },
    );

    await selectTolerant("activities", "a, vo2_max", "a", run);
    schemaFixed = true;
    const after = await selectTolerant("activities", "a, vo2_max", "a", run);

    expect(after.data).toEqual([{ cols: "a, vo2_max" }]);
  });
});

describe("writeTolerant", () => {
  const row = { date: "2026-09-22", distance_m: 3000, vo2_max: 44, training_load: 61 };

  it("writes the full row when the schema is current", async () => {
    const run = vi.fn(async () => ({ error: null }));
    const result = await writeTolerant("activities", row, ACTIVITY_OPTIONAL_KEYS, run);

    expect(run).toHaveBeenCalledTimes(1);
    expect(result.degraded).toBe(false);
  });

  it("strips only the optional keys and keeps the rest of the write", async () => {
    const seen: Record<string, unknown>[] = [];
    const run = vi.fn(async (r: Record<string, unknown>) => {
      seen.push(r);
      return { error: "vo2_max" in r ? missing : null };
    });

    const result = await writeTolerant("activities", row, ACTIVITY_OPTIONAL_KEYS, run);

    expect(run).toHaveBeenCalledTimes(2);
    expect(result.error).toBeNull();
    expect(result.degraded).toBe(true);
    // The core data still lands — this is the point of the retry.
    expect(seen[1]).toEqual({ date: "2026-09-22", distance_m: 3000 });
  });
});
