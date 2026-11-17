import type { GameState } from "./game.ts";
import { createOrder } from "./orders.ts";
import { rewardEnergy } from "./economy.ts";

export const VISITOR_ID = "visitor:yan" as const;
export const VISITOR_GIFT_ID = "item:visitor:yan:woodtag" as const;
export const VISITOR_GIFT_EVENT = "visitor:yan:gift" as const;
const ORDER_PREFIX = "order:visitor:yan:";
export type VisitorAction = "greet" | "ask_clue" | "accept_gift" | "request_order" | "thank" | "chat";
export type VisitorState = {
  id: typeof VISITOR_ID;
  metAtDay: number | null;
  clueAtDay: number | null;
  giftAtDay: number | null;
  thankedAtDay: number | null;
  issuedOrderIds: string[];
  lastLine: string;
};
export type VisitorChoice = { id: VisitorAction; text: string; hint: string };
export const newVisitor = (): VisitorState => ({
  id: VISITOR_ID, metAtDay: null, clueAtDay: null, giftAtDay: null,
  thankedAtDay: null, issuedOrderIds: [],
  lastLine: "旅人似乎在观察洞天里的水瓜树。",
});
export const visitorPresent = (state: GameState): boolean =>
  state.day >= 2 && !!state.discoveries.A03;
export function visitorChoices(state: GameState): VisitorChoice[] {
  if (!visitorPresent(state)) return [];
  const v = state.visitor;
  if (v.metAtDay === null) return [
    { id: "greet", text: "向旅人问好", hint: "了解来意" },
  ];
  const choices: VisitorChoice[] = [];
  if (v.clueAtDay === null) choices.push(
    { id: "ask_clue", text: "询问路上的见闻", hint: "追寻水瓜与商路的线索" });
  if (v.clueAtDay !== null && v.giftAtDay === null) choices.push(
    { id: "accept_gift", text: "收下旅人木牌", hint: "得到一件有独立身份的纪念物" });
  const last = v.issuedOrderIds.at(-1);
  const order = last ? state.orders[last] : null;
  if (v.clueAtDay !== null && v.thankedAtDay === null &&
      (!order || order.state === "expired")) choices.push(
    { id: "request_order", text: order ? "重新约定送货" : "询问是否需要送货",
      hint: "向委托板登记杯装水瓜汁订单" });
  if (order?.state === "completed" && v.thankedAtDay === null) choices.push(
    { id: "thank", text: "听取旅人的谢意", hint: "核对已完成的真实委托" });
  choices.push({ id: "chat", text: "聊聊今天的天气", hint: "普通交谈不重复提供奖励" });
  return choices;
}
type Interaction = { ok: true; message: string; fact?: string; sourceId?: string } |
  { ok: false; reason: string };
export function interactVisitor(state: GameState, action: VisitorAction): Interaction {
  if (!visitorPresent(state)) return { ok: false, reason: "旅人尚未到达洞天。" };
  if (!visitorChoices(state).some(c => c.id === action))
    return { ok: false, reason: "对话条件尚未达成或该互动已完成。" };
  const v = state.visitor;
  switch (action) {
    case "greet": {
      v.metAtDay = state.day;
      rewardEnergy(state, "visitor:yan:greet", 2);
      v.lastLine = "我是往来璃月各地的阿砚。你的水瓜树长得很好，想听听路上的故事吗？";
      return { ok: true, message: "结识旅人阿砚，获得 2 洞天仙力。",
        fact: "VISITOR_MET", sourceId: "visitor:yan:greet" };
    }
    case "ask_clue": {
      v.clueAtDay = state.day;
      rewardEnergy(state, "visitor:yan:clue", 3);
      v.lastLine = "山道边的旧木牌记着一条果汁商路。人们会把熟透的水瓜榨成杯装饮品，带往更远的集市。";
      return { ok: true, message: "发现商路线索，获得 3 洞天仙力。",
        fact: "VISITOR_CLUE_FOUND", sourceId: "visitor:yan:clue" };
    }
    case "accept_gift": {
      if (Object.hasOwn(state.items, VISITOR_GIFT_ID))
        return { ok: false, reason: "这块木牌已经在背包中。" };
      state.items[VISITOR_GIFT_ID] = {
        id: VISITOR_GIFT_ID, kind: "VisitorGift", location: { kind: "inventory" },
        visitorId: VISITOR_ID, eventId: VISITOR_GIFT_EVENT, title: "旅人木牌",
      };
      v.giftAtDay = state.day;
      v.lastLine = "这块木牌留给你，记得路上每一段真实的经历。它只是纪念，不是料理原料。";
      return { ok: true, message: "收到了旅人木牌，已放入物品栏。",
        fact: "VISITOR_GIFT_GRANTED", sourceId: VISITOR_GIFT_EVENT };
    }
    case "request_order": {
      const id = `${ORDER_PREFIX}${state.nextObjectSeq++}`;
      const order = createOrder(id, state.day, "juice_cup", false, VISITOR_ID);
      state.orders[id] = order;
      v.issuedOrderIds.push(id);
      v.lastLine = "若你能做一杯真正装杯的水瓜汁，我想带到山道尽头的集市。委托已写在右侧。";
      return { ok: true, message: "访客发布了杯装水瓜汁委托，已进入委托账本。",
        fact: "VISITOR_ORDER_OFFERED", sourceId: id };
    }
    case "thank": {
      v.thankedAtDay = state.day;
      rewardEnergy(state, "visitor:yan:thanks", 4);
      v.lastLine = "这杯水瓜汁已经送到了。谢谢你，洞天外的人也会记得它的味道。";
      return { ok: true, message: "完成旅人的故事，获得 4 洞天仙力。",
        fact: "VISITOR_THANKED", sourceId: "visitor:yan:thanks" };
    }
    case "chat": {
      v.lastLine = "今天山风轻，先照料好水瓜树吧。故事总会在劳动之后继续。";
      return { ok: true, message: "与旅人交谈，没有额外奖励。" };
    }
  }
}
export function isVisitorOrderId(id: string): boolean =>
  /^order:visitor:yan:[0-9]+$/.test(id);
