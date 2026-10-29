import "server-only";

import { createProjectDocument } from "@wildfires-org/turboplan-db/queries";
import { createTimelineRecord } from "@wildfires-org/turboplan-timeline-records/server";
import {
  type ClaimedLandingUpload,
  claimLandingUpload,
  deleteOwnedStorageFile,
  getLandingUploadDestination,
  inspectLandingUpload,
} from "@wildfires-org/turboplan-upload/server";

import type { InitialAttachment } from "@/lib/initial-attachments";
import { landingUploadKeysSchema } from "./types";

type AttachLandingUploadsParams = {
  /** Client-supplied, so re-checked here */
  keys: string[] | undefined;
  projectId: string;
  /** Owner of the project; the files move into this user's uploads */
  userId: string;
  logPrefix: string;
};

/**
 * Claim one landing-page upload and register it the way
 * `POST /api/project-documents` does: a document row plus a timeline record.
 * New rows default to `extraction_status = 'pending'`, which is what queues
 * them for the research agent's text extraction.
 *
 * The timeline record is best-effort: once the row exists the document is
 * attached, so a failed timeline insert is only logged.
 *
 * Never throws. Returns the document as a chat attachment, or null when
 * skipped.
 */
const attachLandingUpload = async (
  key: string,
  { projectId, userId, logPrefix }: Omit<AttachLandingUploadsParams, "keys">,
): Promise<InitialAttachment | null> => {
  let claimed: ClaimedLandingUpload | null;
  try {
    claimed = await claimLandingUpload(key, userId);
  } catch (error) {
    console.error(`${logPrefix} Skipping landing upload ${key}:`, error);
    return null;
  }

  if (!claimed) {
    console.warn(
      `${logPrefix} Landing upload ${key} not found (expired or already claimed)`,
    );
    return null;
  }

  let document: Awaited<ReturnType<typeof createProjectDocument>>;
  try {
    document = await createProjectDocument({
      projectId,
      userId,
      filename: claimed.key.split("/").pop() ?? claimed.originalFilename,
      originalFilename: claimed.originalFilename,
      mimeType: claimed.contentType,
      size: claimed.size,
      url: claimed.url,
    });
  } catch (error) {
    console.error(
      `${logPrefix} Failed to register landing upload ${key}:`,
      error,
    );
    // No row points at the copy, so nothing could ever reach or delete it.
    await deleteOwnedStorageFile(claimed.url, { userId });
    return null;
  }

  // The row now points at the stored file, so a timeline failure must not
  // delete it — the document is usable without its activity entry.
  try {
    await createTimelineRecord({
      projectId,
      userId,
      entityType: "document",
      entityId: document.id,
      entityName: document.originalFilename,
      action: "created",
      resourceUrls: [
        {
          url: document.url,
          filename: document.originalFilename,
          type: document.mimeType,
        },
      ],
    });
  } catch (error) {
    console.error(
      `${logPrefix} Failed to record timeline entry for landing upload ${key}:`,
      error,
    );
  }

  return {
    url: document.url,
    name: document.originalFilename,
    contentType: document.mimeType,
  };
};

// The client-supplied keys, deduped, or none when the payload is malformed.
const parseLandingUploadKeys = (
  keys: string[] | undefined,
  logPrefix: string,
): string[] => {
  if (keys === undefined) {
    return [];
  }

  const parsed = landingUploadKeysSchema.safeParse(keys);
  if (!parsed.success) {
    console.error(`${logPrefix} Ignoring malformed landing upload keys`);
    return [];
  }

  return [...new Set(parsed.data)];
};

/**
 * Attach the documents a visitor uploaded with their landing-page prompt to
 * the project just created for them. Best-effort per file: a bad key, a
 * missing object or a failed insert is logged and skipped, never failing the
 * signup or project creation.
 *
 * Returns the attached documents as attachments for the first chat message.
 */
export const attachLandingUploads = async ({
  keys,
  ...context
}: AttachLandingUploadsParams): Promise<InitialAttachment[]> => {
  const attachments = await Promise.all(
    parseLandingUploadKeys(keys, context.logPrefix).map((key) =>
      attachLandingUpload(key, context),
    ),
  );

  return attachments.filter(
    (attachment): attachment is InitialAttachment => attachment !== null,
  );
};

export type AttachableLandingUpload = {
  key: string;
  /** As `attachLandingUploads` will return it once `userId` claims the key */
  attachment: InitialAttachment;
};

/**
 * The landing uploads a claim would accept right now: each key is checked in
 * storage (`inspectLandingUpload`, nothing consumed) against the claim's own
 * type and size rules. For when the first chat message has to carry the
 * documents before they are claimed: the URL is the one the claim for
 * `userId` will move each upload to. Never throws; a missing, disallowed or
 * unreadable upload is logged and left out.
 */
export const findAttachableLandingUploads = async ({
  keys,
  userId,
  logPrefix,
}: Pick<AttachLandingUploadsParams, "keys" | "userId" | "logPrefix">): Promise<
  AttachableLandingUpload[]
> => {
  const uploads = await Promise.all(
    parseLandingUploadKeys(keys, logPrefix).map(
      async (key): Promise<AttachableLandingUpload | null> => {
        try {
          const { url } = getLandingUploadDestination(key, userId);
          const upload = await inspectLandingUpload(key);
          if (!upload) {
            console.warn(
              `${logPrefix} Landing upload ${key} not found (expired, already claimed or never uploaded)`,
            );
            return null;
          }
          return {
            key,
            attachment: {
              url,
              name: upload.originalFilename,
              contentType: upload.contentType,
            },
          };
        } catch (error) {
          console.error(`${logPrefix} Skipping landing upload ${key}:`, error);
          return null;
        }
      },
    ),
  );

  return uploads.filter(
    (upload): upload is AttachableLandingUpload => upload !== null,
  );
};

/**
 * Text of the first chat message: the visitor's prompt, unchanged — the
 * documents ride that message as attachments, so the text need not name
 * them. Only without a prompt does it ask for them to be read, since a
 * message with attachments must still have text (an empty text part is
 * rejected by the model).
 */
export const buildInitialMessageContent = (
  prompt: string | undefined,
  attachments: InitialAttachment[],
): string | undefined => {
  if (prompt?.trim() || attachments.length === 0) {
    return prompt;
  }

  return attachments.length === 1
    ? "Please read the attached document and use it as context for the project."
    : "Please read the attached documents and use them as context for the project.";
};
