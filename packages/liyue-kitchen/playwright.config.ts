import { defineConfig, devices } from "@playwright/test";

const remoteURL = process.env.PLAYWRIGHT_BASE_URL;
const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

export default defineConfig({
  testDir: "./tests",
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: remoteURL || "http://127.0.0.1:4174",
    ...(remoteURL && bypassSecret ? {
      extraHTTPHeaders: { "x-vercel-protection-bypass": bypassSecret },
    } : {}),
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Remote acceptance must use deployed Vercel assets, never a local Vite fallback.
  webServer: remoteURL ? undefined : {
    command: "pnpm dev",
    url: "http://127.0.0.1:4174",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  outputDir: "./test-results",
});
