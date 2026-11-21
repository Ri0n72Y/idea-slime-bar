import assert from "node:assert/strict";
import { mkdtemp, cp, rm, readFile, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const packageDir = fileURLToPath(new URL("..", import.meta.url));
const source = join(packageDir, "src", "domain");
const original = JSON.parse(await readFile(join(source, "balance.config.json"), "utf8"));
const scratch = await mkdtemp(join(tmpdir(), "liyue-balance-"));

try {
  await cp(source, join(scratch, "domain"), { recursive: true });
  await writeFile(join(scratch, "package.json"), '{"type":"module"}');
  const originalGame = await import(pathToFileURL(join(source, "game.ts")).href);
  const originalEnergy = await import(pathToFileURL(join(source, "economy.ts")).href);
  const originalSave = await import(pathToFileURL(join(source, "save.ts")).href);
  let old = originalGame.newGame(3137);
  originalEnergy.rewardEnergy(old, "test:historic-energy", 100);
  old = originalGame.applyCommand(old, { type: "UNLOCK_PLOT", plotId: "P02" });
  assert.equal(old.adeptalEnergy.spentTotal, original.economy.plotCosts.P02);
  old.plots.P01.soil[0] = original.world.soilCapacityV;
  old.looseBalls["ball:21"] = {
    id: "ball:21", element: "Fire", initialV: original.world.ballInitialV,
    createdUH: old.worldUH, slot: 0,
  };
  old.dayCondenseUsed = 1;
  const oldEnvelope = originalSave.saveEnvelope(old);
  assert.ok(originalSave.validateSave(oldEnvelope));

  const alternative = structuredClone(original);
  alternative.world.condensesPerDay = 6;
  alternative.world.ballInitialV = 80;
  alternative.world.soilCapacityV = 72;
  alternative.growth.seedlingThresholdG = 30;
  alternative.growth.saplingThresholdG = 70;
  alternative.growth.flowerThresholdG = 8;
  alternative.growth.greenFruitThresholdG = 32;
  alternative.growth.matureFruitThresholdG = 75;
  alternative.reactions.pairCosts.Fire.Hydro = 9;
  alternative.economy.plotCosts.P02 = 5;
  alternative.economy.orderDelivery = 21;
  alternative.orders.firstWindowDays = 12;
  alternative.orders.renewalWindowDays = 10;
  alternative.technology.collectBagCost = 9;
  alternative.visitors.rewards.greet = 8;

  await writeFile(join(scratch, "domain", "balance.config.json"), JSON.stringify(alternative, null, 2) + "\n");
  const imported = pathToFileURL(join(scratch, "domain", "game.ts")).href;
  const G = await import(imported);
  const E = await import(pathToFileURL(join(scratch, "domain", "economy.ts")).href);
  const S = await import(pathToFileURL(join(scratch, "domain", "save.ts")).href);
  const Growth = await import(pathToFileURL(join(scratch, "domain", "growth.ts")).href);
  const Reactions = await import(pathToFileURL(join(scratch, "domain", "reactions.ts")).href);
  const Config = await import(pathToFileURL(join(scratch, "domain", "config.ts")).href);
  const Balance = await import(pathToFileURL(join(scratch, "domain", "balance.ts")).href);
  assert.equal(Balance.BALANCE.world.ballInitialV, 80);
  assert.equal(G.newGame(101).dayCondenseLimit, 6);
  assert.equal(G.newGame(101).orders["order:first"].dueDay, 13);
  assert.equal(Config.U2_CONFIG.soilCapacityV, 72);
  assert.equal(Balance.BALANCE.economy.plotCosts.P02, 5);
  assert.ok(Object.isFrozen(Balance.BALANCE.growth));

  let alt = G.newGame(101);
  const condensed = G.applyCommand(alt, { type: "CONDENSE" });
  assert.equal(condensed.dayCondenseUsed, 1);
  const ball = Object.values(condensed.looseBalls)[0];
  assert.equal(ball.initialV, 80);
  const collected = G.applyCommand(condensed, { type: "COLLECT_BALL", ballId: ball.id });
  assert.equal(collected.heldElements[Config.elementIndex(ball.element)], 80);
  const watered = G.applyCommand(collected, { type: "WATER_PLOT", plotId: "P01", element: ball.element });
  assert.equal(watered.plots.P01.soil.reduce((a, b) => a + b, 0), 72);
  assert.ok(S.validateSave(S.saveEnvelope(watered)));
  E.rewardEnergy(watered, "test:alt-funder", 50);
  const unlocked = G.applyCommand(watered, { type: "UNLOCK_PLOT", plotId: "P02" });
  assert.equal(unlocked.adeptalEnergy.spentTotal, 5);
  assert.equal(unlocked.adeptalEnergy.spendLedger["plot:P02"], 5);
  assert.ok(S.validateSave(S.saveEnvelope(unlocked)));

  // A different cost and three evidence records unlock the real technology.
  let tech = G.newGame(71);
  tech.labor.manualBallIds = ["ball:101", "ball:102", "ball:103"];
  tech.discoveries.A18 = {
    id: "A18", eventId: "event:collect-proof", completedAtDay: 1, sourceId: "ball:103",
  };
  E.rewardEnergy(tech, "test:technology-funder", 20);
  tech = G.applyCommand(tech, { type: "UNLOCK_TECH", techId: "collectBag" });
  assert.ok(tech.technology.collectBag);
  assert.equal(tech.adeptalEnergy.spentTotal, 9);
  assert.equal(tech.adeptalEnergy.spendLedger["tech:collectBag"], 9);
  assert.ok(S.validateSave(S.saveEnvelope(tech)));

  // Dynamic visitor encounter rewards are not duplicated in player-facing text.
  let visitor = G.newGame(83);
  visitor.day = 2;
  visitor.discoveries.A03 = {
    id: "A03", eventId: "event:growth-proof", completedAtDay: 2, sourceId: "plot:P01",
  };
  visitor = G.applyCommand(visitor, { type: "TALK_VISITOR", visitorId: "visitor:yan", action: "greet" });
  assert.equal(visitor.adeptalEnergy.balance, 8);
  assert.match(visitor.notice.message, /获得 8 洞天仙力/);

  const plot = { id: "P01", open: true, soil: Config.zeros(), plant: Growth.newTree("test:tree") };
  plot.plant.treeGrowth[0] = 31;
  Growth.advancePlotOneUH(plot, 1, () => 0.5, [], Growth.newLedger());
  assert.equal(plot.plant.stage, "Seedling");
  const free = [32, 10, 0, 0, 0, 0, 0];
  const rx = Reactions.newReactionState();
  Reactions.applyNaturalGrowth(free, rx, [1, 0, 0, 0, 0, 0, 0], []);
  assert.equal(rx.products["逆蒸发"], 39);
  assert.equal(free.reduce((a, b) => a + b, 0) + Reactions.productAmount(rx), 43);

  // A historically legal old save must survive a changed active price/soil/ball policy.
  const restored = S.validateSave(oldEnvelope);
  assert.ok(restored);
  assert.equal(restored.plots.P01.soil[0], 1000);
  assert.equal(restored.adeptalEnergy.spendLedger["plot:P02"], 8);
  assert.equal(restored.looseBalls["ball:21"].initialV, 50);
  const legacy = structuredClone(oldEnvelope);
  delete legacy.game.adeptalEnergy.spendLedger;
  const migrated = S.validateSave(legacy);
  assert.ok(migrated);
  assert.equal(migrated.adeptalEnergy.spendLedger.legacy, 8);

  for (const [description, mutate] of [
    ["negative ball", c => { c.world.ballInitialV = -1; }],
    ["wrong threshold order", c => { c.growth.saplingThresholdG = 25; }],
    ["fractional price", c => { c.economy.plotCosts.P02 = 2.5; }],
    ["root budget overflow", c => { c.growth.leafBudgetShare = 0.4; }],
    ["reaction mass inflation", c => { c.reactions.activeSpendG = 40; }],
    ["invalid probability", c => { c.growth.budChanceByLeafCount[0] = 1.5; }],
    ["impossible water requirement", c => { c.technology.wateredElementsRequired = 8; }],
  ]) {
    const broken = structuredClone(alternative);
    mutate(broken);
    assert.throws(() => Balance.validateBalanceConfig(broken), /Invalid balance config/, description);
  }
  console.log("BALANCE_VARIANTS_PASS: independent JSON, growth, ball, soil, reactions, deadline, price, save, validation");
} finally {
  await rm(scratch, { recursive: true, force: true });
}
