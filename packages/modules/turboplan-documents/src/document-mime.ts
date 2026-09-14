export const PDF_MIME = "application/pdf";
export const DOC_MIME = "application/msword";
export const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const BOX_DOWNLOAD_PATTERN =
  /app\.box\.com\/index\.php\?.*rm=box_download_shared_file/i;

export const isBoxDownloadUrl = (url: string): boolean => {
  return BOX_DOWNLOAD_PATTERN.test(url);
};

const getMimeTypeFromNameOrUrl = (value?: string | null): string | null => {
  const normalized = value?.toLowerCase().trim();
  if (!normalized) return null;

  const path = normalized.split("?")[0];
  if (path.endsWith(".pdf")) return PDF_MIME;
  if (path.endsWith(".docx")) return DOCX_MIME;
  if (path.endsWith(".doc")) return DOC_MIME;
  return null;
};

export const getPreviewDocumentMimeType = ({
  mimeType,
  filename,
  url,
}: {
  mimeType?: string | null;
  filename?: string | null;
  url?: string | null;
}): string | null => {
  const normalizedMime = mimeType?.toLowerCase().trim();

  if (normalizedMime === PDF_MIME || normalizedMime === "pdf") return PDF_MIME;
  if (normalizedMime === DOC_MIME || normalizedMime === "doc") return DOC_MIME;
  if (normalizedMime === DOCX_MIME || normalizedMime === "docx")
    return DOCX_MIME;

  const fromName = getMimeTypeFromNameOrUrl(filename);
  if (fromName) {
    return fromName;
  }

  const fromUrl = getMimeTypeFromNameOrUrl(url);
  if (fromUrl) {
    return fromUrl;
  }

  if (url && isBoxDownloadUrl(url)) {
    return PDF_MIME;
  }

  return null;
};
