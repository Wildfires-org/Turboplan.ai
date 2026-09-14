// Allowed MIME types for document uploads
export const ALLOWED_MIME_TYPES = {
  "application/pdf": [".pdf"],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    ".docx",
  ],
} as const;

// Maximum file size: 50MB
export const MAX_FILE_SIZE = 50 * 1024 * 1024;

// Accept string for HTML file inputs
export const ACCEPT_STRING = Object.entries(ALLOWED_MIME_TYPES)
  .flatMap(([mime, exts]) => [mime, ...exts])
  .join(",");

/**
 * Format date to readable string with time
 */
export function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Get file type label from MIME type
 */
export function getFileTypeLabel(mimeType: string): string {
  const fileType = getFileTypeKey(mimeType);
  if (fileType === "pdf") return "PDF";
  if (fileType === "doc") return "DOC";
  if (fileType === "docx") return "DOCX";
  return "File";
}

/**
 * Human-readable source for a document row subtitle. Returns the URL hostname
 * for externally hosted docs (e.g. "usfs-public.app.box.com"), or null for our
 * own blob storage where the host is noise — callers fall back to the date.
 */
export function getDisplaySource(url: string): string | null {
  try {
    const { hostname } = new URL(url);
    if (hostname.includes("blob.vercel-storage.com")) {
      return null;
    }
    return hostname;
  } catch {
    return null;
  }
}

function getFileTypeKey(mimeType: string): "pdf" | "doc" | "docx" | "file" {
  if (mimeType === "application/pdf") {
    return "pdf";
  }
  if (mimeType === "application/msword") {
    return "doc";
  }
  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "docx";
  }
  return "file";
}
