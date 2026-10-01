import assert from "node:assert";
import { before, describe, it, mock } from "node:test";
import type { UIMessageStreamWriter } from "ai";
import type { Session } from "next-auth";

import type * as UpdateDocumentModule from "../lib/ai/tools/update-document";

const proposal = {
  id: "proposal-id",
  title: "Redwood — Proposal",
  kind: "text",
  content: "Proposal body",
  chatId: "chat-id",
  userId: "user-id",
  createdAt: new Date(),
};

mock.module("@wildfires-org/turboplan-ai", {
  namedExports: { getPrompt: async () => "Update a document." },
});
mock.module("@wildfires-org/turboplan-db/queries", {
  namedExports: {
    getDocumentById: async ({ id }: { id: string }) =>
      id === proposal.id ? proposal : undefined,
  },
});
mock.module("../lib/artifacts/server", {
  namedExports: {
    documentHandlers: [
      {
        kind: "text",
        onCreateDocument: async () => {},
        onUpdateDocument: async ({
          writer,
        }: {
          writer: UIMessageStreamWriter;
        }) => {
          writer.write({
            type: "data-artifact",
            transient: true,
            data: { type: "text-delta", content: "Revised body" },
          });
        },
      },
    ],
  },
});

// The turboplan app resolves as CJS, so import after the mocks are registered.
let updateDocumentModule: typeof UpdateDocumentModule;

before(async () => {
  updateDocumentModule = await import("../lib/ai/tools/update-document");
});

const runUpdate = async (id: string) => {
  const parts: Array<{ type: string; content: unknown }> = [];
  const writer = {
    write: (part: { data: { type: string; content: unknown } }) => {
      parts.push(part.data);
    },
  } as unknown as UIMessageStreamWriter;

  const updateTool = await updateDocumentModule.updateDocument({
    session: { user: { id: "user-id" } } as Session,
    writer,
  });
  const result = await updateTool.execute?.(
    { id, description: "Fix the date" },
    { toolCallId: "call-1", messages: [] },
  );

  return { parts, result };
};

describe("updateDocument tool", () => {
  it("points the artifact panel at the updated document before streaming", async () => {
    const { parts } = await runUpdate(proposal.id);

    assert.deepStrictEqual(
      parts.map((part) => part.type),
      ["kind", "id", "title", "clear", "text-delta", "finish"],
    );
    assert.strictEqual(parts[0]?.content, "text");
    assert.strictEqual(parts[1]?.content, proposal.id);
    assert.strictEqual(parts[2]?.content, proposal.title);
  });

  it("writes nothing to the stream when the document does not exist", async () => {
    const { parts, result } = await runUpdate("missing-id");

    assert.deepStrictEqual(parts, []);
    assert.deepStrictEqual(result, { error: "Document not found" });
  });
});
