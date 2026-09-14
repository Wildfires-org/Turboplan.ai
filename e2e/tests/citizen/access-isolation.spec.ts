import { expect, test } from "@playwright/test";

import { createToken } from "@wildfires-org/turboplan-api-client";
import { getUserByEmail } from "@wildfires-org/turboplan-db/queries";

import { getCitizenCredentials } from "../../config/test-credentials";
import {
  CITIZEN_GOV_PROJECT,
  GOV_WORKSPACE,
  TEST_WORKSPACE,
} from "../../config/test-data";
import { TurboplanDashboardPage, TurboplanProjectPage } from "../../pages";
import {
  createTestProjectInOffice,
  createTestUserWithMagicLink,
  getGovWorkspace,
} from "../../utils";

const SERVER_URL = process.env.SERVER_URL || "http://localhost:3001";

/**
 * Access Isolation tests.
 *
 * Verifies that:
 * - Gov user cannot see citizen's draft project in their project listing
 * - Gov user gets a restricted-access page when navigating to citizen's draft project URL
 * - Citizen's draft project is not returned in API calls by other users
 * - Unauthenticated users cannot access private projects via the public API
 */
test.describe("Access Isolation", () => {
  let govOrgSlug: string;
  let govOfficeSlug: string;
  let citizenProjectSlug: string;

  test.beforeAll(async () => {
    const govWorkspace = await getGovWorkspace();
    govOrgSlug = govWorkspace.orgSlug;
    govOfficeSlug = govWorkspace.officeSlug;

    // Get citizen user
    const citizenCreds = getCitizenCredentials();
    if (!citizenCreds) {
      throw new Error("Citizen credentials not found");
    }
    const citizenUser = await getUserByEmail(citizenCreds.email);
    if (!citizenUser) {
      throw new Error("Citizen user not found in database");
    }

    // Create a citizen-owned draft project in the gov office
    const citizenProject = await createTestProjectInOffice({
      name: CITIZEN_GOV_PROJECT.PROJECT_NAME,
      description: CITIZEN_GOV_PROJECT.PROJECT_DESCRIPTION,
      officeId: govWorkspace.officeId,
      createdBy: citizenUser.id,
    });
    citizenProjectSlug = citizenProject.slug;
  });

  test("gov user cannot see citizen draft projects in the gov office listing", async ({
    browser,
  }) => {
    const govContext = await browser.newContext({
      storageState: "./storage/auth/gov.json",
    });
    const govPage = await govContext.newPage();
    const dashboard = new TurboplanDashboardPage(govPage);

    await dashboard.gotoOffice(govOrgSlug, govOfficeSlug);

    // The citizen's draft project in the gov office should NOT be visible
    await dashboard.expectProjectNotVisible(CITIZEN_GOV_PROJECT.PROJECT_NAME);

    // The citizen's personal "Test Project" should also NOT be visible
    await dashboard.expectProjectNotVisible(TEST_WORKSPACE.PROJECT_NAME);

    await govContext.close();
  });

  test("gov user sees restricted-access when navigating to citizen project URL", async ({
    browser,
  }) => {
    const govContext = await browser.newContext({
      storageState: "./storage/auth/gov.json",
    });
    const govPage = await govContext.newPage();
    const dashboard = new TurboplanDashboardPage(govPage);

    await dashboard.gotoProject(govOrgSlug, govOfficeSlug, citizenProjectSlug);
    await dashboard.expectAccessRestricted();

    await govContext.close();
  });

  test("citizen draft project is not returned in the public projects API", async ({
    request,
  }) => {
    const response = await request.get(`${SERVER_URL}/api/public/projects`);

    expect(response.status()).toBe(200);

    const projects = (await response.json()) as { name: string }[];
    const citizenProject = projects.find(
      (p) => p.name === TEST_WORKSPACE.PROJECT_NAME,
    );

    expect(citizenProject).toBeUndefined();
  });

  test("different user cannot access citizen project via authenticated API", async () => {
    const { user: freshUser } = await createTestUserWithMagicLink(
      `access-isolation-${Date.now()}@example.com`,
    );
    const token = await createToken({ id: freshUser.id });

    const response = await fetch(`${SERVER_URL}/api/projects/my`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(200);

    const projects = (await response.json()) as { name: string }[];
    const citizenProject = projects.find(
      (p) => p.name === TEST_WORKSPACE.PROJECT_NAME,
    );
    expect(citizenProject).toBeUndefined();
  });

  test("citizen cannot see gov user's non-public project details via API without RBAC", async ({
    page,
  }) => {
    const dashboard = new TurboplanDashboardPage(page);
    const project = new TurboplanProjectPage(page);

    await dashboard.gotoOffice(govOrgSlug, govOfficeSlug);

    const main = dashboard.getMain();
    const projectLink = main.getByRole("link", {
      name: GOV_WORKSPACE.PROJECT_NAME,
    });

    if (await projectLink.isVisible()) {
      await projectLink.click();
      await page.waitForURL(/\/projects\//, { timeout: 10000 });

      await project.expectNoVisibilityControls();
    }
  });
});
