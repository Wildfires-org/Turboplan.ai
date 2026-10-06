/**
 * Files sent with a chat's auto-sent first message (`initialMessageContent`)
 * ride the redirect URL as one `INITIAL_ATTACHMENTS_PARAM`, a JSON array. The
 * self-service flow uses it for the documents a visitor attached on the
 * landing page, so they show up on that message like any chat upload.
 *
 * The param is attacker-controllable, so parsing never throws: anything
 * malformed is dropped as a whole.
 */
import { z } from "zod";

import type { Attachment } from "@wildfires-org/turboplan-chat-actions/types";
import { MAX_LANDING_UPLOADS } from "@wildfires-org/turboplan-upload/types";

/** An attachment with everything the chat needs to show and send it. */
export type InitialAttachment = Required<Attachment>;

export const INITIAL_ATTACHMENTS_PARAM = "initialAttachments";

const initialAttachmentsSchema = z
  .array(
    z.object({
      url: z.url({ protocol: /^https?$/ }),
      name: z.string().min(1),
      contentType: z.string(),
    }),
  )
  .max(MAX_LANDING_UPLOADS);

export const serializeInitialAttachments = (
  attachments: InitialAttachment[],
): string => JSON.stringify(attachments);

/** The attachments on the param, or none when it is missing or malformed. */
export const parseInitialAttachments = (
  raw: string | null | undefined,
): InitialAttachment[] => {
  if (!raw) {
    return [];
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return [];
  }

  const parsed = initialAttachmentsSchema.safeParse(json);
  return parsed.success ? parsed.data : [];
};
