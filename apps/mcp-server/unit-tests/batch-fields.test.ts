import assert from "node:assert";
import { describe, it } from "node:test";

// getCommonEnv caches on first call, so the full env must be in place before
// importing any tool module (they pull in the db client + env packages).
process.env.AUTH_SECRET = "test-secret";
process.env.POSTGRES_URL = "postgresql://test";
process.env.TURBOPLAN_URL = "https://app.example.test";
process.env.LANDING_URL = "https://landing.example.test";
process.env.IS_TASKS_PACKAGE_ENABLED = "false";
process.env.IS_MAPS_PACKAGE_ENABLED = "false";
process.env.IS_RESEARCH_AGENT_INTEGRATION_PACKAGE_ENABLED = "false";
process.env.IS_PROJECT_CONTEXT_PACKAGE_ENABLED = "false";

const { addProjectFieldsSchema, MAX_FIELDS_PER_BATCH } = await import(
  "../src/tools/fields.js"
);

describe("add_project_fields input schema", () => {
  it("accepts a happy-path multi-item batch and applies per-item defaults", () => {
    const result = addProjectFieldsSchema.safeParse([
      { name: "Region", type: "text", values: ["Southwest"] },
      { name: "Status", type: "list", values: ["Draft", "Final"] },
    ]);

    assert.strictEqual(result.success, true);
    if (!result.success) {
      return;
    }
    assert.strictEqual(result.data.length, 2);
    // isRequired defaults to false and values defaults to [] like the singular.
    assert.strictEqual(result.data[0].isRequired, false);
    assert.deepStrictEqual(result.data[1].values, ["Draft", "Final"]);
  });

  it("defaults values to [] when omitted", () => {
    const result = addProjectFieldsSchema.safeParse([
      { name: "Notes", type: "text" },
    ]);
    assert.strictEqual(result.success, true);
    if (!result.success) {
      return;
    }
    assert.deepStrictEqual(result.data[0].values, []);
  });

  it("rejects the whole batch when one item is invalid (all-or-nothing gate)", () => {
    const result = addProjectFieldsSchema.safeParse([
      { name: "Valid", type: "text" },
      { name: "", type: "text" }, // empty name is invalid
    ]);
    assert.strictEqual(result.success, false);
  });

  it("rejects an item with an invalid type", () => {
    const result = addProjectFieldsSchema.safeParse([
      { name: "Bad", type: "number" },
    ]);
    assert.strictEqual(result.success, false);
  });

  it("rejects an empty batch", () => {
    const result = addProjectFieldsSchema.safeParse([]);
    assert.strictEqual(result.success, false);
  });

  it("rejects a batch that exceeds the per-call cap", () => {
    const tooMany = Array.from(
      { length: MAX_FIELDS_PER_BATCH + 1 },
      (_, i) => ({
        name: `Field ${i}`,
        type: "text" as const,
      }),
    );
    const result = addProjectFieldsSchema.safeParse(tooMany);
    assert.strictEqual(result.success, false);
  });

  it("accepts exactly the per-call cap", () => {
    const exactly = Array.from({ length: MAX_FIELDS_PER_BATCH }, (_, i) => ({
      name: `Field ${i}`,
      type: "text" as const,
    }));
    const result = addProjectFieldsSchema.safeParse(exactly);
    assert.strictEqual(result.success, true);
  });
});
