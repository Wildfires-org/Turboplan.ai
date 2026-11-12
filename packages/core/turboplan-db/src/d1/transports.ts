/**
 * The three ways a D1 deployment reaches its SQLite database. All of them run
 * one statement at a time and return SQLite's own values; everything
 * Postgres-shaped happens above them, in the executor and the dialect.
 */

import type { SqliteValue } from "./values";

export type SqliteObjectsResult = {
  rows: Record<string, unknown>[];
  /** Rows changed by an insert/update/delete, when the transport reports it. */
  changes?: number;
};

export type SqliteTransport = {
  readonly kind: "d1-binding" | "d1-http" | "local-file";
  /** Rows as arrays, in select-list order (duplicate column names survive). */
  values: (sql: string, params: SqliteValue[]) => Promise<unknown[][]>;
  /** Rows as objects keyed by column name. */
  objects: (sql: string, params: SqliteValue[]) => Promise<SqliteObjectsResult>;
  close?: () => Promise<void>;
};

// --- Worker binding --------------------------------------------------------

/** The slice of Cloudflare's `D1PreparedStatement` this driver uses. */
export type D1PreparedStatementLike = {
  bind: (...values: unknown[]) => D1PreparedStatementLike;
  raw: <T = unknown[]>() => Promise<T[]>;
  all: <T = Record<string, unknown>>() => Promise<{
    results?: T[];
    meta?: { changes?: number };
  }>;
};

/** The slice of Cloudflare's `D1Database` binding this driver uses. */
export type D1DatabaseLike = {
  prepare: (query: string) => D1PreparedStatementLike;
};

export const isD1DatabaseLike = (value: unknown): value is D1DatabaseLike =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as { prepare?: unknown }).prepare === "function";

export const createD1BindingTransport = (
  binding: D1DatabaseLike,
): SqliteTransport => ({
  kind: "d1-binding",
  values: (sql, params) =>
    binding
      .prepare(sql)
      .bind(...params)
      .raw<unknown[]>(),
  objects: async (sql, params) => {
    const result = await binding
      .prepare(sql)
      .bind(...params)
      .all();
    return { rows: result.results ?? [], changes: result.meta?.changes };
  },
});

// --- D1 HTTP API (Node scripts against a remote database) -------------------

export type D1HttpConfig = {
  accountId: string;
  databaseId: string;
  apiToken: string;
  /** Overridable for tests. */
  fetch?: typeof fetch;
  baseUrl?: string;
};

type D1HttpRawResponse = {
  success: boolean;
  errors?: Array<{ code?: number; message?: string }>;
  result?: Array<{
    success?: boolean;
    results?: { columns?: string[]; rows?: unknown[][] };
    meta?: { changes?: number };
  }>;
};

export const createD1HttpTransport = (
  config: D1HttpConfig,
): SqliteTransport => {
  const fetchImpl = config.fetch ?? fetch;
  const url = `${config.baseUrl ?? "https://api.cloudflare.com/client/v4"}/accounts/${encodeURIComponent(config.accountId)}/d1/database/${encodeURIComponent(config.databaseId)}/raw`;

  const run = async (sql: string, params: SqliteValue[]) => {
    if (params.some((param) => param instanceof Uint8Array)) {
      throw new Error("The D1 HTTP transport cannot bind binary parameters");
    }
    const response = await fetchImpl(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql, params }),
    });
    const body = (await response
      .json()
      .catch(() => null)) as D1HttpRawResponse | null;
    if (!response.ok || !body?.success) {
      const detail =
        body?.errors
          ?.map((error) => error.message)
          .filter(Boolean)
          .join("; ") || `HTTP ${response.status}`;
      throw new Error(`D1 HTTP API query failed: ${detail}`);
    }
    const statement = body.result?.[0];
    return {
      columns: statement?.results?.columns ?? [],
      rows: statement?.results?.rows ?? [],
      changes: statement?.meta?.changes,
    };
  };

  return {
    kind: "d1-http",
    values: async (sql, params) => (await run(sql, params)).rows,
    objects: async (sql, params) => {
      const { columns, rows, changes } = await run(sql, params);
      return {
        rows: rows.map((row) =>
          Object.fromEntries(columns.map((name, i) => [name, row[i]])),
        ),
        changes,
      };
    },
  };
};

// --- Local SQLite file (development and tests) ------------------------------

type LocalStatement = {
  values: (params: SqliteValue[]) => unknown[][];
  objects: (params: SqliteValue[]) => SqliteObjectsResult;
};

type LocalDatabase = {
  prepare: (sql: string) => LocalStatement;
  exec: (sql: string) => void;
  close: () => void;
};

/**
 * Loads `node:sqlite` or `bun:sqlite` through `process.getBuiltinModule`
 * rather than a dynamic import, so bundlers have no module to resolve.
 * Next.js's minifier folds a variable specifier back into a literal, and
 * OpenNext's esbuild pass then fails on "bun:sqlite". Neither module exists
 * in the Workers runtime, and this transport is never used there.
 */
const loadSqliteModule = <T>(specifier: "node:sqlite" | "bun:sqlite"): T => {
  const loaded =
    typeof process !== "undefined" &&
    typeof process.getBuiltinModule === "function"
      ? process.getBuiltinModule(specifier)
      : undefined;
  if (!loaded) {
    throw new Error(
      `A local SQLite database (D1_LOCAL_PATH) needs ${specifier}: run it on Node 22.16+ or Bun`,
    );
  }
  return loaded as T;
};

type NodeStatementSync = {
  setReturnArrays: (enabled: boolean) => void;
  columns: () => unknown[];
  all: (...params: SqliteValue[]) => unknown[];
  run: (...params: SqliteValue[]) => { changes: number | bigint };
};

type BunStatement = {
  columnNames: string[];
  values: (...params: SqliteValue[]) => unknown[][];
  all: (...params: SqliteValue[]) => Record<string, unknown>[];
  run: (...params: SqliteValue[]) => { changes: number };
};

const openNodeSqlite = async (path: string): Promise<LocalDatabase> => {
  const { DatabaseSync } = loadSqliteModule<{
    DatabaseSync: new (
      path: string,
    ) => {
      prepare: (sql: string) => NodeStatementSync;
      exec: (sql: string) => void;
      close: () => void;
    };
  }>("node:sqlite");
  const database = new DatabaseSync(path);
  return {
    prepare: (sql) => {
      const statement = database.prepare(sql);
      return {
        values: (params) => {
          statement.setReturnArrays(true);
          return statement.all(...params) as unknown[][];
        },
        objects: (params) => {
          if (statement.columns().length === 0) {
            const result = statement.run(...params);
            return { rows: [], changes: Number(result.changes) };
          }
          return {
            rows: statement.all(...params) as Record<string, unknown>[],
          };
        },
      };
    },
    exec: (sql) => database.exec(sql),
    close: () => database.close(),
  };
};

const openBunSqlite = async (path: string): Promise<LocalDatabase> => {
  const { Database } = loadSqliteModule<{
    Database: new (
      path: string,
      options?: { create?: boolean },
    ) => {
      prepare: (sql: string) => BunStatement;
      exec: (sql: string) => void;
      close: () => void;
    };
  }>("bun:sqlite");
  const database = new Database(path, { create: true });
  return {
    prepare: (sql) => {
      const statement = database.prepare(sql);
      return {
        values: (params) => statement.values(...params),
        objects: (params) => {
          if (statement.columnNames.length === 0) {
            return { rows: [], changes: statement.run(...params).changes };
          }
          return { rows: statement.all(...params) };
        },
      };
    },
    exec: (sql) => database.exec(sql),
    close: () => database.close(),
  };
};

/**
 * A SQLite file through `node:sqlite` (Node ≥ 22.16) or `bun:sqlite` (the API
 * server's `pnpm dev`). Foreign keys are enforced, as on D1, and WAL lets the
 * web app and the API server share one file.
 */
export const createLocalSqliteTransport = (path: string): SqliteTransport => {
  let opened: Promise<LocalDatabase> | null = null;
  const open = () => {
    opened ??= (async () => {
      const isBun =
        typeof (globalThis as { Bun?: unknown }).Bun !== "undefined";
      const database = await (isBun
        ? openBunSqlite(path)
        : openNodeSqlite(path));
      database.exec("PRAGMA foreign_keys = ON");
      database.exec("PRAGMA busy_timeout = 5000");
      if (path !== ":memory:") {
        database.exec("PRAGMA journal_mode = WAL");
      }
      return database;
    })();
    return opened;
  };

  return {
    kind: "local-file",
    values: async (sql, params) => (await open()).prepare(sql).values(params),
    objects: async (sql, params) => (await open()).prepare(sql).objects(params),
    close: async () => {
      if (opened) {
        (await opened).close();
        opened = null;
      }
    },
  };
};
