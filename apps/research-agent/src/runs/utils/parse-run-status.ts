import type { RunStatus } from "../types";

const VALID_STATUSES: ReadonlySet<string> = new Set<string>([
  "created",
  "running",
  "completed",
  "failed",
  "timeout",
  "cancelled",
]);

export function parseRunStatus(status: string): RunStatus {
  return (VALID_STATUSES.has(status) ? status : "failed") as RunStatus;
}
