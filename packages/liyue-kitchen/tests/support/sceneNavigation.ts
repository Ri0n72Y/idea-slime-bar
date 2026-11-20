import { expect, type Page } from "@playwright/test";

/** Navigate the actual UI; never mutate domain state to bypass a scene. */
export async function enterGarden(page: Page, touch = false) {
  if (!(await page.getByTestId("garden-scene").count())) {
    if (await page.getByTestId("night-report").count())
      await page.getByTestId("close-report").click();
    if (touch) await page.getByTestId("enter-garden").tap();
    else await page.getByTestId("enter-garden").click();
  }
  await expect(page.getByTestId("garden-scene")).toBeVisible();
  await expect(page.getByTestId("crystal-canvas")).toHaveCount(1);
}
export async function backWorkshop(page: Page, touch = false) {
  if (!(await page.getByTestId("workshop-scene").count())) {
    if (touch) await page.getByTestId("back-workshop").tap();
    else await page.getByTestId("back-workshop").click();
  }
  await expect(page.getByTestId("workshop-scene")).toBeVisible();
  await expect(page.getByTestId("crystal-canvas")).toHaveCount(0);
}
