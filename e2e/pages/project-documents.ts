import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Page Object for a project's Documents page (`/:org/:office/:project/documents`).
 */
export class ProjectDocumentsPage {
  constructor(private readonly page: Page) {}

  get main(): Locator {
    return this.page.getByRole("main");
  }

  async goto(projectPath: string): Promise<void> {
    await this.page.goto(`${projectPath}/documents`);
    await expect(
      this.main.getByRole("heading", { name: "Documents", level: 2 }),
    ).toBeVisible({ timeout: 15000 });
  }

  /** Document cards are clickable (role "button") and named by their text. */
  document(fileName: string): Locator {
    return this.main.getByRole("button", { name: fileName });
  }

  /** Upload through the header's "Upload" button (a hidden file input). */
  async upload(filePath: string): Promise<void> {
    const fileChooser = this.page.waitForEvent("filechooser");
    await this.main
      .getByRole("button", { name: "Upload", exact: true })
      .click();
    await (await fileChooser).setFiles(filePath);
    await expect(
      this.page.getByText("Document uploaded successfully"),
    ).toBeVisible({ timeout: 30000 });
  }

  /** The card's icon-only "..." trigger has no accessible name. */
  private async openActions(fileName: string): Promise<void> {
    await this.document(fileName)
      .locator('button[aria-haspopup="menu"]')
      .click();
  }

  /** Rename keeps the extension, which the dialog shows outside the input. */
  async rename(fileName: string, newBasename: string): Promise<void> {
    await this.openActions(fileName);
    await this.page.getByRole("menuitem", { name: "Rename" }).click();

    const dialog = this.page.getByRole("dialog", { name: "Rename Document" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("textbox", { name: "Name" }).fill(newBasename);
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toBeHidden();
  }

  async delete(fileName: string): Promise<void> {
    await this.openActions(fileName);
    await this.page.getByRole("menuitem", { name: "Delete" }).click();

    const confirm = this.page.getByRole("alertdialog", {
      name: "Delete Document",
    });
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "Delete" }).click();
    await expect(
      this.page.getByText("Document deleted successfully"),
    ).toBeVisible();
    await expect(confirm).toBeHidden();
  }
}
