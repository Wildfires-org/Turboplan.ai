import assert from "node:assert";
import { describe, it } from "node:test";

import {
  type DropRow,
  formatGisResult,
  getDropRowStatus,
  getDropRowTypeLabel,
  getGisResultPhase,
  hasPendingExtraction,
} from "../lib/project-context-drop";

const makeRow = (overrides: Partial<DropRow> = {}): DropRow => ({
  id: "drop-1",
  name: "plan.pdf",
  kind: "document",
  phase: "registered",
  documentId: "doc-1",
  ...overrides,
});

const makeResult = (
  overrides: Partial<Parameters<typeof formatGisResult>[0]> = {},
) => ({
  added: 0,
  skipped: 0,
  failed: 0,
  layerNames: [],
  errors: [],
  ...overrides,
});

describe("getDropRowStatus for documents", () => {
  it("shows extraction progress while the document is pending", () => {
    const status = getDropRowStatus(makeRow(), [
      { id: "doc-1", extractionStatus: "pending" },
    ]);
    assert.strictEqual(status.label, "Extracting text");
    assert.strictEqual(status.isFinished, false);
  });

  it("stops waiting for a document removed from the list", () => {
    const status = getDropRowStatus(makeRow(), []);
    assert.strictEqual(status.label, "Removed");
    assert.strictEqual(status.isFinished, true);
  });

  it("finishes when the text is extracted", () => {
    const status = getDropRowStatus(makeRow(), [
      { id: "doc-1", extractionStatus: "done" },
    ]);
    assert.strictEqual(status.tone, "success");
    assert.strictEqual(status.isFinished, true);
  });

  it("surfaces the extraction error when extraction failed", () => {
    const status = getDropRowStatus(makeRow(), [
      {
        id: "doc-1",
        extractionStatus: "failed",
        extractionError: "Scanned PDF",
      },
    ]);
    assert.strictEqual(status.tone, "warning");
    assert.strictEqual(status.detail, "Scanned PDF");
    assert.strictEqual(status.isFinished, true);
  });

  it("maps upload phases to in-progress states", () => {
    for (const phase of ["queued", "uploading", "processing"] as const) {
      const status = getDropRowStatus(makeRow({ phase }), []);
      assert.strictEqual(status.isFinished, false, phase);
      assert.strictEqual(status.tone, "progress", phase);
    }
  });

  it("shows the stored message for errors", () => {
    const status = getDropRowStatus(
      makeRow({ phase: "error", message: "Unsupported file type" }),
      [],
    );
    assert.strictEqual(status.tone, "error");
    assert.strictEqual(status.detail, "Unsupported file type");
  });
});

describe("hasPendingExtraction", () => {
  it("is true only while a registered document waits for its text", () => {
    const rows = [makeRow(), makeRow({ id: "drop-2", phase: "uploading" })];
    assert.strictEqual(
      hasPendingExtraction(rows, [
        { id: "doc-1", extractionStatus: "pending" },
      ]),
      true,
    );
    assert.strictEqual(
      hasPendingExtraction(rows, [{ id: "doc-1", extractionStatus: "done" }]),
      false,
    );
  });
});

describe("GIS results", () => {
  it("summarises added, skipped and failed layers", () => {
    assert.strictEqual(
      formatGisResult(makeResult({ added: 1 })),
      "1 layer added to the map",
    );
    assert.strictEqual(
      formatGisResult(makeResult({ added: 3, skipped: 1, failed: 2 })),
      "3 layers added to the map, 1 already in the project, 2 could not be saved",
    );
    assert.strictEqual(formatGisResult(makeResult()), "No layers added");
  });

  it("is an error only when nothing was added or already present", () => {
    assert.strictEqual(getGisResultPhase(makeResult({ added: 2 })), "done");
    assert.strictEqual(getGisResultPhase(makeResult({ skipped: 2 })), "done");
    assert.strictEqual(getGisResultPhase(makeResult({ failed: 2 })), "error");
  });
});

describe("getDropRowTypeLabel", () => {
  it("labels each kind", () => {
    assert.strictEqual(getDropRowTypeLabel(makeRow()), "PDF");
    assert.strictEqual(
      getDropRowTypeLabel(makeRow({ name: "notes.docx" })),
      "Word document",
    );
    assert.strictEqual(
      getDropRowTypeLabel(makeRow({ name: "a.zip", kind: "gis-zip" })),
      "GIS layers (ZIP)",
    );
    assert.strictEqual(
      getDropRowTypeLabel(makeRow({ name: "a.png", kind: "unsupported" })),
      "Unsupported file",
    );
  });
});
