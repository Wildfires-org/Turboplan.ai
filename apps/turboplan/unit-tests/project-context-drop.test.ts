import assert from "node:assert";
import { describe, it } from "node:test";

import { EXTRACTION_STALE_AFTER_MS } from "@wildfires-org/turboplan-documents/types";
import type { GisZipSaveResult } from "@wildfires-org/turboplan-map/client";
import {
  GIS_MAX_FILE_SIZE,
  PROJECT_DOCUMENT_MAX_FILE_SIZE,
  SHAPEFILE_PART_MESSAGE,
} from "@wildfires-org/turboplan-upload/types";

import {
  type DropFlags,
  type DropRow,
  formatGisResult,
  formatSkippedLayers,
  getDocumentDedupeKey,
  getDropRowStatus,
  getDropRowTypeLabel,
  getGisResultMessage,
  getGisResultPhase,
  getNextStaleDelay,
  joinSentences,
  planDrop,
} from "../lib/project-context-drop";

// Fixed clock: FRESH was created 10s ago, STALE 3 minutes ago.
const NOW = Date.parse("2026-09-29T12:00:00.000Z");
const FRESH = new Date(NOW - 10_000).toISOString();
const STALE = new Date(NOW - 3 * 60_000).toISOString();
const MINUTE = 60_000;

const PDF = "application/pdf";
const DOCX =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const ALL_ENABLED: DropFlags = {
  acceptsDocuments: true,
  acceptsGisLayers: true,
};

const makeRow = (overrides: Partial<DropRow> = {}): DropRow => ({
  id: "drop-1",
  name: "plan.pdf",
  kind: "document",
  phase: "registered",
  documentId: "doc-1",
  ...overrides,
});

const makeResult = (
  overrides: Partial<GisZipSaveResult> = {},
): GisZipSaveResult => ({
  added: 0,
  skipped: 0,
  failed: 0,
  layerNames: [],
  errors: [],
  ...overrides,
});

const pending = (createdAt: string) => [
  { id: "doc-1", extractionStatus: "pending" as const, createdAt },
];

describe("getDropRowStatus for documents", () => {
  it("shows extraction progress while the document is pending", () => {
    const status = getDropRowStatus(makeRow(), pending(FRESH), NOW);
    assert.strictEqual(status.label, "Extracting text");
    assert.strictEqual(status.isFinished, false);
    assert.strictEqual(status.isDismissable, false);
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

  it("lets a waiting row be dismissed, but not one already uploading", () => {
    assert.strictEqual(
      getDropRowStatus(makeRow({ phase: "queued" }), []).isDismissable,
      true,
    );
    for (const phase of ["uploading", "processing"] as const) {
      assert.strictEqual(
        getDropRowStatus(makeRow({ phase }), []).isDismissable,
        false,
        phase,
      );
    }
    for (const phase of ["error", "duplicate", "done"] as const) {
      assert.strictEqual(
        getDropRowStatus(makeRow({ phase }), []).isDismissable,
        true,
        phase,
      );
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

  it("shows a skipped duplicate as finished, not as an error", () => {
    const status = getDropRowStatus(makeRow({ phase: "duplicate" }), []);
    assert.strictEqual(status.label, "Already in project");
    assert.strictEqual(status.tone, "neutral");
    assert.strictEqual(status.isFinished, true);
  });

  it("treats .doc uploads like .docx", () => {
    const row = makeRow({ name: "old-plan.doc" });
    assert.strictEqual(
      getDropRowStatus(row, pending(FRESH), NOW).label,
      "Extracting text",
    );
    assert.strictEqual(
      getDropRowStatus(
        row,
        [{ id: "doc-1", extractionStatus: "done", createdAt: FRESH }],
        NOW,
      ).tone,
      "success",
    );
  });
});

describe("stale extraction", () => {
  it("shows a static waiting state once the wait is stale", () => {
    const status = getDropRowStatus(makeRow(), pending(STALE), NOW);
    assert.strictEqual(status.label, "Waiting for text extraction");
    assert.strictEqual(status.tone, "neutral");
    assert.strictEqual(status.isFinished, true);
  });

  it("measures from registeredAt, not the server createdAt", () => {
    // Server clock 10 minutes ahead: createdAt lies in the future.
    const future = new Date(NOW + 10 * MINUTE).toISOString();
    const staleRow = makeRow({ registeredAt: NOW - 3 * MINUTE });
    assert.strictEqual(
      getDropRowStatus(staleRow, pending(future), NOW).label,
      "Waiting for text extraction",
    );

    // Server clock behind: createdAt looks old, but the row was just added.
    const freshRow = makeRow({ registeredAt: NOW - 10_000 });
    assert.strictEqual(
      getDropRowStatus(freshRow, pending(STALE), NOW).label,
      "Extracting text",
    );
    assert.strictEqual(
      getNextStaleDelay([freshRow], pending(STALE), NOW),
      EXTRACTION_STALE_AFTER_MS - 10_000,
    );
  });

  it("schedules a re-render for when the next fresh row goes stale", () => {
    assert.strictEqual(
      getNextStaleDelay([makeRow()], pending(FRESH), NOW),
      EXTRACTION_STALE_AFTER_MS - 10_000,
    );
    assert.strictEqual(
      getNextStaleDelay([makeRow()], pending(STALE), NOW),
      null,
    );
    assert.strictEqual(
      getNextStaleDelay([makeRow()], pending("bad"), NOW),
      null,
    );
  });
});

describe("GIS results", () => {
  it("summarises added and failed layers", () => {
    assert.strictEqual(
      formatGisResult(makeResult({ added: 1 })),
      "1 layer added to the map.",
    );
    assert.strictEqual(
      formatGisResult(makeResult({ added: 3, failed: 2 })),
      "3 layers added to the map, 2 could not be saved.",
    );
    assert.strictEqual(formatGisResult(makeResult()), "No layers added");
  });

  it("names skipped layers and says how to replace them", () => {
    assert.strictEqual(
      formatGisResult(
        makeResult({ added: 2, skipped: 1, skippedLayerNames: ["units"] }),
      ),
      '2 layers added to the map. "units" is already in the project. To replace it, delete that layer first, then upload the file again.',
    );
    assert.strictEqual(
      formatSkippedLayers(
        makeResult({ skipped: 2, skippedLayerNames: ["units", "roads"] }),
      ),
      '"units", "roads" are already in the project. To replace them, delete those layers first, then upload the file again.',
    );
  });

  it("falls back to a count when the skipped names are missing", () => {
    assert.strictEqual(
      formatSkippedLayers(makeResult({ skipped: 1 })),
      "1 already in the project (delete it first to replace)",
    );
    assert.strictEqual(
      formatSkippedLayers(makeResult({ skipped: 3, skippedLayerNames: [] })),
      "3 already in the project (delete them first to replace)",
    );
    assert.strictEqual(formatSkippedLayers(makeResult({ added: 1 })), null);
  });

  it("adds the first layer error and every save warning to the row message", () => {
    assert.strictEqual(
      getGisResultMessage(
        makeResult({
          added: 1,
          failed: 1,
          errors: ["roads: no geometry", "rivers: bad CRS"],
          warnings: [
            "Units layer saved as a regular layer, the project already has one",
            '3 features of "parcels" could not be saved',
          ],
        }),
      ),
      '1 layer added to the map, 1 could not be saved. roads: no geometry. Units layer saved as a regular layer, the project already has one. 3 features of "parcels" could not be saved.',
    );
    assert.strictEqual(
      getGisResultMessage(makeResult({ added: 1 })),
      "1 layer added to the map.",
    );
  });

  it("is an error only when nothing was added or already present", () => {
    assert.strictEqual(getGisResultPhase(makeResult({ added: 2 })), "done");
    assert.strictEqual(getGisResultPhase(makeResult({ skipped: 2 })), "done");
    assert.strictEqual(getGisResultPhase(makeResult({ failed: 2 })), "error");
  });

  it("joins messages into sentences", () => {
    assert.strictEqual(
      joinSentences(["One", null, "Two.", "  ", undefined, "Three?"]),
      "One. Two. Three?",
    );
    assert.strictEqual(joinSentences([]), "");
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

  it("labels an extensionless document from its MIME type", () => {
    assert.strictEqual(
      getDropRowTypeLabel(makeRow({ name: "report", mimeType: PDF })),
      "PDF",
    );
    assert.strictEqual(
      getDropRowTypeLabel(makeRow({ name: "report", mimeType: DOCX })),
      "Word document",
    );
  });

  it("lets the extension win over the MIME type", () => {
    assert.strictEqual(
      getDropRowTypeLabel(makeRow({ name: "notes.docx", mimeType: PDF })),
      "Word document",
    );
    assert.strictEqual(
      getDropRowTypeLabel(makeRow({ name: "Plan.PDF", mimeType: "" })),
      "PDF",
    );
  });
});

describe("planDrop", () => {
  const file = (name: string, type = "", size = 1024) => ({ name, type, size });

  it("keys documents by file name and size", () => {
    assert.strictEqual(getDocumentDedupeKey("plan.pdf", 1024), "plan.pdf:1024");
    assert.notStrictEqual(
      getDocumentDedupeKey("plan.pdf", 1024),
      getDocumentDedupeKey("plan.pdf", 2048),
    );
  });

  it("plans a mixed drop in drop order", () => {
    const existing = new Set([getDocumentDedupeKey("old.pdf", 1024)]);
    const plan = planDrop(
      [
        file("photo.png", "image/png"),
        file("roads.shp"),
        file("old.pdf", PDF),
        file("layers.zip", "application/zip"),
        file("notes.docx", DOCX),
        file("huge.pdf", PDF, PROJECT_DOCUMENT_MAX_FILE_SIZE + 1),
        file("huge.zip", "application/zip", GIS_MAX_FILE_SIZE + 1),
      ],
      existing,
      ALL_ENABLED,
    );

    assert.deepStrictEqual(
      plan.map(({ name, kind, phase }) => [name, kind, phase]),
      [
        ["photo.png", "unsupported", "error"],
        ["roads.shp", "unsupported", "error"],
        ["old.pdf", "document", "duplicate"],
        ["layers.zip", "gis", "queued"],
        ["notes.docx", "document", "queued"],
        ["huge.pdf", "document", "error"],
        ["huge.zip", "gis", "error"],
      ],
    );
    assert.strictEqual(plan[0].message, "Unsupported file type");
    assert.strictEqual(plan[1].message, SHAPEFILE_PART_MESSAGE);
    assert.strictEqual(plan[3].dedupeKey, undefined);
    assert.strictEqual(
      plan[4].dedupeKey,
      getDocumentDedupeKey("notes.docx", 1024),
    );
    assert.match(plan[5].message ?? "", /^File too large/);
    assert.match(plan[6].message ?? "", /^GIS file too large/);
  });

  it("collapses the loose parts of one shapefile into one item", () => {
    const plan = planDrop(
      [
        file("Roads.shp"),
        file("plan.pdf", PDF),
        file("roads.dbf"),
        file("roads.shx"),
        file("roads.prj"),
        file("rivers.shp"),
        file("roads.cpg"),
      ],
      new Set(),
      ALL_ENABLED,
    );
    assert.deepStrictEqual(
      plan.map(({ name, phase }) => [name, phase]),
      [
        ["Roads.shp, roads.dbf, roads.shx, roads.prj, roads.cpg", "error"],
        ["plan.pdf", "queued"],
        ["rivers.shp", "error"],
      ],
    );
    assert.strictEqual(plan[0].message, SHAPEFILE_PART_MESSAGE);
  });

  it("rejects empty files", () => {
    const plan = planDrop(
      [file("blank.pdf", PDF, 0), file("blank.zip", "application/zip", 0)],
      new Set(),
      ALL_ENABLED,
    );
    assert.deepStrictEqual(
      plan.map(({ phase, message }) => [phase, message]),
      [
        ["error", "The file is empty (0 bytes)"],
        ["error", "The file is empty (0 bytes)"],
      ],
    );
  });

  it("queues both copies of a new document dropped twice", () => {
    const plan = planDrop(
      [file("a.pdf", PDF), file("a.pdf", PDF)],
      new Set(),
      ALL_ENABLED,
    );
    assert.deepStrictEqual(
      plan.map(({ phase }) => phase),
      ["queued", "queued"],
    );
    assert.strictEqual(plan[0].dedupeKey, plan[1].dedupeKey);
  });

  it("rejects files of a disabled module", () => {
    const plan = planDrop(
      [
        file("a.pdf", PDF),
        file("layers.zip", "application/zip"),
        file("roads.dbf"),
      ],
      new Set(),
      { acceptsDocuments: false, acceptsGisLayers: false },
    );
    assert.deepStrictEqual(
      plan.map(({ phase, message }) => [phase, message]),
      [
        ["error", "Documents are not enabled for this project"],
        ["error", "Map layers are not enabled for this project"],
        ["error", "Map layers are not enabled for this project"],
      ],
    );
  });

  it("does not flag a document of another size as a duplicate", () => {
    const plan = planDrop(
      [file("old.pdf", PDF, 2048)],
      new Set([getDocumentDedupeKey("old.pdf", 1024)]),
      ALL_ENABLED,
    );
    assert.strictEqual(plan[0].phase, "queued");
  });
});
