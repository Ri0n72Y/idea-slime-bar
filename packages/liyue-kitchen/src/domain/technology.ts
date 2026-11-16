import type { GameState } from "./game.ts";
import type { Element } from "./config.ts";
export const COLLECT_BAG = { id: "collectBag", title: "收集袋", cost: 12, manualRequired: 3 } as const;
export type TechnologyRecord = { unlockedAtDay: number; evidenceIds: string[] };
export type LaborRecord = { manualBallIds: string[]; wateredElements: Element[] };
export const newLabor = (): LaborRecord => ({ manualBallIds: [], wateredElements: [] });
export const newTechnology = (): { collectBag: TechnologyRecord | null } => ({ collectBag: null });
/** The collector is a real command, not a source of additional V or N. */
export function purchaseCollectBag(state: GameState):
  { ok: true; cost: number } | { ok: false; reason: string } {
  if (state.technology.collectBag) return { ok: false, reason: "收集袋已经解锁，不重复扣费。" };
  if (state.labor.manualBallIds.length < COLLECT_BAG.manualRequired ||
      !state.discoveries.A18) return { ok: false, reason: "请先亲手收集三枚不同元素球。" };
  if (state.adeptalEnergy.balance < COLLECT_BAG.cost)
    return { ok: false, reason: `洞天仙力不足，收集袋需 ${COLLECT_BAG.cost}。` };
  state.adeptalEnergy.balance -= COLLECT_BAG.cost;
  state.adeptalEnergy.spentTotal += COLLECT_BAG.cost;
  state.technology.collectBag = {
    unlockedAtDay: state.day, evidenceIds: [...state.labor.manualBallIds],
  };
  return { ok: true, cost: COLLECT_BAG.cost };
}
