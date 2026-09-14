"use server";

import {
  deleteMessagesByChatIdAfterTimestamp,
  getMessageById,
} from "@wildfires-org/turboplan-db/queries";
import { resetLastForwardedAtByChatId } from "@wildfires-org/turboplan-research-agent-integration/server";

import { auth } from "@/app/(auth)/auth";
import { userCanAccessChat } from "@/lib/api/chat-access";

export async function deleteTrailingMessages({ id }: { id: string }) {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const [message] = await getMessageById({ id });

  if (!message) {
    throw new Error("Message not found");
  }

  const hasAccess = await userCanAccessChat(session.user.id, message.chatId);

  if (!hasAccess) {
    throw new Error("Access denied");
  }

  await deleteMessagesByChatIdAfterTimestamp({
    chatId: message.chatId,
    timestamp: message.createdAt,
  });

  resetLastForwardedAtByChatId(message.chatId).catch((err) => {
    console.error(
      "[deleteTrailingMessages] Failed to reset research agent cursor:",
      err,
    );
  });
}
