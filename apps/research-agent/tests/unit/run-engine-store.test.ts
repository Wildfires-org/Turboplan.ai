import { describe, expect, it } from "vitest";

import type {
  AgentRunner,
  RunnerContext,
  RunnerInputMessage,
  RunnerResult,
} from "../../src/runners/types";
import { createRunEngine } from "../../src/runs/run-engine";
import type {
  AgentRunState,
  RunEngineCallbacks,
  RunStatus,
} from "../../src/runs/types";
import { createInMemoryRunRepository } from "../contracts/in-memory-run-repository";
import { waitForRunCompletion } from "../helpers/wait-for-store-completion";

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function createTestCallbacks(
  repository: ReturnType<typeof createInMemoryRunRepository>,
  onCompleted?: (state: AgentRunState) => void,
): RunEngineCallbacks {
  return {
    onStatusChange: (runId, status, data) =>
      repository.updateStatus(runId, status, data).then(() => {}),
    onSandboxCreated: (_runId, _sandboxId) => Promise.resolve(),
    onLogsFlush: (runId, logs) => repository.appendLogs(runId, logs),
    onRunCompleted: onCompleted ?? (() => {}),
    onProgress: (_runId, _role, _content) => Promise.resolve(),
  };
}

describe("run-engine runtime messages", () => {
  it("queues add-context before run starts and flushes when running", async () => {
    const sentMessages: Array<{ runId: string; message: RunnerInputMessage }> =
      [];
    const deferred = createDeferred<{ ok: true; data: string }>();
    const runner: AgentRunner = {
      async run(_prompt: string, _signal?: AbortSignal, _ctx?: RunnerContext) {
        return deferred.promise;
      },
      async sendMessage(runId: string, message: RunnerInputMessage) {
        sentMessages.push({ runId, message });
      },
    };

    const repository = createInMemoryRunRepository();
    const engine = createRunEngine(runner, createTestCallbacks(repository));
    const runId = crypto.randomUUID();

    await repository.create({ runId, prompt: "start prompt" });

    const run = engine.createRun("start prompt", {
      runId,
      webhookSecret: "test",
    });

    const dispatchResult = engine.addContext(run.runId, "first context");
    expect(dispatchResult.ok).toBe(true);

    await Promise.resolve();
    expect(sentMessages).toEqual([
      {
        runId: run.runId,
        message: { type: "context", content: "first context" },
      },
    ]);

    deferred.resolve({ ok: true, data: "done" });
    await waitForRunCompletion(repository, run.runId, 2000);
  });

  it("rejects add-context for terminal runs", async () => {
    const runner: AgentRunner = {
      async run() {
        return { ok: true, data: "done" };
      },
      async sendMessage() {
        return;
      },
    };
    const repository = createInMemoryRunRepository();
    const engine = createRunEngine(runner, createTestCallbacks(repository));
    const runId = crypto.randomUUID();

    await repository.create({ runId, prompt: "start prompt" });

    const run = engine.createRun("start prompt", {
      runId,
      webhookSecret: "test",
    });
    await waitForRunCompletion(repository, run.runId, 2000);

    const dispatchResult = engine.addContext(run.runId, "late context");
    expect(dispatchResult.ok).toBe(false);
  });

  it("resumes terminal run under same runId", async () => {
    const sentMessages: Array<{ runId: string; message: RunnerInputMessage }> =
      [];
    const deferred = createDeferred<{ ok: true; data: string }>();
    let executionCount = 0;
    const runner: AgentRunner = {
      async run(_prompt: string, _signal?: AbortSignal, _ctx?: RunnerContext) {
        executionCount += 1;
        if (executionCount === 1) {
          return { ok: true, data: "done" };
        }
        return deferred.promise;
      },
      async sendMessage(runId: string, message: RunnerInputMessage) {
        sentMessages.push({ runId, message });
      },
    };
    const repository = createInMemoryRunRepository();
    const engine = createRunEngine(runner, createTestCallbacks(repository));
    const runId = crypto.randomUUID();

    await repository.create({ runId, prompt: "start prompt" });

    const run = engine.createRun("start prompt", {
      runId,
      webhookSecret: "test",
    });
    await waitForRunCompletion(repository, run.runId, 2000);

    const resumed = engine.resumeRun({
      runId: run.runId,
      prompt: "resume prompt",
    });
    expect(resumed.ok).toBe(true);

    deferred.resolve({ ok: true, data: "done-again" });
    await waitForRunCompletion(repository, run.runId, 2000);
  });
});

describe("run-engine completion timeout behavior", () => {
  it("calls onRunCompleted exactly once when a running run is cancelled", async () => {
    const deferred = createDeferred<RunnerResult>();
    const runner: AgentRunner = {
      async run(_prompt: string, signal?: AbortSignal) {
        if (signal) {
          signal.addEventListener("abort", () => {
            deferred.resolve({
              ok: false,
              error: { msg: "aborted", status: 500 },
            });
          });
        }
        return deferred.promise;
      },
      async sendMessage() {},
    };
    const repository = createInMemoryRunRepository();
    const completedStates: AgentRunState[] = [];
    const engine = createRunEngine(
      runner,
      createTestCallbacks(repository, (state) => completedStates.push(state)),
    );
    const runId = crypto.randomUUID();

    await repository.create({ runId, prompt: "cancel prompt" });

    const run = engine.createRun("cancel prompt", {
      runId,
      webhookSecret: "test",
    });

    // Wait for run to start
    await Promise.resolve();

    await engine.cancelRun(run.runId);

    // Let executeRun catch block finish
    await waitForRunCompletion(repository, run.runId, 2000);

    expect(completedStates).toHaveLength(1);
    expect(completedStates[0].status).toBe("cancelled");
  });

  it("exposes cancelled terminal state after cancelRun", async () => {
    const deferred = createDeferred<RunnerResult>();
    const runner: AgentRunner = {
      async run(_prompt: string, signal?: AbortSignal) {
        if (signal) {
          signal.addEventListener("abort", () => {
            deferred.resolve({
              ok: false,
              error: { msg: "aborted", status: 500 },
            });
          });
        }
        return deferred.promise;
      },
      async sendMessage() {},
    };
    const repository = createInMemoryRunRepository();
    const engine = createRunEngine(runner, createTestCallbacks(repository));
    const runId = crypto.randomUUID();

    await repository.create({ runId, prompt: "cancel prompt" });

    const run = engine.createRun("cancel prompt", {
      runId,
      webhookSecret: "test",
    });

    const cancelResult = await engine.cancelRun(run.runId);
    expect(cancelResult.cancelled).toBe(true);

    const record = await repository.getByRunId(run.runId);
    expect(record?.status as RunStatus).toBe("cancelled");
  });
});
