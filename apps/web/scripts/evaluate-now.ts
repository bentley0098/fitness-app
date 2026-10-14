// Sanity check bridging Phase 1 (ingestion) and Phase 3 (engine).
// Run with: npm run engine:evaluate
import { today } from "../shared/utils/calendar";
import { evaluateToday } from "../server/utils/trainingData";

async function main() {
  const result = await evaluateToday(today(new Date()));
  console.log(JSON.stringify(result, null, 2));
}

main();
