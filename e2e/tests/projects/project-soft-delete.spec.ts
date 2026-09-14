import { expect, test } from "@playwright/test";

import { getUserByEmail } from "@wildfires-org/turboplan-db/queries";

import { OFFICE_URL_PATTERN, PROJECT_URL_PATTERN } from "../../config/patterns";
import { getCitizenCredentials } from "../../config/test-credentials";
import { TEST_WORKSPACE } from "../../config/test-data";
import {
  getTestOffice,
  getTestUserOrganization,
  mockGenerateTitles,
} from "../../utils";

function shortId(): string {
  return Math.random().toString(36).substring(2, 8);
}

test.describe("Project Soft Delete", () => {
  let citizenOrgSlug: string;
  let citizenOfficeSlug: string;

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
  });

  test("should soft-delete a project from projects list and hide it", async ({
    page,
  }) => {
    const projectName = `Soft Delete ${shortId()}`;

    // Navigate directly to the citizen's office (citizen may have access to
    // multiple orgs, so "/" redirect is not deterministic).
    await page.goto(
      `/organizations/${citizenOrgSlug}/offices/${citizenOfficeSlug}`,
    );
    await page.waitForURL(OFFICE_URL_PATTERN, { timeout: 10000 });

    // Create a dedicated project for this test.
    await page
      .getByRole("button", { name: /^New Project$/ })
      .first()
      .click();
    await page.getByLabel("Project Prompt").fill(TEST_WORKSPACE.PROJECT_PROMPT);
    const unmockGenerateTitles = await mockGenerateTitles(page, projectName);
    await page.getByRole("button", { name: /Create Project/i }).click();

    // Capture direct project URL to verify it becomes inaccessible.
    await page.waitForURL(PROJECT_URL_PATTERN, { timeout: 10000 });
    await unmockGenerateTitles();
    const projectUrl = page.url();

    // Go back to office projects list.
    await page.goto(
      `/organizations/${citizenOrgSlug}/offices/${citizenOfficeSlug}`,
    );
    await page.waitForURL(OFFICE_URL_PATTERN, { timeout: 10000 });

    const main = page.getByRole("main");

    // Citizen projects default to draft status — switch filter to show all
    await main.getByRole("button", { name: /Status:/i }).click();
    await page.getByRole("menuitem", { name: "All" }).click();

    const projectLink = main.getByRole("link", { name: projectName });
    await expect(projectLink).toBeVisible({ timeout: 15000 });

    // Open card actions dropdown and trigger Delete Project.
    const card = projectLink
      .locator("xpath=ancestor::div[contains(@class, 'relative')]")
      .first();
    await card.getByRole("button", { name: /actions/i }).click();
    await expect(page.getByRole("menu")).toBeVisible();
    await page.getByRole("menuitem", { name: "Delete Project" }).click();

    // Confirm deletion.
    await expect(
      page.getByRole("heading", { name: "Delete Project" }),
    ).toBeVisible();
    await page.getByRole("button", { name: /^Delete$/ }).click();

    await expect(page.getByText("Project deleted successfully!")).toBeVisible();
    await expect(projectLink).toHaveCount(0);

    // Soft-deleted project should no longer be reachable.
    await page.goto(projectUrl);
    await expect(
      page.getByRole("heading", { name: "Access Restricted" }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "There is no such project, or you don't have access to it.",
      ),
    ).toBeVisible();
  });
});
