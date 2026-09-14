import type { RunRepository } from "../../src/runs/run-repository";
import { isTerminalStatus, type RunStatus } from "../../src/runs/types";

const POLL_INTERVAL_MS = 50;

export type CompletionResult = {
  runId: string;
  status: RunStatus;
  result?: string;
};

export function waitForRunCompletion(
  repository: RunRepository,
  runId: string,
  timeoutMs = 5000,
): Promise<CompletionResult> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;

    const poll = (): void => {
      repository
        .getByRunId(runId)
        .then((record) => {
          if (!record) {
            reject(new Error("Run not found"));
            return;
          }
          const status = record.status as RunStatus;
          if (isTerminalStatus(status)) {
            resolve({
              runId: record.runId,
              status,
              result: record.resultJson ?? undefined,
            });
            return;
          }
          if (Date.now() > deadline) {
            reject(new Error("Timed out"));
            return;
          }
          setTimeout(poll, POLL_INTERVAL_MS);
        })
        .catch(reject);
    };

    poll();
  });
}
