import assert from "node:assert";
import { describe, it } from "node:test";

import {
  getContextUploadTargets,
  pickContextUploadTarget,
} from "../lib/context-upload-target";

describe("getContextUploadTargets", () => {
  it("offers both, project first, when the user can add to both", () => {
    assert.deepStrictEqual(
      getContextUploadTargets({
        canAddProjectFiles: true,
        canAddOrganizationFiles: true,
      }),
      ["project", "organization"],
    );
  });

  it("offers only what the user may add to", () => {
    assert.deepStrictEqual(
      getContextUploadTargets({
        canAddProjectFiles: true,
        canAddOrganizationFiles: false,
      }),
      ["project"],
    );
    assert.deepStrictEqual(
      getContextUploadTargets({
        canAddProjectFiles: false,
        canAddOrganizationFiles: true,
      }),
      ["organization"],
    );
    assert.deepStrictEqual(
      getContextUploadTargets({
        canAddProjectFiles: false,
        canAddOrganizationFiles: false,
      }),
      [],
    );
  });
});

describe("pickContextUploadTarget", () => {
  it("keeps the remembered choice while it is allowed", () => {
    assert.strictEqual(
      pickContextUploadTarget(["project", "organization"], "organization"),
      "organization",
    );
  });

  it("falls back to the first allowed target", () => {
    assert.strictEqual(
      pickContextUploadTarget(["project"], "organization"),
      "project",
    );
    assert.strictEqual(
      pickContextUploadTarget(["organization"], "project"),
      "organization",
    );
  });

  it("ignores a stored value that is not a target", () => {
    assert.strictEqual(
      pickContextUploadTarget(["project", "organization"], "office"),
      "project",
    );
    assert.strictEqual(
      pickContextUploadTarget(["project", "organization"], null),
      "project",
    );
  });

  it("returns null when files cannot be added anywhere", () => {
    assert.strictEqual(pickContextUploadTarget([], "project"), null);
  });
});
