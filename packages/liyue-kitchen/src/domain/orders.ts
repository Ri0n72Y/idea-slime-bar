import type { GameState } from "./game.ts";
import { ECONOMY_CANDIDATE, rewardEnergy } from "./economy.ts";

export type OrderKind = "aquamelon" | "juice_cup";
export type OrderState = "available" | "accepted" | "completed" | "expired";
export type KitchenOrder = {
  id: string; visitorId: "board"; postedDay: number; acceptedDay: number | null;
  dueDay: number; itemKind: OrderKind; quantity: number;
  state: OrderState; deliveredItemIds: string[]; rewards: number;
};
/** Deadlines and rewards are candidates pending reproducible growth calibration. */
export const ORDER_CANDIDATE = Object.freeze({ firstWindowDays: 45, renewalWindowDays: 40 });
export function createOrder(id: string, day: number, kind: OrderKind, isFirst = false): KitchenOrder {
  return { id, visitorId: "board", postedDay: day, acceptedDay: null,
    dueDay: day + (isFirst ? ORDER_CANDIDATE.firstWindowDays : ORDER_CANDIDATE.renewalWindowDays),
    itemKind: kind, quantity: 1, state: "available", deliveredItemIds: [],
    rewards: ECONOMY_CANDIDATE.orderDelivery };
}
export const initialOrders = (): Record<string, KitchenOrder> => ({
  "order:first": createOrder("order:first", 1, "aquamelon", true),
});
const neededKind = (kind: OrderKind) => kind === "aquamelon" ? "Aquamelon" : "AquamelonJuiceCup";
function nextOffer(state: GameState, kind: OrderKind): KitchenOrder {
  const id = `order:${state.nextObjectSeq++}`;
  const offer = createOrder(id, state.day, kind);
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
  { ok: true; message: string; itemIds: string[]; nextOrderId: string } |
  { ok: false; reason: string } {
  const order = Object.hasOwn(state.orders, orderId) ? state.orders[orderId] : null;
  if (!order || order.state !== "accepted" || state.day > order.dueDay)
    return { ok: false, reason: "委托未接受、已完成或已过期。" };
  if (!Array.isArray(itemIds) || itemIds.length !== order.quantity ||
      new Set(itemIds).size !== itemIds.length)
    return { ok: false, reason: "交付数量不足或同一物品被重复选用。" };
  const wanted = neededKind(order.itemKind);
  const items = itemIds.map(id => Object.hasOwn(state.items, id) ? state.items[id] : null);
  if (items.some(item => !item || item.kind !== wanted ||
      (item.location.kind !== "inventory" && item.location.kind !== "storage")))
    return { ok: false, reason: "材料类型不符或物品未放入物品栏/仓储，交付失败。" };
  if (state.adeptalEnergy.rewardedIds.includes(`order:${order.id}`))
    return { ok: false, reason: "此委托奖励已领取。" };
  for (const id of itemIds) delete state.items[id];
  if (state.selectedItemId && itemIds.includes(state.selectedItemId)) state.selectedItemId = null;
  order.state = "completed";
  order.deliveredItemIds = [...itemIds];
  rewardEnergy(state, `order:${order.id}`, order.rewards);
  const nextKind = order.itemKind === "aquamelon" ? "juice_cup" : "aquamelon";
  const next = nextOffer(state, nextKind);
  return { ok: true, message: `委托完成：交付 ${order.quantity} 件，获得 ${order.rewards} 仙力。`,
    itemIds, nextOrderId: next.id };
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
  const active = Object.values(state.orders).some(
    o => o.state === "available" || o.state === "accepted");
  if (!active) {
    const last = Object.values(state.orders).at(-1);
    const kind = last?.itemKind ?? "aquamelon"; // retry same kind; no permanent deadline trap
    const order = nextOffer(state, kind);
    events.push(`委托板发布 ${order.id}（${order.itemKind}），截止第 ${order.dueDay} 天。`);
  }
  return events;
}
