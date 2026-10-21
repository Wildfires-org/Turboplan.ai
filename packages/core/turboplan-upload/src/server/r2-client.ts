import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import {
  getR2CredentialsEnv,
  getR2Env,
  getR2PublicUrls,
} from "@wildfires-org/turboplan-env";

import { isSafeObjectKey } from "../types/object-key";
import { readCapped } from "./read-capped";

let _s3Client: S3Client | null = null;

// The client and bucket need the credentials only: reading, writing and
// deleting by key never depends on R2_PUBLIC_URL, which only builds and maps
// public URLs (`getBaseUrl`).
const getS3Client = (): S3Client => {
  if (!_s3Client) {
    const env = getR2CredentialsEnv();
    _s3Client = new S3Client({
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      region: "auto",
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
      // Since 3.729 the SDK adds a CRC32 checksum to every PutObject by
      // default, so a presigned URL carries the checksum of an EMPTY body
      // (`x-amz-checksum-crc32=AAAAAA==`) that the real upload cannot match.
      // Checksum only when an operation requires it.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }
  return _s3Client;
};

export const resetR2Client = (): void => {
  _s3Client = null;
};

const getBucketName = (): string => {
  return getR2CredentialsEnv().R2_BUCKET_NAME;
};

// The write base: the first entry of R2_PUBLIC_URL, without a trailing slash
// (so the `/` boundary below is present exactly once). Every URL we hand out,
// and every ownership decision, is on this base; the other entries are
// read-only aliases (`isStorageUrl`, `isStorageHost`).
const getBaseUrl = (): string => {
  return getR2Env().R2_PUBLIC_URL;
};

export const getPublicUrl = (key: string): string => {
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
 *
 * Only under the write base (the first entry of R2_PUBLIC_URL): a URL under a
 * read-only alias is ours (`isStorageUrl`) but resolves to no key here, so
 * ownership checks and deletes refuse it.
 */
export const canonicalStorageKey = (url: string): string | null => {
  let baseUrl: string;
  try {
    baseUrl = getBaseUrl();
  } catch {
    return null;
  }
  return keyUnderBase(url, baseUrl);
};

// The object key `url` resolves to under one public base URL (no trailing
// slash), or null: canonicalStorageKey's rules for any configured base.
const keyUnderBase = (url: string, baseUrl: string): string | null => {
  if (typeof url !== "string" || url.length === 0) {
    return null;
  }

  let base: URL;
  let parsed: URL;
  try {
    base = new URL(`${baseUrl}/`);
    parsed = new URL(url);
  } catch {
    return null;
  }

  // Origin equality replaces the old string-prefix check, so a host-suffix
  // lookalike (`https://<base-host>.evil.test/...`) cannot pass. The origin
  // ignores userinfo, so `https://user:pass@<base-host>/…` is refused here:
  // no URL we hand out carries one.
  if (
    parsed.origin === "null" ||
    parsed.origin !== base.origin ||
    parsed.username !== "" ||
    parsed.password !== ""
  ) {
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
  // Built first: without R2_PUBLIC_URL nothing is written that no URL could
  // name.
  const url = getPublicUrl(key);

  await getS3Client().send(
    new PutObjectCommand({
      Bucket: getBucketName(),
      Key: key,
      Body: payload,
      ContentType: contentType,
    }),
  );

  return { url, key };
};

/**
 * Delete the object at an exact key. No ownership check — callers decide
 * whose key it is; URL-driven deletes go through `deleteFile` /
 * `deleteOwnedStorageFile` instead.
 */
export const deleteStorageObject = async (key: string): Promise<void> => {
  await getS3Client().send(
    new DeleteObjectCommand({
      Bucket: getBucketName(),
      Key: key,
    }),
  );
};

export const deleteFile = async (url: string): Promise<void> => {
  const key = canonicalStorageKey(url);
  if (!key) {
    throw new Error(`URL does not resolve to a storage key: ${url}`);
  }

  await deleteStorageObject(key);
};

/** What storage reports for an object — never what a client claimed. */
export type StorageObjectInfo = {
  contentType: string;
  size: number;
  etag: string | undefined;
};

const isNotFoundError = (error: unknown): boolean => {
  const { name, $metadata } = (error ?? {}) as {
    name?: string;
    $metadata?: { httpStatusCode?: number };
  };
  return (
    name === "NotFound" ||
    name === "NoSuchKey" ||
    $metadata?.httpStatusCode === 404
  );
};

/** The stored type, size and ETag of the object at `key`, or null if absent. */
export const headStorageObject = async (
  key: string,
): Promise<StorageObjectInfo | null> => {
  try {
    const result = await getS3Client().send(
      new HeadObjectCommand({
        Bucket: getBucketName(),
        Key: key,
      }),
    );

    return {
      contentType: result.ContentType ?? "",
      size: result.ContentLength ?? 0,
      etag: result.ETag,
    };
  } catch (error) {
    if (isNotFoundError(error)) {
      return null;
    }
    throw error;
  }
};

/** An object's bytes and the content type storage holds for it. */
export type StorageObjectBytes = { data: Uint8Array; contentType: string };

// The body of a GetObject response as a web stream. The fetch request
// handler (Workers) already returns one; the Node handler returns a Node
// stream, which the SDK's stream mixin converts.
const webStreamOf = (body: unknown): ReadableStream<Uint8Array> | null => {
  const candidate = body as {
    getReader?: unknown;
    transformToWebStream?: () => ReadableStream<Uint8Array>;
  } | null;
  if (typeof candidate?.getReader === "function") {
    return candidate as unknown as ReadableStream<Uint8Array>;
  }
  if (typeof candidate?.transformToWebStream === "function") {
    return candidate.transformToWebStream();
  }
  return null;
};

// Why a read gave nothing, for the log line (never the key or a message,
// which may carry one).
type ObjectReadFailure =
  | "invalid_key"
  | "not_found"
  | "too_large"
  | "timeout"
  | "no_body";

const reportReadFailure = (reason: ObjectReadFailure | string): void => {
  console.warn("[storage] Object read failed:", { reason });
};

/**
 * Read the object at `key` with the bucket's credentials (S3 GetObject) —
 * how the server reads objects it serves or embeds itself, whether or not
 * the bucket is public. Only a key that names one object of the bucket is
 * sent (`isSafeObjectKey`). Bounded: at most `maxBytes` (the declared
 * `ContentLength` first, then the bytes actually streamed) within
 * `timeoutMs` (request and body). `contentType` is the type storage holds
 * for the object, lowercased and without parameters ("" when none) — never
 * checked here, callers decide what they accept. Null — never throws — for
 * an unsafe key, a missing object, one over `maxBytes`, a timeout, missing
 * R2 credentials or any other failure (logged with its reason only, never
 * the key). Needs no R2_PUBLIC_URL. Works with the Node and the Workers
 * (fetch) request handlers.
 */
export const getObjectBytes = async (
  key: string,
  { maxBytes, timeoutMs }: { maxBytes: number; timeoutMs: number },
): Promise<StorageObjectBytes | null> => {
  if (!isSafeObjectKey(key)) {
    reportReadFailure("invalid_key");
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const timedOut = new Promise<"timeout">((resolve) => {
    controller.signal.addEventListener("abort", () => resolve("timeout"), {
      once: true,
    });
  });

  const read = async (): Promise<StorageObjectBytes | ObjectReadFailure> => {
    const response = await getS3Client().send(
      new GetObjectCommand({ Bucket: getBucketName(), Key: key }),
      // The SDK has no request timeout of its own.
      { abortSignal: controller.signal },
    );
    const stream = webStreamOf(response.Body);
    // A response may still arrive after the timeout (the caller has moved
    // on): cancel its body rather than read it in the background.
    if (controller.signal.aborted) {
      await stream?.cancel().catch(() => {});
      return "timeout";
    }
    if (!stream) {
      return "no_body";
    }
    if (
      typeof response.ContentLength === "number" &&
      response.ContentLength > maxBytes
    ) {
      await stream.cancel().catch(() => {});
      return "too_large";
    }

    // Storage may understate (or omit) the length: the bytes are counted.
    const data = await readCapped(stream, maxBytes, controller.signal);
    if (typeof data === "string") {
      return data;
    }
    return {
      data,
      contentType: (response.ContentType ?? "")
        .split(";")[0]
        .trim()
        .toLowerCase(),
    };
  };

  const reading = read();
  // Settled after a timeout too (the abort rejects it): never unhandled.
  reading.catch(() => {});

  try {
    // The race also covers a request handler that ignores the abort signal.
    const result = await Promise.race([reading, timedOut]);
    if (typeof result === "string") {
      reportReadFailure(result);
      return null;
    }
    return result;
  } catch (error) {
    reportReadFailure(
      isNotFoundError(error)
        ? "not_found"
        : error instanceof Error
          ? error.name
          : typeof error,
    );
    return null;
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Server-side copy within the bucket. With `ifMatch`, storage refuses the copy
 * unless the source still has that ETag, so the destination holds exactly the
 * bytes the caller inspected (no swap between HEAD and COPY). With
 * `contentType`, the destination's metadata is replaced and stored with that
 * type instead of inheriting the source's — the ETag covers the body only, so
 * this is what pins the type.
 */
export const copyStorageObject = async (
  sourceKey: string,
  destinationKey: string,
  { ifMatch, contentType }: { ifMatch?: string; contentType?: string } = {},
): Promise<void> => {
  const bucket = getBucketName();

  await getS3Client().send(
    new CopyObjectCommand({
      Bucket: bucket,
      Key: destinationKey,
      // `x-amz-copy-source` must be URL-encoded and the SDK sends it verbatim.
      CopySource: [bucket, ...sourceKey.split("/")]
        .map(encodeURIComponent)
        .join("/"),
      CopySourceIfMatch: ifMatch,
      ...(contentType
        ? { MetadataDirective: "REPLACE" as const, ContentType: contentType }
        : {}),
    }),
  );
};

/**
 * Presigned PUT for exactly `contentType` and `contentLength`. Both are signed
 * into the URL, so a PUT with any other `Content-Type` (e.g. `text/html` on a
 * URL presigned for a PDF) fails with `SignatureDoesNotMatch` instead of
 * storing a publicly served object of the caller's choosing. The presigner
 * leaves `content-type` unsigned unless it is listed in `signableHeaders`.
 * Callers must PUT with the very same `Content-Type` string.
 */
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
    signableHeaders: new Set(["content-type"]),
  });

  return {
    uploadUrl,
    publicUrl: getPublicUrl(key),
    key,
  };
};

/**
 * Check whether a URL resolves to a well-formed object key in our storage
 * bucket, under ANY public base in R2_PUBLIC_URL (the write base or a
 * read-only alias, comma-separated). Each base applies `canonicalStorageKey`'s
 * rules (via `canonicalStorageUrl`), so a host-suffix lookalike
 * (`https://<base-host>.evil.com/...`) and an ambiguous/traversing path are
 * both rejected here rather than at the individual call sites. It only proves
 * the URL is ours — ownership and deletes go through `canonicalStorageKey`,
 * which knows the write base only.
 */
export const isStorageUrl = (url: string): boolean => {
  return canonicalStorageUrl(url) !== null;
};

// Lowercased hostname without a trailing dot, or null for an unparsable URL.
const hostnameOf = (url: string): string | null => {
  try {
    return (
      new URL(url.trim()).hostname.toLowerCase().replace(/\.$/, "") || null
    );
  } catch {
    return null;
  }
};

/**
 * Whether `url` is on the host of any public base in R2_PUBLIC_URL (the write
 * base or a read-only alias), on any scheme or port, ignoring host case and a
 * trailing dot — whether or not its path is a well-formed key. Wider than
 * `isStorageUrl` on purpose: it decides what must never be handed to a third
 * party (e.g. a web reader) and what a write check must not wave through as
 * an external link, so a URL here that maps to no known object is refused,
 * never treated as external. Always false when R2_PUBLIC_URL is unset: there
 * is no storage then.
 */
export const isStorageHost = (url: string): boolean => {
  const hostname = hostnameOf(url);
  return (
    hostname !== null &&
    getR2PublicUrls().some((baseUrl) => hostnameOf(baseUrl) === hostname)
  );
};

/**
 * The canonical public URL (`<base>/<encoded key>`) of the object `url`
 * resolves to under any base in R2_PUBLIC_URL, with `canonicalStorageKey`'s
 * rules per base, or null. Two spellings of one object (encoding, query,
 * fragment) give the same string; the same key under two bases does not.
 * For matching URLs to stored records — it never decides ownership.
 */
export const canonicalStorageUrl = (url: string): string | null => {
  for (const baseUrl of getR2PublicUrls()) {
    const key = keyUnderBase(url, baseUrl);
    if (key !== null) {
      return `${baseUrl}/${key.split("/").map(encodeURIComponent).join("/")}`;
    }
  }
  return null;
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
export const isSafeKeySegment = (
  id: string | null | undefined,
): id is string => {
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

/**
 * The canonical object key of a storage URL the given user uploaded
 * (`uploads/{userId}/…` under the write base — `isOwnedUploadUrl`'s rule), or
 * null for anything else: another user's upload, any other prefix, a
 * read-only alias, an external or a traversing URL. For storing a user's
 * upload by key rather than by its public URL.
 */
export const ownedUploadKey = (url: string, userId: string): string | null => {
  return isOwnedUploadUrl(url, userId) ? canonicalStorageKey(url) : null;
};

/**
 * Whether `nextUrl` may be written to an image field that currently holds
 * `currentUrl`. Omitted, cleared and unchanged values are always fine, and so
 * are external links (not on a storage host). A URL on the host of ANY base in
 * R2_PUBLIC_URL — well-formed key or not, any scheme or port — must resolve to
 * an object `owner` owns under the write base: otherwise a caller could point
 * their own entity at another tenant's object and have it deleted on the next
 * change. A URL under a read-only alias is ours but owned by no one, so it is
 * refused, as is a malformed one on our host (never treated as external).
 */
export const isAllowedStorageUrlUpdate = (
  nextUrl: string | null | undefined,
  currentUrl: string | null | undefined,
  owner: StorageOwner,
): boolean => {
  if (!nextUrl || nextUrl === currentUrl || !isStorageHost(nextUrl)) {
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
