import { BALANCE } from "./balance.ts";
import type { GameState, PlotId } from "./game.ts";

/** Compatibility alias, values are read from the single balance file. */
export const ECONOMY_CANDIDATE = BALANCE.economy;
export type EnergyAccount = {
  balance: number;
  earnedTotal: number;
  spentTotal: number;
  /** Recorded actual purchase prices; never recompute historical spend from current config. */
  spendLedger: Record<string, number>;
  rewardedIds: string[];
};
export const newEnergyAccount = (): EnergyAccount =>
  ({ balance: 0, earnedTotal: 0, spentTotal: 0, spendLedger: {}, rewardedIds: [] });

/** Mutates an applyCommand-local state only; repeated source keys never mint energy. */
export function rewardEnergy(state: GameState, sourceId: string, amount: number): boolean {
  if (!Number.isSafeInteger(amount) || amount <= 0 ||
      !sourceId || state.adeptalEnergy.rewardedIds.includes(sourceId)) return false;
  const energy = state.adeptalEnergy;
  energy.balance += amount;
  energy.earnedTotal += amount;
  energy.rewardedIds.push(sourceId);
  return true;
}
export function unlockPlot(state: GameState, plotId: PlotId):
  { ok: true; cost: number } | { ok: false; reason: string } {
  const cost = ECONOMY_CANDIDATE.plotCosts[plotId as keyof typeof ECONOMY_CANDIDATE.plotCosts];
  const plot = Object.hasOwn(state.plots, plotId) ? state.plots[plotId] : null;
  if (!plot || cost === undefined) return { ok: false, reason: "该地格无需开垦或地格不存在。" };
  if (plot.open) return { ok: false, reason: "该地格已经开垦，不能重复消费仙力。" };
  if (state.adeptalEnergy.balance < cost)
    return { ok: false, reason: `洞天仙力不足，${plotId} 需 ${cost}，当前 ${state.adeptalEnergy.balance}。` };
  state.adeptalEnergy.balance -= cost;
  state.adeptalEnergy.spentTotal += cost;
  state.adeptalEnergy.spendLedger["plot:" + plotId] = cost;
  plot.open = true;
  return { ok: true, cost };
}
