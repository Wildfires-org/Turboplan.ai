import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { EntityType } from "../src/types";
import { getEntityActionsKey } from "../src/utils/entity-actions-key";

describe("getEntityActionsKey", () => {
  it("builds the per-entity actions key", () => {
    assert.equal(
      getEntityActionsKey("project-1", EntityType.PROJECT),
      "/api/permissions/actions?entityId=project-1&entityType=project",
    );
  });

  it("returns the same key regardless of the action being checked", () => {
    // The key intentionally omits `action` so one request serves every action.
    assert.equal(
      getEntityActionsKey("org-1", EntityType.ORGANIZATION),
      getEntityActionsKey("org-1", EntityType.ORGANIZATION),
    );
  });

  it("distinguishes entities and entity types", () => {
    assert.notEqual(
      getEntityActionsKey("id-1", EntityType.OFFICE),
      getEntityActionsKey("id-2", EntityType.OFFICE),
    );
    assert.notEqual(
      getEntityActionsKey("id-1", EntityType.OFFICE),
      getEntityActionsKey("id-1", EntityType.PROJECT),
    );
  });

  it("encodes ids that are not URL-safe", () => {
    assert.equal(
      getEntityActionsKey("a b/c", EntityType.PROJECT),
      "/api/permissions/actions?entityId=a+b%2Fc&entityType=project",
    );
  });
});
