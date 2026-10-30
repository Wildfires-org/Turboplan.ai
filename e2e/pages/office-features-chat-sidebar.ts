import { expect, type Locator, type Page } from "@playwright/test";

import { appPaths } from "@wildfires-org/turboplan-utils/app-paths";

/**
 * Page Object for the project sidebar's chat list (the "Chat" row, its
 * "New chat" button and the chat links under it) and for `/chats/new`.
 * Composer and message helpers live in `TurboplanProjectChatPage`.
 */
export class OfficeFeaturesChatSidebar {
  constructor(private readonly page: Page) {}

  /** Open a project's `/chats/new` page directly */
  async gotoNewChat(params: {
    orgSlug: string;
    officeSlug: string;
    projectSlug: string;
  }): Promise<void> {
    const { orgSlug, officeSlug, projectSlug } = params;
    await this.page.goto(
      `${appPaths.project(orgSlug, officeSlug, projectSlug)}/chats/new`,
    );
  }

  /** The sidebar's "Chat" row, which toggles the chat sub-list */
  getChatToggle(): Locator {
    return this.page.getByRole("button", { name: "Chat", exact: true });
  }

  /** Expand the chat sub-list if it is collapsed */
  async expandChatList(): Promise<void> {
    const toggle = this.getChatToggle();
    await expect(toggle).toBeVisible({ timeout: 15000 });
    if ((await toggle.getAttribute("aria-expanded")) === "false") {
      await toggle.click();
    }
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
  }

  /** The sidebar's "New chat" (+) link */
  getNewChatLink(): Locator {
    return this.page.getByRole("link", { name: "New chat", exact: true });
  }

  /** Start a new chat from the sidebar */
  async clickNewChat(): Promise<void> {
    await this.getNewChatLink().click();
    await this.page.waitForURL(/\/chats\/new$/, { timeout: 15000 });
  }

  /** A chat's link in the sidebar list */
  getChatLink(title: string): Locator {
    return this.page.getByRole("link", { name: title, exact: true });
  }

  /**
   * Titles of the sidebar chat links whose title contains `marker`, in the
   * order the list renders them. Waits until the list has loaded.
   */
  async getChatTitles(marker: string): Promise<string[]> {
    await expect(
      this.page.getByText("Loading...", { exact: true }),
    ).toHaveCount(0, { timeout: 15000 });
    return this.page
      .locator('a[href*="/chats/"]')
      .filter({ hasText: marker })
      .allInnerTexts();
  }
}
