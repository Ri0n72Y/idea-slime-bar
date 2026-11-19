import test from "node:test";
import assert from "node:assert/strict";
import { newGame, applyCommand } from "./domain/game.ts";
import { eligibleOrderItems, nextActionHint, orderSelectionWarning } from "./experience.ts";

test("optional guidance follows real game state without issuing commands", () => {
  const original = newGame(), before = structuredClone(original);
  assert.match(nextActionHint(original), /种子.*播种/);
  assert.deepEqual(original, before);
  let g = applyCommand(original, { type: "PLANT_SEED", itemId: "item:seed:1", plotId: "P01" });
  assert.match(nextActionHint(g), /凝聚/);
  g = applyCommand(g, { type: "CONDENSE" });
  assert.match(nextActionHint(g), /收集/);
  const ball = Object.values(g.looseBalls)[0];
  g = applyCommand(g, { type: "COLLECT_BALL", ballId: ball.id });
  assert.match(nextActionHint(g), /浇灌/);
  g = applyCommand(g, { type: "WATER_PLOT", plotId: "P01", element: ball.element });
  assert.match(nextActionHint(g), /凝聚/);
  g = applyCommand(g, { type: "REQUEST_END_DAY" });
  assert.match(nextActionHint(g), /确认结算/);
});

test("selected wrong material is explained, not silently replaced", () => {
  const g = newGame();
  const order = g.orders["order:first"];
  g.selectedItemId = "item:seed:1";
  assert.match(orderSelectionWarning(g, order) ?? "", /水瓜种子.*完整水瓜/);
  assert.equal(eligibleOrderItems(g, order).length, 0);
});
