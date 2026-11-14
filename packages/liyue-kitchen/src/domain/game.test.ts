import assert from "node:assert/strict";
import test from "node:test";
import { applyCommand, newGame, PLOT_IDS } from "./game.ts";
import { createGameStore } from "./store.ts";

test("U1 initializes seven fixed plots, only the center open", () => {
  const state = newGame();
  assert.deepEqual(Object.keys(state.plots), [...PLOT_IDS]);
  assert.equal(state.plots.P01.open, true);
  for (const id of PLOT_IDS.slice(1)) assert.equal(state.plots[id].open, false);
  assert.equal(state.selectedPlotId, null);
  assert.equal(state.adeptalEnergy, 0);
});

test("selection toggles; locked cells do not change selection or economy", () => {
  const first = applyCommand(newGame(), { type: "SELECT_PLOT", plotId: "P01" });
  assert.equal(first.selectedPlotId, "P01");
  for (const plotId of PLOT_IDS.slice(1)) {
    const rejected = applyCommand(first, { type: "SELECT_PLOT", plotId });
    assert.equal(rejected.selectedPlotId, "P01");
    assert.equal(rejected.adeptalEnergy, 0);
    assert.equal(rejected.day, 1);
    assert.equal(rejected.notice.kind, "locked");
  }
  const cleared = applyCommand(first, { type: "SELECT_PLOT", plotId: "P01" });
  assert.equal(cleared.selectedPlotId, null);
});

test("store subscription and unsubscribe do not multiply notifications", () => {
  const store = createGameStore();
  let calls = 0;
  const stop = store.subscribe(() => { calls++; });
  store.dispatch({ type: "SELECT_PLOT", plotId: "P01" });
  stop();
  store.dispatch({ type: "SELECT_PLOT", plotId: "P01" });
  assert.equal(calls, 1);
});
