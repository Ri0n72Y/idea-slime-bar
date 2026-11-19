import { expect, test, type Page } from "@playwright/test";
import { applyCommand, newGame } from "../src/domain/game.ts";
import { saveEnvelope } from "../src/domain/save.ts";

async function ready(page: Page) {
  await page.goto("/");
  await expect(page.getByTestId("loading-save")).toHaveCount(0);
  await expect(page.getByTestId("save-status")).toContainText("å·²ä¿å­˜");
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
  await expect(page.getByTestId("loa¶»§q«^