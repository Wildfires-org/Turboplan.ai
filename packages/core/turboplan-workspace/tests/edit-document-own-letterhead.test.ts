import assert from "node:assert/strict";
import { beforeEach, describe, it, mock } from "node:test";

const PROJECT_ID = "0a7c9d2e-1111-4c3b-8d2e-3f4a5b6c7d8e";
const DOCUMENT_ID = "6f1c2a8e-4b1d-4a63-9a5e-1f0f5b6c7d8e";
const USER_ID = "3b2a1c0d-9e8f-4a7b-8c6d-5e4f3a2b1c0d";
const STORAGE = "https://files.example.test";
// Stored grids hold object keys; the editor sends new logos as upload URLs.
const REFERENCE_LOGO = "letterheads/project/ref/logo-0-abc.png";

// Ownership is decided on keys under this (dummy) storage write base.
Object.assign(process.env, {
  R2_ACCOUNT_ID: "test",
  R2_ACCESS_KEY_ID: "test",
  R2_SECRET_ACCESS_KEY: "test",
  R2_BUCKET_NAME: "test",
  R2_PUBLIC_URL: STORAGE,
});

// The copy's version is its `updated_at`.
const READ_AT = new Date("2026-10-20T10:00:00.123Z");
const VERSION = READ_AT.toISOString();
const SAVED_AT = new Date("2026-10-20T10:05:00.456Z");

const COPY = {
  letterhead: {
    cells: [
      { kind: "logo", x: 0, width: 0.15, height: 0.15, key: REFERENCE_LOGO },
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
    color: null,
  },
  referenceFilename: "blm-letter.pdf",
  updatedAt: READ_AT,
};

// The real query module, with the copy's reads and writes stubbed.
const actualQueries = await import("@wildfires-org/turboplan-db/queries");
let ownRow: {
  letterhead: unknown;
  referenceFilename: string;
  updatedAt: Date;
} | null = null;
// What the conditional write returns: the new `updated_at`, or null.
let updatedAt: Date | null = SAVED_AT;
const getProjectIdByDocumentId = mock.fn(async () => PROJECT_ID);
const getDocumentOwnLetterhead = mock.fn(async () => ownRow);
const updateDocumentOwnLetterhead = mock.fn(
  async (_args: {
    documentId: string;
    letterhead: unknown;
    updatedBy: string | null;
    expectedUpdatedAt: Date;
  }) => updatedAt,
);
const upsertDocumentLetterheadSelection = mock.fn(async () => {});
const deleteDocumentLetterheadSelection = mock.fn(async () => {});

mock.module("@wildfires-org/turboplan-db/queries", {
  namedExports: {
    ...actualQueries,
    getProjectIdByDocumentId,
    getDocumentOwnLetterhead,
    updateDocumentOwnLetterhead,
    upsertDocumentLetterheadSelection,
    deleteDocumentLetterheadSelection,
  },
});

const { editDocumentOwnLetterhead } = await import(
  "../src/server/projects/queries"
);

type Edit = Parameters<typeof editDocumentOwnLetterhead>[0]["edit"];

const textCell = {
  kind: "text" as const,
  x: 0.2,
  width: 0.8,
  align: "right" as const,
  lines: [{ text: " Example  Agency ", bold: true, size: "normal" as const }],
};

const keepLogo: Edit = {
  cells: [
    { kind: "logo", x: 0, width: 0.15, height: 0.15, index: 0 },
    textCell,
  ],
  color: "#1E3A8A",
};

const newLogo = (url: string): Edit => ({
  cells: [{ kind: "logo", x: 0, width: 0.15, height: 0.05, url }, textCell],
  color: null,
});

const edit = (value: Edit, version = VERSION) =>
  editDocumentOwnLetterhead({
    projectId: PROJECT_ID,
    documentId: DOCUMENT_ID,
    version,
    edit: value,
    userId: USER_ID,
  });

beforeEach(() => {
  ownRow = COPY;
  updatedAt = SAVED_AT;
  for (const fn of [
    getProjectIdByDocumentId,
    getDocumentOwnLetterhead,
    updateDocumentOwnLetterhead,
    upsertDocumentLetterheadSelection,
    deleteDocumentLetterheadSelection,
  ]) {
    fn.mock.resetCalls();
  }
});

describe("editDocumentOwnLetterhead", () => {
  it("stores the edited copy with the kept logo's stored key", async () => {
    const result = await edit(keepLogo);

    assert.equal(result.ok, true);
    const [{ documentId, letterhead, updatedBy, expectedUpdatedAt }] =
      updateDocumentOwnLetterhead.mock.calls[0].arguments;
    assert.equal(documentId, DOCUMENT_ID);
    assert.equal(updatedBy, USER_ID);
    // Written only over the version the edit was made on.
    assert.deepEqual(expectedUpdatedAt, READ_AT);
    assert.deepEqual(letterhead, {
      cells: [
        { kind: "logo", x: 0, width: 0.15, height: 0.15, key: REFERENCE_LOGO },
        {
          ...textCell,
          lines: [{ text: "Example Agency", bold: true, size: "normal" }],
        },
      ],
      color: "#1e3a8a",
    });
    assert.ok(result.ok);
    assert.equal(result.letterhead.layout, "grid");
    assert.deepEqual(result.letterhead.nameLines, ["Example Agency"]);
    assert.equal(result.version, SAVED_AT.toISOString());
    // Editing never touches the selection.
    assert.equal(upsertDocumentLetterheadSelection.mock.callCount(), 0);
    assert.equal(deleteDocumentLetterheadSelection.mock.callCount(), 0);
  });

  it("stores a logo the user uploaded by its object key", async () => {
    const key = `uploads/${USER_ID}/1700000000-logo.png`;

    assert.equal((await edit(newLogo(`${STORAGE}/${key}`))).ok, true);
    const [{ letterhead }] =
      updateDocumentOwnLetterhead.mock.calls[0].arguments;
    assert.deepEqual((letterhead as { cells: unknown[] }).cells[0], {
      kind: "logo",
      x: 0,
      width: 0.15,
      height: 0.05,
      key,
    });
  });

  it("refuses a logo that is not the user's own upload", async () => {
    for (const url of [
      `${STORAGE}/uploads/0a7c9d2e-9999-4c3b-8d2e-3f4a5b6c7d8e/logo.png`,
      `${STORAGE}/uploads/${USER_ID}/../other/logo.png`,
      `${STORAGE}/uploads/${USER_ID}%2f..%2fother/logo.png`,
      `${STORAGE}/${REFERENCE_LOGO}`,
      REFERENCE_LOGO,
      `https://files.example.test.evil.test/uploads/${USER_ID}/logo.png`,
      "http://169.254.169.254/latest/meta-data",
    ]) {
      const result = await edit(newLogo(url));
      assert.deepEqual(
        result,
        {
          ok: false,
          reason: "invalid",
          field: "cells.0.url",
          message: "Column 1: upload the logo again",
        },
        url,
      );
    }
    assert.equal(updateDocumentOwnLetterhead.mock.callCount(), 0);
  });

  it("refuses an unknown logo index and an invalid grid without writing", async () => {
    const unknownIndex = await edit({
      ...keepLogo,
      cells: [{ ...keepLogo.cells[0], index: 1 } as Edit["cells"][0], textCell],
    });
    assert.ok(!unknownIndex.ok);
    assert.equal(unknownIndex.reason, "invalid");

    const overlapping = await edit({
      ...keepLogo,
      cells: [keepLogo.cells[0], { ...textCell, x: 0.1 }],
    });
    assert.ok(!overlapping.ok);
    assert.equal(overlapping.reason, "invalid");

    assert.equal(updateDocumentOwnLetterhead.mock.callCount(), 0);
  });

  it("refuses a document of another project before reading its copy", async () => {
    getProjectIdByDocumentId.mock.mockImplementationOnce(
      async () => "0a7c9d2e-2222-4c3b-8d2e-3f4a5b6c7d8e",
    );

    assert.deepEqual(await edit(keepLogo), { ok: false, reason: "not_found" });
    assert.equal(getDocumentOwnLetterhead.mock.callCount(), 0);
    assert.equal(updateDocumentOwnLetterhead.mock.callCount(), 0);
  });

  it("refuses a document without a (valid) copy", async () => {
    for (const row of [
      null,
      { ...COPY, letterhead: { cells: [], color: null } },
      { ...COPY, letterhead: "not a grid" },
    ]) {
      ownRow = row;
      assert.deepEqual(await edit(keepLogo), {
        ok: false,
        reason: "not_found",
      });
    }
    assert.equal(updateDocumentOwnLetterhead.mock.callCount(), 0);
  });

  it("refuses an edit made on another version of the copy without writing", async () => {
    for (const version of [
      "2026-10-20T09:59:59.999Z",
      "2026-10-20T10:00:00.124Z",
    ]) {
      assert.deepEqual(await edit(keepLogo, version), {
        ok: false,
        reason: "conflict",
      });
    }
    // Even an edit that would be invalid on the newer copy: its logo
    // indexes refer to the version it was made on.
    assert.deepEqual(
      await edit(
        {
          ...keepLogo,
          cells: [
            { ...keepLogo.cells[0], index: 1 } as Edit["cells"][0],
            textCell,
          ],
        },
        "2026-10-20T09:00:00.000Z",
      ),
      { ok: false, reason: "conflict" },
    );
    assert.equal(updateDocumentOwnLetterhead.mock.callCount(), 0);
  });

  it("answers a conflict when the copy changed (or went) before it was written", async () => {
    updatedAt = null;

    assert.deepEqual(await edit(keepLogo), { ok: false, reason: "conflict" });
    assert.equal(updateDocumentOwnLetterhead.mock.callCount(), 1);
  });
});
