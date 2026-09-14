import { type AgentOutputLine, agentOutputLineSchema } from "../runner-schema";

/** Parse a single NDJSON line into a typed agent output message. Returns null for invalid lines. */
export const parseOutputLine = (line: string): AgentOutputLine | null => {
  try {
    const json = JSON.parse(line) as unknown;
    const parsed = agentOutputLineSchema.safeParse(json);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};

/**
 * Stateful NDJSON stream parser. Buffers chunks, extracts complete lines,
 * and emits parsed AgentOutputLine objects via the onLine callback.
 */
export function createStreamParser(onLine: (parsed: AgentOutputLine) => void) {
  let buffer = "";

  const push = (chunk: string): void => {
    buffer += chunk;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line) continue;
      const parsed = parseOutputLine(line);
      if (parsed) onLine(parsed);
    }
  };

  /** Flush remaining buffer. Returns the last parsed line, or null. */
  const flush = (): AgentOutputLine | null => {
    if (!buffer) return null;
    const parsed = parseOutputLine(buffer);
    buffer = "";
    return parsed;
  };

  return { push, flush };
}
