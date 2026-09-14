/**
 * File validation utilities
 * Focused module for file type checking and validation
 */

const ZIP_TYPES = [
  "application/zip",
  "application/x-zip-compressed",
  "application/octet-stream",
];

/**
 * Check if a file is a ZIP file based on content type or filename
 */
export function isZipFile(file: {
  contentType?: string;
  name?: string;
}): boolean {
  return (
    ZIP_TYPES.includes(file.contentType || "") ||
    file.name?.toLowerCase().endsWith(".zip") ||
    false
  );
}
