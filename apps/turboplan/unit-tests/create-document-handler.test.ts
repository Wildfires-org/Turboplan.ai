import assert from "node:assert/strict";
import { before, beforeEach, describe, it, mock } from "node:test";
import type { UIMessageStreamWriter } from "ai";
import type { Session } from "next-auth";

import type * as ArtifactsServerModule from "../lib/artifacts/server";

type DbCall = { op: "insert" | "update"; content: string; createdAt?: Date };

const dbCalls: DbCall[] = [];

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
    },
    updateDocumentVersionContent: async ({
      content,
      createdAt,
    }: {
      content: string;
      createdAt: Date;
    }) => {
      dbCalls.push({ op: "update", content, createdAt });
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
});

const createArgs = (userId?: string) => ({
  id: "doc-id",
  title: "RFP",
  writer: {} as UIMessageStreamWriter,
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
  });
});
