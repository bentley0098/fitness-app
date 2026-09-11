// One-time interactive bootstrap. Run with: npm run garmin:login
// Persists tokens to the garmin_tokens table so the sync cron can restore
// the session indefinitely (via refresh) without ever holding a password.
import { garmin } from "../server/utils/garmin";

async function main() {
  const email = process.env.GARMIN_EMAIL;
  const password = process.env.GARMIN_PASSWORD;
  const mfaCode = process.env.GARMIN_MFA_CODE;

  if (!email || !password) {
    console.error("Set GARMIN_EMAIL and GARMIN_PASSWORD in apps/web/.env first.");
    process.exit(1);
  }

  try {
    await garmin.login({ email, password, mfaCode });
    console.log("Garmin login succeeded — tokens saved to garmin_tokens.");
  } catch (err) {
    const isMfa = err instanceof Error && err.constructor.name === "GarminMfaRequiredError";
    if (isMfa) {
      console.log("Garmin requires an MFA code — check email / the Garmin Connect app, then rerun:");
      console.log("  GARMIN_MFA_CODE=123456 npm run garmin:login");
      process.exit(2);
    }
    throw err;
  }
}

main();
