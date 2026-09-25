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

// Project-scoped key prefixes written by server-side producers, each followed
// by `/{projectId}/`: MCP document uploads, signed PDFs and cataloger downloads.
const PROJECT_SCOPED_KEY_PREFIXES = ["mcp", "signed", "cataloger"] as const;

const ORG_LOGO_KEY_PREFIX = "org-logos";

/**
 * Storage key for a logo uploaded on behalf of an organization (one object per
 * org, overwritten on re-upload). Kept here so ownership checks and the
 * producer agree on the layout.
 */
export const orgLogoStorageKey = (
  organizationId: string,
  extension: string,
): string => {
  return `${ORG_LOGO_KEY_PREFIX}/${organizationId}.${extension}`;
};

/**
 * The context an object must belong to. Each identifier grants only the key
 * prefixes that identifier's own writes produce:
 * - `userId`         → `uploads/{userId}/…` (UploadService, research agent)
 * - `projectId`      → `mcp|signed|cataloger/{projectId}/…`
 * - `organizationId` → `org-logos/{organizationId}.{ext}`
 */
export type StorageOwner = {
  userId?: string | null;
  projectId?: string | null;
  organizationId?: string | null;
};

// An id carrying separators or dot-segments would make a prefix built from it
// mean something other than "this entity's directory".
const isSafeKeySegment = (id: string | null | undefined): id is string => {
  return !!id && !id.includes("/") && !id.includes("..");
};

const isUnderPrefix = (key: string, prefix: string): boolean => {
  return key.startsWith(prefix) && key.length > prefix.length;
};

/**
 * Check whether a storage URL resolves to an object under a key prefix that
 * `owner` owns. Decided on the canonical key only — never on a substring of
 * the raw URL — so traversal and encoding tricks cannot borrow a prefix.
 *
 * This is the ownership gate for every delete (and every write that later
 * feeds a delete) driven by a stored or user-supplied URL: `isStorageUrl`
 * alone only proves the URL is in our bucket, not whose object it is.
 */
export const isStorageUrlOwnedBy = (
  url: string,
  owner: StorageOwner,
): boolean => {
  const key = canonicalStorageKey(url);
  if (!key) {
    return false;
  }

  const { userId, projectId, organizationId } = owner;

  if (isSafeKeySegment(userId) && isUnderPrefix(key, `uploads/${userId}/`)) {
    return true;
  }

  if (
    isSafeKeySegment(projectId) &&
    PROJECT_SCOPED_KEY_PREFIXES.some((prefix) =>
      isUnderPrefix(key, `${prefix}/${projectId}/`),
    )
  ) {
    return true;
  }

  if (isSafeKeySegment(organizationId)) {
    const logoPrefix = `${ORG_LOGO_KEY_PREFIX}/${organizationId}.`;
    return (
      isUnderPrefix(key, logoPrefix) &&
      /^[a-z0-9]+$/i.test(key.slice(logoPrefix.length))
    );
  }

  return false;
};

/**
 * Check whether a storage URL points to an object the given user uploaded —
 * i.e. its key lives under that user's own `uploads/{userId}/` prefix (the
 * layout produced by UploadService). Use before registering a user-supplied
 * URL against an entity.
 */
export const isOwnedUploadUrl = (url: string, userId: string): boolean => {
  return isStorageUrlOwnedBy(url, { userId });
};

// Same-origin as our public bucket, whether or not the path is a well-formed
// key. Wider than `isStorageUrl` on purpose: a malformed URL on our host must
// not slip through a write check as if it were an external link.
const isOnStorageOrigin = (url: string): boolean => {
  try {
    return new URL(url).origin === new URL(`${getBaseUrl()}/`).origin;
  } catch {
    return false;
  }
};

/**
 * Whether `nextUrl` may be written to an image field that currently holds
 * `currentUrl`. Omitted, cleared and unchanged values are always fine, and so
 * are external links (not in our bucket). A URL on our storage origin must
 * resolve to an object `owner` owns — otherwise a caller could point their own
 * entity at another tenant's object and have it deleted on the next change.
 */
export const isAllowedStorageUrlUpdate = (
  nextUrl: string | null | undefined,
  currentUrl: string | null | undefined,
  owner: StorageOwner,
): boolean => {
  if (!nextUrl || nextUrl === currentUrl || !isOnStorageOrigin(nextUrl)) {
    return true;
  }

  return isStorageUrlOwnedBy(nextUrl, owner);
};

/**
 * Delete a stored object only when it provably belongs to `owner` and, when
 * `isReferenced` is given, nothing else still points at it (e.g. copied
 * project documents share one object). Any failed check skips the blob delete
 * — an orphaned object is always preferable to destroying someone else's.
 * Best-effort: never throws. Returns whether the object was deleted.
 */
export const deleteOwnedStorageFile = async (
  url: string | null | undefined,
  owner: StorageOwner,
  isReferenced?: () => Promise<boolean>,
): Promise<boolean> => {
  if (!url || !isStorageUrlOwnedBy(url, owner)) {
    if (url && isStorageUrl(url)) {
      console.warn(
        "Skipping storage deletion: object is not owned by the deleting context",
      );
    }
    return false;
  }

  try {
    if (isReferenced && (await isReferenced())) {
      return false;
    }

    await deleteFile(url);
    return true;
  } catch (error) {
    console.error("Failed to delete file from storage:", error);
    return false;
  }
};

/** A URL field in an update: the requested value and the stored one. */
export type ReplacedStorageField = readonly [
  next: string | null | undefined,
  current: string | null | undefined,
];

/**
 * The old URLs an update replaced or cleared. `next === undefined` means the
 * field was omitted, so nothing is replaced; a different string, `""` or
 * `null` is an explicit change. An old URL that another field keeps after the
 * update is not replaced.
 */
export const replacedStorageUrls = (
  fields: readonly ReplacedStorageField[],
): string[] => {
  const keptUrls = fields.map(([next, current]) =>
    next === undefined ? current : next,
  );

  return fields.flatMap(([next, current]) => {
    if (next === undefined || !current || current === next) {
      return [];
    }
    return keptUrls.includes(current) ? [] : [current];
  });
};

/**
 * Delete the stored files an update replaced or cleared (see
 * `replacedStorageUrls`), each only when `owner` owns it (see
 * `deleteOwnedStorageFile`). Call after the row update. Never throws.
 */
export const deleteReplacedStorageFiles = async (
  fields: readonly ReplacedStorageField[],
  owner: StorageOwner,
): Promise<void> => {
  for (const url of replacedStorageUrls(fields)) {
    await deleteOwnedStorageFile(url, owner);
  }
};
