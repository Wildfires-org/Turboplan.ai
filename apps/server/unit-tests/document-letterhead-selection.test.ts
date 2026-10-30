import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { letterheadSelectionSchema } from "../src/routes/document-export.js";

const PROJECT_ID = "6f9619ff-8b86-4d01-b42d-00cf4fc964ff";
const LETTERHEAD_ID = "0a7c9d2e-1111-4c3b-8d2e-3f4a5b6c7d8e";

describe("letterheadSelectionSchema", () => {
  it("accepts the default, none, the document's own copy and a library id", () => {
    for (const selection of ["default", "none", "own", LETTERHEAD_ID]) {
      assert.equal(
        letterheadSelectionSchema.safeParse({
          projectId: PROJECT_ID,
          selection,
        }).success,
        true,
        selection,
      );
    }
  });

  it("rejects anything else", () => {
    for (const body of [
      { projectId: PROJECT_ID, selection: "grid" },
      { projectId: PROJECT_ID, selection: "" },
      { projectId: "nope", selection: "own" },
      { projectId: PROJECT_ID },
    ]) {
      assert.equal(letterheadSelectionSchema.safeParse(body).success, false);
    }
  });
});
