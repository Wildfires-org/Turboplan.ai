import { expect, test } from "@playwright/test";

import { getUserByEmail } from "@wildfires-org/turboplan-db/queries";

import { PROJECT_URL_PATTERN } from "../../config/patterns";
import { getCitizenCredentials } from "../../config/test-credentials";
import { TEST_WORKSPACE } from "../../config/test-data";
import { LandingHomePage } from "../../pages/landing-home";
import { getTestOffice, getTestUserOrganization } from "../../utils";

/**
 * Cross-app user journey tests.
 * Demonstrates full integration testing across landing-page and turboplan.
 *
 * Note: `page` is already authenticated via storageState from auth.setup.ts
 * which creates the test office and project.
 */
test.describe("Cross-App User Journey", () => {
  // Last-in-suite UI assertions can starve under full parallel load; give the
  // end-to-end page loads headroom over the default 30s.
  test.setTimeout(60_000);

  let citizenOrgSlug: string;
  let citizenOfficeSlug: string;
  let citizenOfficeName: string;

  test.beforeAll(async () => {
    const citizenCreds = getCitizenCredentials();
    if (!citizenCreds) throw new Error("Citizen credentials not found");
    const citizenUser = await getUserByEmail(citizenCreds.email);
    if (!citizenUser) throw new Error("Citizen user not found");
    const citizenOrg = await getTestUserOrganization(citizenUser.id);
    if (!citizenOrg) throw new Error("Citizen org not found");
    const citizenOffice = await getTestOffice(citizenOrg.id);
    if (!citizenOffice) throw new Error("Citizen office not found");
    citizenOrgSlug = citizenOrg.slug;
    citizenOfficeSlug = citizenOffice.slug;
    citizenOfficeName = citizenOffice.name;
  });

  test("should have access to office and project created during setup", async ({
    page,
  }) => {
    // Navigate directly to citizen's org (citizen may have access to
    // multiple orgs, so "/" redirect is not deterministic).
    await page.goto(`/organizations/${citizenOrgSlug}`);

    // Verify we're authenticated (not on login page)
    await expect(page).not.toHaveURL(/\/login/);

    // Verify test office is visible on the organization dashboard
    await expect(page.getByText(citizenOfficeName)).toBeVisible({
      timeout: 25000,
    });

    // Navigate to the office
    await page.getByText(citizenOfficeName).click();

    // Verify test project is visible on the office page (in the projects card grid)
    const main = page.getByRole("main");
    await expect(
      main.getByRole("link", { name: TEST_WORKSPACE.PROJECT_NAME }),
    ).toBeVisible({
      timeout: 25000,
    });
  });

  test("should maintain auth state when navigating to landing page and back", async ({
    page,
  }) => {
    // Navigate directly to citizen's office
    await page.goto(
      `/organizations/${citizenOrgSlug}/offices/${citizenOfficeSlug}`,
    );
    await page
      .getByRole("main")
      .getByRole("link", { name: TEST_WORKSPACE.PROJECT_NAME })
      .click();

    // Wait for navigation to project page and store the URL
    await expect(page).toHaveURL(PROJECT_URL_PATTERN);
    const projectUrl = page.url();

    // Navigate to landing page
    const landingPage = new LandingHomePage(page);
    await landingPage.goto();

    // Navigate back to turboplan
    await page.goto(projectUrl);

    // Verify we're still on the project page (not redirected to login)
    expect(page.url()).not.toContain("/login");
    await expect(
      page.getByRole("heading", { name: TEST_WORKSPACE.PROJECT_NAME }),
    ).toBeVisible();
  });
});
