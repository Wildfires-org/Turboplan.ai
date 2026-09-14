import { expect, test } from "@playwright/test";

import { TurboplanOrgSettingsDialog } from "../../pages";
import { getGovWorkspace } from "../../utils";

/**
 * Manage Organization dialog (EditOrganizationDialog).
 *
 * Runs as the government user, who OWNS the GOVERNMENT-type organization created
 * in auth-gov.setup.ts. Ownership grants MANAGE_MEMBERS, which is required for
 * the "Manage Organization" action and for the editable Email Domains pane.
 *
 * Coverage:
 *  - Tab switching shows the matching pane.
 *  - The shared Cancel / "Save Changes" footer appears only on the form tabs
 *    (General + Branding), never on Email Domains or Document Signing.
 *  - The feature-flagged Document Signing tab matches the build's flag state.
 *  - General/Branding/Domains panes stay mounted on tab switch, so unsaved
 *    field edits survive a round-trip.
 *  - Escape in the Email Domains inline input closes only the input, not the
 *    whole dialog (Spec 2).
 */
test.use({ storageState: "./storage/auth/gov.json" });

test.describe("Manage Organization dialog", () => {
  let orgSlug: string;

  test.beforeAll(async () => {
    const gov = await getGovWorkspace();
    orgSlug = gov.orgSlug;
  });

  test("switches between tabs and shows the matching pane", async ({
    page,
  }) => {
    const settings = new TurboplanOrgSettingsDialog(page);
    await settings.openFromOrg(orgSlug);

    // General is the default active tab.
    await expect(settings.nameInput).toBeVisible();
    await expect(settings.footerTaglineInput).toBeHidden();
    await expect(settings.addDomainButton).toBeHidden();

    // Branding
    await settings.switchTo("Branding");
    await expect(settings.footerTaglineInput).toBeVisible();
    await expect(settings.nameInput).toBeHidden();

    // Email Domains (owner sees the editable add-domain UI).
    await settings.switchTo("Email Domains");
    await expect(settings.addDomainButton).toBeVisible({ timeout: 10000 });
    await expect(settings.nameInput).toBeHidden();
    await expect(settings.footerTaglineInput).toBeHidden();
  });

  test("shows the shared footer only on the form tabs", async ({ page }) => {
    const settings = new TurboplanOrgSettingsDialog(page);
    await settings.openFromOrg(orgSlug);

    // General → footer present.
    await expect(settings.saveChangesButton).toBeVisible();
    await expect(settings.cancelButton).toBeVisible();

    // Branding → footer still present (shares the General form).
    await settings.switchTo("Branding");
    await expect(settings.saveChangesButton).toBeVisible();
    await expect(settings.cancelButton).toBeVisible();

    // Email Domains → no shared footer (the pane has its own dedicated Save).
    await settings.switchTo("Email Domains");
    await expect(settings.saveChangesButton).toBeHidden();
    await expect(settings.cancelButton).toBeHidden();
  });

  test("renders the Document Signing tab according to the feature flag", async ({
    page,
  }) => {
    const settings = new TurboplanOrgSettingsDialog(page);
    await settings.openFromOrg(orgSlug);

    // The three base tabs always render, regardless of the flag.
    await expect(settings.tab("General")).toBeVisible();
    await expect(settings.tab("Branding")).toBeVisible();
    await expect(settings.tab("Email Domains")).toBeVisible();

    // Document Signing is gated by isSigningPackageEnabled(), whose value is
    // inlined into the client bundle at BUILD time from
    // NEXT_PUBLIC_IS_SIGNING_PACKAGE_ENABLED. The e2e test process (loaded from
    // e2e/.env) can't reliably observe that build-time value, so rather than
    // guess we read the tab's actual presence from the live build and assert
    // the flag-controlled contract: the tab exists iff signing is enabled, and
    // when it exists it opens a footer-less pane that is NOT the shared form.
    const signingTab = settings.tab("Document Signing");
    const signingEnabled = await signingTab.isVisible();

    if (signingEnabled) {
      await signingTab.click();
      await expect(settings.signingPane).toBeVisible();
      // No shared footer on the signing tab, and the General form is hidden.
      await expect(settings.saveChangesButton).toBeHidden();
      await expect(settings.nameInput).toBeHidden();
    } else {
      await expect(signingTab).toHaveCount(0);
      await expect(settings.signingPane).toHaveCount(0);
    }
  });

  test("preserves General and Branding edits across tab switches", async ({
    page,
  }) => {
    const settings = new TurboplanOrgSettingsDialog(page);
    await settings.openFromOrg(orgSlug);

    // Edit the General Name field (do NOT save — this is a mounted-state check).
    const newName = `Preserved Name ${Date.now()}`;
    await settings.nameInput.fill(newName);

    // Edit a Branding field too.
    await settings.switchTo("Branding");
    const newTagline = `Preserved Tagline ${Date.now()}`;
    await settings.footerTaglineInput.fill(newTagline);

    // Round-trip through Email Domains and back — panes stay mounted (hidden),
    // so both edited values must survive.
    await settings.switchTo("Email Domains");
    await settings.switchTo("General");
    await expect(settings.nameInput).toHaveValue(newName);

    await settings.switchTo("Branding");
    await expect(settings.footerTaglineInput).toHaveValue(newTagline);
  });

  // ── Spec 2: Escape override in the Email Domains inline input ────────
  test("Escape closes the inline add-domain input before the dialog", async ({
    page,
  }) => {
    const settings = new TurboplanOrgSettingsDialog(page);
    await settings.openFromOrg(orgSlug);
    await settings.switchTo("Email Domains");

    // Activate the inline add-domain input (autofocuses).
    await settings.addDomainButton.click();
    await expect(settings.domainInput).toBeVisible();
    await expect(settings.domainInput).toBeFocused();

    // First Escape: closes ONLY the inline input; the dialog stays open.
    await page.keyboard.press("Escape");
    await expect(settings.domainInput).toBeHidden();
    await expect(settings.addDomainButton).toBeVisible();
    await expect(settings.title).toBeVisible();

    // Second Escape: with the input closed, the dialog itself dismisses.
    await page.keyboard.press("Escape");
    await expect(settings.title).toBeHidden();
  });
});
