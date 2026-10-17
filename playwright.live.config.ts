import { defineConfig, devices } from "@playwright/test";

// Live end-to-end tests: the real FastAPI backend (tests/e2e_server.py, SQLite, seeded) and the real web app.
// Start both first (see e2e/live/README.md), then:  npx playwright test -c playwright.live.config.ts
const WEB = process.env.LIVE_WEB_URL ?? "http://localhost:3100";

export default defineConfig({
  testDir: "./e2e/live",
  outputDir: "./test-results-live",
  fullyParallel: false, // the specs share one backend database
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report-live" }]],
  use: {
    baseURL: WEB,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 768 } } },
    { name: "tablet", use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 1024 } } },
    { name: "phone", use: { ...devices["Pixel 7"] } },
  ],
});
