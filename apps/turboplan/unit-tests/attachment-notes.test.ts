import assert from "node:assert";
import { describe, it } from "node:test";

import {
  buildDroppedFilesNote,
  buildZipAttachmentNote,
} from "../lib/ai/attachment-notes";

const DOCX_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const projectContext = { isProjectChat: true, canReadProjectDocuments: true };
const personalContext = {
  isProjectChat: false,
  canReadProjectDocuments: false,
};

describe("buildZipAttachmentNote", () => {
  it("returns null without ZIPs", () => {
    assert.strictEqual(buildZipAttachmentNote([], projectContext), null);
  });

  it("keeps the visualization hint outside project chats", () => {
    const note = buildZipAttachmentNote(["parcels.zip"], personalContext);
    assert.ok(note?.includes("ready for map visualization"));
    assert.ok(!note?.includes("project map"));
  });

  it("says the layers go to the project map in project chats", () => {
    const note = buildZipAttachmentNote(
      ["parcels.zip", "roads.zip"],
      projectContext,
    );
    assert.ok(note?.includes("parcels.zip, roads.zip"));
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
