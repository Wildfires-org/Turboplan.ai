/**
 * In-memory state container for agent runs.
 * Holds only runtime-only data: abort controller, pending messages, log buffer.
 * All persistent state (status, result, error, logs) lives in the database.
 */

export type RunRecord = {
  runId: string;
  prompt: string;
  projectId?: string;
  webhookSecret: string;
  targetApiUrl?: string;
  abortController: AbortController;
  logBuffer: string[];
  completed: boolean;
};

type OnFlushCallback = (runId: string, logs: string[]) => void;

export type RunEngineStore = {
  create(input: {
    runId: string;
    prompt: string;
    webhookSecret: string;
    projectId?: string;
    targetApiUrl?: string;
  }): RunRecord;
  get(runId: string): RunRecord | null;
  remove(runId: string): void;
  addLog(runId: string, message: string): void;
  flushLogs(runId: string): string[];
  listActiveRunIds(): string[];
};

const LOG_BUFFER_FLUSH_THRESHOLD = 5;

export function createRunEngineStore(
  onFlush?: OnFlushCallback,
): RunEngineStore {
  const runs = new Map<string, RunRecord>();

  const create = (input: {
    runId: string;
    prompt: string;
    webhookSecret: string;
    projectId?: string;
    targetApiUrl?: string;
  }): RunRecord => {
    const run: RunRecord = {
      runId: input.runId,
      prompt: input.prompt,
      projectId: input.projectId,
      webhookSecret: input.webhookSecret,
      targetApiUrl: input.targetApiUrl,
      abortController: new AbortController(),
      logBuffer: [],
      completed: false,
    };
    runs.set(run.runId, run);
    return run;
  };

  const getById = (runId: string): RunRecord | null => {
    return runs.get(runId) ?? null;
  };

  const remove = (runId: string): void => {
    runs.delete(runId);
  };

  const flushLogs = (runId: string): string[] => {
    const run = runs.get(runId);
    if (!run || run.logBuffer.length === 0) return [];
    const flushed = [...run.logBuffer];
    run.logBuffer = [];
    return flushed;
  };

  const toLogLine = (message: string): string =>
    `[${new Date().toISOString()}] ${message}`;

  const addLog = (runId: string, message: string): void => {
    const run = runs.get(runId);
    if (!run) return;
    run.logBuffer.push(toLogLine(message));
    if (run.logBuffer.length >= LOG_BUFFER_FLUSH_THRESHOLD && onFlush) {
      const logs = flushLogs(runId);
      if (logs.length > 0) {
        onFlush(runId, logs);
      }
    }
  };

  const listActiveRunIds = (): string[] => {
    return [...runs.keys()];
  };

  return {
    create,
    get: getById,
    remove,
    addLog,
    flushLogs,
    listActiveRunIds,
  };
}
