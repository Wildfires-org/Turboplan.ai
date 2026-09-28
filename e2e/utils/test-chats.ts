import { randomUUID } from "node:crypto";

import { saveChat } from "@wildfires-org/turboplan-db/queries";

/**
 * Seed an empty, non-initial project chat directly in the database, so a test
 * can open `/chats/[chatId]` without sending a real first message (which would
 * create the chat through the model-backed POST /api/chat).
 */
export const createTestProjectChat = async (params: {
  userId: string;
  projectId: string;
  title: string;
}): Promise<{ id: string; title: string }> => {
  const { userId, projectId, title } = params;
  const id = randomUUID();

  await saveChat({ id, userId, projectId, title, isInitial: false });

  return { id, title };
};
