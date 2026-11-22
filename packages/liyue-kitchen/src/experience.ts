import { PLOT_IDS, remainingCondenses, type GameItem, type GameState } from "./domain/game.ts";
import type { KitchenOrder } from "./domain/orders.ts";

/** UI-only guidance and material choices. No game commands are performed here. */
export const itemTitle = (item: GameItem): string => ({
  Seed: "水瓜种子", Aquamelon: "完整水瓜", PeeledFlesh: "水瓜果肉",
  Shell: "水瓜果壳", RawJuice: "水瓜原汁",
  AquamelonJuiceCup: "杯装水瓜汁", VisitorGift: "旅人木牌",
})[item.kind];
export const orderItemTitle = (order: KitchenOrder): string =>
  order.itemKind === "aquamelon" ? "完整水瓜" : "杯装水瓜汁";
const requiredKind = (order: KitchenOrder): GameItem["kind"] =>
  order.itemKind === "aquamelon" ? "Aquamelon" : "AquamelonJuiceCup";
const accessible = (item: GameItem): boolean =>
  item.location.kind === "inventory" || item.location.kind === "storage";
export const eligibleOrderItems = (state: GameState, order: KitchenOrder): GameItem[] =>
  Object.values(state.items).filter(item => item.kind === requiredKind(order) && accessible(item));

export function orderSelectionWarning(state: GameState, order: KitchenOrder): string | null {
  const selected = state.selectedItemId ? state.items[state.selectedItemId] : null;
  if (!selected) return null;
  if (selected.kind !== requiredKind(order))
    return `已选「${itemTitle(selected)}」，委托需要「${orderItemTitle(order)}」。请显式选用下方合格材料。`;
  if (!accessible(selected))
    return `「${itemTitle(selected)}」仍在${selected.location.kind === "ground" ? "水晶球地面" : "加工台"}。先拖入物品栏或仓储区再交付。`;
  return null;
}

/** Suggestions follow the real state while leaving operation strategy to the player. */
export function nextActionHint(state: GameState, scene: "workshop" | "garden" = "garden"): string {
  if (state.phase === "DAY_CONFIRM") return "可以确认结算观察夜间成长，也可以返回今日继续操作。";
  const items = Object.values(state.items);
  const planted = PLOT_IDS.some(id => state.plots[id].open && !!state.plots[id].plant);
  const accepted = Object.values(state.orders).filter(o => o.state === "accepted");
  if (items.some(item => item.kind === "Aquamelon" && item.location.kind === "ground"))
    return "水瓜已采摘，仍在水晶球地面。拖入物品栏或仓储区才能交单；也可拖至剥壳台加工。";
  const deliverable = accepted.find(o => eligibleOrderItems(state, o).length >= o.quantity);
  if (deliverable) return `已有可交付的${orderItemTitle(deliverable)}，到委托处选用材料并交单。`;
  const peel = items.find(item => item.location.kind === "workbench" && item.location.slot === "peel");
  const juice = items.find(item => item.location.kind === "workbench" && item.location.slot === "juice");
  if (peel?.kind === "Aquamelon") return "完整水瓜已到剥壳台，点击「剥壳」。";
  if (peel?.kind === "PeeledFlesh") return "将剥出的果肉拖至榨汁台。";
  if (juice?.kind === "PeeledFlesh") return "果肉已在榨汁台，点击「榨汁」。";
  if (juice?.kind === "RawJuice") return "榨出的原汁可以点击「装杯」，成为可交单的杯装果汁。";
  if (juice?.kind === "AquamelonJuiceCup") return "杯装果汁已完成，拖入物品栏或仓储区再交单。";
  if (accepted.some(o => o.itemKind === "juice_cup") &&
      items.some(item => item.kind === "Aquamelon" && accessible(item)))
    return "果汁委托需要杯装成品。可以将完整水瓜拖到剥壳台加工。";
  const seed = items.find(item => item.kind === "Seed" && item.location.kind === "inventory");
  if (!planted && seed) return scene === "workshop"
    ? "先点击水晶球「前往园地」，再把物品栏的种子拖到已开垦的空地格播种。"
    : "从园地物品栏拖动水瓜种子，播种到已开垦的空地格。";
  if (PLOT_IDS.some(id => state.plots[id].plant?.leaves.some(leaf => leaf.fruit?.stage === "MatureFruit")))
    return "树上已有成熟水瓜，可以点击果实采摘。";
  if (state.heldElements.some(v => v > 0)) {
    if (!state.selectedPlotId || !state.plots[state.selectedPlotId].open)
      return "已有养分。先在水晶球上选一个开放地格，再到仓储区点击对应元素浇灌。";
    return "已有养分。点击仓储区对应的「浇灌」，夜间会按根系规则吸收。";
  }
  if (Object.keys(state.looseBalls).length)
    return "水晶球附近已有元素球。点击收集养分，也可以继续凝聚探索。";
  if (remainingCondenses(state) > 0)
    return planted ? "点击顶栏「凝聚元素」，收集元素球后在仓储区浇灌。" :
      seed ? "可以播种，也可以先凝聚元素观察。" : "可以点击「凝聚元素」，探索可用养分。";
  return planted ? "今日凝聚次数已用完。结束今日并确认结算，植株会在夜间吸收土壤养分。" :
    "今日凝聚次数已用完，可以结束今日或先整理物品。";
}
