import { AsyncLocalStorage } from "node:async_hooks";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { getDbEnv } from "@wildfires-org/turboplan-env";

import * as schema from "../schemas";

export type DbInstance = PostgresJsDatabase<typeof schema>;

type PostgresClient = ReturnType<typeof postgres>;

const isWorkerRuntime = () => process.env.WORKER_RUNTIME === "true";

type WorkerConnectionStore = {
  client: PostgresClient;
  db?: DbInstance;
};

// The AsyncLocalStorage instance lives on `globalThis` because a deployed
// Worker can contain two independent copies of this module: the Next.js bundle
// (built by webpack) and the custom worker entry (bundled by wrangler/esbuild).
// Module-level state is per-copy, so a store opened by the worker entry would be
// invisible to the copy the app code imports. A `Symbol.for` key is shared by
// both copies and makes them agree on a single instance.
const STORE_KEY = Symbol.for(
  "@wildfires-org/turboplan-db/worker-connection-store",
);

type GlobalWithStore = typeof globalThis & {
  [STORE_KEY]?: AsyncLocalStorage<WorkerConnectionStore>;
};

const globalWithStore = globalThis as GlobalWithStore;
const workerConnectionStore = (globalWithStore[STORE_KEY] ??=
  new AsyncLocalStorage<WorkerConnectionStore>());

let dbInstance: DbInstance | null = null;
let clientInstance: PostgresClient | null = null;

/**
 * Creates a postgres.js client tuned for the Workers runtime. `prepare` and
 * `fetch_types` are off because the connection is short-lived (and often goes
 * through Hyperdrive, which multiplexes it), so there is nothing to amortise.
 * postgres.js connects lazily — constructing this costs nothing until a query
 * runs.
 */
const createWorkerClient = (connectionString?: string): PostgresClient => {
  return postgres(connectionString ?? getDbEnv().POSTGRES_URL, {
    prepare: false,
    fetch_types: false,
    max: 5,
  });
};

export const getDB = (): DbInstance => {
  if (isWorkerRuntime()) {
    const store = workerConnectionStore.getStore();
    if (store) {
      // Built lazily, in whichever bundle copy first asks for it, so the drizzle
      // internals and `schema` objects it closes over are the ones the calling
      // code was compiled against.
      store.db ??= drizzle(store.client, { schema });
      return store.db;
    }
    // Unwrapped path: no request-scoped store, so every call opens a fresh
    // TCP+TLS connection that is never closed — it leaks until the isolate is
    // evicted. This exists only as a fallback; the supported path is wrapping
    // the request in `runWithWorkerConnection` or
    // `runWithWorkerConnectionForResponse` below.
    const client = createWorkerClient();
    return drizzle(client, { schema });
  }

  if (!dbInstance) {
    clientInstance = postgres(getDbEnv().POSTGRES_URL);
    dbInstance = drizzle(clientInstance, { schema });
  }
  return dbInstance;
};

/**
 * Runs a function with a request-scoped database connection.
 * The connection is created once and shared for the duration of the callback,
 * then closed automatically when it completes.
 * Required in Cloudflare Workers where I/O objects cannot be shared across requests.
 */
export const runWithWorkerConnection = async <T>(
  fn: () => Promise<T>,
  options?: { connectionString?: string },
): Promise<T> => {
  const client = createWorkerClient(options?.connectionString);
  try {
    return await workerConnectionStore.run({ client }, fn);
  } finally {
    await client.end();
  }
};

/**
 * Defers `cleanup` until the response body has been fully delivered.
 *
 * A streaming route handler (the AI chat route's `onFinish`, which saves
 * messages) keeps using the database for a moment after the last byte is
 * written, so the connection is held for a short grace period past the end of
 * the stream. `waitUntil` keeps the Worker alive across both.
 */
export const finalizeResponseWithCleanup = (
  response: Response,
  options: {
    waitUntil: (promise: Promise<unknown>) => void;
    cleanup: () => Promise<void>;
    graceMs?: number;
  },
): Response => {
  if (!response.body) {
    options.waitUntil(options.cleanup());
    return response;
  }

  const { readable, writable } = new TransformStream();
  const done = response.body
    .pipeTo(writable)
    .catch(() => {})
    .then(() => {
      return new Promise((resolve) => {
        setTimeout(resolve, options.graceMs ?? 2000);
      });
    })
    .then(() => options.cleanup())
    .catch(() => {});

  options.waitUntil(done);

  // Copies status, statusText and headers from the original response.
  return new Response(readable, response);
};

/**
 * Request-scoped connection wrapper for handlers that return a `Response`.
 *
 * Unlike {@link runWithWorkerConnection} the connection outlives the handler:
 * the body may still be streaming when `fn` resolves, so the client is closed
 * from `waitUntil` once the stream is drained.
 */
export const runWithWorkerConnectionForResponse = async (
  fn: () => Promise<Response>,
  options: {
    waitUntil: (promise: Promise<unknown>) => void;
    connectionString?: string;
    graceMs?: number;
  },
): Promise<Response> => {
  const client = createWorkerClient(options.connectionString);

  let response: Response;
  try {
    response = await workerConnectionStore.run({ client }, fn);
  } catch (error) {
    await client.end({ timeout: 5 }).catch(() => undefined);
    throw error;
  }

  return finalizeResponseWithCleanup(response, {
    waitUntil: options.waitUntil,
    graceMs: options.graceMs,
    cleanup: () => client.end({ timeout: 5 }).catch(() => undefined),
  });
};

export const closeDB = async () => {
  if (clientInstance) {
    await clientInstance.end();
    clientInstance = null;
    dbInstance = null;
  }
};

/**
 * Test database connection with cleanup function.
 * Caller is responsible for calling `close()` to prevent connection leaks.
 */
export type TestDBConnection = {
  db: DbInstance;
  close: () => Promise<void>;
};

/**
 * Creates a database connection optimized for E2E testing.
 * Each call returns a fresh connection with minimal pooling for transaction-based test isolation.
 *
 * IMPORTANT: Caller must call `close()` when done to prevent connection leaks.
 *
 * Safety: Requires TEST_POSTGRES_URL environment variable to prevent
 * accidental use of production database.
 *
 * @returns Object with `db` instance and `close` cleanup function
 * @throws Error if TEST_POSTGRES_URL is not set
 *
 * @example
 * const { db, close } = createTestDB();
 * try {
 *   await db.execute(sql`BEGIN`);
 *   // ... test code
 * } finally {
 *   await db.execute(sql`ROLLBACK`);
 *   await close();
 * }
 */
export const createTestDB = (): TestDBConnection => {
  const testUrl = getDbEnv().TEST_POSTGRES_URL;

  if (!testUrl) {
    throw new Error(
      "Missing `TEST_POSTGRES_URL` environment variable.\n" +
        "Test database operations require a dedicated test database URL.",
    );
  }

  const client = postgres(testUrl, {
    max: 1,
    idle_timeout: 1,
    onnotice: () => {}, // Suppress Postgres notices in test output
  });

  return {
    db: drizzle(client, { schema }),
    close: async () => {
      await client.end();
    },
  };
};

// Always proxy so the first access is deferred until after env vars are available
// (required for CF Workers where process.env is populated inside the fetch handler).
export const db: DbInstance = new Proxy({} as DbInstance, {
  get: (_, prop) => getDB()[prop as keyof DbInstance],
});
