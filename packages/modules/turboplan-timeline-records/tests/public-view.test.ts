import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { timelineQuerySchema } from "../src/schemas";
import {
  getPubliclyHiddenEntityTypes,
  toPublicTimelineRecord,
} from "../src/server/public-view";

describe("getPubliclyHiddenEntityTypes", () => {
  it("hides nothing when no module is restricted", () => {
    assert.deepEqual(getPubliclyHiddenEntityTypes([], []), []);
    assert.deepEqual(getPubliclyHiddenEntityTypes(null, undefined), []);
  });

  it("hides every entity type of a hidden or private module", () => {
    const hidden = getPubliclyHiddenEntityTypes(["tasks"], ["documents"]);
    assert.deepEqual(hidden.sort(), [
      "dependency",
      "document",
      "milestone",
      "task",
    ]);
  });

  it("maps each module to its entity types", () => {
    assert.deepEqual(getPubliclyHiddenEntityTypes(["map"], []), ["map_layer"]);
    assert.deepEqual(getPubliclyHiddenEntityTypes([], ["fields"]), ["field"]);
    assert.deepEqual(getPubliclyHiddenEntityTypes([], ["comments"]), [
      "comment",
    ]);
    assert.deepEqual(getPubliclyHiddenEntityTypes(["context"], []), [
      "context",
    ]);
  });

  it("never hides project or member records by module", () => {
    const hidden = getPubliclyHiddenEntityTypes(
      ["map", "tasks", "fields", "context", "documents", "timeline"],
      ["comments"],
    );
    assert.equal(hidden.includes("project"), false);
    assert.equal(hidden.includes("member"), false);
  });
});

describe("toPublicTimelineRecord", () => {
  it("strips author email, author id, metadata and deletedAt", () => {
    const record = {
      id: "r1",
      userId: "u1",
      metadata: { source: "mcp" },
      deletedAt: null,
      authorEmail: "alice@example.test",
      authorFirstName: "Alice",
      title: "Notice published",
      isPublic: true,
    };

    assert.deepEqual(toPublicTimelineRecord(record), {
      id: "r1",
      authorEmail: null,
      authorFirstName: "Alice",
      title: "Notice published",
      isPublic: true,
    });
  });
});

describe("timelineQuerySchema isPublic", () => {
  it('parses "true" and "false" literally', () => {
    assert.equal(
      timelineQuerySchema.parse({ isPublic: "true" }).isPublic,
      true,
    );
    assert.equal(
      timelineQuerySchema.parse({ isPublic: "false" }).isPublic,
      false,
    );
  });

  it("leaves isPublic undefined when absent", () => {
    assert.equal(timelineQuerySchema.parse({}).isPublic, undefined);
  });

  it("rejects any other value", () => {
    for (const value of ["", "0", "1", "yes", "FALSE"]) {
      assert.equal(
        timelineQuerySchema.safeParse({ isPublic: value }).success,
        false,
        `expected "${value}" to be rejected`,
      );
    }
  });
});
