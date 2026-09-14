import { expect, test as setup } from "@playwright/test";

import { PROJECT_URL_PATTERN } from "../config/patterns";
import { createGovCredentials } from "../config/test-credentials";
import { GOV_USER, GOV_WORKSPACE } from "../config/test-data";
import { TurboplanSetupPage } from "../pages";
import {
  createGovernmentOrganization,
  createTestUserWithMagicLink,
} from "../utils";

const authFile = "./storage/auth/gov.json";

/**
 * Government user authentication setup that runs before all tests.
 * Creates a new government agency user via magic link, completes the
 * setup wizard with gov-specific data, then creates a separate GOVERNMENT
 * org+office in the database so citizens can discover it.
 */
// 120s: the gov flow (org creation + AI project bootstrap) regularly exhausts
// 60s on cold-start dev servers while racing the citizen setup in parallel.
setup.setTimeout(120_000);

setup("authenticate government", async ({ page }, testInfo) => {
  // Generate and store unique credentials for this test run
  const credentials = createGovCredentials();

  // Attach credentials to test report for debugging
  await testInfo.attach("gov-credentials", {
    body: JSON.stringify(credentials, null, 2),
    contentType: "application/json",
  });

  // Step 1: Create test user directly in database and get magic link URL
  const { magicLinkUrl, user: govUser } = await createTestUserWithMagicLink(
    credentials.email,
  );

  // Step 2: Create a GOVERNMENT-type organization with office in the DB.
  // This is separate from the user's personal org created during signup.
  // Citizens need a GOVERNMENT org to discover it in the office selector.
  const govOrg = await createGovernmentOrganization({
    name: `${credentials.email.split("@")[0]}'s Organization`,
    officeName: GOV_WORKSPACE.OFFICE_NAME,
    officeDescription: GOV_WORKSPACE.OFFICE_DESCRIPTION,
    ownerId: govUser.id,
    // Register the gov user's email domain so affiliation detection assigns
    // the government_agency role during setup (no manual role selection).
    emailDomains: [credentials.email.split("@")[1]],
  });
  console.log(
    `✓ Government org created: ${govOrg.orgSlug} / ${govOrg.officeSlug}`,
  );

  // Step 3: Navigate to magic link to authenticate
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

  // Step 4: Complete setup wizard as government agency user.
  // The wizard creates an office and project in the user's PERSONAL org.
  // The GOVERNMENT org+office was already created above via DB.
  const setupPage = new TurboplanSetupPage(page);
  await setupPage.completeWizard({
    firstName: GOV_USER.FIRST_NAME,
    lastName: GOV_USER.LAST_NAME,
    userRole: GOV_USER.USER_ROLE,
    jobTitle: GOV_USER.JOB_TITLE,
    officeName: GOV_WORKSPACE.OFFICE_NAME,
    officeDescription: GOV_WORKSPACE.OFFICE_DESCRIPTION,
    projectName: GOV_WORKSPACE.PROJECT_NAME,
  });

  // Verify user landed on the project page
  expect(page.url()).toMatch(PROJECT_URL_PATTERN);

  // Verify project name is visible in the breadcrumb navigation
  await expect(
    page.getByRole("navigation").getByRole("link", {
      name: GOV_WORKSPACE.PROJECT_NAME,
      exact: true,
    }),
  ).toBeVisible({ timeout: 10000 });

  // Save authentication state to file
  await page.context().storageState({ path: authFile });
});
