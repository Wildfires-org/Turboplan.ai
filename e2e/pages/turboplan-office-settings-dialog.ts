import { expect, type Locator, type Page } from "@playwright/test";

import { appPaths } from "@wildfires-org/turboplan-utils/app-paths";

import { OFFICE_URL_PATTERN } from "../config/patterns";
import { LetterheadEditorSection } from "./turboplan-letterhead-editor";

/** Inputs of the "Document details" group (document profile). */
export type DocumentDetailsLabel =
  | "Signatory name"
  | "Signatory title"
  | "Contact person"
  | "Contact email"
  | "Contact phone"
  | "Office hours"
  | "Default file code"
  | "Other facts";

/**
 * Page Object for the "Manage Office" dialog (EditOfficeDialog): document
 * letterhead, document details, footer and the office name/description.
 */
export class TurboplanOfficeSettingsDialog {
  readonly dialog: Locator;
  readonly letterhead: LetterheadEditorSection;

  constructor(private readonly page: Page) {
    this.dialog = page.getByRole("alertdialog", { name: "Edit Office" });
    this.letterhead = new LetterheadEditorSection(this.dialog);
  }

  /**
   * Open an office page and its Manage Office dialog. Requires UPDATE on the
   * office (the button is hidden otherwise).
   */
  async openFromOffice(orgSlug: string, officeSlug: string): Promise<void> {
    await this.page.goto(appPaths.office(orgSlug, officeSlug));
    await this.page.waitForURL(OFFICE_URL_PATTERN);
    // StickyEntityBanner renders its actions twice (full banner + compact
    // scroll header); the testid scopes to the full banner.
    await this.page
      .getByTestId("entity-banner-actions")
      .getByRole("button", { name: "Manage Office" })
      .click();
    await expect(this.dialog).toBeVisible({ timeout: 10000 });
  }

  /** A "Document details" input. */
  documentDetail(label: DocumentDetailsLabel): Locator {
    return this.dialog.getByLabel(label, { exact: true });
  }

  /** Save the form and wait until the dialog has closed. */
  async save(): Promise<void> {
    await this.dialog.getByRole("button", { name: "Save Changes" }).click();
    await expect(
      this.page.getByText("Office updated successfully!"),
    ).toBeVisible({ timeout: 10000 });
    await expect(this.dialog).toBeHidden();
  }
}
