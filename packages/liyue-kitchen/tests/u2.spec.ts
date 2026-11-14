import { expect, test, type Page } from "@playwright/test";

async function start(page: Page) {
  await page.goto("/");
  await expect(page.getByTestId("loading-save")).toHaveCount(0);
  await expect(page.getByTestId("crystal-canvas")).toHaveCount(1);
  await expect(page.getByTestId("save-status")).toContainText("已保存");
}
async function center(page: Page) {
  const bounds = await page.getByTestId("crystal-canvas").boundingBox();
  if (!bounds) throw new Error("Canvas is missing");
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
}
async function seedCenter(page: Page) {
  const box = await page.getByTestId("seed-item").boundingBox();
  if (!box) throw new Error("Seed is missing");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
async function dragSeed(page: Page, dest: {x: number; y: number}) {
  const from = await seedCenter(page);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(dest.x, dest.y, { steps: 12 });
  await expect(page.getByTestId("seed-drag-ghost")).toBeVisible();
  await page.mouse.up();
  await expect(page.getByTestId("seed-drag-ghost")).toHaveCount(0);
}
async function ballPoint(page: Page, slot = 0) {
  const box = await page.getByTestId("crystal-canvas").boundingBox();
  if (!box) throw new Error("Canvas is missing");
  const radius = Math.min(box.width / 11, box.height / 7, 70);
  const distance = radius * 2.96 + 18;
  const angle = -Math.PI / 2 + (slot / 8) * Math.PI * 2 + 0.18;
  return { x: box.x + box.width/2 + Math.cos(angle)*distance,
    y: box.y + box.height/2 + Math.sin(angle)*distance };
}

test("desktop 1600x900: actual pointer seed drag, reject invalid, condense collect water, night and persistence", async ({ page }, info) => {
  test.setTimeout(90_000); // Full U2 chain: several pointer drags, nightly simulation, and IndexedDB write.
  await page.setViewportSize({ width: 1600, height: 900 });
  await start(page);
  await expect(page.getByTestId("seed-item")).toHaveCount(1);
  await expect(page.getByTestId("day")).toContainText("第 1 天");
  await dragSeed(page, {x: 5, y: 5});
  await expect(page.getByTestId("seed-item")).toHaveCount(1);
  await expect(page.getByTestId("feedback")).toContainText("未消耗");
  await dragSeed(page, await center(page));
  await expect(page.getByTestId("seed-item")).toHaveCount(0);
  await expect(page.getByTestId("plant-stage")).toContainText("Seed");
  await expect(page.getByTestId("selected-plot")).toContainText("P01");
  await page.getByTestId("condense").click();
  await expect(page.getByTestId("quota")).toContainText("7/8");
  const ball = await ballPoint(page);
  await page.mouse.click(ball.x, ball.y);
  await expect(page.getByTestId("feedback")).toContainText("收集了");
  const water = page.locator('[data-testid^="water-"]');
  await expect(water).toHaveCount(1);
  await water.click();
  await expect(water).toHaveCount(0);
  await expect(page.getByTestId("feedback")).toContainText("土壤已浇灌");
  await page.getByTestId("end-day").click();
  await expect(page.getByTestId("end-day-dialog")).toBeVisible();
  await page.getByTestId("cancel-day").click();
  await expect(page.getByTestId("day")).toContainText("第 1 天");
  await page.getByTestId("end-day").click();
  await page.getByTestId("confirm-day").click();
  await expect(page.getByTestId("day")).toContainText("第 2 天");
  await expect(page.getByTestId("night-report")).toBeVisible();
  await expect(page.getByTestId("quota")).toContainText("8/8");
  await expect(page.getByTestId("report-stage")).toContainText("Seed");
  await expect(page.getByTestId("report-stage")).toContainText("→");
  await page.getByTestId("close-report").click();
  await expect(page.getByTestId("save-status")).toContainText("已保存");
  await page.screenshot({ path: info.outputPath("u2-desktop-1600x900.png") });
  await page.reload();
  await expect(page.getByTestId("loading-save")).toHaveCount(0);
  await expect(page.getByTestId("seed-item")).toHaveCount(0);
  await expect(page.getByTestId("day")).toContainText("第 2 天");
  await expect(page.getByTestId("quota")).toContainText("8/8");
});

test("touch 1280x720: genuine press-move-release DOM seed to Pixi target", async ({ browser }, info) => {
  test.setTimeout(90_000); // Includes CDP touch sequence and full seed-to-night flow.
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }, isMobile: true, hasTouch: true,
    deviceScaleFactor: 1,
  });
  try {
    const page = await context.newPage();
    await start(page);
    const from = await seedCenter(page);
    const to = await center(page);
    const session = await context.newCDPSession(page);
    await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{...from, id: 0}] });
    for (let n = 1; n <= 12; n++) {
      const x = from.x + (to.x-from.x)*n/12;
      const y = from.y + (to.y-from.y)*n/12;
      await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y, id: 0 }] });
    }
    await expect(page.getByTestId("seed-drag-ghost")).toBeVisible();
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect(page.getByTestId("seed-item")).toHaveCount(0);
    await expect(page.getByTestId("plant-stage")).toContainText("Seed");
    await page.getByTestId("condense").tap();
    const b = await ballPoint(page);
    await page.touchscreen.tap(b.x, b.y);
    await expect(page.getByTestId("feedback")).toContainText("收集了");
    await page.locator('[data-testid^="water-"]').tap();
    await page.getByTestId("end-day").tap();
    await page.getByTestId("confirm-day").tap();
    await expect(page.getByTestId("night-report")).toBeVisible();
    await page.getByTestId("close-report").tap();
    await expect(page.getByTestId("day")).toContainText("第 2 天");
    await page.screenshot({ path: info.outputPath("u2-touch-1280x720.png") });
  } finally { await context.close(); }
});