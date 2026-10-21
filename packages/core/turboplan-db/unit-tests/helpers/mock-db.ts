import assert from "node:assert";
import { drizzle } from "drizzle-orm/postgres-js";

export type RecordedQuery = { sql: string; params: unknown[] };
type Query = { toSQL: () => RecordedQuery };

const isQuery = (value: unknown): value is Query =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as Partial<Query>).toSQL === "function";

/**
 * Real drizzle query builders (no connection) behind a proxy: awaiting a query
 * records it and resolves to the fixture rows instead of hitting a database,
 * so tests assert the exact SQL — tables, columns, clauses — that the query
 * functions build. Mock the db client with it before importing the queries:
 *
 *   const mockDb = createMockDb();
 *   mock.module("../src/db-client", { namedExports: { db: mockDb.db } });
 *   const { someQuery } = await import("../src/queries/some-file");
 */
export const createMockDb = () => {
  const realDb = drizzle.mock();
  let rows: unknown[] = [];
  let builtCount = 0;
  const awaited: Query[] = [];

  const wrap = <T extends object>(target: T): T =>
    new Proxy(target, {
      get(builder, prop) {
        if (prop === "then") {
          return (resolve: (value: unknown) => unknown) => {
            awaited.push(builder as unknown as Query);
            return Promise.resolve(rows).then(resolve);
          };
        }
        const value = Reflect.get(builder, prop);
        if (typeof value !== "function") {
          return value;
        }
        // `.from()`, `.values()`, `.set()` return new builders: keep wrapping.
        return (...args: unknown[]) => {
          const result = value.apply(builder, args);
          return isQuery(result) ? wrap(result) : result;
        };
      },
    });

  const start = <T extends object>(builder: T): T => {
    builtCount += 1;
    return wrap(builder);
  };

  const db = {
    select: (...args: Parameters<typeof realDb.select>) =>
      start(realDb.select(...args)),
    insert: (...args: Parameters<typeof realDb.insert>) =>
      start(realDb.insert(...args)),
    update: (...args: Parameters<typeof realDb.update>) =>
      start(realDb.update(...args)),
    delete: (...args: Parameters<typeof realDb.delete>) =>
      start(realDb.delete(...args)),
  };

  return {
    db,
    /** Rows every awaited query resolves to (until the next `reset`). */
    setRows: (next: unknown[]) => {
      rows = next;
    },
    /** How many queries were started, awaited or not. */
    builtCount: () => builtCount,
    /** The SQL of the last awaited query; fails the test when none ran. */
    lastQuery: (): RecordedQuery => {
      const query = awaited.at(-1);
      assert.ok(query, "expected a query to be awaited");
      return query.toSQL();
    },
    reset: () => {
      rows = [];
      builtCount = 0;
      awaited.length = 0;
    },
  };
};
