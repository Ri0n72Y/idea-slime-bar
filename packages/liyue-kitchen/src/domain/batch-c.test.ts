import assert from "node:assert/strict";
import test from "node:test";
import { applyCommand, newGame, type GameState, type Command } from "./game.ts";
import { ECONOMY_CANDIDATE } from "./economy.ts";
import { validateSave } from "./save.ts";
import { VISITOR_GIFT_ID, VISITOR_ID, visitorChoices, visitorPresent } from "./visitors.ts";
import { visibleDiscoveries } from "./discovery.ts";

const act = (s: GameState, c: Command): GameState => applyCommand(s, c);
const talk = (s: GameState, action: Extract<Command, { type: "TALK_VISITOR" }>["action"]) =>
  act(s, { type: "TALK_VISITOR", visitorId: VISITOR_ID, action });
function night(s: GameState): GameState {
  const requested = act(s, { type: "REQUEST_END_DAY" });
  return act(requested, { type: "CONFIRM_END_DAY", expectedDay: s.day });
}
function firstVisit(): GameState {
  let s = act(newGame(), { type: "PLANT_SEED", plotId: "P01", itemId: "item:seed:1" });
  for (let i = 0; i < 4; i++) {
    s = act(s, { type: "CONDENSE" });
    const ball = Object.values(s.looseBalls).at(-1)!;
    s = act(s, { type: "COLLECT_BALL", ballId: ball.id });
    s = act(s, { type: "WATER_PLOT", plotId: "P01", element: ball.element });
  }
  s = night(s);
  assert.ok(s.discoveries.A03, "Real first-night growth must unlock visitor arrival");
  assert.ok(visitorPresent(s));
  return s;
}
function matureFruit(s: GameState): GameState {
  for (let d = 0; d < 80; d++) {
    for (let i = s.dayCondenseUsed; i < s.dayCondenseLimit; i++) {
      s = act(s, { type: "CONDENSE" });
      const ball = Object.values(s.looseBalls).at(-1)!;
      s = act(s, { type: "COLLECT_BALL", ballId: ball.id });
      s = act(s, { type: "WATER_PLOT", plotId: "P01", element: ball.element });
    }
    s = night(s);
    if (s.plots.P01.plant?.leaves.some(l => l.fruit?.stage === "MatureFruit")) return s;
  }
  throw Error("No fruit produced by the authoritative Growth model");
}
test("Visitor cannot mint the unique seed or appear before real planting and growth", () => {
  let g = newGame();
  assert.equal(visitorPresent(g), false);
  assert.deepEqual(visitorChoices(g), []);
  const before = structuredClone(g);
  g = talk(g, "greet");
  assert.equal(g.notice.kind, "locked");
  assert.deepEqual(g.items, before.items);
  assert.deepEqual(g.adeptalEnergy, before.adeptalEnergy);
  g = firstVisit();
  assert.equal(g.visitor.metAtDay, null);
  assert.equal(g.visitor.issuedOrderIds.length, 0);
  assert.equal(Object.values(g.items).filter(i => i.kind === "Seed").length, 0);
});
test("Genuine dialogue gives unique clue, tangible gift and once-only energy; keeps actual items", () => {
  let g = firstVisit();
  assert.ok(!visibleDiscoveries(g).some(n => n.node.id === "V01" || n.node.id === "V02"));
  const earned = g.adeptalEnergy.earnedTotal;
  g = talk(g, "greet");
  assert.equal(g.adeptalEnergy.earnedTotal, earned + 2);
  assert.equal(g.visitor.metAtDay, 2);
  const afterMeet = g.adeptalEnergy.earnedTotal;
  g = talk(g, "greet");
  assert.equal(g.notice.kind, "locked");
  assert.equal(g.adeptalEnergy.earnedTotal, afterMeet);
  assert.equal(g.discoveries.V01, undefined);
  g = talk(g, "ask_clue");
  assert.equal(g.adeptalEnergy.earnedTotal, earned + 5);
  assert.equal(g.discoveries.V01?.sourceId, "visitor:yan:clue");
  assert.ok(visibleDiscoveries(g).some(n => n.node.id === "V01" && n.status === "completed"));
  assert.ok(!visibleDiscoveries(g).some(n => n.node.id === "V02"));
  g = talk(g, "accept_gift");
  const gift = g.items[VISITOR_GIFT_ID];
  assert.ok(gift && gift.kind === "VisitorGift");
  assert.equal(gift.location.kind, "inventory");
  assert.equal(g.visitor.giftAtDay, 2);
  assert.equal(Object.values(g.items).filter(x => x.kind === "Seed").length, 0);
  const afterGift = g.adeptalEnergy.earnedTotal;
  g = talk(g, "accept_gift");
  assert.equal(g.notice.kind, "locked");
  assert.equal(g.adeptalEnergy.earnedTotal, afterGift);
  assert.equal(Object.values(g.items).filter(i => i.kind === "VisitorGift").length, 1);
  g = act(g, { type: "MOVE_ITEM", itemId: gift.id, destination: { kind: "storage" } });
  assert.equal(g.items[gift.id].location.kind, "storage");
  g = act(g, { type: "MOVE_ITEM", itemId: gift.id, destination: { kind: "workbench", slot: "juice" } });
  assert.equal(g.notice.kind, "locked");
  assert.equal(g.items[gift.id].location.kind, "storage");
  g = act(g, { type: "PROCESS_ITEM", itemId: gift.id, action: "JUICE" });
  assert.equal(g.notice.kind, "locked");
  g = act(g, { type: "ACCEPT_ORDER", orderId: "order:first" });
  g = act(g, { type: "DELIVER_ORDER", orderId: "order:first", itemIds: [gift.id] });
  assert.equal(g.notice.kind, "locked");
  assert.equal(g.orders["order:first"].state, "accepted");
  assert.deepEqual(validateSave({ version: 6, game: g }), g);
  const corrupted = structuredClone(g);
  corrupted.items["item:visitor:yan:duplicate"] = { ...gift, id: "item:visitor:yan:duplicate" };
  assert.equal(validateSave({ version: 6, game: corrupted }), null);
});
test("Visitor's real cup order shares U5 inventory and reward ledger; thanks pay only after delivery", () => {
  let g = firstVisit();
  g = talk(talk(g, "greet"), "ask_clue");
  g = talk(g, "request_order");
  const orderId = g.visitor.issuedOrderIds[0];
  const guest = g.orders[orderId];
  assert.ok(orderId.startsWith("order:visitor:yan:"));
  assert.equal(guest.visitorId, VISITOR_ID);
  assert.equal(guest.itemKind, "juice_cup");
  assert.equal(g.orders["order:first"].visitorId, "board");
  const ordersBefore = Object.keys(g.orders).length;
  g = talk(g, "request_order");
  assert.equal(g.notice.kind, "locked");
  assert.equal(Object.keys(g.orders).length, ordersBefore);
  g = act(g, { type: "ACCEPT_ORDER", orderId });
  assert.equal(g.orders[orderId].state, "accepted");
  g = talk(g, "thank");
  assert.equal(g.notice.kind, "locked");
  g = matureFruit(g);
  assert.ok(g.day <= guest.dueDay);
  const tree = g.plots.P01.plant!;
  const leaf = tree.leaves.find(l => l.fruit?.stage === "MatureFruit")!;
  const prev = g;
  g = act(g, { type: "HARVEST", plotId: "P01", plantId: tree.id, leafId: leaf.id });
  const fruitId = Object.keys(g.items).find(id => id.startsWith("item:aquamelon:") && !prev.items[id])!;
  g = act(g, { type: "MOVE_ITEM", itemId: fruitId, destination: { kind: "workbench", slot: "peel" } });
  g = act(g, { type: "PROCESS_ITEM", itemId: fruitId, action: "PEEL" });
  const flesh = Object.values(g.items).find(x => x.kind === "PeeledFlesh")!;
  g = act(g, { type: "MOVE_ITEM", itemId: flesh.id, destination: { kind: "workbench", slot: "juice" } });
  g = act(g, { type: "PROCESS_ITEM", itemId: flesh.id, action: "JUICE" });
  const raw = Object.values(g.items).find(x => x.kind === "RawJuice")!;
  g = act(g, { type: "PROCESS_ITEM", itemId: raw.id, action: "CUP" });
  const cup = Object.values(g.items).find(x => x.kind === "AquamelonJuiceCup")!;
  g = act(g, { type: "MOVE_ITEM", itemId: cup.id, destination: { kind: "storage" } });
  const beforeDelivery = g.adeptalEnergy.earnedTotal;
  g = act(g, { type: "DELIVER_ORDER", orderId, itemIds: [cup.id] });
  assert.equal(g.orders[orderId].state, "completed");
  assert.equal(g.items[cup.id], undefined);
  assert.equal(g.adeptalEnergy.earnedTotal - beforeDelivery, ECONOMY_CANDIDATE.orderDelivery);
  assert.equal(g.visitor.thankedAtDay, null);
  const beforeThanks = g.adeptalEnergy.earnedTotal;
  g = talk(g, "thank");
  assert.equal(g.adeptalEnergy.earnedTotal - beforeThanks, 4);
  assert.equal(g.discoveries.V02?.sourceId, "visitor:yan:thanks");
  assert.ok(visibleDiscoveries(g).some(n => n.node.id === "V02" && n.status === "completed"));
  assert.equal(g.adeptalEnergy.earnedTotal - g.adeptalEnergy.spentTotal, g.adeptalEnergy.balance);
  const afterThanks = g.adeptalEnergy.earnedTotal;
  g = talk(g, "thank");
  assert.equal(g.notice.kind, "locked");
  assert.equal(g.adeptalEnergy.earnedTotal, afterThanks);
  assert.equal(g.adeptalEnergy.rewardedIds.filter(k => k === "visitor:yan:thanks").length, 1);
  assert.deepEqual(validateSave({ version: 6, game: g }), g);
});
test("Visitor orders can expire and be reissued; board continues independent of visitor", () => {
  let g = firstVisit();
  g = talk(talk(g, "greet"), "ask_clue");
  while (g.day < 35) g = night(g);
  g = talk(g, "request_order");
  const first = g.visitor.issuedOrderIds[0];
  g = act(g, { type: "ACCEPT_ORDER", orderId: first });
  const rewards = g.adeptalEnergy.earnedTotal;
  while (g.day <= g.orders["order:first"].dueDay) g = night(g);
  assert.equal(g.orders["order:first"].state, "expired");
  assert.equal(g.orders[first].state, "accepted");
  assert.ok(Object.values(g.orders).some(o => o.visitorId === "board" && o.state === "available"),
    "Board must renew while visitor order remains active");
  while (g.day <= g.orders[first].dueDay) g = night(g);
  assert.equal(g.orders[first].state, "expired");
  g = talk(g, "request_order");
  const second = g.visitor.issuedOrderIds[1];
  assert.ok(second && second !== first);
  assert.equal(g.orders[first].state, "expired");
  assert.equal(g.orders[second].state, "available");
  assert.equal(g.adeptalEnergy.earnedTotal, rewards);
  assert.deepEqual(validateSave({ version: 6, game: g }), g);
});
test("V5 saves acquire empty visitor state without resetting discovery, seed, order or energy", () => {
  const current = newGame();
  const old = structuredClone(current) as unknown as Record<string, unknown>;
  old.schemaVersion = 5; delete old.visitor;
  const migrated = validateSave({ version: 5, game: old })!;
  assert.ok(migrated);
  assert.equal(migrated.schemaVersion, 6);
  assert.deepEqual(migrated.items, current.items);
  assert.deepEqual(migrated.orders, current.orders);
  assert.deepEqual(migrated.discoveries, current.discoveries);
  assert.equal(migrated.visitor.metAtDay, null);
  assert.equal(migrated.adeptalEnergy.balance, current.adeptalEnergy.balance);
  assert.deepEqual(validateSave({ version: 6, game: migrated }), migrated);
  const invalid = structuredClone(migrated);
  invalid.visitor.giftAtDay = 2;
  invalid.day = 2;
  assert.equal(validateSave({ version: 6, game: invalid }), null);
});
