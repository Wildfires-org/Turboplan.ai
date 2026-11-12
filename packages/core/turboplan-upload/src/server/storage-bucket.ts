/**
 * An R2 bucket binding (`r2_buckets` in a wrangler config) that storage uses
 * instead of the S3 API when one is registered: no access keys, and the
 * Worker talks to its bucket directly.
 *
 * Its own entry point (`@wildfires-org/turboplan-upload/bucket`) with no
 * dependencies, so a Worker entry can register the binding without pulling
 * in the S3 client. The binding lives on `globalThis` because a Worker entry
 * and the code it wraps can be separate bundles (OpenNext's server bundle has
 * its own copy of this package), and a module variable would not be shared.
 *
 * Typed structurally with only what storage calls, so this package needs no
 * Workers types; a real `R2Bucket` satisfies it.
 */

export type StorageBucketObject = {
  key: string;
  size: number;
  /** Unquoted ETag, the form `onlyIf.etagMatches` takes */
  etag: string;
  /** Quoted ETag, as the S3 API reports it */
  httpEtag: string;
  httpMetadata?: { contentType?: string };
};

export type StorageBucketObjectBody = StorageBucketObject & {
  body: ReadableStream<Uint8Array>;
};

export type StorageBucketPutValue =
  | ReadableStream<Uint8Array>
  | ArrayBuffer
  | ArrayBufferView
  | string;

export type StorageBucket = {
  head: (key: string) => Promise<StorageBucketObject | null>;
  // Without a body when an `onlyIf` precondition fails.
  get: (
    key: string,
    options?: { onlyIf?: { etagMatches?: string } },
  ) => Promise<StorageBucketObjectBody | StorageBucketObject | null>;
  put: (
    key: string,
    value: StorageBucketPutValue,
    options?: { httpMetadata?: { contentType?: string } },
  ) => Promise<unknown>;
  delete: (key: string) => Promise<void>;
};

const BUCKET_SLOT = Symbol.for("@wildfires-org/turboplan-upload/bucket");

type BucketSlot = { [BUCKET_SLOT]?: StorageBucket };

const isStorageBucket = (value: unknown): value is StorageBucket => {
  const candidate = value as Partial<Record<keyof StorageBucket, unknown>>;
  return (
    typeof candidate?.head === "function" &&
    typeof candidate.get === "function" &&
    typeof candidate.put === "function" &&
    typeof candidate.delete === "function"
  );
};

/**
 * Register the bucket binding every storage call then uses (call it from the
 * Worker entry with e.g. `env.STORAGE_BUCKET`). Anything that is not a bucket
 * binding — typically `undefined` when the Worker has none — clears it, and
 * storage uses the S3 API with the R2_* credentials again.
 */
export const setStorageBucket = (bucket: unknown): void => {
  (globalThis as BucketSlot)[BUCKET_SLOT] = isStorageBucket(bucket)
    ? bucket
    : undefined;
};

/** The registered bucket binding, or null when storage uses the S3 API. */
export const getStorageBucket = (): StorageBucket | null => {
  return (globalThis as BucketSlot)[BUCKET_SLOT] ?? null;
};
