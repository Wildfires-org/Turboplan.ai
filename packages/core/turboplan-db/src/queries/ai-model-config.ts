import { db } from "../db-client";
import { type AiModelConfig, aiModelConfig } from "../schemas";

const SINGLETON_ID = "00000000-0000-0000-0000-000000000001";

export async function getAiModelConfig(): Promise<AiModelConfig | null> {
  try {
    const [result] = await db.select().from(aiModelConfig).limit(1);
    return result ?? null;
  } catch (error) {
    console.error("Failed to get AI model config from database:", error);
    throw error;
  }
}

export async function upsertAiModelConfig(
  config: {
    primaryModel: string | null;
    liteModel: string | null;
    imagePrimaryModel: string | null;
    imageLiteModel: string | null;
  },
  updatedBy: string | null,
): Promise<AiModelConfig> {
  try {
    const [result] = await db
      .insert(aiModelConfig)
      .values({ id: SINGLETON_ID, ...config, updatedBy })
      .onConflictDoUpdate({
        target: aiModelConfig.id,
        set: { ...config, updatedBy, updatedAt: new Date() },
      })
      .returning();
    return result;
  } catch (error) {
    console.error("Failed to upsert AI model config in database:", error);
    throw error;
  }
}
