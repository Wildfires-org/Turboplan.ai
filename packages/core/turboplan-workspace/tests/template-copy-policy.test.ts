import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getPubliclyRestrictedModules,
  isProjectDocumentInScope,
  resolveTemplateCopyScope,
} from "../src/server/projects/template-copy-policy";

describe("getPubliclyRestrictedModules", () => {
  it("unions hidden and private modules without duplicates", () => {
    assert.deepEqual(
      getPubliclyRestrictedModules(["tasks", "map"], ["map", "context"]).sort(),
      ["context", "map", "tasks"],
    );
  });

  it("treats null/undefined as empty", () => {
    assert.deepEqual(getPubliclyRestrictedModules(null, undefined), []);
  });
});

describe("resolveTemplateCopyScope", () => {
  it("copies everything when nothing is excluded (members / owners)", () => {
    assert.deepEqual(resolveTemplateCopyScope(), {
      fields: true,
      tasks: true,
      uploadedDocuments: true,
      researchDocuments: true,
    });
  });

  it("maps each module to the content it owns", () => {
    assert.deepEqual(resolveTemplateCopyScope(["fields"]), {
      fields: false,
      tasks: true,
      uploadedDocuments: true,
      researchDocuments: true,
    });
    assert.deepEqual(resolveTemplateCopyScope(["tasks"]), {
      fields: true,
      tasks: false,
      uploadedDocuments: true,
      researchDocuments: true,
    });
    assert.deepEqual(resolveTemplateCopyScope(["documents"]), {
      fields: true,
      tasks: true,
      uploadedDocuments: false,
      researchDocuments: true,
    });
    assert.deepEqual(resolveTemplateCopyScope(["context"]), {
      fields: true,
      tasks: true,
      uploadedDocuments: true,
      researchDocuments: false,
    });
  });

  it("ignores modules that own no copied content", () => {
    assert.deepEqual(
      resolveTemplateCopyScope(["map", "timeline", "comments"]),
      resolveTemplateCopyScope(),
    );
  });
});

describe("isProjectDocumentInScope", () => {
  const noContext = resolveTemplateCopyScope(["context"]);
  const noDocuments = resolveTemplateCopyScope(["documents"]);

  it("gates research docs on the context module", () => {
    assert.equal(isProjectDocumentInScope("research", noContext), false);
    assert.equal(isProjectDocumentInScope("research", noDocuments), true);
  });

  it("gates uploads (and unknown sources) on the documents module", () => {
    assert.equal(isProjectDocumentInScope("upload", noDocuments), false);
    assert.equal(isProjectDocumentInScope("other", noDocuments), false);
    assert.equal(isProjectDocumentInScope("upload", noContext), true);
  });
});
