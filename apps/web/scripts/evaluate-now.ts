// Sanity check bridging Phase 1 (ingestion) and Phase 3 (engine).
// Run with: npm run engine:evaluate
import { evaluateToday } from "../server/utils/trainingData";

async function main() {
  const result = await evaluateToday();
  console.log(JSON.stringify(result, null, 2));
}

main();
