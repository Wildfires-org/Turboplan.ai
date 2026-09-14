import { getResearchAgentEnv } from "@wildfires-org/turboplan-env";

import type { RunnerResult } from "../types";

const env = getResearchAgentEnv();
const isDebugEnabled = env.DEBUG_CLAUDE_AGENT_SDK;

/** Forward a stderr chunk to parent process, filtering out [DEBUG] lines unless debug is enabled. */
export const forwardStderr = (chunk: string): void => {
  if (isDebugEnabled) {
    process.stderr.write(chunk);
    return;
  }
  const lines = chunk.split("\n");
  for (const line of lines) {
    if (line && !line.includes("[DEBUG]")) {
      process.stderr.write(`${line}\n`);
    }
  }
};

/** Standard result for a user-cancelled run. */
export const cancelledResult = (): RunnerResult => ({
  ok: false,
  error: { msg: "Run cancelled by user", status: 499 },
});

/** Standard result for a run that failed with a non-zero exit code (fallback when no structured error was emitted). */
export const failedResult = (rawError: string): RunnerResult => ({
  ok: false,
  error: {
    msg: rawError.slice(0, 200) || "Unknown error",
    status: 500,
  },
});

/** Returns a cancelled RunnerResult if the signal is already aborted, otherwise null. */
export const checkAborted = (signal?: AbortSignal): RunnerResult | null =>
  signal?.aborted ? cancelledResult() : null;

/**
 * Wire an AbortSignal to a cleanup callback. Returns a function that
 * removes the listener — call it when the run settles.
 */
export const onAbortSignal = (
  signal: AbortSignal | undefined,
  handler: () => void,
): (() => void) => {
  if (!signal) return () => {};
  signal.addEventListener("abort", handler, { once: true });
  return () => signal.removeEventListener("abort", handler);
};
