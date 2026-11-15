/** Design values. N is a playtest candidate, not an approved balance decision. */
export const U2_CONFIG = Object.freeze({
  condensesPerDay: 8, // Candidate N: Lead must confirm after replayed trajectories.
  nightUH: 24, // Candidate K: preserves model-hour 04:00 once per 24uh.
  ballInitialV: 50,
  ballHalfLifeUH: 0.25,
  soilCapacityV: 1000,
  soilRetentionPerUH: 0.99,
  reserveCapacityV: 180,
  reserveBudgetVPerUH: 5.4,
});

export const ELEMENTS = ["Fire", "Hydro", "Anemo", "Electro", "Dendro", "Cryo", "Geo"] as const;
export type Element = (typeof ELEMENTS)[number];
export type Vector = [number, number, number, number, number, number, number];
export const ROOT_PREFERENCE: Vector = [0.8, 1, 0.85, 0.75, 1, 0.7, 0.9];
export const TREE_BASE: Vector = [0.85, 1.15, 0.9, 0.75, 1.2, 0.7, 0.95];
export const LEAF_TEMPLATE: Vector = [0.75, 1.1, 1, 0.85, 1.3, 0.9, 0.8];
export const FRUIT_TEMPLATE: Vector = [1, 1, 1, 1, 1, 1, 1];
export const zeros = (): Vector => [0, 0, 0, 0, 0, 0, 0];
export const vectorSum = (v: readonly number[]): number => v.reduce((a, b) => a + b, 0);
export const elementIndex = (element: Element): number => ELEMENTS.indexOf(element);
export const ELEMENT_VIEW: Record<Element, { name: string; icon: string; color: number; css: string }> = {
  Fire: { name: "火", icon: "🔥", color: 0xe88967, css: "#e88967" },
  Hydro: { name: "水", icon: "💧", color: 0x5bade5, css: "#5bade5" },
  Anemo: { name: "风", icon: "🍃", color: 0x74c8ad, css: "#74c8ad" },
  Electro: { name: "雷", icon: "⚡", color: 0xb18adf, css: "#b18adf" },
  Dendro: { name: "草", icon: "🌿", color: 0x9fcf76, css: "#9fcf76" },
  Cryo: { name: "冰", icon: "❄", color: 0x99d2df, css: "#99d2df" },
  Geo: { name: "岩", icon: "◆", color: 0xddbc79, css: "#ddbc79" },
};