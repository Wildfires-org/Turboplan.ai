/**
 * Protocol allow-list for URLs that are stored and later opened as links.
 *
 * `z.string().url()` accepts any scheme (`javascript:`, `data:`, `vbscript:`),
 * and `window.open` does not get React's `javascript:` href blocking. Framework
 * free so it is usable from Zod schemas, Workers and client components alike.
 */

const SAFE_PROTOCOLS = new Set(["http:", "https:"]);

export const isSafeHttpUrl = (
  value: string | null | undefined,
): value is string => {
  if (!value) {
    return false;
  }

  try {
    return SAFE_PROTOCOLS.has(new URL(value).protocol);
  } catch {
    return false;
  }
};

/** Returns the URL when it is http(s), otherwise `undefined`. */
export const safeExternalUrl = (
  value: string | null | undefined,
): string | undefined => {
  return isSafeHttpUrl(value) ? value : undefined;
};

export const HTTP_URL_ONLY_MESSAGE = "Only http(s) URLs are allowed";
