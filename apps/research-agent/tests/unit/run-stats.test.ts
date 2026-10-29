import { describe, expect, it } from "vitest";

import { parseWireMessage } from "../../src/agent-runtime/wire-protocol";
import { parseOutputLine } from "../../src/runners/utils/runner-parsers";
import {
  parseStoredResult,
  serializeRunResult,
} from "../../src/runs/utils/parse-stored-result";

const stats = { num_turns: 21, duration_ms: 241_000, total_cost_usd: 1.23 };

describe("run stats on the agent output wire", () => {
  it("parses result and error lines with and without stats", () => {
    expect(
      parseOutputLine(JSON.stringify({ type: "result", result: "ok", stats })),
    ).toEqual({ type: "result", result: "ok", stats });
    expect(
      parseOutputLine(JSON.stringify({ type: "result", result: "ok" })),
    ).toEqual({ type: "result", result: "ok" });
    expect(
      parseOutputLine(
        JSON.stringify({
          type: "error",
          msg: "error_max_turns",
          status: 500,
          stats,
        }),
      ),
    ).toEqual({ type: "error", msg: "error_max_turns", status: 500, stats });
  });
});

describe("stored run result", () => {
  it("round-trips the result text with stats", () => {
    const stored = serializeRunResult("final answer", stats);
    expect(JSON.parse(stored)).toEqual({ result: "final answer", stats });
    expect(parseStoredResult(stored)).toBe("final answer");
  });

  it("keeps the legacy bare-string shape without stats", () => {
    const stored = serializeRunResult("final answer");
    expect(stored).toBe(JSON.stringify("final answer"));
    expect(parseStoredResult(stored)).toBe("final answer");
  });
});

describe("start wire message", () => {
  it("carries the skill when present", () => {
    expect(
      parseWireMessage(
        JSON.stringify({
          type: "start",
          prompt: "p",
          skill: "project-bootstrapper",
        }),
      ),
    ).toEqual({ type: "start", prompt: "p", skill: "project-bootstrapper" });
    expect(
      parseWireMessage(JSON.stringify({ type: "start", prompt: "p" })),
    ).toEqual({ type: "start", prompt: "p" });
  });
});
