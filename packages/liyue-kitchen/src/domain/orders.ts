import { BALANCE } from "./balance.ts";
import { OPENING_SOURCE, sourceKey, isEdible, type GameItem, type GameState } from "./game.ts";
import { ECONOMY_CANDIDATE, rewardEnergy } from "./economy.ts";

export type OrderKind = "aquamelon" | "juice_cup";
export type OrderState = "available" | "accepted" | "completed" | "expired";
export type KitchenOrder = {
  id: string; visitorId: string; postedDay: number; acceptedDay: number | null;
  dueDay: number; itemKind: OrderKind; quantity: number;
  state: OrderState; deliveredItemIds: string[]; rewards: number;
};
/** Deadlines and rewards are candidates pending reproducible growth calibration. */
export const ORDER_CANDIDATE = BALANCE.orders;
export function createOrder(id: string, day: number, kind: OrderKind, isFirst = false, visitorId = "board"): KitchenOrder {
  return { id, visitorId, postedDay: day, acceptedDay: null,
    dueDay: day + (isFirst ? ORDER_CANDIDATE.firstWindowDays : ORDER_CANDIDATE.renewalWindowDays),
    itemKind: kind, quantity: ORDER_CANDIDATE.quantity, state: "available", deliveredItemIds: [],
    rewards: ECONOMY_CANDIDATE.orderDelivery };
}
export const initialOrders = (): Record<string, KitchenOrder> => ({
  "order:first": createOrder("order:first", 1, "aquamelon", true),
});
const neededKind = (kind: OrderKind) => kind === "aquamelon" ? "Aquamelon" : "AquamelonJuiceCup";
/** Preserve one route to the tutorial's actual board delivery. While raw
 * juice remains, all existing cups can be traded; once fully portioned,
 * reserve one deterministic cup even if it is currently on the ground. */
export function openingDeliveryWarning(state: GameState, order: KitchenOrder, item: GameItem): string | null {
  if (!state.opening || state.opening.firstCupOrderId || !isEdible(item) ||
      sourceKey(item.source) !== sourceKey(OPENING_SOURCE)) return null;
  if (item.kind === "Aquamelon") return "开局水瓜需保留用于首杯果汁任务，不能作为完整水瓜交付。";
  if (item.kind !== "AquamelonJuiceCup" || order.visitorId === "board") return null;
  const batch = item.batchId && state.juiceBatches?.[item.batchId];
  if (!batch) return "开局果汁批次无效。";
  const remaining = Object.values(state.items).filter(i => isEdible(i) && i.batchId === item.batchId);
  if (remaining.some(i => i.kind === "RawJuice" && (isEdible(i) && (i.volumeMl ?? 0) >= batch.cupMl))) return null;
  const reserved = remaining.filter(i => i.kind === "AquamelonJuiceCup").map(i => i.id).sort()[0];
  return item.id === reserved ? "需保留一杯开局水瓜汁用于委托板首杯任务，其余杯装果汁可交访客。" : null;
}
function nextOffer(state: GameState, kind: OrderKind): KitchenOrder {
  // Keep a board juice commission available until the specific opening
  // delivery is recorded; ordinary orders alternate again afterward.
  if (state.opening && !state.opening.firstCupOrderId) kind = "juice_cup";
  const id = `order:${state.nextObjectSeq++}`;
  const offer = createOrder(id, state.day, kind);
  if (state.opening && !state.opening.firstCupOrderId && kind === "juice_cup") offer.quantity = 1;
  state.orders[id] = offer;
  return offer;
}
export function acceptOrder(state: GameState, orderId: string):
  { ok: true; message: string } | { ok: false; reason: string } {
  const order = Object.hasOwn(state.orders, orderId) ? state.orders[orderId] : null;
  if (!order || order.state !== "available" || state.day > order.dueDay)
    return { ok: false, reason: "委托不可接受或已到期。" };
  order.state = "accepted";
  order.acceptedDay = state.day;
  return { ok: true, message: `已接受 ${order.id}，截止第 ${order.dueDay} 天。` };
}
export function deliverOrder(state: GameState, orderId: string, itemIds: string[]):
  { ok: true; message: string; itemIds: string[]; nextOrderId: string | null } |
  { ok: false; reason: string } {
  const order = Object.hasOwn(state.orders, orderId) ? state.orders[orderId] : null;
  if (!order || order.state !== "accepted" || state.day > order.dueDay)
    return { ok: false, reason: "委托未接受、已完成或已过期。" };
  if (!Array.isArray(itemIds) || itemIds.length !== order.quantity ||
      new Set(itemIds).size !== itemIds.length)
    return { ok: false, reason: "交付数量不足或同一物品被重复选用。" };
  const wanted = neededKind(order.itemKind);
  const items = itemIds.map(id => Object.hasOwn(state.items, id) ? state.items[id] : null);
  if (items.some(item => !item))
    return { ok: false, reason: "交付物品不存在，请重新选择有效材料。" };
  if (items.some(item => item?.kind !== wanted))
    return { ok: false, reason: `所选材料类型不符，本单需要${order.itemKind === "aquamelon" ? "完整水瓜" : "杯装水瓜汁"}，请重新选择。` };
  if (items.some(item => item && item.location.kind !== "inventory" && item.location.kind !== "storage"))
    return { ok: false, reason: "交付物品仍在水晶球地面或加工台，请先拖入物品栏/仓储区。" };
  for (const item of items) {
    if (!item) continue;
    const warning = openingDeliveryWarning(state, order, item);
    if (warning) return { ok: false, reason: warning };
  }
  if (state.adeptalEnergy.rewardedIds.includes(`order:${order.id}`))
    return { ok: false, reason: "此委托奖励已领取。" };
  // Volume leaves inventory only through a genuine order. The batch keeps
  // delivered IDs and their capacity for save/reload conservation checks.
  if (state.juiceBatches) {
    for (const item of items) {
      if (item?.kind !== "AquamelonJuiceCup" || !item.batchId) continue;
      const batch = state.juiceBatches[item.batchId];
      if (!batch || item.volumeMl !== batch.cupMl || Object.hasOwn(batch.delivered, item.id))
        return { ok: false, reason: "杯装容量账本异常，未交付。" };
    }
    for (const item of items) {
      if (item?.kind !== "AquamelonJuiceCup" || !item.batchId) continue;
      const batch = state.juiceBatches[item.batchId];
      batch.delivered[item.id] = batch.cupMl;
      if (state.opening && order.visitorId === "board" && sourceKey(batch.source) === sourceKey(OPENING_SOURCE))
        state.opening.firstCupOrderId ??= order.id;
    }
  }
  for (const id of itemIds) delete state.items[id];
  if (state.selectedItemId && itemIds.includes(state.selectedItemId)) state.selectedItemId = null;
  order.state = "completed";
  order.deliveredItemIds = [...itemIds];
  rewardEnergy(state, `order:${order.id}`, order.rewards);
  const nextKind = order.itemKind === "aquamelon" ? "juice_cup" : "aquamelon";
  const next = order.visitorId === "board" ? nextOffer(state, nextKind) : null;
  return { ok: true, message: `委托完成：交付 ${order.quantity} 件，获得 ${order.rewards} 仙力。`,
    itemIds, nextOrderId: next?.id ?? null };
}
/** Run once after the committed night increments the game day. */
export function advanceOrdersAtMorning(state: GameState): string[] {
  const events: string[] = [];
  for (const order of Object.values(state.orders)) {
    if ((order.state === "available" || order.state === "accepted") && order.dueDay < state.day) {
      order.state = "expired";
      events.push(`${order.id} 已于第 ${order.dueDay} 天截止，未获奖励。`);
    }
  }
  const boardOrders = Object.values(state.orders).filter(o => o.visitorId === "board");
  const active = boardOrders.some(o => o.state === "available" || o.state === "accepted");
  if (!active) {
    const last = boardOrders.at(-1);
    const kind = last?.itemKind ?? "aquamelon"; // retry same kind; no permanent deadline trap
    const order = nextOffer(state, kind);
    events.push(`委托板发布 ${order.id}（${order.itemKind}），截止第 ${order.dueDay} 天。`);
  }
  return events;
}
