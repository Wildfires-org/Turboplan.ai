const PREVIEWABLE_EXTENSIONS = [".pdf", ".doc", ".docx"];

const BOX_DOWNLOAD_PATTERN =
  /app\.box\.com\/index\.php\?.*rm=box_download_shared_file/i;

// Document types we download, preview and store. Anything else (html, svg,
// scripts, ...) must never reach the public bucket with its upstream type.
export const DOCUMENT_MIME_EXTENSIONS: Record<string, string> = {
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    ".docx",
};

export const isDocumentMimeType = (
  mimeType: string | null | undefined,
): mimeType is string => {
  return !!mimeType && Object.hasOwn(DOCUMENT_MIME_EXTENSIONS, mimeType);
};

export const isBoxDownloadUrl = (url: string): boolean => {
  return BOX_DOWNLOAD_PATTERN.test(url);
};

export function isPreviewableDocumentUrl(url: string): boolean {
  const path = url.toLowerCase().split("?")[0];
  if (PREVIEWABLE_EXTENSIONS.some((ext) => path.endsWith(ext))) {
    return true;
  }
  return isBoxDownloadUrl(url);
}

/**
 * Whether a research document can be downloaded as a file. Prefers the flag
 * the server persisted after probing the URL's content type; documents stored
 * before the probe existed fall back to the URL-shape check.
 */
export const isDownloadableDocument = (doc: {
  url: string;
  isDownloadable?: boolean;
}): boolean => {
  return doc.isDownloadable ?? isPreviewableDocumentUrl(doc.url);
};
