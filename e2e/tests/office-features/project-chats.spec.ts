import { randomUUID } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";

import {
  getChatById,
  getMessagesByChatId,
  saveChat,
  saveMessages,
} from "@wildfires-org/turboplan-db/queries";

import { appPaths } from "../../config";
import { TurboplanProjectChatPage } from "../../pages";
import { OfficeFeaturesChatSidebar } from "../../pages/office-features-chat-sidebar";
import {
  createTestProjectChat,
  createTestProjectInOffice,
  getCitizenWorkspace,
  mockProjectChatApi,
  type WorkspaceInfo,
} from "../../utils";

/**
 * Project chats: the sidebar chat list and `/chats/new`.
 *
 * No model is called. `mockProjectChatApi` answers POST /api/chat with a
 * canned UI message stream. The chat UI offers no rename or delete for chats
 * (sidebar rows are plain links, the header only shows the title), so those
 * are not covered. tests/chat/* covers returning to a chat after navigating.
 */

const USER_MESSAGE = "Which agencies review the bioswale design?";
const ASSISTANT_REPLY =
  "The county stormwater program and the state water board review it.";

const shortId = (): string => Math.random().toString(36).substring(2, 8);

type ChatRequestBody = {
  id: string;
  messages: Array<{ id: string; role: string; parts: Array<unknown> }>;
};

/**
 * Persist a new chat the way the real POST /api/chat does before it streams
 * (chat row + the user and assistant messages), then hand the request on to
 * the stream mock registered before it. Lets a test reload a chat that was
 * started at `/chats/new` while the reply itself stays mocked. The real route
 * titles the chat with the model; here it gets `title`.
 */
const persistNewChatOnSend = async (
  page: Page,
  params: { userId: string; projectId: string; title: string },
): Promise<{ createdChatIds: string[] }> => {
  const createdChatIds: string[] = [];

  await page.route(
    (url) => url.pathname === "/api/chat",
    async (route) => {
      if (route.request().method() !== "POST") {
        await route.fallback();
        return;
      }

      const body = route.request().postDataJSON() as ChatRequestBody;
      const userMessage = body.messages.findLast((m) => m.role === "user");
      if (!userMessage) {
        throw new Error("POST /api/chat received no user message");
      }

      await saveChat({
        id: body.id,
        userId: params.userId,
        projectId: params.projectId,
        title: params.title,
        isInitial: false,
      });
      const now = Date.now();
      await saveMessages({
        messages: [
          {
            id: userMessage.id,
            chatId: body.id,
            role: "user",
            parts: userMessage.parts,
            attachments: [],
            createdAt: new Date(now),
          },
          {
            id: randomUUID(),
            chatId: body.id,
            role: "assistant",
            parts: [
              { type: "step-start" },
              { type: "text", text: ASSISTANT_REPLY },
            ],
            attachments: [],
            createdAt: new Date(now + 1),
          },
        ],
      });
      createdChatIds.push(body.id);

      await route.fallback();
    },
  );

  return { createdChatIds };
};

test.describe("Project chats", () => {
  test.setTimeout(60_000);

  let workspace: WorkspaceInfo;

  test.beforeAll(async () => {
    workspace = await getCitizenWorkspace();
  });

  /** A fresh project, so its chat list only holds this test's chats */
  const createProject = (label: string) =>
    createTestProjectInOffice({
      name: `Chats ${label} ${shortId()}`,
      officeId: workspace.officeId,
      createdBy: workspace.userId,
    });

  test("the sidebar lists the project's chats, newest first", async ({
    page,
  }) => {
    const marker = `Hydrology ${shortId()}`;
    const project = await createProject("List");
    const otherProject = await createProject("Other");

    const olderChat = await createTestProjectChat({
      userId: workspace.userId,
      projectId: project.id,
      title: `${marker} older`,
    });
    const newerChat = await createTestProjectChat({
      userId: workspace.userId,
      projectId: project.id,
      title: `${marker} newer`,
    });
    const otherProjectChat = await createTestProjectChat({
      userId: workspace.userId,
      projectId: otherProject.id,
      title: `${marker} other project`,
    });

    const chatPage = new TurboplanProjectChatPage(page);
    const sidebar = new OfficeFeaturesChatSidebar(page);
    await chatPage.goto({
      orgSlug: workspace.orgSlug,
      officeSlug: workspace.officeSlug,
      projectSlug: project.slug,
      chatId: olderChat.id,
    });
    await sidebar.expandChatList();

    await expect(sidebar.getChatLink(newerChat.title)).toBeVisible({
      timeout: 15000,
    });
    expect(await sidebar.getChatTitles(marker)).toEqual([
      newerChat.title,
      olderChat.title,
    ]);
    await expect(sidebar.getChatLink(otherProjectChat.title)).toHaveCount(0);

    // A sidebar link opens that chat.
    await sidebar.getChatLink(newerChat.title).click();
    await page.waitForURL(new RegExp(`/chats/${newerChat.id}$`));
    await chatPage.expectComposerReady();

    // The list is read back from the server after a reload.
    await page.reload();
    await sidebar.expandChatList();
    await expect(sidebar.getChatLink(olderChat.title)).toBeVisible({
      timeout: 15000,
    });
    expect(await sidebar.getChatTitles(marker)).toEqual([
      newerChat.title,
      olderChat.title,
    ]);
  });

  test("a project with no chats shows the empty chat list", async ({
    page,
  }) => {
    const project = await createProject("Empty");
    const sidebar = new OfficeFeaturesChatSidebar(page);

    await page.goto(
      `${appPaths.project(workspace.orgSlug, workspace.officeSlug, project.slug)}/members`,
    );
    await sidebar.expandChatList();

    await expect(page.getByText("No chats yet", { exact: true })).toBeVisible({
      timeout: 15000,
    });
  });

  test("starts a chat from the sidebar's New chat button at /chats/new", async ({
    page,
  }) => {
    const project = await createProject("New");
    // A non-initial chat, so /chats/new does not redirect to an initial
    // (research) chat and the New chat button is enabled.
    const existingChat = await createTestProjectChat({
      userId: workspace.userId,
      projectId: project.id,
      title: `Existing ${shortId()}`,
    });
    const newChatTitle = `Permits ${shortId()}`;

    // Registered first: the stream mock answers once the chat is persisted.
    await mockProjectChatApi(page, {
      chatId: "unused-chat-id",
      replyText: ASSISTANT_REPLY,
    });
    const { createdChatIds } = await persistNewChatOnSend(page, {
      userId: workspace.userId,
      projectId: project.id,
      title: newChatTitle,
    });

    const chatPage = new TurboplanProjectChatPage(page);
    const sidebar = new OfficeFeaturesChatSidebar(page);
    await chatPage.goto({
      orgSlug: workspace.orgSlug,
      officeSlug: workspace.officeSlug,
      projectSlug: project.slug,
      chatId: existingChat.id,
    });

    await sidebar.clickNewChat();
    await chatPage.expectComposerReady();
    await expect(page.getByTestId("message-user")).toHaveCount(0);

    await chatPage.sendMessage(USER_MESSAGE);
    await chatPage.expectExchange(USER_MESSAGE, ASSISTANT_REPLY);
    await chatPage.expectComposerReady();

    // The URL swaps to the id the client sent for the new chat.
    expect(createdChatIds).toHaveLength(1);
    const [newChatId] = createdChatIds;
    await expect(page).toHaveURL(new RegExp(`/chats/${newChatId}$`));

    // The finished reply refreshes the sidebar list with the saved chat.
    await sidebar.expandChatList();
    await expect(sidebar.getChatLink(newChatTitle)).toBeVisible({
      timeout: 15000,
    });

    // Persisted: the chat belongs to this project, and a reload of its URL
    // shows the exchange read back from the server (no messages mock).
    const savedChat = await getChatById({ id: newChatId });
    expect(savedChat?.projectId).toBe(project.id);
    expect(await getMessagesByChatId({ id: newChatId })).toHaveLength(2);

    await page.reload();
    await chatPage.expectExchange(USER_MESSAGE, ASSISTANT_REPLY);
    await sidebar.expandChatList();
    await expect(sidebar.getChatLink(newChatTitle)).toBeVisible({
      timeout: 15000,
    });
    await expect(sidebar.getChatLink(existingChat.title)).toBeVisible();
  });

  test("/chats/new does not create a chat until a message is sent", async ({
    page,
  }) => {
    const project = await createProject("Idle");
    await createTestProjectChat({
      userId: workspace.userId,
      projectId: project.id,
      title: `Seed ${shortId()}`,
    });

    const chatPage = new TurboplanProjectChatPage(page);
    const sidebar = new OfficeFeaturesChatSidebar(page);
    await sidebar.gotoNewChat({
      orgSlug: workspace.orgSlug,
      officeSlug: workspace.officeSlug,
      projectSlug: project.slug,
    });
    await chatPage.expectComposerReady();
    await expect(page).toHaveURL(/\/chats\/new$/);

    await page.reload();
    await chatPage.expectComposerReady();
    await sidebar.expandChatList();
    await expect(
      page.locator('a[href*="/chats/"]').filter({ hasText: /^Seed / }),
    ).toHaveCount(1, { timeout: 15000 });
    await expect(sidebar.getChatLink("New Chat")).toHaveCount(0);
  });
});
