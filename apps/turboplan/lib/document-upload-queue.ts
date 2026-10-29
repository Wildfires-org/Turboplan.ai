// Building blocks for importing dropped documents one at a time, shared by the
// Project Context and Organization Context dropzones: duplicate keys, a serial
// queue and timeouts. Kept free of React (and of the map module) so both can
// use and unit test them.

type ListedDocument = {
  id: string;
  originalFilename: string;
  size: number;
};

export type SerialQueue = {
  run: <T>(task: () => Promise<T>) => Promise<T>;
};

const MB = 1024 * 1024;
const MINUTE = 60_000;

/** Duplicate key for a document: file name + size, as the chat input uses. */
export const getDocumentDedupeKey = (name: string, size: number) =>
  `${name}:${size}`;

export const formatMegabytes = (bytes: number) => `${Math.round(bytes / MB)}MB`;

export const formatDuration = (ms: number) => {
  if (ms >= MINUTE) {
    const minutes = Math.round(ms / MINUTE);
    return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  }
  const seconds = Math.max(1, Math.round(ms / 1000));
  return `${seconds} second${seconds === 1 ? "" : "s"}`;
};

export const getErrorMessage = (error: unknown, fallback: string) => {
  return error instanceof Error && error.message ? error.message : fallback;
};

export const getUploadTimeoutMessage = (ms: number) =>
  `Upload timed out after ${formatDuration(ms)}`;

/**
 * Name + size keys of the listed documents, plus documents imported this
 * session that the list does not show yet (it can lag a render behind an
 * upload). `imported` maps document id to key.
 */
export const getKnownDocumentKeys = (
  documents: ListedDocument[],
  imported: ReadonlyMap<string, string>,
): Set<string> => {
  const keys = new Set<string>();
  const listedIds = new Set<string>();
  for (const document of documents) {
    keys.add(getDocumentDedupeKey(document.originalFilename, document.size));
    listedIds.add(document.id);
  }
  for (const [documentId, key] of imported) {
    if (!listedIds.has(documentId)) {
      keys.add(key);
    }
  }
  return keys;
};

/**
 * Forgets imported documents the cached list has caught up with: from then
 * on the list alone says whether they are there, so one deleted later can be
 * dropped again. Returns `imported` itself when unchanged.
 */
export const pruneImportedDocuments = (
  imported: ReadonlyMap<string, string>,
  documents: Pick<ListedDocument, "id">[],
): ReadonlyMap<string, string> => {
  const listedIds = new Set(documents.map((document) => document.id));
  const remaining = new Map(
    Array.from(imported).filter(([documentId]) => !listedIds.has(documentId)),
  );
  return remaining.size === imported.size ? imported : remaining;
};

/**
 * Runs tasks one after another, in the order they were added. A failing task
 * rejects its own promise but does not stop the tasks after it.
 */
export const createSerialQueue = (): SerialQueue => {
  let tail: Promise<unknown> = Promise.resolve();
  return {
    run: (task) => {
      const result = tail.then(task);
      tail = result.catch(() => undefined);
      return result;
    },
  };
};

/** Rejects with `message` when `promise` takes longer than `ms`. */
export const withTimeout = <T>(
  promise: Promise<T>,
  ms: number,
  message: string,
): Promise<T> => {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
};
