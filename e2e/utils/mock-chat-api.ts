import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";

/** Row shape returned by GET /api/chat/[chatId]/messages (`DBMessage`, JSON-serialized). */
type MockDbMessage = {
  id: string;
  chatId: string;
  role: "user" | "assistant";
  parts: Array<unknown>;
  attachments: Array<unknown>;
  createdAt: string;
};

type ChatRequestBody = {
  id: string;
  messages: Array<{ id: string; role: string; parts: Array<unknown> }>;
};

/**
 * Headers `createUIMessageStreamResponse` sends (ai@6 `UI_MESSAGE_STREAM_HEADERS`).
 * `connection: keep-alive` is left out: hop-by-hop, meaningless for a
 * fulfilled route.
 */
const UI_MESSAGE_STREAM_HEADERS = {
  "content-type": "text/event-stream",
  "cache-control": "no-cache",
  "x-vercel-ai-ui-message-stream": "v1",
  "x-accel-buffering": "no",
};

/**
 * Encode a single-text-part assistant reply as an ai@6 UI message stream:
 * one `data: <json chunk>` SSE event per chunk, terminated by `data: [DONE]`.
 * Chunk shapes follow ai@6 `uiMessageChunkSchema` (strict objects, so no
 * extra fields), ending with a bare `finish` like app/api/chat/route.ts does.
 */
/** A text document the mocked reply streams into the artifact panel. */
type MockArtifact = { title: string; content: string };

/**
 * The transient `data-artifact` chunks `createDocument` writes while streaming
 * a text document: kind, id, title, clear, the text, then finish.
 */
const buildArtifactChunks = ({ title, content }: MockArtifact) =>
  [
    { type: "kind", content: "text" },
    { type: "id", content: randomUUID() },
    { type: "title", content: title },
    { type: "clear", content: "" },
    { type: "text-delta", content },
    { type: "finish", content: "" },
  ].map((data) => ({ type: "data-artifact", data, transient: true }));

const buildTextReplyStream = (
  messageId: string,
  text: string,
  artifact?: MockArtifact,
): string => {
  const textPartId = "text-0";
  const chunks = [
    { type: "start", messageId },
    { type: "start-step" },
    ...(artifact ? buildArtifactChunks(artifact) : []),
    { type: "text-start", id: textPartId },
    { type: "text-delta", id: textPartId, delta: text },
    { type: "text-end", id: textPartId },
    { type: "finish-step" },
    { type: "finish" },
  ];

  return `${chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("")}data: [DONE]\n\n`;
};

/**
 * Mock the project chat network for one chat so no model is ever called:
 *
 * - `POST /api/chat` answers every send with `replyText` as a UI message stream,
 *   preceded by a streamed text document when `artifact` is given.
 * - `GET /api/chat/[chatId]/messages` is stateful like the real server: `[]`
 *   until a mocked POST completes, then the persisted user + assistant rows.
 *
 * The rows are recorded before the stream is fulfilled, mirroring the real
 * route, whose `onFinish` persistence is awaited before the stream closes.
 */
export const mockProjectChatApi = async (
  page: Page,
  {
    chatId,
    replyText,
    artifact,
  }: { chatId: string; replyText: string; artifact?: MockArtifact },
): Promise<void> => {
  const persistedMessages = new Map<string, MockDbMessage>();

  await page.route(
    (url) => url.pathname === "/api/chat",
    async (route) => {
      const request = route.request();
      if (request.method() !== "POST") {
        await route.fallback();
        return;
      }

      const body = request.postDataJSON() as ChatRequestBody;
      const userMessage = body.messages.findLast((m) => m.role === "user");
      if (!userMessage) {
        throw new Error("Mocked POST /api/chat received no user message");
      }

      const assistantMessageId = randomUUID();
      const now = Date.now();
      persistedMessages.set(userMessage.id, {
        id: userMessage.id,
        chatId,
        role: "user",
        parts: userMessage.parts,
        attachments: [],
        createdAt: new Date(now).toISOString(),
      });
      persistedMessages.set(assistantMessageId, {
        id: assistantMessageId,
        chatId,
        role: "assistant",
        // What the real route stores for this stream (`responseMessage.parts`).
        parts: [{ type: "step-start" }, { type: "text", text: replyText }],
        attachments: [],
        createdAt: new Date(now + 1).toISOString(),
      });

      await route.fulfill({
        status: 200,
        headers: UI_MESSAGE_STREAM_HEADERS,
        body: buildTextReplyStream(assistantMessageId, replyText, artifact),
      });
    },
  );

  await page.route(`**/api/chat/${chatId}/messages`, async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }

    await route.fulfill({ json: [...persistedMessages.values()] });
  });
};
