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
