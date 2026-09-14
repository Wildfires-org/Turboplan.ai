import { expect, test } from "@playwright/test";

import { getUserByEmail } from "@wildfires-org/turboplan-db/queries";

import { PROJECT_URL_PATTERN } from "../../config/patterns";
import { getCitizenCredentials } from "../../config/test-credentials";
import { TEST_WORKSPACE } from "../../config/test-data";
import { getTestOffice, getTestUserOrganization } from "../../utils";

/**
 * Project Timeline E2E tests.
 *
 * Verifies the timeline section is visible on the project page and that
 * the visibility toggle (eye icon) works correctly.
 *
 * Note: `page` is already authenticated via storageState from auth.setup.ts.
 * The test workspace with "Test Office" and "Test Project" is pre-seeded
 * and already has a "Created Project" timeline entry.
 */
test.describe("Project Timeline", () => {
  let citizenOrgSlug: string;
  let citizenOfficeSlug: string;

  test.beforeAll(async () => {
    const citizenCreds = getCitizenCredentials();
    if (!citizenCreds) {
      throw new Error("Citizen credentials not found");
    }

    const citizenUser = await getUserByEmail(citizenCreds.email);
    if (!citizenUser) {
      throw new Error("Citizen user not found");
    }

    const citizenOrg = await getTestUserOrganization(citizenUser.id);
    if (!citizenOrg) {
      throw new Error("Citizen org not found");
    }

    const citizenOffice = await getTestOffice(citizenOrg.id);
    if (!citizenOffice) {
      throw new Error("Citizen office not found");
    }
    citizenOrgSlug = citizenOrg.slug;
    citizenOfficeSlug = citizenOffice.slug;
  });

  const navigateToProject = async (page: import("@playwright/test").Page) => {
    // Navigate directly to citizen's office (citizen may have access to
    // multiple orgs, so "/" redirect is not deterministic).
    await page.goto(
      `/organizations/${citizenOrgSlug}/offices/${citizenOfficeSlug}`,
    );

    const main = page.getByRole("main");
    await expect(
      main.getByRole("link", { name: TEST_WORKSPACE.PROJECT_NAME }),
    ).toBeVisible({ timeout: 10000 });
    await main.getByRole("link", { name: TEST_WORKSPACE.PROJECT_NAME }).click();

    await expect(page).toHaveURL(PROJECT_URL_PATTERN);
  };

  // Expand the collapsed sidebar timeline (shows 4 entries max) so the oldest
  // "Created Project" entry is rendered even on busy projects. Wait for the
  // entry list to render first — on slow CI the "Show N more" button is not yet
  // in the DOM right after the heading appears, so an immediate isVisible check
  // is racy and skips the click.
  const expandTimeline = async (page: import("@playwright/test").Page) => {
    await expect(page.getByTestId("timeline-entry").first()).toBeVisible({
      timeout: 10000,
    });

    const showMoreButton = page.getByRole("button", { name: /Show \d+ more/ });
    if (await showMoreButton.isVisible().catch(() => false)) {
      await showMoreButton.click();
    }
  };

  test("should display the timeline section with entries on the project page", async ({
    page,
  }) => {
    await navigateToProject(page);

    // The Timeline heading should be visible as a section on the project page
    await expect(page.getByRole("heading", { name: "Timeline" })).toBeVisible({
      timeout: 10000,
    });

    await expandTimeline(page);

    // The auto-generated "Created Project" entry should be present
    await expect(
      page.getByText(`Created Project "${TEST_WORKSPACE.PROJECT_NAME}"`),
    ).toBeVisible({ timeout: 10000 });
  });

  test("should toggle timeline entry visibility with the eye icon", async ({
    page,
  }) => {
    await navigateToProject(page);

    // Wait for the timeline section to load
    await expect(page.getByRole("heading", { name: "Timeline" })).toBeVisible({
      timeout: 10000,
    });

    await expandTimeline(page);

    // Scope all assertions to the "Created Project" entry card — other entries
    // have their own visibility toggles with identical accessible names.
    const entryCard = page
      .getByTestId("timeline-entry")
      .filter({ hasText: `Created Project "${TEST_WORKSPACE.PROJECT_NAME}"` });
    await expect(entryCard).toBeVisible({ timeout: 10000 });

    // Entry starts as private, so button says "Make public"
    const makePublicButton = entryCard.getByRole("button", {
      name: "Make public",
    });
    await expect(makePublicButton).toBeVisible({ timeout: 5000 });

    // Click to toggle visibility to public
    await makePublicButton.click();

    // After toggling, it should now show "Make private"
    const makePrivateButton = entryCard.getByRole("button", {
      name: "Make private",
    });
    await expect(makePrivateButton).toBeVisible({ timeout: 5000 });

    // Toggle back to private
    await makePrivateButton.click();

    // Should be back to "Make public"
    await expect(
      entryCard.getByRole("button", { name: "Make public" }),
    ).toBeVisible({ timeout: 5000 });
  });
});
