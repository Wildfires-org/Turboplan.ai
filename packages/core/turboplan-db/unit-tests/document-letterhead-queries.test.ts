import assert from "node:assert";
import { beforeEach, describe, it, mock } from "node:test";

import type { StoredLetterheadGrid } from "../src/schemas";
import { createMockDb } from "./helpers/mock-db";

const mockDb = createMockDb();

mock.module("../src/db-client", {
  namedExports: { db: mockDb.db },
});

const {
  getDocumentOwnLetterhead,
  updateDocumentOwnLetterhead,
  upsertDocumentLetterheadSelection,
  upsertDocumentOwnLetterhead,
} = await import("../src/queries/document-letterheads");

const DOCUMENT_ID = "00000000-0000-4000-8000-0000000000cc";
const LETTERHEAD_ID = "00000000-0000-4000-8000-0000000000dd";
const USER_ID = "00000000-0000-4000-8000-0000000000ee";
const PROJECT_DOCUMENT_ID = "00000000-0000-4000-8000-0000000000ff";

const GRID: StoredLetterheadGrid = {
  cells: [
    {
      kind: "text",
      x: 0,
      width: 0.5,
      align: "left",
      lines: [{ text: "Example Agency", bold: true, size: "large" }],
    },
  ],
  color: "#1f4e79",
};

const lastSql = mockDb.lastQuery;

beforeEach(() => {
  mockDb.reset();
});

describe("upsertDocumentLetterheadSelection", () => {
  const SELECTION_UPSERT =
    /^insert into "document_letterhead_selection" \("document_id", "letterhead_id", "use_own", "updated_at", "updated_by"\) values \(\$1, \$2, \$3, \$4, \$5\) on conflict \("document_id"\) do update set "letterhead_id" = \$6, "use_own" = \$7, "updated_at" = \$8, "updated_by" = \$9$/;

  it("stores the document's own copy as a null letterhead with use_own", async () => {
    await upsertDocumentLetterheadSelection({
      documentId: DOCUMENT_ID,
      letterheadId: null,
      useOwn: true,
      updatedBy: USER_ID,
    });
    const { sql, params } = lastSql();
    assert.match(sql, SELECTION_UPSERT);
    assert.deepStrictEqual(
      [params[0], params[1], params[2], params[4]],
      [DOCUMENT_ID, null, true, USER_ID],
    );
    assert.deepStrictEqual(
      [params[5], params[6], params[8]],
      [null, true, USER_ID],
    );
  });

  it("clears use_own when storing none, so leaving the copy sticks", async () => {
    await upsertDocumentLetterheadSelection({
      documentId: DOCUMENT_ID,
      letterheadId: null,
      updatedBy: USER_ID,
    });
    const { sql, params } = lastSql();
    assert.match(sql, SELECTION_UPSERT);
    assert.deepStrictEqual([params[1], params[2]], [null, false]);
    assert.deepStrictEqual([params[5], params[6]], [null, false]);
  });

  it("clears use_own when storing a library letterhead", async () => {
    await upsertDocumentLetterheadSelection({
      documentId: DOCUMENT_ID,
      letterheadId: LETTERHEAD_ID,
      updatedBy: null,
    });
    const { sql, params } = lastSql();
    assert.match(sql, SELECTION_UPSERT);
    assert.deepStrictEqual([params[1], params[2]], [LETTERHEAD_ID, false]);
    assert.deepStrictEqual([params[5], params[6]], [LETTERHEAD_ID, false]);
  });
});

describe("getDocumentOwnLetterhead", () => {
  it("reads the document's copy by document id", async () => {
    const row = { documentId: DOCUMENT_ID, letterhead: GRID };
    mockDb.setRows([row]);
    assert.deepStrictEqual(await getDocumentOwnLetterhead(DOCUMENT_ID), row);
    const { sql, params } = lastSql();
    assert.match(
      sql,
      /from "document_own_letterhead" where "document_own_letterhead"\."document_id" = \$1 limit \$2$/,
    );
    assert.deepStrictEqual(params, [DOCUMENT_ID, 1]);
  });

  it("returns null when the document has no copy", async () => {
    assert.strictEqual(await getDocumentOwnLetterhead(DOCUMENT_ID), null);
  });
});

describe("upsertDocumentOwnLetterhead", () => {
  it("inserts the copy or replaces the document's earlier one", async () => {
    await upsertDocumentOwnLetterhead({
      documentId: DOCUMENT_ID,
      letterhead: GRID,
      referenceFilename: "blm-letter.pdf",
      referenceProjectDocumentId: PROJECT_DOCUMENT_ID,
      updatedBy: USER_ID,
    });
    const { sql, params } = lastSql();
    assert.match(
      sql,
      /^insert into "document_own_letterhead" \("document_id", "letterhead", "reference_filename", "reference_project_document_id", "reference_organization_document_id", "created_at", "updated_at", "updated_by"\) values \(\$1, \$2, \$3, \$4, \$5, default, \$6, \$7\) on conflict \("document_id"\) do update set "letterhead" = \$8, "reference_filename" = \$9, "reference_project_document_id" = \$10, "reference_organization_document_id" = \$11, "updated_at" = \$12, "updated_by" = \$13$/,
    );
    assert.deepStrictEqual(
      [params[0], params[1], params[2], params[3], params[4], params[6]],
      [
        DOCUMENT_ID,
        JSON.stringify(GRID),
        "blm-letter.pdf",
        PROJECT_DOCUMENT_ID,
        null,
        USER_ID,
      ],
    );
    assert.deepStrictEqual(
      [params[7], params[8], params[9], params[10], params[12]],
      [
        JSON.stringify(GRID),
        "blm-letter.pdf",
        PROJECT_DOCUMENT_ID,
        null,
        USER_ID,
      ],
    );
  });

  it("clears the reference ids it is not given", async () => {
    await upsertDocumentOwnLetterhead({
      documentId: DOCUMENT_ID,
      letterhead: GRID,
      referenceFilename: "notes.pdf",
      updatedBy: null,
    });
    const { params } = lastSql();
    assert.deepStrictEqual([params[3], params[4]], [null, null]);
    assert.deepStrictEqual([params[9], params[10]], [null, null]);
  });
});

describe("updateDocumentOwnLetterhead", () => {
  const READ_AT = new Date("2026-10-20T10:00:00.123Z");
  const SAVED_AT = new Date("2026-10-20T10:05:00.456Z");

  it("replaces only the grid of the copy it was read at", async () => {
    mockDb.setRows([{ updatedAt: SAVED_AT }]);
    assert.deepStrictEqual(
      await updateDocumentOwnLetterhead({
        documentId: DOCUMENT_ID,
        letterhead: GRID,
        updatedBy: USER_ID,
        expectedUpdatedAt: READ_AT,
      }),
      SAVED_AT,
    );
    const { sql, params } = lastSql();
    assert.match(
      sql,
      /^update "document_own_letterhead" set "letterhead" = \$1, "updated_at" = \$2, "updated_by" = \$3 where \("document_own_letterhead"\."document_id" = \$4 and date_trunc\('milliseconds', "document_own_letterhead"\."updated_at"\) = \$5::timestamp\) returning "updated_at"$/,
    );
    assert.deepStrictEqual(
      [params[0], params[2], params[3], params[4]],
      [JSON.stringify(GRID), USER_ID, DOCUMENT_ID, "2026-10-20T10:00:00.123Z"],
    );
  });

  it("reports null when the copy is gone or changed meanwhile", async () => {
    assert.strictEqual(
      await updateDocumentOwnLetterhead({
        documentId: DOCUMENT_ID,
        letterhead: GRID,
        updatedBy: null,
        expectedUpdatedAt: READ_AT,
      }),
      null,
    );
  });
});
