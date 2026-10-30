import { expect, type Locator, type Page } from "@playwright/test";

/** An admin panel page: its path and the level-1 heading it renders. */
export type AdminPanelRoute = {
  path: string;
  heading: string;
};

export const ADMIN_DASHBOARD: AdminPanelRoute = {
  path: "/admin",
  heading: "Admin Dashboard",
};

/** Open to every admin (super admins from ADMIN_EMAILS and DB admins). */
export const ADMIN_ROUTES: AdminPanelRoute[] = [
  ADMIN_DASHBOARD,
  { path: "/admin/ai-models", heading: "AI Model Configuration" },
  { path: "/admin/prompts", heading: "Prompt Management" },
  { path: "/admin/webhook-logs", heading: "Webhook Logs" },
  { path: "/admin/cataloger", heading: "Cataloger" },
];

/** Super admins only; a DB admin is sent back to the dashboard. */
export const ADMIN_USERS_ROUTE: AdminPanelRoute = {
  path: "/admin/users",
  heading: "Manage Admin Users",
};

/** Page Object Model for the `/admin` pages. */
export class AdminPanelPage {
  constructor(public readonly page: Page) {}

  heading(name: string): Locator {
    return this.page.getByRole("heading", { level: 1, name, exact: true });
  }

  async goto(path: string): Promise<void> {
    await this.page.goto(path);
  }

  async expectOnPage(route: AdminPanelRoute): Promise<void> {
    await expect(this.page).toHaveURL(route.path);
    await expect(this.heading(route.heading)).toBeVisible({ timeout: 15_000 });
  }

  /** A card on the dashboard that links to another admin page. */
  dashboardCard(title: string): Locator {
    return this.page
      .getByRole("main")
      .getByRole("link")
      .filter({ has: this.page.getByRole("heading", { name: title }) });
  }
}

/** Page Object Model for `/admin/prompts` (prompt list + editor). */
export class AdminPromptsPage {
  constructor(public readonly page: Page) {}

  get contentField(): Locator {
    return this.page.getByLabel("Prompt Content");
  }

  get saveButton(): Locator {
    return this.page.getByRole("button", { name: "Save", exact: true });
  }

  /** A prompt in the sidebar list; its button shows the title and name. */
  promptButton(name: string): Locator {
    return this.page.getByRole("button", { name });
  }

  async goto(): Promise<void> {
    await this.page.goto("/admin/prompts");
  }

  /**
   * Open a prompt in the editor and wait until it shows `content`. The first
   * prompt is opened automatically, so waiting for any editor is not enough.
   */
  async openPrompt(name: string, content: string): Promise<void> {
    await this.promptButton(name).click();
    await expect(this.contentField).toHaveValue(content, { timeout: 15_000 });
  }

  /** Replace the displayed version's content and save it in place. */
  async saveContent(content: string): Promise<void> {
    await this.contentField.fill(content);
    await expect(this.saveButton).toBeEnabled();
    await this.saveButton.click();
    await expect(
      this.page.getByText("Prompt saved successfully"),
    ).toBeVisible();
  }
}
