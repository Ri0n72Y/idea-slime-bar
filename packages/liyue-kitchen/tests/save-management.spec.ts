import { expect, test, type Page } from "@playwright/test";
import { applyCommand, newGame } from "../src/domain/game.ts";
import { saveEnvelope } from "../src/domain/save.ts";

async function ready(page: Page) {
  await page.goto("/");
  await expect(page.getByTestId("loading-save")).toHaveCount(0);
  await expect(page.getByTestId("save-status")).toContainText("已保存");
}
async function chooseFile(page: Page, data: unknown) {
  await page.getByTestId("save-import-file").setInputFiles({
    name: "test-backup.json", mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(data), "utf8"),
  });
}

test("random first boot survives reload; reset requires confirmation and creates a single Seed", async ({ page }, info) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await ready(page);
  const firstSeed = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open("liyue-kitchen", 6);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    const record = await new Promise<{ game: { randomState: number } }>((resolve, reject) => {
      const r = db.transaction("game-saves", "readonly").objectStore("game-saves").get("primary");
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    db.close();
    return record.game.randomState;
  });
  await page.reload();
  await expect(page.getByTestId("loading-save")).toHaveCount(0);
  await page.getByTestId("save-open").click();
  await page.getByTestId("save-restart").click();
  await page.getByTestId("save-restart-cancel").click();
  await expect(page.getByTestId("save-restart-confirmation")).toHaveCount(0);
  await expect(page.getByTestId("save-current-summary")).toContainText("第 1 天");
  await page.getByTestId("save-restart").click();
  await page.getByTestId("save-restart-confirm").click();
  await expect(page.getByTestId("save-dialog")).toHaveCount(0);
  await expect(page.getByTestId("seed-item")).toHaveCount(1);
  await expect(page.getByTestId("next-step-text")).toContainText("播种");
  await page.getByTestId("save-open").click();
  await page.screenshot({ path: info.outputPath("save-manager-desktop.png") });
  const secondSeed = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open("liyue-kitchen", 6); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
    });
    const result = await new Promise<{ game: { randomState: number } }>((resolve, reject) => {
      const r = db.transaction("game-saves", "readonly").objectStore("game-saves").get("primary");
      r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
    });
    db.close();
    return result.game.randomState;
  });
  expect(secondSeed).not.toBe(firstSeed);
});

test("backup exports validated JSON; invalid file and canceled import preserve progress; confirmed import restores it", async ({ page }, info) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await ready(page);
  await page.getByTestId("condense").click();
  await expect(page.getByTestId("quota")).toContainText("7/8");
  await expect(page.getByTestId("save-status")).toContainText("已保存");
  await page.getByTestId("save-open").click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("save-export").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^liyue-kitchen-day-1.json$/);
  const downloadPath = await download.path();
  if (!downloadPath) throw new Error("Download has no path");
  const fileContents = await import("node:fs/promises").then(fs => fs.readFile(downloadPath, "utf8"));
  const backup = JSON.parse(fileContents);
  expect(backup.version).toBe(6);
  expect(backup.game.dayCondenseUsed).toBe(1);
  await chooseFile(page, { version: 6, game: { day: 999 } });
  await expect(page.getByTestId("save-manager-feedback")).toContainText("导入失败");
  await expect(page.getByTestId("save-import-confirmation")).toHaveCount(0);
  await chooseFile(page, backup);
  await expect(page.getByTestId("save-import-summary")).toContainText("第 1 天");
  await page.getByTestId("save-import-cancel").click();
  await expect(page.getByTestId("save-import-confirmation")).toHaveCount(0);
  await page.getByTestId("save-restart").click();
  await page.getByTestId("save-restart-confirm").click();
  await expect(page.getByTestId("quota")).toContainText("8/8");
  await page.getByTestId("save-open").click();
  await chooseFile(page, backup);
  await expect(page.getByTestId("save-import-confirmation")).toHaveCount(1);
  await page.screenshot({ path: info.outputPath("import-confirm-touch.png") });
  await page.getByTestId("save-import-confirm").click();
  await expect(page.getByTestId("save-dialog")).toHaveCount(0);
  await expect(page.getByTestId("quota")).toContainText("7/8");
  await page.reload();
  await expect(page.getByTestId("quota")).toContainText("7/8");
  await expect(page.getByTestId("next-step-text")).toContainText("播种");
});

test("restoring a progressed saved world updates visitor, orders, plant and guidance after reload", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await ready(page);
  let g = newGame(883);
  g = applyCommand(g, { type: "PLANT_SEED", itemId: "item:seed:1", plotId: "P01" });
  g = applyCommand(g, { type: "ACCEPT_ORDER", orderId: "order:first" });
  g = applyCommand(g, { type: "CONDENSE" });
  await page.getByTestId("save-open").click();
  await chooseFile(page, saveEnvelope(g));
  await page.getByTestId("save-import-confirm").click();
  await expect(page.getByTestId("seed-item")).toHaveCount(0);
  await expect(page.getByTestId("quota")).toContainText("7/8");
  await expect(page.getByTestId("order-status").first()).toContainText("已接受");
  await expect(page.getByTestId("next-step-text")).toContainText("收集");
  await page.reload();
  await expect(page.getByTestId("seed-item")).toHaveCount(0);
  await expect(page.getByTestId("quota")).toContainText("7/8");
  await expect(page.getByTestId("order-status").first()).toContainText("已接受");
});
