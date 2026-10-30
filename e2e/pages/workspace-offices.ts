import { expect, type Locator, type Page } from "@playwright/test";

import { appPaths } from "@wildfires-org/turboplan-utils/app-paths";

import { OFFICE_URL_PATTERN, ORG_URL_PATTERN } from "../config/patterns";
import { TurboplanOfficeSettingsDialog } from "./turboplan-office-settings-dialog";

export type OfficeStatusFilterLabel = "Active" | "All" | "Archived";

/**
 * Page Object Model for an organization's Offices tab (the office card grid,
 * its status filter, the per-card actions menu and the "Create New Office"
 * dialog), plus the name/description fields of the Manage Office dialog.
 */
export class WorkspaceOfficesPage {
  constructor(public readonly page: Page) {}

  get main(): Locator {
    return this.page.getByRole("main");
  }

  /** Open the organization page and wait until the office grid is in. */
  async gotoOrganization(orgSlug: string): Promise<void> {
    await this.page.goto(appPaths.organization(orgSlug));
    await this.page.waitForURL(ORG_URL_PATTERN);
    await expect(this.statusFilter).toBeVisible({ timeout: 15000 });
  }

  // ── Create office ────────────────────────────────────────────────

  /**
   * StickyEntityBanner renders its actions twice (full banner + compact scroll
   * header); scope to the full banner's testid.
   */
  get newOfficeButton(): Locator {
    return this.page
      .getByTestId("entity-banner-actions")
      .getByRole("button", { name: "New Office" });
  }

  get createOfficeDialog(): Locator {
    return this.page.getByRole("dialog", { name: "Create New Office" });
  }

  get createOfficeNameInput(): Locator {
    return this.createOfficeDialog.getByPlaceholder("Office name");
  }

  /** Create an office from the banner and wait for the redirect to it. */
  async createOffice(name: string): Promise<void> {
    await this.newOfficeButton.click();
    await expect(this.createOfficeDialog).toBeVisible();
    await this.createOfficeNameInput.fill(name);
    await this.createOfficeDialog
      .getByRole("button", { name: "Create New Office" })
      .click();
    await expect(
      this.page.getByText("Office created successfully"),
    ).toBeVisible({ timeout: 10000 });
    await this.page.waitForURL(OFFICE_URL_PATTERN, { timeout: 15000 });
  }

  // ── Office grid ──────────────────────────────────────────────────

  /** An office card (the card is one link), by the office's exact name. */
  officeCard(name: string): Locator {
    return this.main
      .getByRole("link")
      .filter({ has: this.page.getByText(name, { exact: true }) });
  }

  /** The "⋮" trigger on an office card (only for users with UPDATE). */
  officeActionsButton(name: string): Locator {
    return this.main.getByRole("button", {
      name: `Actions for ${name}`,
      exact: true,
    });
  }

  async openOfficeActions(name: string): Promise<void> {
    await this.officeActionsButton(name).click();
    await expect(this.page.getByRole("menu")).toBeVisible();
  }

  async chooseOfficeAction(
    name: string,
    action: "Edit Office" | "Archive Office" | "Activate Office",
  ): Promise<void> {
    await this.openOfficeActions(name);
    await this.page.getByRole("menuitem", { name: action }).click();
  }

  get statusFilter(): Locator {
    return this.main.getByRole("button", { name: /^Status:/ });
  }

  async filterByStatus(label: OfficeStatusFilterLabel): Promise<void> {
    await this.statusFilter.click();
    await this.page.getByRole("menuitem", { name: label, exact: true }).click();
    await expect(this.statusFilter).toContainText(label);
  }
}

/**
 * The General fields (name, description) of the Manage Office dialog, which
 * the shared TurboplanOfficeSettingsDialog page object leaves out.
 */
export class WorkspaceOfficeDetailsForm {
  readonly settings: TurboplanOfficeSettingsDialog;

  constructor(page: Page) {
    this.settings = new TurboplanOfficeSettingsDialog(page);
  }

  get dialog(): Locator {
    return this.settings.dialog;
  }

  get nameInput(): Locator {
    return this.dialog.getByRole("textbox", { name: /^Name/ });
  }

  get descriptionInput(): Locator {
    return this.dialog.getByRole("textbox", {
      name: "Description",
      exact: true,
    });
  }

  get saveButton(): Locator {
    return this.dialog.getByRole("button", { name: "Save Changes" });
  }

  get cancelButton(): Locator {
    return this.dialog.getByRole("button", { name: "Cancel" });
  }
}
