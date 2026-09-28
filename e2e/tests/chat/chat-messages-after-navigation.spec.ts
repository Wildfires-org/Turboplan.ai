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

  test("shows the latest exchange after reopening the chat from the sidebar", async ({
    page,
  }) => {
    const { chat, chatPage } = await exchangeMessageAndLeaveChat(page);

    await chatPage.openChatViaSidebar(chat.title);
    await page.waitForURL(new RegExp(`/chats/${chat.id}$`));

    await chatPage.expectExchange(USER_MESSAGE, ASSISTANT_REPLY);
    await expectSameDocument(page);
  });
});
