"use server";

import { updateChatVisiblityById } from "@wildfires-org/turboplan-db/queries";

import type { VisibilityType } from "@/components/visibility-selector";

/**
 * Update chat visibility (public/private)
 */
export async function updateChatVisibility({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: VisibilityType;
}) {
  await updateChatVisiblityById({ chatId, visibility });
}
