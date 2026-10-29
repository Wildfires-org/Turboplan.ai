import type { StopCondition, ToolSet } from "ai";

/**
 * Like the AI SDK's `hasToolCall`, but only stops once some step in the run
 * has written non-empty text. Thinking models can draft the whole answer in
 * reasoning and call the tool before writing any text; stopping there would
 * leave the reply without a visible answer.
 */
export const hasToolCallAfterText = (
  toolName: string,
): StopCondition<ToolSet> => {
  return ({ steps }) => {
    const calledTool =
      steps
        .at(-1)
        ?.toolCalls?.some((toolCall) => toolCall.toolName === toolName) ??
      false;
    if (!calledTool) {
      return false;
    }
    return steps.some((step) => step.text.trim().length > 0);
  };
};
