import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Page Object for a project's Comments page (`/:org/:office/:project/comments`).
 * Comments can be posted, replied to, made public/private and deleted; there is
 * no edit.
 */
export class ProjectCommentsPage {
  constructor(private readonly page: Page) {}

  get main(): Locator {
    return this.page.getByRole("main");
  }

  async goto(projectPath: string): Promise<void> {
    await this.page.goto(`${projectPath}/comments`);
    await expect(
      this.main.getByRole("heading", { name: "Comments", level: 2 }),
    ).toBeVisible({ timeout: 15000 });
    await expect(this.newCommentInput).toBeVisible();
  }

  get newCommentInput(): Locator {
    return this.main.getByRole("textbox", { name: "Leave a comment" });
  }

  /**
   * A top-level comment card. Cards (and their replies) are unlabelled
   * `.group` divs; the outermost one holding the text is the comment itself.
   */
  comment(content: string): Locator {
    return this.main
      .locator(".group")
      .filter({ has: this.page.getByText(content, { exact: true }) })
      .first();
  }

  async post(content: string): Promise<void> {
    await this.newCommentInput.fill(content);
    await this.main.getByRole("button", { name: "Post", exact: true }).click();
    await expect(this.page.getByText("Comment posted")).toBeVisible();
    await expect(this.comment(content)).toBeVisible();
  }

  async reply(parentContent: string, content: string): Promise<void> {
    const card = this.comment(parentContent);
    await card.getByRole("button", { name: "Reply", exact: true }).click();
    await card.getByRole("textbox", { name: "Write a reply..." }).fill(content);
    await card.getByRole("button", { name: "Post", exact: true }).click();
    await expect(this.page.getByText("Reply posted")).toBeVisible();
  }

  /** The comment's own "Actions" menu (the first one; replies have their own). */
  private async openActions(content: string): Promise<void> {
    await this.comment(content)
      .getByRole("button", { name: "Actions", exact: true })
      .first()
      .click();
  }

  async makePublic(content: string): Promise<void> {
    await this.openActions(content);
    await this.page.getByRole("menuitem", { name: "Make public" }).click();
    await expect(this.page.getByText("Comment is now public")).toBeVisible();
  }

  /** The visibility icon's tooltip title on the comment header. */
  async expectVisibility(content: string, isPublic: boolean): Promise<void> {
    await expect(
      this.comment(content)
        .getByTitle(
          isPublic ? "Visible to public" : "Only visible on dashboard",
        )
        .first(),
    ).toBeVisible();
  }

  async delete(content: string): Promise<void> {
    await this.openActions(content);
    await this.page.getByRole("menuitem", { name: "Delete" }).click();

    const confirm = this.page.getByRole("alertdialog", {
      name: "Delete comment?",
    });
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "Delete" }).click();
    await expect(this.page.getByText("Comment deleted")).toBeVisible();
    await expect(confirm).toBeHidden();
  }
}
