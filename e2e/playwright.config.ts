import { defineConfig, devices } from "@playwright/test";

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: "./tests",

  /* Global setup runs before all tests - handles migrations, database seeding and environment setup */
  globalSetup: "./global-setup.ts",

  /* Global teardown runs after all tests - cleans up database by dropping/recreating schema */
  globalTeardown: "./global-teardown.ts",

  /* Run tests in files in parallel */
  fullyParallel: true,

  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Opt out of parallel tests on CI for database transaction safety.
   * Locally, cap at 2: the test DB is a remote Neon branch (~115 ms per
   * query), so the default (half the cores) piles up seconds of API latency
   * per page and blows the 30 s test budget with timeouts, not real failures. */
  workers: process.env.CI ? 1 : 2,

  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ["html", { outputFolder: "reports/html" }],
    ["list"],
    ...(process.env.CI ? [["github"] as const] : []),
  ],

  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.TURBOPLAN_URL || "http://localhost:3000",

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: "on-first-retry",

    /* Capture screenshot on failure */
    screenshot: "only-on-failure",

    /* Capture video on failure */
    video: "retain-on-failure",
  },

  /* Configure projects for major browsers */
  projects: [
    /* Setup project - citizen user authentication */
    {
      name: "setup-citizen",
      testMatch: /auth-citizen\.setup\.ts/,
    },

    /* Setup project - government user authentication */
    {
      name: "setup-gov",
      testMatch: /auth-gov\.setup\.ts/,
    },

    /* API-only tests - no browser auth needed */
    {
      name: "api",
      testMatch: /.*\/api\/.*\.spec\.ts/,
      dependencies: ["setup-citizen", "setup-gov"],
    },

    /* Main test project - all browser tests run here (default: citizen auth) */
    {
      name: "chromium",
      testIgnore: /.*\/api\/.*\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        /* Use citizen auth state by default */
        storageState: "./storage/auth/citizen.json",
      },
      dependencies: ["setup-citizen", "setup-gov"],
    },
  ],
});
