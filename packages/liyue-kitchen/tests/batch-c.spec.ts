import { remoteBrowserContextOptions } from "./support/browserContextOptions";
import { expect, test, type Page, type BrowserContext } from "@playwright/test";
import { validateSave } from "../src/domain/save.ts";
import { getSavedGame, growRealFruit, putSavedGame } from "./support/worldFixture";
type Point = { x: number; y: number };
async function at(page: Page, testId: string): Promise<Point> {
  const box = await page.getByTestId(testId).first().boundingBox();
  if (!box) throw Error("Missing element " + testId);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
async function scene(page: Page, what: "center" | "ball" | "fruit", i = 0): Promise<Point> {
  const b = await page.getByTestId("crystal-canvas").boundingBox();
  if (!b) throw Error("Canvas not mounted");
  const rad = Math.min(b.width / 11, b.height / 7, 70);
  const x = b.x + b.width / 2, y = b.y + b.height / 2;
  if (what === "center") return { x, y };
  if (what === "fruit") return { x: x + (i - 1) * rad * .43, y: y - rad * .57 };
  const a = -Math.PI / 2 + i / 8 * Math.PI * 2 + .18;
  return { x: x + Math.cos(a) * (rad * 2.96 + 18),
    y: y + Math.sin(a) * (rad * 2.96 + 18) };
}
async function drag(page: Page, ctx: BrowserContext, a: Point, z: Point, touch: boolean) {
  if (!touch) {
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(z.x, z.y, { steps: 16 });
    await page.mouse.up();
    return;
  }
  const cdp = await ctx.newCDPSession(page);
  try {
    await cdp.send("Input.dispatchTouchEvent",
      { type: "touchStart", touchPoints: [{ ...a, id: 0 }] });
    for (let i = 1; i <= 16; i++) {
      await cdp.send("Input.dispatchTouchEvent",
        { type: "touchMove", touchPoints: [{
          x: a.x + (z.x - a.x) * i / 16,
          y: a.y + (z.y - a.y) * i / 16, id: 0,
        }] });
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  } finally { await cdp.detach(); }
}
async function press(page: Page, id: string, touch: boolean) {
  if (touch) await page.getByTestId(id).tap();
  else await page.getByTestId(id).click();
}
async function pointTap(page: Page, pos: Point, touch: boolean) {
  if (touch) await page.touchscreen.tap(pos.x, pos.y);
  else await page.mouse.click(pos.x, pos.y);
}
async function progress(page: Page, orderId: string): Promise<number> {
  const { game, indices } = growRealFruit(await getSavedGame(page), 1, 75);
  const index = indices[0];
  if (game.day > game.orders[orderId].dueDay || game.orders[orderId].state !== "accepted")
    throw Error("Actual fruit failed before visitor deadline");
  if (!validateSave({ version: 6, game }))
    throw Error("Actual commands failed save validation");
  await putSavedGame(page, game);
  await page.reload();
  await expect(page.getByTestId("loading-save")).toHaveCount(0);
  if (await page.getByTestId("night-report").count()) await page.getByTestId("close-report").click();
  return index;
}
async function scenario(page: Page, ctx: BrowserContext, touch: boolean, screenshot: string) {
  page.setDefaultTimeout(25_000);
  await page.goto("/");
  await expect(page.getByTestId("crystal-canvas")).toHaveCount(1);
  await expect(page.getByTestId("visitor-absent")).toHaveCount(1);
  await expect(page.getByTestId("seed-item")).toHaveCount(1);
  await drag(page, ctx, await at(page, "seed-item"), await scene(page, "center"), touch);
  await expect(page.getByTestId("seed-item")).toHaveCount(0);
  for (let i = 0; i < 4; i++) await press(page, "condense", touch);
  for (let i = 0; i < 4; i++) await pointTap(page, await scene(page, "ball", i), touch);
  while (await page.locator('[data-testid^="water-"]').count()) {
    const button = page.locator('[data-testid^="water-"]').first();
    if (touch) await button.tap(); else await button.click();
  }
  await press(page, "end-day", touch);
  await press(page, "confirm-day", touch);
  await press(page, "close-report", touch);
  await expect(page.getByTestId("visitor-panel")).toHaveAttribute("data-visitor-id", "visitor:yan");
  await expect(page.getByTestId("visitor-name")).toContainText("阿砚");
  await press(page, "visitor-choice-greet", touch);
  await expect(page.getByTestId("visitor-line")).toContainText("阿砚");
  await press(page, "visitor-choice-ask_clue", touch);
  await expect(page.getByTestId("visitor-line")).toContainText("商路");
  await press(page, "visitor-choice-accept_gift", touch);
  const gift = '[data-item-id="item:visitor:yan:woodtag"]';
  await expect(page.locator(gift)).toHaveCount(1);
  await expect(page.getByTestId("seed-item")).toHaveCount(0);
  const giftBox = await page.locator(gift).boundingBox();
  if (!giftBox) throw Error("Gift item absent");
  await drag(page, ctx, { x: giftBox.x + giftBox.width / 2,
    y: giftBox.y + giftBox.height / 2 }, await at(page, "region-storage"), touch);
  await expect(page.getByTestId("region-storage").locator(gift)).toHaveCount(1);

  await press(page, "visitor-choice-request_order", touch);
  const guestOrder = page.locator('[data-testid="active-order"][data-visitor-id="visitor:yan"]');
  const boardOrder = page.locator('[data-testid="active-order"][data-visitor-id="board"]');
  await expect(guestOrder).toHaveCount(1);
  await expect(boardOrder).toHaveCount(1);
  await expect(guestOrder.getByTestId("order-requirement")).toContainText("杯装水瓜汁");
  const orderId = await guestOrder.getAttribute("data-order-id");
  if (!orderId) throw Error("Visitor order ID missing");
  if (touch) await guestOrder.getByTestId("accept-order").tap();
  else await guestOrder.getByTestId("accept-order").click();
  await expect(guestOrder.getByTestId("order-status")).toContainText("已接受");

  // Only the repeated multi-day *actions* run via production commands; no fake
  // fruit, visitor events, item IDs or energy are inserted into the world.
  const fruitIndex = await progress(page, orderId);
  await pointTap(page, await scene(page, "fruit", fruitIndex), touch);
  await expect(page.getByTestId("feedback")).toContainText("已采摘");
  const b = await page.getByTestId("crystal-canvas").boundingBox();
  if (!b) throw Error("Canvas absent");
  const floor = { x: b.x + b.width * .36, y: b.y + b.height * .69 };
  await drag(page, ctx, floor, await at(page, "peel-drop"), touch);
  await press(page, "peel-action", touch);
  await drag(page, ctx, await at(page, "peel-item"), await at(page, "juice-drop"), touch);
  await press(page, "juice-action", touch);
  await press(page, "cup-action", touch);
  await drag(page, ctx, await at(page, "juice-item"), await at(page, "region-inventory"), touch);

  const visitorOrder = page.locator('[data-testid="active-order"][data-order-id="' + orderId + '"]');
  await expect(visitorOrder.getByTestId("deliver-order")).toBeVisible();
  if (touch) await visitorOrder.getByTestId("deliver-order").tap();
  else await visitorOrder.getByTestId("deliver-order").click();
  await expect(page.getByTestId("feedback")).toContainText("委托完成");
  await expect(page.getByTestId("visitor-choice-thank")).toHaveCount(1);
  await press(page, "visitor-choice-thank", touch);
  await expect(page.getByTestId("visitor-line")).toContainText("已经送到了");
  await expect(page.getByTestId("visitor-choice-thank")).toHaveCount(0);
  await expect(page.getByTestId("visitor-choice-request_order")).toHaveCount(0);
  await expect(page.getByTestId("region-storage").locator(gift)).toHaveCount(1);
  await expect(boardOrder).toHaveCount(1);

  await press(page, "open-discoveries", touch);
  await expect(page.locator('[data-node-id="V01"]')).toHaveAttribute("data-status", "completed");
  await expect(page.locator('[data-node-id="V02"]')).toHaveAttribute("data-status", "completed");
  await expect(page.getByTestId("discovery-evidence-V01")).toContainText("与旅人追寻商路传说");
  await expect(page.getByTestId("discovery-evidence-V02")).toContainText("真实交单后倾听旅人的谢意");
  await page.screenshot({ path: screenshot, fullPage: true });
  await press(page, "close-discoveries", touch);
  await expect(page.getByTestId("save-status")).toContainText("已保存");

  const before = await getSavedGame(page);
  const beforeView = { energy: before.adeptalEnergy, day: before.day, visitor: before.visitor,
    issued: before.visitor.issuedOrderIds, gift: before.items["item:visitor:yan:woodtag"],
    order: Object.values(before.orders).find(o => o.visitorId === "visitor:yan"),
    discoveries: before.discoveries };
  expect(beforeView.energy.earnedTotal - beforeView.energy.spentTotal).toBe(beforeView.energy.balance);
  expect(beforeView.issued).toHaveLength(1);
  expect(beforeView.order?.state).toBe("completed");
  expect(beforeView.gift?.kind).toBe("VisitorGift");
  await page.reload();
  await expect(page.getByTestId("visitor-panel")).toHaveCount(1);
  await expect(page.getByTestId("visitor-choice-thank")).toHaveCount(0);
  await expect(page.getByTestId("region-storage").locator(gift)).toHaveCount(1);
  const restoredGame = await getSavedGame(page);
  const restored = { energy: restoredGame.adeptalEnergy, day: restoredGame.day,
    visitor: restoredGame.visitor, issued: restoredGame.visitor.issuedOrderIds,
    gift: restoredGame.items["item:visitor:yan:woodtag"],
    order: Object.values(restoredGame.orders).find(o => o.visitorId === "visitor:yan"),
    discoveries: restoredGame.discoveries };
  expect(restored).toEqual(beforeView);
}
test("U9 desktop 1600x900: visitor dialogue, gift, real cup delivery and saved clues",
  async ({ page }, info) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: 1600, height: 900 });
    await scenario(page, page.context(), false, info.outputPath("visitor-desktop.png"));
  });
test("U9 simulated touch 1280x720: same real visitor and commission path",
  async ({ browser }, info) => {
    test.setTimeout(240_000);
    const ctx = await browser.newContext({ ...remoteBrowserContextOptions,  viewport: { width: 1280, height: 720 },
      hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
    try { await scenario(await ctx.newPage(), ctx, true, info.outputPath("visitor-touch.png")); }
    finally { await ctx.close(); }
  });
