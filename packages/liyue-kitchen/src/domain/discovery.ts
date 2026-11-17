import type { GameEvent, GameState } from "./game.ts";

/** Author-defined content graph. Missing hidden nodes are excluded from every UI list/count. */
export const DISCOVERY_NODES = [
  { id: "A00", title: "一粒水瓜种子", category: "种植", prerequisites: [], visibility: "visible", hint: "获得第一枚真实种子", fact: "SEED_OBTAINED" },
  { id: "A01", title: "洞天开垦", category: "种植", prerequisites: ["A00"], visibility: "visible", hint: "将种子播入开放地格", fact: "TREE_PLANTED" },
  { id: "A02", title: "元素的馈赠", category: "元素", prerequisites: ["A00"], visibility: "visible", hint: "将收集的元素注入土壤", fact: "SOIL_WATERED" },
  { id: "A03", title: "第一夜", category: "种植", prerequisites: ["A01"], visibility: "visible", hint: "让植株经过有效夜间生长", fact: "GROWTH_CONFIRMED" },
  { id: "A07", title: "今日委托", category: "经营", prerequisites: ["A00"], visibility: "visible", hint: "接受委托板的真实订单", fact: "ORDER_ACCEPTED" },
  { id: "A12", title: "初次成熟", category: "种植", prerequisites: ["A03"], visibility: "visible", hint: "种出第一枚成熟水瓜", fact: "FRUIT_MATURED" },
  { id: "A18", title: "熟练收集", category: "技术", prerequisites: ["A02"], visibility: "visible", hint: "亲手收集三枚不同元素球", fact: "THIRD_MANUAL_COLLECTION" },
  { id: "A17", title: "剥壳的发现", category: "加工", prerequisites: ["A12"], visibility: "visible", hint: "完成真实剥壳并取得果壳", fact: "FRUIT_PEELED" },
  { id: "A14", title: "第一杯水瓜汁", category: "加工", prerequisites: ["A17"], visibility: "visible", hint: "将原汁装入机器自带的杯子", fact: "JUICE_CUPPED" },
  { id: "A11", title: "期限之约", category: "经营", prerequisites: ["A07"], visibility: "visible", hint: "在截止日内交付真实订单", fact: "ORDER_DELIVERED" },
  { id: "A13", title: "初次交货", category: "经营", prerequisites: ["A12", "A07"], visibility: "visible", hint: "交付一枚完整成熟水瓜", fact: "FRUIT_ORDER_DELIVERED" },
  { id: "A16", title: "交付果汁", category: "经营", prerequisites: ["A14", "A07"], visibility: "visible", hint: "交付真正的杯装水瓜汁", fact: "JUICE_ORDER_DELIVERED" },
  { id: "H01", title: "双元素滋养", category: "元素", prerequisites: ["A02"], visibility: "hidden", hint: "尝试新的土壤组合", fact: "SECOND_ELEMENT_WATERED" },
  { id: "V01", title: "远方的商路", category: "访客", prerequisites: ["A00"], visibility: "hidden", hint: "与旅人追寻商路传说", fact: "VISITOR_CLUE_FOUND" },
  { id: "V02", title: "路上的回信", category: "访客", prerequisites: ["V01"], visibility: "hidden", hint: "真实交单后倾听旅人的谢意", fact: "VISITOR_THANKED" },
] as const;
export type DiscoveryId = (typeof DISCOVERY_NODES)[number]["id"];
export type DiscoveryRecord = {
  id: DiscoveryId; completedAtDay: number; eventId: string; sourceId: string;
};
export type DiscoveryStatus = "completed" | "available" | "hinted" | "locked";
export function visibleDiscoveries(state: GameState) {
  return DISCOVERY_NODES.flatMap(node => {
    const record = state.discoveries[node.id];
    if (node.visibility === "hidden" && !record) return [];
    const allParents = node.prerequisites.every(id => !!state.discoveries[id]);
    const anyParent = node.prerequisites.some(id => !!state.discoveries[id]);
    const status: DiscoveryStatus = record ? "completed" :
      allParents ? "available" : anyParent ? "hinted" : "locked";
    return [{ node, record, status }];
  });
}
/** Only facts emitted by the actual domain action are eligible. Old inventory
 * changes, UI opens and replayed event IDs cannot create discoveries. */
export function reconcileDiscoveries(state: GameState, facts: readonly GameEvent[]): void {
  for (const fact of facts) {
    if (!fact.fact || !fact.sourceId || !fact.id) continue;
    for (const node of DISCOVERY_NODES) {
      if (node.fact !== fact.fact || state.discoveries[node.id]) continue;
      state.discoveries[node.id] = {
        id: node.id, completedAtDay: fact.day,
        eventId: fact.id, sourceId: fact.sourceId,
      };
    }
  }
}
/** Legacy saves contain genuine events, but lacked standardized fact codes.
 * Backfill only facts whose historic event fields provide traceable evidence. */
export function migrateDiscoveryEvidence(state: GameState): void {
  const synthetic: GameEvent[] = [
    { id: "event:initial-seed", day: 1, worldUH: 0, kind: "seed",
      message: "开局获得 item:seed:1", fact: "SEED_OBTAINED", sourceId: "item:seed:1" },
  ];
  for (const e of state.eventLog) {
    if (e.kind === "plant") {
      const plant = e.message.match(/(plant:[^\s]+).*?(P0[1-7])/);
      if (plant) synthetic.push({ ...e, fact: "TREE_PLANTED", sourceId: plant[1] });
    }
    if (e.kind === "harvest") {
      const source = e.message.match(/(plant:[^\s]+:leaf:\d+)/);
      if (source) synthetic.push({ ...e, fact: "FRUIT_MATURED", sourceId: source[1] });
    }
    if (e.kind === "water") synthetic.push({ ...e, fact: "SOIL_WATERED", sourceId: e.message });
    if (e.kind === "reward" && e.message.includes("有效种植周期"))
      synthetic.push({ ...e, fact: "GROWTH_CONFIRMED", sourceId: e.message });
    if (e.kind === "order" && e.message.startsWith("已接受"))
      synthetic.push({ ...e, fact: "ORDER_ACCEPTED", sourceId: e.message });
    if (e.kind === "order" && e.message.includes("委托完成")) {
      const orderId = e.message.match(/^(order:[^:]+):/)?.[1];
      if (orderId && state.orders[orderId]?.state === "completed") {
        synthetic.push({ ...e, fact: "ORDER_DELIVERED", sourceId: orderId });
        synthetic.push({ ...e, fact: state.orders[orderId].itemKind === "aquamelon" ?
          "FRUIT_ORDER_DELIVERED" : "JUICE_ORDER_DELIVERED", sourceId: orderId });
      }
    }
    if (e.kind === "process" && e.message.includes("item:peeledflesh:")) {
      const shellId = e.message.match(/item:shell:[0-9]+/)?.[0];
      if (shellId) synthetic.push({ ...e, fact: "FRUIT_PEELED", sourceId: shellId });
    }
    if (e.kind === "process" && e.message.includes("item:aquamelonjuicecup:")) {
      const cupId = e.message.match(/item:aquamelonjuicecup:[0-9]+/)?.[0];
      if (cupId) synthetic.push({ ...e, fact: "JUICE_CUPPED", sourceId: cupId });
    }
  }
  if (state.labor.manualBallIds.length === 3) {
    const third = state.labor.manualBallIds[2];
    const event = state.eventLog.find(e => e.kind === "collect" &&
      e.message.includes(`收集 ${third}：`));
    if (event) synthetic.push({ ...event, fact: "THIRD_MANUAL_COLLECTION", sourceId: third });
  }
  if (state.labor.wateredElements.length >= 2) {
    const second = state.labor.wateredElements[1];
    const event = state.eventLog.find(e => e.kind === "water" &&
      e.message.startsWith(`灌注 ${second} `));
    if (event) synthetic.push({ ...event, fact: "SECOND_ELEMENT_WATERED", sourceId: event.message });
  }
  reconcileDiscoveries(state, synthetic);
}
