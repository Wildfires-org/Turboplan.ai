import assert from "node:assert";
import { describe, it } from "node:test";

import {
  classifyProjectFile,
  GIS_ARCHIVE_MAX_FILE_SIZE,
  getProjectFileMaxSize,
  isAllowedUploadContentType,
  PROJECT_DOCUMENT_ACCEPT,
  PROJECT_DOCUMENT_MAX_FILE_SIZE,
  PROJECT_DOCUMENT_MIME_TYPES,
  PROJECT_FILE_ACCEPT,
  resolveProjectFileContentType,
} from "../src/types";

const DOCX =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

describe("classifyProjectFile", () => {
  it("classifies PDF and Word files as documents", () => {
    assert.strictEqual(
      classifyProjectFile({ name: "plan.pdf", type: "application/pdf" }),
      "document",
    );
    assert.strictEqual(
      classifyProjectFile({ name: "notes.DOCX", type: DOCX }),
      "document",
    );
    assert.strictEqual(
      classifyProjectFile({ name: "old.doc", type: "application/msword" }),
      "document",
    );
  });

  it("classifies by extension when the browser reports no usable type", () => {
    assert.strictEqual(
      classifyProjectFile({ name: "report.docx", type: "" }),
      "document",
    );
    assert.strictEqual(
      classifyProjectFile({
        name: "layers.zip",
        type: "application/octet-stream",
      }),
      "gis-zip",
    );
  });

  it("classifies ZIP archives as GIS uploads", () => {
    assert.strictEqual(
      classifyProjectFile({ name: "units.zip", type: "application/zip" }),
      "gis-zip",
    );
    assert.strictEqual(
      classifyProjectFile({
        name: "boundary.zip",
        type: "application/x-zip-compressed",
      }),
      "gis-zip",
    );
  });

  it("falls back to the MIME type for extensionless names", () => {
    assert.strictEqual(
      classifyProjectFile({ name: "download", type: "application/pdf" }),
      "document",
    );
    assert.strictEqual(
      classifyProjectFile({ name: "archive", type: "application/zip" }),
      "gis-zip",
    );
  });

  it("rejects everything else", () => {
    assert.strictEqual(
      classifyProjectFile({ name: "photo.png", type: "image/png" }),
      "unsupported",
    );
    assert.strictEqual(
      classifyProjectFile({ name: "layer.geojson", type: "" }),
      "unsupported",
    );
    assert.strictEqual(
      classifyProjectFile({ name: ".zip", type: "" }),
      "unsupported",
    );
  });
});

describe("resolveProjectFileContentType", () => {
  it("keeps an allowed browser type", () => {
    assert.strictEqual(
      resolveProjectFileContentType({
        name: "boundary.zip",
        type: "application/x-zip-compressed",
      }),
      "application/x-zip-compressed",
    );
  });

  it("derives the type from the extension when the browser gives none", () => {
    assert.strictEqual(
      resolveProjectFileContentType({ name: "report.docx", type: "" }),
      DOCX,
    );
    assert.strictEqual(
      resolveProjectFileContentType({
        name: "layers.zip",
        type: "application/octet-stream",
      }),
      "application/zip",
    );
  });

  it("returns null for unsupported files", () => {
    assert.strictEqual(
      resolveProjectFileContentType({ name: "photo.png", type: "image/png" }),
      null,
    );
  });

  it("only resolves to types the upload allow list accepts", () => {
    const names = ["a.pdf", "b.doc", "c.docx", "d.zip"];
    for (const name of names) {
      const contentType = resolveProjectFileContentType({ name, type: "" });
      assert.ok(contentType, name);
      assert.ok(isAllowedUploadContentType(contentType), name);
    }
  });
});

describe("project file limits and accept strings", () => {
  it("uses per-kind size limits", () => {
    assert.strictEqual(
      getProjectFileMaxSize("document"),
      PROJECT_DOCUMENT_MAX_FILE_SIZE,
    );
    assert.strictEqual(
      getProjectFileMaxSize("gis-zip"),
      GIS_ARCHIVE_MAX_FILE_SIZE,
    );
    assert.strictEqual(getProjectFileMaxSize("unsupported"), null);
  });

  it("lists every document type and extension in the accept strings", () => {
    for (const [mimeType, extensions] of Object.entries(
      PROJECT_DOCUMENT_MIME_TYPES,
    )) {
      assert.ok(PROJECT_DOCUMENT_ACCEPT.includes(mimeType));
      for (const extension of extensions) {
        assert.ok(PROJECT_DOCUMENT_ACCEPT.includes(extension));
      }
    }
    assert.ok(PROJECT_FILE_ACCEPT.includes(".zip"));
    assert.ok(PROJECT_FILE_ACCEPT.includes(PROJECT_DOCUMENT_ACCEPT));
  });
});
