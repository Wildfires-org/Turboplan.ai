import { expect, type Locator, type Page } from "@playwright/test";

export type ProjectRoleLabel = "Owner" | "Editor" | "Viewer";

/**
 * Page Object for a project's Members page (`/:org/:office/:project/members`).
 */
export class ProjectMembersPage {
  constructor(private readonly page: Page) {}

  get main(): Locator {
    return this.page.getByRole("main");
  }

  /** Open the page and wait for `memberEmail`'s row, i.e. the list has loaded. */
  async goto(projectPath: string, memberEmail: string): Promise<void> {
    await this.page.goto(`${projectPath}/members`);
    await expect(this.main.getByText(memberEmail, { exact: true })).toBeVisible(
      { timeout: 15000 },
    );
  }

  /**
   * A member row: the innermost element holding both the email and the row's
   * role picker. Rows have no role or test id of their own.
   */
  row(email: string): Locator {
    return this.main
      .locator("div")
      .filter({ has: this.page.getByText(email, { exact: true }) })
      .filter({ has: this.page.getByRole("combobox") })
      .last();
  }

  roleSelect(email: string): Locator {
    return this.row(email).getByRole("combobox");
  }

  async changeRole(email: string, role: ProjectRoleLabel): Promise<void> {
    const updateResponse = this.page.waitForResponse(
      (resp) =>
        resp.url().includes("/members") &&
        ["PUT", "PATCH"].includes(resp.request().method()),
    );
    await this.roleSelect(email).click();
    await this.page.getByRole("option", { name: role, exact: true }).click();
    expect((await updateResponse).ok()).toBeTruthy();
    await expect(this.roleSelect(email)).toHaveText(role);
  }

  /** Rows are labelled by display name ("First Last"), not by email. */
  async removeMember(displayName: string, email: string): Promise<void> {
    await this.main
      .getByRole("button", { name: `Actions for ${displayName}`, exact: true })
      .click();
    await this.page.getByRole("menuitem", { name: "Remove member" }).click();
    await expect(this.main.getByText(email, { exact: true })).toBeHidden();
  }
}
