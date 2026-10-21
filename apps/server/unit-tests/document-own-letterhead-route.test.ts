import assert from "node:assert/strict";
import { beforeEach, describe, it, mock } from "node:test";
import { Hono } from "hono";

import type {
  DocumentLetterhead,
  GridLetterheadEdit,
} from "@wildfires-org/turboplan-workspace/types";

// Route-level tests of PUT /:documentId/letterhead/own: the workspace edit
// and the RBAC guard are stubbed, the request schema and the payload mapping
// (`toPublicDocumentLetterhead`) are the real ones.

const PROJECT_ID = "6f9619ff-8b86-4d01-b42d-00cf4fc964ff";
const DOCUMENT_ID = "0a7c9d2e-1111-4c3b-8d2e-3f4a5b6c7d8e";
// Stored grids hold R2 object keys; no payload may carry one.
const STORED_LOGO = "letterheads/project/d/logo-0-ab.png";
// The copy's version when the editor opened, and once saved.
const VERSION = "2026-10-20T10:00:00.123Z";
const SAVED_VERSION = "2026-10-20T10:05:00.456Z";

const edit: GridLetterheadEdit = {
  cells: [
    { kind: "logo", x: 0, width: 0.15, height: 0.15, index: 0 },
    {
      kind: "text",
      x: 0.2,
      width: 0.8,
      align: "left",
      lines: [{ text: "Bureau of Land Management", bold: true, size: "large" }],
    },
  ],
  color: "#1f5f3a",
};

const savedLetterhead: DocumentLetterhead = {
  layout: "grid",
  grid: {
    cells: [
      { kind: "logo", x: 0, width: 0.15, height: 0.15, key: STORED_LOGO },
      {
        kind: "text",
        x: 0.2,
        width: 0.8,
        align: "left",
        lines: [
          { text: "Bureau of Land Management", bold: true, size: "large" },
        ],
      },
    ],
    color: "#1f5f3a",
  },
  nameLines: ["Bureau of Land Management"],
  contactLines: [],
  color: "#1f5f3a",
};

// Which permission checks ran, in order with the workspace calls.
const events: string[] = [];
let isAllowed = true;

mock.module("@wildfires-org/turboplan-rbac/hono", {
  namedExports: {
    NO_PERMISSION_REASON: "No permission found",
    requirePermission:
      (
        entityType: string,
        action: string,
        getEntityId: (c: unknown) => string | null,
      ) =>
      async (
        c: { json: (body: unknown, status: number) => Response },
        next: () => Promise<void>,
      ) => {
        events.push(`rbac:${entityType}:${action}:${getEntityId(c)}`);
        if (!isAllowed) {
          return c.json(
            { error: "Forbidden", reason: "No permission found" },
            403,
          );
        }
        await next();
      },
  },
});

type EditResult =
  | { ok: true; letterhead: DocumentLetterhead; version: string }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "conflict" }
  | { ok: false; reason: "invalid"; field: string; message: string };
let result: EditResult;
let editError: Error | null = null;

const editDocumentOwnLetterhead = mock.fn(
  async (_args: {
    projectId: string;
    documentId: string;
    version: string;
    edit: GridLetterheadEdit;
    userId: string;
  }) => {
    events.push("edit");
    if (editError) {
      throw editError;
    }
    return result;
  },
);
const unexpected = async () => {
  throw new Error("not used by this route");
};

mock.module("@wildfires-org/turboplan-workspace/server", {
  namedExports: {
    appendOfficeDocumentProfileFact: unexpected,
    editDocumentOwnLetterhead,
    getDocumentLetterheadOverview: unexpected,
    getProjectById: unexpected,
    getProjectDocumentBranding: unexpected,
    getProjectDocumentProfile: unexpected,
    getProjectFooter: unexpected,
    resolveDocumentLetterheadLogo: unexpected,
    setDocumentLetterheadSelection: unexpected,
  },
});
mock.module("@wildfires-org/turboplan-signing/pdf", {
  namedExports: { generatePdfFromMarkdown: unexpected },
});
const { documentExportRouter } = await import(
  "../src/routes/document-export.js"
);

const app = new Hono();
app.use("*", async (c, next) => {
  c.set("user" as never, { userId: "user-1" } as never);
  await next();
});
app.route("/api/documents", documentExportRouter);

const put = (body: unknown, documentId = DOCUMENT_ID) =>
  app.request(`/api/documents/${documentId}/letterhead/own`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

beforeEach(() => {
  events.length = 0;
  isAllowed = true;
  editError = null;
  result = { ok: true, letterhead: savedLetterhead, version: SAVED_VERSION };
  editDocumentOwnLetterhead.mock.resetCalls();
});

describe("PUT /api/documents/:documentId/letterhead/own", () => {
  it("saves the edit and answers the public letterhead, without storage keys", async () => {
    const res = await put({
      projectId: PROJECT_ID,
      version: VERSION,
      grid: edit,
    });
    const text = await res.text();

    assert.equal(res.status, 200);
    assert.equal(text.includes(STORED_LOGO), false);
    assert.equal(text.includes('"key"'), false);
    const body = JSON.parse(text);
    assert.equal(body.letterhead.layout, "grid");
    assert.deepEqual(body.letterhead.grid.cells[0], {
      kind: "logo",
      x: 0,
      width: 0.15,
      height: 0.15,
      index: 0,
    });
    assert.equal(body.version, SAVED_VERSION);
    assert.deepEqual(editDocumentOwnLetterhead.mock.calls[0].arguments, [
      {
        projectId: PROJECT_ID,
        documentId: DOCUMENT_ID,
        version: VERSION,
        edit,
        userId: "user-1",
      },
    ]);
  });

  it("checks project UPDATE before editing anything", async () => {
    await put({ projectId: PROJECT_ID, version: VERSION, grid: edit });
    assert.deepEqual(events, [`rbac:project:update:${PROJECT_ID}`, "edit"]);

    events.length = 0;
    isAllowed = false;
    const res = await put({
      projectId: PROJECT_ID,
      version: VERSION,
      grid: edit,
    });

    assert.equal(res.status, 403);
    assert.deepEqual(events, [`rbac:project:update:${PROJECT_ID}`]);
  });

  it("answers the selection route's 404 for a document without a copy", async () => {
    result = { ok: false, reason: "not_found" };

    const res = await put({
      projectId: PROJECT_ID,
      version: VERSION,
      grid: edit,
    });

    assert.equal(res.status, 404);
    assert.deepEqual(await res.json(), {
      error: "Document or letterhead not found",
    });
  });

  it("answers 409 when the copy changed since the editor opened", async () => {
    result = { ok: false, reason: "conflict" };

    const res = await put({
      projectId: PROJECT_ID,
      version: VERSION,
      grid: edit,
    });

    assert.equal(res.status, 409);
    assert.deepEqual(await res.json(), {
      error: "The letterhead was changed meanwhile — reopen the editor",
    });
  });

  it("answers 500 without details when the edit throws", async () => {
    editError = new Error("connection reset: postgres://secret@db");
    const logged = mock.method(console, "error", () => {});

    try {
      const res = await put({
        projectId: PROJECT_ID,
        version: VERSION,
        grid: edit,
      });

      assert.equal(res.status, 500);
      assert.deepEqual(await res.json(), {
        error: "Failed to update letterhead",
      });
      assert.equal(logged.mock.callCount(), 1);
    } finally {
      logged.mock.restore();
    }
  });

  it("answers 400 naming the field of an invalid edit", async () => {
    result = {
      ok: false,
      reason: "invalid",
      field: "cells.0.url",
      message: "Column 1: upload the logo again",
    };

    const res = await put({
      projectId: PROJECT_ID,
      version: VERSION,
      grid: edit,
    });

    assert.equal(res.status, 400);
    assert.deepEqual(await res.json(), {
      error: "Column 1: upload the logo again",
      field: "cells.0.url",
    });
  });

  it("refuses a malformed request before RBAC", async () => {
    for (const [body, documentId] of [
      [{ projectId: PROJECT_ID, version: VERSION, grid: edit }, "not-a-uuid"],
      ["not json", DOCUMENT_ID],
      [{ version: VERSION, grid: edit }, DOCUMENT_ID],
      [{ projectId: "nope", version: VERSION, grid: edit }, DOCUMENT_ID],
      [{ projectId: PROJECT_ID, version: VERSION }, DOCUMENT_ID],
      // The version is required, and an ISO timestamp.
      [{ projectId: PROJECT_ID, grid: edit }, DOCUMENT_ID],
      [{ projectId: PROJECT_ID, version: "v1", grid: edit }, DOCUMENT_ID],
      [
        {
          projectId: PROJECT_ID,
          version: VERSION,
          grid: { cells: "x", color: null },
        },
        DOCUMENT_ID,
      ],
      [
        {
          projectId: PROJECT_ID,
          version: VERSION,
          grid: {
            cells: [
              {
                kind: "logo",
                x: 0,
                width: 0.1,
                height: 0.1,
                index: 0,
                url: "u",
              },
            ],
            color: null,
          },
        },
        DOCUMENT_ID,
      ],
    ] as const) {
      const res = await put(body, documentId);
      assert.equal(res.status, 400, JSON.stringify(body));
    }

    assert.deepEqual(events, []);
  });
});
