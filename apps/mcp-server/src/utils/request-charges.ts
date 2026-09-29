// Pure helpers the Worker entry uses to price a JSON-RPC request before
// dispatching it. Kept free of runtime imports so they are unit-testable.

export type ToolCall = {
  name: string;
  args: Record<string, unknown>;
};

// Bulk tools and the argument array whose length is the number of items the
// call creates. Keep in sync with the tool schemas in src/tools/*.ts.
export const BULK_TOOL_ITEM_ARGUMENTS: Record<string, string> = {
  upload_documents_from_urls: "documents",
  create_timeline_events: "events",
  add_project_fields: "fields",
  add_project_context_entries: "entries",
  create_milestone: "tasks",
};

// Upper bound on tokens one tools/call can be charged. Equal to the WRITE
// bucket's per-minute limit (wrangler.toml) so the largest legitimate call
// (30 timeline events, 30 nested tasks) still fits in an empty bucket, while
// an oversized array (rejected later by the tool schema) cannot spin the
// charging loop.
export const MAX_CHARGE_PER_TOOL_CALL = 30;

// Each upload holds a downloaded/decoded file in isolate memory. The SDK runs
// JSON-RPC batch elements concurrently, so cap uploads per HTTP request.
export const MAX_UPLOAD_CALLS_PER_REQUEST = 1;

const UPLOAD_TOOL_PREFIX = "upload_";

/** Extract name + arguments from one JSON-RPC element (null if not tools/call). */
export const extractToolCall = (element: unknown): ToolCall | null => {
  if (typeof element !== "object" || element === null) {
    return null;
  }
  const el = element as Record<string, unknown>;
  if (el.method !== "tools/call") {
    return null;
  }
  const params = el.params;
  if (typeof params !== "object" || params === null) {
    return null;
  }
  const { name, arguments: args } = params as Record<string, unknown>;
  if (typeof name !== "string") {
    return null;
  }
  const safeArgs =
    typeof args === "object" && args !== null && !Array.isArray(args)
      ? (args as Record<string, unknown>)
      : {};
  return { name, args: safeArgs };
};

/**
 * Number of rate-limiter tokens a tools/call costs: the item count for bulk
 * tools, 1 for everything else. Always within [1, MAX_CHARGE_PER_TOOL_CALL].
 */
export const getToolCallCharge = (call: ToolCall): number => {
  const itemKey = BULK_TOOL_ITEM_ARGUMENTS[call.name];
  if (!itemKey) {
    return 1;
  }
  const items = call.args[itemKey];
  if (!Array.isArray(items)) {
    return 1;
  }
  return Math.min(Math.max(items.length, 1), MAX_CHARGE_PER_TOOL_CALL);
};

export const isUploadTool = (name: string): boolean =>
  name.startsWith(UPLOAD_TOOL_PREFIX);

/** True when the request carries more upload tools/calls than allowed. */
export const exceedsUploadCallLimit = (calls: ToolCall[]): boolean =>
  calls.filter((call) => isUploadTool(call.name)).length >
  MAX_UPLOAD_CALLS_PER_REQUEST;
