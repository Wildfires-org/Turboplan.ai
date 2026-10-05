import { expect, type Page, test } from "@playwright/test";

import { TurboplanProjectChatPage } from "../../pages";
import {
  createTestProjectChat,
  createTestProjectInOffice,
  getCitizenWorkspace,
  mockProjectChatApi,
  type WorkspaceInfo,
} from "../../utils";

// Evaluated in the browser, where globalThis is window (e2e has no DOM lib).
type MarkedGlobal = typeof globalThis & { __e2eSameDocument?: boolean };

const USER_MESSAGE = "Which permits does the culvert replacement need?";
const ASSISTANT_REPLY =
  "A streambed alteration agreement covers the culvert replacement.";

const shortId = (): string => Math.random().toString(36).substring(2, 8);

/** Flag the current document; the flag survives client-side navigations only. */
const markDocument = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    (globalThis as MarkedGlobal).__e2eSameDocument = true;
  });
};

/** Fail if the page was fully reloaded since `markDocument` */
const expectSameDocument = async (page: Page): Promise<void> => {
  const isSameDocument = await page.evaluate(
    () => (globalThis as MarkedGlobal).__e2eSameDocument === true,
  );
  expect(
    isSameDocument,
    "expected a client-side navigation back to the chat, not a full reload",
  ).toBe(true);
};

/**
 * Regression: returning to a project chat without a full reload (browser Back
 * or the sidebar chat link) must show the latest exchange, not the stale
 * message list SWR cached when the chat was first opened.
 *
 * No model is called: POST /api/chat and GET /api/chat/[chatId]/messages are
 * mocked by `mockProjectChatApi`. The GET returns [] until the POST completes,
 * like the real server, so a chat rebuilt from the stale cache renders empty.
 */
test.describe("Project chat - messages after navigating away", () => {
  test.setTimeout(60_000);

  let workspace: WorkspaceInfo;
  let project: { id: string; slug: string };

  test.beforeAll(async () => {
    workspace = await getCitizenWorkspace();
    project = await createTestProjectInOffice({
      name: `Chat Navigation ${shortId()}`,
      officeId: workspace.officeId,
      createdBy: workspace.userId,
    });
  });

  /**
   * Seed a chat, exchange one message in it, then leave it for the project
   * Members page (the chat view unmounts).
   */
  const exchangeMessageAndLeaveChat = async (page: Page) => {
    const chat = await createTestProjectChat({
      userId: workspace.userId,
      projectId: project.id,
      title: `Permits ${shortId()}`,
    });
    await mockProjectChatApi(page, {
      chatId: chat.id,
      replyText: ASSISTANT_REPLY,
    });

    const chatPage = new TurboplanProjectChatPage(page);
    await chatPage.goto({
      orgSlug: workspace.orgSlug,
      officeSlug: workspace.officeSlug,
      projectSlug: project.slug,
      chatId: chat.id,
    });

    await chatPage.sendMessage(USER_MESSAGE);
    await chatPage.expectExchange(USER_MESSAGE, ASSISTANT_REPLY);
    // The composer re-enables once the reply stream has finished.
    await chatPage.expectComposerReady();

    await markDocument(page);
    await chatPage.goToMembersViaSidebar();
    await expect(chatPage.getComposer()).toBeHidden();

    return { chat, chatPage };
  };

  test("shows the latest exchange after browser Back", async ({ page }) => {
    const { chat, chatPage } = await exchangeMessageAndLeaveChat(page);

    await page.goBack();
    await page.waitForURL(new RegExp(`/chats/${chat.id}$`));

    await chatPage.expectExchange(USER_MESSAGE, ASSISTANT_REPLY);
    await expectSameDocument(page);
  });

  test("does not reopen a document artifact in the next chat", async ({
    page,
  }) => {
    const [documentChat, otherChat] = await Promise.all(
      ["Draft", "Other"].map((prefix) =>
        createTestProjectChat({
          userId: workspace.userId,
          projectId: project.id,
          title: `${prefix} ${shortId()}`,
        }),
      ),
    );
    // Past the 400-character threshold at which the panel opens by itself.
    await mockProjectChatApi(page, {
      chatId: documentChat.id,
      replyText: ASSISTANT_REPLY,
      artifact: {
        title: "Permit checklist",
        content: "Streambed alteration agreement. ".repeat(20),
      },
    });
    // The other chat only loads its (empty) messages, so it needs no mock.

    const chatPage = new TurboplanProjectChatPage(page);
    await chatPage.goto({
      orgSlug: workspace.orgSlug,
      officeSlug: workspace.officeSlug,
      projectSlug: project.slug,
      chatId: documentChat.id,
    });

    await chatPage.sendMessage(USER_MESSAGE);
    await expect(page.getByTestId("artifact")).toBeVisible();

    await chatPage.goToMembersViaSidebar();
    await expect(chatPage.getComposer()).toBeHidden();

    await chatPage.openChatViaSidebar(otherChat.title);
    await page.waitForURL(new RegExp(`/chats/${otherChat.id}$`));
    await chatPage.expectComposerReady();

    await expect(page.getByTestId("artifact")).toBeHidden();
  });

  test("shows the latest exchange after reopening the chat from the sidebar", async ({
    page,
  }) => {
    const { chat, chatPage } = await exchangeMessageAndLeaveChat(page);

    await chatPage.openChatViaSidebar(chat.title);
    await page.waitForURL(new RegExp(`/chats/${chat.id}$`));

    await chatPage.expectExchange(USER_MESSAGE, ASSISTANT_REPLY);
    await expectSameDocument(page);
  });

  /**
   * Regression: a finished reply refreshes the sidebar chat list. When that
   * refresh lands while the list's first request is still in flight (a fast
   * reply right after a full page load), the list must still load instead of
   * staying on "Loading...".
   */
  test("loads the sidebar chat list when the reply finishes before it", async ({
    page,
  }) => {
    const chat = await createTestProjectChat({
      userId: workspace.userId,
      projectId: project.id,
      title: `Sidebar ${shortId()}`,
    });
    await mockProjectChatApi(page, {
      chatId: chat.id,
      replyText: ASSISTANT_REPLY,
    });

    // Hold the sidebar's first chat-list request until the reply is done.
    const chatListUrl = `**/api/projects/${project.id}/chats`;
    let releaseFirstChatList = () => {};
    const firstChatListReleased = new Promise<void>((resolve) => {
      releaseFirstChatList = resolve;
    });
    let isFirstChatListRequest = true;
    await page.route(chatListUrl, async (route) => {
      if (isFirstChatListRequest) {
        isFirstChatListRequest = false;
        await firstChatListReleased;
      }
      await route.fallback();
    });
    const firstChatListRequest = page.waitForRequest(chatListUrl);

    const chatPage = new TurboplanProjectChatPage(page);
    await chatPage.goto({
      orgSlug: workspace.orgSlug,
      officeSlug: workspace.officeSlug,
      projectSlug: project.slug,
      chatId: chat.id,
    });
    await firstChatListRequest;

    await chatPage.sendMessage(USER_MESSAGE);
    await chatPage.expectExchange(USER_MESSAGE, ASSISTANT_REPLY);
    await chatPage.expectComposerReady();
    releaseFirstChatList();

    await expect(chatPage.getSidebarChatLink(chat.title)).toBeVisible({
      timeout: 15000,
    });
  });
});
