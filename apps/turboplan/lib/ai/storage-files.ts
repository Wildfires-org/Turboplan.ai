import type { UIMessage } from "ai";

import { isStorageUrl } from "@wildfires-org/turboplan-upload/server";

// v4-era attachments arrive on the legacy `experimental_attachments` field,
// which is not part of the v6 UIMessage type.
export type LegacyAttachment = {
  url: string;
  name?: string;
  contentType?: string;
};

/** A chat message as the client sends it: v6 file parts plus legacy attachments. */
export type ChatMessageWithAttachments = UIMessage & {
  experimental_attachments?: LegacyAttachment[];
};

/**
 * The message without any file whose URL is not an object in our storage
 * bucket. Every legitimate chat file is uploaded to storage first, so anything
 * else came from a crafted request or link (e.g. `initialAttachments`):
 * dropping it keeps external URLs out of the model payload (which the AI SDK
 * may download server-side), out of the saved message and out of the chat UI.
 */
export const withoutExternalFiles = <
  TMessage extends ChatMessageWithAttachments,
>(
  message: TMessage,
): TMessage => {
  const parts = message.parts?.filter(
    (part) => part.type !== "file" || isStorageUrl(part.url),
  );
  const attachments = message.experimental_attachments?.filter((attachment) =>
    isStorageUrl(attachment.url),
  );

  return {
    ...message,
    ...(parts ? { parts } : {}),
    ...(attachments ? { experimental_attachments: attachments } : {}),
  };
};
