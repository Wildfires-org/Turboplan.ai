import "server-only";

import { createProjectDocument } from "@wildfires-org/turboplan-db/queries";
import { createTimelineRecord } from "@wildfires-org/turboplan-timeline-records/server";
import {
  type ClaimedLandingUpload,
  claimLandingUpload,
  deleteOwnedStorageFile,
} from "@wildfires-org/turboplan-upload/server";

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
 * Never throws. Returns the document's display name, or null when skipped.
 */
const attachLandingUpload = async (
  key: string,
  { projectId, userId, logPrefix }: Omit<AttachLandingUploadsParams, "keys">,
): Promise<string | null> => {
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

  return document.originalFilename;
};

/**
 * Attach the documents a visitor uploaded with their landing-page prompt to
 * the project just created for them. Best-effort per file: a bad key, a
 * missing object or a failed insert is logged and skipped, never failing the
 * signup or project creation.
 *
 * Returns the display names of the documents that were attached.
 */
export const attachLandingUploads = async ({
  keys,
  ...context
}: AttachLandingUploadsParams): Promise<string[]> => {
  if (keys === undefined) {
    return [];
  }

  const parsed = landingUploadKeysSchema.safeParse(keys);
  if (!parsed.success) {
    console.error(
      `${context.logPrefix} Ignoring malformed landing upload keys`,
    );
    return [];
  }

  const names = await Promise.all(
    [...new Set(parsed.data)].map((key) => attachLandingUpload(key, context)),
  );

  return names.filter((name): name is string => name !== null);
};

/**
 * The first chat message: the visitor's prompt, plus a line asking the AI to
 * read the documents attached with it. Unchanged when nothing was attached.
 */
export const withAttachedDocumentsNote = (
  prompt: string | undefined,
  documentNames: string[],
): string | undefined => {
  if (documentNames.length === 0) {
    return prompt;
  }

  const names = documentNames.map((name) => `"${name}"`).join(", ");
  const pronoun = documentNames.length === 1 ? "it" : "them";
  const note = `I've attached ${names} to the project documents — please read ${pronoun} and use what you learn as context for the project.`;

  return prompt ? `${prompt}\n\n${note}` : note;
};
