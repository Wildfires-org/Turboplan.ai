import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getProgressRunStatus } from "../src/server/bootstrapper/progress-status";
import { bootstrapperProgressSchema } from "../src/server/schemas";
import { ResearchAgentChatStatus } from "../src/types";

const PROGRESS = { runId: "run-1", message: "Research agent done!" };

describe("getProgressRunStatus", () => {
  it("keeps the run running for ordinary progress", () => {
    assert.equal(
      getProgressRunStatus(undefined),
      ResearchAgentChatStatus.RUNNING,
    );
  });

  it("completes the run when the agent reports it completed", () => {
    assert.equal(
      getProgressRunStatus("completed"),
      ResearchAgentChatStatus.COMPLETED,
    );
  });

  it("fails the run when the agent reports it failed or cancelled", () => {
    assert.equal(
      getProgressRunStatus("failed"),
      ResearchAgentChatStatus.FAILED,
    );
    assert.equal(
      getProgressRunStatus("cancelled"),
      ResearchAgentChatStatus.FAILED,
    );
  });
});

describe("bootstrapperProgressSchema", () => {
  it("accepts progress without a status (agents that predate the field)", () => {
    const result = bootstrapperProgressSchema.safeParse(PROGRESS);
    assert.equal(result.success, true);
    assert.equal(result.data?.status, undefined);
  });

  it("accepts every terminal outcome", () => {
    for (const status of ["completed", "failed", "cancelled"] as const) {
      const result = bootstrapperProgressSchema.safeParse({
        ...PROGRESS,
        status,
      });
      assert.equal(result.success, true);
      assert.equal(result.data?.status, status);
    }
  });

  it("rejects an unknown status", () => {
    const result = bootstrapperProgressSchema.safeParse({
      ...PROGRESS,
      status: "running",
    });
    assert.equal(result.success, false);
  });

  it("is ignored by the pre-status schema, so new agents work with old web", () => {
    const legacySchema = bootstrapperProgressSchema.omit({ status: true });
    const result = legacySchema.safeParse({ ...PROGRESS, status: "completed" });
    assert.equal(result.success, true);
    assert.deepEqual(result.data, PROGRESS);
  });
});
