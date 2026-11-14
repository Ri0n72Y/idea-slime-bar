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
    const d = Math.min(12, free[E("Hydro")], free[E("Electro")]);
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
      const d = Math.min(12, free[E("Dendro")]);
      free[E("Dendro")] -= d;
      addProduct(reaction, "燃烧", d, events);
      if (free[E("Dendro")] <= EPS) reaction.burning = false;
    }
  }
}

/** Source quantities are frozen before propagation; swirl has no Products entry. */
function swirl(free: Vector, reaction: ReactionState, events: string[]): number {
  const wind = E("Anemo");
  let remaining = Math.floor((free[wind] + EPS) / 30);
  if (remaining <= 0) return 0;
  let net = 0;
  const sources: Element[] = reaction.charged ? ["Electro", "Fire", "Hydro", "Cryo"] : ["Electro", "Fire", "Hydro", "Cryo"];
  const primary = sources.find(x => free[E(x)] >= 15 - EPS);
  if (!primary) return 0;
  const priorElectro = free[E("Electro")];
  const priorHydro = free[E("Hydro")];
  const doubleCandidate = primary === "Electro" && reaction.charged && priorHydro >= 15 - EPS &&
    0.5 * remaining > 0.8 * (priorElectro / 30); // strictly greater
  const run = (source: Element) => {
    const i = E(source);
    const sourceU = free[i] / 30;
    const d = 0.5 * Math.floor((Math.min(sourceU, 0.5 * remaining) + EPS) / 0.5);
    if (d < 0.5) return { spent: 0, exhausted: false };
    const windSpent = 2 * d;
    const R = Math.min(0.8 * sourceU, 0.5 * remaining);
    const gainU = 0.8 * (1 + 1.25 * (R - 0.04));
    const sourceLeft = free[i] - d * 30;
    free[i] = Math.max(0, sourceLeft);
    const exhausted = free[i] <= EPS; // check before propagation
    free[wind] = Math.max(0, free[wind] - windSpent * 30);
    free[i] += gainU * 30;
    remaining -= windSpent;
    const change = (gainU - d) * 30;
    net += change;
    events.push(`风扩散：${source}（净变 ${change.toFixed(2)}G）`);
    return { spent: windSpent, exhausted };
  };
  const first = run(primary);
  if (doubleCandidate && first.spent > 0 && first.exhausted && remaining >= 1 && priorHydro >= 15 - EPS) {
    run("Hydro");
  }
  return net;
}

/** Process only real new natural reproductive Growth, never old free inventory on empty ticks. */
export function reactGrowth(free: Vector, reaction: ReactionState, newGrowth: Vector, events: string[]): number {
  const candidates = preference.filter(el => newGrowth[E(el)] > EPS && free[E(el)] > 30 + EPS);
  let windNet = 0;
  if (candidates.includes("Anemo")) windNet = swirl(free, reaction, events);
  for (const active of candidates) {
    if (active === "Anemo") continue;
    const ai = E(active);
    // SRP is finite and only this natural-Growth active may spend its 30G shares.
    for (let attempts = 0; attempts < 128 && free[ai] > 30 + EPS; attempts++) {
      const products = reaction.products;
      const consume = (target: Element, cost: number, kind: string) => {
        if (free[ai] <= 30 + EPS || free[E(target)] + EPS < cost) return false;
        free[ai] = Math.max(0, free[ai] - 30);
        free[E(target)] = Math.max(0, free[E(target)] - cost);
        addProduct(reaction, kind, 30 + cost, events);
        return true;
      };
      const progress = (source: string, result: string, spend: boolean): boolean => {
        const mass = products[source] ?? 0;
        if (mass <= EPS) return false;
        if (spend) products[source] = 0;
        free[ai] -= 30;
        addProduct(reaction, result, spend ? mass + 30 : 30, events);
        return true;
      };
      const charged = () => {
        if (reaction.charged || free[E("Hydro")] < 12 || free[E("Electro")] < 12) return false;
        reaction.charged = true;
        free[E("Hydro")] -= 12; free[E("Electro")] -= 12;
        addProduct(reaction, "感电", 24, events);
        return true;
      };
      const burning = () => {
        if (reaction.burning || free[E("Fire")] <= EPS || free[E("Dendro")] <= EPS) return false;
        reaction.burning = true;
        const d = Math.min(12, free[E("Dendro")]);
        free[E("Dendro")] -= d;
        addProduct(reaction, "燃烧", d, events);
        if (free[E("Dendro")] <= EPS) reaction.burning = false;
        return true;
      };
      let completed = false;
      if (active === "Fire") {
        completed = progress("草原核", "烈绽放", true) ||
          consume("Electro", 30, "超载") || consume("Hydro", 15, "逆蒸发") ||
          consume("Cryo", 60, "正融化");
        if (!completed) { burning(); break; }
      } else if (active === "Hydro") {
        completed = consume("Fire", 60, "正蒸发") || consume("Cryo", 30, "冻结") ||
          consume("Dendro", 15, "草原核");
        if (!completed) { charged(); break; }
      } else if (active === "Dendro") {
        completed = progress("激元素", "蔓激化", false) ||
          consume("Electro", 30, "激元素");
        if (!completed && burning()) break;
        if (!completed) completed = consume("Hydro", 60, "草原核");
      } else if (active === "Electro") {
        completed = progress("草原核", "超绽放", true) ||
          progress("激元素", "超激化", false) || consume("Fire", 30, "超载");
        if (!completed && charged()) break;
        if (!completed) completed = consume("Cryo", 30, "超导") || consume("Dendro", 30, "激元素");
      } else if (active === "Cryo") {
        completed = consume("Electro", 30, "超导") || consume("Fire", 15, "逆融化") ||
          consume("Hydro", 30, "冻结");
      } else if (active === "Geo") {
        completed = consume("Electro", 15, "雷结晶") || consume("Fire", 15, "火结晶") ||
          consume("Hydro", 15, "水结晶") || consume("Cryo", 15, "冰结晶");
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