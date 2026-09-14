import { expect, type Page } from "@playwright/test";

import { PROJECT_URL_PATTERN } from "../config/patterns";
import { mockGenerateTitles } from "../utils";

/**
 * Page Object for the citizen sidebar in a gov office context.
 * Handles "My Drafts", "Submitted" sections, "New Application" button, and project creation dialog.
 */
export class TurboplanCitizenSidebarPage {
  constructor(private readonly page: Page) {}

  /** Click "New Application" button in the sidebar */
  async clickNewApplication(): Promise<void> {
    await this.page
      .getByRole("button", { name: /New Application/i })
      .first()
      .click();
  }

  /** Fill and submit the create project dialog */
  async createProject(
    projectName: string,
    prompt: string,
    officeName: string,
  ): Promise<void> {
    await this.clickNewApplication();

    const dialog = this.page.getByRole("alertdialog", {
      name: "Add Project",
    });
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await expect(dialog.getByText(officeName)).toBeVisible({ timeout: 10000 });

    await dialog.getByLabel("Project Prompt").fill(prompt);

    // Mock the /generate-titles endpoint to return a deterministic name
    const unmockGenerateTitles = await mockGenerateTitles(
      this.page,
      projectName,
    );

    await dialog.getByRole("button", { name: /Create Project/i }).click();

    await this.page.waitForURL(PROJECT_URL_PATTERN, { timeout: 10000 });

    await unmockGenerateTitles();
  }

  /** Assert "My Drafts" section is visible */
  async expectMyDraftsVisible(): Promise<void> {
    await expect(this.page.getByText("My Drafts")).toBeVisible({
      timeout: 10000,
    });
  }

  /** Assert "Submitted" section header is visible */
  async expectSubmittedSectionVisible(): Promise<void> {
    await expect(this.page.getByText("Submitted").first()).toBeVisible({
      timeout: 10000,
    });
  }

  /** Click a project link in the sidebar */
  async clickProject(projectName: string): Promise<void> {
    const link = this.page.getByRole("link", {
      name: projectName,
      exact: true,
    });
    // Sidebar "My Drafts"/"Submitted" lists load async (SWR); wait out the
    // skeleton placeholders before clicking the named link.
    await expect(link).toBeVisible({ timeout: 30000 });
    await link.click();
    await this.page.waitForURL(PROJECT_URL_PATTERN, { timeout: 10000 });
  }

  /** Assert a project link is visible in the sidebar */
  async expectProjectVisible(projectName: string): Promise<void> {
    await expect(
      this.page.getByRole("link", { name: projectName, exact: true }),
    ).toBeVisible({ timeout: 10000 });
  }
}
