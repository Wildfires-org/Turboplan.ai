import assert from "node:assert";
import { describe, it } from "node:test";

process.env.AUTH_SECRET = "test-secret";
process.env.POSTGRES_URL = "postgresql://test";
process.env.TURBOPLAN_URL = "https://app.example.test";
process.env.LANDING_URL = "https://landing.example.test";
process.env.IS_TASKS_PACKAGE_ENABLED = "false";
process.env.IS_MAPS_PACKAGE_ENABLED = "false";
process.env.IS_RESEARCH_AGENT_INTEGRATION_PACKAGE_ENABLED = "false";
process.env.IS_PROJECT_CONTEXT_PACKAGE_ENABLED = "false";

const {
  createTimelineEventsSchema,
  buildEventRow,
  MAX_TIMELINE_EVENTS_PER_BATCH,
} = await import("../src/tools/timeline.js");

describe("create_timeline_events input schema", () => {
  it("accepts a happy-path multi-item batch", () => {
    const result = createTimelineEventsSchema.safeParse([
      { title: "Notice of Intent published" },
      {
        title: "Public comment period opened",
        startedAt: "2026-01-01T00:00:00.000Z",
        endedAt: "2026-02-01T00:00:00.000Z",
      },
    ]);
    assert.strictEqual(result.success, true);
    if (!result.success) {
      return;
    }
    assert.strictEqual(result.data.length, 2);
  });

  it("rejects the whole batch when one event has endedAt before startedAt", () => {
    const result = createTimelineEventsSchema.safeParse([
      { title: "Valid" },
      {
        title: "Invalid dates",
        startedAt: "2026-02-01T00:00:00.000Z",
        endedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    assert.strictEqual(result.success, false);
  });

  it("rejects an event with an empty title", () => {
    const result = createTimelineEventsSchema.safeParse([{ title: "" }]);
    assert.strictEqual(result.success, false);
  });

  it("rejects an empty batch", () => {
    const result = createTimelineEventsSchema.safeParse([]);
    assert.strictEqual(result.success, false);
  });

  it("rejects a batch that exceeds the per-call cap", () => {
    const tooMany = Array.from(
      { length: MAX_TIMELINE_EVENTS_PER_BATCH + 1 },
      (_, i) => ({ title: `Event ${i}` }),
    );
    const result = createTimelineEventsSchema.safeParse(tooMany);
    assert.strictEqual(result.success, false);
  });
});

describe("buildEventRow", () => {
  const params = {
    projectId: "11111111-1111-1111-1111-111111111111",
    projectName: "Lava Ridge",
    userId: "22222222-2222-2222-2222-222222222222",
    actor: "hermes",
  };

  it("mirrors the singular create_timeline_event row shape", () => {
    const row = buildEventRow(
      {
        title: "Notice of Intent published",
        description: "Federal Register notice",
        startedAt: "2026-01-01T00:00:00.000Z",
      },
      params,
    );

    assert.strictEqual(row.projectId, params.projectId);
    assert.strictEqual(row.userId, params.userId);
    assert.strictEqual(row.entityType, "project");
    assert.strictEqual(row.entityId, params.projectId);
    assert.strictEqual(row.entityName, params.projectName);
    assert.strictEqual(row.action, "created");
    assert.strictEqual(row.title, "Notice of Intent published");
    assert.strictEqual(row.description, "Federal Register notice");
    assert.strictEqual(row.changes, null);
    // isPublic defaults to true for historical public events.
    assert.strictEqual(row.isPublic, true);
    assert.ok(row.startedAt instanceof Date);
    assert.strictEqual(row.endedAt, null);
    assert.deepStrictEqual(row.metadata, {
      source: "mcp",
      actor: "hermes",
      backfilled: true,
    });
  });

  it("respects an explicit isPublic=false and null dates", () => {
    const row = buildEventRow(
      { title: "Internal note", isPublic: false },
      params,
    );
    assert.strictEqual(row.isPublic, false);
    assert.strictEqual(row.startedAt, null);
    assert.strictEqual(row.endedAt, null);
    assert.strictEqual(row.resourceUrls, null);
  });
});
