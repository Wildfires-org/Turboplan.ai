import assert from "node:assert";
import { describe, it } from "node:test";

import { computeChanges } from "../src/server/diff";
import type { FieldDefinition } from "../src/types";

describe("computeChanges", () => {
  it("should return empty array when objects are identical", () => {
    const fieldDefs: FieldDefinition[] = [
      { field: "title", valueType: "text" },
      { field: "status", valueType: "enum" },
    ];
    const obj = { title: "Test", status: "active" };
    const result = computeChanges(obj, obj, fieldDefs);
    assert.deepStrictEqual(result, []);
  });

  it("should detect text field changes", () => {
    const fieldDefs: FieldDefinition[] = [
      { field: "title", valueType: "text" },
    ];
    const result = computeChanges(
      { title: "Old Title" },
      { title: "New Title" },
      fieldDefs,
    );
    assert.deepStrictEqual(result, [
      {
        field: "title",
        previousValue: "Old Title",
        newValue: "New Title",
        valueType: "text",
      },
    ]);
  });

  it("should detect number field changes", () => {
    const fieldDefs: FieldDefinition[] = [
      { field: "order", valueType: "number" },
    ];
    const result = computeChanges({ order: 1 }, { order: 2 }, fieldDefs);
    assert.deepStrictEqual(result, [
      { field: "order", previousValue: 1, newValue: 2, valueType: "number" },
    ]);
  });

  it("should detect boolean field changes", () => {
    const fieldDefs: FieldDefinition[] = [
      { field: "isPublic", valueType: "boolean" },
    ];
    const result = computeChanges(
      { isPublic: false },
      { isPublic: true },
      fieldDefs,
    );
    assert.deepStrictEqual(result, [
      {
        field: "isPublic",
        previousValue: false,
        newValue: true,
        valueType: "boolean",
      },
    ]);
  });

  it("should detect enum field changes", () => {
    const fieldDefs: FieldDefinition[] = [
      { field: "status", valueType: "enum" },
    ];
    const result = computeChanges(
      { status: "draft" },
      { status: "completed" },
      fieldDefs,
    );
    assert.deepStrictEqual(result, [
      {
        field: "status",
        previousValue: "draft",
        newValue: "completed",
        valueType: "enum",
      },
    ]);
  });

  it("should detect date field changes", () => {
    const fieldDefs: FieldDefinition[] = [
      { field: "dueDate", valueType: "date" },
    ];
    const oldDate = new Date("2025-01-01");
    const newDate = new Date("2025-06-01");
    const result = computeChanges(
      { dueDate: oldDate },
      { dueDate: newDate },
      fieldDefs,
    );
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].field, "dueDate");
    assert.strictEqual(result[0].valueType, "date");
  });

  it("should treat identical dates as equal", () => {
    const fieldDefs: FieldDefinition[] = [
      { field: "dueDate", valueType: "date" },
    ];
    const date1 = new Date("2025-01-01");
    const date2 = new Date("2025-01-01");
    const result = computeChanges(
      { dueDate: date1 },
      { dueDate: date2 },
      fieldDefs,
    );
    assert.deepStrictEqual(result, []);
  });

  it("should detect array (users) field changes", () => {
    const fieldDefs: FieldDefinition[] = [
      { field: "assigneeIds", valueType: "users" },
    ];
    const result = computeChanges(
      { assigneeIds: ["user-1"] },
      { assigneeIds: ["user-1", "user-2"] },
      fieldDefs,
    );
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].field, "assigneeIds");
    assert.deepStrictEqual(result[0].previousValue, ["user-1"]);
    assert.deepStrictEqual(result[0].newValue, ["user-1", "user-2"]);
  });

  it("should treat identical arrays as equal", () => {
    const fieldDefs: FieldDefinition[] = [
      { field: "assigneeIds", valueType: "users" },
    ];
    const result = computeChanges(
      { assigneeIds: ["user-1", "user-2"] },
      { assigneeIds: ["user-1", "user-2"] },
      fieldDefs,
    );
    assert.deepStrictEqual(result, []);
  });

  it("should detect JSON field changes", () => {
    const fieldDefs: FieldDefinition[] = [
      { field: "hiddenModules", valueType: "json" },
    ];
    const result = computeChanges(
      { hiddenModules: ["tasks"] },
      { hiddenModules: ["tasks", "maps"] },
      fieldDefs,
    );
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].field, "hiddenModules");
  });

  it("should handle creation (null old object)", () => {
    const fieldDefs: FieldDefinition[] = [
      { field: "title", valueType: "text" },
      { field: "status", valueType: "enum" },
    ];
    const result = computeChanges(
      null,
      { title: "New", status: "active" },
      fieldDefs,
    );
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].previousValue, null);
    assert.strictEqual(result[0].newValue, "New");
    assert.strictEqual(result[1].previousValue, null);
    assert.strictEqual(result[1].newValue, "active");
  });

  it("should handle deletion (null new object)", () => {
    const fieldDefs: FieldDefinition[] = [
      { field: "title", valueType: "text" },
    ];
    const result = computeChanges({ title: "Deleted" }, null, fieldDefs);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].previousValue, "Deleted");
    assert.strictEqual(result[0].newValue, null);
  });

  it("should only track fields in the definition map", () => {
    const fieldDefs: FieldDefinition[] = [
      { field: "title", valueType: "text" },
    ];
    const result = computeChanges(
      { title: "Same", description: "Old Desc" },
      { title: "Same", description: "New Desc" },
      fieldDefs,
    );
    assert.deepStrictEqual(result, []);
  });

  it("should handle multiple changes at once", () => {
    const fieldDefs: FieldDefinition[] = [
      { field: "title", valueType: "text" },
      { field: "status", valueType: "enum" },
      { field: "order", valueType: "number" },
    ];
    const result = computeChanges(
      { title: "Old", status: "draft", order: 1 },
      { title: "New", status: "active", order: 1 },
      fieldDefs,
    );
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].field, "title");
    assert.strictEqual(result[1].field, "status");
  });

  it("should treat null and undefined as equal", () => {
    const fieldDefs: FieldDefinition[] = [
      { field: "description", valueType: "text" },
    ];
    const result = computeChanges(
      { description: null },
      { description: undefined },
      fieldDefs,
    );
    assert.deepStrictEqual(result, []);
  });

  it("should detect role field changes", () => {
    const fieldDefs: FieldDefinition[] = [{ field: "role", valueType: "role" }];
    const result = computeChanges(
      { role: "viewer" },
      { role: "editor" },
      fieldDefs,
    );
    assert.deepStrictEqual(result, [
      {
        field: "role",
        previousValue: "viewer",
        newValue: "editor",
        valueType: "role",
      },
    ]);
  });
});
