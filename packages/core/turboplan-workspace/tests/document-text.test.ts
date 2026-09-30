import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { toDocumentTextResponse } from "../src/server/projects/document-text";

describe("toDocumentTextResponse", () => {
  it("returns the stored text for a finished extraction", () => {
    assert.deepEqual(
      toDocumentTextResponse({
        extractionStatus: "done",
        extractedText: "Scoping memo text",
        extractionError: null,
      }),
      { status: "done", text: "Scoping memo text", error: null },
    );
  });

  it("returns an empty string when a finished extraction found no text", () => {
    assert.deepEqual(
      toDocumentTextResponse({
        extractionStatus: "done",
        extractedText: null,
        extractionError: null,
      }),
      { status: "done", text: "", error: null },
    );
  });

  it("returns neither text nor error while pending", () => {
    assert.deepEqual(
      toDocumentTextResponse({
        extractionStatus: "pending",
        // Left over from an earlier run that has since been re-queued
        extractedText: "stale",
        extractionError: "stale error",
      }),
      { status: "pending", text: null, error: null },
    );
  });

  it("returns the error for failed and unsupported extractions", () => {
    for (const status of ["failed", "unsupported"] as const) {
      assert.deepEqual(
        toDocumentTextResponse({
          extractionStatus: status,
          extractedText: "stale",
          extractionError: "Could not read the .doc file",
        }),
        { status, text: null, error: "Could not read the .doc file" },
      );
    }
  });
});
