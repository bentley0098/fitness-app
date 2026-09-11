// Seeds engine_params v1 with sports-science defaults — see
// adaptive-training-plan-spec.md Section 4/5 for the rationale (workload
// ratio bands, the 10%-rule volume cap). Self-authored, not physio-supplied;
// safe to run before any physio input exists. Run with: npm run engine:seed
import { db } from "../server/utils/db";

async function main() {
  const { data: existing } = await db.from("engine_params").select("id").order("version", { ascending: false }).limit(1);
  if (existing?.length) {
    console.log("engine_params already has a row — not overwriting. Delete it first if you want to reseed.");
    return;
  }

  const { error } = await db.from("engine_params").insert({
    version: 1,
    workload_ratio_sweet_spot_min: 0.8,
    workload_ratio_sweet_spot_max: 1.3,
    workload_ratio_danger_zone: 1.5,
    weekly_volume_increase_cap_pct: 10,
    consecutive_clean_weeks_to_progress: 2,
    consecutive_clean_weeks_to_unlock_phase: 3,
    resting_hr_spike_threshold: 5,
    body_battery_floor: 25,
    reassessment_interval_days: 14,
  });

  if (error) throw new Error(`Seed failed: ${error.message}`);
  console.log("engine_params v1 seeded.");
}

main();
