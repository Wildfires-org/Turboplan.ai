import type { Sandbox } from "modal";

import { getResearchAgentEnv } from "@wildfires-org/turboplan-env";

import { logger } from "../infra/logger";
import type { ModalResources } from "../infra/modal-setup";
import type { AgentOutputLine } from "./runner-schema";
import type {
  AgentRunner,
  RunnerContext,
  RunnerInputMessage,
  RunnerResult,
  RunnerWireMessage,
} from "./types";
import { createStreamParser } from "./utils/runner-parsers";
import {
  cancelledResult,
  checkAborted,
  failedResult,
  forwardStderr,
  onAbortSignal,
} from "./utils/runner-results";

/** Read a sandbox ReadableStream, accumulating into a string and calling onChunk for each piece. */
const readStream = async (
  stream: ReadableStream,
  onChunk?: (chunk: string) => void,
): Promise<string> => {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let accumulated = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk =
        typeof value === "string"
          ? value
          : decoder.decode(value as Uint8Array, { stream: true });
      accumulated += chunk;
      onChunk?.(chunk);
    }
    const finalChunk = decoder.decode();
    if (finalChunk) {
      accumulated += finalChunk;
      onChunk?.(finalChunk);
    }
  } finally {
    reader.releaseLock();
  }
  return accumulated;
};

/** Stream both stderr and stdout from sandbox, parsing stdout NDJSON lines as they arrive. */
const collectOutput = (
  sandbox: Sandbox,
  onLine: (parsed: AgentOutputLine) => void,
): {
  done: Promise<{ stderr: string }>;
  flush: () => AgentOutputLine | null;
} => {
  const parser = createStreamParser(onLine);

  // Forward agent logs to parent stderr so they appear in the dev console
  const stderrReady = readStream(sandbox.stderr, forwardStderr);
  const stdoutReady = readStream(sandbox.stdout, (chunk) => parser.push(chunk));

  const done = Promise.all([stderrReady, stdoutReady]).then(([stderr]) => ({
    stderr,
  }));

  return { done, flush: () => parser.flush() };
};

const sendToSandbox = async (
  sandbox: Sandbox,
  message: RunnerWireMessage,
): Promise<void> => {
  await sandbox.stdin.writeText(`${JSON.stringify(message)}\n`);
};

export function createModalRunner(resources: ModalResources): AgentRunner {
  const env = getResearchAgentEnv();
  const activeRuns = new Map<
    string,
    (msg: RunnerInputMessage) => Promise<void>
  >();

  /** Shared tail: register sandbox for messaging, collect output, wait for exit, return result. */
  const watchSandbox = async (
    sandbox: Sandbox,
    signal: AbortSignal | undefined,
    context: RunnerContext | undefined,
  ): Promise<RunnerResult> => {
    const runId = context?.runId;

    // Wire abort signal to terminate the sandbox
    const removeAbortListener = onAbortSignal(signal, () => {
      void sandbox.terminate();
    });

    // Register this run so sendMessage() can reach it
    if (runId) {
      activeRuns.set(runId, async (message) => {
        await sendToSandbox(sandbox, message);
      });
    }

    // Collect output and handle parsed NDJSON lines
    let result = "";
    let lastError: { msg: string; status: number } | null = null;
    const { done, flush } = collectOutput(sandbox, (parsed) => {
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

    // Wait for sandbox exit, then cleanup
    const exitCode = await sandbox.wait();
    const { stderr } = await done;
    removeAbortListener();
    if (runId) {
      activeRuns.delete(runId);
    }

    if (signal?.aborted) return cancelledResult();
    if (exitCode !== 0) {
      if (lastError) {
        return { ok: false, error: lastError };
      }
      return failedResult(stderr || `Exit code ${exitCode}`);
    }

    // Flush remaining buffer
    const flushed = flush();
    if (flushed?.type === "result") result = flushed.result;

    if (!result) return failedResult("No result line found in agent output");
    return { ok: true, data: result };
  };

  const run = async (
    prompt: string,
    signal?: AbortSignal,
    context?: RunnerContext,
  ): Promise<RunnerResult> => {
    const aborted = checkAborted(signal);
    if (aborted) return aborted;

    const { client, app, image, volume, sandboxEnv } = resources;

    const targetApiUrl = context?.targetApiUrl ?? "";
    logger.log(
      `perRunSecrets: RUN_ID=${context?.runId ?? "(empty)"}, TARGET_API_URL=${targetApiUrl || "(empty)"}`,
      "info",
    );

    const perRunSecret = await client.secrets.fromObject({
      WEBHOOK_SECRET: context?.webhookSecret ?? "",
      RUN_ID: context?.runId ?? "",
      TARGET_API_URL: targetApiUrl,
    });
    const secrets = [sandboxEnv, perRunSecret];

    const sandbox = await client.sandboxes.create(app, image, {
      command: ["tsx", "/app/run.js"],
      volumes: { "/app": volume.readOnly() },
      secrets,
      timeoutMs: env.RUN_TIMEOUT_MS,
    });
    context?.onSandboxCreated?.(sandbox.sandboxId);

    await sendToSandbox(sandbox, { type: "start", prompt });

    return watchSandbox(sandbox, signal, context);
  };

  const attach = async (
    sandboxId: string,
    signal?: AbortSignal,
    context?: RunnerContext,
  ): Promise<RunnerResult> => {
    const aborted = checkAborted(signal);
    if (aborted) return aborted;

    const { client } = resources;
    const sandbox = await client.sandboxes.fromId(sandboxId);

    // If sandbox already exited, return immediately
    const exitCode = await sandbox.poll();
    if (exitCode !== null) {
      if (exitCode === 0) {
        return failedResult(
          "Sandbox completed during server downtime — result unavailable",
        );
      }
      return failedResult(
        `Sandbox exited with code ${exitCode} during server downtime`,
      );
    }

    return watchSandbox(sandbox, signal, context);
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
    await send(message);
  };

  return { run, attach, sendMessage };
}
