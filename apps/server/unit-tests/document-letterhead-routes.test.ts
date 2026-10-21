import assert from "node:assert/strict";
import { beforeEach, describe, it, mock } from "node:test";
import { Hono } from "hono";

import type {
  DocumentLetterhead,
  GridLetterhead,
} from "@wildfires-org/turboplan-workspace/types";

// Route-level tests of GET /letterhead and GET /letterhead-logo: the
// workspace resolution and the RBAC guard are stubbed, the payload mapping
// (`toPublicDocumentLetterhead`, `buildLetterheadMarkdown`) is the real one.

const PROJECT_ID = "6f9619ff-8b86-4d01-b42d-00cf4fc964ff";
const DOCUMENT_ID = "0a7c9d2e-1111-4c3b-8d2e-3f4a5b6c7d8e";
const STORAGE_HOST = "files.example.test";

// Stored grids hold R2 object keys; no payload may carry one.
const grid = (logoKey: string): GridLetterhead => ({
  cells: [
    { kind: "logo", x: 0, width: 0.15, height: 0.15, key: logoKey },
    {
      kind: "text",
      x: 0.2,
      width: 0.6,
      align: "left",
      lines: [{ text: "Bureau of Land Management", bold: true, size: "large" }],
    },
  ],
  color: "#1f5f3a",
});

const gridLetterhead = (logoKey: string): DocumentLetterhead => ({
  layout: "grid",
  grid: grid(logoKey),
  nameLines: ["Bureau of Land Management"],
  contactLines: [],
  color: "#1f5f3a",
});

const legacyLetterhead: DocumentLetterhead = {
  layout: "split",
  nameLines: ["Example Ranger District"],
  contactLines: ["1 Main St"],
  color: null,
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

type Overview = {
  letterhead: DocumentLetterhead | null;
  selection: string;
  defaultLetterhead: DocumentLetterhead | null;
  options: { id: string; name: string }[];
  own: { referenceFilename: string; version: string } | null;
};
let overview: Overview;
let logo: { data: Uint8Array; contentType: string } | null;

const getDocumentLetterheadOverview = mock.fn(
  async (_projectId: string, _documentId?: string) => {
    events.push("overview");
    return overview;
  },
);
const resolveDocumentLetterheadLogo = mock.fn(
  async (
    _projectId: string,
    _documentId: string | undefined,
    _index: number,
  ) => {
    events.push("logo");
    return logo;
  },
);
const unexpected = async () => {
  throw new Error("not used by these routes");
};

mock.module("@wildfires-org/turboplan-workspace/server", {
  namedExports: {
    appendOfficeDocumentProfileFact: unexpected,
    editDocumentOwnLetterhead: unexpected,
    getDocumentLetterheadOverview,
    getProjectById: unexpected,
    getProjectDocumentBranding: unexpected,
    getProjectDocumentProfile: unexpected,
    getProjectFooter: unexpected,
    resolveDocumentLetterheadLogo,
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

const get = (path: string) => app.request(`/api/documents${path}`);

beforeEach(() => {
  events.length = 0;
  isAllowed = true;
  overview = {
    letterhead: null,
    selection: "default",
    defaultLetterhead: null,
    options: [],
    own: null,
  };
  logo = null;
  getDocumentLetterheadOverview.mock.resetCalls();
  resolveDocumentLetterheadLogo.mock.resetCalls();
});

describe("GET /api/documents/letterhead", () => {
  it("sends a selected grid copy and a grid default without any storage URL", async () => {
    overview = {
      letterhead: gridLetterhead("letterheads/project/d/logo-0-ab.png"),
      selection: "own",
      defaultLetterhead: gridLetterhead("letterheads/project/o/logo-0-cd.png"),
      options: [],
      own: {
        referenceFilename: "blm-letter.pdf",
        version: "2026-10-20T10:00:00.123Z",
      },
    };

    const res = await get(
      `/letterhead?projectId=${PROJECT_ID}&documentId=${DOCUMENT_ID}`,
    );
    const text = await res.text();

    assert.equal(res.status, 200);
    assert.equal(text.includes(STORAGE_HOST), false);
    assert.equal(text.includes("letterheads/"), false);
    assert.equal(text.includes('"key"'), false);
    const body = JSON.parse(text);
    assert.equal(body.markdown, null);
    assert.equal(body.selection, "own");
    assert.deepEqual(body.own, {
      referenceFilename: "blm-letter.pdf",
      version: "2026-10-20T10:00:00.123Z",
    });
    for (const letterhead of [body.letterhead, body.defaultLetterhead]) {
      assert.equal(letterhead.layout, "grid");
      assert.deepEqual(letterhead.grid.cells[0], {
        kind: "logo",
        x: 0,
        width: 0.15,
        height: 0.15,
        index: 0,
      });
    }
    assert.deepEqual(getDocumentLetterheadOverview.mock.calls[0].arguments, [
      PROJECT_ID,
      DOCUMENT_ID,
    ]);
  });

  it("keeps the markdown table of a legacy letterhead", async () => {
    overview = {
      ...overview,
      letterhead: legacyLetterhead,
      defaultLetterhead: legacyLetterhead,
    };

    const body = await (
      await get(`/letterhead?projectId=${PROJECT_ID}`)
    ).json();

    assert.deepEqual(body.letterhead, legacyLetterhead);
    assert.match(body.markdown, /Example Ranger District/);
  });

  it("checks project READ before resolving anything", async () => {
    isAllowed = false;

    const res = await get(
      `/letterhead?projectId=${PROJECT_ID}&documentId=${DOCUMENT_ID}`,
    );

    assert.equal(res.status, 403);
    assert.deepEqual(events, [`rbac:project:read:${PROJECT_ID}`]);
  });

  it("refuses a malformed documentId", async () => {
    const res = await get(`/letterhead?projectId=${PROJECT_ID}&documentId=x`);

    assert.equal(res.status, 400);
    assert.equal(getDocumentLetterheadOverview.mock.callCount(), 0);
  });
});

describe("GET /api/documents/letterhead-logo", () => {
  it("checks project READ before resolving the logo", async () => {
    logo = { data: new Uint8Array([1]), contentType: "image/png" };

    await get(`/letterhead-logo?projectId=${PROJECT_ID}`);
    assert.deepEqual(events, [`rbac:project:read:${PROJECT_ID}`, "logo"]);

    events.length = 0;
    isAllowed = false;
    const res = await get(`/letterhead-logo?projectId=${PROJECT_ID}&index=1`);

    assert.equal(res.status, 403);
    assert.deepEqual(events, [`rbac:project:read:${PROJECT_ID}`]);
  });

  it("serves the logo of the requested index", async () => {
    logo = {
      data: new Uint8Array([137, 80, 78, 71]),
      contentType: "image/png",
    };

    const res = await get(
      `/letterhead-logo?projectId=${PROJECT_ID}&documentId=${DOCUMENT_ID}&index=1`,
    );

    assert.equal(res.status, 200);
    assert.equal(res.headers.get("content-type"), "image/png");
    assert.deepEqual(
      new Uint8Array(await res.arrayBuffer()),
      new Uint8Array([137, 80, 78, 71]),
    );
    assert.deepEqual(resolveDocumentLetterheadLogo.mock.calls[0].arguments, [
      PROJECT_ID,
      DOCUMENT_ID,
      1,
    ]);
  });

  it("asks for index 0 without an index and answers 204 without a logo", async () => {
    const res = await get(`/letterhead-logo?projectId=${PROJECT_ID}`);

    assert.equal(res.status, 204);
    assert.deepEqual(resolveDocumentLetterheadLogo.mock.calls[0].arguments, [
      PROJECT_ID,
      undefined,
      0,
    ]);
  });

  it("refuses an index past the last logo a grid can have, before RBAC", async () => {
    const res = await get(`/letterhead-logo?projectId=${PROJECT_ID}&index=2`);

    assert.equal(res.status, 400);
    assert.deepEqual(events, []);
  });
});
