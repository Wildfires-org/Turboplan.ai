import { expect, type Locator, type Page } from "@playwright/test";

import { appPaths } from "@wildfires-org/turboplan-utils/app-paths";

/**
 * Page Object for the office templates grid (`/[org]/[office]/templates`),
 * a template's page (`/[org]/[office]/templates/[templateSlug]`) and the
 * "Create template from project" action on a project page.
 */
export class OfficeFeaturesTemplatesPage {
  constructor(private readonly page: Page) {}

  /** Open the office templates grid and wait for it to finish loading */
  async gotoGrid(orgSlug: string, officeSlug: string): Promise<void> {
    await this.page.goto(`${appPaths.office(orgSlug, officeSlug)}/templates`);
    await expect(this.getGridHeading()).toBeVisible({ timeout: 15000 });
  }

  /** Open a template's own page */
  async gotoTemplate(
    orgSlug: string,
    officeSlug: string,
    templateSlug: string,
  ): Promise<void> {
    await this.page.goto(
      `${appPaths.office(orgSlug, officeSlug)}/templates/${templateSlug}`,
    );
  }

  /** The "Templates" heading of the grid toolbar */
  getGridHeading(): Locator {
    return this.page.getByRole("heading", { name: "Templates", exact: true });
  }

  /** The grid's search box */
  getSearchInput(): Locator {
    return this.page.getByRole("textbox", { name: "Search templates" });
  }

  /**
   * A template card (the whole card is a link) by its exact name. Scoped to
   * <main>: the sidebar's "My Projects" list links projects by name too.
   */
  getTemplateCard(templateName: string): Locator {
    return this.page
      .getByRole("main")
      .getByRole("link")
      .filter({
        has: this.page.getByRole("heading", {
          name: templateName,
          exact: true,
        }),
      });
  }

  /** Assert the grid shows the "no templates yet" empty state */
  async expectEmptyState(): Promise<void> {
    await expect(
      this.page.getByRole("heading", { name: "No templates yet" }),
    ).toBeVisible({ timeout: 15000 });
  }

  /** Open a grid card's "..." menu */
  private async openCardActions(templateName: string): Promise<void> {
    await this.page
      .getByRole("button", { name: `Actions for ${templateName}` })
      .click();
  }

  /** The open "Edit Template" dialog */
  getEditDialog(): Locator {
    return this.page.getByRole("alertdialog", { name: "Edit Template" });
  }

  /** Rename a template from its grid card menu */
  async renameFromGrid(templateName: string, newName: string): Promise<void> {
    await this.openCardActions(templateName);
    await this.page.getByRole("menuitem", { name: "Edit Template" }).click();
    await this.submitEditDialog({ name: newName });
  }

  /** Change a template's name/description from its own page's actions menu */
  async editFromTemplatePage(fields: {
    name?: string;
    description?: string;
  }): Promise<void> {
    await this.page.getByRole("button", { name: "Template actions" }).click();
    await this.page.getByRole("menuitem", { name: "Edit" }).click();
    await this.submitEditDialog(fields);
  }

  private async submitEditDialog(fields: {
    name?: string;
    description?: string;
  }): Promise<void> {
    const dialog = this.getEditDialog();
    await expect(dialog).toBeVisible();
    if (fields.name !== undefined) {
      await dialog.getByLabel(/^Name/).fill(fields.name);
    }
    if (fields.description !== undefined) {
      await dialog.getByLabel("Description").fill(fields.description);
    }
    await dialog.getByRole("button", { name: "Save Changes" }).click();
    await expect(dialog).toBeHidden({ timeout: 15000 });
  }

  /** Delete a template from its grid card menu, confirming the dialog */
  async deleteFromGrid(templateName: string): Promise<void> {
    await this.openCardActions(templateName);
    await this.page.getByRole("menuitem", { name: "Delete Template" }).click();

    const dialog = this.page.getByRole("alertdialog", {
      name: "Delete Template",
    });
    await expect(dialog).toContainText(templateName);
    await dialog.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(dialog).toBeHidden({ timeout: 15000 });
  }

  /** The template page's title (h1, followed by the "Template" badge) */
  getTemplatePageTitle(): Locator {
    return this.page.getByRole("heading", { level: 1 });
  }

  /**
   * "Use Template" from a template's page: name the new project and create
   * it. The app redirects to the new project's page.
   */
  async useTemplate(projectName: string): Promise<void> {
    await this.page.getByRole("button", { name: "Template actions" }).click();
    await this.page.getByRole("menuitem", { name: "Use Template" }).click();

    const dialog = this.page.getByRole("alertdialog", { name: "Use Template" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Project Name").fill(projectName);
    await dialog.getByRole("button", { name: "Create Project" }).click();
  }

  /**
   * "Create template from project" from a project page's actions menu. The
   * dialog prefills "Template: <project name>"; `templateName` replaces it.
   */
  async createTemplateFromProjectPage(params: {
    sourceProjectName: string;
    templateName: string;
  }): Promise<void> {
    await this.page.getByRole("button", { name: "Project actions" }).click();
    await this.page
      .getByRole("menuitem", { name: "Create template from project" })
      .click();

    const dialog = this.page.getByRole("alertdialog", {
      name: "Create Template",
    });
    const nameInput = dialog.getByLabel("Template Name");
    await expect(nameInput).toHaveValue(
      `Template: ${params.sourceProjectName}`,
    );
    await nameInput.fill(params.templateName);
    await dialog.getByRole("button", { name: "Create Template" }).click();
    await expect(dialog).toBeHidden({ timeout: 15000 });
  }
}
