import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Page Object for a project chat (`.../projects/[projectSlug]/chats/[chatId]`)
 * and the project sidebar links used to leave and re-enter it.
 */
export class TurboplanProjectChatPage {
  constructor(private readonly page: Page) {}

  /** Open a chat by URL and wait until its composer is usable */
  async goto(params: {
    orgSlug: string;
    officeSlug: string;
    projectSlug: string;
    chatId: string;
  }): Promise<void> {
    const { orgSlug, officeSlug, projectSlug, chatId } = params;
    await this.page.goto(
      `/organizations/${orgSlug}/offices/${officeSlug}/projects/${projectSlug}/chats/${chatId}`,
      { waitUntil: "domcontentloaded" },
    );
    await this.expectComposerReady();
  }

  /**
   * The main chat composer. Scoped to it because the artifact panel, when
   * open, has an input with the same placeholder and buttons.
   */
  getComposerForm(): Locator {
    return this.page.getByTestId("project-chat-composer");
  }

  /** The chat message textarea */
  getComposer(): Locator {
    return this.getComposerForm().getByPlaceholder("Send a message...");
  }

  /** Assert the composer is editable (page loaded and no reply streaming) */
  async expectComposerReady(): Promise<void> {
    await expect(this.getComposer()).toBeEditable({ timeout: 20000 });
  }

  /** Type a message and send it with the send button */
  async sendMessage(text: string): Promise<void> {
    await this.getComposer().fill(text);
    await this.getComposerForm()
      .getByRole("button", { name: "Send message" })
      .click();
  }

  /** A rendered user message containing `text` */
  getUserMessage(text: string): Locator {
    return this.page.getByTestId("message-user").filter({ hasText: text });
  }

  /** A rendered assistant message containing `text` */
  getAssistantMessage(text: string): Locator {
    return this.page.getByTestId("message-assistant").filter({ hasText: text });
  }

  /** Assert both sides of an exchange are rendered in the message list */
  async expectExchange(
    userText: string,
    assistantText: string,
    timeout = 15000,
  ): Promise<void> {
    await expect(this.getUserMessage(userText)).toBeVisible({ timeout });
    await expect(this.getAssistantMessage(assistantText)).toBeVisible({
      timeout,
    });
  }

  /** Leave the chat through the project sidebar "Members" link */
  async goToMembersViaSidebar(): Promise<void> {
    await this.page.getByRole("link", { name: "Members", exact: true }).click();
    await this.page.waitForURL(/\/members$/, { timeout: 15000 });
  }

  /** Re-open a chat from the project sidebar chat list, expanding it if collapsed */
  async openChatViaSidebar(chatTitle: string): Promise<void> {
    const chatToggle = this.page.getByRole("button", {
      name: "Chat",
      exact: true,
    });
    if ((await chatToggle.getAttribute("aria-expanded")) === "false") {
      await chatToggle.click();
    }

    const chatLink = this.page.getByRole("link", {
      name: chatTitle,
      exact: true,
    });
    // The sidebar chat list loads via SWR; wait out its "Loading..." row.
    await expect(chatLink).toBeVisible({ timeout: 15000 });
    await chatLink.click();
  }
}
