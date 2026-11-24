/** Sole edit point for approved numeric tuning: balance.config.json.
 * This module validates the data before any domain model can import it.
 */
import raw from "./balance.config.json" with { type: "json" };

export type BalanceConfig = typeof raw;
const object = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);
const lookup = (o: unknown, path: string): unknown =>
  path.split(".").reduce<unknown>((cur, key) => object(cur) ? cur[key] : undefined, o);
const requireNumber = (o: unknown, path: string, min: number, max: number,
  integer = false): number => {
  const value = lookup(o, path);
  if (typeof value !== "number" || !Number.isFinite(value) ||
      value < min || value > max || (integer && !Number.isSafeInteger(value)))
    throw new Error(`Invalid balance config ${path}: expected ${integer ? "integer" : "number"} in [${min}, ${max}]`);
  return value;
};
function assertVector(o: unknown, path: string) {
  const value = lookup(o, path);
  if (!Array.isArray(value) || value.length !== 7 ||
      value.some(v => typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 100))
    throw new Error(`Invalid balance config ${path}: expected seven nonnegative finite affinities`);
}
const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === "object") {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};
/** Public for validation of a complete alternative config without mutating live gameplay. */
export function validateBalanceConfig(candidate: unknown): Readonly<BalanceConfig> {
  const fruitJuiceMl = requireNumber(candidate, "processing.fruitJuiceMl", 1, 1e7, true);
  const cupMl = requireNumber(candidate, "processing.cupMl", 1, fruitJuiceMl, true);
  if (fruitJuiceMl % cupMl !== 0) throw new Error("Invalid balance config: juice must divide into whole cups");
  const positives = [
    "world.ballInitialV", "world.ballHalfLifeUH", "world.ballMinimumCollectV",
    "world.soilCapacityV", "world.reserveCapacityV", "world.reserveBudgetVPerUH",
    "growth.reserveCurveWidthV", "growth.rootReserveSpanV", "growth.rootSoilScaleV",
    "growth.rootBudgetLogBase", "growth.seedlingThresholdG", "growth.saplingThresholdG",
    "growth.budThresholdG", "growth.largeLeafThresholdG", "growth.flowerThresholdG",
    "growth.greenFruitThresholdG", "growth.matureFruitThresholdG",
    "growth.treeCycleThresholdG", "growth.matureEnrichmentMassCeilingG",
    "growth.matureEnrichmentWindowG", "reactions.activeThresholdG",
    "reactions.activeSpendG", "reactions.sustainedChargedPerUH",
    "reactions.sustainedBurningPerUH", "reactions.chargedStartupG",
    "reactions.burningStartupG", "reactions.swirlUnitG",
    "reactions.swirlAuraThresholdG"
  ];
  for (const path of positives) requireNumber(candidate, path, 1e-8, 1e9);
  const integers = [
    "world.condensesPerDay", "world.nightUH", "growth.maxLeaves",
    "growth.budCheckPeriodUH", "orders.firstWindowDays",
    "orders.renewalWindowDays", "orders.quantity", "economy.growthCycle",
    "economy.matureHarvest", "economy.orderDelivery", "technology.collectBagCost",
    "technology.manualRequired", "technology.wateredElementsRequired",
    "visitors.arrivalDay", "visitors.rewards.greet", "visitors.rewards.clue",
    "visitors.rewards.thank"
  ];
  for (const path of integers) requireNumber(candidate, path, 1, 1e7, true);
  for (const path of [
    "economy.plotCosts.P02", "economy.plotCosts.P03", "economy.plotCosts.P04",
    "economy.plotCosts.P05", "economy.plotCosts.P06", "economy.plotCosts.P07"])
    requireNumber(candidate, path, 1, 1e7, true);
  for (const path of [
    "growth.inheritanceWeight", "growth.rootChannelShare",
    "growth.leafBudgetShare", "growth.youngFruitShare", "growth.matureFruitShare",
    "growth.matureEnrichmentScale", "growth.largeLeafEfficiency",
    "growth.largeLeafEnvironmentalLoss", "reactions.swirlSourceFraction",
    "reactions.swirlSourceStrength", "reactions.swirlPropagationThreshold",
    "reactions.swirlGainBase", "reactions.swirlDoubleThreshold",
    "world.soilRetentionPerUH"])
    requireNumber(candidate, path, 0, 1);
  for (const path of [
    "growth.reserveCurveMidpointV", "growth.rootReserveSoftStartV",
    "reactions.swirlGainScale", "reactions.swirlGainOffset"])
    requireNumber(candidate, path, 0, 1e9);
  for (const stage of ["Seed", "Seedling", "Sapling"])
    requireNumber(candidate, `growth.rootCap.${stage}`, 1e-8, 1e6);
  for (const path of ["rootPreference", "treeBase", "leafTemplate", "fruitTemplate"])
    assertVector(candidate, `affinity.${path}`);
  requireNumber(candidate, "technology.manualRequired", 1, 100, true);
  requireNumber(candidate, "technology.wateredElementsRequired", 1, 7, true);
  const probs = lookup(candidate, "growth.budChanceByLeafCount");
  const maxLeaves = requireNumber(candidate, "growth.maxLeaves", 1, 12, true);
  if (!Array.isArray(probs) || probs.length !== maxLeaves + 1 ||
      probs.some(n => typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > 1))
    throw new Error("Invalid balance config growth.budChanceByLeafCount");
  if (requireNumber(candidate, "growth.budCheckHourUH", 0, 1e7, true) >=
      requireNumber(candidate, "growth.budCheckPeriodUH", 1, 1e7, true))
    throw new Error("Invalid balance config: bud check hour must be less than period");
  if (requireNumber(candidate, "world.ballMinimumCollectV", 1e-8, 1e9) >
      requireNumber(candidate, "world.ballInitialV", 1e-8, 1e9))
    throw new Error("Invalid balance config: ball threshold exceeds initial value");
  if (requireNumber(candidate, "growth.leafBudgetShare", 0, 1) * maxLeaves > 1)
    throw new Error("Invalid balance config: leaf budgets exceed available reserve");
  if (Math.abs(requireNumber(candidate, "growth.largeLeafEfficiency", 0, 1) +
      requireNumber(candidate, "growth.largeLeafEnvironmentalLoss", 0, 1) - 1) > 1e-9)
    throw new Error("Invalid balance config: large-leaf efficiency + environmental loss must equal 1");
  if (requireNumber(candidate, "growth.rootBudgetLogBase", 1e-8, 1e9) <= 1)
    throw new Error("Invalid balance config: root budget log base must exceed 1");
  if (requireNumber(candidate, "reactions.activeThresholdG", 1e-8, 1e9) <
      requireNumber(candidate, "reactions.activeSpendG", 1e-8, 1e9))
    throw new Error("Invalid balance config: reaction active threshold must cover its spend");
  if (requireNumber(candidate, "reactions.swirlSourceFraction", 0, 1) <= 0)
    throw new Error("Invalid balance config: swirl source fraction must exceed zero");
  const capacity = requireNumber(candidate, "world.reserveCapacityV", 1e-8, 1e9);
  // Normalizing the sigmoid over [0, capacity] requires a resolvable
  // denominator. Extreme but otherwise legal midpoints can round both
  // endpoints to exactly zero (or one) and produce 0/0 -> NaN in growth.
  const midpoint = requireNumber(candidate, "growth.reserveCurveMidpointV", 0, 1e9);
  const width = requireNumber(candidate, "growth.reserveCurveWidthV", 1e-8, 1e9);
  const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
  const range = sigmoid((capacity - midpoint) / width) - sigmoid(-midpoint / width);
  if (!(range > 1e-12))
    throw new Error("Invalid balance config: reserve S curve cannot be normalized across reserve capacity");
  const soft = requireNumber(candidate, "growth.rootReserveSoftStartV", 0, 1e9);
  const span = requireNumber(candidate, "growth.rootReserveSpanV", 1e-8, 1e9);
  if (Math.abs(capacity - soft - span) > 1e-7)
    throw new Error("Invalid balance config: root reserve span must equal capacity - soft start");
  for (const [start, end] of [
    ["growth.seedlingThresholdG", "growth.saplingThresholdG"],
    ["growth.flowerThresholdG", "growth.greenFruitThresholdG"],
    ["growth.greenFruitThresholdG", "growth.matureFruitThresholdG"]
  ]) {
    if (requireNumber(candidate, start, 1e-8, 1e9) >=
        requireNumber(candidate, end, 1e-8, 1e9))
      throw new Error(`Invalid balance config: ${start} must be less than ${end}`);
  }
  const expectedPairs: Record<string, string[]> = {
    Fire: ["Electro", "Hydro", "Cryo"],
    Hydro: ["Fire", "Cryo", "Dendro"],
    Dendro: ["Electro", "Hydro"],
    Electro: ["Fire", "Cryo", "Dendro"],
    Cryo: ["Electro", "Fire", "Hydro"],
    Geo: ["Electro", "Fire", "Hydro", "Cryo"],
  };
  for (const [active, targets] of Object.entries(expectedPairs))
    for (const target of targets)
      requireNumber(candidate, `reactions.pairCosts.${active}.${target}`, 1e-8, 1e9);
  const b = structuredClone(candidate) as BalanceConfig;
  return deepFreeze(b);
}

export const BALANCE = validateBalanceConfig(raw);
