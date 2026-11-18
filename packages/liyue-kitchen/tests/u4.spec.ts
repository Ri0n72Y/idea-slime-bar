import { expect, test, type Page } from "@playwright/test";
import { newGame } from "../src/domain/game.ts";
import { growRealFruit, putSavedGame } from "./support/worldFixture";

async function ready(page: Page) {
  await page.goto("/");
  await expect(page.getByTestId("loading-save")).toHaveCount(0);
  await expect(page.getByTestId("crystal-canvas")).toHaveCount(1);
  await expect(page.getByTestId("save-status")).toContainText("已保存");
}
async function center(page: Page, testId: string) {
  const box = await page.getByTestId(testId).boundingBox();
  if (!box) throw new Error("Missing " + testId);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
async function scenePoint(page: Page, x: number, y: number) {
  const box = await page.getByTestId("crystal-canvas").boundingBox();
  if (!box) throw new Error("Canvas missing");
  return { x: box.x + x * box.width, y: box.y + y * box.height };
}
async function matureFruitPoint(page: Page, slot: number) {
  const box = await page.getByTestId("crystal-canvas").boundingBox();
  if (!box) throw new Error("Canvas missing");
  const radius = Math.min(box.width / 11, box.height / 7, 70);
  return { x: box.x + box.width / 2 + (slot - 1) * radius * 0.43,
    y: box.y + box.height / 2 - radius * 0.57 };
}
async function dragMouse(page: Page, a: {x:number;y:number}, b: {x:number;y:number}) {
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 14 });
  await page.mouse.up();
}

/** Replay actual U2 domain growth. Save only the matured state as an IndexedDB fixture. */
async function loadMatureGame(page: Page) {
  const { game, indices } = growRealFruit(newGame(), 1, 70);
  const index = indices[0];
  const source = game.plots.P01.plant!.leaves[index].fruit!;
  const mass = source.free.reduce((a, v) => a + v, 0) +
    Object.values(source.reaction.products).reduce((a, v) => a + Number(v), 0);
  const fruit = { index, mass, day: game.day };
  await putSavedGame(page, game);
  await page.reload();
  await expect(page.getByTestId("loading-save")).toHaveCount(0);
  if (await page.getByTestId("night-report").count()) await page.getByTestId("close-report").click();
  await expect(page.getByTestId("day")).toContainText(`第 ${fruit.day} 天`);
  return fruit;
}

test("U4 desktop: real pointer processing, material ledger, rejected drop and persisted cup", async ({ page }, info) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1600, height: 900 });
  await ready(page);
  await expect(page.getByTestId("peel-action")).toBeDisabled();
  await expect(page.getByTestId("juice-action")).toBeDisabled();
  await expect(page.getByTestId("cup-action")).toBeDisabled();
  const source = await loadMatureGame(page);
  const fruitAt = await matureFruitPoint(page, source.index);
  await page.mouse.click(fruitAt.x, fruitAt.y);
  await expect(page.getByTestId("feedback")).toContainText("已采摘");
  const originalId = (await page.getByTestId("selected-item").getAttribute("data-item-id"))!;
  const ground = await scenePoint(page, 0.36, 0.69);
  await dragMouse(page, ground, await center(page, "peel-drop"));
  await expect(page.getByTestId("peel-item")).toHaveAttribute("data-item-id", originalId);
  await expect(page.getByTestId("peel-action")).toBeEnabled();
  await page.getByTestId("peel-action").click();
  await expect(page.getByTestId("feedback")).toContainText("剥壳完成");
  const fleshId = await page.getByTestId("peel-item").getAttribute("data-item-id");
  expect(fleshId).not.toBe(originalId);
  await expect(page.getByTestId("fruit-storage")).toContainText("果壳");
  await expect(page.getByTestId("item-mass")).toContainText(source.mass.toFixed(3));
  await expect(page.getByTestId("peel-action")).toBeDisabled();
  // Wrong material: shell cannot enter the peeling slot.
  const shellId = await page.getByTestId("fruit-storage").getAttribute("data-item-id");
  await dragMouse(page, await center(page, "fruit-storage"), await center(page, "peel-drop"));
  await expect(page.getByTestId("feedback")).toContainText("不接受");
  await expect(page.getByTestId("fruit-storage")).toHaveAttribute("data-item-id", shellId);

  await dragMouse(page, await center(page, "peel-item"), await center(page, "juice-drop"));
  await expect(page.getByTestId("peel-item")).toHaveCount(0);
  await expect(page.getByTestId("juice-item")).toHaveAttribute("data-item-id", fleshId);
  await page.getByTestId("juice-action").click();
  const rawId = await page.getByTestId("juice-item").getAttribute("data-item-id");
  expect(rawId).not.toBe(fleshId);
  await expect(page.getByTestId("item-mass")).toContainText(source.mass.toFixed(3));
  await page.getByTestId("cup-action").click();
  await expect(page.getByTestId("cup-action")).toBeDisabled();
  const cupId = await page.getByTestId("juice-item").getAttribute("data-item-id");
  expect(cupId).not.toBe(rawId);
  await expect(page.getByTestId("juice-item")).toContainText("杯装水瓜汁");
  await expect(page.getByTestId("item-mass")).toContainText(source.mass.toFixed(3));
  await expect(page.getByTestId("day")).toContainText(`第 ${source.day} 天`);
  await expect(page.getByTestId("save-status")).toContainText("已保存");
  await page.screenshot({ path: info.outputPath("u4-desktop-1600x900.png") });
  await page.reload();
  await expect(page.getByTestId("loading-save")).toHaveCount(0);
  if (await page.getByTestId("night-report").count()) await page.getByTestId("close-report").click();
  await expect(page.getByTestId("juice-item")).toHaveAttribute("data-item-id", cupId);
  await expect(page.getByTestId("fruit-storage")).toHaveAttribute("data-item-id", shellId);
  await dragMouse(page, await center(page, "juice-item"), await center(page, "region-inventory"));
  await expect(page.getByTestId("fruit-inventory")).toHaveAttribute("data-item-id", cupId);
  await expect(page.getByTestId("save-status")).toContainText("已保存");
  await page.reload();
  await expect(page.getByTestId("fruit-inventory")).toHaveAttribute("data-item-id", cupId);
});

test("U4 simulated touchscreen: harvest, two workbenches, cup and storage", async ({ browser }, info) => {
  test.setTimeout(180_000);
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1,
  });
  try {
    const page = await context.newPage();
    await ready(page);
    const source = await loadMatureGame(page);
    const at = await matureFruitPoint(page, source.index);
    await page.touchscreen.tap(at.x, at.y);
    await expect(page.getByTestId("feedback")).toContainText("已采摘");
    const session = await context.newCDPSession(page);
    const dragTouch = async (a: {x:number;y:number}, b: {x:number;y:number}) => {
      await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...a, id: 0 }] });
      for (let i = 1; i <= 14; i++) await session.send("Input.dispatchTouchEvent", {
        type: "touchMove", touchPoints: [{ x: a.x + (b.x-a.x)*i/14,
          y: a.y + (b.y-a.y)*i/14, id: 0 }],
      });
      await expect(page.getByTestId("fruit-drag-ghost")).toBeVisible();
      await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    };
    await dragTouch(await scenePoint(page, 0.36, 0.69), await center(page, "peel-drop"));
    await expect(page.getByTestId("peel-action")).toBeEnabled();
    await page.getByTestId("peel-action").tap();
    await dragTouch(await center(page, "peel-item"), await center(page, "juice-drop"));
    await page.getByTestId("juice-action").tap();
    await page.getByTestId("cup-action").tap();
    const cupId = await page.getByTestId("juice-item").getAttribute("data-item-id");
    await dragTouch(await center(page, "juice-item"), await center(page, "region-storage"));
    await expect(page.getByTestId("fruit-storage")).toHaveCount(2); // shell and juice cup
    await expect(page.locator(`[data-testid="fruit-storage"][data-item-id="${cupId}"]`)).toContainText("杯装水瓜汁");
    await expect(page.getByTestId("item-mass")).toContainText(source.mass.toFixed(3));
    await page.screenshot({ path: info.outputPath("u4-touch-1280x720.png") });
    await expect(page.getByTestId("save-status")).toContainText("已保存");
    await page.reload();
    await expect(page.locator(`[data-testid="fruit-storage"][data-item-id="${cupId}"]`)).toHaveCount(1);
  } finally { await context.close(); }
});

test("U4 browser migration: prior U3 IndexedDB save upgrades without duplicate seed", async ({ page }) => {
  await ready(page);
  const legacy: any = newGame();
  legacy.schemaVersion = 2;
  await putSavedGame(page, legacy, 2);
  await page.reload();
  await expect(page.getByTestId("loading-save")).toHaveCount(0);
  await expect(page.getByTestId("seed-item")).toHaveCount(1);
  const saved = await page.evaluate(async () => {
    return new Promise<{version:number;schema:number;count:number}>((resolve, reject) => {
      const request = indexedDB.open("liyue-kitchen", 6);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction("game-saves", "readonly");
        const get = tx.objectStore("game-saves").get("primary");
        get.onsuccess = () => { const v = get.result; db.close(); resolve({
          version: v.version, schema: v.game.schemaVersion, count: Object.keys(v.game.items).length,
        }); };
        get.onerror = () => reject(get.error);
      };
      request.onerror = () => reject(request.error);
    });
  });
  expect(saved).toEqual({ version: 6, schema: 6, count: 1 });
});
