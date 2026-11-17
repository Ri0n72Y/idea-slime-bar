import assert from "node:assert/strict";
import test from "node:test";
import { applyCommand, isEdible, newGame, PLOT_IDS, type GameState } from "./game.ts";
import { newTree } from "./growth.ts";
import { zeros } from "./config.ts";
import { ECONOMY_CANDIDATE } from "./economy.ts";
import { validateSave } from "./save.ts";

const cmd = (g: GameState, c: Parameters<typeof applyCommand>[1]) => applyCommand(g, c);
function tomorrow(g: GameState) {
  const requested = cmd(g, { type: "REQUEST_END_DAY" });
  return cmd(requested, { type: "CONFIRM_END_DAY", expectedDay: g.day });
}
const balance = (g: GameState) =>
  assert.equal(g.adeptalEnergy.earnedTotal - g.adeptalEnergy.spentTotal, g.adeptalEnergy.balance);
function matureLeaf(g: GameState, plotId: "P01" | "P02" = "P01") {
  const plot = g.plots[plotId];
  if (!plot.plant) plot.plant = newTree("plant:test:" + plotId);
  const tree = plot.plant;
  const id = tree.id + ":leaf:" + (tree.leaves.length + 1);
  tree.stage = "Sapling";
  tree.leaves.push({
    id, stage: "FibrousLeaf", growth: zeros(), baseAffinity: [1,1,1,1,1,1,1],
    fruit: { stage: "MatureFruit", free: [10,12,13,14,15,16,20],
      baseAffinity: [1,1,1,1,1,1,1], lockedAffinity: null, stageStart: zeros(),
      reaction: { firstReaction: null, products: {}, charged: false, burning: false } },
  });
  return { plotId, plantId: tree.id, leafId: id };
}
function harvestFixture() {
  const g = newGame();
  const source = matureLeaf(g);
  return cmd(g, { type: "HARVEST", ...source });
}
const find = (g: GameState, kind: string) => {
  const item = Object.values(g.items).find(x => x.kind === kind);
  assert.ok(item, "missing " + kind);
  return item;
};
const firstOrder = (g: GameState) => Object.values(g.orders).find(
  x => x.state === "available" || x.state === "accepted")!;
test("Batch A: only nutrient-fed nights reward a planted cycle once; zero-growth nights are free", () => {
  let g = cmd(newGame(), { type: "PLANT_SEED", itemId: "item:seed:1", plotId: "P01" });
  assert.equal(g.adeptalEnergy.balance, 0);
  g = tomorrow(g);
  assert.equal(g.adeptalEnergy.balance, 0);
  g = cmd(g, { type: "CONDENSE" });
  const ball = Object.values(g.looseBalls)[0];
  g = cmd(g, { type: "COLLECT_BALL", ballId: ball.id });
  g = cmd(g, { type: "WATER_PLOT", plotId: "P01", element: ball.element });
  g = tomorrow(g);
  assert.equal(g.adeptalEnergy.balance, ECONOMY_CANDIDATE.growthCycle);
  assert.equal(g.adeptalEnergy.rewardedIds.length, 1);
  g = tomorrow(g);
  assert.equal(g.adeptalEnergy.rewardedIds.length, 1);
  balance(g);
  assert.deepEqual(validateSave({ version: 6, game: g }), g);
});
test("Batch A: a mature fruit yields exactly one provenance Seed and no duplicate harvest reward", () => {
  const start = newGame();
  const src = matureLeaf(start);
  const g = cmd(start, { type: "HARVEST", ...src });
  const seed = find(g, "Seed"); // initial seed remains; harvested seed is a second Seed.
  assert.ok(seed);
  const newSeed = Object.values(g.items).find(x => x.kind === "Seed" && x.id !== "item:seed:1")!;
  assert.ok(newSeed && newSeed.kind === "Seed" && newSeed.origin);
  assert.deepEqual(newSeed.origin, src);
  const fruit = find(g, "Aquamelon");
  assert.ok(isEdible(fruit));
  assert.equal(g.harvestedSources.length, 1);
  assert.equal(g.adeptalEnergy.balance, ECONOMY_CANDIDATE.matureHarvest);
  assert.ok(g.eventLog.some(e => e.message.includes(newSeed.id)));
  const repeated = cmd(g, { type: "HARVEST", ...src });
  assert.deepEqual(repeated.items, g.items);
  assert.equal(repeated.nextObjectSeq, g.nextObjectSeq);
  assert.equal(repeated.adeptalEnergy.earnedTotal, g.adeptalEnergy.earnedTotal);
  balance(g);
});
test("Batch A: accept, consume one exact fruit, award once, then juice cup is next offer", () => {
  let g = harvestFixture();
  const first = firstOrder(g);
  const fruit = find(g, "Aquamelon");
  assert.equal(first.itemKind, "aquamelon");
  const noAccept = cmd(g, { type: "DELIVER_ORDER", orderId: first.id, itemIds: [fruit.id] });
  assert.deepEqual(noAccept.items, g.items);
  assert.equal(noAccept.notice.kind, "locked");
  g = cmd(g, { type: "ACCEPT_ORDER", orderId: first.id });
  assert.equal(firstOrder(g).state, "accepted");
  const notInInventory = cmd(g, { type: "DELIVER_ORDER", orderId: first.id, itemIds: [fruit.id] });
  assert.deepEqual(notInInventory.items, g.items);
  g = cmd(g, { type: "MOVE_ITEM", itemId: fruit.id, destination: { kind: "storage" } });
  const wrong = cmd(g, { type: "DELIVER_ORDER", orderId: first.id, itemIds: ["item:seed:1"] });
  assert.equal(wrong.notice.kind, "locked");
  assert.deepEqual(wrong.items, g.items);
  const oldEnergy = g.adeptalEnergy.earnedTotal;
  g = cmd(g, { type: "DELIVER_ORDER", orderId: first.id, itemIds: [fruit.id] });
  assert.equal(g.orders[first.id].state, "completed");
  assert.ok(!g.items[fruit.id]);
  assert.deepEqual(g.orders[first.id].deliveredItemIds, [fruit.id]);
  assert.equal(g.adeptalEnergy.earnedTotal - oldEnergy, ECONOMY_CANDIDATE.orderDelivery);
  assert.equal(firstOrder(g).itemKind, "juice_cup");
  const again = cmd(g, { type: "DELIVER_ORDER", orderId: first.id, itemIds: [fruit.id] });
  assert.deepEqual(again.items, g.items);
  assert.equal(again.adeptalEnergy.balance, g.adeptalEnergy.balance);
  balance(g);
  assert.deepEqual(validateSave({ version: 6, game: g }), g);
});
test("Batch A: processing the true fruit to cup, rejecting raw juice, then delivering cup", () => {
  let g = harvestFixture();
  let order = firstOrder(g);
  const fruit = find(g, "Aquamelon");
  g = cmd(g, { type: "ACCEPT_ORDER", orderId: order.id });
  g = cmd(g, { type: "MOVE_ITEM", itemId: fruit.id, destination: { kind: "storage" } });
  g = cmd(g, { type: "DELIVER_ORDER", orderId: order.id, itemIds: [fruit.id] });
  order = firstOrder(g);
  g = cmd(g, { type: "ACCEPT_ORDER", orderId: order.id });
  // A second real harvest carries a second independent edible material source.
  const secondSource = matureLeaf(g);
  g = cmd(g, { type: "HARVEST", ...secondSource });
  const nextFruit = find(g, "Aquamelon");
  g = cmd(g, { type: "MOVE_ITEM", itemId: nextFruit.id, destination: { kind: "workbench", slot: "peel" } });
  g = cmd(g, { type: "PROCESS_ITEM", itemId: nextFruit.id, action: "PEEL" });
  const flesh = find(g, "PeeledFlesh");
  g = cmd(g, { type: "MOVE_ITEM", itemId: flesh.id, destination: { kind: "workbench", slot: "juice" } });
  g = cmd(g, { type: "PROCESS_ITEM", itemId: flesh.id, action: "JUICE" });
  const raw = find(g, "RawJuice");
  g = cmd(g, { type: "MOVE_ITEM", itemId: raw.id, destination: { kind: "storage" } });
  const rejected = cmd(g, { type: "DELIVER_ORDER", orderId: order.id, itemIds: [raw.id] });
  assert.deepEqual(rejected.items, g.items);
  assert.equal(rejected.notice.kind, "locked");
  g = cmd(g, { type: "MOVE_ITEM", itemId: raw.id, destination: { kind: "workbench", slot: "juice" } });
  g = cmd(g, { type: "PROCESS_ITEM", itemId: raw.id, action: "CUP" });
  const cup = find(g, "AquamelonJuiceCup");
  g = cmd(g, { type: "MOVE_ITEM", itemId: cup.id, destination: { kind: "inventory" } });
  g = cmd(g, { type: "DELIVER_ORDER", orderId: order.id, itemIds: [cup.id] });
  assert.equal(g.orders[order.id].state, "completed");
  assert.ok(!g.items[cup.id]);
  assert.equal(g.adeptalEnergy.rewardedIds.filter(x => x.startsWith("order:")).length, 2);
  balance(g);
  assert.deepEqual(validateSave({ version: 6, game: g }), g);
});
test("Batch A: due day remains playable; next morning expires and re-offers same type", () => {
  let a = newGame(), b = newGame();
  a.day = a.orders["order:first"].dueDay;
  a = cmd(a, { type: "ACCEPT_ORDER", orderId: "order:first" });
  assert.equal(a.orders["order:first"].state, "accepted");
  b.day = b.orders["order:first"].dueDay;
  b = tomorrow(b);
  assert.equal(b.orders["order:first"].state, "expired");
  assert.equal(b.adeptalEnergy.balance, 0);
  assert.ok(firstOrder(b));
  assert.equal(firstOrder(b).itemKind, "aquamelon");
  assert.equal(firstOrder(b).postedDay, b.day);
  assert.equal(firstOrder(b).state, "available");
  assert.equal(cmd(b, { type: "ACCEPT_ORDER", orderId: "order:first" }).notice.kind, "locked");
  assert.deepEqual(validateSave({ version: 6, game: b }), b);
});
test("Batch A: two plots grow independently, N is global, unaffordable and repeat unlocks are atomic", () => {
  let g = newGame();
  const premature = cmd(g, { type: "UNLOCK_PLOT", plotId: "P02" });
  assert.equal(premature.notice.kind, "locked");
  assert.equal(premature.plots.P02.open, false);
  assert.equal(premature.adeptalEnergy.spentTotal, 0);
  const src = matureLeaf(g);
  g = cmd(g, { type: "HARVEST", ...src });
  const newSeed = Object.values(g.items).find(x => x.kind === "Seed" && x.id !== "item:seed:1")!;
  // Real planting-cycle income must originate from nighttime Growth, not a command.
  g = cmd(g, { type: "CONDENSE" });
  const ball = Object.values(g.looseBalls)[0];
  g = cmd(g, { type: "COLLECT_BALL", ballId: ball.id });
  g = cmd(g, { type: "WATER_PLOT", plotId: "P01", element: ball.element });
  g = tomorrow(g);
  assert.equal(g.adeptalEnergy.balance, ECONOMY_CANDIDATE.matureHarvest + ECONOMY_CANDIDATE.growthCycle);
  g = cmd(g, { type: "UNLOCK_PLOT", plotId: "P02" });
  assert.ok(g.plots.P02.open);
  assert.equal(g.adeptalEnergy.balance, 0);
  assert.equal(g.adeptalEnergy.spentTotal, ECONOMY_CANDIDATE.plotCosts.P02);
  const after = cmd(g, { type: "UNLOCK_PLOT", plotId: "P02" });
  assert.equal(after.adeptalEnergy.spentTotal, g.adeptalEnergy.spentTotal);
  g = cmd(g, { type: "PLANT_SEED", plotId: "P02", itemId: newSeed.id });
  assert.equal(g.plots.P02.plant?.stage, "Seed");
  assert.equal(g.items[newSeed.id], undefined);
  assert.equal(g.plots.P01.plant?.id, src.plantId);
  // Refill both soils from the SAME N quota and run a real night on both cells.
  const beforeQuota = g.dayCondenseUsed;
  for (let i = beforeQuota; i < g.dayCondenseLimit; i++) {
    g = cmd(g, { type: "CONDENSE" });
    const newBall = Object.values(g.looseBalls).at(-1)!;
    g = cmd(g, { type: "COLLECT_BALL", ballId: newBall.id });
    g = cmd(g, { type: "WATER_PLOT", plotId: i % 2 ? "P02" : "P01", element: newBall.element });
  }
  assert.equal(g.dayCondenseUsed, g.dayCondenseLimit);
  g = tomorrow(g);
  assert.ok(g.plots.P02.plant && g.plots.P02.plant.treeGrowth.some(v => v > 0));
  assert.equal(g.plots.P01.open, true);
  assert.equal(g.dayCondenseLimit, 8);
  balance(g);
  assert.deepEqual(validateSave({ version: 6, game: g }), g);
});
test("Batch A: harvested provenance remains valid after planting a replacement in the same plot", () => {
  let g = harvestFixture();
  const fruit = find(g, "Aquamelon");
  const originalPlant = g.plots.P01.plant!.id;
  const originalSeed = Object.values(g.items).find(x => x.kind === "Seed" && x.id !== "item:seed:1")!;
  g = cmd(g, { type: "PLANT_SEED", plotId: "P01", itemId: originalSeed.id });
  assert.notEqual(g.plots.P01.plant?.id, originalPlant);
  assert.deepEqual(g.items[fruit.id], fruit);
  assert.deepEqual(validateSave({ version: 6, game: g }), g);
  assert.equal(g.harvestedSources.length, 1);
  assert.equal(g.items[originalSeed.id], undefined);
  // Replant cannot be used to instantly farm another growth-cycle reward.
  const lastBalance = g.adeptalEnergy.balance;
  const twice = cmd(g, { type: "PLANT_SEED", plotId: "P01", itemId: "item:seed:1" });
  assert.equal(twice.notice.kind, "locked");
  assert.equal(twice.adeptalEnergy.balance, lastBalance);
});
test("Batch A: validation rejects energy minting, duplicate rewarded IDs, invalid unlock and cloned provenance", () => {
  const original = harvestFixture();
  const minted = structuredClone(original);
  minted.adeptalEnergy.balance++;
  assert.equal(validateSave({ version: 6, game: minted }), null);
  const repeated = structuredClone(original);
  repeated.adeptalEnergy.rewardedIds.push(repeated.adeptalEnergy.rewardedIds[0]);
  assert.equal(validateSave({ version: 6, game: repeated }), null);
  const forgedUnlock = structuredClone(original);
  forgedUnlock.plots.P02.open = true;
  assert.equal(validateSave({ version: 6, game: forgedUnlock }), null);
  const fruit = find(original, "Aquamelon");
  const clone = structuredClone(original);
  clone.items["item:clone"] = { ...fruit, id: "item:clone" };
  assert.equal(validateSave({ version: 6, game: clone }), null);
  const clonedSeed = structuredClone(original);
  const savedSeed = Object.values(clonedSeed.items).find(
    x => x.kind === "Seed" && x.id !== "item:seed:1")!;
  clonedSeed.items["item:duplicate-seed"] = { ...savedSeed, id: "item:duplicate-seed" };
  assert.equal(validateSave({ version: 6, game: clonedSeed }), null);
  for (const plot of PLOT_IDS.slice(1)) assert.equal(original.plots[plot].open, false);
});
