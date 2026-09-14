import type {
  AgentRunner,
  RunnerContext,
  RunnerInputMessage,
  RunnerResult,
} from "../../src/runners/types";

export type RunnerScriptStep =
  | { kind: "success"; data: string; delayMs?: number }
  | {
      kind: "failure";
      error: { msg: string; status: number };
      delayMs?: number;
    }
  | { kind: "hangUntilAbort" };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createScriptedRunner(steps: RunnerScriptStep[]): AgentRunner & {
  getSentMessages(runId: string): RunnerInputMessage[];
  getPrompts(runId: string): string[];
} {
  const queue = [...steps];
  const messagesByRunId = new Map<string, RunnerInputMessage[]>();
  const promptsByRunId = new Map<string, string[]>();

  const runner: AgentRunner & {
    getSentMessages(runId: string): RunnerInputMessage[];
    getPrompts(runId: string): string[];
  } = {
    async run(
      prompt: string,
      signal?: AbortSignal,
      context?: RunnerContext,
    ): Promise<RunnerResult> {
      const step = queue.shift() ?? { kind: "success", data: "ok" };
      const runId = context?.runId ?? "unknown";
      const prompts = promptsByRunId.get(runId) ?? [];
      prompts.push(prompt);
      promptsByRunId.set(runId, prompts);

      if (step.kind === "hangUntilAbort") {
        return new Promise<RunnerResult>((resolve, reject) => {
          if (signal?.aborted) {
            reject(new Error("aborted"));
            return;
          }
          signal?.addEventListener(
            "abort",
            () => {
              reject(new Error("aborted"));
            },
            { once: true },
          );
        });
      }

      if (step.delayMs && step.delayMs > 0) {
        await sleep(step.delayMs);
      }

      if (signal?.aborted) {
        throw new Error("aborted");
      }

      if (step.kind === "failure") {
        return {
          ok: false,
          error: step.error,
        };
      }

      return { ok: true, data: step.data };
    },

    async sendMessage(
      runId: string,
      message: RunnerInputMessage,
    ): Promise<void> {
      const list = messagesByRunId.get(runId) ?? [];
      list.push(message);
      messagesByRunId.set(runId, list);
    },

    getSentMessages(runId: string): RunnerInputMessage[] {
      return messagesByRunId.get(runId) ?? [];
    },

    getPrompts(runId: string): string[] {
      return promptsByRunId.get(runId) ?? [];
    },
  };

  return runner;
}
