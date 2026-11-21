import { expect, test } from "@playwright/test";
import { newGame } from "../src/domain/game.ts";
import { saveEnvelope } from "../src/domain/save.ts";
import { newReactionState } from "../src/domain/reactions.ts";
import { putSavedGame } from "./support/worldFixture";

test("alternate JSON config drives the browser quota, deadline, material delivery and reward", async ({ page }) => {
  test.skip(process.env.LIYUE_BALANCE_VARIANT !== "1", "Run only with the isolated alternative-config command");
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto("/");
  await expect(page.getByTestId("loading-save")).toHaveCount(0);
  await expect(page.getByTestId("quota")).toContainText("6/6");
  await expect(page.getByTestId("order-deadline").first()).toContainText("13");
  await page.getByTestId("condense").click();
  await expect(page.getByTestId("feedback")).toContainText("80V");
  await expect(page.getByTestId("quota")).toContainText("5/6");

  const game = newGame(110);
  const ids = ["item:aquamelon:fixture101", "item:aquamelon:fixture102"];
  ids.forEach((id, index) => {
    const source = { plotId: "P01" as const, plantId: "plant:fixture", leafId: "leaf:" + (index + 1) };
    game.harvestedSources.push(source.plotId + "/" + source.plantId + "/" + source.leafId);
    game.items[id] = {
      id, kind: "Aquamelon", source,
      location: { kind: index ? "storage" : "inventory" },
      free: [10, 10, 10, 10, 10, 10, 10],
      reaction: newReactionState(),
      baseAffinity: [1, 1, 1, 1, 1, 1, 1], lockedAffinity: null
    };
  });
  // Exercise the real IndexedDB import/hydration path with the alternative world.
  await putSavedGame(page, game);
  await page.reload();
  await expect(page.getByTestId("loading-save")).toHaveCount(0);
  await expect(page.getByTestId("order-requirement").first()).toContainText("× 2");
  await page.getByTestId("accept-order").first().click();
  await page.getByTestId("choose-order-order:first-" + ids[0]).click();
  await page.getByTestId("deliver-order").first().click();
  await expect(page.getByTestId("feedback")).toContainText("获得 21 仙力");
  await expect(page.getByTestId("order-history").first()).toContainText("已交付");
  const snapshot = await page.evaluate(async () => {
    const request = indexedDB.open("liyue-kitchen", 6);
    return new Promise<{ game: { adeptalEnergy: { balance: number }; orders: Record<string, { quantity: number; dueDay: number }> } }>((resolve, reject) => {
      request.onsuccess = () => {
        const db = request.result, tx = db.transaction("game-saves", "readonly");
        const read = tx.objectStore("game-saves").get("primary");
        read.onsuccess = () => { db.close(); resolve(read.result); };
        read.onerror = () => reject(read.error);
      };
      request.onerror = () => reject(request.error);
    });
  });
  expect(snapshot.game.adeptalEnergy.balance).toBe(21);
  expect(snapshot.game.orders["order:first"].quantity).toBe(2);
  expect(snapshot.game.orders["order:first"].dueDay).toBe(13);
  await page.reload();
  await expect(page.getByTestId("order-history").first()).toContainText("已交付");
});
