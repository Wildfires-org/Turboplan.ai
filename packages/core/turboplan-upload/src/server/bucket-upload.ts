import { Hono } from "hono";

import {
  getJwtSigningSecret,
  getServerUrl,
} from "@wildfires-org/turboplan-env";

import { isSafeObjectKey } from "../types/object-key";
import { getStorageBucket } from "./storage-bucket";

/**
 * Browser uploads when storage is an R2 bucket binding. A binding cannot
 * presign, so the "presigned" URL points at this API instead: a PUT to
 * `${SERVER_URL}${BUCKET_UPLOAD_PATH}?token=…` streams the body into the
 * bucket. The token pins what an S3 presigned URL pins — one key, one exact
 * `Content-Type`, one length, five minutes — and is an HMAC under a key
 * derived from JWT_SIGNING_SECRET, so it can never pass as an API token.
 */

export const BUCKET_UPLOAD_PATH = "/api/storage/upload";

const TOKEN_TTL_SECONDS = 300;
const KEY_DERIVATION_LABEL = "turboplan-storage-upload/v1";

type UploadGrant = {
  key: string;
  contentType: string;
  contentLength: number;
  /** Unix seconds */
  expiresAt: number;
};

const encoder = new TextEncoder();

const toBase64Url = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
};

const fromBase64Url = (value: string): Uint8Array<ArrayBuffer> | null => {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    return null;
  }
  try {
    const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
};

const importHmacKey = (secret: BufferSource, usages: KeyUsage[]) =>
  crypto.subtle.importKey(
    "raw",
    secret,
    { name: "HMAC", hash: "SHA-256" },
    false,
    usages,
  );

// A key of its own, so the secret never signs anything but API tokens directly.
const getUploadSigningKey = async (): Promise<CryptoKey> => {
  const root = await importHmacKey(encoder.encode(getJwtSigningSecret()), [
    "sign",
  ]);
  const derived = await crypto.subtle.sign(
    "HMAC",
    root,
    encoder.encode(KEY_DERIVATION_LABEL),
  );
  return importHmacKey(derived, ["sign", "verify"]);
};

export const createUploadToken = async (
  grant: Omit<UploadGrant, "expiresAt">,
  now: number = Date.now(),
): Promise<string> => {
  const payload: UploadGrant = {
    ...grant,
    expiresAt: Math.floor(now / 1000) + TOKEN_TTL_SECONDS,
  };
  const encodedPayload = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign(
    "HMAC",
    await getUploadSigningKey(),
    encoder.encode(encodedPayload),
  );
  return `${encodedPayload}.${toBase64Url(new Uint8Array(signature))}`;
};

const isUploadGrant = (value: unknown): value is UploadGrant => {
  const grant = value as Partial<UploadGrant> | null;
  return (
    typeof grant?.key === "string" &&
    typeof grant.contentType === "string" &&
    Number.isSafeInteger(grant.contentLength) &&
    Number.isSafeInteger(grant.expiresAt)
  );
};

/** The grant a token carries, or null when it is forged, malformed or expired. */
export const verifyUploadToken = async (
  token: string,
  now: number = Date.now(),
): Promise<UploadGrant | null> => {
  const [encodedPayload, encodedSignature, extra] = token.split(".");
  if (!encodedPayload || !encodedSignature || extra !== undefined) {
    return null;
  }

  const signature = fromBase64Url(encodedSignature);
  if (!signature) {
    return null;
  }
  const isValid = await crypto.subtle.verify(
    "HMAC",
    await getUploadSigningKey(),
    signature,
    encoder.encode(encodedPayload),
  );
  if (!isValid) {
    return null;
  }

  const payloadBytes = fromBase64Url(encodedPayload);
  if (!payloadBytes) {
    return null;
  }
  let grant: unknown;
  try {
    grant = JSON.parse(new TextDecoder().decode(payloadBytes));
  } catch {
    return null;
  }
  if (!isUploadGrant(grant) || grant.expiresAt <= Math.floor(now / 1000)) {
    return null;
  }
  return grant;
};

/** The URL a browser PUTs one object to, in place of an S3 presigned URL. */
export const createBucketUploadUrl = async (
  key: string,
  contentType: string,
  contentLength: number,
): Promise<string> => {
  const serverUrl = getServerUrl().replace(/\/+$/, "");
  if (!serverUrl) {
    throw new Error("Missing `SERVER_URL` env variable");
  }
  const token = await createUploadToken({ key, contentType, contentLength });
  return `${serverUrl}${BUCKET_UPLOAD_PATH}?token=${encodeURIComponent(token)}`;
};

/**
 * PUT / — store the request body at the token's key. Mount at
 * `BUCKET_UPLOAD_PATH`, outside user auth: the token is the authorization.
 * 404 when storage is not a bucket binding (S3 presigned URLs go to R2).
 */
export const bucketUploadRouter = new Hono();

bucketUploadRouter.put("/", async (c) => {
  const bucket = getStorageBucket();
  if (!bucket) {
    return c.json({ error: "Not found" }, 404);
  }

  const grant = await verifyUploadToken(c.req.query("token") ?? "");
  if (!grant || !isSafeObjectKey(grant.key)) {
    return c.json({ error: "Invalid or expired upload URL" }, 403);
  }

  // The same rule as a presigned URL's signed Content-Type: exact match.
  if (c.req.header("content-type") !== grant.contentType) {
    return c.json({ error: "Content-Type does not match the upload URL" }, 403);
  }

  const body = c.req.raw.body;
  if (Number(c.req.header("content-length")) !== grant.contentLength || !body) {
    return c.json(
      { error: "Content-Length does not match the upload URL" },
      400,
    );
  }

  await bucket.put(grant.key, body, {
    httpMetadata: { contentType: grant.contentType },
  });

  return c.body(null, 200);
});
