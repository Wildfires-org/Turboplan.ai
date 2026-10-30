import { expect, type Locator, type Page } from "@playwright/test";

import { appPaths } from "@wildfires-org/turboplan-utils/app-paths";

export type MemberRoleOption = "Owner" | "Editor" | "Viewer";
export type MemberAccessFilter = "All" | "Direct" | "Inherited";

/**
 * Page Object Model for the members table on an organization's or an office's
 * Members tab: per-row role select, the row's actions menu (remove member,
 * revoke invitation) and the Access filter (office only).
 *
 * The table renders plain divs, not ARIA rows, so a row is the innermost div
 * holding both the given text and the row's trailing cells.
 */
export class WorkspaceMembersTable {
  constructor(public readonly page: Page) {}

  get main(): Locator {
    return this.page.getByRole("main");
  }

  /**
   * Open a Members tab and wait until `visibleText` (an email or name of a
   * row the default filters show) is listed.
   */
  async gotoOrganization(orgSlug: string, visibleText: string): Promise<void> {
    await this.page.goto(`${appPaths.organization(orgSlug)}/members`);
    await this.expectListed(visibleText);
  }

  async gotoOffice(
    orgSlug: string,
    officeSlug: string,
    visibleText: string,
  ): Promise<void> {
    await this.page.goto(`${appPaths.office(orgSlug, officeSlug)}/members`);
    await this.expectListed(visibleText);
  }

  async expectListed(text: string): Promise<void> {
    await expect(this.main.getByText(text, { exact: true })).toBeVisible({
      timeout: 15000,
    });
  }

  async expectNotListed(text: string): Promise<void> {
    await expect(this.main.getByText(text, { exact: true })).toHaveCount(0);
  }

  /** The row of the member or invitation showing `text` (email or name). */
  row(text: string): Locator {
    return this.main
      .locator("div")
      .filter({ has: this.page.getByText(text, { exact: true }) })
      .filter({ has: this.page.getByRole("img", { name: /Active|Pending/ }) })
      .last();
  }

  /** The role select of a direct member's row (managers only). */
  roleSelect(text: string): Locator {
    return this.row(text).getByRole("combobox");
  }

  async changeRole(text: string, role: MemberRoleOption): Promise<void> {
    await this.roleSelect(text).click();
    await this.page.getByRole("option", { name: role, exact: true }).click();
    // The select shows the server's role, so it changes once the update and
    // the members refetch are done.
    await expect(this.roleSelect(text)).toHaveText(role, { timeout: 15000 });
  }

  /** A row's "⋮" trigger; rows are named by display name (or email). */
  actionsButton(rowName: string): Locator {
    return this.main.getByRole("button", {
      name: `Actions for ${rowName}`,
      exact: true,
    });
  }

  async chooseRowAction(
    rowName: string,
    action: "Remove member" | "Resend invitation" | "Revoke invitation",
  ): Promise<void> {
    await this.actionsButton(rowName).click();
    await this.page.getByRole("menuitem", { name: action }).click();
  }

  get accessFilter(): Locator {
    return this.main.getByRole("combobox").filter({ hasText: "Access:" });
  }

  async filterByAccess(value: MemberAccessFilter): Promise<void> {
    await this.accessFilter.click();
    await this.page.getByRole("option", { name: value, exact: true }).click();
    await expect(this.accessFilter).toContainText(value);
  }
}
