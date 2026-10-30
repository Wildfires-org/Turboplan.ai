import { expect, type Locator, type Page } from "@playwright/test";

import { TurboplanOrgSettingsDialog } from "./turboplan-org-settings-dialog";

/**
 * The General-tab fields of the Manage Organization dialog and its save
 * flow, on top of the shared TurboplanOrgSettingsDialog (which has the tab
 * rail, the Name input and the Branding footer tagline).
 */
export class WorkspaceOrgSettings {
  readonly settings: TurboplanOrgSettingsDialog;

  constructor(private readonly page: Page) {
    this.settings = new TurboplanOrgSettingsDialog(page);
  }

  async openFromOrg(orgSlug: string): Promise<void> {
    await this.settings.openFromOrg(orgSlug);
  }

  get nameInput(): Locator {
    return this.settings.nameInput;
  }

  get shortNameInput(): Locator {
    return this.settings.dialog.locator("#shortName");
  }

  get descriptionInput(): Locator {
    return this.settings.dialog.locator("#description");
  }

  get footerTaglineInput(): Locator {
    return this.settings.footerTaglineInput;
  }

  /**
   * Save the General/Branding form and wait until the dialog has closed. The
   * save makes several round trips to the remote test database, so it gets a
   * generous wait.
   */
  async save(): Promise<void> {
    await this.settings.saveChangesButton.click();
    await expect(
      this.page.getByText("Organization updated successfully!"),
    ).toBeVisible({ timeout: 20000 });
    await expect(this.settings.title).toBeHidden();
  }

  async cancel(): Promise<void> {
    await this.settings.cancelButton.click();
    await expect(this.settings.title).toBeHidden();
  }
}
