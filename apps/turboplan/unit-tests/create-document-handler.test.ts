import assert from "node:assert/strict";
import { before, beforeEach, describe, it, mock } from "node:test";
import type { UIMessageStreamWriter } from "ai";
import type { Session } from "next-auth";

import type * as ArtifactsServerModule from "../lib/artifacts/server";

type DbCall = { op: "insert" | "update"; content: string; createdAt?: Date };

const dbCalls: DbCall[] = [];
// Stream writes, interleaved with the DB calls to show their order.
const events: string[] = [];

mock.module("@wildfires-org/turboplan-db/queries", {
  namedExports: {
    saveDocument: async ({
      content,
      createdAt,
    }: {
      content: string;
      createdAt?: Date;
    }) => {
      dbCalls.push({ op: "insert", content, createdAt });
      events.push("insert");
    },
    updateDocumentVersionContent: async ({
      content,
      createdAt,
    }: {
      content: string;
      createdAt: Date;
    }) => {
      dbCalls.push({ op: "update", content, createdAt });
      events.push("update");
    },
  },
});
mock.module("@wildfires-org/turboplan-feature-flags", {
  namedExports: {
    isMapPackageEnabled: () => false,
    isTasksPackageEnabled: () => false,
  },
});
mock.module("@wildfires-org/turboplan-map/server", {
  namedExports: { mapDocumentHandler: {} },
});
mock.module("@wildfires-org/turboplan-tasks/artifact/server", {
  namedExports: { taskDocumentHandler: {} },
});
mock.module("../artifacts/text/server", {
  namedExports: { textDocumentHandler: {} },
});

// The turboplan app resolves as CJS, so import after the mocks are registered.
let artifactsServer: typeof ArtifactsServerModule;

before(async () => {
  artifactsServer = await import("../lib/artifacts/server");
});

beforeEach(() => {
  dbCalls.length = 0;
  events.length = 0;
});

const recordingWriter = {
  write: (part: { type: string; data?: { type: string; content: string } }) => {
    events.push(`${part.type}:${part.data?.type}:${part.data?.content}`);
  },
} as unknown as UIMessageStreamWriter;

const createArgs = (userId?: string) => ({
  id: "doc-id",
  title: "RFP",
  writer: recordingWriter,
  session: { user: userId ? { id: userId } : undefined } as Session,
});

describe("createDocumentHandler.onCreateDocument", () => {
  it("inserts one version, then updates that same row with the final draft", async () => {
    mock.timers.enable({ apis: ["Date"] });
    try {
      const handler = artifactsServer.createDocumentHandler({
        kind: "text",
        onCreateDocument: async ({ onDraftProgress }) => {
          mock.timers.tick(5_000);
          onDraftProgress?.("Partial");
          // Let the checkpoint land before the next one is offered.
          await new Promise((resolve) => setImmediate(resolve));
          mock.timers.tick(5_000);
          onDraftProgress?.("Partial draft");
          return "Partial draft, finished";
        },
        onUpdateDocument: async () => "",
      });

      await handler.onCreateDocument(createArgs("user-id"));
    } finally {
      mock.timers.reset();
    }

    assert.deepEqual(
      dbCalls.map(({ op, content }) => ({ op, content })),
      [
        { op: "insert", content: "Partial" },
        { op: "update", content: "Partial draft" },
        { op: "update", content: "Partial draft, finished" },
      ],
    );
    const [insert, ...updates] = dbCalls;
    for (const update of updates) {
      assert.equal(update.createdAt, insert?.createdAt);
    }
    // The client hears once, right after the insert, that the document exists.
    assert.deepEqual(events, [
      "insert",
      "data-artifact:saved:doc-id",
      "update",
      "update",
    ]);
  });

  it("inserts the final draft when no checkpoint was saved", async () => {
    const handler = artifactsServer.createDocumentHandler({
      kind: "text",
      onCreateDocument: async () => "Short draft",
      onUpdateDocument: async () => "",
    });

    await handler.onCreateDocument(createArgs("user-id"));

    assert.deepEqual(
      dbCalls.map(({ op, content }) => ({ op, content })),
      [{ op: "insert", content: "Short draft" }],
    );
    assert.deepEqual(events, ["insert", "data-artifact:saved:doc-id"]);
  });

  it("saves nothing without a signed-in user", async () => {
    let progress: ((content: string) => void) | undefined;
    const handler = artifactsServer.createDocumentHandler({
      kind: "text",
      onCreateDocument: async ({ onDraftProgress }) => {
        progress = onDraftProgress;
        return "Draft";
      },
      onUpdateDocument: async () => "",
    });

    await handler.onCreateDocument(createArgs());

    assert.equal(progress, undefined);
    assert.deepEqual(dbCalls, []);
    assert.deepEqual(events, []);
  });
});
