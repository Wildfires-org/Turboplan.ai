import { logger } from "../../infra/logger";
import type { FastModelClient } from "../ai-client";

const SYSTEM_PROMPT = `Extract 3-7 specific, searchable keywords from the user's prompt that would help find relevant past memories. Return ONLY a JSON array of lowercase strings, nothing else. Example: ["habitat restoration","environmental assessment","wetland","protected species","permit"]`;

function extractJsonArray(text: string): string[] | null {
  const match = text.match(/\[[\s\S]*?\]/);
  if (!match) return null;

  try {
    const parsed: unknown = JSON.parse(match[0]);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return null;
  }
}

export async function extractKeywordsFromPrompt(
  client: FastModelClient,
  prompt: string,
): Promise<string[]> {
  try {
    const truncated = prompt.slice(0, 500);
    const response = await client.complete({
      system: SYSTEM_PROMPT,
      prompt: truncated,
      maxTokens: 128,
    });

    return extractJsonArray(response) ?? [];
  } catch (err) {
    logger.error("Failed to extract keywords", err);
    return [];
  }
}
