import assert from "node:assert/strict";
import { beforeEach, describe, it, mock } from "node:test";

const PROJECT_ID = "0a7c9d2e-1111-4c3b-8d2e-3f4a5b6c7d8e";
const DOCUMENT_ID = "6f1c2a8e-4b1d-4a63-9a5e-1f0f5b6c7d8e";
const USER_ID = "3b2a1c0d-9e8f-4a7b-8c6d-5e4f3a2b1c0d";

const COPY = {
  letterhead: {
    cells: [
      {
        kind: "text",
        x: 0,
        width: 1,
        align: "left",
        lines: [
          { text: "Bureau of Land Management", bold: true, size: "large" },
        ],
      },
    ],
    color: null,
  },
  referenceFilename: "blm-letter.pdf",
  updatedAt: new Date("2026-10-20T10:00:00.000Z"),
};

// The real query module, with the selection's reads and writes stubbed.
const actualQueries = await import("@wildfires-org/turboplan-db/queries");
let ownRow: {
  letterhead: unknown;
  referenceFilename: string;
  updatedAt: Date;
} | null = null;
const getProjectIdByDocumentId = mock.fn(async () => PROJECT_ID);
const getDocumentOwnLetterhead = mock.fn(async () => ownRow);
const upsertDocumentLetterheadSelection = mock.fn(async () => {});
const deleteDocumentLetterheadSelection = mock.fn(async () => {});

mock.module("@wildfires-org/turboplan-db/queries", {
  namedExports: {
    ...actualQueries,
    getProjectIdByDocumentId,
    getDocumentOwnLetterhead,
    upsertDocumentLetterheadSelection,
    deleteDocumentLetterheadSelection,
  },
});

const { setDocumentLetterheadSelection } = await import(
  "../src/server/projects/queries"
);

const selectOwn = () =>
  setDocumentLetterheadSelection({
    projectId: PROJECT_ID,
    documentId: DOCUMENT_ID,
    selection: "own",
    userId: USER_ID,
  });

beforeEach(() => {
  ownRow = null;
  for (const fn of [
    getProjectIdByDocumentId,
    getDocumentOwnLetterhead,
    upsertDocumentLetterheadSelection,
    deleteDocumentLetterheadSelection,
  ]) {
    fn.mock.resetCalls();
  }
});

describe("setDocumentLetterheadSelection('own')", () => {
  it("refuses a document without its own copy and writes nothing", async () => {
    assert.deepEqual(await selectOwn(), { ok: false, reason: "letterhead" });
    assert.deepEqual(getDocumentOwnLetterhead.mock.calls[0].arguments, [
      DOCUMENT_ID,
    ]);
    assert.equal(upsertDocumentLetterheadSelection.mock.callCount(), 0);
    assert.equal(deleteDocumentLetterheadSelection.mock.callCount(), 0);
  });

  it("refuses a copy that no longer validates, as rendering would", async () => {
    for (const letterhead of [
      { cells: [], color: null },
      { ...COPY.letterhead, color: "green" },
      "not a grid",
    ]) {
      ownRow = { ...COPY, letterhead };
      assert.deepEqual(await selectOwn(), { ok: false, reason: "letterhead" });
    }
    assert.equal(upsertDocumentLetterheadSelection.mock.callCount(), 0);
  });

  it("selects the document's copy when it has one", async () => {
    ownRow = COPY;
    assert.deepEqual(await selectOwn(), { ok: true });
    assert.deepEqual(
      upsertDocumentLetterheadSelection.mock.calls[0].arguments,
      [
        {
          documentId: DOCUMENT_ID,
          letterheadId: null,
          useOwn: true,
          updatedBy: USER_ID,
        },
      ],
    );
  });

  it("refuses a document of another project before looking for a copy", async () => {
    getProjectIdByDocumentId.mock.mockImplementationOnce(
      async () => "0a7c9d2e-2222-4c3b-8d2e-3f4a5b6c7d8e",
    );
    assert.deepEqual(await selectOwn(), { ok: false, reason: "document" });
    assert.equal(getDocumentOwnLetterhead.mock.callCount(), 0);
    assert.equal(upsertDocumentLetterheadSelection.mock.callCount(), 0);
  });
});
