import { expect, type Locator, type Page } from "@playwright/test";

import { appPaths } from "@wildfires-org/turboplan-utils/app-paths";

export type SubmissionStatusLabel = "New" | "Approved" | "Rejected";

/**
 * Page Object for the office submission lists: `citizen-submissions` (gov
 * reviewers) and `my-submissions` (the citizen who submitted). Both render
 * the same searchable, filterable card grid.
 */
export class OfficeFeaturesSubmissionsPage {
  constructor(private readonly page: Page) {}

  /** Open the gov reviewer list */
  async gotoCitizenSubmissions(
    orgSlug: string,
    officeSlug: string,
  ): Promise<void> {
    await this.page.goto(
      `${appPaths.office(orgSlug, officeSlug)}/citizen-submissions`,
    );
  }

  /** Open the citizen's own list */
  async gotoMySubmissions(orgSlug: string, officeSlug: string): Promise<void> {
    await this.page.goto(
      `${appPaths.office(orgSlug, officeSlug)}/my-submissions`,
    );
  }

  /** The list's search box */
  getSearchInput(): Locator {
    return this.page.getByRole("textbox", { name: "Search submissions..." });
  }

  /**
   * Narrow the list to `term`. The lists are shared with other specs and are
   * paginated, so each test searches for its own unique run id.
   */
  async search(term: string): Promise<void> {
    await expect(this.getSearchInput()).toBeVisible({ timeout: 15000 });
    await this.getSearchInput().fill(term);
  }

  /** A submission card (the whole card is a link) by its exact project name */
  getSubmissionCard(projectName: string): Locator {
    return this.page
      .getByRole("main")
      .getByRole("link")
      .filter({
        has: this.page.getByRole("heading", { name: projectName, exact: true }),
      });
  }

  /** All submission cards currently rendered in the grid */
  getSubmissionCards(): Locator {
    return this.page
      .getByRole("main")
      .getByRole("link")
      .filter({ hasText: "Submitted by:" });
  }

  /** Assert a card is listed with the given status badge */
  async expectSubmission(
    projectName: string,
    status: SubmissionStatusLabel,
  ): Promise<void> {
    const card = this.getSubmissionCard(projectName);
    await expect(card).toBeVisible({ timeout: 15000 });
    await expect(card).toContainText(status);
  }

  /** Pick an option of the "Status" filter chip */
  async filterByStatus(label: "All" | SubmissionStatusLabel): Promise<void> {
    await this.page.getByRole("button", { name: /^Status:/ }).click();
    await this.page.getByRole("menuitem", { name: label }).click();
  }

  /** Assert the list shows the "no results for this search" empty state */
  async expectNoSearchResults(entityLabel: string): Promise<void> {
    await expect(
      this.page.getByRole("heading", { name: `No ${entityLabel} found` }),
    ).toBeVisible({ timeout: 15000 });
  }
}
