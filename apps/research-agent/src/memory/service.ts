import { logger } from "../infra/logger";
import type { FastModelClient } from "./ai-client";
import type { MemoryRecord, MemoryRepository } from "./repository";
import { extractKeywordsFromPrompt } from "./utils/extract-search-keywords";
import { parseMemoriesFromResult } from "./utils/parse-memory-block";

export type MemoryService = {
  getRelevantForPrompt(prompt: string): Promise<MemoryRecord[]>;
  processRunResult(
    result: string,
    runId: string,
  ): Promise<{
    cleanResult: string;
    savedCount: number;
  }>;
};

export function createMemoryService(
  repository: MemoryRepository,
  fastModelClient: FastModelClient | null,
): MemoryService {
  return {
    async getRelevantForPrompt(prompt) {
      let keywords: string[];

      // If fastModelClient is available, use it to extract keywords otherwise use the first 300 characters of the prompt to extract keywords
      if (fastModelClient) {
        keywords = await extractKeywordsFromPrompt(fastModelClient, prompt);
      } else {
        keywords = [
          ...new Set(
            prompt.slice(0, 300).toLowerCase().split(/\s+/).filter(Boolean),
          ),
        ];
      }

      if (keywords.length === 0) return [];
      return repository.findRelevant({ keywords, limit: 5 });
    },

    async processRunResult(result, runId) {
      const { cleanResult, memories } = parseMemoriesFromResult(result);

      let savedCount = 0;
      for (const memory of memories) {
        try {
          await repository.save({
            title: memory.title,
            content: memory.content,
            keywords: memory.keywords,
            runId,
          });
          savedCount++;
        } catch (err) {
          logger.error(`Failed to save memory "${memory.title}"`, err);
        }
      }

      return { cleanResult, savedCount };
    },
  };
}
