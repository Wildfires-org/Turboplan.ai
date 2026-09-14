import { expect, type Locator, type Page } from "@playwright/test";

import { ORG_URL_PATTERN } from "../config/patterns";

/** Tab labels rendered in the Manage Organization dialog's left rail. */
export type OrgSettingsTabLabel =
  | "General"
  | "Branding"
  | "Email Domains"
  | "Document Signing";

/**
 * Page Object Model for the "Manage Organization" settings dialog
 * (EditOrganizationDialog). Provides scoped locators for its tab rail, panes,
 * shared footer, and the Email Domains inline add-domain input.
 *
 * All locators are scoped to the open dialog so they never collide with the
 * underlying organization page (which also has a Name field, buttons, etc.).
 */
export class TurboplanOrgSettingsDialog {
  readonly dialog: Locator;

  constructor(private readonly page: Page) {
    this.dialog = page.getByRole("dialog");
  }

  /**
   * Navigate to an organization page and open the Manage Organization dialog.
   * Requires a user who is a member of the organization (the "Manage
   * Organization" action is member-only).
   */
  async openFromOrg(orgSlug: string): Promise<void> {
    await this.page.goto(`/organizations/${orgSlug}`);
    await this.page.waitForURL(ORG_URL_PATTERN);
    // StickyEntityBanner renders the banner actions twice (full banner +
    // compact scroll header). The duplicate is inert, but Playwright's role
    // engine ignores inert, so scope to the full banner's testid instead.
    await this.page
      .getByTestId("entity-banner-actions")
      .getByRole("button", { name: "Manage Organization" })
      .click();
    await expect(this.title).toBeVisible({ timeout: 10000 });
  }

  /** The dialog title heading (also a reliable "dialog is open" signal). */
  get title(): Locator {
    return this.dialog.getByRole("heading", { name: "Manage Organization" });
  }

  /** A tab button in the left rail. */
  tab(label: OrgSettingsTabLabel): Locator {
    return this.dialog.getByRole("button", { name: label, exact: true });
  }

  async switchTo(label: OrgSettingsTabLabel): Promise<void> {
    await this.tab(label).click();
  }

  // ── Pane content locators ─────────────────────────────────────────

  /** General tab: organization Name input. */
  get nameInput(): Locator {
    return this.dialog.locator("#name");
  }

  /** Branding tab: document footer tagline input. */
  get footerTaglineInput(): Locator {
    return this.dialog.locator("#documentFooterText");
  }

  /** Email Domains tab: the "Add domain" button (owners only). */
  get addDomainButton(): Locator {
    return this.dialog.getByRole("button", { name: "Add domain" });
  }

  /** Email Domains tab: the inline add-domain text input. */
  get domainInput(): Locator {
    return this.dialog.getByPlaceholder("example.com");
  }

  /** Document Signing tab: pane wrapper (present only when the flag is on). */
  get signingPane(): Locator {
    return this.dialog.getByTestId("org-signing-pane");
  }

  // ── Shared footer (General + Branding only) ───────────────────────

  get saveChangesButton(): Locator {
    return this.dialog.getByRole("button", { name: "Save Changes" });
  }

  get cancelButton(): Locator {
    return this.dialog.getByRole("button", { name: "Cancel" });
  }
}
