/**
 * Input rules shared by project and organization documents, so the upload and
 * rename checks cannot drift apart between the two.
 */

import { z } from "zod";

import { isStorageUrl } from "@wildfires-org/turboplan-upload/server";
import {
  isProjectDocumentMimeType,
  PROJECT_DOCUMENT_MAX_FILE_SIZE,
} from "@wildfires-org/turboplan-upload/types";

// Maximum filename length, extension included
const MAX_FILENAME_LENGTH = 255;

// Rejects Unicode control (\p{Cc}) and format (\p{Cf}) characters. Both classes
// are invisible but load-bearing in the places this name ends up: CR/LF would
// inject headers into the download's Content-Disposition, NUL truncates in
// C-string consumers, and U+202E (RTLO, a Cf character) visually reverses the
// tail so "fdp.exe" renders as "exe.pdf" — spoofing an extension that the
// pinning below otherwise guarantees.
const FILENAME_SAFE_PATTERN = /^[^\p{Cc}\p{Cf}]+$/u;

/**
 * File fields of a document registered after its upload to storage. Callers
 * extend it with the owning entity's id.
 */
export const uploadedDocumentFieldsSchema = z.object({
  filename: z.string().min(1, "Filename is required").max(255),
  originalFilename: z.string().min(1, "Original filename is required").max(255),
  mimeType: z
    .string()
    .refine(
      (type) => isProjectDocumentMimeType(type),
      "File type not allowed. Only PDF and Word documents are supported.",
    ),
  size: z
    .number()
    .int()
    .positive()
    .max(
      PROJECT_DOCUMENT_MAX_FILE_SIZE,
      "File size exceeds maximum allowed (50MB)",
    ),
  // User-registered documents must live in our own storage bucket. Anything
  // else lets an editor point the document extractor at an arbitrary host
  // (SSRF, including DNS-rebinding, which hostname checks cannot stop).
  url: z
    .string()
    .url("Invalid file URL")
    .refine((value) => isStorageUrl(value), "File URL must point to storage"),
});

/**
 * A document display name: trimmed, 1-255 chars, no path separators and no
 * control or formatting characters. On rename, pass the result through
 * {@link normalizeRenamedFilename} to pin the extension.
 */
export const documentDisplayNameSchema = z
  .string()
  .trim()
  .min(1, "Filename is required")
  .max(MAX_FILENAME_LENGTH, "Filename must be 255 characters or fewer")
  .refine(
    (value) => !value.includes("/") && !value.includes("\\"),
    "Filename must not contain path separators",
  )
  .refine(
    (value) => FILENAME_SAFE_PATTERN.test(value),
    "Filename must not contain control or formatting characters",
  );

/**
 * Splits a filename into basename and extension (leading dot included).
 * Names with no dot ("README") and dotfiles (".env") have no extension.
 */
const splitFilename = (filename: string) => {
  const dotIndex = filename.lastIndexOf(".");

  if (dotIndex <= 0) {
    return { basename: filename, extension: "" };
  }

  return {
    basename: filename.slice(0, dotIndex),
    extension: filename.slice(dotIndex),
  };
};

/**
 * The display name a rename should store, or the reason it is invalid.
 *
 * Rename is display-name-only: the extension is pinned to whatever the stored
 * file already had. The dialog only lets the basename be edited, but a direct
 * API call could strip the extension (breaking downloads, which use this name
 * verbatim) or swap in a misleading one (".exe"). Re-append the original
 * extension whenever the request drops or changes it.
 */
export const normalizeRenamedFilename = (
  requestedFilename: string,
  currentFilename: string,
): { filename: string } | { error: string } => {
  const { extension } = splitFilename(currentFilename);
  const requestedBasename = splitFilename(requestedFilename).basename.trim();

  if (requestedBasename.length === 0) {
    return { error: "Filename is required" };
  }

  const filename = `${requestedBasename}${extension}`;

  if (filename.length > MAX_FILENAME_LENGTH) {
    return { error: "Filename must be 255 characters or fewer" };
  }

  return { filename };
};
