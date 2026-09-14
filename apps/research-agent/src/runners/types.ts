import type { AgentErrorResponse, AgentResult } from "../runs/types";
import type { AgentProgressLine } from "./runner-schema";

export type {
  AgentErrorLine,
  AgentOutputLine,
  AgentProgressLine,
  AgentResultLine,
} from "./runner-schema";

export type RunnerResult =
  | { ok: true; data: AgentResult }
  | { ok: false; error: AgentErrorResponse };

export type RunnerContext = {
  runId: string;
  projectId?: string;
  webhookSecret: string;
  targetApiUrl?: string;
  onProgress?: (message: AgentProgressLine) => void;
  onSandboxCreated?: (sandboxId: string) => void;
};

export type RunnerInputMessage =
  | { type: "context"; content: string }
  | { type: "continue"; content: string };

export type RunnerWireMessage =
  | { type: "start"; prompt: string }
  | RunnerInputMessage;

export type AgentRunner = {
  run(
    prompt: string,
    signal?: AbortSignal,
    context?: RunnerContext,
  ): Promise<RunnerResult>;
  attach?(
    sandboxId: string,
    signal?: AbortSignal,
    context?: RunnerContext,
  ): Promise<RunnerResult>;
  sendMessage: (runId: string, message: RunnerInputMessage) => Promise<void>;
};
