import { desc } from "drizzle-orm";
import { arrayOverlaps } from "drizzle-orm/sql/expressions/conditions";

import { researchAgentMemories } from "@wildfires-org/turboplan-db";
import { type DbInstance, getDB } from "@wildfires-org/turboplan-db/db-client";

export type MemoryRecord = {
  id: string;
  title: string;
  content: string;
  keywords: string[];
  runId: string | null;
  createdAt: Date;
};

export type MemoryRepository = {
  save(params: {
    title: string;
    content: string;
    keywords: string[];
    runId?: string;
  }): Promise<MemoryRecord>;

  findRelevant(params: {
    keywords: string[];
    limit?: number;
  }): Promise<MemoryRecord[]>;
};

export function createMemoryRepository(
  db: DbInstance = getDB(),
): MemoryRepository {
  return {
    async save({ title, content, keywords, runId }) {
      const [row] = await db
        .insert(researchAgentMemories)
        .values({
          title,
          content,
          keywords,
          runId: runId ?? null,
        })
        .returning();

      if (!row) throw new Error("Failed to save memory");
      return row as MemoryRecord;
    },

    async findRelevant({ keywords, limit = 5 }) {
      const rows = await db
        .select()
        .from(researchAgentMemories)
        .where(arrayOverlaps(researchAgentMemories.keywords, keywords))
        .orderBy(desc(researchAgentMemories.createdAt))
        .limit(limit);

      return rows as MemoryRecord[];
    },
  };
}
