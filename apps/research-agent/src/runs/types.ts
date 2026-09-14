import type { RunRecord } from "./run-engine-store";

export const AGENT_SKILLS = [
  "project-bootstrapper",
  "project-cataloger",
] as const;
export type AgentSkill = (typeof AGENT_SKILLS)[number];

export type AgentResult = string;
export type AgentErrorResponse = { msg: string; status: number };

export type RunStatus =
  | "created"
  | "running"
  | "completed"
  | "failed"
  | "timeout"
  | "cancelled";

const TERMINAL_STATUSES: ReadonlySet<string> = new Set<string>([
  "completed",
  "failed",
  "timeout",
  "cancelled",
]);

export const isTerminalStatus = (status: RunStatus): boolean =>
  TERMINAL_STATUSES.has(status);

export type RunStatusResponse = {
  runId: string;
  status: RunStatus;
  result?: AgentResult;
  error?: AgentErrorResponse;
  logs?: string[];
};

export type AgentRunState = {
  runId: string;
  status: RunStatus;
  result?: AgentResult;
  error?: AgentErrorResponse;
};

export type RunRecordContext = Omit<
  RunRecord,
  "abortController" | "logBuffer" | "completed"
>;

export type RunEngineCallbacks = {
  onStatusChange(
    runId: string,
    status: RunStatus,
    data?: { resultJson?: string; errorJson?: string },
  ): Promise<void>;
  onSandboxCreated(runId: string, sandboxId: string): Promise<void>;
  onLogsFlush(runId: string, logs: string[]): Promise<void>;
  onRunCompleted(
    finalState: AgentRunState,
    runRecordContext: RunRecordContext,
  ): void;
  onProgress(runId: string, role: string, content: string): Promise<void>;
};

export type CancelResult = { cancelled: boolean; reason?: string };

export type RuntimeMessageResult =
  | { ok: true; delivery: "queued" }
  | {
      ok: false;
      reason: "run_not_found" | "run_terminal";
      status?: RunStatus;
    };

export type ResumeResult =
  | { ok: true; status: RunStatus }
  | {
      ok: false;
      reason: "run_not_found" | "run_not_terminal";
      status?: RunStatus;
    };

export type RunEngine = {
  createRun(
    prompt: string,
    options: {
      runId: string;
      webhookSecret: string;
      projectId?: string;
      targetApiUrl?: string;
    },
  ): { runId: string; status: RunStatus };
  cancelRun(runId: string): CancelResult | Promise<CancelResult>;
  addContext(runId: string, context: string): RuntimeMessageResult;
  resumeRun(input: {
    runId: string;
    prompt: string;
    projectId?: string;
    webhookSecret?: string;
    targetApiUrl?: string;
  }): ResumeResult;
  adoptRun(options: {
    runId: string;
    sandboxId: string;
    prompt: string;
    webhookSecret: string;
    projectId?: string;
  }): void;
  getUnflushedLogs(runId: string): string[];
  getActiveRunIds(): string[];
};

export type ResumeRunManagerResult =
  | { ok: true; runId: string; status: RunStatusResponse["status"] }
  | {
      ok: false;
      reason:
        | "run_not_found"
        | "run_not_terminal"
        | "prompt_required_for_completed";
      status?: RunStatusResponse["status"];
      message: string;
    };

export type AddContextRunManagerResult = RuntimeMessageResult;
