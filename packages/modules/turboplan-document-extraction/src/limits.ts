/**
 * Maximum number of characters returned for a single document. Extracted text
 * longer than this is sliced and flagged with `truncated: true`.
 */
export const MAX_EXTRACTED_CHARS = 40_000;

/**
 * Hard cap on how many PDF pages are read. Extraction stops here and flags
 * `truncated: true` — a 512MB box cannot afford to walk a 10k-page scan even
 * though each page is released right after it is read.
 */
export const MAX_PDF_PAGES = 400;

/** Largest document body the download accepts. */
export const MAX_DOCUMENT_BYTES = 50 * 1024 * 1024; // 50MB
