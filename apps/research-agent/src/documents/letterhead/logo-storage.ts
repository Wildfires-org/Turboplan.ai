/**
 * Stores the logo crops of an analyzed letterhead in R2, the bucket the web
 * app and API serve uploads from, so a letterhead copied into a document can
 * show them in the preview and exports. The stored grid holds each crop's
 * object KEY, never a public URL: the API reads logos with the bucket's
 * credentials, so they keep working once the bucket is private. Writing
 * needs the credentials only (no R2_PUBLIC_URL).
 *
 * Keys are content-addressed (`letterheads/<source>/<documentId>/logo-<n>-
 * <hash>.png`): a re-analysis that crops the same logo writes the same object,
 * and an object never changes once written, so it is cached as immutable.
 * Copies of a letterhead keep pointing at the object after the reference
 * document is deleted; nothing deletes these objects.
 */

import { createHash } from "node:crypto";

import type { R2CredentialsEnvType } from "@wildfires-org/turboplan-env";

import { logger as defaultLogger, type Logger } from "../../infra/logger";
import type { LetterheadLogoStore } from "./analysis-service";

/** Logo crops are a few KB to ~100 KB; anything bigger is not a logo. */
export const MAX_LOGO_BYTES = 300 * 1024;

const KEY_PREFIX = "letterheads";
const LOGO_UPLOAD_TIMEOUT_MS = 10_000;
const CACHE_CONTROL = "public, max-age=31536000, immutable";

export type PutLogoObject = (object: {
  key: string;
  body: Uint8Array;
  contentType: string;
  cacheControl: string;
}) => Promise<void>;

export const letterheadLogoKey = (
  png: Uint8Array,
  {
    source,
    documentId,
    index,
  }: { source: string; documentId: string; index: number },
): string => {
  const hash = createHash("sha256").update(png).digest("hex").slice(0, 16);
  return `${KEY_PREFIX}/${source}/${documentId}/logo-${index}-${hash}.png`;
};

/**
 * A logo store over `put` that resolves the stored object's key: refuses
 * crops over {@link MAX_LOGO_BYTES}, and logs and drops a crop whose upload
 * fails (never throws), so the letterhead is stored without that logo.
 */
export const createLetterheadLogoStore = ({
  put,
  logger = defaultLogger,
}: {
  put: PutLogoObject;
  logger?: Logger;
}): LetterheadLogoStore => {
  return async (png, context) => {
    const label = `[letterhead] ${context.source} document ${context.documentId}, logo ${context.index}`;
    if (png.byteLength > MAX_LOGO_BYTES) {
      logger.log(
        `${label}: not stored, ${Math.round(png.byteLength / 1024)} KB is over the ${MAX_LOGO_BYTES / 1024} KB limit`,
        "warning",
      );
      return null;
    }
    const key = letterheadLogoKey(png, context);
    try {
      await put({
        key,
        body: png,
        contentType: "image/png",
        cacheControl: CACHE_CONTROL,
      });
    } catch (err) {
      logger.error(`${label}: upload failed`, err);
      return null;
    }
    return key;
  };
};

/** The parts of the S3 SDK the store uses. */
export type S3Sdk = Pick<
  typeof import("@aws-sdk/client-s3"),
  "PutObjectCommand" | "S3Client"
>;

const loadS3Sdk = (): Promise<S3Sdk> => import("@aws-sdk/client-s3");

/**
 * The R2-backed logo store, or undefined without R2 credentials (logo cells
 * are then left out of the stored letterheads). The S3 client is loaded on
 * first use, so a research agent without R2 never loads the SDK; a load that
 * fails is retried by the next upload. `loadSdk` is for tests.
 */
export const createR2LogoStore = (
  r2: R2CredentialsEnvType | null,
  { loadSdk = loadS3Sdk }: { loadSdk?: () => Promise<S3Sdk> } = {},
): LetterheadLogoStore | undefined => {
  if (!r2) {
    return undefined;
  }
  let send: Promise<PutLogoObject> | undefined;
  const loadSend = async (): Promise<PutLogoObject> => {
    const { PutObjectCommand, S3Client } = await loadSdk();
    const client = new S3Client({
      endpoint: `https://${r2.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      region: "auto",
      credentials: {
        accessKeyId: r2.R2_ACCESS_KEY_ID,
        secretAccessKey: r2.R2_SECRET_ACCESS_KEY,
      },
      // As the shared storage client (turboplan-upload): since 3.729 the SDK
      // checksums every PutObject by default; only when an operation
      // requires it.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
    return async ({ key, body, contentType, cacheControl }) => {
      await client.send(
        new PutObjectCommand({
          Bucket: r2.R2_BUCKET_NAME,
          Key: key,
          Body: body,
          ContentType: contentType,
          CacheControl: cacheControl,
        }),
        // The SDK has no request timeout of its own.
        { abortSignal: AbortSignal.timeout(LOGO_UPLOAD_TIMEOUT_MS) },
      );
    };
  };
  return createLetterheadLogoStore({
    put: async (object) => {
      send ??= loadSend().catch((error: unknown) => {
        // Not cached: the next upload loads the SDK again.
        send = undefined;
        throw error;
      });
      await (await send)(object);
    },
  });
};
