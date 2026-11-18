/** Player-facing text only. Never alter persisted identities or domain enum values. */
import type { PlotId } from "./domain/game";

export const plotLabel = (id: PlotId): string => `${Number(id.slice(1))}号地`;

const stages: Record<string, string> = {
  Seed: "种子期", Seedling: "幼苗期", Sapling: "幼树期",
  FlowerBud: "花蕾", Flower: "开花", GreenFruit: "青果",
  MatureFruit: "成熟水瓜", SmallLeaf: "小叶", LargeLeaf: "肥厚叶", FibrousLeaf: "纤维叶",
};
export const growthStageLabel = (label: string): string =>
  label.split(" · ").map(part => stages[part] ?? part).join(" · ");

/** Translate log presentation without changing event identities or stored evidence. */
export function playerEventText(message: string): string {
  return message
    .replace(/plant:P0[1-7]:[0-9]+/g, "这株水瓜")
    .replace(/item:[a-zA-Z0-9:_-]+/g, "对应物件")
    .replace(/(?:event|order):[a-zA-Z0-9:_-]+/g, "相关记录")
    .replace(/\\bP0([1-7])\\b/g, (_match, number: string) => `${Number(number)}号地`)
    .replace(/\\b(Seedling|Sapling|Seed|FlowerBud|Flower|GreenFruit|MatureFruit)\\b/g,
      stage => stages[stage])
    .replace(/\\b(Fire|Hydro|Anemo|Electro|Dendro|Cryo|Geo)\\b/g,
      element => ({ Fire: "火", Hydro: "水", Anemo: "风", Electro: "雷",
        Dendro: "草", Cryo: "冰", Geo: "岩" } as Record<string, string>)[element]);
}

export const itemLocationLabel = (kind: "inventory" | "storage" | "ground" | "workbench"): string => ({
  inventory: "物品栏", storage: "仓储区", ground: "水晶球地面", workbench: "加工台",
})[kind];
