/**
 * Agent run orchestration engine.
 * Manages the lifecycle of runs: creation, execution, messaging, cancellation.
 * Communicates state changes via callbacks — has no direct DB dependency.
 */

import { logger } from "../infra/logger";
import type {
  AgentRunner,
  RunnerInputMessage,
  RunnerResult,
} from "../runners/types";
import { createRunEngineStore, type RunRecord } from "./run-engine-store";
import {
  type AgentRunState,
  type CancelResult,
  type ResumeResult,
  type RunEngine,
  type RunEngineCallbacks,
  type RunStatus,
  type RuntimeMessageResult,
} from "./types";
import { toRunRecordContext } from "./utils/to-run-context";

export function createRunEngine(
  runner: AgentRunner,
  callbacks: RunEngineCallbacks,
): RunEngine {
  const store = createRunEngineStore((runId, logs) => {
    callbacks.onLogsFlush(runId, logs).catch((err) => {
      logger.error(`Failed to auto-flush logs for run ${runId}`, err, {
        runId,
      });
    });
  });

  // ── Helpers ───────────────────────────────────────────────────────

  const flushRemainingLogs = async (runId: string): Promise<void> => {
    const logs = store.flushLogs(runId);
    if (logs.length > 0) {
      try {
        await callbacks.onLogsFlush(runId, logs);
      } catch (err) {
        logger.error(`Failed to flush logs for run ${runId}`, err, { runId });
      }
    }
  };

  // Both cancelRun and executeRun may race to complete the same run.
  // The `completed` flag ensures only the first caller flushes logs,
  // fires the completion callback, and removes the run from the store.
  const handleCompleted = async (
    runId: string,
    state: AgentRunState,
  ): Promise<void> => {
    const run = store.get(runId);
    if (!run || run.completed) return;
    run.completed = true;

    await flushRemainingLogs(runId);
    callbacks.onRunCompleted(state, toRunRecordContext(run));
    store.remove(runId);
  };

  // ── Shared result handling ──────────────────────────────────────────

  /** Build the progress/sandboxCreated context callbacks for a run. */
  const makeRunnerContext = (
    runId: string,
    run: RunRecord,
    pendingInserts: Promise<void>[],
  ) => ({
    runId,
    projectId: run.projectId,
    webhookSecret: run.webhookSecret,
    targetApiUrl: run.targetApiUrl,
    onProgress: (message: { role: string; content: string }) => {
      const insert = callbacks
        .onProgress(runId, message.role, message.content)
        .catch((err) => {
          logger.error(`Failed to persist progress for run ${runId}`, err, {
            runId,
          });
        });
      pendingInserts.push(insert);
    },
    onSandboxCreated: (sandboxId: string) => {
      callbacks.onSandboxCreated(runId, sandboxId).catch((err) => {
        logger.error(`Failed to persist sandboxId for run ${runId}`, err, {
          runId,
        });
      });
    },
  });

  /** Process runner result: update status, flush progress, finalize. */
  const finalizeRun = async (
    runId: string,
    run: RunRecord,
    resultPromise: Promise<RunnerResult>,
    pendingInserts: Promise<void>[],
  ): Promise<void> => {
    let finalState: AgentRunState;

    try {
      const result = await resultPromise;

      // Guard: cancelRun already handled completion
      if (run.abortController.signal.aborted) return;

      if (result.ok) {
        await callbacks.onStatusChange(runId, "completed", {
          resultJson: result.data ? JSON.stringify(result.data) : undefined,
        });
        store.addLog(runId, "Run completed successfully");
        finalState = {
          runId,
          status: "completed",
          result: result.data,
        };
      } else {
        await callbacks.onStatusChange(runId, "failed", {
          errorJson: JSON.stringify(result.error),
        });
        store.addLog(runId, `Run failed: ${result.error.msg}`);
        finalState = {
          runId,
          status: "failed",
          error: result.error,
        };
      }
    } catch (err) {
      // Cancelled — handleCompleted was already called by cancelRun
      if (run.abortController.signal.aborted) return;

      const message = err instanceof Error ? err.message : String(err);
      await callbacks.onStatusChange(runId, "failed", {
        errorJson: JSON.stringify({ msg: message, status: 500 }),
      });
      store.addLog(runId, `Run failed: ${message}`);
      finalState = {
        runId,
        status: "failed",
        error: { msg: message, status: 500 },
      };
    }

    await Promise.allSettled(pendingInserts);
    await handleCompleted(runId, finalState);
  };

  // ── Execution ────────────────────────────────────────────────────────

  const executeRun = async (runId: string): Promise<void> => {
    const run = store.get(runId);
    if (!run) return;

    const pendingInserts: Promise<void>[] = [];
    const context = makeRunnerContext(runId, run, pendingInserts);

    // Start the runner first (spawn is synchronous) so it can receive
    // messages immediately — before yielding to any async status update.
    const runPromise = runner.run(
      run.prompt,
      run.abortController.signal,
      context,
    );

    await callbacks.onStatusChange(runId, "running");
    store.addLog(runId, "Run started");

    await finalizeRun(runId, run, runPromise, pendingInserts);
  };

  const executeAdoptedRun = async (
    runId: string,
    sandboxId: string,
  ): Promise<void> => {
    const run = store.get(runId);
    if (!run) return;

    // attach is optional on AgentRunner (local runner doesn't implement it).
    // If missing, fail the run gracefully instead of crashing
    // (e.g. mark the run as failed in DB and clean up the store entry.)
    if (!runner.attach) {
      store.addLog(runId, "Runner does not support attach — cannot adopt");
      await callbacks.onStatusChange(runId, "failed", {
        errorJson: JSON.stringify({
          msg: "Runner does not support reattaching to sandboxes",
          status: 500,
        }),
      });
      await handleCompleted(runId, {
        runId,
        status: "failed",
        error: {
          msg: "Runner does not support reattaching to sandboxes",
          status: 500,
        },
      });
      return;
    }

    const pendingInserts: Promise<void>[] = [];
    const context = makeRunnerContext(runId, run, pendingInserts);

    const attachPromise = runner.attach(
      sandboxId,
      run.abortController.signal,
      context,
    );

    store.addLog(
      runId,
      `Reattached to sandbox ${sandboxId} after server restart`,
    );

    await finalizeRun(runId, run, attachPromise, pendingInserts);
  };

  // ── Lifecycle: create, resume, adopt ──────────────────────────────

  const createRun = (
    prompt: string,
    options: {
      runId: string;
      webhookSecret: string;
      projectId?: string;
      targetApiUrl?: string;
    },
  ): { runId: string; status: RunStatus } => {
    store.create({
      runId: options.runId,
      prompt,
      projectId: options.projectId,
      webhookSecret: options.webhookSecret,
      targetApiUrl: options.targetApiUrl,
    });

    store.addLog(options.runId, "Run created");

    void executeRun(options.runId);

    return { runId: options.runId, status: "created" };
  };

  const resumeRun = (input: {
    runId: string;
    prompt: string;
    projectId?: string;
    webhookSecret?: string;
    targetApiUrl?: string;
  }): ResumeResult => {
    if (store.get(input.runId)) {
      return { ok: false, reason: "run_not_terminal" };
    }

    store.create({
      runId: input.runId,
      prompt: input.prompt,
      projectId: input.projectId,
      webhookSecret: input.webhookSecret ?? "",
      targetApiUrl: input.targetApiUrl,
    });

    store.addLog(input.runId, "Run resumed");

    void executeRun(input.runId);

    return { ok: true, status: "created" };
  };

  const adoptRun = (options: {
    runId: string;
    sandboxId: string;
    prompt: string;
    webhookSecret: string;
    projectId?: string;
  }): void => {
    store.create({
      runId: options.runId,
      prompt: options.prompt,
      projectId: options.projectId,
      webhookSecret: options.webhookSecret,
    });

    store.addLog(options.runId, "Run adopted after server restart");

    void executeAdoptedRun(options.runId, options.sandboxId);
  };

  // ── Runtime messaging ──────────────────────────────────────────────

  const dispatchRuntimeMessage = (
    run: RunRecord,
    message: RunnerInputMessage,
  ): RuntimeMessageResult => {
    void runner
      .sendMessage(run.runId, message)
      .then(() => {
        store.addLog(run.runId, `Sent runtime message (${message.type})`);
      })
      .catch((error: unknown) => {
        const messageText =
          error instanceof Error ? error.message : String(error);
        store.addLog(run.runId, `Runtime message send failed: ${messageText}`);
      });
    return { ok: true, delivery: "queued" };
  };

  const addContext = (runId: string, context: string): RuntimeMessageResult => {
    const run = store.get(runId);
    if (!run) return { ok: false, reason: "run_not_found" };
    return dispatchRuntimeMessage(run, { type: "context", content: context });
  };

  // ── Termination ────────────────────────────────────────────────────

  const cancelRun = async (runId: string): Promise<CancelResult> => {
    const run = store.get(runId);
    if (!run) return { cancelled: false, reason: "Run not found" };

    run.abortController.abort();

    await callbacks.onStatusChange(runId, "cancelled", {
      errorJson: JSON.stringify({ msg: "Run cancelled by user", status: 499 }),
    });
    store.addLog(runId, "Run cancelled by user");

    const finalState: AgentRunState = {
      runId,
      status: "cancelled",
      error: { msg: "Run cancelled by user", status: 499 },
    };
    await handleCompleted(runId, finalState);

    return { cancelled: true };
  };

  // ── Log access ───────────────────────────────────────────────────

  const getUnflushedLogs = (runId: string): string[] => {
    const run = store.get(runId);
    if (!run) return [];
    return [...run.logBuffer];
  };

  // ── Public API ─────────────────────────────────────────────────────

  return {
    createRun,
    resumeRun,
    adoptRun,
    addContext,
    cancelRun,
    getUnflushedLogs,
    getActiveRunIds: () => store.listActiveRunIds(),
  };
}
