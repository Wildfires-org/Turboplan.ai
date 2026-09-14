import { getChatById } from "@wildfires-org/turboplan-db/queries";
import { checkUserProjectAccess } from "@wildfires-org/turboplan-workspace/server";

/**
 * Read-level access check for a chat and its messages.
 *
 * A user may access a chat when they created it (personal chats) or when it
 * belongs to a project they are a member of (any role). Returns false for
 * missing chats so callers can respond uniformly without leaking existence.
 */
export const userCanAccessChat = async (
  userId: string,
  chatId: string,
): Promise<boolean> => {
  const chat = await getChatById({ id: chatId });

  if (!chat) {
    return false;
  }

  if (chat.userId === userId) {
    return true;
  }

  if (chat.projectId) {
    return checkUserProjectAccess(userId, chat.projectId);
  }

  return false;
};
