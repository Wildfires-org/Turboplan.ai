const PREVIEWABLE_EXTENSIONS = [".pdf", ".doc", ".docx"];

const BOX_DOWNLOAD_PATTERN =
  /app\.box\.com\/index\.php\?.*rm=box_download_shared_file/i;

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

export function deriveFilenameFromUrl(
  url: string,
  fallbackTitle: string,
): { originalFilename: string; needsExtension: boolean } {
  if (isBoxDownloadUrl(url)) {
    const sanitized = fallbackTitle
      .replace(/[\x00-\x1f/\\:*?"<>|]/g, "_")
      .slice(0, 200);
    return { originalFilename: `${sanitized}.pdf`, needsExtension: false };
  }

  try {
    const urlPath = new URL(url).pathname;
    const fromPath =
      decodeURIComponent(urlPath.split("/").pop() || "") ||
      `${fallbackTitle}.pdf`;

    return {
      originalFilename: fromPath,
      needsExtension: !fromPath.includes("."),
    };
  } catch {
    return { originalFilename: `${fallbackTitle}.pdf`, needsExtension: false };
  }
}
