import assert from "node:assert/strict";
import test from "node:test";
import { applyCommand, fruitMass, isEdible, newGame, type GameState } from "./game.ts";
import { newReactionState } from "./reactions.ts";
import { zeros } from "./config.ts";
import { validateSave } from "./save.ts";

const command = (g: GameState, c: Parameters<typeof applyCommand>[1]) => applyCommand(g, c);
const byKind = (g: GameState, kind: string) => {
  const x = Object.values(g.items).find(item => item.kind === kind);
  assert.ok(x, `missing ${kind}`);
  return x;
};
function mature(n = 1): GameState {
  const g = command(newGame(), { type: "PLANT_SEED", itemId: "item:seed:1", plotId: "P01" });
  const tree = g.plots.P01.plant!;
  tree.stage = "Sapling";
  for (let i = 0; i < n; i++) {
    tree.leaves.push({ id: `${tree.id}:leaf:${i + 1}`, stage: "FibrousLeaf",
      growth: zeros(), baseAffinity: [1, 1, 1, 1, 1, 1, 1],
      fruit: { stage: "MatureFruit", free: [10, 12, 13, 14, 15, 16, 20],
        baseAffinity: [1, 1, 1, 1, 1, 1, 1], lockedAffinity: [1, 1, 1, 1, 1, 1, 1],
        stageStart: zeros(), reaction: { ...newReactionState(),
          products: { "逆蒸发": 45 }, firstReaction: "逆蒸发" } } });
  }
  return g;
}
function harvested(n = 1) {
  let g = mature(n);
  const tree = g.plots.P01.plant!;
  for (const leaf of tree.leaves) {
    g = command(g, { type: "HARVEST", plotId: "P01", plantId: tree.id, leafId: leaf.id });
  }
  return g;
}
function moved(g: GameState, kind: string, slot: "peel" | "juice") {
  return command(g, { type: "MOVE_ITEM", itemId: byKind(g, kind).id,
    destination: { kind: "workbench", slot } });
}
function processed(g: GameState, kind: string, action: "PEEL" | "JUICE" | "CUP") {
  return command(g, { type: "PROCESS_ITEM", itemId: byKind(g, kind).id, action });
}

test("U4 three atomic processing steps conserve one edible E_free + Products and source", () => {
  let state = harvested();
  const source = byKind(state, "Aquamelon");
  assert.ok(isEdible(source));
  const original = structuredClone(source);
  const mass = fruitMass(source);
  const time = state.worldUH, quota = state.dayCondenseUsed;
  state = processed(moved(state, "Aquamelon", "peel"), "Aquamelon", "PEEL");
  assert.ok(!state.items[source.id]);
  const flesh = byKind(state, "PeeledFlesh");
  const shell = byKind(state, "Shell");
  assert.ok(isEdible(flesh));
  assert.deepEqual(flesh.free, original.free);
  assert.deepEqual(flesh.reaction, original.reaction);
  assert.deepEqual(flesh.baseAffinity, original.baseAffinity);
  assert.deepEqual(flesh.lockedAffinity, original.lockedAffinity);
  assert.deepEqual(flesh.source, original.source);
  assert.equal(flesh.parentItemId, original.id);
  assert.deepEqual(flesh.location, { kind: "workbench", slot: "peel" });
  assert.deepEqual(shell.location, { kind: "storage" });
  assert.ok(!Object.hasOwn(shell, "free") && !Object.hasOwn(shell, "reaction"));
  assert.equal(state.items[flesh.id].id, state.selectedItemId);

  state = processed(moved(state, "PeeledFlesh", "juice"), "PeeledFlesh", "JUICE");
  assert.ok(!state.items[flesh.id]);
  const juice = byKind(state, "RawJuice");
  assert.ok(isEdible(juice));
  assert.equal(juice.parentItemId, flesh.id);
  assert.deepEqual(juice.free, original.free);
  state = processed(state, "RawJuice", "CUP");
  assert.ok(!state.items[juice.id]);
  const cup = byKind(state, "AquamelonJuiceCup");
  assert.ok(isEdible(cup));
  assert.equal(cup.parentItemId, juice.id);
  assert.deepEqual(cup.source, original.source);
  assert.deepEqual(cup.free, original.free);
  assert.deepEqual(cup.reaction, original.reaction);
  assert.deepEqual(cup.lockedAffinity, original.lockedAffinity);
  assert.equal(fruitMass(cup), mass);
  assert.deepEqual(cup.location, { kind: "workbench", slot: "juice" });
  assert.equal(Object.keys(state.items).length, 2);
  assert.ok(!Object.values(state.items).some(x => x.kind === "EmptyCup"));
  assert.equal(state.worldUH, time);
  assert.equal(state.dayCondenseUsed, quota);
  assert.deepEqual(validateSave({ version: 3, game: state }), state);
  const replay = command(state, { type: "PROCESS_ITEM", itemId: juice.id, action: "CUP" });
  assert.deepEqual(replay.items, state.items);
  assert.equal(replay.nextObjectSeq, state.nextObjectSeq);
});

test("U4 wrong materials, wrong workbench, full slots and confirmation cannot process", () => {
  const start = harvested(2);
  const [first, second] = Object.values(start.items).filter(x => x.kind === "Aquamelon");
  assert.ok(first && second);
  assert.equal(command(start, { type: "PROCESS_ITEM", itemId: first.id, action: "PEEL" }).notice.kind, "locked");
  assert.equal(command(start, { type: "MOVE_ITEM", itemId: first.id,
    destination: { kind: "workbench", slot: "juice" } }).items[first.id].location.kind, "ground");
  let busy = command(start, { type: "MOVE_ITEM", itemId: first.id, destination: { kind: "workbench", slot: "peel" } });
  const rejected = command(busy, { type: "MOVE_ITEM", itemId: second.id,
    destination: { kind: "workbench", slot: "peel" } });
  assert.deepEqual(rejected.items, busy.items);
  assert.equal(rejected.notice.kind, "locked");
  const confirming = command(busy, { type: "REQUEST_END_DAY" });
  assert.strictEqual(command(confirming, { type: "PROCESS_ITEM", itemId: first.id, action: "PEEL" }), confirming);
  assert.strictEqual(command(confirming, { type: "MOVE_ITEM", itemId: first.id,
    destination: { kind: "storage" } }), confirming);
  busy = processed(busy, "Aquamelon", "PEEL");
  assert.equal(command(busy, { type: "PROCESS_ITEM", itemId: first.id, action: "PEEL" }).notice.kind, "locked");
  const shell = byKind(busy, "Shell");
  assert.equal(command(busy, { type: "MOVE_ITEM", itemId: shell.id,
    destination: { kind: "workbench", slot: "peel" } }).notice.kind, "locked");
  const cancelled = command(busy, { type: "REJECT_DROP", reason: "已取消拖放" });
  assert.deepEqual(cancelled.items, busy.items);
  assert.equal(Object.values(cancelled.items).filter(isEdible).length, 2);
});

test("U4 v1/v2 migrations preserve unique IDs and v3 validates workbench state", () => {
  const oldU2 = newGame() as unknown as Record<string, unknown>;
  oldU2.schemaVersion = 1; delete oldU2.selectedItemId;
  (oldU2.items as Record<string, { location: unknown }>)["item:seed:1"].location = "inventory";
  const migratedSeed = validateSave({ version: 1, game: oldU2 })!;
  assert.equal(migratedSeed.schemaVersion, 3);
  assert.deepEqual(Object.keys(migratedSeed.items), ["item:seed:1"]);
  const oldU3 = harvested() as unknown as Record<string, unknown>;
  oldU3.schemaVersion = 2;
  const migratedFruit = validateSave({ version: 2, game: oldU3 })!;
  assert.equal(migratedFruit.schemaVersion, 3);
  assert.deepEqual(migratedFruit.items, oldU3.items);
  let workbench = processed(moved(migratedFruit, "Aquamelon", "peel"), "Aquamelon", "PEEL");
  assert.deepEqual(validateSave({ version: 3, game: workbench }), workbench);
  const edible = byKind(workbench, "PeeledFlesh");
  const duplicate = structuredClone(workbench);
  duplicate.items["item:duplicate"] = { ...structuredClone(edible), id: "item:duplicate" };
  assert.equal(validateSave({ version: 3, game: duplicate }), null);
  const shell = byKind(workbench, "Shell");
  const forgedShell = structuredClone(workbench);
  forgedShell.items[shell.id] = { ...shell, free: [1, 0, 0, 0, 0, 0, 0] };
  assert.equal(validateSave({ version: 3, game: forgedShell }), null);
  workbench = moved(workbench, "PeeledFlesh", "juice");
  workbench = processed(workbench, "PeeledFlesh", "JUICE");
  assert.deepEqual(validateSave({ version: 3, game: workbench }), workbench);
});
