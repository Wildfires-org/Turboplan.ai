import assert from "node:assert";
import { describe, it } from "node:test";

import { isExtractionStale } from "@wildfires-org/turboplan-documents/types";

import {
  type DropRow,
  EXTRACTION_POLL_INTERVAL_MS,
  formatGisResult,
  getDocumentDedupeKey,
  getDropRowStatus,
  getDropRowTypeLabel,
  getExtractionPollInterval,
  getGisResultPhase,
  getNextStaleDelay,
  hasPendingExtraction,
  LEGACY_WORD_MESSAGE,
} from "../lib/project-context-drop";

// Fixed clock: FRESH was created 10s ago, STALE 3 minutes ago.
const NOW = Date.parse("2026-09-29T12:00:00.000Z");
const FRESH = new Date(NOW - 10_000).toISOString();
const STALE = new Date(NOW - 3 * 60_000).toISOString();

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
    const status = getDropRowStatus(
      makeRow(),
      [{ id: "doc-1", extractionStatus: "pending", createdAt: FRESH }],
      NOW,
    );
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
      { id: "doc-1", extractionStatus: "done", createdAt: FRESH },
    ]);
    assert.strictEqual(status.tone, "success");
    assert.strictEqual(status.isFinished, true);
  });

  it("surfaces the extraction error when extraction failed", () => {
    const status = getDropRowStatus(makeRow(), [
      {
        id: "doc-1",
        extractionStatus: "failed",
        createdAt: FRESH,
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
      hasPendingExtraction(
        rows,
        [{ id: "doc-1", extractionStatus: "pending", createdAt: FRESH }],
        NOW,
      ),
      true,
    );
    assert.strictEqual(
      hasPendingExtraction(
        rows,
        [{ id: "doc-1", extractionStatus: "done", createdAt: FRESH }],
        NOW,
      ),
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
      getDropRowTypeLabel(makeRow({ name: "a.zip", kind: "gis" })),
      "GIS layers (.zip)",
    );
    assert.strictEqual(
      getDropRowTypeLabel(makeRow({ name: "Sites.KML", kind: "gis" })),
      "GIS layers (.kml)",
    );
    assert.strictEqual(
      getDropRowTypeLabel(makeRow({ name: "a.png", kind: "unsupported" })),
      "Unsupported file",
    );
  });
});

describe("duplicate documents", () => {
  it("keys documents by file name and size", () => {
    assert.strictEqual(getDocumentDedupeKey("plan.pdf", 1024), "plan.pdf:1024");
    assert.notStrictEqual(
      getDocumentDedupeKey("plan.pdf", 1024),
      getDocumentDedupeKey("plan.pdf", 2048),
    );
  });

  it("shows a skipped duplicate as finished, not as an error", () => {
    const status = getDropRowStatus(makeRow({ phase: "duplicate" }), []);
    assert.strictEqual(status.label, "Already in project");
    assert.strictEqual(status.tone, "neutral");
    assert.strictEqual(status.isFinished, true);
  });
});

describe("stale extraction", () => {
  const pending = (createdAt: string) => [
    { id: "doc-1", extractionStatus: "pending" as const, createdAt },
  ];

  it("marks only pending documents older than the threshold as stale", () => {
    assert.strictEqual(
      isExtractionStale({ extractionStatus: "pending", createdAt: FRESH }, NOW),
      false,
    );
    assert.strictEqual(
      isExtractionStale({ extractionStatus: "pending", createdAt: STALE }, NOW),
      true,
    );
    assert.strictEqual(
      isExtractionStale({ extractionStatus: "done", createdAt: STALE }, NOW),
      false,
    );
    assert.strictEqual(
      isExtractionStale({ extractionStatus: "pending", createdAt: "bad" }, NOW),
      false,
    );
  });

  it("keeps spinning while pending is fresh", () => {
    const status = getDropRowStatus(makeRow(), pending(FRESH), NOW);
    assert.strictEqual(status.label, "Extracting text");
    assert.strictEqual(status.isFinished, false);
  });

  it("shows a static waiting state once pending is stale", () => {
    const status = getDropRowStatus(makeRow(), pending(STALE), NOW);
    assert.strictEqual(status.label, "Waiting for text extraction");
    assert.strictEqual(status.tone, "neutral");
    assert.strictEqual(status.isFinished, true);
  });

  it("polls only while a pending document is fresh", () => {
    const rows = [makeRow()];
    assert.strictEqual(
      getExtractionPollInterval(rows, pending(FRESH), NOW),
      EXTRACTION_POLL_INTERVAL_MS,
    );
    assert.strictEqual(getExtractionPollInterval(rows, pending(STALE), NOW), 0);
    assert.strictEqual(
      getExtractionPollInterval(
        rows,
        [{ id: "doc-1", extractionStatus: "done", createdAt: FRESH }],
        NOW,
      ),
      0,
    );
    assert.strictEqual(getExtractionPollInterval([], pending(FRESH), NOW), 0);
  });

  it("keeps polling when one pending document is stale and another fresh", () => {
    const rows = [makeRow(), makeRow({ id: "drop-2", documentId: "doc-2" })];
    const documents = [
      ...pending(STALE),
      { id: "doc-2", extractionStatus: "pending" as const, createdAt: FRESH },
    ];
    assert.strictEqual(
      getExtractionPollInterval(rows, documents, NOW),
      EXTRACTION_POLL_INTERVAL_MS,
    );
  });

  it("schedules a re-render for when the next fresh row goes stale", () => {
    assert.strictEqual(
      getNextStaleDelay([makeRow()], pending(FRESH), NOW),
      2 * 60_000 - 10_000,
    );
    assert.strictEqual(
      getNextStaleDelay([makeRow()], pending(STALE), NOW),
      null,
    );
  });
});

describe("legacy .doc uploads", () => {
  it("finish as a warning telling the user to save as .docx", () => {
    const status = getDropRowStatus(
      makeRow({ name: "old-plan.doc", contentType: "application/msword" }),
      [{ id: "doc-1", extractionStatus: "pending", createdAt: FRESH }],
      NOW,
    );
    assert.strictEqual(status.tone, "warning");
    assert.strictEqual(status.detail, LEGACY_WORD_MESSAGE);
    assert.strictEqual(status.isFinished, true);
  });

  it("do not keep the page polling", () => {
    assert.strictEqual(
      getExtractionPollInterval(
        [makeRow({ name: "old-plan.doc" })],
        [{ id: "doc-1", extractionStatus: "pending", createdAt: FRESH }],
        NOW,
      ),
      0,
    );
  });

  it("leave .docx uploads on the normal extraction path", () => {
    const status = getDropRowStatus(
      makeRow({ name: "plan.docx" }),
      [{ id: "doc-1", extractionStatus: "pending", createdAt: FRESH }],
      NOW,
    );
    assert.strictEqual(status.label, "Extracting text");
  });
});
