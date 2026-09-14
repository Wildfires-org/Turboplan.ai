export function log(line: string): void {
  process.stderr.write(`[agent] ${line}\n`);
}

export function truncate(text: string, maxLen: number): string {
  const collapsed = text.replace(/\n+/g, " ").trim();
  if (collapsed.length <= maxLen) return collapsed;
  return `${collapsed.slice(0, maxLen)}...`;
}

/**
 * Flatten a tool_result block's `content` (string, or array of text/other
 * blocks) into a single string for logging what a tool returned.
 */
export function stringifyToolResult(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((block) => {
        if (typeof block === "string") return block;
        if (block && typeof block === "object") {
          const obj = block as { type?: unknown; text?: unknown };
          if (typeof obj.text === "string") return obj.text;
          if (obj.type === "image") return "[image]";
        }
        return "";
      })
      .filter(Boolean)
      .join(" ");
  }
  return "";
}

export function summarizeToolInput(toolName: string, input: unknown): string {
  if (input == null || typeof input !== "object") return "";
  const obj = input as Record<string, unknown>;
  const fieldMap: Record<string, string> = {
    WebSearch: "query",
    WebFetch: "url",
    Bash: "command",
    Skill: "skill",
    Read: "file_path",
    mcp__firecrawl__firecrawl_scrape: "url",
    mcp__firecrawl__firecrawl_search: "query",
  };
  const key = fieldMap[toolName];
  if (key && typeof obj[key] === "string") {
    return truncate(obj[key] as string, 200);
  }
  // Fallback: show first string value
  for (const v of Object.values(obj)) {
    if (typeof v === "string") return truncate(v, 200);
  }
  return "";
}
