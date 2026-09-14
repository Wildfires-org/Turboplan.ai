import { expect, test } from "@playwright/test";

import { getUserByEmail } from "@wildfires-org/turboplan-db/queries";

import { OFFICE_URL_PATTERN, ORG_URL_PATTERN } from "../../config/patterns";
import { getCitizenCredentials } from "../../config/test-credentials";
import { TurboplanSetupPage } from "../../pages/turboplan-setup";
import { getTestUserOrganization } from "../../utils";

/**
 * Helper to extract office slug from a URL path
 */
function extractOfficeSlug(url: string): string | null {
  const match = url.match(/\/offices\/([^/]+)/);
  return match ? match[1] : null;
}

/**
 * Generate a short unique ID for test names
 */
function shortId(): string {
  return Math.random().toString(36).substring(2, 8);
}

/**
 * Office slug update tests.
 * Creates a dedicated test office to test slug updates without affecting other tests.
 * This approach avoids the need for separate test projects.
 */
test.describe("Office Slug Updates", () => {
  let orgSlug: string;

  test.beforeAll(async () => {
    const citizenCreds = getCitizenCredentials();
    if (!citizenCreds) throw new Error("Citizen credentials not found");
    const citizenUser = await getUserByEmail(citizenCreds.email);
    if (!citizenUser) throw new Error("Citizen user not found");
    const citizenOrg = await getTestUserOrganization(citizenUser.id);
    if (!citizenOrg) throw new Error("Citizen org not found");
    orgSlug = citizenOrg.slug;
  });

  test("should create office, update name, and redirect from old slug", async ({
    page,
  }) => {
    const setupPage = new TurboplanSetupPage(page);

    // Navigate directly to citizen's own org (citizen may have access to
    // multiple orgs, so "/" redirect is not deterministic).
    await page.goto(`/organizations/${orgSlug}`);
    await page.waitForURL(ORG_URL_PATTERN);

    // Step 2: Create a new office specifically for this test
    const testOfficeName = `Slug Test ${shortId()}`;

    // Click "New Office" button
    await page
      .getByRole("button", { name: /New Office/i })
      .first()
      .click();

    const { dialog, officeNameInput } =
      setupPage.getCreateOfficeDialogElements();
    await dialog.waitFor({ state: "visible" });
    await expect(officeNameInput).toBeVisible();
    await officeNameInput.fill(testOfficeName);

    // Submit the form
    await dialog.getByRole("button", { name: /Create (New )?Office/i }).click();

    // Wait for navigation to new office
    await page.waitForURL(OFFICE_URL_PATTERN, { timeout: 10000 });

    const initialOfficeUrl = page.url();
    const initialOfficeSlug = extractOfficeSlug(page.url());
    expect(initialOfficeSlug).toBeTruthy();

    // Step 3: Edit the office name (which changes the slug)
    const newOfficeName = `Updated ${shortId()}`;

    // Click the three-dot menu on the page (we're on the office page now)
    // Navigate back to org page to find the office in the grid
    await page.goto(`/organizations/${orgSlug}`);
    await page.waitForURL(ORG_URL_PATTERN);

    // Find the office card and click its menu
    const officeCard = page.locator("text=" + testOfficeName).first();
    await officeCard.waitFor({ state: "visible", timeout: 5000 });

    // Find the parent card and its menu button
    const card = officeCard
      .locator("xpath=ancestor::div[contains(@class, 'relative')]")
      .first();
    const menuButton = card.locator("button:has(svg)").first();
    await menuButton.click();

    // Click "Edit Office"
    await page.getByText("Edit Office").click();

    // Wait for dialog
    await page
      .getByRole("heading", { name: "Edit Office" })
      .waitFor({ state: "visible" });

    // Update the name
    const nameInput = page.getByLabel("Name");
    await nameInput.clear();
    await nameInput.fill(newOfficeName);

    // Save changes
    await page.getByRole("button", { name: "Save Changes" }).click();

    // Wait for success toast
    await page
      .getByText(/Office updated successfully/i)
      .waitFor({ state: "visible", timeout: 10000 });

    // Wait for dialog to close
    await page
      .getByRole("heading", { name: "Edit Office" })
      .waitFor({ state: "hidden", timeout: 5000 });

    // Step 4: The current implementation redirects directly to the new slug.
    await page.waitForURL(OFFICE_URL_PATTERN, { timeout: 10000 });

    const newOfficeUrl = page.url();
    const newOfficeSlug = extractOfficeSlug(newOfficeUrl);
    expect(newOfficeSlug).toBeTruthy();
    expect(newOfficeSlug).not.toBe(initialOfficeSlug);
    await expect(page.getByText(newOfficeName).first()).toBeVisible();

    // Step 5: Test slug history redirect - navigate to old slug
    await page.goto(initialOfficeUrl);

    // Should redirect to new slug URL
    await expect(page).toHaveURL(newOfficeUrl, { timeout: 10000 });
  });
});
