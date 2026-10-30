import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Page Object for a project's Context page (`/:org/:office/:project/context`):
 * a dropzone for documents and GIS files, the project's GIS layers and its
 * "Notes and references".
 */
export class ProjectContextPage {
  constructor(private readonly page: Page) {}

  get main(): Locator {
    return this.page.getByRole("main");
  }

  async goto(projectPath: string): Promise<void> {
    await this.page.goto(`${projectPath}/context`);
    await expect(
      this.main.getByRole("heading", { name: "Project Context", level: 3 }),
    ).toBeVisible({ timeout: 15000 });
  }

  get notesHeading(): Locator {
    return this.main.getByRole("heading", { name: "Notes and references" });
  }

  get gisLayersHeading(): Locator {
    return this.main.getByRole("heading", { name: "GIS layers" });
  }

  /** Each listed GIS layer has a "Remove <layer name>" button. */
  removeLayerButton(layerName: string): Locator {
    return this.main.getByRole("button", { name: `Remove ${layerName}` });
  }

  /** Pick a file through the dropzone's "Browse files" button. */
  async dropFile(filePath: string): Promise<void> {
    const fileChooser = this.page.waitForEvent("filechooser");
    await this.main.getByRole("button", { name: "Browse files" }).click();
    await (await fileChooser).setFiles(filePath);
  }
}
