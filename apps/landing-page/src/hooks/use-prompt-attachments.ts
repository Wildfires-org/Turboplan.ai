"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { getLandingPageEnv } from "@wildfires-org/turboplan-env";
import {
  classifyProjectFile,
  MAX_LANDING_UPLOADS,
  PROJECT_DOCUMENT_MAX_FILE_SIZE,
  resolveProjectFileContentType,
} from "@wildfires-org/turboplan-upload/types";

import {
  UPLOAD_FAILED_MESSAGE,
  uploadPromptDocument,
} from "@/lib/upload-prompt-document";

export type PromptAttachmentStatus = "uploading" | "uploaded" | "error";

export interface PromptAttachment {
  id: string;
  name: string;
  size: number;
  status: PromptAttachmentStatus;
  /** Storage key, set once the upload finished */
  key?: string;
  error?: string;
}

/** A finished upload, handed to the signup modal. */
export interface AttachedDocument {
  key: string;
  name: string;
}

interface QueuedUpload {
  attachment: PromptAttachment;
  file: File;
  contentType: string;
}

const MB = 1024 * 1024;

export const formatMegabytes = (bytes: number) => `${Math.round(bytes / MB)}MB`;

/** Same file twice: name + size, as the app's dropzones dedupe. */
const getDedupeKey = (name: string, size: number) => `${name}:${size}`;

// Documents only: GIS files are accepted in the app but not here.
const getRejection = (file: File): string | null => {
  if (classifyProjectFile(file) !== "document") {
    return `${file.name} isn't a PDF or Word document.`;
  }
  if (file.size > PROJECT_DOCUMENT_MAX_FILE_SIZE) {
    return `${file.name} is over the ${formatMegabytes(PROJECT_DOCUMENT_MAX_FILE_SIZE)} limit.`;
  }
  return null;
};

/**
 * Documents attached to the hero prompt. Each file uploads as soon as it is
 * added; removing one only drops its key (unclaimed uploads expire
 * server-side). Invalid files never become attachments; they are reported in
 * `notices`, next to one line per failed upload.
 */
export const usePromptAttachments = () => {
  const ENV = getLandingPageEnv();
  const [attachments, setAttachments] = useState<PromptAttachment[]>([]);
  // Why files from the latest pick or drop were turned away.
  const [rejections, setRejections] = useState<string[]>([]);
  const attachmentsRef = useRef(attachments);
  attachmentsRef.current = attachments;
  const controllersRef = useRef(new Map<string, AbortController>());
  const nextIdRef = useRef(0);

  useEffect(() => {
    const controllers = controllersRef.current;
    return () => {
      for (const controller of controllers.values()) {
        controller.abort();
      }
    };
  }, []);

  const updateAttachment = (id: string, patch: Partial<PromptAttachment>) => {
    setAttachments((current) =>
      current.map((attachment) =>
        attachment.id === id ? { ...attachment, ...patch } : attachment,
      ),
    );
  };

  const startUpload = async ({
    attachment,
    file,
    contentType,
  }: QueuedUpload) => {
    const controller = new AbortController();
    controllersRef.current.set(attachment.id, controller);

    try {
      const key = await uploadPromptDocument({
        serverUrl: ENV.SERVER_URL,
        file,
        contentType,
        signal: controller.signal,
      });
      updateAttachment(attachment.id, { status: "uploaded", key });
    } catch (error) {
      // Removed while uploading: the attachment is already gone.
      if (controller.signal.aborted) {
        return;
      }
      const message =
        error instanceof Error && error.message
          ? error.message
          : UPLOAD_FAILED_MESSAGE;
      updateAttachment(attachment.id, { status: "error", error: message });
    } finally {
      controllersRef.current.delete(attachment.id);
    }
  };

  const addFiles = (files: File[]) => {
    // Failed uploads do not come along, so they neither count towards the
    // limit nor block adding the same file again (which retries it).
    const kept = attachmentsRef.current.filter(
      (attachment) => attachment.status !== "error",
    );
    const seen = new Set(
      kept.map((attachment) => getDedupeKey(attachment.name, attachment.size)),
    );
    const remainingSlots = MAX_LANDING_UPLOADS - kept.length;
    const queued: QueuedUpload[] = [];
    const turnedAway: string[] = [];
    let skippedOverLimit = 0;

    for (const file of files) {
      const rejection = getRejection(file);
      const contentType = resolveProjectFileContentType(file);
      if (rejection || !contentType) {
        turnedAway.push(rejection ?? `${file.name} isn't supported.`);
        continue;
      }
      const dedupeKey = getDedupeKey(file.name, file.size);
      if (seen.has(dedupeKey)) {
        continue;
      }
      if (queued.length >= remainingSlots) {
        skippedOverLimit += 1;
        continue;
      }
      seen.add(dedupeKey);
      nextIdRef.current += 1;
      queued.push({
        attachment: {
          id: `prompt-attachment-${nextIdRef.current}`,
          name: file.name,
          size: file.size,
          status: "uploading",
        },
        file,
        contentType,
      });
    }

    if (skippedOverLimit > 0) {
      turnedAway.push(`You can attach up to ${MAX_LANDING_UPLOADS} documents.`);
    }
    setRejections(turnedAway);

    if (queued.length === 0) {
      return;
    }

    const retriedKeys = new Set(
      queued.map(({ file }) => getDedupeKey(file.name, file.size)),
    );
    setAttachments((current) => [
      ...current.filter(
        (attachment) =>
          attachment.status !== "error" ||
          !retriedKeys.has(getDedupeKey(attachment.name, attachment.size)),
      ),
      ...queued.map(({ attachment }) => attachment),
    ]);

    for (const upload of queued) {
      void startUpload(upload);
    }
  };

  const removeAttachment = (id: string) => {
    controllersRef.current.get(id)?.abort();
    setAttachments((current) =>
      current.filter((attachment) => attachment.id !== id),
    );
    setRejections([]);
  };

  const attachedDocuments = useMemo(
    () =>
      attachments.flatMap((attachment): AttachedDocument[] =>
        attachment.status === "uploaded" && attachment.key
          ? [{ key: attachment.key, name: attachment.name }]
          : [],
      ),
    [attachments],
  );

  const isUploading = attachments.some(
    (attachment) => attachment.status === "uploading",
  );

  // Derived from the attachments, so removing or retrying a failed file
  // clears its line too. Deduped: identical lines say nothing new.
  const notices = [
    ...new Set([
      ...rejections,
      ...attachments.flatMap((attachment) =>
        attachment.status === "error"
          ? [
              `${attachment.name} couldn't be uploaded. ${attachment.error ?? ""}`,
            ]
          : [],
      ),
    ]),
  ];

  return {
    attachments,
    attachedDocuments,
    isUploading,
    notices,
    addFiles,
    removeAttachment,
  };
};
