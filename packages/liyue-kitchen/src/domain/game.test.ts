import assert from "node:assert/strict";
import test from "node:test";
import { applyCommand, newGame, PLOT_IDS, type GameState } from "./game.ts";
import { createGameStore } from "./store.ts";
import { ELEMENTS, U2_CONFIG, vectorSum, zeros } from "./config.ts";
import { applyNaturalGrowth, newReactionState, productAmount, advanceSustained } from "./reactions.ts";
import { validateSave } from "./save.ts";

const cmd = (state: GameState, command: Parameters<typeof applyCommand>[1]) => applyCommand(state, command);
const seed = "item:seed:1";
function planted() { return cmd(newGame(), { type: "PLANT_SEED", itemId: seed, plotId: "P01" }); }
function tomorrow(state: GameState) {
  const requested = cmd(state, { type: "REQUEST_END_DAY" });
  return cmd(requested, { type: "CONFIRM_END_DAY", expectedDay: state.day });
}

test("newGame has exactly one stable Seed, seven independent Soils, and no free world-time growth", () => {
  const state = newGame();
  assert.deepEqual(Object.keys(state.plots), [...PLOT_IDS]);
  assert.equal(Object.keys(state.items).length, 1);
  assert.equal(state.items[seed]?.kind, "Seed");
  assert.equal(state.plots.P01.open, true);
  for (const id of PLOT_IDS.slice(1)) {
    assert.equal(state.plots[id].open, false);
    assert.equal(vectorSum(state.plots[id].soil), 0);
  }
  assert.equal(state.worldUH, 0);
  assert.equal(state.dayCondenseUsed, 0);
});

test("selection toggles, rejects locks without losing items or moving day", () => {
  const state = newGame();
  const first = cmd(state, { type: "SELECT_PLOT", plotId: "P01" });
  for (const id of PLOT_IDS.slice(1)) {
    const failed = cmd(first, { type: "SELECT_PLOT", plotId: id });
    assert.equal(failed.selectedPlotId, "P01");
    assert.equal(failed.day, 1);
    assert.equal(failed.adeptalEnergy, 0);
    assert.equal(failed.notice.kind, "locked");
  }
  assert.equal(cmd(first, { type: "SELECT_PLOT", plotId: "P01" }).selectedPlotId, null);
});

test("Seed->Plant is atomic, locked/invalid/second drops cannot duplicate or consume", () => {
  const start = newGame();
  const invalid = cmd(start, { type: "PLANT_SEED", itemId: seed, plotId: "P03" });
  assert.deepEqual(invalid.items, start.items);
  const success = cmd(start, { type: "PLANT_SEED", itemId: seed, plotId: "P01" });
  assert.equal(Object.keys(success.items).length, 0);
  assert.ok(success.plots.P01.plant?.id.startsWith("plant:"));
  const replay = cmd(success, { type: "PLANT_SEED", itemId: seed, plotId: "P01" });
  assert.deepEqual(replay.plots.P01, success.plots.P01);
  const unknown = cmd(start, { type: "PLANT_SEED", itemId: "seed:fake", plotId: "P01" });
  assert.equal(unknown.plots.P01.plant, null);
  assert.equal(unknown.items[seed]?.kind, "Seed");
});

test("condense deterministic seven pure 50V balls, shared N quota, collect once, water with exact V ledger", () => {
  let a = planted();
  let b = planted();
  for (let i = 0; i < U2_CONFIG.condensesPerDay; i++) {
    a = cmd(a, { type: "CONDENSE" });
    b = cmd(b, { type: "CONDENSE" });
  }
  assert.deepEqual(a.looseBalls, b.looseBalls);
  assert.equal(Object.keys(a.looseBalls).length, U2_CONFIG.condensesPerDay);
  const exhausted = cmd(a, { type: "CONDENSE" });
  assert.equal(Object.keys(exhausted.looseBalls).length, U2_CONFIG.condensesPerDay);
  const first = Object.values(a.looseBalls)[0];
  assert.ok(ELEMENTS.includes(first.element));
  assert.equal(first.initialV, 50);
  const collection = cmd(a, { type: "COLLECT_BALL", ballId: first.id });
  const secondCollection = cmd(collection, { type: "COLLECT_BALL", ballId: first.id });
  assert.strictEqual(secondCollection, collection);
  const i = ELEMENTS.indexOf(first.element);
  assert.equal(collection.heldElements[i], 50);
  const lockWater = cmd(collection, { type: "WATER_PLOT", plotId: "P02", element: first.element });
  assert.equal(lockWater.heldElements[i], 50);
  const watered = cmd(collection, { type: "WATER_PLOT", plotId: "P01", element: first.element });
  assert.equal(watered.heldElements[i], 0);
  assert.equal(watered.plots.P01.soil[i], 50);
  assert.equal(cmd(watered, { type: "WATER_PLOT", plotId: "P01", element: first.element }).plots.P01.soil[i], 50);
});

test("soil overcapacity scales every channel proportionally without inventing V", () => {
  let g = planted();
  g.heldElements = [800, 500, 0, 0, 0, 0, 0];
  g = cmd(g, { type: "WATER_PLOT", element: "Fire", plotId: "P01" });
  g = cmd(g, { type: "WATER_PLOT", element: "Hydro", plotId: "P01" });
  assert.ok(Math.abs(vectorSum(g.plots.P01.soil) - 1000) < 1e-8);
  assert.ok(Math.abs(g.plots.P01.soil[0] - 800 / 1.3) < 1e-8);
  assert.ok(Math.abs(g.plots.P01.soil[1] - 500 / 1.3) < 1e-8);
});

test("end-day is explicit, cancellable, time-stepped and duplicate confirmation idempotent", () => {
  let state = planted();
  state = cmd(state, { type: "CONDENSE" });
  assert.equal(state.worldUH, 0);
  const request = cmd(state, { type: "REQUEST_END_DAY" });
  assert.equal(request.worldUH, 0);
  const cancelled = cmd(request, { type: "CANCEL_END_DAY" });
  assert.equal(cancelled.worldUH, 0);
  const ready = cmd(cancelled, { type: "REQUEST_END_DAY" });
  const dawn = cmd(ready, { type: "CONFIRM_END_DAY", expectedDay: 1 });
  assert.equal(dawn.day, 2);
  assert.equal(dawn.worldUH, 24);
  assert.equal(dawn.dayCondenseUsed, 0);
  assert.equal(Object.keys(dawn.looseBalls).length, 0);
  assert.ok(dawn.lastNightReport?.ledger.ballDecayedV && dawn.lastNightReport.ledger.ballDecayedV > 49);
  const replay = cmd(dawn, { type: "CONFIRM_END_DAY", expectedDay: 1 });
  assert.strictEqual(replay, dawn);
  assert.equal(dawn.plots.P01.plant?.stage, "Seed");
  assert.deepEqual(dawn.plots.P01.plant?.treeGrowth, zeros());
});

test("night uses soil retention then one root budget; positive seven-vector mass flows", () => {
  let state = planted();
  state.heldElements = [100, 100, 100, 100, 100, 100, 100];
  for (const element of ELEMENTS) state = cmd(state, { type: "WATER_PLOT", plotId: "P01", element });
  const starting = vectorSum(state.plots.P01.soil);
  const dawn = tomorrow(state);
  const ledger = dawn.lastNightReport!.ledger;
  const afterSoil = vectorSum(dawn.plots.P01.soil);
  assert.ok(ledger.rootAbsorbedV > 0);
  assert.ok(ledger.soilEvaporatedV > 0);
  assert.ok(Math.abs(starting - afterSoil - ledger.rootAbsorbedV - ledger.soilEvaporatedV) < 1e-6);
  assert.ok(dawn.plots.P01.soil.every(x => x >= 0));
  assert.equal(dawn.plots.P01.plant!.reserve.every(x => x >= 0), true);
  assert.ok(vectorSum(dawn.plots.P01.plant!.treeGrowth) > 0);
  assert.equal(dawn.plots.P01.plant!.stage, "Seed");
});

test("multi-day deterministic replay reaches stage transitions with traceable reports", () => {
  const cycle = (initial: GameState) => {
    let state = initial;
    const days: Array<{ day: number; tree: string; leaves: number; soil: number; reserve: number }> = [];
    for (let d = 0; d < 18; d++) {
      for (let n = 0; n < state.dayCondenseLimit; n++) {
        state = cmd(state, { type: "CONDENSE" });
        const ball = Object.values(state.looseBalls).at(-1)!;
        state = cmd(state, { type: "COLLECT_BALL", ballId: ball.id });
        state = cmd(state, { type: "WATER_PLOT", element: ball.element, plotId: "P01" });
      }
      state = tomorrow(state);
      days.push({ day: state.day, tree: state.plots.P01.plant!.stage,
        leaves: state.plots.P01.plant!.leaves.length,
        soil: vectorSum(state.plots.P01.soil), reserve: vectorSum(state.plots.P01.plant!.reserve) });
    }
    return { state, days };
  };
  const a = cycle(planted()), b = cycle(planted());
  assert.deepEqual(a.days, b.days);
  assert.deepEqual(a.state, b.state);
  assert.ok(a.days.some(d => d.tree === "Seedling"));
  assert.ok(a.days.some(d => d.tree === "Sapling"));
  assert.ok(a.days.every(d => d.soil >= 0 && d.soil <= 1000 && d.reserve <= 180 + 1e-6));
  // Keep the output as a reproducible balance candidate, not an approved N/K decision.
  console.log("U2 replay N=8 K=24:", JSON.stringify(a.days));
});

test("reaction only starts from this real Growth: vaporize, freeze, hyperbloom and no empty-tick reactivation", () => {
  const free = zeros(); const reaction = newReactionState(); const events: string[] = [];
  free[1] = 15; free[0] = 40;
  // No new growth: old fire stock cannot trigger vaporize.
  applyNaturalGrowth(free, reaction, zeros(), events);
  assert.equal(productAmount(reaction), 0);
  const fresh = zeros(); fresh[0] = 1;
  applyNaturalGrowth(free, reaction, fresh, events);
  assert.equal(reaction.products["逆蒸发"], 45);
  assert.ok(Math.abs(free[0] - 11) < 1e-8);
  assert.equal(free[1], 0);
  const again = productAmount(reaction);
  applyNaturalGrowth(free, reaction, zeros(), events);
  assert.equal(productAmount(reaction), again);
  const flower = newReactionState(); const matter = zeros();
  matter[4] = 15; matter[1] = 60;
  const added = zeros(); added[1] = 1;
  applyNaturalGrowth(matter, flower, added, events);
  assert.equal(flower.products["草原核"], 45);
  matter[3] = 30; const electro = zeros(); electro[3] = 1;
  applyNaturalGrowth(matter, flower, electro, events);
  assert.equal(flower.products["超绽放"], 75);
  assert.equal(flower.products["草原核"], 0);
});

test("sustained electro-charge and burning settle one step, requiring real activation", () => {
  const r = newReactionState(); const v = zeros(); const logs: string[] = [];
  v[1] = 20; v[3] = 31;
  const addition = zeros(); addition[3] = 1;
  applyNaturalGrowth(v, r, addition, logs);
  assert.equal(r.charged, true);
  assert.equal(r.products["感电"], 24);
  advanceSustained(v, r, logs);
  assert.ok((r.products["感电"] ?? 0) > 24);
  assert.ok(v.every(n => n >= 0));
});

test("versioned saves accept a valid state, reject corruption and preserve exact single Seed", () => {
  const state = planted();
  const saved = validateSave({ version: 1, game: state });
  assert.deepEqual(saved, state);
  assert.equal(Object.keys(saved!.items).length, 0);
  assert.equal(validateSave({ version: 2, game: newGame() }), null);
  const bad = newGame(); bad.plots.P01.soil[0] = -1;
  assert.equal(validateSave({ version: 1, game: bad }), null);
});

test("store emits once and serializes persisted revisions without Seed duplication", async () => {
  const writes: GameState[] = [];
  const initial = planted();
  const store = createGameStore(initial, { persistence: {
    load: async () => initial,
    save: async state => { writes.push(state); },
  }});
  let calls = 0;
  const stop = store.subscribe(() => { calls++; });
  store.dispatch({ type: "SELECT_PLOT", plotId: "P01" });
  store.dispatch({ type: "CONDENSE" });
  await store.whenSaved();
  stop();
  assert.equal(writes.length, 2);
  assert.deepEqual(writes.at(-1), store.getSnapshot());
  assert.equal(Object.keys(store.getSnapshot().items).length, 0);
  assert.ok(calls >= 2);
});

test("mature fruit's 7D enrichment uses one pre-growth mass snapshot per uh", async () => {
  const { advancePlotOneUH, newTree, newLedger } = await import("./growth.ts");
  const { LEAF_TEMPLATE, FRUIT_TEMPLATE } = await import("./config.ts");
  const plot = structuredClone(newGame().plots.P01);
  const plant = newTree("plant:test");
  plant.stage = "Sapling";
  plant.reserve = [0, 0, 45, 0, 0, 0, 45]; // only Anemo and Geo: no legal ordinary/swirl target
  plant.budGrowth = null;
  plant.leaves.push({
    id: "leaf:test", stage: "FibrousLeaf", growth: zeros(), baseAffinity: [...LEAF_TEMPLATE],
    fruit: { stage: "MatureFruit", free: [0, 0, 45, 0, 0, 0, 45],
      baseAffinity: [...FRUIT_TEMPLATE], lockedAffinity: [...FRUIT_TEMPLATE],
      stageStart: zeros(), reaction: newReactionState() },
  });
  plot.plant = plant;
  const before = [...plant.reserve];
  advancePlotOneUH(plot, 1, () => 0.99, [], newLedger());
  const free = plant.leaves[0].fruit!.free;
  const spend = before.map((v, i) => v - plant.reserve[i]);
  const total = spend.reduce((a, b) => a + b, 0);
  assert.ok(total > 0);
  // One mother leaf, extraction affinity Anemo=1, Geo=.8, mature share40%.
  // Tree remainder and leaf share give per-element budgets; derive from actual
  // per-channel total spend, without making a second fake material account.
  const treeAffinity = [0.85, 1.15, 0.9, 0.75, 1.2, 0.7, 0.95];
  const nominalShare = (i: number) => 0.30 * Math.min(1, LEAF_TEMPLATE[i]) * 0.4;
  for (const i of [2, 6]) {
    // Each used V in reserve spent comprises mother fruit part plus tree part.
    // The tree budget equals total reserve spent, so the fruit is that share.
    const expected = spend[i] * nominalShare(i) * 0.5 * FRUIT_TEMPLATE[i];
    assert.ok(Math.abs((free[i] - 45) - expected) < 1e-9,
      `element ${i} uses a different M snapshot`);
    assert.ok(treeAffinity[i] > 0);
  }
});