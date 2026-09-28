/**
 * Detects whether an extensionless research-document URL serves a real file
 * (many government sites serve PDFs from opaque `/attachment/<id>` URLs) by
 * probing its Content-Type. Never reads a response body.
 */

import {
  isDocumentMimeType,
  isPreviewableDocumentUrl,
} from "../document-preview-utils";
import {
  getDocumentMimeTypeForFilename,
  parseContentDispositionFilename,
  parseMediaType,
} from "./document-utils";
import { describeUrlForLog, safeFetch } from "./safe-fetch";

const LOG_PREFIX = "document-probe";
const PROBE_REQUEST_TIMEOUT_MS = 4_000;
const PROBE_CONCURRENCY = 8;
// New probes stop starting after this; in-flight ones still finish within
// their own timeouts. Keeps a 100-document webhook batch bounded.
const PROBE_BATCH_BUDGET_MS = 20_000;

export type DocumentProbeResult = {
  isDownloadable: boolean;
  contentType?: string;
};

const NOT_DOWNLOADABLE: DocumentProbeResult = { isDownloadable: false };

/**
 * Decide from response headers alone. Returns the allowlisted MIME type when
 * the response is a document, null when it definitely is not (e.g. text/html),
 * and undefined when the headers are inconclusive (missing type, or a bare
 * octet-stream without a document filename in Content-Disposition).
 */
export const resolveProbedDocumentType = (
  headers: Headers,
): string | null | undefined => {
  const mediaType = parseMediaType(headers.get("content-type"));
  if (isDocumentMimeType(mediaType)) {
    return mediaType;
  }

  if (mediaType !== "" && mediaType !== "application/octet-stream") {
    return null;
  }

  const dispositionType = getDocumentMimeTypeForFilename(
    parseContentDispositionFilename(headers.get("content-disposition")),
  );
  return dispositionType ?? undefined;
};

const probeOnce = async (
  url: string,
  method: "HEAD" | "GET",
): Promise<{ blocked: boolean; type: string | null | undefined }> => {
  const response = await safeFetch(url, {
    logPrefix: LOG_PREFIX,
    timeoutMs: PROBE_REQUEST_TIMEOUT_MS,
    method,
    // Servers that ignore Range still get their body cancelled unread below.
    headers: method === "GET" ? { Range: "bytes=0-0" } : undefined,
  });
  if (!response) {
    return { blocked: true, type: undefined };
  }
  await response.body?.cancel();
  if (!response.ok) {
    return { blocked: false, type: undefined };
  }
  return { blocked: false, type: resolveProbedDocumentType(response.headers) };
};

/**
 * Probe a URL's content type: HEAD first, then a one-byte ranged GET when HEAD
 * errors, is refused (405/403/...), or gives no usable type. Any failure means
 * not downloadable.
 */
export const probeDocumentUrl = async (
  url: string,
): Promise<DocumentProbeResult> => {
  try {
    const head = await probeOnce(url, "HEAD").catch(() => undefined);
    if (head?.blocked || head?.type === null) {
      return NOT_DOWNLOADABLE;
    }
    if (head?.type) {
      return { isDownloadable: true, contentType: head.type };
    }

    const get = await probeOnce(url, "GET");
    if (get.type) {
      return { isDownloadable: true, contentType: get.type };
    }
    return NOT_DOWNLOADABLE;
  } catch (error) {
    const reason = error instanceof Error ? error.name : "unknown error";
    console.warn(
      `[${LOG_PREFIX}] Probe failed for ${describeUrlForLog(url)}: ${reason}`,
    );
    return NOT_DOWNLOADABLE;
  }
};

const mapWithConcurrency = async <T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> => {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await fn(items[index]);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
  return results;
};

/**
 * Annotate documents whose URL shape does not already mark them as files
 * (no .pdf/.doc/.docx suffix, not a Box download) with the probe result.
 * Documents with a known extension are returned unchanged.
 */
export const annotateDocumentDownloadability = async <
  T extends { url: string },
>(
  documents: T[],
  probe: (url: string) => Promise<DocumentProbeResult> = probeDocumentUrl,
): Promise<(T & Partial<DocumentProbeResult>)[]> => {
  const deadline = Date.now() + PROBE_BATCH_BUDGET_MS;
  let skippedCount = 0;

  const annotated = await mapWithConcurrency(
    documents,
    PROBE_CONCURRENCY,
    async (doc): Promise<T & Partial<DocumentProbeResult>> => {
      if (isPreviewableDocumentUrl(doc.url)) {
        return doc;
      }
      if (Date.now() > deadline) {
        skippedCount += 1;
        return { ...doc, ...NOT_DOWNLOADABLE };
      }
      return { ...doc, ...(await probe(doc.url)) };
    },
  );

  if (skippedCount > 0) {
    console.warn(
      `[${LOG_PREFIX}] Probe budget exhausted, ${skippedCount} document(s) marked link-only`,
    );
  }
  return annotated;
};
