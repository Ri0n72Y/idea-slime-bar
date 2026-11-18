import type { BrowserContextOptions } from "@playwright/test";

/** The Playwright page fixture already gets these options from playwright.config.
 * Explicit browser.newContext() calls do NOT inherit them. Keep all remote
 * desktop/touch contexts on the same verified Vercel URL and bypass policy.
 */
export const remoteBrowserContextOptions: BrowserContextOptions = {
  ...(process.env.PLAYWRIGHT_BASE_URL ? { baseURL: process.env.PLAYWRIGHT_BASE_URL } : {}),
  ...(process.env.VERCEL_AUTOMATION_BYPASS_SECRET ? {
    extraHTTPHeaders: { "x-vercel-protection-bypass": process.env.VERCEL_AUTOMATION_BYPASS_SECRET },
  } : {}),
};
