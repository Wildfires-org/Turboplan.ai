export function buildResumePrompt(
  history: Array<{ role: string; content: string; sequenceNumber: number }>,
  currentPrompt?: string,
): string {
  const MAX_HISTORY_MESSAGES = 20;
  const MAX_HISTORY_CHARS = 8000;
  const sanitizedCurrentPrompt = currentPrompt?.trim();

  const sortedHistory = history
    .filter((message) => message.content.trim().length > 0)
    .sort((a, b) => a.sequenceNumber - b.sequenceNumber);

  const recentHistory = sortedHistory.slice(-MAX_HISTORY_MESSAGES);
  const boundedFromTail: Array<{
    role: string;
    content: string;
    sequenceNumber: number;
  }> = [];
  let usedChars = 0;
  for (let index = recentHistory.length - 1; index >= 0; index -= 1) {
    const message = recentHistory[index];
    const entry = `[${message.role.toUpperCase()} #${message.sequenceNumber}] ${message.content.trim()}`;
    if (
      boundedFromTail.length > 0 &&
      usedChars + entry.length > MAX_HISTORY_CHARS
    ) {
      break;
    }
    boundedFromTail.push(message);
    usedChars += entry.length;
  }

  const boundedHistory = boundedFromTail.reverse();
  const historyLines = boundedHistory.map(
    (message) =>
      `[${message.role.toUpperCase()} #${message.sequenceNumber}] ${message.content.trim()}`,
  );
  const wasTruncated = boundedHistory.length < sortedHistory.length;

  if (historyLines.length === 0) {
    return (
      sanitizedCurrentPrompt ??
      "Continue the run from the latest available context."
    );
  }

  return [
    "SYSTEM CONTEXT:",
    "The following is prior conversation history for this run.",
    "Use it as context only; do not answer each historical message separately.",
    "",
    "CONVERSATION HISTORY:",
    ...(wasTruncated
      ? [
          "[... older conversation messages were omitted due to context limits ...]",
        ]
      : []),
    ...historyLines,
    "",
    "CURRENT USER REQUEST:",
    sanitizedCurrentPrompt ??
      "Continue from the latest context and provide the next best response.",
  ].join("\n");
}
