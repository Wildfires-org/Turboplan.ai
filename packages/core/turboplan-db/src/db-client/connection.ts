import { AsyncLocalStorage } from "node:async_hooks";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import {
  getD1Env,
  getDbEnv,
  getDbProvider,
} from "@wildfires-org/turboplan-env";

import {
  createD1BindingTransport,
  createD1HttpTransport,
  createLocalSqliteTransport,
  type D1DatabaseLike,
  drizzleSqlite,
  type SqliteTransport,
} from "../d1";
import * as schema from "../schemas";

/**
 * The database every service uses. On `DB_PROVIDER=d1` it is a drizzle
 * Postgres database whose SQL runs on D1 (see `../d1`): the same query API,
 * so it keeps this type.
 */
export type DbInstance = PostgresJsDatabase<typeof schema>;

type PostgresClient = ReturnType<typeof postgres>;

const isWorkerRuntime = () => process.env.WORKER_RUNTIME === "true";

type WorkerConnectionStore = {
  // Postgres: the request's connection. Absent on D1, which has no
  // connection to open or close.
  client?: PostgresClient;
  // D1: the Worker's `DB` binding, when the entry passed it.
  d1?: D1DatabaseLike;
  db?: DbInstance;
  backgroundTasks: Promise<unknown>[];
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

/**
 * Keeps the request-scoped connection (and, through `waitUntil`, the Worker)
 * alive until `task` settles, even if the client disconnects first.
 *
 * Use it for work that must finish after the response is handed back, such as
 * a chat run that keeps generating and persisting after the browser goes away.
 * Cloudflare still caps `waitUntil` at ~30s after the response ends, so this
 * only buys that window. Outside a request-scoped store (local Node dev, plain
 * scripts) it is a no-op: the process outlives the request anyway.
 */
export const registerBackgroundTask = (task: Promise<unknown>): void => {
  workerConnectionStore.getStore()?.backgroundTasks.push(task);
};

/**
 * Waits for every task in the (live) list, including ones registered while
 * waiting, without ever rejecting.
 */
const settleBackgroundTasks = async (
  tasks: Promise<unknown>[],
): Promise<void> => {
  while (tasks.length > 0) {
    await Promise.allSettled(tasks.splice(0));
  }
};

let dbInstance: DbInstance | null = null;
let clientInstance: PostgresClient | null = null;

// --- D1 -------------------------------------------------------------------

// Shared by both bundle copies in the web Worker, like the store above.
const D1_BINDING_KEY = Symbol.for("@wildfires-org/turboplan-db/d1-binding");

type GlobalWithD1Binding = typeof globalThis & {
  [D1_BINDING_KEY]?: D1DatabaseLike;
};

/**
 * Makes a Worker's D1 binding the database for code that runs outside a
 * request scope opened with one (the MCP server's tools, for instance).
 */
export const registerD1Binding = (binding: D1DatabaseLike): void => {
  (globalThis as GlobalWithD1Binding)[D1_BINDING_KEY] = binding;
};

const d1BindingDbs = new WeakMap<D1DatabaseLike, DbInstance>();
let d1NodeDb: DbInstance | null = null;
let d1NodeTransport: SqliteTransport | null = null;

const createD1Db = (transport: SqliteTransport): DbInstance =>
  drizzleSqlite(transport, { schema }) as unknown as DbInstance;

/**
 * Outside a Worker: a local SQLite file (`D1_LOCAL_PATH`) for development and
 * tests, else the D1 HTTP API for scripts against a remote database.
 */
const createD1NodeTransport = (): SqliteTransport => {
  const env = getD1Env();
  if (env.D1_LOCAL_PATH) {
    return createLocalSqliteTransport(env.D1_LOCAL_PATH);
  }
  if (
    env.CLOUDFLARE_ACCOUNT_ID &&
    env.D1_DATABASE_ID &&
    env.CLOUDFLARE_API_TOKEN
  ) {
    return createD1HttpTransport({
      accountId: env.CLOUDFLARE_ACCOUNT_ID,
      databaseId: env.D1_DATABASE_ID,
      apiToken: env.CLOUDFLARE_API_TOKEN,
    });
  }
  throw new Error(
    "DB_PROVIDER=d1 needs a database: a `DB` D1 binding (Workers), " +
      "`D1_LOCAL_PATH` (a local SQLite file), or `CLOUDFLARE_ACCOUNT_ID`, " +
      "`D1_DATABASE_ID` and `CLOUDFLARE_API_TOKEN` (the D1 HTTP API)",
  );
};

const getD1DB = (binding?: D1DatabaseLike): DbInstance => {
  const resolved =
    binding ?? (globalThis as GlobalWithD1Binding)[D1_BINDING_KEY];
  if (resolved) {
    let instance = d1BindingDbs.get(resolved);
    if (!instance) {
      instance = createD1Db(createD1BindingTransport(resolved));
      d1BindingDbs.set(resolved, instance);
    }
    return instance;
  }
  if (!d1NodeDb) {
    d1NodeTransport = createD1NodeTransport();
    d1NodeDb = createD1Db(d1NodeTransport);
  }
  return d1NodeDb;
};

const usesD1 = (options?: { d1?: D1DatabaseLike }): boolean =>
  Boolean(options?.d1) || getDbProvider() === "d1";

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
  if (getDbProvider() === "d1") {
    // Cached per binding in this bundle copy, so never shared through the
    // (cross-copy) store.
    return getD1DB(workerConnectionStore.getStore()?.d1);
  }

  if (isWorkerRuntime()) {
    const store = workerConnectionStore.getStore();
    if (store?.client) {
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
  options?: { connectionString?: string; d1?: D1DatabaseLike },
): Promise<T> => {
  const backgroundTasks: Promise<unknown>[] = [];
  if (usesD1(options)) {
    // A scope opened inside a request (a background task such as cover image
    // generation) keeps the request's binding: the API Worker registers none
    // globally.
    const d1 = options?.d1 ?? workerConnectionStore.getStore()?.d1;
    try {
      return await workerConnectionStore.run({ d1, backgroundTasks }, fn);
    } finally {
      await settleBackgroundTasks(backgroundTasks);
    }
  }

  const client = createWorkerClient(options?.connectionString);
  try {
    return await workerConnectionStore.run({ client, backgroundTasks }, fn);
  } finally {
    await settleBackgroundTasks(backgroundTasks);
    await client.end();
  }
};

/**
 * Defers `cleanup` until the response body has been fully delivered (or the
 * client went away) and every task in `backgroundTasks` has settled.
 *
 * A streaming route handler (the AI chat route's `onFinish`, which saves
 * messages) keeps using the database for a moment after the last byte is
 * written, so the connection is held for a short grace period past the end of
 * the stream. `backgroundTasks` is read when the body ends, so tasks may be
 * added while it streams (see {@link registerBackgroundTask}). `waitUntil`
 * keeps the Worker alive across all of it.
 */
export const finalizeResponseWithCleanup = (
  response: Response,
  options: {
    waitUntil: (promise: Promise<unknown>) => void;
    cleanup: () => Promise<void>;
    graceMs?: number;
    backgroundTasks?: Promise<unknown>[];
  },
): Response => {
  const backgroundTasks = options.backgroundTasks ?? [];

  if (!response.body) {
    options.waitUntil(
      settleBackgroundTasks(backgroundTasks).then(() => options.cleanup()),
    );
    return response;
  }

  const { readable, writable } = new TransformStream();
  const done = response.body
    .pipeTo(writable)
    .catch(() => {})
    .then(() => settleBackgroundTasks(backgroundTasks))
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
    // D1: the Worker's `DB` binding. There is no connection to close, but the
    // response still waits for background tasks (the chat route's onFinish).
    d1?: D1DatabaseLike;
    graceMs?: number;
  },
): Promise<Response> => {
  const backgroundTasks: Promise<unknown>[] = [];

  if (usesD1(options)) {
    let response: Response;
    try {
      response = await workerConnectionStore.run(
        { d1: options.d1, backgroundTasks },
        fn,
      );
    } catch (error) {
      options.waitUntil(settleBackgroundTasks(backgroundTasks));
      throw error;
    }
    return finalizeResponseWithCleanup(response, {
      waitUntil: options.waitUntil,
      graceMs: options.graceMs,
      backgroundTasks,
      cleanup: async () => {},
    });
  }

  const client = createWorkerClient(options.connectionString);

  let response: Response;
  try {
    response = await workerConnectionStore.run({ client, backgroundTasks }, fn);
  } catch (error) {
    // Do not hold the error response hostage to background work; close the
    // client once that work has settled.
    options.waitUntil(
      settleBackgroundTasks(backgroundTasks)
        .then(() => client.end({ timeout: 5 }))
        .catch(() => undefined),
    );
    throw error;
  }

  return finalizeResponseWithCleanup(response, {
    waitUntil: options.waitUntil,
    graceMs: options.graceMs,
    backgroundTasks,
    cleanup: () => client.end({ timeout: 5 }).catch(() => undefined),
  });
};

export const closeDB = async () => {
  if (clientInstance) {
    await clientInstance.end();
    clientInstance = null;
    dbInstance = null;
  }
  if (d1NodeTransport) {
    await d1NodeTransport.close?.();
    d1NodeTransport = null;
    d1NodeDb = null;
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
 * accidental use of production database. On `DB_PROVIDER=d1` it opens the
 * local SQLite file `D1_LOCAL_PATH` instead, and never a remote D1 database.
 *
 * @returns Object with `db` instance and `close` cleanup function
 * @throws Error if TEST_POSTGRES_URL (D1: D1_LOCAL_PATH) is not set
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
  if (getDbProvider() === "d1") {
    const localPath = getD1Env().D1_LOCAL_PATH;
    if (!localPath) {
      throw new Error(
        "Missing `D1_LOCAL_PATH` environment variable.\n" +
          "Test database operations on D1 run against a local SQLite file.",
      );
    }
    const transport = createLocalSqliteTransport(localPath);
    return {
      db: createD1Db(transport),
      close: async () => {
        await transport.close?.();
      },
    };
  }

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
