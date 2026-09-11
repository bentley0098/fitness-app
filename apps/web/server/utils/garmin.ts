import { GarminConnectSDK } from "garmin-connect-sdk";
import { SupabaseTokenStorage } from "./garminTokenStorage";

// Singleton: restoreSession() reads/refreshes tokens from garmin_tokens via
// SupabaseTokenStorage. Login only ever happens through the one-time
// bootstrap script (scripts/garmin-login.ts) — the app itself never asks
// Garmin for a password.
export const garmin = new GarminConnectSDK({
  storage: new SupabaseTokenStorage(),
});
