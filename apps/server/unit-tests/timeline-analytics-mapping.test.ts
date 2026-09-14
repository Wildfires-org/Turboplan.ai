import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { CreateTimelineRecordInput } from "@wildfires-org/turboplan-timeline-records/types";

import { toAnalyticsEvent } from "../src/middleware/timeline-analytics-mapping.js";

const record = (
  overrides: Partial<CreateTimelineRecordInput>,
): CreateTimelineRecordInput => ({
  projectId: "p1",
  userId: "u1",
  entityType: "task",
  entityId: "e1",
  action: "created",
  ...overrides,
});

describe("toAnalyticsEvent", () => {
  it("maps project created", () => {
    assert.equal(
      toAnalyticsEvent(record({ entityType: "project", action: "created" })),
      "project_created",
    );
  });

  it("maps task created", () => {
    assert.equal(toAnalyticsEvent(record({})), "task_created");
  });

  it("maps task status change to completed", () => {
    assert.equal(
      toAnalyticsEvent(
        record({
          action: "updated",
          changes: [
            { field: "status", newValue: "completed", valueType: "enum" },
          ],
        }),
      ),
      "task_completed",
    );
  });

  it("ignores task status change to a non-completed status", () => {
    assert.equal(
      toAnalyticsEvent(
        record({
          action: "updated",
          changes: [
            { field: "status", newValue: "in_progress", valueType: "enum" },
          ],
        }),
      ),
      null,
    );
  });

  it("maps task milestone change to task_moved", () => {
    assert.equal(
      toAnalyticsEvent(
        record({
          action: "updated",
          changes: [{ field: "milestone", newValue: "m2", valueType: "text" }],
        }),
      ),
      "task_moved",
    );
  });

  it("maps milestone created and completed", () => {
    assert.equal(
      toAnalyticsEvent(record({ entityType: "milestone", action: "created" })),
      "milestone_created",
    );
    assert.equal(
      toAnalyticsEvent(
        record({
          entityType: "milestone",
          action: "updated",
          changes: [
            { field: "status", newValue: "completed", valueType: "enum" },
          ],
        }),
      ),
      "milestone_completed",
    );
  });

  it("maps document lifecycle", () => {
    assert.equal(
      toAnalyticsEvent(record({ entityType: "document", action: "created" })),
      "document_uploaded",
    );
    assert.equal(
      toAnalyticsEvent(record({ entityType: "document", action: "added" })),
      "document_uploaded",
    );
    assert.equal(
      toAnalyticsEvent(record({ entityType: "document", action: "deleted" })),
      "document_deleted",
    );
  });

  it("maps member events", () => {
    assert.equal(
      toAnalyticsEvent(record({ entityType: "member", action: "added" })),
      "member_joined",
    );
    assert.equal(
      toAnalyticsEvent(
        record({ entityType: "member", action: "role_changed" }),
      ),
      "member_role_changed",
    );
  });

  it("returns null for out-of-plan record types", () => {
    for (const entityType of [
      "comment",
      "field",
      "map_layer",
      "context",
      "dependency",
    ] as const) {
      assert.equal(
        toAnalyticsEvent(record({ entityType, action: "created" })),
        null,
      );
    }
  });
});
