import { BALANCE } from "./balance.ts";
import { ELEMENTS, elementIndex, vectorSum, zeros, type Element, type Vector } from "./config.ts";

export type ReactionState = {
  products: Record<string, number>;
  firstReaction: string | null;
  charged: boolean;
  burning: boolean;
};
export const newReactionState = (): ReactionState => ({
  products: {}, firstReaction: null, charged: false, burning: false,
});
const E = (name: Element) => elementIndex(name);
const EPS = 1e-8;
const R = BALANCE.reactions;
const preference: Element[] = ["Electro", "Fire", "Anemo", "Cryo", "Hydro", "Dendro", "Geo"];

export function productAmount(reaction: ReactionState): number {
  return Object.values(reaction.products).reduce((sum, value) => sum + value, 0);
}
export function reproductiveMass(free: Vector, reaction: ReactionState): number {
  return vectorSum(free) + productAmount(reaction);
}
function addProduct(reaction: ReactionState, kind: string, mass: number, events: string[]) {
  if (mass <= EPS) return;
  reaction.products[kind] = (reaction.products[kind] ?? 0) + mass;
  reaction.firstReaction ??= kind;
  events.push(`元素反应：${kind}（${mass.toFixed(2)}G）`);
}

/** One tick of an already active continuous reaction; never starts one from old stock. */
export function advanceSustained(free: Vector, reaction: ReactionState, events: string[]): void {
  if (reaction.charged) {
    const d = Math.min(R.sustainedChargedPerUH, free[E("Hydro")], free[E("Electro")]);
    if (d > EPS) {
      free[E("Hydro")] -= d;
      free[E("Electro")] -= d;
      addProduct(reaction, "感电", 2 * d, events);
    }
    if (free[E("Hydro")] <= EPS || free[E("Electro")] <= EPS) reaction.charged = false;
  }
  if (reaction.burning) {
    if (free[E("Fire")] <= EPS || free[E("Dendro")] <= EPS) reaction.burning = false;
    else {
      const d = Math.min(R.sustainedBurningPerUH, free[E("Dendro")]);
      free[E("Dendro")] -= d;
      addProduct(reaction, "燃烧", d, events);
      if (free[E("Dendro")] <= EPS) reaction.burning = false;
    }
  }
}

/** Source quantities are frozen before propagation; swirl has no Products entry. */
function swirl(free: Vector, reaction: ReactionState, events: string[]): number {
  const wind = E("Anemo");
  let remaining = Math.floor((free[wind] + EPS) / R.swirlUnitG);
  if (remaining <= 0) return 0;
  let net = 0;
  const sources: Element[] = ["Electro", "Fire", "Hydro", "Cryo"];
  const primary = sources.find(x => free[E(x)] >= R.swirlAuraThresholdG - EPS);
  if (!primary) return 0;
  const priorElectro = free[E("Electro")];
  const priorHydro = free[E("Hydro")];
  const doubleCandidate = primary === "Electro" && reaction.charged && priorHydro >= R.swirlAuraThresholdG - EPS &&
    R.swirlSourceFraction * remaining > R.swirlDoubleThreshold * (priorElectro / R.swirlUnitG); // strictly greater
  const run = (source: Element) => {
    const i = E(source);
    const sourceU = free[i] / R.swirlUnitG;
    const d = R.swirlSourceFraction *
      Math.floor((Math.min(sourceU, R.swirlSourceFraction * remaining) + EPS) / R.swirlSourceFraction);
    if (d < R.swirlSourceFraction) return { spent: 0, exhausted: false };
    const windSpent = d / R.swirlSourceFraction;
    const sourceStrength = R.swirlSourceStrength * sourceU;
    // The propagation threshold uses half the remaining wind, but the strength
    // is the FULL remaining wind when that threshold is reached (§4).
    const reach = sourceStrength >= R.swirlPropagationThreshold * remaining ? remaining : sourceStrength;
    const gainU = BALANCE.reactions.swirlGainBase *
      (1 + BALANCE.reactions.swirlGainScale * (reach - BALANCE.reactions.swirlGainOffset));
    const sourceLeft = free[i] - d * BALANCE.reactions.swirlUnitG;
    free[i] = Math.max(0, sourceLeft);
    const exhausted = free[i] <= EPS; // check before propagation
    free[wind] = Math.max(0, free[wind] - windSpent * BALANCE.reactions.swirlUnitG);
    free[i] += gainU * BALANCE.reactions.swirlUnitG;
    remaining -= windSpent;
    // Includes both the source net gain and the Anemo spent. The caller
    // records the change to the fruit's total G, not only the propagated aura.
    const totalMassChange = (gainU - d - windSpent) * BALANCE.reactions.swirlUnitG;
    net += totalMassChange;
    events.push(`风扩散：${source}（总物质量净变 ${totalMassChange.toFixed(2)}G）`);
    return { spent: windSpent, exhausted };
  };
  const first = run(primary);
  if (doubleCandidate && first.spent > 0 && first.exhausted && remaining >= 1 && priorHydro >= R.swirlAuraThresholdG - EPS) {
    run("Hydro");
  }
  return net;
}

/** Process only real new natural reproductive Growth, never old free inventory on empty ticks. */
export function reactGrowth(free: Vector, reaction: ReactionState, newGrowth: Vector, events: string[]): number {
  const candidates = preference.filter(el => newGrowth[E(el)] > EPS && free[E(el)] > R.activeThresholdG + EPS);
  let windNet = 0;
  if (candidates.includes("Anemo")) windNet = swirl(free, reaction, events);
  for (const active of candidates) {
    if (active === "Anemo") continue;
    const ai = E(active);
    // SRP is finite and only this natural-Growth active may spend its 30G shares.
    for (let attempts = 0; attempts < 128 && free[ai] > R.activeThresholdG + EPS; attempts++) {
      const products = reaction.products;
      const consume = (target: Element, cost: number, kind: string) => {
        if (free[ai] <= R.activeThresholdG + EPS || free[E(target)] + EPS < cost) return false;
        free[ai] = Math.max(0, free[ai] - R.activeSpendG);
        free[E(target)] = Math.max(0, free[E(target)] - cost);
        addProduct(reaction, kind, R.activeSpendG + cost, events);
        return true;
      };
      const progress = (source: string, result: string, spend: boolean): boolean => {
        const mass = products[source] ?? 0;
        if (mass <= EPS) return false;
        if (spend) products[source] = 0;
        free[ai] -= R.activeSpendG;
        addProduct(reaction, result, spend ? mass + R.activeSpendG : R.activeSpendG, events);
        return true;
      };
      const charged = () => {
        if (reaction.charged || free[E("Hydro")] < R.chargedStartupG || free[E("Electro")] < R.chargedStartupG) return false;
        reaction.charged = true;
        free[E("Hydro")] -= R.chargedStartupG; free[E("Electro")] -= R.chargedStartupG;
        addProduct(reaction, "感电", 2 * R.chargedStartupG, events);
        return true;
      };
      const burning = () => {
        if (reaction.burning || free[E("Fire")] <= EPS || free[E("Dendro")] <= EPS) return false;
        reaction.burning = true;
        const d = Math.min(R.burningStartupG, free[E("Dendro")]);
        free[E("Dendro")] -= d;
        addProduct(reaction, "燃烧", d, events);
        if (free[E("Dendro")] <= EPS) reaction.burning = false;
        return true;
      };
      let completed = false;
      if (active === "Fire") {
        completed = progress("草原核", "烈绽放", true) ||
          consume("Electro", R.pairCosts.Fire.Electro, "超载") || consume("Hydro", R.pairCosts.Fire.Hydro, "逆蒸发") ||
          consume("Cryo", R.pairCosts.Fire.Cryo, "正融化");
        if (!completed) { burning(); break; }
      } else if (active === "Hydro") {
        completed = consume("Fire", R.pairCosts.Hydro.Fire, "正蒸发") || consume("Cryo", R.pairCosts.Hydro.Cryo, "冻结") ||
          consume("Dendro", R.pairCosts.Hydro.Dendro, "草原核");
        if (!completed) { charged(); break; }
      } else if (active === "Dendro") {
        completed = progress("激元素", "蔓激化", false) ||
          consume("Electro", R.pairCosts.Dendro.Electro, "激元素");
        if (!completed && burning()) break;
        if (!completed) completed = consume("Hydro", R.pairCosts.Dendro.Hydro, "草原核");
      } else if (active === "Electro") {
        completed = progress("草原核", "超绽放", true) ||
          progress("激元素", "超激化", false) || consume("Fire", R.pairCosts.Electro.Fire, "超载");
        if (!completed && charged()) break;
        if (!completed) completed = consume("Cryo", R.pairCosts.Electro.Cryo, "超导") || consume("Dendro", R.pairCosts.Electro.Dendro, "激元素");
      } else if (active === "Cryo") {
        completed = consume("Electro", R.pairCosts.Cryo.Electro, "超导") || consume("Fire", R.pairCosts.Cryo.Fire, "逆融化") ||
          consume("Hydro", R.pairCosts.Cryo.Hydro, "冻结");
      } else if (active === "Geo") {
        completed = consume("Electro", R.pairCosts.Geo.Electro, "雷结晶") || consume("Fire", R.pairCosts.Geo.Fire, "火结晶") ||
          consume("Hydro", R.pairCosts.Geo.Hydro, "水结晶") || consume("Cryo", R.pairCosts.Geo.Cryo, "冰结晶");
      }
      if (!completed) break;
    }
  }
  for (let i = 0; i < ELEMENTS.length; i++) free[i] = Math.max(0, free[i]);
  return windNet;
}

/** Deterministic reaction test fixture: a newly applied vector on a mature fruit. */
export function applyNaturalGrowth(free: Vector, reaction: ReactionState, growth: Vector, events: string[]): number {
  for (let i = 0; i < 7; i++) free[i] += growth[i];
  return reactGrowth(free, reaction, growth, events);
}
export { zeros };