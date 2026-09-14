import { expect, test as setup } from "@playwright/test";

import { PROJECT_URL_PATTERN } from "../config/patterns";
import { createCitizenCredentials } from "../config/test-credentials";
import { CITIZEN_USER, TEST_WORKSPACE } from "../config/test-data";
import { TurboplanSetupPage } from "../pages";
import { createTestUserWithMagicLink } from "../utils";

const authFile = "./storage/auth/citizen.json";

/**
 * Citizen authentication setup that runs before all tests.
 * Creates a new citizen user via magic link and saves auth state for reuse.
 *
 * Uses direct database access to create user and generate magic link,
 * bypassing email sending for faster, more reliable tests.
 */
setup.setTimeout(60_000);

setup("authenticate citizen", async ({ page }, testInfo) => {
  // Generate and store unique credentials for this test run
  const credentials = createCitizenCredentials();

  // Attach credentials to test report for debugging
  await testInfo.attach("citizen-credentials", {
    body: JSON.stringify(credentials, null, 2),
    contentType: "application/json",
  });

  // Step 1: Create test user directly in database and get magic link URL
  const { magicLinkUrl } = await createTestUserWithMagicLink(credentials.email);

  // Step 2: Navigate to magic link to authenticate
  await page.goto(magicLinkUrl);

  // Wait for successful verification and redirect
  await expect(page.getByText(/verified|signed in/i)).toBeVisible({
    timeout: 10000,
  });

  // Wait for redirect to setup page (new user needs profile setup)
  await page.waitForURL(/\/setup/, { timeout: 15000 });

  // Pin the sidebar so all elements are visible during tests
  await page.context().addCookies([
    {
      name: "sidebar_pinned",
      value: "true",
      domain: "localhost",
      path: "/",
    },
  ]);

  // Step 3: Complete setup wizard as citizen
  const setupPage = new TurboplanSetupPage(page);
  await setupPage.completeWizard({
    firstName: CITIZEN_USER.FIRST_NAME,
    lastName: CITIZEN_USER.LAST_NAME,
    userRole: CITIZEN_USER.USER_ROLE,
  });

  // Verify user landed on the project page (/organizations/[slug]/offices/[slug]/projects/[slug])
  expect(page.url()).toMatch(PROJECT_URL_PATTERN);

  // Verify project name is visible in the breadcrumb navigation
  await expect(
    page.getByRole("navigation").getByRole("link", {
      name: TEST_WORKSPACE.PROJECT_NAME,
      exact: true,
    }),
  ).toBeVisible({ timeout: 10000 });

  // Save authentication state to file
  await page.context().storageState({ path: authFile });
});
