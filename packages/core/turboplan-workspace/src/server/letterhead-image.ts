import {
  getObjectBytes,
  isStorageHost,
  isStorageUrl,
  readCapped,
} from "@wildfires-org/turboplan-upload/server";

import { isGridLogoKey } from "../letterhead-grid";

// The one image guard behind every letterhead, banner and footer logo the
// server serves (logo proxies) or embeds (PDF export, signing): grid logos by
// their R2 object key, read with the bucket's credentials; legacy logos
// (office/org letterhead, banner, footer, library letterheads) by their
// stored URL through an SSRF-guarded fetch of our own storage.

export type ImageBytes = { data: Uint8Array; contentType: string };

/**
 * Where a logo is: a grid logo cell's object key, or a legacy logo's URL
 * (null when none is configured).
 */
export type LetterheadImageSource = { key: string } | { url: string | null };

// Image content types supported by both PDFKit and the docx generator. Logos in
// any other format are ignored rather than passed through and failing downstream.
const SUPPORTED_IMAGE_CONTENT_TYPES = new Set(["image/png", "image/jpeg"]);

// Bound every read so a hostile or unhealthy source can't hang the request or
// exhaust memory. Logos live in our blob storage and are small.
const IMAGE_FETCH_TIMEOUT_MS = 5000;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// A URL's origin for a log line (never its path), or "invalid".
const urlOrigin = (url: string): string => {
  try {
    return new URL(url).origin;
  } catch {
    return "invalid";
  }
};

// An error's name for a log line (never its message, which may carry a URL).
export const errorName = (error: unknown): string =>
  error instanceof Error ? error.name : typeof error;

// External image URLs already reported as refused, so each is logged once per
// process: an organization's logo may be an external link by design, and its
// refusal is not news on every export. Bounded, so a stream of distinct URLs
// cannot grow it without limit.
const reportedRefusals = new Set<string>();
const MAX_REPORTED_REFUSALS = 500;

const reportRefusal = (url: string): void => {
  // On one of our storage hosts but under no configured base (or not a
  // well-formed key): usually R2_PUBLIC_URL does not list the base the object
  // was stored under — a misconfiguration, reported every time.
  if (isStorageHost(url)) {
    console.warn("[branding] Image URL refused (storage host, no known key):", {
      origin: urlOrigin(url),
    });
    return;
  }
  if (reportedRefusals.has(url)) {
    return;
  }
  if (reportedRefusals.size >= MAX_REPORTED_REFUSALS) {
    reportedRefusals.clear();
  }
  reportedRefusals.add(url);
  console.warn("[branding] Image URL refused (not our storage):", {
    origin: urlOrigin(url),
  });
};

// The lowercased media type of a Content-Type value, without parameters.
const mediaType = (contentType: string | null | undefined): string =>
  (contentType ?? "").split(";")[0].trim().toLowerCase();

const isSupportedImage = (contentType: string): boolean => {
  if (SUPPORTED_IMAGE_CONTENT_TYPES.has(contentType)) {
    return true;
  }
  console.warn("[branding] Image type not supported:", { contentType });
  return false;
};

// A grid logo by object key, with the bucket's credentials: never over HTTP,
// so it works whether or not the bucket is public. Only a letterhead logo key
// is read (`isGridLogoKey`), never another object of the bucket.
const readKey = async (key: string): Promise<ImageBytes | null> => {
  if (!isGridLogoKey(key)) {
    console.warn("[branding] Image key refused (not a letterhead logo key)");
    return null;
  }
  const object = await getObjectBytes(key, {
    maxBytes: MAX_IMAGE_BYTES,
    timeoutMs: IMAGE_FETCH_TIMEOUT_MS,
  });
  return object && isSupportedImage(object.contentType) ? object : null;
};

// A legacy logo by URL. Only URLs on our own blob storage are fetched —
// arbitrary URLs are refused so an org/office admin can't aim the server at
// internal hosts (SSRF) — and a redirect is never followed (it could leave
// our storage).
const fetchUrl = async (url: string): Promise<ImageBytes | null> => {
  if (!isStorageUrl(url)) {
    reportRefusal(url);
    return null;
  }

  try {
    // One deadline for the request and the body.
    const signal = AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS);
    const res = await fetch(url, {
      // Not "error": the Workers runtime rejects it. A redirect comes back as
      // its own 3xx response (not ok, below) and is never followed.
      redirect: "manual",
      signal,
    });
    if (!res.ok) {
      await res.body?.cancel().catch(() => {});
      console.warn("[branding] Image fetch failed:", { status: res.status });
      return null;
    }

    const contentType = mediaType(res.headers.get("content-type"));
    if (!isSupportedImage(contentType)) {
      await res.body?.cancel().catch(() => {});
      return null;
    }

    // Reject oversized payloads up front when the server declares a length.
    const declaredLength = Number(res.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_IMAGE_BYTES) {
      await res.body?.cancel().catch(() => {});
      console.warn("[branding] Image too large:", { bytes: declaredLength });
      return null;
    }

    if (!res.body) {
      console.warn("[branding] Image fetch failed:", { status: res.status });
      return null;
    }
    // Counted as it streams, for servers that omit or understate
    // content-length: never more than the cap is buffered.
    const data = await readCapped(res.body, MAX_IMAGE_BYTES, signal);
    if (data === "too_large") {
      console.warn("[branding] Image too large:", {
        maxBytes: MAX_IMAGE_BYTES,
      });
      return null;
    }
    if (data === "timeout") {
      console.warn("[branding] Image fetch failed:", { error: "TimeoutError" });
      return null;
    }

    return { data, contentType };
  } catch (error) {
    console.warn("[branding] Image fetch failed:", {
      error: errorName(error),
    });
    return null;
  }
};

/**
 * A letterhead image's bytes, PNG or JPEG only (the formats both the PDF and
 * the docx generators accept), at most 5 MB, within 5 s. A `key` (grid logo
 * cells) is read from the bucket with its credentials — only a letterhead
 * logo key (`letterheads/…`, `uploads/…`), never over HTTP; a `url` (legacy
 * logos) is fetched only from our own storage, never following a redirect.
 * Null — never throws — when there is no source, it is refused, missing,
 * too large, too slow or not a supported image.
 */
export const readLetterheadImage = async (
  source: LetterheadImageSource,
): Promise<ImageBytes | null> => {
  if ("key" in source) {
    return readKey(source.key);
  }
  return source.url ? fetchUrl(source.url) : null;
};
