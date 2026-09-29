import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { once } from "node:events";
import { dirname, resolve } from "node:path";
import type { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

import { getResearchAgentEnv } from "@wildfires-org/turboplan-env";

import { logger } from "../infra/logger";
import type { AgentOutputLine } from "./runner-schema";
import type {
  AgentRunner,
  RunnerContext,
  RunnerInputMessage,
  RunnerResult,
} from "./types";
import { buildLocalAgentEnv } from "./utils/local-agent-env";
import { createStreamParser } from "./utils/runner-parsers";
import {
  cancelledResult,
  checkAborted,
  failedResult,
  forwardStderr,
  onAbortSignal,
} from "./utils/runner-results";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Read a Node.js readable stream, accumulating into a string and calling onChunk for each piece. */
const readStream = (
  stream: Readable,
  onChunk?: (chunk: string) => void,
): Promise<string> => {
  let accumulated = "";
  stream.on("data", (chunk: Buffer) => {
    const str = chunk.toString();
    accumulated += str;
    onChunk?.(str);
  });
  return new Promise((resolve, reject) => {
    stream.on("end", () => resolve(accumulated));
    stream.on("error", reject);
  });
};

/** Stream both stderr and stdout from child process, parsing stdout NDJSON lines as they arrive. */
const collectOutput = (
  child: ChildProcessWithoutNullStreams,
  onLine: (parsed: AgentOutputLine) => void,
): {
  done: Promise<{ stderr: string }>;
  flush: () => AgentOutputLine | null;
} => {
  const parser = createStreamParser(onLine);
  // Forward agent logs to parent stderr so they appear in the dev console
  const stderrReady = readStream(child.stderr, forwardStderr);
  const stdoutReady = readStream(child.stdout, (chunk) => parser.push(chunk));

  const done = Promise.all([stderrReady, stdoutReady]).then(([stderr]) => ({
    stderr,
  }));

  return { done, flush: () => parser.flush() };
};

/** Send an NDJSON message to the child process stdin. */
const sendToChildProcess = (
  child: ChildProcessWithoutNullStreams,
  message: Record<string, unknown>,
): void => {
  if (!child.stdin.writable || child.stdin.destroyed) {
    throw new Error("Agent stdin is not writable");
  }
  child.stdin.write(`${JSON.stringify(message)}\n`);
};

/** Spawn the agent as a child process. Uses piped stdio for bidirectional NDJSON communication. */
const spawnLocalProcess = (
  workspacePath: string,
  agentScript: string,
  context?: RunnerContext,
): ChildProcessWithoutNullStreams => {
  return spawn("tsx", [agentScript], {
    // Explicit allowlist, never `...process.env`: the agent runs Bash
    // unattended and must not see server credentials (AGENT_API_KEY, Modal
    // tokens, DB URLs).
    env: buildLocalAgentEnv({
      hostEnv: process.env,
      serverEnv: getResearchAgentEnv(),
      workspacePath,
      context,
    }),
    stdio: ["pipe", "pipe", "pipe"],
  });
};

export function createLocalRunner(): AgentRunner {
  const env = getResearchAgentEnv();
  const workspacePath = resolve(__dirname, "..", "..", "workspace");
  const agentScript = resolve(__dirname, "..", "agent-runtime", "run.ts");
  const activeRuns = new Map<string, (msg: RunnerInputMessage) => void>();

  const run = async (
    prompt: string,
    signal?: AbortSignal,
    context?: RunnerContext,
  ): Promise<RunnerResult> => {
    // 1. Bail early if already cancelled
    const aborted = checkAborted(signal);
    if (aborted) return aborted;

    // 2. Spawn the agent as a child process
    const child = spawnLocalProcess(workspacePath, agentScript, context);
    const runId = context?.runId;

    // 3. Wire abort signal to kill the process
    const removeAbortListener = onAbortSignal(signal, () => {
      child.kill("SIGTERM");
    });

    // 4. Send the initial prompt via NDJSON on stdin
    sendToChildProcess(child, { type: "start", prompt });

    // 5. Register this run so sendMessage() can reach it
    if (runId) {
      activeRuns.set(runId, (message) => {
        sendToChildProcess(child, message);
      });
    }

    // 6. Collect output and handle parsed NDJSON lines
    let result = "";
    let lastError: { msg: string; status: number } | null = null;
    const { done, flush } = collectOutput(child, (parsed) => {
      switch (parsed.type) {
        case "progress":
          context?.onProgress?.(parsed);
          break;
        case "result":
          result = parsed.result;
          break;
        case "error":
          lastError = { msg: parsed.msg, status: parsed.status };
          break;
      }
    });

    // 7. Kill the process if it exceeds the timeout (Modal handles this via timeoutMs)
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
    }, env.RUN_TIMEOUT_MS);

    // 8. Wait for process exit, then cleanup
    const [code] = await once(child, "close");
    clearTimeout(timeout);
    const { stderr } = await done;
    removeAbortListener();
    if (runId) {
      activeRuns.delete(runId);
    }

    if (signal?.aborted) return cancelledResult();
    if (code !== 0) {
      if (lastError) {
        return { ok: false, error: lastError };
      }
      return failedResult(stderr || `Exit code ${code}`);
    }

    // 9. Flush remaining buffer
    const flushed = flush();
    if (flushed?.type === "result") result = flushed.result;

    // 10. Return the result or error
    if (!result) return failedResult("No result line found in agent output");
    return { ok: true, data: result };
  };

  const sendMessage = async (
    runId: string,
    message: RunnerInputMessage,
  ): Promise<void> => {
    const send = activeRuns.get(runId);
    if (!send) {
      logger.log(`sendMessage called for unknown run ${runId}`, "info", {
        runId,
      });
      return;
    }
    send(message);
  };

  return { run, sendMessage };
}
