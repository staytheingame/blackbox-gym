import { defineConfig, devices } from "@playwright/test";

const playwrightPort = process.env.PLAYWRIGHT_PORT ?? "3210";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: `http://127.0.0.1:${playwrightPort}`,
    trace: "retain-on-failure",
  },
  webServer: {
    command: `npm run start -- -p ${playwrightPort}`,
    url: `http://127.0.0.1:${playwrightPort}/araclar/kamera-fight-lab`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
  projects: [
    {
      name: "chrome-desktop",
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
    {
      name: "edge-desktop",
      use: { ...devices["Desktop Edge"], channel: "msedge" },
    },
  ],
});
