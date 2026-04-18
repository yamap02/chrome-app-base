import { defineConfig, devices } from "@playwright/test";

const baseConfig = {
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "html" : "list",
  use: {
    trace: "on-first-retry",
    viewport: { width: 1280, height: 720 },
  },
  projects: [
    {
      name: "chrome",
      use: {
        ...devices["Desktop Chrome"],
        channel: "chrome",
      },
    },
  ],
} satisfies Parameters<typeof defineConfig>[0];

export default defineConfig({
  ...baseConfig,
  ...(process.env.CI ? { workers: 1 } : {}),
});
