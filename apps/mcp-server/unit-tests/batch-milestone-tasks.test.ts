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

const { nestedTasksSchema, MAX_TASKS_PER_MILESTONE_BATCH } = await import(
  "../src/tools/milestones.js"
);

describe("create_milestone nested tasks schema", () => {
  it("is optional — omitting tasks is valid (backward compatible)", () => {
    const result = nestedTasksSchema.safeParse(undefined);
    assert.strictEqual(result.success, true);
  });

  it("accepts a happy-path multi-task batch", () => {
    const result = nestedTasksSchema.safeParse([
      { title: "Draft scoping report" },
      {
        title: "Publish notice",
        description: "Federal Register",
        status: "in_progress",
        startDate: "2026-01-01T00:00:00.000Z",
        dueDate: "2026-01-15T00:00:00.000Z",
      },
    ]);
    assert.strictEqual(result.success, true);
    if (!result.success) {
      return;
    }
    assert.strictEqual(result.data?.length, 2);
  });

  it("rejects the whole array when one task has an empty title (all-or-nothing gate)", () => {
    const result = nestedTasksSchema.safeParse([
      { title: "Valid" },
      { title: "" },
    ]);
    assert.strictEqual(result.success, false);
  });

  it("rejects a task with an invalid status", () => {
    const result = nestedTasksSchema.safeParse([
      { title: "Bad status", status: "archived" },
    ]);
    assert.strictEqual(result.success, false);
  });

  it("rejects a task array that exceeds the per-milestone cap", () => {
    const tooMany = Array.from(
      { length: MAX_TASKS_PER_MILESTONE_BATCH + 1 },
      (_, i) => ({ title: `Task ${i}` }),
    );
    const result = nestedTasksSchema.safeParse(tooMany);
    assert.strictEqual(result.success, false);
  });

  it("accepts exactly the per-milestone cap", () => {
    const exactly = Array.from(
      { length: MAX_TASKS_PER_MILESTONE_BATCH },
      (_, i) => ({ title: `Task ${i}` }),
    );
    const result = nestedTasksSchema.safeParse(exactly);
    assert.strictEqual(result.success, true);
  });
});
