import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { getR2Env } from "@wildfires-org/turboplan-env";

let _s3Client: S3Client | null = null;

const getS3Client = (): S3Client => {
  if (!_s3Client) {
    const env = getR2Env();
    _s3Client = new S3Client({
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      region: "auto",
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return _s3Client;
};

export const resetR2Client = (): void => {
  _s3Client = null;
};

const getBucketName = (): string => {
  return getR2Env().R2_BUCKET_NAME;
};

// R2_PUBLIC_URL with any trailing slash removed, so the `/` boundary below is
// always present exactly once.
const getBaseUrl = (): string => {
  return getR2Env().R2_PUBLIC_URL.replace(/\/+$/, "");
};

const getPublicUrl = (key: string): string => {
  return `${getBaseUrl()}/${key}`;
};

// Control characters, DEL and backslash never appear in a key we generate
// (UploadService strips them), so their presence means the URL was crafted.
const hasUnsafeKeyChars = (key: string): boolean => {
  for (const char of key) {
    const code = char.codePointAt(0) ?? 0;
    if (code <= 0x1f || code === 0x7f || char === "\\") {
      return true;
    }
  }
  return false;
};

/**
 * Canonicalize a public storage URL into the exact object key it resolves to,
 * or `null` when it is not an unambiguous key inside our bucket.
 *
 * Every ownership decision has to run on this canonical form. A raw
 * string slice is not enough: `<base>/uploads/<attackerId>/../<victimId>/f.pdf`
 * slices to a key that starts with `uploads/<attackerId>/` yet resolves to the
 * victim's object once dot-segments are removed. Parsing with `new URL` does
 * that removal for us (WHATWG normalizes `pathname`), and the remaining checks
 * close the encoded variants of the same trick.
 */
export const canonicalStorageKey = (url: string): string | null => {
  if (typeof url !== "string" || url.length === 0) {
    return null;
  }

  let base: URL;
  let parsed: URL;
  try {
    base = new URL(`${getBaseUrl()}/`);
    parsed = new URL(url);
  } catch {
    return null;
  }

  // Origin equality replaces the old string-prefix check, so a host-suffix
  // lookalike (`https://<base-host>.evil.test/...`) cannot pass.
  if (parsed.origin === "null" || parsed.origin !== base.origin) {
    return null;
  }

  // `pathname` is already dot-segment-normalized here — the same resolution an
  // HTTP client performs before the request ever reaches storage.
  if (!parsed.pathname.startsWith(base.pathname)) {
    return null;
  }

  const encodedKey = parsed.pathname.slice(base.pathname.length);

  // An encoded dot survives `pathname` normalization but may be decoded by a
  // later hop, so `%2e%2e%2f` would re-introduce traversal past this point.
  if (/%2e/i.test(encodedKey)) {
    return null;
  }

  let key: string;
  try {
    key = decodeURIComponent(encodedKey);
  } catch {
    // Malformed percent-encoding has no single canonical form — refuse it
    // rather than guess which decoding storage will apply.
    return null;
  }

  if (key.length === 0 || hasUnsafeKeyChars(key)) {
    return null;
  }

  // `%2f` decodes into a separator, so segments must be re-derived after
  // decoding. Empty segments (`//`) are rejected too: they collapse on some
  // hops and not others, which is the same ambiguity.
  const segments = key.split("/");
  if (
    segments.some(
      (segment) => segment.length === 0 || segment === "." || segment === "..",
    )
  ) {
    return null;
  }

  return key;
};

export const uploadFile = async (
  key: string,
  body: ArrayBuffer | Buffer | Uint8Array | string,
  contentType: string,
): Promise<{ url: string; key: string }> => {
  // S3 SDK requires Uint8Array, not raw ArrayBuffer
  const payload = body instanceof ArrayBuffer ? new Uint8Array(body) : body;

  await getS3Client().send(
    new PutObjectCommand({
      Bucket: getBucketName(),
      Key: key,
      Body: payload,
      ContentType: contentType,
    }),
  );

  return { url: getPublicUrl(key), key };
};

export const deleteFile = async (url: string): Promise<void> => {
  const key = canonicalStorageKey(url);
  if (!key) {
    throw new Error(`URL does not resolve to a storage key: ${url}`);
  }

  await getS3Client().send(
    new DeleteObjectCommand({
      Bucket: getBucketName(),
      Key: key,
    }),
  );
};

export const generatePresignedUploadUrl = async (
  key: string,
  contentType: string,
  contentLength: number,
): Promise<{ uploadUrl: string; publicUrl: string; key: string }> => {
  const command = new PutObjectCommand({
    Bucket: getBucketName(),
    Key: key,
    ContentType: contentType,
    ContentLength: contentLength,
  });

  const uploadUrl = await getSignedUrl(getS3Client(), command, {
    expiresIn: 300,
  });

  return {
    uploadUrl,
    publicUrl: getPublicUrl(key),
    key,
  };
};

/**
 * Check whether a URL resolves to a well-formed object key in our storage
 * bucket. Delegates to `canonicalStorageKey`, so a host-suffix lookalike
 * (`https://<base-host>.evil.com/...`) and an ambiguous/traversing path are
 * both rejected here rather than at the individual call sites.
 */
export const isStorageUrl = (url: string): boolean => {
  return canonicalStorageKey(url) !== null;
};

/**
 * Check whether a storage URL points to an object the given user uploaded —
 * i.e. its key lives under that user's own `uploads/{userId}/` prefix (the
 * layout produced by UploadService). Use this before any delete or registration
 * driven by a user-supplied URL: `isStorageUrl` alone only proves the URL is in
 * our bucket, not that the caller owns the object, so it does not prevent a
 * caller from targeting another tenant's blob (IDOR).
 *
 * This is the single ownership gate for storage URLs — every caller must go
 * through it rather than string-matching `uploads/{userId}/` itself, because
 * only the canonical key is safe to prefix-match.
 */
export const isOwnedUploadUrl = (url: string, userId: string): boolean => {
  // A userId carrying separators or dot-segments would make the prefix below
  // mean something other than "this user's directory".
  if (!userId || userId.includes("/") || userId.includes("..")) {
    return false;
  }

  const key = canonicalStorageKey(url);
  if (!key) {
    return false;
  }

  const prefix = `uploads/${userId}/`;
  return key.startsWith(prefix) && key.length > prefix.length;
};

/**
 * Delete a stored file that is being replaced or cleared. No-op unless the old
 * URL exists, actually changed, and points at our storage. Best-effort: a
 * delete failure is logged, never thrown, so the surrounding update still
 * succeeds (an orphaned blob is preferable to a failed save).
 */
export const deleteReplacedStorageFile = async (
  oldUrl: string | null | undefined,
  newUrl: string | null | undefined,
): Promise<void> => {
  if (!oldUrl || oldUrl === newUrl || !isStorageUrl(oldUrl)) {
    return;
  }

  try {
    await deleteFile(oldUrl);
  } catch (error) {
    console.error("Failed to delete replaced file from storage:", error);
  }
};
