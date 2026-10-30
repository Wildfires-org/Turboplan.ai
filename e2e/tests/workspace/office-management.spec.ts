import { expect, test } from "@playwright/test";

import { appPaths } from "@wildfires-org/turboplan-utils/app-paths";
import {
  createOffice,
  getOfficeById,
  getOfficesByOrganization,
} from "@wildfires-org/turboplan-workspace/server";

import { OFFICE_URL_PATTERN } from "../../config/patterns";
import {
  WorkspaceOfficeDetailsForm,
  WorkspaceOfficesPage,
} from "../../pages/workspace-offices";
import {
  createTestOrganization,
  getGovWorkspace,
  type TestOrganization,
} from "../../utils";

/**
 * Office management from the organization and office pages: create, rename
 * and describe, cancel, validation, archive and reactivate. The UI offers no
 * way to delete an office (only archive), so delete is not covered.
 *
 * Runs as the government user on a fresh BUSINESS organization it owns, so
 * the offices it creates never become the "newest office" that other specs
 * resolve from the shared gov/citizen workspaces.
 */
test.use({ storageState: "./storage/auth/gov.json" });

const shortId = (): string => Math.random().toString(36).substring(2, 8);

test.describe("Office management", () => {
  // Several page loads per test against the remote test database.
  test.describe.configure({ timeout: 60000 });

  let userId: string;
  let org: TestOrganization;

  test.beforeAll(async () => {
    const gov = await getGovWorkspace();
    userId = gov.userId;
    org = await createTestOrganization({
      ownerId: userId,
      name: `Office Mgmt E2E ${shortId()}`,
    });
  });

  const seedOffice = async (label: string) => {
    return createOffice({
      name: `${label} ${shortId()}`,
      description: `Seeded description ${shortId()}`,
      organizationId: org.id,
      createdBy: userId,
    });
  };

  test("creates an office from the organization page", async ({ page }) => {
    const offices = new WorkspaceOfficesPage(page);
    const name = `Created Office ${shortId()}`;

    await offices.gotoOrganization(org.slug);
    await offices.createOffice(name);

    // The new office is stored in this organization, active.
    const stored = (await getOfficesByOrganization(org.id)).find(
      (office) => office.name === name,
    );
    expect(stored).toBeDefined();
    expect(stored?.status).toBe("active");
    expect(stored?.createdBy).toBe(userId);
    await expect(page).toHaveURL(appPaths.office(org.slug, stored!.slug));

    // A fresh load of the office page and of the organization grid shows it.
    await page.reload();
    await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible({
      timeout: 10000,
    });

    await offices.gotoOrganization(org.slug);
    await expect(offices.officeCard(name)).toBeVisible();
  });

  test("renames an office and edits its description from Manage Office", async ({
    page,
  }) => {
    const office = await seedOffice("Rename Office");
    const form = new WorkspaceOfficeDetailsForm(page);
    const newName = `Renamed Office ${shortId()}`;
    const newDescription = `Handles permits for district ${shortId()}.`;

    await form.settings.openFromOffice(org.slug, office.slug);
    await expect(form.nameInput).toHaveValue(office.name);
    await expect(form.descriptionInput).toHaveValue(office.description ?? "");

    await form.nameInput.fill(newName);
    await form.descriptionInput.fill(newDescription);
    await form.settings.save();

    // A rename changes the slug, and the dialog moves the page to it.
    const saved = await getOfficeById(office.id);
    expect(saved?.name).toBe(newName);
    expect(saved?.description).toBe(newDescription);
    expect(saved?.slug).not.toBe(office.slug);
    await expect(page).toHaveURL(appPaths.office(org.slug, saved!.slug), {
      timeout: 10000,
    });

    // After a reload the banner and the reopened dialog show the saved values.
    await page.reload();
    await expect(
      page.getByRole("heading", { name: newName, level: 1 }),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole("main").getByText(newDescription).first(),
    ).toBeVisible();

    await form.settings.openFromOffice(org.slug, saved!.slug);
    await expect(form.nameInput).toHaveValue(newName);
    await expect(form.descriptionInput).toHaveValue(newDescription);
  });

  test("Cancel discards unsaved office edits", async ({ page }) => {
    const office = await seedOffice("Cancel Office");
    const form = new WorkspaceOfficeDetailsForm(page);

    await form.settings.openFromOffice(org.slug, office.slug);
    await form.nameInput.fill(`Discarded ${shortId()}`);
    await form.descriptionInput.fill("Discarded description");
    await form.cancelButton.click();
    await expect(form.dialog).toBeHidden();

    const stored = await getOfficeById(office.id);
    expect(stored?.name).toBe(office.name);
    expect(stored?.description).toBe(office.description);

    // A fresh page load still shows the original values.
    await form.settings.openFromOffice(org.slug, office.slug);
    await expect(form.nameInput).toHaveValue(office.name);
    await expect(form.descriptionInput).toHaveValue(office.description ?? "");
  });

  test("rejects an empty office name and saves nothing", async ({ page }) => {
    const office = await seedOffice("Required Name Office");
    const form = new WorkspaceOfficeDetailsForm(page);

    await form.settings.openFromOffice(org.slug, office.slug);
    await form.nameInput.fill("");
    await form.descriptionInput.fill("Should not be saved");
    await form.saveButton.click();

    await expect(form.dialog.getByText("Name is required")).toBeVisible();
    await expect(form.dialog).toBeVisible();

    const stored = await getOfficeById(office.id);
    expect(stored?.name).toBe(office.name);
    expect(stored?.description).toBe(office.description);

    await page.reload();
    await page.waitForURL(OFFICE_URL_PATTERN);
    await expect(
      page.getByRole("heading", { name: office.name, level: 1 }),
    ).toBeVisible({ timeout: 10000 });
  });

  test("archives an office and reactivates it from its card menu", async ({
    page,
  }) => {
    const office = await seedOffice("Archive Office");
    const offices = new WorkspaceOfficesPage(page);

    await offices.gotoOrganization(org.slug);
    await expect(offices.officeCard(office.name)).toBeVisible();

    await offices.chooseOfficeAction(office.name, "Archive Office");
    await expect(page.getByText("Office archived successfully")).toBeVisible({
      timeout: 10000,
    });
    await expect
      .poll(async () => (await getOfficeById(office.id))?.status)
      .toBe("archived");

    // The grid defaults to active offices, so after a reload the archived one
    // is only listed under the Archived filter.
    await page.reload();
    await expect(offices.statusFilter).toContainText("Active", {
      timeout: 15000,
    });
    await expect(offices.officeCard(office.name)).toHaveCount(0);

    await offices.filterByStatus("Archived");
    const archivedCard = offices.officeCard(office.name);
    await expect(archivedCard).toBeVisible();
    await expect(
      archivedCard.getByText("Archived", { exact: true }),
    ).toBeVisible();

    await offices.chooseOfficeAction(office.name, "Activate Office");
    await expect(page.getByText("Office activated successfully")).toBeVisible({
      timeout: 10000,
    });
    await expect
      .poll(async () => (await getOfficeById(office.id))?.status)
      .toBe("active");

    await page.reload();
    await expect(offices.statusFilter).toContainText("Active", {
      timeout: 15000,
    });
    await expect(offices.officeCard(office.name)).toBeVisible();
  });
});
