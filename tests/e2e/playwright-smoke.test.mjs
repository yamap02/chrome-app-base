import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const extensionPath = path.join(repoRoot, ".output", "chrome-mv3");

test("Playwright extension popup smoke", async () => {
  const userDataDir = await mkdtemp(path.join(os.tmpdir(), "chrome-extension-base-playwright-"));
  const context = await chromium.launchPersistentContext(userDataDir, {
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
    headless: false,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });

  try {
    const worker =
      context.serviceWorkers()[0] ??
      (await context.waitForEvent("serviceworker", { timeout: 15_000 }));
    const extensionId = new URL(worker.url()).hostname;
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.locator(".hero-title").waitFor();
    await assert.equal(
      await page.locator('button[aria-label="拡張機能有効状態切替"]').textContent(),
      "ON",
    );
    await page.locator('button[aria-label="拡張機能有効状態切替"]').click();
    await assert.equal(
      await page.locator('button[aria-label="拡張機能有効状態切替"]').textContent(),
      "OFF",
    );
  } finally {
    await context.close();
    await rm(userDataDir, { force: true, recursive: true });
  }
});
