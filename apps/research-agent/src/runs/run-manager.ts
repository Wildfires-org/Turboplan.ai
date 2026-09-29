/**
 * Central orchestration for agent runs.
 * Persists run state to DB via RunRepository. Uses RunEngine for orchestration.
 */

import { captureRunEvent } from "../infra/analytics";
import { logger } from "../infra/logger";
import type { TargetApiClient } from "../infra/target-api-client";
import type { MemoryService } from "../memory";
import type { AgentRunner } from "../runners/types";
import { createRunEngine } from "./run-engine";
import type { RunRepository } from "./run-repository";
import {
  type AddContextRunManagerResult,
  type AgentErrorResponse,
  type AgentRunState,
  type AgentSkill,
  type CancelResult,
  isTerminalStatus,
  type ResumeResult,
  type ResumeRunManagerResult,
  type RunEngine,
  type RunRecordContext,
  type RunStatusResponse,
} from "./types";
import { buildResumePrompt } from "./utils/build-resume-prompt";
import { parseRunStatus } from "./utils/parse-run-status";
import { parseStoredResult } from "./utils/parse-stored-result";

export class RunManager {
  constructor(
    private memoryService: MemoryService,
    private engine: RunEngine,
    private repository: RunRepository,
    private targetApiClient: TargetApiClient,
  ) {}

  async shutdown(): Promise<void> {
    const activeRunIds = this.engine.getActiveRunIds();
    if (activeRunIds.length === 0) return;

    logger.log(`Shutting down ${activeRunIds.length} active run(s)`, "server");

    for (const runId of activeRunIds) {
      try {
        const logs = this.engine.getUnflushedLogs(runId);
        if (logs.length > 0) {
          await this.repository.appendLogs(runId, logs);
        }
        await this.repository.updateStatus(runId, "failed", {
          errorJson: JSON.stringify({
            msg: "Server shutdown during execution",
            status: 503,
          }),
        });
      } catch (err) {
        logger.error(`Failed to clean up run ${runId} during shutdown`, err, {
          runId,
        });
      }
    }
  }

  async handleRunCompleted(
    finalState: AgentRunState,
    runRecordContext: RunRecordContext,
  ): Promise<void> {
    const { runId } = finalState;
    const { targetApiUrl, webhookSecret } = runRecordContext;

    captureRunEvent("research_run_completed", {
      run_id: runId,
      status: finalState.status,
    });

    try {
      if (await this.isBootstrapperRun(runId)) {
        // The target rejects webhooks once it has reconciled the run as
        // finished, so a failed final notification is expected and must not
        // skip persisting the result below.
        await this.notifyCompletion(
          finalState,
          targetApiUrl,
          webhookSecret,
        ).catch((err) => {
          logger.error(`Failed to notify completion of run ${runId}`, err, {
            runId,
          });
        });
      }
      await this.saveRunResult(finalState);
    } catch (err) {
      logger.error(`Failed to finalize run ${runId}`, err, { runId });
    }
  }

  private async isBootstrapperRun(runId: string): Promise<boolean> {
    const record = await this.repository.getByRunId(runId);
    return !record?.skill || record.skill === "project-bootstrapper";
  }

  private async notifyCompletion(
    finalState: AgentRunState,
    targetApiUrl?: string,
    webhookSecret?: string,
  ): Promise<void> {
    if (!targetApiUrl || !webhookSecret) {
      return;
    }

    const messages: Record<string, string> = {
      completed: "Research agent done!",
      cancelled: "Research agent cancelled.",
    };
    const message =
      messages[finalState.status] ?? "Something went wrong. Please try again.";

    await this.targetApiClient.sendProgress({
      targetApiUrl,
      webhookSecret,
      runId: finalState.runId,
      message,
    });
  }

  private async saveRunResult(finalState: AgentRunState): Promise<void> {
    if (!finalState.result) return;

    const runId = finalState.runId;

    // Extract and save memories before persisting the final message,
    // so the stored result and conversation history are clean (without memory blocks).
    const { cleanResult, savedCount } =
      await this.memoryService.processRunResult(finalState.result, runId);

    if (savedCount > 0) {
      logger.log(`Saved ${savedCount} memory(s) from run ${runId}`, "memory", {
        runId,
      });
    }

    // Overwrite resultJson only if memory extraction stripped content from the raw result.
    if (cleanResult !== finalState.result) {
      await this.repository.updateStatus(runId, finalState.status, {
        resultJson: JSON.stringify(cleanResult),
      });
    }
  }

  async getRelevantMemories(
    prompt: string,
  ): Promise<Array<{ title: string; content: string; keywords: string[] }>> {
    try {
      const records = await this.memoryService.getRelevantForPrompt(prompt);
      if (records.length > 0) {
        logger.log(
          `Injecting ${records.length} memory(s) into context`,
          "memory",
        );
      } else {
        logger.log("No relevant memories found", "memory");
      }
      return records.map((l) => ({
        title: l.title,
        content: l.content,
        keywords: l.keywords,
      }));
    } catch (err) {
      logger.error("Failed to fetch relevant memories", err);
      return [];
    }
  }

  async startRun(
    prompt: string,
    options: {
      webhookSecret: string;
      projectId?: string;
      targetApiUrl?: string;
      skill?: AgentSkill;
    },
  ): Promise<{ runId: string; status: string }> {
    const runId = crypto.randomUUID();

    // Persist to DB before firing the engine — executeRun's onStatusChange("running")
    // must not race with the initial repository.create.
    await this.repository.create({
      runId,
      prompt,
      status: "created",
      skill: options.skill,
    });

    this.engine.createRun(prompt, {
      runId,
      projectId: options.projectId,
      webhookSecret: options.webhookSecret,
      targetApiUrl: options.targetApiUrl,
    });

    captureRunEvent("research_run_started", {
      run_id: runId,
      project_id: options.projectId,
      skill: options.skill,
    });

    return { runId, status: "created" };
  }

  async healthCheck(): Promise<{ db: "ok" | "unavailable" }> {
    const ok = await this.repository.healthCheck();
    return { db: ok ? "ok" : "unavailable" };
  }

  async getStatus(runId: string): Promise<RunStatusResponse | null> {
    const record = await this.repository.getByRunId(runId);
    if (!record) return null;

    const dbLogs = await this.repository.listLogs(runId);
    const unflushedLogs = this.engine.getUnflushedLogs(runId);
    const allLogs = [...dbLogs, ...unflushedLogs];

    return {
      runId: record.runId,
      status: parseRunStatus(record.status),
      result: parseStoredResult(record.resultJson),
      error: record.errorJson
        ? (JSON.parse(record.errorJson) as AgentErrorResponse)
        : undefined,
      logs: allLogs.length > 0 ? allLogs : undefined,
    };
  }

  async cancelRun(runId: string): Promise<CancelResult> {
    return this.engine.cancelRun(runId);
  }

  async addContext(
    runId: string,
    context: string,
  ): Promise<AddContextRunManagerResult> {
    const current = await this.getStatus(runId);
    if (!current) return { ok: false, reason: "run_not_found" };

    if (isTerminalStatus(current.status)) {
      return {
        ok: false,
        reason: "run_terminal",
        status: current.status,
      };
    }

    const runtime = this.engine.addContext(runId, context);
    if (runtime.ok) {
      await this.repository.appendRunMessage(runId, "user", context);
    }
    return runtime;
  }

  /** Reattach to an orphaned sandbox after server restart. */
  adoptRun(run: {
    runId: string;
    sandboxId: string;
    prompt: string;
    webhookSecret: string;
    projectId?: string;
  }): void {
    this.engine.adoptRun(run);
  }

  async resumeRun(
    runId: string,
    options?: {
      prompt?: string;
      webhookSecret?: string;
      runtimeContext?: string;
      targetApiUrl?: string;
    },
  ): Promise<ResumeRunManagerResult> {
    const record = await this.repository.getByRunId(runId);
    if (!record) {
      return {
        ok: false,
        reason: "run_not_found",
        message: "Run not found",
      };
    }

    const persistedStatus = parseRunStatus(record.status);
    if (!isTerminalStatus(persistedStatus)) {
      return {
        ok: false,
        reason: "run_not_terminal",
        status: persistedStatus,
        message: "Run is running or not in terminal state",
      };
    }

    const sanitizedPrompt = options?.prompt?.trim();
    if (persistedStatus === "completed" && !sanitizedPrompt) {
      return {
        ok: false,
        reason: "prompt_required_for_completed",
        status: persistedStatus,
        message:
          "You must provide a prompt to resume a successfully completed run",
      };
    }

    const pastMessages = await this.repository.listRunMessages(runId);
    const allMessages = [
      { role: "user", content: record.prompt, sequenceNumber: -1 },
      ...pastMessages,
    ];
    let resumePrompt = buildResumePrompt(allMessages, sanitizedPrompt);

    if (options?.runtimeContext) {
      resumePrompt += options.runtimeContext;
    }

    const resumed: ResumeResult = this.engine.resumeRun({
      runId: record.runId,
      prompt: resumePrompt,
      webhookSecret: options?.webhookSecret,
      targetApiUrl: options?.targetApiUrl,
    });
    if (!resumed.ok) {
      return {
        ok: false,
        reason: "run_not_terminal",
        status: resumed.status,
        message: "Run is running or not in terminal state",
      };
    }

    if (sanitizedPrompt) {
      await this.repository.appendRunMessage(runId, "user", sanitizedPrompt);
    }
    return {
      ok: true,
      runId,
      status: "created",
    };
  }
}

export function createRunManager(
  memoryService: MemoryService,
  runner: AgentRunner,
  repository: RunRepository,
  targetApiClient: TargetApiClient,
): RunManager {
  // Safe: callbacks fire only async when a run changes state,
  // so `manager` is always initialized by then.
  let manager!: RunManager;
  const engine = createRunEngine(runner, {
    onStatusChange: async (runId, status, data) => {
      await repository.updateStatus(runId, status, data);
    },
    onSandboxCreated: async (runId, sandboxId) => {
      await repository.updateSandboxId(runId, sandboxId);
    },
    onLogsFlush: (runId, logs) => repository.appendLogs(runId, logs),
    onRunCompleted: (finalState, runRecord) =>
      manager.handleRunCompleted(finalState, runRecord),
    onProgress: async (runId, role, content) => {
      await repository.appendRunMessage(runId, role, content);
    },
  });
  manager = new RunManager(memoryService, engine, repository, targetApiClient);
  return manager;
}
