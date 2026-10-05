import assert from "node:assert";
import { before, beforeEach, describe, it, mock } from "node:test";

import type { OrganizationDocumentListItem } from "@wildfires-org/turboplan-db/queries";

import type * as ReadOrganizationDocumentsModule from "../lib/ai/tools/read-organization-documents";

const ORGANIZATION_ID = "org-1";

let isReadAllowed = true;
let listedDocuments: OrganizationDocumentListItem[] = [];
const listCalls: string[] = [];
const textCalls: Array<{ organizationId: string; ids: string[] }> = [];

mock.module("@wildfires-org/turboplan-ai", {
  namedExports: { getPrompt: async () => "Read organization documents." },
});
mock.module("@wildfires-org/turboplan-db/queries", {
  namedExports: {
    listOrganizationDocuments: async (organizationId: string) => {
      listCalls.push(organizationId);
      return listedDocuments;
    },
    getOrganizationDocumentTextsByIds: async (
      organizationId: string,
      ids: string[],
    ) => {
      textCalls.push({ organizationId, ids });
      return [];
    },
  },
});
mock.module("@wildfires-org/turboplan-rbac/server", {
  namedExports: {
    getRBACService: () => ({
      checkPermission: async () => ({ allowed: isReadAllowed }),
    }),
  },
});

// The turboplan app resolves as CJS, so import after the mocks are registered.
let toolModule: typeof ReadOrganizationDocumentsModule;

before(async () => {
  toolModule = await import("../lib/ai/tools/read-organization-documents");
});

const docId = (index: number): string =>
  `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;

const makeDocument = (
  index: number,
  overrides: Partial<OrganizationDocumentListItem> = {},
): OrganizationDocumentListItem => ({
  id: docId(index),
  organizationId: ORGANIZATION_ID,
  filename: `stored-${index}.pdf`,
  originalFilename: `doc-${index}.pdf`,
  mimeType: "application/pdf",
  size: 1000,
  url: `https://files.example.test/stored-${index}.pdf`,
  uploadedBy: "user-1",
  isPinned: false,
  extractionStatus: "done",
  extractionError: null,
  extractedAt: null,
  summary: `- Fact ${index}\n- Second fact`,
  summarizedAt: null,
  createdAt: new Date("2026-10-01T00:00:00Z"),
  updatedAt: new Date("2026-10-01T00:00:00Z"),
  ...overrides,
});

type ListedDocument = {
  id: string;
  filename: string;
  isPinned: boolean;
  status: string;
  summary: string | null;
};

type ListResult = {
  documents?: ListedDocument[];
  totalDocuments?: number;
  error?: string;
};

const run = async (input: { documentIds?: string[] }): Promise<ListResult> => {
  const readTool = await toolModule.readOrganizationDocuments({
    organizationId: ORGANIZATION_ID,
    userId: "user-1",
  });
  return (await readTool.execute?.(input, {
    toolCallId: "call-1",
    messages: [],
  })) as ListResult;
};

describe("readOrganizationDocuments list mode", () => {
  beforeEach(() => {
    isReadAllowed = true;
    listedDocuments = [];
    listCalls.length = 0;
    textCalls.length = 0;
  });

  it("lists every document of the bound organization when no ids are given", async () => {
    // Newest first, as `listOrganizationDocuments` returns them.
    listedDocuments = [
      makeDocument(1),
      makeDocument(2, { isPinned: true }),
      makeDocument(3, { extractionStatus: "pending", summary: null }),
      makeDocument(4, { extractionStatus: "failed", summary: null }),
    ];

    for (const input of [{}, { documentIds: [] }]) {
      const result = await run(input);
      assert.strictEqual(result.totalDocuments, 4);
      assert.deepStrictEqual(result.documents, [
        {
          id: docId(2),
          filename: "doc-2.pdf",
          isPinned: true,
          status: "done",
          summary: "Fact 2",
        },
        {
          id: docId(1),
          filename: "doc-1.pdf",
          isPinned: false,
          status: "done",
          summary: "Fact 1",
        },
        {
          id: docId(3),
          filename: "doc-3.pdf",
          isPinned: false,
          status: "pending",
          summary: null,
        },
        {
          id: docId(4),
          filename: "doc-4.pdf",
          isPinned: false,
          status: "failed",
          summary: null,
        },
      ]);
    }
    assert.deepStrictEqual(listCalls, [ORGANIZATION_ID, ORGANIZATION_ID]);
    assert.deepStrictEqual(textCalls, []);
  });

  it("previews only the first summary line, capped", async () => {
    listedDocuments = [
      makeDocument(1, { summary: `\n\n-   ${"word ".repeat(60)}\n- next` }),
    ];

    const [document] = (await run({})).documents ?? [];
    assert.ok(document?.summary);
    assert.ok(document.summary.length <= 120);
    assert.ok(document.summary.startsWith("word word"));
    assert.ok(document.summary.endsWith("…"));
    assert.ok(!document.summary.includes("next"));
  });

  it("keeps 100 documents small, previews pinned and newest first", async () => {
    listedDocuments = Array.from({ length: 100 }, (_, index) =>
      makeDocument(index, {
        isPinned: index >= 97,
        originalFilename: `Organization reference document number ${index}.docx`,
        summary: `- ${"fact ".repeat(40)}\n- more`,
      }),
    );

    const result = await run({});
    assert.strictEqual(result.totalDocuments, 100);
    assert.strictEqual(result.documents?.length, 100);
    assert.ok(JSON.stringify(result).length <= 20_100);

    const documents = result.documents ?? [];
    assert.deepStrictEqual(
      documents.slice(0, 3).map((document) => document.id),
      [docId(97), docId(98), docId(99)],
    );
    // Previews stop at the budget: a prefix has them, the rest is null.
    const previewed = documents.filter((document) => document.summary);
    assert.ok(previewed.length > 3);
    assert.ok(previewed.length < 100);
    assert.deepStrictEqual(previewed, documents.slice(0, previewed.length));
  });

  it("re-checks READ before listing", async () => {
    isReadAllowed = false;
    listedDocuments = [makeDocument(1)];

    assert.deepStrictEqual(await run({}), { error: "Access denied." });
    assert.deepStrictEqual(listCalls, []);
  });

  it("still reads by id when ids are given", async () => {
    const result = await run({ documentIds: [docId(1)] });

    assert.deepStrictEqual(textCalls, [
      { organizationId: ORGANIZATION_ID, ids: [docId(1)] },
    ]);
    assert.deepStrictEqual(listCalls, []);
    assert.deepStrictEqual(result, {
      documents: [],
      skipped: [{ id: docId(1), reason: "not-found" }],
      totalDocuments: 0,
    });
  });
});
