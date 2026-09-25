import assert from "node:assert";
import { describe, it } from "node:test";

import {
  BULK_TOOL_ITEM_ARGUMENTS,
  exceedsUploadCallLimit,
  extractToolCall,
  getToolCallCharge,
  MAX_CHARGE_PER_TOOL_CALL,
} from "../src/utils/request-charges.js";

const toolCall = (name: string, args: unknown = {}) => ({
  jsonrpc: "2.0",
  id: 1,
  method: "tools/call",
  params: { name, arguments: args },
});

const items = (count: number) => Array.from({ length: count }, () => ({}));

describe("extractToolCall", () => {
  it("returns name and arguments for a tools/call element", () => {
    const call = extractToolCall(toolCall("get_project", { projectId: "p" }));
    assert.deepStrictEqual(call, {
      name: "get_project",
      args: { projectId: "p" },
    });
  });

  it("returns null for non tools/call methods and malformed elements", () => {
    assert.strictEqual(extractToolCall({ method: "tools/list" }), null);
    assert.strictEqual(extractToolCall(null), null);
    assert.strictEqual(extractToolCall("tools/call"), null);
    assert.strictEqual(
      extractToolCall({ method: "tools/call", params: { name: 42 } }),
      null,
    );
  });

  it("defaults missing or non-object arguments to an empty object", () => {
    assert.deepStrictEqual(
      extractToolCall({ method: "tools/call", params: { name: "ping" } })?.args,
      {},
    );
    assert.deepStrictEqual(
      extractToolCall(toolCall("create_timeline_events", [1, 2]))?.args,
      {},
    );
  });
});

describe("getToolCallCharge", () => {
  it("charges one token for single-item tools", () => {
    assert.strictEqual(
      getToolCallCharge({ name: "create_task", args: { title: "x" } }),
      1,
    );
    assert.strictEqual(
      getToolCallCharge({ name: "upload_document_from_url", args: {} }),
      1,
    );
  });

  it("charges one token per item for each bulk tool", () => {
    const cases: Array<[string, string, number]> = [
      ["upload_documents_from_urls", "documents", 8],
      ["create_timeline_events", "events", 30],
      ["add_project_fields", "fields", 20],
      ["add_project_context_entries", "entries", 20],
      ["create_milestone", "tasks", 12],
    ];
    for (const [name, key, count] of cases) {
      assert.strictEqual(BULK_TOOL_ITEM_ARGUMENTS[name], key);
      assert.strictEqual(
        getToolCallCharge({ name, args: { [key]: items(count) } }),
        count,
        name,
      );
    }
  });

  it("charges at least one token when the item array is missing or empty", () => {
    assert.strictEqual(
      getToolCallCharge({ name: "create_milestone", args: { title: "M" } }),
      1,
    );
    assert.strictEqual(
      getToolCallCharge({ name: "add_project_fields", args: { fields: [] } }),
      1,
    );
    assert.strictEqual(
      getToolCallCharge({
        name: "create_timeline_events",
        args: { events: "nope" },
      }),
      1,
    );
  });

  it("caps the charge for oversized arrays", () => {
    assert.strictEqual(
      getToolCallCharge({
        name: "create_timeline_events",
        args: { events: items(10_000) },
      }),
      MAX_CHARGE_PER_TOOL_CALL,
    );
  });
});

describe("exceedsUploadCallLimit", () => {
  const call = (name: string) => ({ name, args: {} });

  it("allows a single upload call alongside other calls", () => {
    assert.strictEqual(
      exceedsUploadCallLimit([
        call("upload_documents_from_urls"),
        call("create_task"),
        call("get_project"),
      ]),
      false,
    );
    assert.strictEqual(exceedsUploadCallLimit([]), false);
  });

  it("rejects more than one upload call in a request", () => {
    assert.strictEqual(
      exceedsUploadCallLimit([
        call("upload_document_from_url"),
        call("upload_document_from_content"),
      ]),
      true,
    );
    assert.strictEqual(
      exceedsUploadCallLimit([
        call("upload_documents_from_urls"),
        call("upload_documents_from_urls"),
      ]),
      true,
    );
  });
});
