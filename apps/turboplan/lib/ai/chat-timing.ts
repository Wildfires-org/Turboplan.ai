import type { LanguageModelUsage } from "ai";

export type ChatTimingLog = (
  event: string,
  fields?: Record<string, unknown>,
) => void;

// Only the fields the step timer reads; the SDK's stream parts and step
// results are structurally compatible with these.
type TimedChunk = {
  type: string;
  id?: string;
  toolCallId?: string;
};

type TimedStep = {
  stepNumber: number;
  finishReason: string;
  text: string;
  usage: LanguageModelUsage;
  toolCalls: Array<{ toolCallId: string; toolName: string; input: unknown }>;
};

type ToolCallTiming = {
  inputStartedAt?: number;
  inputDeltaCount: number;
  calledAt?: number;
  resultAt?: number;
};

const msBetween = (start?: number, end?: number) =>
  start === undefined || end === undefined ? null : end - start;

/**
 * Structured latency logs for the chat + document path. Workers Logs indexes
 * the fields of a plain-object console.log, so fields must be sizes, counts,
 * timings or ids only — never message content.
 */
export const createChatTimer = ({
  chatId,
  startedAt,
}: {
  chatId?: string | null;
  startedAt: number;
}): ChatTimingLog => {
  return (event, fields = {}) => {
    console.log({
      message: `[ChatTiming] ${event}`,
      chatId: chatId ?? null,
      elapsedMs: Date.now() - startedAt,
      ...fields,
    });
  };
};

export const getErrorName = (error: unknown) =>
  error instanceof Error ? error.name : typeof error;

export const summarizeUsage = (usage?: LanguageModelUsage) => {
  if (!usage) {
    return undefined;
  }

  const summary = {
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    cachedInputTokens:
      usage.inputTokenDetails?.cacheReadTokens ?? usage.cachedInputTokens,
    reasoningTokens:
      usage.outputTokenDetails?.reasoningTokens ?? usage.reasoningTokens,
  };

  return Object.fromEntries(
    Object.entries(summary).filter(([, value]) => value !== undefined),
  );
};

/**
 * Per-step timing for a multi-step streamText run, wired to its onChunk and
 * onStepFinish. A step starts when the previous one finishes (or at creation
 * for step 0). inputDeltaCount shows whether a tool's input was streamed or
 * buffered: ~1 delta for a long input means the provider buffered it.
 */
export const createStepTimer = (log: ChatTimingLog) => {
  let stepStartedAt = Date.now();
  let firstChunkAt: number | undefined;
  const toolCallTimings = new Map<string, ToolCallTiming>();

  const timingFor = (toolCallId: string) => {
    let timing = toolCallTimings.get(toolCallId);
    if (!timing) {
      timing = { inputDeltaCount: 0 };
      toolCallTimings.set(toolCallId, timing);
    }
    return timing;
  };

  const onChunk = ({ chunk }: { chunk: TimedChunk }) => {
    const now = Date.now();
    firstChunkAt ??= now;

    if (chunk.type === "tool-input-start" && chunk.id) {
      timingFor(chunk.id).inputStartedAt = now;
    } else if (chunk.type === "tool-input-delta" && chunk.id) {
      timingFor(chunk.id).inputDeltaCount += 1;
    } else if (chunk.type === "tool-call" && chunk.toolCallId) {
      timingFor(chunk.toolCallId).calledAt = now;
    } else if (chunk.type === "tool-result" && chunk.toolCallId) {
      timingFor(chunk.toolCallId).resultAt = now;
    }
  };

  const onStepFinish = (step: TimedStep) => {
    const now = Date.now();

    log("step-finish", {
      stepNumber: step.stepNumber,
      stepMs: now - stepStartedAt,
      ttftMs: msBetween(stepStartedAt, firstChunkAt),
      finishReason: step.finishReason,
      toolCalls: step.toolCalls.map(({ toolCallId, toolName, input }) => {
        const timing = toolCallTimings.get(toolCallId);
        return {
          name: toolName,
          inputChars: (JSON.stringify(input) ?? "").length,
          inputGenMs: msBetween(timing?.inputStartedAt, timing?.calledAt),
          inputDeltaCount: timing?.inputDeltaCount ?? 0,
          execMs: msBetween(timing?.calledAt, timing?.resultAt),
        };
      }),
      usage: summarizeUsage(step.usage),
      textChars: step.text.length,
    });

    stepStartedAt = now;
    firstChunkAt = undefined;
    toolCallTimings.clear();
  };

  return { onChunk, onStepFinish };
};
