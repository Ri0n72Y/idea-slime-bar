import { expect, type Page } from "@playwright/test";
import { applyCommand, newGame, type GameState } from "../../src/domain/game.ts";

/** Domain-only fixture preparation runs in the Node test process at the exact checkout SHA.
 * The deployed browser only receives a serializable save; there are no /src imports,
 * debug endpoints, test commands, or fixture generators in the Vercel app bundle.
 */
export function growRealFruit(initial: GameState = newGame(), wanted = 1, maxNights = 130) {
  let g = initial.plots.P01.plant ? initial :
    applyCommand(initial, { type: "PLANT_SEED", itemId: "item:seed:1", plotId: "P01" });
  let indices: number[] = [];
  for (let d = 0; d < maxNights; d++) {
    for (let n = g.dayCondenseUsed; n < g.dayCondenseLimit; n++) {
      g = applyCommand(g, { type: "CONDENSE" });
      const ball = Object.values(g.looseBalls).at(-1);
      if (!ball) throw Error("Real CONDENSE failed");
      g = applyCommand(g, { type: "COLLECT_BALL", ballId: ball.id });
      g = applyCommand(g, { type: "WATER_PLOT", plotId: "P01", element: ball.element });
    }
    g = applyCommand(g, { type: "REQUEST_END_DAY" });
    g = applyCommand(g, { type: "CONFIRM_END_DAY", expectedDay: g.day });
    indices = g.plots.P01.plant?.leaves.flatMap((leaf, i) =>
      leaf.fruit?.stage === "MatureFruit" ? [i] : []) ?? [];
    if (indices.length >= wanted) return { game: g, indices };
  }
  throw Error(`Only ${indices.length}/${wanted} real mature fruit after ${maxNights} nights`);
}

/** Save writes are confined to the isolated Playwright browser context, not Production users. */
export async function putSavedGame(page: Page, game: unknown, version = 6): Promise<void> {
  await page.evaluate(async (record) => {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open("liyue-kitchen", 6);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction("game-saves", "readwrite");
        tx.objectStore("game-saves").put(record, "primary");
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
      };
    });
  }, { version, game });
}

export async function getSavedGame(page: Page): Promise<GameState> {
  // Observe the same serialized persistence boundary as the player UI.
  await expect(page.getByTestId("save-status")).toContainText("已保存");
  return page.evaluate(async () => new Promise<GameState>((resolve, reject) => {
    const req = indexedDB.open("liyue-kitchen", 6);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction("game-saves", "readonly");
      const get = tx.objectStore("game-saves").get("primary");
      get.onsuccess = () => { db.close(); resolve(get.result.game); };
      get.onerror = () => { db.close(); reject(get.error); };
    };
  }));
}
