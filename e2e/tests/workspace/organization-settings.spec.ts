import { expect, test } from "@playwright/test";

import { appPaths } from "@wildfires-org/turboplan-utils/app-paths";
import {
  getOrganizationById,
  updateOrganization,
} from "@wildfires-org/turboplan-workspace/server";

import { ORG_URL_PATTERN } from "../../config/patterns";
import { WorkspaceOrgSettings } from "../../pages/workspace-org-settings";
import { createTestOrganization, getGovWorkspace } from "../../utils";

/**
 * Saving the Manage Organization dialog's General and Branding fields. The
 * dialog's tabs and unsaved-state behaviour are covered by
 * organizations/edit-organization-dialog.spec.ts; this spec checks that what
 * is saved is stored and shown again after a reload.
 *
 * Runs as the government user; each test gets a fresh BUSINESS organization it
 * owns, so a rename never touches the shared gov/citizen organizations.
 */
test.use({ storageState: "./storage/auth/gov.json" });

const shortId = (): string => Math.random().toString(36).substring(2, 8);

test.describe("Organization settings", () => {
  // Several page loads per test against the remote test database.
  test.describe.configure({ timeout: 60000 });

  let ownerId: string;

  test.beforeAll(async () => {
    const gov = await getGovWorkspace();
    ownerId = gov.userId;
  });

  const seedOrganization = (label: string) => {
    return createTestOrganization({
      ownerId,
      name: `${label} ${shortId()}`,
    });
  };

  test("renames the organization and updates its short name and description", async ({
    page,
  }) => {
    const org = await seedOrganization("Rename Org E2E");
    const settings = new WorkspaceOrgSettings(page);
    const newName = `Renamed Org E2E ${shortId()}`;
    const shortName = `RO${shortId().toUpperCase()}`;
    const description = `Coordinates regional planning ${shortId()}.`;

    await settings.openFromOrg(org.slug);
    await expect(settings.nameInput).toHaveValue(org.name);

    await settings.nameInput.fill(newName);
    await settings.shortNameInput.fill(shortName);
    await settings.descriptionInput.fill(description);
    await settings.save();

    const saved = await getOrganizationById(org.id);
    expect(saved?.name).toBe(newName);
    expect(saved?.shortName).toBe(shortName);
    expect(saved?.description).toBe(description);
    expect(saved?.slug).not.toBe(org.slug);

    // A rename changes the slug, and the dialog moves the page to it.
    await expect(page).toHaveURL(appPaths.organization(saved!.slug), {
      timeout: 10000,
    });

    await page.reload();
    await expect(
      page.getByRole("heading", { name: newName, level: 1 }),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole("main").getByText(description).first(),
    ).toBeVisible();

    await settings.openFromOrg(saved!.slug);
    await expect(settings.nameInput).toHaveValue(newName);
    await expect(settings.shortNameInput).toHaveValue(shortName);
    await expect(settings.descriptionInput).toHaveValue(description);
  });

  test("the old organization URL redirects to the renamed one", async ({
    page,
  }) => {
    const org = await seedOrganization("Old Slug Org E2E");
    const settings = new WorkspaceOrgSettings(page);

    await settings.openFromOrg(org.slug);
    await settings.nameInput.fill(`New Slug Org E2E ${shortId()}`);
    await settings.save();

    const saved = await getOrganizationById(org.id);
    expect(saved?.slug).not.toBe(org.slug);
    await expect(page).toHaveURL(appPaths.organization(saved!.slug), {
      timeout: 10000,
    });

    await page.goto(appPaths.organization(org.slug));
    await expect(page).toHaveURL(appPaths.organization(saved!.slug), {
      timeout: 10000,
    });
    await page.waitForURL(ORG_URL_PATTERN);
    await expect(
      page.getByRole("heading", { name: saved!.name, level: 1 }),
    ).toBeVisible({ timeout: 10000 });
  });

  test("saves the Branding footer tagline", async ({ page }) => {
    const org = await seedOrganization("Branding Org E2E");
    const settings = new WorkspaceOrgSettings(page);
    const tagline = `Serving the district since ${shortId()}`;

    await settings.openFromOrg(org.slug);
    await settings.settings.switchTo("Branding");
    await settings.footerTaglineInput.fill(tagline);
    await settings.save();

    const saved = await getOrganizationById(org.id);
    expect(saved?.documentFooterText).toBe(tagline);
    // Name unchanged, so the slug (and URL) stay put.
    expect(saved?.slug).toBe(org.slug);

    await page.reload();
    await settings.openFromOrg(org.slug);
    await settings.settings.switchTo("Branding");
    await expect(settings.footerTaglineInput).toHaveValue(tagline);
  });

  test("Cancel discards unsaved edits", async ({ page }) => {
    const org = await seedOrganization("Cancel Org E2E");
    const settings = new WorkspaceOrgSettings(page);

    await settings.openFromOrg(org.slug);
    await settings.nameInput.fill(`Discarded ${shortId()}`);
    await settings.descriptionInput.fill("Discarded description");
    await settings.cancel();

    const stored = await getOrganizationById(org.id);
    expect(stored?.name).toBe(org.name);
    expect(stored?.slug).toBe(org.slug);
    expect(stored?.description).toBe("Organization for E2E testing");

    // The dialog mounts fresh on every open, seeded from the saved values.
    await settings.openFromOrg(org.slug);
    await expect(settings.nameInput).toHaveValue(org.name);
    await expect(settings.descriptionInput).toHaveValue(
      "Organization for E2E testing",
    );
  });

  test("rejects an empty organization name and saves nothing", async ({
    page,
  }) => {
    const org = await seedOrganization("Required Name Org E2E");
    const settings = new WorkspaceOrgSettings(page);

    await settings.openFromOrg(org.slug);
    await settings.nameInput.fill("");
    await settings.settings.saveChangesButton.click();

    await expect(
      settings.settings.dialog.getByText("Name is required"),
    ).toBeVisible();
    await expect(settings.settings.title).toBeVisible();

    const stored = await getOrganizationById(org.id);
    expect(stored?.name).toBe(org.name);
  });

  test("clearing the short name removes it", async ({ page }) => {
    const org = await seedOrganization("Clear Short Name Org E2E");
    const shortName = `CS${shortId().toUpperCase()}`;
    await updateOrganization({ id: org.id, shortName });
    const settings = new WorkspaceOrgSettings(page);

    await settings.openFromOrg(org.slug);
    await expect(settings.shortNameInput).toHaveValue(shortName);
    await settings.shortNameInput.fill("");
    await settings.save();

    expect((await getOrganizationById(org.id))?.shortName ?? "").toBe("");
    await page.reload();
    await settings.openFromOrg(org.slug);
    await expect(settings.shortNameInput).toHaveValue("");
  });
});
