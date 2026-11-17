import { expect, test, type Page } from "@playwright/test";

async function ready(page: Page) {
  await page.goto("/");
  await expect(page.getByTestId("loading-save")).toHaveCount(0);
  await expect(page.getByTestId("save-status")).toContainText("已保存");
  await expect(page.getByTestId("crystal-canvas")).toHaveCount(1);
}

/** Uses real U2 commands and nightly Growth to produce a harvest-ready saved world. */
async function matureWorld(page: Page) {
  const result = await page.evaluate(async () => {
    const domain = "/src/domain/game.ts";
    const { newGame, applyCommand } = await import(/* @vite-ignore */ domain);
    let g = applyCommand(newGame(), { type: "PLANT_SEED", itemId: "item:seed:1", plotId: "P01" });
    let maturity = -1;
    let slot = -1;
    for (let night = 0; night < 70; night++) {
      for (let n = 0; n < g.dayCondenseLimit; n++) {
        g = applyCommand(g, { type: "CONDENSE" });
        const ball = Object.values(g.looseBalls).at(-1) as { id: string; element: string };
        g = applyCommand(g, { type: "COLLECT_BALL", ballId: ball.id });
        g = applyCommand(g, { type: "WATER_PLOT", plotId: "P01", element: ball.element });
      }
      const req = applyCommand(g, { type: "REQUEST_END_DAY" });
      g = applyCommand(req, { type: "CONFIRM_END_DAY", expectedDay: g.day });
      slot = g.plots.P01.plant.leaves.findIndex(
        (leaf: { fruit: { stage: string } | null }) => leaf.fruit?.stage === "MatureFruit");
      if (slot >= 0) { maturity = g.day; break; }
    }
    if (maturity < 0) throw new Error("U2 actual growth did not reach MatureFruit after 70 nights");
    const plant = g.plots.P01.plant;
    const leaf = plant.leaves[slot];
    const beforeMass = leaf.fruit.free.reduce((a: number, b: number) => a + b, 0) +
      Object.values(leaf.fruit.reaction.products).reduce((a: number, b) => a + Number(b), 0);
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("liyue-kitchen", 6);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction("game-saves", "readwrite");
        tx.objectStore("game-saves").put({ version: 6, game: g }, "primary");
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
      };
    });
    return { slot, maturity, plantId: plant.id, leafId: leaf.id, mass: beforeMass };
  });
  await page.reload();
  await expect(page.getByTestId("loading-save")).toHaveCount(0);
  await expect(page.getByTestId("day")).toContainText(`第 ${result.maturity} 天`);
  const report = page.getByTestId("night-report");
  if (await report.count()) await page.getByTestId("close-report").click();
  return result;
}

async function scenePoint(page: Page, x: number, y: number) {
  const box = await page.getByTestId("crystal-canvas").boundingBox();
  if (!box) throw new Error("No canvas");
  return { x: box.x + box.width * x, y: box.y + box.height * y };
}
async function fruitButton(page: Page, slot: number) {
  const box = await page.getByTestId("crystal-canvas").boundingBox();
  if (!box) throw new Error("No canvas");
  const radius = Math.min(box.width / 11, box.height / 7, 70);
  return { x: box.x + box.width / 2 + (slot - 1) * radius * 0.43,
    y: box.y + box.height / 2 - radius * 0.57 };
}
async function dragMouse(page: Page, from: {x: number; y: number}, to: {x: number; y: number}) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up();
}
async function centerOf(page: Page, testid: string) {
  const box = await page.getByTestId(testid).boundingBox();
  if (!box) throw new Error("No item/drop zone: " + testid);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test("U3 desktop: actual mature harvest, no duplication, true ground/inventory/storage/ground moves", async ({ page }, info) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1600, height: 900 });
  await ready(page);
  const source = await matureWorld(page);
  const at = await fruitButton(page, source.slot);
  await page.mouse.click(at.x, at.y);
  await expect(page.getByTestId("feedback")).toContainText("已采摘");
  const id = await page.getByTestId("item-id").innerText();
  await expect(page.getByTestId("item-mass")).toContainText(source.mass.toFixed(3));
  const ground = await scenePoint(page, 0.36, 0.69);

  // A pointer drag cancelled with Escape must leave the material untouched.
  await page.mouse.move(ground.x, ground.y);
  await page.mouse.down();
  await page.mouse.move(ground.x + 45, ground.y + 25, { steps: 5 });
  await expect(page.getByTestId("fruit-drag-ghost")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(page.getByTestId("fruit-drag-ghost")).toHaveCount(0);
  await expect(page.getByTestId("selected-item")).toContainText("ground");
  // A failed drop must also keep the same identity.
  await dragMouse(page, ground, { x: 5, y: 5 });
  await expect(page.getByTestId("selected-item")).toContainText("ground");
  await expect(page.getByTestId("feedback")).toContainText("未移动");
  // The same harvested leaf cannot generate a second fruit by clicking its old icon.
  await page.mouse.click(at.x, at.y);
  await expect(page.getByTestId("fruit-inventory")).toHaveCount(0);

  await dragMouse(page, ground, await centerOf(page, "region-inventory"));
  await expect(page.getByTestId("fruit-inventory")).toHaveCount(1);
  await expect(page.getByTestId("fruit-inventory")).toHaveAttribute("data-item-id", id);
  await dragMouse(page, await centerOf(page, "fruit-inventory"), await centerOf(page, "region-storage"));
  await expect(page.getByTestId("fruit-storage")).toHaveAttribute("data-item-id", id);
  const center = await scenePoint(page, 0.5, 0.5);
  await dragMouse(page, await centerOf(page, "fruit-storage"), center);
  await expect(page.getByTestId("fruit-storage")).toHaveCount(0);
  await expect(page.getByTestId("selected-item")).toContainText("ground");
  await expect(page.getByTestId("item-mass")).toContainText(source.mass.toFixed(3));
  // Ground item overlays plot: tapping it must not toggle P01 selection.
  const selection = await page.getByTestId("selected-plot").innerText();
  await page.mouse.click(center.x, center.y);
  await expect(page.getByTestId("selected-plot")).toHaveText(selection);
  await expect(page.getByTestId("save-status")).toContainText("已保存");
  await page.screenshot({ path: info.outputPath("u3-desktop-harvest-1600x900.png") });
  await page.reload();
  await expect(page.getByTestId("loading-save")).toHaveCount(0);
  if (await page.getByTestId("night-report").count()) await page.getByTestId("close-report").click();
  // The preceding item tap intentionally deselected it; select the persisted ground object again.
  await page.mouse.click(center.x, center.y);
  await expect(page.getByTestId("item-id")).toHaveText(id);
  await expect(page.getByTestId("item-mass")).toContainText(source.mass.toFixed(3));
});

test("U3 touch: harvest and move Pixi ground fruit to DOM storage", async ({ browser }, info) => {
  test.setTimeout(180_000);
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, isMobile: true,
    hasTouch: true, deviceScaleFactor: 1 });
  try {
    const page = await context.newPage();
    await ready(page);
    const source = await matureWorld(page);
    const fruit = await fruitButton(page, source.slot);
    await page.touchscreen.tap(fruit.x, fruit.y);
    await expect(page.getByTestId("feedback")).toContainText("已采摘");
    const id = await page.getByTestId("item-id").innerText();
    const from = await scenePoint(page, 0.36, 0.69);
    const to = await centerOf(page, "region-storage");
    const cdp = await context.newCDPSession(page);
    const touchDrag = async (from: { x: number; y: number }, to: { x: number; y: number }) => {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...from, id: 0 }] });
      for (let i = 1; i <= 14; i++) await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove", touchPoints: [{ id: 0, x: from.x + (to.x-from.x)*i/14,
          y: from.y + (to.y-from.y)*i/14 }],
      });
      await expect(page.getByTestId("fruit-drag-ghost")).toBeVisible();
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    };
    await touchDrag(from, to);
    await expect(page.getByTestId("fruit-storage")).toHaveAttribute("data-item-id", id);
    await touchDrag(await centerOf(page, "fruit-storage"), await centerOf(page, "region-inventory"));
    await expect(page.getByTestId("fruit-inventory")).toHaveAttribute("data-item-id", id);
    await touchDrag(await centerOf(page, "fruit-inventory"), await scenePoint(page, 0.5, 0.5));
    await expect(page.getByTestId("fruit-inventory")).toHaveCount(0);
    await expect(page.getByTestId("selected-item")).toContainText("ground");
    await expect(page.getByTestId("item-mass")).toContainText(source.mass.toFixed(3));
    await page.screenshot({ path: info.outputPath("u3-touch-harvest-1280x720.png") });
  } finally { await context.close(); }
});

test("U3 browser: legacy U2 IndexedDB record migrates without a second Seed", async ({ page }) => {
  await ready(page);
  await page.evaluate(async () => {
    const modulePath = "/src/domain/game.ts";
    const { newGame } = await import(/* @vite-ignore */ modulePath);
    const g = newGame();
    g.schemaVersion = 1;
    delete g.selectedItemId;
    g.items["item:seed:1"].location = "inventory";
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("liyue-kitchen", 6);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction("game-saves", "readwrite");
        tx.objectStore("game-saves").put({ version: 1, game: g }, "primary");
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
      };
    });
  });
  await page.reload();
  await expect(page.getByTestId("loading-save")).toHaveCount(0);
  await expect(page.getByTestId("seed-item")).toHaveCount(1);
  await expect(page.getByTestId("save-status")).toContainText("已保存");
  const version = await page.evaluate(async () => {
    return new Promise<number>((resolve, reject) => {
      const r = indexedDB.open("liyue-kitchen", 6);
      r.onsuccess = () => {
        const db = r.result;
        const tx = db.transaction("game-saves", "readonly");
        const get = tx.objectStore("game-saves").get("primary");
        get.onsuccess = () => { db.close(); resolve(get.result.version); };
        get.onerror = () => reject(get.error);
      };
    });
  });
  expect(version).toBe(5);
});
