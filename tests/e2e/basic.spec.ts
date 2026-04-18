import { test, expect } from "@playwright/test";

test("browser can render a deterministic local page", async ({ page }) => {
  await page.goto("data:text/html,<main data-testid='app'>WXT test page</main>");
  await expect(page.getByTestId("app")).toHaveText("WXT test page");
});
