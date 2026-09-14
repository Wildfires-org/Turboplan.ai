export type ParsedMemory = {
  title: string;
  content: string;
  keywords: string[];
};

const START_MARKER = "---MEMORIES---";
const END_MARKER = "---END_MEMORIES---";

export function parseMemoriesFromResult(result: string): {
  cleanResult: string;
  memories: ParsedMemory[];
} {
  const startIdx = result.indexOf(START_MARKER);
  if (startIdx === -1) {
    return { cleanResult: result, memories: [] };
  }

  const endIdx = result.indexOf(END_MARKER, startIdx);
  if (endIdx === -1) {
    return { cleanResult: result, memories: [] };
  }

  const blockContent = result
    .slice(startIdx + START_MARKER.length, endIdx)
    .trim();

  const cleanResult = (
    result.slice(0, startIdx) + result.slice(endIdx + END_MARKER.length)
  ).trim();

  try {
    const parsed: unknown = JSON.parse(blockContent);
    if (!Array.isArray(parsed)) {
      return { cleanResult, memories: [] };
    }

    const memories = parsed.filter(
      (item): item is ParsedMemory =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as Record<string, unknown>).title === "string" &&
        typeof (item as Record<string, unknown>).content === "string" &&
        Array.isArray((item as Record<string, unknown>).keywords),
    );

    return { cleanResult, memories };
  } catch {
    return { cleanResult, memories: [] };
  }
}
