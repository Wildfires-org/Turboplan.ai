import { describe, expect, it } from "vitest";

import { createInMemoryRunRepository } from "../contracts/in-memory-run-repository";
import { createScriptedRunner } from "../contracts/scripted-runner";
import { authHeaders, createTestApp } from "../helpers/test-app";
import {
  type AppLike,
  waitForTerminalStatus,
} from "../helpers/wait-for-terminal";

async function startRun(
  app: AppLike,
  prompt = "hello",
): Promise<{ runId: string }> {
  const response = await app.fetch(
    new Request("http://localhost/api/agent/run", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        prompt,
        webhookSecret: "test-secret",
        targetApiUrl: "http://localhost:8789/api/webhooks/research-agent",
      }),
    }),
  );

  expect(response.status).toBe(202);
  return (await response.json()) as { runId: string };
}

describe("e2e run lifecycle API", () => {
  it("completes run through HTTP lifecycle", async () => {
    const runner = createScriptedRunner([{ kind: "success", data: "done" }]);
    const repository = createInMemoryRunRepository();
    const { app } = createTestApp(runner, repository);

    const { runId } = await startRun(
      app,
      "Prepare a concise implementation plan.",
    );
    const status = await waitForTerminalStatus(app, runId, {
      timeoutMs: 5000,
      intervalMs: 25,
    });

    expect(status.status).toBe("completed");
    expect(status.result).toBe("done");
  });

  it("cancels running run deterministically", async () => {
    const runner = createScriptedRunner([{ kind: "hangUntilAbort" }]);
    const repository = createInMemoryRunRepository();
    const { app } = createTestApp(runner, repository);

    const { runId } = await startRun(
      app,
      "Start long processing and wait for extra context.",
    );

    const cancelResponse = await app.fetch(
      new Request(`http://localhost/api/agent/run/${runId}/cancel`, {
        method: "POST",
        headers: authHeaders(),
      }),
    );
    expect(cancelResponse.status).toBe(200);

    const status = await waitForTerminalStatus(app, runId, {
      timeoutMs: 5000,
      intervalMs: 25,
    });
    expect(status.status).toBe("cancelled");
    expect(status.error?.msg).toContain("cancelled");
  });

  it("enforces resume rules for failed/completed runs", async () => {
    const runner = createScriptedRunner([
      { kind: "failure", error: { msg: "boom", status: 500 } },
      { kind: "success", data: "recovered" },
      { kind: "success", data: "completed-once" },
      { kind: "success", data: "completed-twice" },
    ]);
    const repository = createInMemoryRunRepository();
    const { app } = createTestApp(runner, repository);

    const failedRun = await startRun(
      app,
      "This run should fail first and succeed on resume.",
    );
    const failedStatus = await waitForTerminalStatus(app, failedRun.runId);
    expect(failedStatus.status).toBe("failed");

    const resumeFailed = await app.fetch(
      new Request(`http://localhost/api/agent/run/${failedRun.runId}/resume`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({}),
      }),
    );
    expect(resumeFailed.status).toBe(202);
    const resumedFailedStatus = await waitForTerminalStatus(
      app,
      failedRun.runId,
    );
    expect(resumedFailedStatus.status).toBe("completed");
    expect(resumedFailedStatus.result).toBe("recovered");

    const completedRun = await startRun(app, "will complete");
    const completedStatus = await waitForTerminalStatus(
      app,
      completedRun.runId,
    );
    expect(completedStatus.status).toBe("completed");

    const resumeWithoutPrompt = await app.fetch(
      new Request(
        `http://localhost/api/agent/run/${completedRun.runId}/resume`,
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({}),
        },
      ),
    );
    expect(resumeWithoutPrompt.status).toBe(400);

    const resumeWithPrompt = await app.fetch(
      new Request(
        `http://localhost/api/agent/run/${completedRun.runId}/resume`,
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ prompt: "continue please" }),
        },
      ),
    );
    expect(resumeWithPrompt.status).toBe(202);
    const resumedCompletedStatus = await waitForTerminalStatus(
      app,
      completedRun.runId,
    );
    expect(resumedCompletedStatus.status).toBe("completed");
    expect(resumedCompletedStatus.result).toBe("completed-twice");
  });

  it("accepts context while running and rejects after terminal", async () => {
    const runner = createScriptedRunner([{ kind: "hangUntilAbort" }]);
    const repository = createInMemoryRunRepository();
    const { app } = createTestApp(runner, repository);

    const { runId } = await startRun(app, "needs context");

    const addDuringRun = await app.fetch(
      new Request(`http://localhost/api/agent/run/${runId}/add-context`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ context: "extra info" }),
      }),
    );
    expect(addDuringRun.status).toBe(202);

    await app.fetch(
      new Request(`http://localhost/api/agent/run/${runId}/cancel`, {
        method: "POST",
        headers: authHeaders(),
      }),
    );
    await waitForTerminalStatus(app, runId);

    const addAfterTerminal = await app.fetch(
      new Request(`http://localhost/api/agent/run/${runId}/add-context`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ context: "too late" }),
      }),
    );
    expect(addAfterTerminal.status).toBe(409);
  });
});
