"use server";

import { getSuggestionsByDocumentId } from "@wildfires-org/turboplan-db/queries";

export async function getSuggestions({ documentId }: { documentId: string }) {
  const suggestions = await getSuggestionsByDocumentId({ documentId });
  return suggestions ?? [];
}
