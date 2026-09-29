import { expect, type Page } from "@playwright/test";

import { PROJECT_URL_PATTERN } from "../config/patterns";

/**
 * Page Object for the Turboplan dashboard / homepage.
 * Handles office navigation, project listing, and access-restricted pages.
 */
export class TurboplanDashboardPage {
  constructor(private readonly page: Page) {}

  /** Navigate to the homepage */
  async goto(): Promise<void> {
    await this.page.goto("/");
  }

  /** Navigate directly to an office by org/office slug */
  async gotoOffice(orgSlug: string, officeSlug: string): Promise<void> {
    // "domcontentloaded" instead of the default "load": the office page hydrates
    // its project list client-side, so waiting on every subresource is slow and
    // unnecessary — callers assert on specific elements afterwards.
    await this.page.goto(`/organizations/${orgSlug}/offices/${officeSlug}`, {
      waitUntil: "domcontentloaded",
    });
  }

  /** Click an office name on the homepage to navigate to it */
  async navigateToOffice(officeName: string): Promise<void> {
    await expect(this.page.getByText(officeName)).toBeVisible({
      timeout: 10000,
    });
    await this.page.getByText(officeName).click();
  }

  /** Navigate from homepage → office → project */
  async navigateToProjectViaOffice(
    officeName: string,
    projectName: string,
  ): Promise<void> {
    await this.goto();
    await this.navigateToOffice(officeName);
    const main = this.page.getByRole("main");
    await expect(main.getByRole("link", { name: projectName })).toBeVisible({
      timeout: 10000,
    });
    await main.getByRole("link", { name: projectName }).click();
  }

  /** Assert the office heading (h1) is visible */
  async expectOfficeHeading(officeName: string): Promise<void> {
    await expect(
      this.page.getByRole("heading", { name: officeName, level: 1 }),
    ).toBeVisible({ timeout: 10000 });
  }

  /** Get the main content area locator */
  getMain() {
    return this.page.getByRole("main");
  }

  /** Assert a project link is visible in the main content area */
  async expectProjectVisible(projectName: string): Promise<void> {
    await expect(
      this.getMain().getByRole("link", { name: projectName }),
    ).toBeVisible({ timeout: 10000 });
  }

  /** Assert a project link is NOT visible in the main content area */
  async expectProjectNotVisible(projectName: string): Promise<void> {
    await expect(
      this.getMain().getByRole("link", { name: projectName }),
    ).not.toBeVisible();
  }

  /** Click a project link in the main content area */
  async clickProject(projectName: string): Promise<void> {
    await this.getMain().getByRole("link", { name: projectName }).click();
  }

  /** Assert the "Access Restricted" page is shown */
  async expectAccessRestricted(): Promise<void> {
    await expect(
      this.page.getByRole("heading", { name: "Access Restricted" }),
    ).toBeVisible({ timeout: 10000 });
    // Scoped to <main>: React can leave a hidden copy of a streamed segment
    // outside it (a `display: none` S:* container), which getByText also
    // matches and which would trip strict mode.
    await expect(
      this.page
        .getByRole("main")
        .getByText("There is no such project, or you don't have access to it."),
    ).toBeVisible();
  }

  /** Navigate directly to a project URL */
  async gotoProject(
    orgSlug: string,
    officeSlug: string,
    projectSlug: string,
  ): Promise<void> {
    await this.page.goto(
      `/organizations/${orgSlug}/offices/${officeSlug}/projects/${projectSlug}`,
    );
  }
}
