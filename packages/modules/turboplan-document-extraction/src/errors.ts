import { PDF_MIME } from "./document-mime";

/** A failure written for the user: its message can be stored and shown as is. */
export class DocumentReadError extends Error {}

/** What to do about a Word (or unknown) file that could not be read. */
export const WORD_RESAVE_HINT =
  "Re-save it as .docx or PDF and upload it again.";

const PDF_RESAVE_HINT =
  "Export it to a new PDF (or save it as .docx) and upload it again.";

/** The re-save advice that fits the file's type. */
export const getResaveHint = (mimeType: string): string =>
  mimeType.toLowerCase().trim() === PDF_MIME
    ? PDF_RESAVE_HINT
    : WORD_RESAVE_HINT;

/**
 * Stored instead of a raw parser error (RangeError offsets, internal state),
 * which means nothing to the user and can leak implementation details.
 */
export const getGenericExtractionError = (mimeType: string): string =>
  `Could not read this file. It may be damaged or password-protected. ${getResaveHint(mimeType)}`;
