/** Reproducible candidate simulation. Calls the actual U2 commands for N≤8,
 * and the production advancePlotOneUH integrator for K variations.
 * K=24 additionally exercises the full real CONFIRM_END_DAY path.
 * This script is NOT a gameplay config approval.
 */
import { applyCommand, newGame, nextRandom, type GameState } from "../src/domain/game.ts";
import { advancePlotOneUH, newLedger } from "../src/domain/growth.ts";
import { ORDER_CANDIDATE } from "../src/domain/orders.ts";
import { ECONOMY_CANDIDATE } from "../src/domain/economy.ts";

type Candidate = { N: number; K: number };
type Result = Candidate & { seed: number; matureDay: number | null };
const SEEDS = Array.from({ length: 8 }, (_, i) => (0x17a5b7e1 + i * 1009) >>> 0);
const CANDIDATES: Candidate[] = [{ N: 4, K: 12 }, { N: 4, K: 24 },
  { N: 8, K: 12 }, { N: 8, K: 24 }];
const MAX_DAYS = 110;

function run(seed: number, { N, K }: Candidate): Result {
  let g: GameState = applyCommand(newGame(seed),
    { type: "PLANT_SEED", itemId: "item:seed:1", plotId: "P01" });
  for (let d = 1; d <= MAX_DAYS; d++) {
    // Generate, collect and water real 50V balls via the U2 command path.
    for (let n = 0; n < N; n++) {
      g = applyCommand(g, { type: "CONDENSE" });
      const ball = Object.values(g.looseBalls).at(-1);
      if (!ball) throw new Error("Condense failed");
      g = applyCommand(g, { type: "COLLECT_BALL", ballId: ball.id });
      g = applyCommand(g, { type: "WATER_PLOT", plotId: "P01", element: ball.element });
    }
    if (K === 24) {
      g = applyCommand(g, { type: "REQUEST_END_DAY" });
      g = applyCommand(g, { type: "CONFIRM_END_DAY", expectedDay: g.day });
    } else {
      // Same integrator, one real model hour per step, respecting model-day 04:00.
      const ledger = newLedger();
      for (let h = 0; h < K; h++) {
        g.worldUH++;
        advancePlotOneUH(g.plots.P01, g.worldUH, () => nextRandom(g), [], ledger);
      }
      g.day++;
      g.dayCondenseUsed = 0;
    }
    if (g.plots.P01.plant?.leaves.some(l => l.fruit?.stage === "MatureFruit")) {
      return { N, K, seed, matureDay: g.day };
    }
  }
  return { N, K, seed, matureDay: null };
}
const results = CANDIDATES.flatMap(candidate => SEEDS.map(seed => run(seed, candidate)));
console.log("N,K,seed,mature_game_day");
for (const v of results)
  console.log(`${v.N},${v.K},${v.seed},${v.matureDay ?? "timeout"}`);
console.log("CANDIDATE_SUMMARY " + JSON.stringify(CANDIDATES.map(c => {
  const records = results.filter(x => x.N === c.N && x.K === c.K);
  const days = records.map(x => x.matureDay).filter((n): n is number => n !== null).sort((a,b) => a - b);
  const pct = (q: number) => days.length ? days[Math.ceil(q * days.length) - 1] : null;
  return { ...c, sample: records.length, completed: days.length,
    p50: pct(.5), p90: pct(.9), max: days.at(-1) ?? null,
    firstDeadlineDay: 1 + ORDER_CANDIDATE.firstWindowDays,
    deadlineSuccesses: records.filter(x => x.matureDay !== null &&
      x.matureDay <= 1 + ORDER_CANDIDATE.firstWindowDays).length,
    firstPlotCost: ECONOMY_CANDIDATE.plotCosts.P02 };
})));
