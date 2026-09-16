import { defineConfig, devices } from "@playwright/test";

const chromiumExecutable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  reporter: "line",
  webServer: {
    command: "node tests/server.mjs",
    port: 4173,
    reuseExistingServer: false,
  },
  use: {
    baseURL: "http://127.0.0.1:4173",
    viewport: { width: 420, height: 560 },
    reducedMotion: "reduce",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 420, height: 560 },
        launchOptions: chromiumExecutable
          ? { executablePath: chromiumExecutable, args: ["--no-sandbox"] }
          : undefined,
      },
    },
    { name: "firefox", use: { ...devices["Desktop Firefox"], viewport: { width: 420, height: 560 } } },
  ],
});
