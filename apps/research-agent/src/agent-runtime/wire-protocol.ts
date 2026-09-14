import type { SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";

import type { RunnerInputMessage, RunnerWireMessage } from "../runners/types";

export function parseWireMessage(line: string): RunnerWireMessage | null {
  try {
    const parsed = JSON.parse(line) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const message = parsed as Partial<RunnerWireMessage>;
    if (
      message.type === "start" &&
      typeof (message as { prompt?: unknown }).prompt === "string"
    ) {
      const prompt = (message as { prompt: string }).prompt;
      return { type: "start", prompt };
    }
    if (
      (message.type === "context" || message.type === "continue") &&
      typeof (message as { content?: unknown }).content === "string"
    ) {
      return {
        type: message.type,
        content: (message as { content: string }).content,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function toSdkUserMessage(
  runId: string,
  message: RunnerInputMessage,
): SDKUserMessage {
  return {
    type: "user",
    message: {
      role: "user",
      content: message.content,
    },
    parent_tool_use_id: null,
    session_id: runId,
  };
}
