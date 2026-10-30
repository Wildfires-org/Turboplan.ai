import assert from "node:assert";
import { beforeEach, describe, it, mock } from "node:test";

import type { StoredLetterheadAnalysis } from "../src/schemas";
import { createMockDb } from "./helpers/mock-db";

const mockDb = createMockDb();

mock.module("../src/db-client", {
  namedExports: { db: mockDb.db },
});

const {
  claimOrganizationDocumentLetterhead,
  claimProjectDocumentLetterhead,
  failExhaustedOrganizationDocumentLetterheads,
  failExhaustedProjectDocumentLetterheads,
  getOrganizationDocumentLetterheadAnalyses,
  getOrganizationDocumentTextsByIds,
  getOrganizationDocumentsPendingLetterhead,
  getProjectDocumentLetterheadAnalyses,
  getProjectDocumentsPendingLetterhead,
  updateOrganizationDocumentLetterhead,
  updateProjectDocument,
  updateProjectDocumentLetterhead,
} = await import("../src/queries");
const { MAX_LETTERHEAD_ATTEMPTS } = await import("../src/schemas");

const ORGANIZATION_ID = "00000000-0000-4000-8000-0000000000aa";
const PROJECT_ID = "00000000-0000-4000-8000-0000000000bb";
const DOCUMENT_ID = "00000000-0000-4000-8000-0000000000cc";

const ANALYSIS: StoredLetterheadAnalysis = {
  hasLetterhead: true,
  grid: {
    cells: [
      {
        kind: "logo",
        x: 0,
        width: 0.2,
        height: 0.1,
        key: "letterheads/project/doc/logo-0-abc.png",
      },
      {
        kind: "text",
        x: 0.6,
        width: 0.4,
        align: "right",
        lines: [{ text: "Example Agency", bold: true, size: "large" }],
      },
    ],
    color: "#1f4e79",
  },
};

beforeEach(() => {
  mockDb.reset();
});

describe("MAX_LETTERHEAD_ATTEMPTS", () => {
  it("gives a document three analyses", () => {
    assert.strictEqual(MAX_LETTERHEAD_ATTEMPTS, 3);
  });
});

describe("getProjectDocumentsPendingLetterhead", () => {
  it("reads pending rows with attempts left, newest first, up to the limit", async () => {
    await getProjectDocumentsPendingLetterhead(5);
    const { sql, params } = mockDb.lastQuery();
    assert.strictEqual(
      sql,
      'select "id", "url", "mime_type", "original_filename" from "project_document" where ("project_document"."letterhead_status" = \'pending\' and "project_document"."letterhead_attempts" < $1) order by "project_document"."created_at" desc limit $2',
    );
    assert.deepStrictEqual(params, [3, 5]);
  });
});

describe("getOrganizationDocumentsPendingLetterhead", () => {
  it("reads pending rows with attempts left, newest first, up to the limit", async () => {
    await getOrganizationDocumentsPendingLetterhead(5);
    const { sql, params } = mockDb.lastQuery();
    assert.strictEqual(
      sql,
      'select "id", "url", "mime_type", "original_filename" from "organization_document" where ("organization_document"."letterhead_status" = \'pending\' and "organization_document"."letterhead_attempts" < $1) order by "organization_document"."created_at" desc limit $2',
    );
    assert.deepStrictEqual(params, [3, 5]);
  });
});

describe("claimProjectDocumentLetterhead", () => {
  it("counts an attempt on a pending row with attempts left and returns the count", async () => {
    mockDb.setRows([{ attempts: 2 }]);
    assert.strictEqual(await claimProjectDocumentLetterhead(DOCUMENT_ID), 2);
    const { sql, params } = mockDb.lastQuery();
    assert.strictEqual(
      sql,
      'update "project_document" set "letterhead_attempts" = "project_document"."letterhead_attempts" + 1 where ("project_document"."id" = $1 and "project_document"."letterhead_status" = \'pending\' and "project_document"."letterhead_attempts" < $2) returning "letterhead_attempts"',
    );
    assert.deepStrictEqual(params, [DOCUMENT_ID, 3]);
  });

  it("returns null when the row is gone, done or out of attempts", async () => {
    assert.strictEqual(await claimProjectDocumentLetterhead(DOCUMENT_ID), null);
  });
});

describe("claimOrganizationDocumentLetterhead", () => {
  it("counts an attempt without touching updated_at", async () => {
    mockDb.setRows([{ attempts: 1 }]);
    assert.strictEqual(
      await claimOrganizationDocumentLetterhead(DOCUMENT_ID),
      1,
    );
    const { sql, params } = mockDb.lastQuery();
    assert.strictEqual(
      sql,
      'update "organization_document" set "letterhead_attempts" = "organization_document"."letterhead_attempts" + 1 where ("organization_document"."id" = $1 and "organization_document"."letterhead_status" = \'pending\' and "organization_document"."letterhead_attempts" < $2) returning "letterhead_attempts"',
    );
    assert.deepStrictEqual(params, [DOCUMENT_ID, 3]);

    mockDb.setRows([]);
    assert.strictEqual(
      await claimOrganizationDocumentLetterhead(DOCUMENT_ID),
      null,
    );
  });
});

describe("failExhaustedProjectDocumentLetterheads", () => {
  it("fails the pending rows out of attempts and counts them", async () => {
    mockDb.setRows([{ id: DOCUMENT_ID }, { id: PROJECT_ID }]);
    assert.strictEqual(await failExhaustedProjectDocumentLetterheads(), 2);
    const { sql, params } = mockDb.lastQuery();
    assert.strictEqual(
      sql,
      'update "project_document" set "letterhead_status" = $1 where ("project_document"."letterhead_status" = \'pending\' and "project_document"."letterhead_attempts" >= $2) returning "id"',
    );
    assert.deepStrictEqual(params, ["failed", 3]);
  });
});

describe("failExhaustedOrganizationDocumentLetterheads", () => {
  it("fails the pending rows out of attempts without touching updated_at", async () => {
    assert.strictEqual(await failExhaustedOrganizationDocumentLetterheads(), 0);
    const { sql, params } = mockDb.lastQuery();
    assert.strictEqual(
      sql,
      'update "organization_document" set "letterhead_status" = $1 where ("organization_document"."letterhead_status" = \'pending\' and "organization_document"."letterhead_attempts" >= $2) returning "id"',
    );
    assert.deepStrictEqual(params, ["failed", 3]);
  });
});

describe("updateProjectDocumentLetterhead", () => {
  it("stores the status and analysis and reports whether a row matched", async () => {
    mockDb.setRows([{ id: DOCUMENT_ID }]);
    assert.strictEqual(
      await updateProjectDocumentLetterhead(DOCUMENT_ID, {
        status: "done",
        analysis: ANALYSIS,
      }),
      true,
    );
    const { sql, params } = mockDb.lastQuery();
    assert.strictEqual(
      sql,
      'update "project_document" set "letterhead_status" = $1, "letterhead_analysis" = $2 where "project_document"."id" = $3 returning "id"',
    );
    assert.deepStrictEqual(params, [
      "done",
      JSON.stringify(ANALYSIS),
      DOCUMENT_ID,
    ]);

    mockDb.setRows([]);
    assert.strictEqual(
      await updateProjectDocumentLetterhead(DOCUMENT_ID, {
        status: "failed",
        analysis: null,
      }),
      false,
    );
  });
});

describe("updateOrganizationDocumentLetterhead", () => {
  it("stores the status and analysis without touching updated_at", async () => {
    const analysis = { hasLetterhead: false, grid: null };
    mockDb.setRows([{ id: DOCUMENT_ID }]);
    assert.strictEqual(
      await updateOrganizationDocumentLetterhead(DOCUMENT_ID, {
        status: "none",
        analysis,
      }),
      true,
    );
    const { sql, params } = mockDb.lastQuery();
    assert.strictEqual(
      sql,
      'update "organization_document" set "letterhead_status" = $1, "letterhead_analysis" = $2 where "organization_document"."id" = $3 returning "id"',
    );
    assert.deepStrictEqual(params, [
      "none",
      JSON.stringify(analysis),
      DOCUMENT_ID,
    ]);
  });

  it("reports false when the document no longer exists", async () => {
    assert.strictEqual(
      await updateOrganizationDocumentLetterhead(DOCUMENT_ID, {
        status: "failed",
        analysis: null,
      }),
      false,
    );
  });
});

describe("getProjectDocumentLetterheadAnalyses", () => {
  it("reads the analyses, scoped to the project", async () => {
    await getProjectDocumentLetterheadAnalyses(PROJECT_ID, [DOCUMENT_ID]);
    const { sql, params } = mockDb.lastQuery();
    assert.strictEqual(
      sql,
      'select "id", "original_filename", "letterhead_status", "letterhead_analysis" from "project_document" where ("project_document"."project_id" = $1 and "project_document"."id" in ($2))',
    );
    assert.deepStrictEqual(params, [PROJECT_ID, DOCUMENT_ID]);
  });

  it("does not query without ids", async () => {
    assert.deepStrictEqual(
      await getProjectDocumentLetterheadAnalyses(PROJECT_ID, []),
      [],
    );
    assert.strictEqual(mockDb.builtCount(), 0);
  });
});

describe("getOrganizationDocumentLetterheadAnalyses", () => {
  it("reads the analyses, scoped to the organization", async () => {
    await getOrganizationDocumentLetterheadAnalyses(ORGANIZATION_ID, [
      DOCUMENT_ID,
    ]);
    const { sql, params } = mockDb.lastQuery();
    assert.strictEqual(
      sql,
      'select "id", "original_filename", "letterhead_status", "letterhead_analysis" from "organization_document" where ("organization_document"."organization_id" = $1 and "organization_document"."id" in ($2))',
    );
    assert.deepStrictEqual(params, [ORGANIZATION_ID, DOCUMENT_ID]);
  });

  it("does not query without ids", async () => {
    assert.deepStrictEqual(
      await getOrganizationDocumentLetterheadAnalyses(ORGANIZATION_ID, []),
      [],
    );
    assert.strictEqual(mockDb.builtCount(), 0);
  });
});

describe("getOrganizationDocumentTextsByIds", () => {
  it("reads the text and URL, scoped to the organization", async () => {
    await getOrganizationDocumentTextsByIds(ORGANIZATION_ID, [DOCUMENT_ID]);
    const { sql, params } = mockDb.lastQuery();
    assert.strictEqual(
      sql,
      'select "id", "url", "original_filename", "extraction_status", "extracted_text" from "organization_document" where ("organization_document"."organization_id" = $1 and "organization_document"."id" in ($2))',
    );
    assert.deepStrictEqual(params, [ORGANIZATION_ID, DOCUMENT_ID]);
  });

  it("does not query without ids", async () => {
    assert.deepStrictEqual(
      await getOrganizationDocumentTextsByIds(ORGANIZATION_ID, []),
      [],
    );
    assert.strictEqual(mockDb.builtCount(), 0);
  });
});

describe("updateProjectDocument", () => {
  it("returns the list columns, never the extracted text or letterhead analysis", async () => {
    await updateProjectDocument(DOCUMENT_ID, {
      originalFilename: "renamed.pdf",
    });
    const { sql, params } = mockDb.lastQuery();
    assert.match(
      sql,
      /^update "project_document" set "original_filename" = \$1 where "project_document"\."id" = \$2 returning "id", /,
    );
    const returned = sql.slice(sql.indexOf(" returning "));
    for (const column of [
      "extracted_text",
      "letterhead_status",
      "letterhead_analysis",
    ]) {
      assert.ok(!returned.includes(`"${column}"`), `returns ${column}`);
    }
    assert.ok(returned.includes('"original_filename"'));
    assert.deepStrictEqual(params, ["renamed.pdf", DOCUMENT_ID]);
  });
});
