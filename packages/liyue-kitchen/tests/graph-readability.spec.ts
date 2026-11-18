import { expect, test } from "@playwright/test";

for (const viewport of [{ width: 1600, height: 900 }, { width: 1280, height: 720 }]) {
  test(`discovery graph is readable and navigable at ${viewport.width}x${viewport.height}`, async ({ browser }, info) => {
    const touch = viewport.width === 1280;
    const context = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const press = (id: string) => touch ? page.getByTestId(id).tap() : page.getByTestId(id).click();
    await page.goto("/");
    await expect(page.getByTestId("loading-save")).toHaveCount(0);
    await press("open-discoveries");
    await expect(page.getByTestId("graph-zoom")).toContainText("100%");
    await expect(page.getByTestId("zoom-out")).toBeDisabled();
    await expect(page.getByTestId("graph-navigation-hint")).toContainText("向右滚动或滑动");
    const node = page.getByTestId("discovery-node").first();
    const fontSize = await node.evaluate(el => parseFloat(getComputedStyle(el).fontSize));
    expect(fontSize).toBeGreaterThanOrEqual(14);
    const evidence = page.getByTestId("discovery-evidence-A00");
    await expect(evidence).toContainText("获得第一枚真实种子");
    await expect(evidence).not.toContainText(/event:|item:/);
    await expect(evidence).toHaveAttribute("data-source-id", "item:seed:1");
    await press("graph-right");
    await expect.poll(async () => page.getByTestId("discovery-viewport")
      .evaluate(el => el.scrollLeft)).toBeGreaterThan(30);
    await page.screenshot({ path: info.outputPath(`discovery-readable-${viewport.width}.png`), fullPage: true });
    await press("graph-left");
    await expect.poll(async () => page.getByTestId("discovery-viewport")
      .evaluate(el => el.scrollLeft)).toBeLessThan(10);
    await press("close-discoveries");
    await expect(page.getByTestId("discovery-dialog")).toHaveCount(0);
    await context.close();
  });
}
