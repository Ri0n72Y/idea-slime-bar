import { remoteBrowserContextOptions } from "./support/browserContextOptions";
import { expect, test, type Page } from "@playwright/test";
import { applyCommand, newGame } from "../src/domain/game.ts";
import { growRealFruit, putSavedGame } from "./support/worldFixture";

async function ready(page: Page) {
  page.setDefaultTimeout(20_000);
  await page.goto("/");
  await expect(page.getByTestId("loading-save")).toHaveCount(0);
  await expect(page.getByTestId("crystal-canvas")).toHaveCount(1);
  await expect(page.getByTestId("save-status")).toContainText("已保存");
}
async function boxCenter(page: Page, id: string) {
  const b = await page.getByTestId(id).first().boundingBox();
  if (!b) throw new Error("Missing " + id);
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}
async function scenePoint(page: Page, x: number, y: number) {
  const b = await page.getByTestId("crystal-canvas").boundingBox();
  if (!b) throw new Error("Canvas missing");
  return { x: b.x + x * b.width, y: b.y + y * b.height };
}
async function plotPoint(page: Page, index: number) {
  const b = await page.getByTestId("crystal-canvas").boundingBox();
  if (!b) throw new Error("Canvas missing");
  const radius = Math.min(b.width / 11, b.height / 7, 70);
  const angle = (index - 1) * Math.PI / 3 - Math.PI / 2;
  return { x: b.x + b.width / 2 + Math.cos(angle) * radius * 1.86,
    y: b.y + b.height / 2 + Math.sin(angle) * radius * 1.86 };
}
async function fruitAt(page: Page, slot: number) {
  const b = await page.getByTestId("crystal-canvas").boundingBox();
  if (!b) throw new Error("Canvas missing");
  const radius = Math.min(b.width / 11, b.height / 7, 70);
  return { x: b.x + b.width / 2 + (slot - 1) * radius * 0.43,
    y: b.y + b.height / 2 - radius * 0.57 };
}
async function dragMouse(page: Page, a: {x:number;y:number}, b: {x:number;y:number}) {
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 14 });
  await page.mouse.up();
}

/** Actual N=8,K=24 commands and U2 Growth/Reaction, no fabricated fruit or energy. */
async function mature(page: Page, count: number) {
  const { game, indices } = growRealFruit(newGame(), count, 130);
  await putSavedGame(page, game);
  const record = { indices, day: game.day, energy: game.adeptalEnergy.balance };
  await page.reload();
  await expect(page.getByTestId("loading-save")).toHaveCount(0);
  if (await page.getByTestId("night-report").count()) await page.getByTestId("close-report").click();
  return record;
}

test("Batch A desktop: two real fruit commissions, provenance seed and P02 planting", async ({ page }, info) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1600, height: 900 });
  await ready(page);
  const record = await mature(page, 2);
  const originalDay = record.day;
  await expect(page.getByTestId("order-requirement")).toContainText("完整水瓜");
  await page.getByTestId("accept-order").click();
  const firstPos = await fruitAt(page, record.indices[0]);
  await page.mouse.click(firstPos.x, firstPos.y);
  await expect(page.getByTestId("feedback")).toContainText("已采摘");
  await expect(page.getByTestId("seed-item")).toHaveCount(1);
  const fruitId = (await page.getByTestId("selected-item").getAttribute("data-item-id"))!;
  await dragMouse(page, await scenePoint(page, 0.36, 0.69), await boxCenter(page, "region-storage"));
  await expect(page.getByTestId("fruit-storage")).toHaveAttribute("data-item-id", fruitId);
  await page.getByTestId("deliver-order").click();
  await expect(page.getByTestId("order-requirement")).toContainText("杯装水瓜汁");
  await expect(page.getByTestId("order-history").first()).toContainText("已交付");
  const paidBalance = await page.getByTestId("energy").innerText();
  expect(paidBalance).toMatch(/\d+/);
  await page.getByTestId("accept-order").click();

  const pos = await fruitAt(page, record.indices[1]);
  await page.mouse.click(pos.x, pos.y);
  await expect(page.getByTestId("seed-item")).toHaveCount(2);
  await dragMouse(page, await scenePoint(page, 0.36, 0.69), await boxCenter(page, "peel-drop"));
  await page.getByTestId("peel-action").click();
  await dragMouse(page, await boxCenter(page, "peel-item"), await boxCenter(page, "juice-drop"));
  await page.getByTestId("juice-action").click();
  await page.getByTestId("cup-action").click();
  const cupId = await page.getByTestId("juice-item").getAttribute("data-item-id");
  await dragMouse(page, await boxCenter(page, "juice-item"), await boxCenter(page, "region-inventory"));
  await expect(page.getByTestId("fruit-inventory")).toHaveAttribute("data-item-id", cupId);
  await page.getByTestId("deliver-order").click();
  await expect(page.getByTestId("order-history").first()).toContainText("已交付");
  await expect(page.getByTestId("order-requirement")).toContainText("完整水瓜");

  await page.getByTestId("unlock-P02").click();
  await expect(page.getByTestId("unlock-P02")).toHaveCount(0);
  await dragMouse(page, await boxCenter(page, "seed-item"), await plotPoint(page, 1));
  await expect(page.getByTestId("selected-plot")).toContainText("2号地");
  await expect(page.getByTestId("plant-stage")).toContainText("种子期");
  await expect(page.getByTestId("day")).toContainText(`第 ${originalDay} 天`);
  await expect(page.getByTestId("save-status")).toContainText("已保存");
  await page.screenshot({ path: info.outputPath("batch-a-desktop-1600x900.png") });
  await page.reload();
  await expect(page.getByTestId("seed-item")).toHaveCount(1);
  await expect(page.getByTestId("unlock-P02")).toHaveCount(0);
  await expect(page.getByTestId("order-history")).toHaveCount(2);
});

test("Batch A touch: harvest, deliver, unlock and plant with actual pointer stream", async ({ browser }, info) => {
  test.setTimeout(240_000);
  const context = await browser.newContext({ ...remoteBrowserContextOptions, 
    viewport: { width: 1280, height: 720 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1,
  });
  try {
    const page = await context.newPage();
    await ready(page);
    const data = await mature(page, 1);
    await page.getByTestId("accept-order").tap();
    const at = await fruitAt(page, data.indices[0]);
    await page.touchscreen.tap(at.x, at.y);
    await expect(page.getByTestId("feedback")).toContainText("已采摘");
    const cdp = await context.newCDPSession(page);
    const dragTouch = async (a: {x:number;y:number}, b: {x:number;y:number}) => {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{...a, id: 0}] });
      for (let i = 1; i <= 14; i++) await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove", touchPoints: [{x: a.x + (b.x-a.x)*i/14,
          y: a.y + (b.y-a.y)*i/14, id: 0}] });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    };
    await dragTouch(await scenePoint(page, 0.36, 0.69), await boxCenter(page, "region-storage"));
    await expect(page.getByTestId("fruit-storage")).toHaveCount(1);
    await page.getByTestId("deliver-order").tap();
    await expect(page.getByTestId("order-requirement")).toContainText("杯装水瓜汁");
    await page.getByTestId("unlock-P02").tap();
    await expect(page.getByTestId("unlock-P02")).toHaveCount(0);
    await dragTouch(await boxCenter(page, "seed-item"), await plotPoint(page, 1));
    await expect(page.getByTestId("selected-plot")).toContainText("2号地");
    await expect(page.getByTestId("plant-stage")).toContainText("种子期");
    await page.screenshot({ path: info.outputPath("batch-a-touch-1280x720.png") });
    await expect(page.getByTestId("save-status")).toContainText("已保存");
    await page.reload();
    await expect(page.getByTestId("unlock-P02")).toHaveCount(0);
  } finally { await context.close(); }
});

test("Batch A deadline: order accepted on due day; confirmed night expires and offers retry", async ({ page }, info) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1600, height: 900 });
  await ready(page);
  let game = newGame();
  while (game.day < game.orders["order:first"].dueDay) {
    game = applyCommand(game, { type: "REQUEST_END_DAY" });
    game = applyCommand(game, { type: "CONFIRM_END_DAY", expectedDay: game.day });
  }
  await putSavedGame(page, game);
  await page.reload();
  await expect(page.getByTestId("loading-save")).toHaveCount(0);
  if (await page.getByTestId("night-report").count()) await page.getByTestId("close-report").click();
  await expect(page.getByTestId("order-status")).toContainText("待接受");
  const oldId = await page.getByTestId("active-order").getAttribute("data-order-id");
  await page.getByTestId("accept-order").click();
  await expect(page.getByTestId("order-status")).toContainText("已接受");
  await page.getByTestId("deliver-order").click();
  await expect(page.getByTestId("feedback")).toContainText("数量不足");
  await page.getByTestId("end-day").click();
  await page.getByTestId("confirm-day").click();
  await expect(page.getByTestId("night-report")).toBeVisible();
  await page.getByTestId("close-report").click();
  await expect(page.getByTestId("order-history").first()).toContainText("已过期");
  await expect(page.getByTestId("active-order")).not.toHaveAttribute("data-order-id", oldId!);
  await expect(page.getByTestId("order-requirement")).toContainText("完整水瓜");
  await page.screenshot({ path: info.outputPath("batch-a-deadline-1600x900.png") });
});
