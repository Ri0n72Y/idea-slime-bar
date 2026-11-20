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
    // Secret-bearing request headers must never enter uploaded Playwright traces.
    trace: bypassSecret ? "off" : "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Remote acceptance must use deployed Vercel assets, never a local Vite fallback.
  webServer: remoteURL ? undefined : {
    command: "pnpm dev",
    url: "http://127.0.0.1:4174",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  // Concurrent Playwright invocations must never delete one another's traces.
  // Worker shards within one invocation share this run directory through config.
  outputDir: process.env.PLAYWRIGHT_OUTPUT_DIR ||
    `./test-results/run-${process.pid}-${Date.now()}`,
});
