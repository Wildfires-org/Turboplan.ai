import assert from "node:assert";
import { describe, it } from "node:test";

import {
  buildDroppedFilesNote,
  buildGisAttachmentNote,
  isGisAttachment,
} from "../lib/ai/attachment-notes";

const DOCX_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const projectContext = { isProjectChat: true, canReadProjectDocuments: true };
const personalContext = {
  isProjectChat: false,
  canReadProjectDocuments: false,
};

describe("isGisAttachment", () => {
  it("accepts archives and standalone GIS files", () => {
    for (const file of [
      { name: "parcels.zip", mediaType: "application/zip" },
      { name: "area.kmz", mediaType: "application/vnd.google-earth.kmz" },
      // KML is stored as text/plain; the extension identifies it
      { name: "sites.kml", mediaType: "text/plain" },
      { name: "roads.geojson", mediaType: "application/geo+json" },
      { name: "project.gpkg", mediaType: "application/geopackage+sqlite3" },
      { name: "project.gpkg", mediaType: "" },
      // Legacy: unrecognised files sent as a generic archive type
      { name: "upload", mediaType: "application/octet-stream" },
    ]) {
      assert.strictEqual(isGisAttachment(file), true, file.name);
    }
  });

  it("rejects documents, images, bare JSON and plain text", () => {
    for (const file of [
      { name: "letter.docx", mediaType: "application/octet-stream" },
      { name: "report.pdf", mediaType: "application/pdf" },
      { name: "photo.png", mediaType: "image/png" },
      { name: "meta.json", mediaType: "application/json" },
      { name: "notes.txt", mediaType: "text/plain" },
    ]) {
      assert.strictEqual(isGisAttachment(file), false, file.name);
    }
  });
});

describe("buildGisAttachmentNote", () => {
  it("returns null without GIS files", () => {
    assert.strictEqual(buildGisAttachmentNote([], projectContext), null);
  });

  it("keeps the visualization hint outside project chats", () => {
    const note = buildGisAttachmentNote(["parcels.zip"], personalContext);
    assert.ok(note?.includes("ready for map visualization"));
    assert.ok(!note?.includes("project map"));
  });

  it("says the layers go to the project map in project chats", () => {
    const note = buildGisAttachmentNote(
      ["parcels.zip", "sites.kml"],
      projectContext,
    );
    assert.ok(note?.includes("GIS file(s): parcels.zip, sites.kml"));
    assert.ok(note?.includes("adds the GIS layers"));
    assert.ok(note?.includes("project map automatically"));
  });
});

describe("buildDroppedFilesNote", () => {
  it("returns null without files", () => {
    assert.strictEqual(buildDroppedFilesNote([], projectContext), null);
  });

  it("points Word files in project chats at readProjectDocuments", () => {
    const note = buildDroppedFilesNote(
      [{ name: "Scoping Letter.docx", mediaType: DOCX_TYPE }],
      projectContext,
    );
    assert.ok(note?.includes("added this file to the project documents"));
    assert.ok(note?.includes('filenames ["Scoping Letter.docx"]'));
    assert.ok(note?.includes("pending"));
    assert.ok(!note?.includes("cannot read directly"));
  });

  it("recognizes Word files by extension when the type is generic", () => {
    const note = buildDroppedFilesNote(
      [{ name: "old.doc", mediaType: "application/octet-stream" }],
      projectContext,
    );
    assert.ok(note?.includes('filenames ["old.doc"]'));
  });

  it("reports non-document files as unreadable next to documents", () => {
    const note = buildDroppedFilesNote(
      [
        { name: "a.docx", mediaType: DOCX_TYPE },
        { name: "sheet.xlsx", mediaType: "application/vnd.ms-excel" },
      ],
      projectContext,
    );
    assert.ok(note?.includes('filenames ["a.docx"]'));
    assert.ok(note?.includes("cannot read directly: sheet.xlsx"));
  });

  it("keeps the unreadable note outside project chats", () => {
    const note = buildDroppedFilesNote(
      [{ name: "a.docx", mediaType: DOCX_TYPE }],
      personalContext,
    );
    assert.strictEqual(
      note,
      "[System: User attached document(s) the model cannot read directly: a.docx]",
    );
  });

  it("keeps the unreadable note when the reader tool is unavailable", () => {
    const note = buildDroppedFilesNote(
      [{ name: "a.docx", mediaType: DOCX_TYPE }],
      { isProjectChat: true, canReadProjectDocuments: false },
    );
    assert.ok(note?.includes("cannot read directly: a.docx"));
  });
});
