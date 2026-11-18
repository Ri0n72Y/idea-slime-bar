import { expect, test } from "@playwright/test";
import { newGame, applyCommand, type Command, type GameState } from "../src/domain/game.ts";
import { growRealFruit, putSavedGame } from "./support/worldFixture";
import { VISITOR_GIFT_ID, VISITOR_ID } from "../src/domain/visitors.ts";

async function ready(page: import("@playwright/test").Page) {
  await page.goto("/");
  await expect(page.getByTestId("loading-save")).toHaveCount(0);
  await expect(page.getByTestId("save-status")).toContainText("已保存");
  if (await page.getByTestId("night-report").count()) await page.getByTestId("close-report").click();
}
async function point(page: import("@playwright/test").Page, fx: number, fy: number) {
  const b = await page.getByTestId("crystal-canvas").boundingBox();
  if (!b) throw Error("Canvas missing");
  return { x: b.x + fx * b.width, y: b.y + fy * b.height };
}

test("first play offers skippable guidance for sowing, condensing, collecting and watering", async ({ page }, info) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await ready(page);
  await expect(page.getByTestId("next-step-text")).toContainText("播种");
  await page.getByTestId("guide-toggle").click();
  await expect(page.getByTestId("next-step-text")).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId("next-step-text")).toHaveCount(0);
  await page.getByTestId("guide-toggle").click();
  await expect(page.getByTestId("next-step-text")).toContainText("播种");
  const start = await page.getByTestId("seed-item").boundingBox();
  if (!start) throw Error("Seed missing");
  const dest = await point(page, .5, .5);
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(dest.x, dest.y, { steps: 14 });
  await page.mouse.up();
  await expect(page.getByTestId("next-step-text")).toContainText("凝聚");
  await page.getByTestId("condense").click();
  await expect(page.getByTestId("next-step-text")).toContainText("收集");
  const canvas = await page.getByTestId("crystal-canvas").boundingBox();
  if (!canvas) throw Error("Canvas missing");
  const radius = Math.min(canvas.width / 11, canvas.height / 7, 70);
  const dist = radius * 2.96 + 18, angle = -Math.PI/2 + .18;
  await page.mouse.click(canvas.x + canvas.width/2 + Math.cos(angle)*dist,
    canvas.y + canvas.height/2 + Math.sin(angle)*dist);
  await expect(page.getByTestId("next-step-text")).toContainText("浇灌");
  await page.locator('[data-testid^="water-"]').first().click();
  await expect(page.getByTestId("next-step-text")).toContainText("凝聚");
  await page.screenshot({ path: info.outputPath("first-play-guidance-1600x900.png") });
});

test("harvest move prerequisite, rejected wrong material and explicit eligible cup selection", async ({ page }, info) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1600, height: 900 });
  await ready(page);
  const { game: prepared, indices } = growRealFruit(newGame(), 2, 130);
  let g: GameState = prepared;
  const act = (command: Command) => {
    g = applyCommand(g, command);
    if (g.notice.kind === "locked") throw Error(g.notice.message);
  };
  act({ type: "ACCEPT_ORDER", orderId: "order:first" });
  const tree = g.plots.P01.plant!;
  act({ type: "HARVEST", plotId: "P01", plantId: tree.id, leafId: tree.leaves[indices[0]].id });
  const firstFruit = g.selectedItemId!;
  await putSavedGame(page, g);
  await page.reload();
  await expect(page.getByTestId("loading-save")).toHaveCount(0);
  if (await page.getByTestId("night-report").count()) await page.getByTestId("close-report").click();
  await expect(page.getByTestId("next-step-text")).toContainText("水晶球地面");
  await expect(page.getByTestId("order-location-order:first")).toContainText("物品栏或仓储区");
  await page.getByTestId("deliver-order").click();
  await expect(page.getByTestId("feedback")).toContainText("物品栏/仓储区");
  await expect(page.getByTestId("next-step-text")).toContainText("水晶球地面");
  await page.screenshot({ path: info.outputPath("harvest-needs-moving.png") });

  // Prepare the next genuine commission and a genuine cup via actual production commands.
  act({ type: "MOVE_ITEM", itemId: firstFruit, destination: { kind: "storage" } });
  act({ type: "DELIVER_ORDER", orderId: "order:first", itemIds: [firstFruit] });
  const next = Object.values(g.orders).find(o => o.state === "available" && o.itemKind === "juice_cup")!;
  act({ type: "ACCEPT_ORDER", orderId: next.id });
  act({ type: "HARVEST", plotId: "P01", plantId: tree.id, leafId: tree.leaves[indices[1]].id });
  const fruit = g.selectedItemId!;
  act({ type: "MOVE_ITEM", itemId: fruit, destination: { kind: "workbench", slot: "peel" } });
  act({ type: "PROCESS_ITEM", itemId: fruit, action: "PEEL" });
  const flesh = g.selectedItemId!;
  act({ type: "MOVE_ITEM", itemId: flesh, destination: { kind: "workbench", slot: "juice" } });
  act({ type: "PROCESS_ITEM", itemId: flesh, action: "JUICE" });
  const raw = g.selectedItemId!;
  act({ type: "PROCESS_ITEM", itemId: raw, action: "CUP" });
  const cup = g.selectedItemId!;
  act({ type: "MOVE_ITEM", itemId: cup, destination: { kind: "storage" } });
  act({ type: "TALK_VISITOR", visitorId: VISITOR_ID, action: "greet" });
  act({ type: "TALK_VISITOR", visitorId: VISITOR_ID, action: "ask_clue" });
  act({ type: "TALK_VISITOR", visitorId: VISITOR_ID, action: "accept_gift" });
  await putSavedGame(page, g);
  await page.reload();
  await expect(page.getByTestId("loading-save")).toHaveCount(0);
  if (await page.getByTestId("night-report").count()) await page.getByTestId("close-report").click();
  await page.locator('[data-item-id="'+VISITOR_GIFT_ID+'"]').first().click();
  await expect(page.getByTestId(`order-warning-${next.id}`)).toContainText("旅人木牌");
  await expect(page.getByTestId(`order-candidates-${next.id}`)).toContainText("杯装水瓜汁");
  await page.getByTestId("deliver-order").click();
  await expect(page.getByTestId("feedback")).toContainText("所选材料类型不符");
  await expect(page.getByTestId("fruit-storage")).toHaveAttribute("data-item-id", cup);
  const choice = page.getByTestId(`choose-order-${next.id}-${cup}`);
  await choice.click();
  await expect(choice).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId(`order-warning-${next.id}`)).toHaveCount(0);
  await page.screenshot({ path: info.outputPath("explicit-cup-selection.png") });
  await page.getByTestId("deliver-order").click();
  await expect(page.getByTestId("feedback")).toContainText("委托完成");
  await expect(page.getByTestId("fruit-storage")).not.toHaveAttribute("data-item-id", cup);
});
