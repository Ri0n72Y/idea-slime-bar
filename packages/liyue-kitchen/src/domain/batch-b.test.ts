import assert from "node:assert/strict";
import test from "node:test";
import { applyCommand, newGame, type GameState } from "./game.ts";
import { ELEMENTS, vectorSum } from "./config.ts";
import { visibleDiscoveries } from "./discovery.ts";
import { COLLECT_BAG } from "./technology.ts";
import { validateSave } from "./save.ts";

const act = (g: GameState, command: Parameters<typeof applyCommand>[1]) => applyCommand(g, command);
function night(g: GameState) {
  return act(act(g, { type: "REQUEST_END_DAY" }), { type: "CONFIRM_END_DAY", expectedDay: g.day });
}
function actualBall(g: GameState, manual = true) {
  g = act(g, { type: "CONDENSE" });
  const ball = Object.values(g.looseBalls).at(-1)!;
  g = act(g, { type: "COLLECT_BALL", ballId: ball.id });
  if (manual) g = act(g, { type: "WATER_PLOT", plotId: "P01", element: ball.element });
  return g;
}
function realMaturity() {
  let g = act(newGame(), { type: "PLANT_SEED", itemId: "item:seed:1", plotId: "P01" });
  g = act(g, { type: "ACCEPT_ORDER", orderId: "order:first" });
  const counts: Record<string, number> = {};
  for (let d = 0; d < 80; d++) {
    for (let i = 0; i < g.dayCondenseLimit; i++) {
      g = act(g, { type: "CONDENSE" });
      const ball = Object.values(g.looseBalls).at(-1)!;
      counts[ball.element] = (counts[ball.element] ?? 0) + 1;
      g = act(g, { type: "COLLECT_BALL", ballId: ball.id });
      g = act(g, { type: "WATER_PLOT", plotId: "P01", element: ball.element });
    }
    g = night(g);
    if (g.plots.P01.plant?.leaves.filter(l => l.fruit?.stage === "MatureFruit").length! >= 2)
      return { g, counts };
  }
  throw new Error("Real first crop did not mature");
}
function harvestOne(g: GameState) {
  const tree = g.plots.P01.plant!;
  const leaf = tree.leaves.find(l => l.fruit?.stage === "MatureFruit")!;
  const next = act(g, { type: "HARVEST", plotId: "P01", plantId: tree.id, leafId: leaf.id });
  const newFruit = Object.values(next.items).find(x => x.kind === "Aquamelon" && !g.items[x.id])!;
  return { g: next, fruitId: newFruit.id };
}
test("Initial discovery is a stable seed fact; events reveal true nodes without UI opening", () => {
  let g = newGame();
  assert.deepEqual(Object.keys(g.discoveries), ["A00"]);
  assert.equal(g.discoveries.A00?.sourceId, "item:seed:1");
  assert.ok(!visibleDiscoveries(g).some(x => x.node.id === "H01"));
  const init = g.discoveries.A00;
  g = act(g, { type: "PLANT_SEED", plotId: "P01", itemId: "item:seed:1" });
  assert.ok(g.discoveries.A01?.sourceId.startsWith("plant:"));
  assert.deepEqual(g.discoveries.A00, init);
});
test("Real growth, first two elements, third manual collection, harvest, orders and processing remain evidenced", () => {
  let { g, counts } = realMaturity();
  for (const id of ["A00", "A01", "A02", "A03", "A07", "A12", "A18", "H01"])
    assert.ok(g.discoveries[id as keyof typeof g.discoveries], "missing real discovery " + id);
  assert.ok(Object.keys(counts).length >= 2);
  assert.ok(visibleDiscoveries(g).some(x => x.node.id === "H01" && x.status === "completed"));
  const before = structuredClone(g.discoveries);
  const first = harvestOne(g); g = first.g;
  assert.deepEqual(g.discoveries, before);
  g = act(g, { type: "MOVE_ITEM", itemId: first.fruitId, destination: { kind: "storage" } });
  g = act(g, { type: "DELIVER_ORDER", orderId: "order:first", itemIds: [first.fruitId] });
  assert.ok(g.discoveries.A11 && g.discoveries.A13);
  const second = harvestOne(g); g = second.g;
  g = act(g, { type: "MOVE_ITEM", itemId: second.fruitId, destination: { kind: "workbench", slot: "peel" } });
  g = act(g, { type: "PROCESS_ITEM", itemId: second.fruitId, action: "PEEL" });
  assert.ok(g.discoveries.A17);
  assert.ok(g.discoveries.A17?.sourceId.startsWith("item:shell:"));
  const flesh = Object.values(g.items).find(x => x.kind === "PeeledFlesh")!;
  g = act(g, { type: "MOVE_ITEM", itemId: flesh.id, destination: { kind: "workbench", slot: "juice" } });
  g = act(g, { type: "PROCESS_ITEM", itemId: flesh.id, action: "JUICE" });
  const raw = Object.values(g.items).find(x => x.kind === "RawJuice")!;
  assert.equal(g.discoveries.A14, undefined);
  g = act(g, { type: "PROCESS_ITEM", itemId: raw.id, action: "CUP" });
  assert.ok(g.discoveries.A14);
  const cup = Object.values(g.items).find(x => x.kind === "AquamelonJuiceCup")!;
  const order = Object.values(g.orders).find(o => o.state === "available")!;
  g = act(g, { type: "ACCEPT_ORDER", orderId: order.id });
  g = act(g, { type: "MOVE_ITEM", itemId: cup.id, destination: { kind: "inventory" } });
  g = act(g, { type: "DELIVER_ORDER", orderId: order.id, itemIds: [cup.id] });
  assert.ok(g.discoveries.A16);
  assert.equal(g.discoveries.A13?.sourceId, "order:first");
  assert.equal(g.discoveries.A16?.sourceId, order.id);
  assert.deepEqual(validateSave({ version: 6, game: g }), g);
});
test("Tool cannot be bought without actual work; costs once; collector preserves N and exact V", () => {
  let g = newGame();
  const reject = act(g, { type: "UNLOCK_TECH", techId: "collectBag" });
  assert.equal(reject.notice.kind, "locked");
  assert.equal(reject.adeptalEnergy.spentTotal, 0);
  assert.equal(act(g, { type: "COLLECT_ALL_BALLS" }).notice.kind, "locked");
  const actual = realMaturity().g;
  const harvested = harvestOne(actual);
  g = act(harvested.g, { type: "MOVE_ITEM", itemId: harvested.fruitId,
    destination: { kind: "storage" } });
  g = act(g, { type: "DELIVER_ORDER", orderId: "order:first",
    itemIds: [harvested.fruitId] });
  assert.equal(g.labor.manualBallIds.length, 3);
  assert.ok(g.discoveries.A18);
  assert.ok(g.adeptalEnergy.balance >= COLLECT_BAG.cost);
  const spent = g.adeptalEnergy.spentTotal;
  g = act(g, { type: "UNLOCK_TECH", techId: "collectBag" });
  assert.ok(g.technology.collectBag);
  assert.equal(g.adeptalEnergy.spentTotal - spent, COLLECT_BAG.cost);
  assert.equal(act(g, { type: "UNLOCK_TECH", techId: "collectBag" }).adeptalEnergy.spentTotal, g.adeptalEnergy.spentTotal);
  for (let i = 0; i < 3; i++) g = act(g, { type: "CONDENSE" });
  const initialN = g.dayCondenseUsed, quota = g.dayCondenseLimit;
  const ids = Object.keys(g.looseBalls);
  let sequential = structuredClone(g);
  for (const id of ids) sequential = act(sequential, { type: "COLLECT_BALL", ballId: id });
  const bulk = act(g, { type: "COLLECT_ALL_BALLS" });
  assert.equal(bulk.notice.kind, "success");
  assert.deepEqual(bulk.heldElements, sequential.heldElements);
  assert.equal(Object.keys(bulk.looseBalls).length, 0);
  assert.equal(bulk.dayCondenseUsed, initialN);
  assert.equal(bulk.dayCondenseLimit, quota);
  assert.equal(bulk.labor.manualBallIds.length, 3);
  assert.equal(bulk.adeptalEnergy.earnedTotal - bulk.adeptalEnergy.spentTotal, bulk.adeptalEnergy.balance);
  assert.deepEqual(validateSave({ version: 6, game: bulk }), bulk);
});
test("V4 manual collection records preserve the tool qualification", () => {
  let g = newGame();
  for (let i = 0; i < 3; i++) {
    g = act(g, { type: "CONDENSE" });
    const ball = Object.values(g.looseBalls).at(-1)!;
    g = act(g, { type: "COLLECT_BALL", ballId: ball.id });
  }
  const historic = structuredClone(g) as unknown as Record<string, unknown>;
  historic.schemaVersion = 4;
  delete historic.discoveries; delete historic.labor; delete historic.technology;
  const restored = validateSave({ version: 4, game: historic })!;
  assert.equal(restored.labor.manualBallIds.length, 3);
  assert.ok(restored.discoveries.A18);
  assert.equal(restored.discoveries.A18?.sourceId, restored.labor.manualBallIds[2]);
  assert.deepEqual(validateSave({ version: 6, game: restored }), restored);
});
test("Legacy v4 energy and items migrate without rewards; new v5 rejects forging", () => {
  const old = newGame() as unknown as Record<string, unknown>;
  old.schemaVersion = 4;
  delete old.discoveries; delete old.labor; delete old.technology;
  const migrated = validateSave({ version: 4, game: old })!;
  assert.equal(migrated.schemaVersion, 6);
  assert.equal(migrated.discoveries.A00?.sourceId, "item:seed:1");
  assert.equal(migrated.adeptalEnergy.balance, 0);
  assert.deepEqual(validateSave({ version: 6, game: migrated }), migrated);
  const forged = structuredClone(migrated);
  forged.technology.collectBag = { unlockedAtDay: 1, evidenceIds: ["ball:1", "ball:2", "ball:3"] };
  assert.equal(validateSave({ version: 6, game: forged }), null);
  const future = structuredClone(migrated);
  future.discoveries.A01 = { id: "A01", completedAtDay: future.day + 1,
    eventId: "event:fake", sourceId: "plant:fake" };
  assert.equal(validateSave({ version: 6, game: future }), null);
});
