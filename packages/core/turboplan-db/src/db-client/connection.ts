import { AsyncLocalStorage } from "node:async_hooks";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { getDbEnv } from "@wildfires-org/turboplan-env";

import * as schema from "../schemas";

export type DbInstance = PostgresJsDatabase<typeof schema>;

const isWorkerRuntime = () => process.env.WORKER_RUNTIME === "true";

type WorkerConnectionStore = {
  client: ReturnType<typeof postgres>;
  db: DbInstance;
};

const workerConnectionStore = new AsyncLocalStorage<WorkerConnectionStore>();

let dbInstance: DbInstance | null = null;
let clientInstance: ReturnType<typeof postgres> | null = null;

export const getDB = (): DbInstance => {
  if (isWorkerRuntime()) {
    const store = workerConnectionStore.getStore();
    if (store) {
      return store.db;
    }
    // Fresh connection per call — CF Workers forbid sharing I/O objects across
    // request contexts. Each connection is GC'd when the request completes.
    const client = postgres(getDbEnv().POSTGRES_URL, {
      prepare: false,
      fetch_types: false,
    });
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
): Promise<T> => {
  const client = postgres(getDbEnv().POSTGRES_URL, {
    prepare: false,
    fetch_types: false,
  });
  const db = drizzle(client, { schema });
  try {
    return await workerConnectionStore.run({ client, db }, fn);
  } finally {
    await client.end();
  }
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
