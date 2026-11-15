import { expect, test, type Page } from "@playwright/test";

const regions = [
  "header", "visitors", "crystal", "orders", "exploration",
  "peeling", "inventory", "storage", "juicing", "feedback",
];

async function ready(page: Page) {
  await page.goto("/");
  await expect(page.getByTestId("crystal-canvas")).toHaveCount(1);
  for (const name of regions) await expect(page.getByTestId(`region-${name}`)).toBeVisible();
  await expect(page.getByTestId("day")).toContainText("第 1 天");
  await expect(page.getByTestId("energy")).toContainText("0");
  await expect(page.getByTestId("condense")).toBeEnabled();
  await expect(page.getByTestId("end-day")).toBeEnabled();
  await expect(page.getByTestId("seed-item")).toHaveCount(1);
}

async function plotPoint(page: Page, index: number) {
  const canvas = page.getByTestId("crystal-canvas");
  const rect = await canvas.boundingBox();
  if (!rect) throw new Error("Crystal canvas has no visible bounds");
  const radius = Math.min(rect.width / 11, rect.height / 7, 70);
  const angle = ((index - 1) * Math.PI) / 3 - Math.PI / 2;
  const orbit = radius * 1.86;
  return {
    x: rect.x + rect.width / 2 + (index === 0 ? 0 : Math.cos(angle) * orbit),
    y: rect.y + rect.height / 2 + (index === 0 ? 0 : Math.sin(angle) * orbit),
  };
}

test("desktop 1600x900: pointer selection, six locked plots, borders and screenshot", async ({ page }, info) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await ready(page);
  const canvas = page.getByTestId("crystal-canvas");
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error("No canvas bounds");
  await canvas.click({ position: { x: 3, y: 3 } });
  await expect(page.getByTestId("selected-plot")).toContainText("未选择");

  const center = await plotPoint(page, 0);
  await page.mouse.click(center.x, center.y);
  await expect(page.getByTestId("selected-plot")).toContainText("P01");
  for (let index = 1; index < 7; index++) {
    const point = await plotPoint(page, index);
    await page.mouse.click(point.x, point.y);
    await expect(page.getByTestId("feedback")).toContainText(`P0${index + 1} 尚未开垦`);
    await expect(page.getByTestId("selected-plot")).toContainText("P01");
  }
  await page.mouse.click(center.x, center.y);
  await expect(page.getByTestId("selected-plot")).toContainText("未选择");
  await expect(page.getByTestId("energy")).toContainText("0");
  await page.screenshot({ path: info.outputPath("u1-desktop-1600x900.png") });
});

test("touch 1280x720: actual touchscreen, relayout and screenshot", async ({ browser }, info) => {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
  });
  try {
    const page = await context.newPage();
    await ready(page);
    const center = await plotPoint(page, 0);
    await page.touchscreen.tap(center.x, center.y);
    await expect(page.getByTestId("selected-plot")).toContainText("P01");
    const locked = await plotPoint(page, 1);
    await page.touchscreen.tap(locked.x, locked.y);
    await expect(page.getByTestId("feedback")).toContainText("P02 尚未开垦");
    await expect(page.getByTestId("selected-plot")).toContainText("P01");
    await page.touchscreen.tap(center.x, center.y);
    await expect(page.getByTestId("selected-plot")).toContainText("未选择");
    await page.screenshot({ path: info.outputPath("u1-touch-1280x720.png") });
  } finally {
    await context.close();
  }
});

test("reloads and resize do not duplicate Canvas or change game day", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  for (let i = 0; i < 3; i++) {
    await ready(page);
    await expect(page.getByTestId("crystal-canvas")).toHaveCount(1);
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(page.getByTestId("crystal-canvas")).toHaveCount(1);
  const center = await plotPoint(page, 0);
  await page.mouse.click(center.x, center.y);
  await expect(page.getByTestId("selected-plot")).toContainText("P01");
  await expect(page.getByTestId("day")).toContainText("第 1 天");
});
