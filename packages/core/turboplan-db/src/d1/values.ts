/**
 * Value mapping between drizzle's Postgres columns and SQLite storage.
 *
 * Writes go through each pg-core column's own `mapToDriverValue` first (Dates
 * become ISO strings, json/jsonb become JSON text, arrays become Postgres
 * array literals such as `{a,b}`), so `toSqliteParam` only handles what is left:
 * booleans, raw Dates in `sql` fragments, and other JS values SQLite cannot
 * bind.
 *
 * Reads come back as SQLite's own types. `fromSqliteValue` turns them into what
 * postgres.js would have handed the same column, so the column's
 * `mapFromDriverValue` (and the code above it) sees no difference.
 */

import { type Column, is } from "drizzle-orm";
import { PgBoolean, PgTimestamp } from "drizzle-orm/pg-core";

export type SqliteValue = null | number | string | Uint8Array;

export const toSqliteParam = (value: unknown): SqliteValue => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }
  if (typeof value === "number" || typeof value === "string") {
    return value;
  }
  if (typeof value === "bigint") {
    const asNumber = Number(value);
    return Number.isSafeInteger(asNumber) ? asNumber : value.toString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (value instanceof Uint8Array) {
    return value;
  }
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }
  return JSON.stringify(value);
};

// "2026-01-02T03:04:05.678Z", "2026-01-02 03:04:05" (SQLite's datetime()),
// or either with an explicit offset.
const HAS_ZONE = /(?:[zZ]|[+-]\d{2}(?::?\d{2})?)$/;

/**
 * A stored timestamp as a Date. Timestamps are stored as ISO-8601 UTC strings;
 * a value without a zone (written by hand or by SQLite's own date functions)
 * is read as UTC too, matching how drizzle reads Postgres `timestamp`.
 */
export const parseSqliteTimestamp = (value: string): Date => {
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  return new Date(HAS_ZONE.test(normalized) ? normalized : `${normalized}Z`);
};

export const fromSqliteValue = (column: Column, value: unknown): unknown => {
  if (value === null || value === undefined) {
    return null;
  }
  if (is(column, PgBoolean)) {
    if (typeof value === "number") {
      return value !== 0;
    }
    if (typeof value === "bigint") {
      return value !== 0n;
    }
    return value;
  }
  if (is(column, PgTimestamp) && typeof value === "string") {
    return parseSqliteTimestamp(value);
  }
  return value;
};
