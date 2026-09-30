import type {
  AgentErrorResponse,
  AgentResult,
  AgentSkill,
} from "../runs/types";
import type { AgentProgressLine, RunStats } from "./runner-schema";

export type {
  AgentErrorLine,
  AgentOutputLine,
  AgentProgressLine,
  AgentResultLine,
  RunStats,
} from "./runner-schema";

export type RunnerResult =
  | { ok: true; data: AgentResult; stats?: RunStats }
  | { ok: false; error: AgentErrorResponse; stats?: RunStats };

export type RunnerContext = {
  runId: string;
  projectId?: string;
  webhookSecret: string;
  targetApiUrl?: string;
  /** Skill whose SKILL.md the sandbox preloads into the system prompt. */
  skill?: AgentSkill;
  onProgress?: (message: AgentProgressLine) => void;
  onSandboxCreated?: (sandboxId: string) => void;
};

export type RunnerInputMessage =
  | { type: "context"; content: string }
  | { type: "continue"; content: string };

export type RunnerWireMessage =
  | { type: "start"; prompt: string; skill?: string }
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
