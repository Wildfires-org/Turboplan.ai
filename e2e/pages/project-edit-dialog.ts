import { expect, type Locator, type Page } from "@playwright/test";

export type ProjectStatusLabel = "Active" | "Completed" | "Archived";

export type ProjectEditValues = {
  name?: string;
  description?: string;
  /** `YYYY-MM-DD` */
  startDate?: string;
  /** `YYYY-MM-DD` */
  endDate?: string;
  status?: ProjectStatusLabel;
};

/**
 * Page Object for the "Edit project" dialog, opened from the project header's
 * "Project actions" menu.
 */
export class ProjectEditDialog {
  constructor(private readonly page: Page) {}

  get dialog(): Locator {
    return this.page.getByRole("alertdialog", { name: "Edit Project" });
  }

  get nameInput(): Locator {
    return this.dialog.getByRole("textbox", { name: /^Name/ });
  }

  get descriptionInput(): Locator {
    return this.dialog.getByRole("textbox", { name: "Description" });
  }

  get startDateInput(): Locator {
    return this.dialog.getByLabel(/^Start Date/);
  }

  get endDateInput(): Locator {
    return this.dialog.getByLabel(/^End Date/);
  }

  /** The status Select has no label wired to its trigger; it is the only combobox. */
  get statusSelect(): Locator {
    return this.dialog.getByRole("combobox");
  }

  async open(): Promise<void> {
    await this.page
      .getByRole("main")
      .getByRole("button", { name: "Project actions" })
      .click();
    await this.page.getByRole("menuitem", { name: "Edit project" }).click();
    await expect(this.dialog).toBeVisible();
  }

  async fill(values: ProjectEditValues): Promise<void> {
    if (values.name !== undefined) {
      await this.nameInput.fill(values.name);
    }
    if (values.description !== undefined) {
      await this.descriptionInput.fill(values.description);
    }
    if (values.startDate !== undefined) {
      await this.startDateInput.fill(values.startDate);
    }
    if (values.endDate !== undefined) {
      await this.endDateInput.fill(values.endDate);
    }
    if (values.status !== undefined) {
      await this.statusSelect.click();
      await this.page
        .getByRole("option", { name: values.status, exact: true })
        .click();
      await expect(this.statusSelect).toHaveText(values.status);
    }
  }

  /** Save and wait for the PUT to succeed and the dialog to close. */
  async save(): Promise<void> {
    const updateResponse = this.page.waitForResponse(
      (resp) =>
        /\/api\/projects\/[^/]+$/.test(new URL(resp.url()).pathname) &&
        resp.request().method() === "PUT",
    );
    await this.dialog.getByRole("button", { name: "Save Changes" }).click();
    expect((await updateResponse).ok()).toBeTruthy();
    await expect(
      this.page.getByText("Project updated successfully!"),
    ).toBeVisible();
    await expect(this.dialog).toBeHidden();
  }
}
