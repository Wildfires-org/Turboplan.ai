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

const { addProjectContextEntriesSchema, MAX_CONTEXT_ENTRIES_PER_BATCH } =
  await import("../src/tools/context.js");

describe("add_project_context_entries input schema", () => {
  it("accepts a happy-path multi-item batch", () => {
    const result = addProjectContextEntriesSchema.safeParse([
      { label: "Regulatory Background", content: "NEPA applies." },
      {
        label: "Environmental Analysis",
        content: "Sensitive habitat nearby.",
        url: "https://example.test/report.pdf",
      },
    ]);
    assert.strictEqual(result.success, true);
    if (!result.success) {
      return;
    }
    assert.strictEqual(result.data.length, 2);
    assert.strictEqual(result.data[1].url, "https://example.test/report.pdf");
  });

  it("rejects the whole batch when one entry has empty content (all-or-nothing gate)", () => {
    const result = addProjectContextEntriesSchema.safeParse([
      { label: "Ok", content: "has content" },
      { label: "Bad", content: "" },
    ]);
    assert.strictEqual(result.success, false);
  });

  it("rejects an entry with an invalid URL", () => {
    const result = addProjectContextEntriesSchema.safeParse([
      { label: "Bad URL", content: "text", url: "not-a-url" },
    ]);
    assert.strictEqual(result.success, false);
  });

  it("rejects an empty batch", () => {
    const result = addProjectContextEntriesSchema.safeParse([]);
    assert.strictEqual(result.success, false);
  });

  it("rejects a batch that exceeds the per-call cap", () => {
    const tooMany = Array.from(
      { length: MAX_CONTEXT_ENTRIES_PER_BATCH + 1 },
      (_, i) => ({ label: `Entry ${i}`, content: "text" }),
    );
    const result = addProjectContextEntriesSchema.safeParse(tooMany);
    assert.strictEqual(result.success, false);
  });
});
