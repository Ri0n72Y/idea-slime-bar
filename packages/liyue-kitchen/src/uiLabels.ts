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

export const itemLocationLabel = (kind: "inventory" | "storage" | "ground" | "workbench"): string => ({
  inventory: "物品栏", storage: "仓储区", ground: "水晶球地面", workbench: "加工台",
})[kind];
