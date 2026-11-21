import { BALANCE } from "./balance.ts";
/** Compatibility alias; balance.config.json is the only numeric data source. */
export const U2_CONFIG = BALANCE.world;

export const ELEMENTS = ["Fire", "Hydro", "Anemo", "Electro", "Dendro", "Cryo", "Geo"] as const;
export type Element = (typeof ELEMENTS)[number];
export type Vector = [number, number, number, number, number, number, number];
export const ROOT_PREFERENCE: Vector = BALANCE.affinity.rootPreference as Vector;
export const TREE_BASE: Vector = BALANCE.affinity.treeBase as Vector;
export const LEAF_TEMPLATE: Vector = BALANCE.affinity.leafTemplate as Vector;
export const FRUIT_TEMPLATE: Vector = BALANCE.affinity.fruitTemplate as Vector;
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