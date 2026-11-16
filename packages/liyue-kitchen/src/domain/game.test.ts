import assert from "node:assert/strict";
import test from "node:test";
import { applyCommand, newGame, PLOT_IDS, type GameState } from "./game.ts";
import { createGameStore } from "./store.ts";
import { ELEMENTS, U2_CONFIG, vectorSum, zeros } from "./config.ts";
import { applyNaturalGrowth, newReactionState, productAmount, advanceSustained, reproductiveMass } from "./reactions.ts";
import { validateSave } from "./save.ts";
import { newTree } from "./growth.ts";

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
    assert.equal(failed.adeptalEnergy.balance, 0);
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
    const days: Array<{
      day: number; tree: string; leaves: number; mature: number;
      soil: number; reserve: number; evaporated: number; absorbed: number;
      reserveSpent: number; treeGained: number; organGained: number;
    }> = [];
    for (let d = 0; d < 18; d++) {
      for (let n = 0; n < state.dayCondenseLimit; n++) {
        state = cmd(state, { type: "CONDENSE" });
        const ball = Object.values(state.looseBalls).at(-1)!;
        state = cmd(state, { type: "COLLECT_BALL", ballId: ball.id });
        state = cmd(state, { type: "WATER_PLOT", element: ball.element, plotId: "P01" });
      }
      state = tomorrow(state);
      const plant = state.plots.P01.plant!;
      const ledger = state.lastNightReport!.ledger;
      days.push({ day: state.day, tree: plant.stage,
        leaves: plant.leaves.length,
        mature: plant.leaves.filter(leaf => leaf.fruit?.stage === "MatureFruit").length,
        soil: vectorSum(state.plots.P01.soil), reserve: vectorSum(plant.reserve),
        evaporated: ledger.soilEvaporatedV, absorbed: ledger.rootAbsorbedV,
        reserveSpent: ledger.reserveConsumedV, treeGained: ledger.newTreeGrowthG,
        organGained: ledger.newOrganGrowthG });
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
  console.log("U2_TRACE_12:", JSON.stringify(a.days.slice(0, 12)));
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
  const saved = validateSave({ version: 5, game: state });
  assert.deepEqual(saved, state);
  assert.equal(Object.keys(saved!.items).length, 0);
  assert.equal(validateSave({ version: 6, game: newGame() }), null);
  const bad = newGame(); bad.plots.P01.soil[0] = -1;
  assert.equal(validateSave({ version: 5, game: bad }), null);
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


test("M1/M2: full wind strength and total mass ledger on a single swirl", () => {
  const free = zeros();
  const reaction = newReactionState();
  const events: string[] = [];
  free[0] = 60; // Fire
  free[2] = 59; // Anemo
  const added = zeros();
  added[2] = 1; // A real Anemo Growth input takes wind to 2U.
  const before = vectorSum(free);
  const net = applyNaturalGrowth(free, reaction, added, events);

  // W=2, A_source=0.8*2=1.6 >= 0.5*W=1 => R=2 (not 1).
  // d=1, windSpent=2, propagated gain=2.76U=82.8G.
  assert.ok(Math.abs(free[0] - 112.8) < 1e-9);
  assert.ok(Math.abs(free[2]) < 1e-9);
  assert.ok(Math.abs(net - (-7.2)) < 1e-9);
  assert.ok(Math.abs(net - (vectorSum(free) - before - added[2])) < 1e-9);
  assert.equal(productAmount(reaction), 0); // Swirl creates no product entry.
  assert.equal(events.filter(x => x.startsWith("风扩散：")).length, 1);
});

test("M1/M2: electro-charged double swirl recomputes R after wind spent", () => {
  const free = zeros();
  const reaction = newReactionState();
  reaction.charged = true; // Only an already active charged state enables double swirl.
  free[1] = 15; // Hydro
  free[3] = 15; // Electro
  free[2] = 59; // Anemo
  const before = reproductiveMass(free, reaction);
  const added = zeros();
  added[2] = 1;
  const events: string[] = [];
  const delta = applyNaturalGrowth(free, reaction, added, events);

  // First Electro then Hydro; each uses one remaining 1U wind share.
  // A_source=0.4U, R=0.4U, d=0.5U => gain=1.16U each.
  assert.ok(Math.abs(free[3] - 34.8) < 1e-9);
  assert.ok(Math.abs(free[1] - 34.8) < 1e-9);
  assert.ok(Math.abs(free[2]) < 1e-9);
  assert.equal(events.filter(x => x.startsWith("风扩散：")).length, 2);
  assert.ok(Math.abs(delta - (-20.4)) < 1e-9);
  assert.ok(Math.abs(delta - (reproductiveMass(free, reaction) - before - added[2])) < 1e-9);
});

test("M3: mature fruit at 150G refunds its full nominal V share to Tree/Bud", async () => {
  const { advancePlotOneUH, newTree, newLedger } = await import("./growth.ts");
  const { LEAF_TEMPLATE, FRUIT_TEMPLATE } = await import("./config.ts");
  const plot = structuredClone(newGame().plots.P01);
  const tree = newTree("plant:mature-refund");
  tree.stage = "Sapling";
  tree.reserve = [0, 0, 45, 0, 0, 0, 45];
  tree.budGrowth = null;
  tree.leaves.push({
    id: "leaf:fibrous", stage: "FibrousLeaf", growth: zeros(), baseAffinity: [...LEAF_TEMPLATE],
    fruit: {
      stage: "MatureFruit", free: [0, 0, 75, 0, 0, 0, 75],
      baseAffinity: [...FRUIT_TEMPLATE], lockedAffinity: [...FRUIT_TEMPLATE],
      stageStart: zeros(), reaction: newReactionState(),
    },
  });
  plot.plant = tree;
  const initialReserve = vectorSum(tree.reserve);
  const initialFruit = structuredClone(tree.leaves[0].fruit!.free);
  const ledger = newLedger();
  advancePlotOneUH(plot, 1, () => 0.99, [], ledger);

  assert.ok(ledger.reserveConsumedV > 0, "the budget is really spent by Tree");
  assert.ok(Math.abs(ledger.organConsumedV) < 1e-10);
  assert.ok(Math.abs(ledger.newOrganGrowthG) < 1e-10);
  assert.ok(Math.abs(ledger.leafEnvironmentalLossV) < 1e-10);
  assert.deepEqual(tree.leaves[0].fruit!.free, initialFruit);
  assert.ok(Math.abs(ledger.reserveConsumedV - ledger.directTreeConvertedV) < 1e-9);
  assert.ok(Math.abs(ledger.newTreeGrowthG - ledger.directTreeConvertedV) < 1e-9);
  assert.ok(Math.abs(initialReserve - vectorSum(tree.reserve) - ledger.reserveConsumedV) < 1e-9);
});

test("M3: partially enriched fruit only withdraws factor-scaled V, remainder feeds Tree", async () => {
  const { advancePlotOneUH, newTree, newLedger } = await import("./growth.ts");
  const { LEAF_TEMPLATE, FRUIT_TEMPLATE } = await import("./config.ts");
  const plot = structuredClone(newGame().plots.P01);
  const tree = newTree("plant:partial-refund");
  tree.stage = "Sapling";
  tree.reserve = [0, 0, 45, 0, 0, 0, 45];
  tree.budGrowth = null;
  tree.leaves.push({
    id: "leaf:fibrous", stage: "FibrousLeaf", growth: zeros(), baseAffinity: [...LEAF_TEMPLATE],
    fruit: {
      stage: "MatureFruit", free: [0, 0, 60, 0, 0, 0, 60],
      baseAffinity: [...FRUIT_TEMPLATE], lockedAffinity: [...FRUIT_TEMPLATE],
      stageStart: zeros(), reaction: newReactionState(),
    },
  });
  plot.plant = tree;
  const reserveBefore = [...tree.reserve];
  const ledger = newLedger();
  advancePlotOneUH(plot, 1, () => 0.99, [], ledger);
  const fruitFree = tree.leaves[0].fruit!.free;
  let usedFruitV = 0;
  for (const i of [2, 6]) {
    const budget = reserveBefore[i] - tree.reserve[i];
    const expectedFruitV = budget * 0.30 * Math.min(1, LEAF_TEMPLATE[i]) * 0.4 * 0.25;
    const fruitIncrease = fruitFree[i] - 60;
    assert.ok(Math.abs(fruitIncrease - expectedFruitV * FRUIT_TEMPLATE[i]) < 1e-9);
    usedFruitV += expectedFruitV;
  }
  assert.ok(usedFruitV > 0);
  assert.ok(Math.abs(ledger.organConsumedV - usedFruitV) < 1e-9);
  assert.ok(Math.abs(ledger.reserveConsumedV -
    ledger.directTreeConvertedV - ledger.organConsumedV) < 1e-9);
  assert.ok(ledger.directTreeConvertedV > ledger.organConsumedV);
});

test("M4: first IndexedDB save blocks interactions until it commits in the same queue", async () => {
  let releaseInitial!: () => void;
  let firstSaveStarted!: () => void;
  const pending = new Promise<void>(resolve => { releaseInitial = resolve; });
  const started = new Promise<void>(resolve => { firstSaveStarted = resolve; });
  const persisted: GameState[] = [];
  let calls = 0;
  const store = createGameStore(newGame(), {
    initialReady: false,
    persistence: {
      load: async () => null,
      save: async snapshot => {
        calls++;
        if (calls === 1) {
          firstSaveStarted();
          await pending;
        }
        persisted.push(structuredClone(snapshot));
      },
    },
  });
  const boot = store.start();
  await started;
  try {
    assert.equal(store.isReady(), false);
    assert.equal(store.getSaveStatus(), "saving");
    // Attempts during initial async persistence cannot consume or overwrite seed.
    store.dispatch({ type: "CONDENSE" });
    assert.equal(store.getSnapshot().dayCondenseUsed, 0);
    assert.equal(calls, 1);
  } finally {
    releaseInitial();
  }
  await boot;
  assert.equal(store.isReady(), true);
  store.dispatch({ type: "CONDENSE" });
  await store.whenSaved();
  assert.equal(calls, 2);
  assert.equal(persisted[0].dayCondenseUsed, 0);
  assert.equal(persisted[1].dayCondenseUsed, 1);
  assert.deepEqual(persisted.at(-1), store.getSnapshot());
  assert.equal(Object.keys(persisted.at(-1)!.items).length, 1);
});

function matureFixture(): GameState {
  const g = planted();
  const tree = g.plots.P01.plant!;
  tree.stage = "Sapling";
  tree.reserve = [1, 2, 3, 4, 5, 6, 7];
  tree.leaves = [{ id: tree.id + ":leaf:1", stage: "FibrousLeaf",
    growth: zeros(), baseAffinity: [1, 1, 1, 1, 1, 1, 1],
    fruit: { stage: "MatureFruit", free: [10, 12, 13, 14, 15, 16, 20],
      reaction: { products: { "逆蒸发": 45 }, firstReaction: "逆蒸发", charged: true, burning: false },
      baseAffinity: [1, 1, 1, 1, 1, 1, 1], lockedAffinity: [1, 1, 1, 1, 1, 1, 1],
      stageStart: zeros() },
  }];
  return g;
}

test("U3 harvest: mature-only, authentic plot/plant/leaf, single ground fruit and material transfer", () => {
  const initial = matureFixture();
  const tree = initial.plots.P01.plant!;
  const leaf = tree.leaves[0];
  const fruit = leaf.fruit!;
  const mass = reproductiveMass(fruit.free, fruit.reaction);
  const harvest = { type: "HARVEST" as const, plotId: "P01" as const, plantId: tree.id, leafId: leaf.id };
  const wrongPlant = cmd(initial, { ...harvest, plantId: "unknown" });
  assert.deepEqual(wrongPlant.items, initial.items);
  assert.equal(cmd(initial, { ...harvest, plotId: "P02" }).items["item:aquamelon:3"], undefined);
  assert.equal(cmd(initial, { ...harvest, leafId: "missing" }).items["item:aquamelon:3"], undefined);
  const immature = structuredClone(initial);
  immature.plots.P01.plant!.leaves[0].fruit!.stage = "GreenFruit";
  assert.equal(Object.values(cmd(immature, harvest).items).filter(i => i.kind === "Aquamelon").length, 0);
  const confirming = cmd(initial, { type: "REQUEST_END_DAY" });
  assert.strictEqual(cmd(confirming, harvest), confirming);
  const done = cmd(initial, harvest);
  const items = Object.values(done.items).filter(i => i.kind === "Aquamelon");
  assert.equal(items.length, 1);
  const item = items[0];
  assert.equal(item.kind, "Aquamelon");
  if (item.kind !== "Aquamelon") return;
  assert.equal(item.location.kind, "ground");
  assert.deepEqual(item.source, { plotId: "P01", plantId: tree.id, leafId: leaf.id });
  assert.deepEqual(item.free, fruit.free);
  assert.deepEqual(item.baseAffinity, fruit.baseAffinity);
  assert.deepEqual(item.reaction.products, fruit.reaction.products);
  assert.equal(item.reaction.firstReaction, "逆蒸发");
  assert.equal(item.reaction.charged, false);
  assert.ok(Math.abs(reproductiveMass(item.free, item.reaction) - mass) < 1e-8);
  assert.equal(done.plots.P01.plant!.leaves[0].fruit, null);
  assert.equal(initial.plots.P01.plant!.leaves[0].fruit!.stage, "MatureFruit");
  const repeated = cmd(done, harvest);
  assert.deepEqual(repeated.items, done.items);
  assert.equal(repeated.nextObjectSeq, done.nextObjectSeq);
  const night = tomorrow(done);
  const preserved = night.items[item.id];
  assert.deepEqual(preserved, item);
  assert.equal(night.plots.P01.plant!.leaves[0].fruit, null);
});

test("U3 one item moves ground → inventory → storage → ground with stable material and IDs", () => {
  let state = matureFixture();
  const leaf = state.plots.P01.plant!.leaves[0];
  state = cmd(state, { type: "HARVEST", plotId: "P01", plantId: state.plots.P01.plant!.id, leafId: leaf.id });
  const item = Object.values(state.items).find(x => x.kind === "Aquamelon")!;
  const original = structuredClone(item);
  const reject = cmd(state, { type: "MOVE_ITEM", itemId: item.id,
    destination: { kind: "ground", plotId: "P02", x: 0.5, y: 0.5 } });
  assert.deepEqual(reject.items, state.items);
  const bad = cmd(state, { type: "MOVE_ITEM", itemId: item.id,
    destination: { kind: "ground", plotId: "P01", x: Number.NaN, y: 0.5 } });
  assert.deepEqual(bad.items, state.items);
  for (const destination of [
    { kind: "inventory" }, { kind: "storage" }, { kind: "ground", plotId: "P01", x: 0.44, y: 0.75 },
  ] as const) {
    const before = state;
    state = cmd(state, { type: "MOVE_ITEM", itemId: item.id, destination });
    assert.equal(Object.keys(state.items).length, 2);
    assert.equal(state.items[item.id].id, item.id);
    assert.deepEqual(state.items[item.id].location, destination);
    assert.equal(state.day, before.day);
    assert.equal(state.worldUH, before.worldUH);
    const movedItem = state.items[item.id];
    if (movedItem.kind === "Aquamelon" && original.kind === "Aquamelon") {
      assert.deepEqual(movedItem.free, original.free);
      assert.deepEqual(movedItem.reaction, original.reaction);
    }
  }
  const cancel = cmd(state, { type: "REJECT_DROP", reason: "已取消拖放" });
  assert.deepEqual(cancel.items, state.items);
});

test("U3 migration: version-1 U2 Seed keeps ID and seeded world; new schema survives reload", () => {
  const old = newGame() as unknown as Record<string, unknown>;
  old.schemaVersion = 1;
  delete old.selectedItemId;
  (old.items as Record<string, { location: string }>)["item:seed:1"].location = "inventory";
  const migrated = validateSave({ version: 1, game: old });
  assert.ok(migrated);
  assert.equal(migrated.schemaVersion, 5);
  assert.deepEqual(migrated.items["item:seed:1"].location, { kind: "inventory" });
  assert.equal(migrated.selectedItemId, null);
  assert.equal(migrated.nextObjectSeq, 2);
  assert.deepEqual(validateSave({ version: 5, game: migrated }), migrated);
  const plantedLegacy = planted() as unknown as Record<string, unknown>;
  plantedLegacy.schemaVersion = 1;
  delete plantedLegacy.selectedItemId;
  const loaded = validateSave({ version: 1, game: plantedLegacy })!;
  assert.equal(loaded.plots.P01.plant?.id, planted().plots.P01.plant?.id);
  assert.equal(Object.keys(loaded.items).length, 0);
});

test("U3 invalid save cannot duplicate consumed fruit by cloning sources or free account", () => {
  const g = matureFixture();
  const leaf = g.plots.P01.plant!.leaves[0];
  const result = cmd(g, { type: "HARVEST", plotId: "P01", plantId: g.plots.P01.plant!.id, leafId: leaf.id });
  assert.deepEqual(validateSave({ version: 5, game: result }), result);
  const duplicate = structuredClone(result);
  const fruit = Object.values(duplicate.items)[0];
  duplicate.items["item:duplicate"] = { ...structuredClone(fruit), id: "item:duplicate" };
  assert.equal(validateSave({ version: 5, game: duplicate }), null);
});
