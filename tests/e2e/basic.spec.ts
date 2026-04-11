import { test, expect } from "@playwright/test";

test("browser can navigate to a URL", async ({ page }) => {
  await page.goto("https://www.google.com");
  await expect(page).toHaveURL(/.*google\.com.*/);
});
