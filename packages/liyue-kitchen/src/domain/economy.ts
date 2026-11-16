import type { GameState, PlotId } from "./game.ts";

/** Playtest candidates; final reward and land costs require Lead approval. */
export const ECONOMY_CANDIDATE = Object.freeze({
  growthCycle: 6,
  matureHarvest: 2,
  orderDelivery: 16,
  plotCosts: { P02: 8, P03: 16, P04: 24, P05: 32, P06: 40, P07: 48 },
});
export type EnergyAccount = {
  balance: number;
  earnedTotal: number;
  spentTotal: number;
  rewardedIds: string[];
};
export const newEnergyAccount = (): EnergyAccount =>
  ({ balance: 0, earnedTotal: 0, spentTotal: 0, rewardedIds: [] });

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
  plot.open = true;
  return { ok: true, cost };
}
