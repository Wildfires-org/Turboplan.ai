import assert from "node:assert";
import { describe, it } from "node:test";

import {
  isReadAllRequest,
  resolveDocumentFilenames,
} from "../lib/ai/tools/resolve-document-filenames";

// Newest first, as `getProjectDocumentsByProjectId` returns them.
const uploads = [
  { id: "memo-v2", originalFilename: "Scoping Memo.docx", source: "upload" },
  { id: "report", originalFilename: "Report.pdf", source: "upload" },
  { id: "memo-v1", originalFilename: "scoping memo.docx", source: "upload" },
];

// Uploads and research documents interleaved, newest first.
const mixed = [
  { id: "research-new", originalFilename: "Report.pdf", source: "research" },
  { id: "eis-new", originalFilename: "EIS.pdf", source: "research" },
  ...uploads,
  { id: "eis-old", originalFilename: "eis.pdf", source: "research" },
];

describe("resolveDocumentFilenames", () => {
  it("resolves a name to its newest upload", () => {
    assert.deepStrictEqual(
      resolveDocumentFilenames(["Scoping Memo.docx"], uploads),
      { ids: ["memo-v2"], missingFilenames: [] },
    );
  });

  it("matches case-insensitively and ignores surrounding whitespace", () => {
    assert.deepStrictEqual(
      resolveDocumentFilenames(["  REPORT.PDF "], uploads),
      { ids: ["report"], missingFilenames: [] },
    );
  });

  it("counts a name requested in several spellings once", () => {
    assert.deepStrictEqual(
      resolveDocumentFilenames(
        [
          "scoping memo.docx",
          "SCOPING MEMO.DOCX",
          "Missing.doc",
          "missing.DOC",
        ],
        uploads,
      ),
      { ids: ["memo-v2"], missingFilenames: ["Missing.doc"] },
    );
  });

  it("keeps the requested order", () => {
    assert.deepStrictEqual(
      resolveDocumentFilenames(["Report.pdf", "Scoping Memo.docx"], uploads)
        .ids,
      ["report", "memo-v2"],
    );
  });

  it("reports every name when nothing is uploaded yet", () => {
    assert.deepStrictEqual(resolveDocumentFilenames(["New.docx"], []), {
      ids: [],
      missingFilenames: ["New.docx"],
    });
  });
});

describe("resolveDocumentFilenames across sources", () => {
  it("prefers the user's upload over a newer research document", () => {
    assert.deepStrictEqual(resolveDocumentFilenames(["Report.pdf"], mixed), {
      ids: ["report"],
      missingFilenames: [],
    });
  });

  it("falls back to the newest research document when no upload matches", () => {
    assert.deepStrictEqual(resolveDocumentFilenames(["eis.PDF"], mixed), {
      ids: ["eis-new"],
      missingFilenames: [],
    });
  });

  it("resolves uploads and research documents in one call", () => {
    assert.deepStrictEqual(
      resolveDocumentFilenames(["EIS.pdf", "Scoping Memo.docx"], mixed).ids,
      ["eis-new", "memo-v2"],
    );
  });
});

describe("isReadAllRequest", () => {
  it("reads everything only when nothing is named", () => {
    assert.strictEqual(isReadAllRequest({}), true);
    assert.strictEqual(
      isReadAllRequest({ documentIds: [], filenames: [] }),
      true,
    );
  });

  it("never widens a filenames-only miss to every document", () => {
    const { ids } = resolveDocumentFilenames(["Missing.docx"], uploads);
    assert.deepStrictEqual(ids, []);
    assert.strictEqual(
      isReadAllRequest({ filenames: ["Missing.docx"] }),
      false,
    );
    assert.strictEqual(
      isReadAllRequest({ documentIds: [], filenames: ["Missing.docx"] }),
      false,
    );
  });

  it("does not read everything when ids are given", () => {
    assert.strictEqual(isReadAllRequest({ documentIds: ["report"] }), false);
  });
});
