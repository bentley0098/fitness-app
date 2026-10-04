import { garmin } from "./garmin";
import { SupabaseTokenStorage } from "./garminTokenStorage";
import { finiteNumber } from "./garminValues";

// VO2 max and race predictions live on Garmin's metrics-service endpoints,
// which garmin-connect-sdk doesn't expose (and its HttpClient is private).
// They're plain read-only GETs, so this reuses the SDK's own stored access
// token to call them directly.
//
// These are undocumented endpoints and can change without notice — callers
// treat any failure here as non-fatal (null + a reported error), never as a
// reason to abort the rest of the sync.
type Raw = Record<string, any>;

const BASE_URL = "https://connectapi.garmin.com";
const REFRESH_MARGIN_MS = 2 * 60_000;

const tokenStorage = new SupabaseTokenStorage();

async function accessToken(): Promise<string> {
  const restored = await garmin.restoreSession();
  if (!restored) throw new Error("No stored Garmin session — run `npm run garmin:login` first.");

  let tokens = await tokenStorage.load();
  // The SDK only refreshes the token when it makes an authenticated request of
  // its own, so make a cheap one if ours is about to expire.
  if (!tokens || Date.parse(tokens.accessTokenExpiresAt) - Date.now() < REFRESH_MARGIN_MS) {
    await garmin.user.getProfile();
    tokens = await tokenStorage.load();
  }
  if (!tokens) throw new Error("Garmin token missing after refresh.");
  return tokens.accessToken;
}

async function garminGet(path: string): Promise<unknown> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { authorization: `Bearer ${await accessToken()}`, accept: "application/json" },
  });
  if (!response.ok) throw new Error(`GET ${path} → ${response.status}`);
  return response.status === 204 ? null : response.json();
}

/** ISO date → precise VO2 max, for the days Garmin recomputed it in the range. */
export function parseMaxMetrics(payload: unknown): Map<string, number> {
  const out = new Map<string, number>();
  const entries: Raw[] = Array.isArray(payload) ? payload : [];
  for (const entry of entries) {
    const generic: Raw = entry?.generic ?? {};
    const date: unknown = generic.calendarDate;
    // vo2MaxPreciseValue is what Garmin Connect's trend chart plots;
    // vo2MaxValue is the same number rounded to an integer.
    const vo2 = finiteNumber(generic.vo2MaxPreciseValue ?? generic.vo2MaxValue);
    if (typeof date === "string" && vo2 != null && vo2 > 0) out.set(date.slice(0, 10), vo2);
  }
  return out;
}

export async function fetchVo2MaxByDay(startDate: string, endDate: string): Promise<Map<string, number>> {
  return parseMaxMetrics(await garminGet(`/metrics-service/metrics/maxmet/daily/${startDate}/${endDate}`));
}

export interface RacePredictionColumns {
  date: string;
  time_5k_s: number | null;
  time_10k_s: number | null;
  time_half_s: number | null;
  time_marathon_s: number | null;
}

export function parseRacePredictions(payload: unknown): RacePredictionColumns | null {
  const p = (payload ?? {}) as Raw;
  if (typeof p.calendarDate !== "string") return null;
  const positive = (v: unknown) => {
    const n = finiteNumber(v);
    return n != null && n > 0 ? n : null;
  };
  const row: RacePredictionColumns = {
    date: p.calendarDate.slice(0, 10),
    time_5k_s: positive(p.time5K),
    time_10k_s: positive(p.time10K),
    time_half_s: positive(p.timeHalfMarathon),
    time_marathon_s: positive(p.timeMarathon),
  };
  return row.time_5k_s || row.time_10k_s || row.time_half_s || row.time_marathon_s ? row : null;
}

export async function fetchRacePredictions(): Promise<RacePredictionColumns | null> {
  // The path wants the account's display name, but Garmin answers for the
  // authenticated user regardless of the value, so a placeholder is enough
  // and saves a profile round trip.
  return parseRacePredictions(await garminGet("/metrics-service/metrics/racepredictions/latest/me"));
}
