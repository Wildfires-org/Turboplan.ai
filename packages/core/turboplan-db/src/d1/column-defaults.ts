import { is, SQL } from "drizzle-orm";
import { type PgColumn, PgDialect } from "drizzle-orm/pg-core";

/**
 * A pg-core column default as SQLite can apply it. The schema only uses
 * `now()`, `gen_random_uuid()` and literals; anything else is rejected so a
 * new kind of default cannot silently become NULL on D1.
 */
export type SqliteColumnDefault =
  | { kind: "now" }
  | { kind: "uuid" }
  | { kind: "literal"; value: unknown };

const pgDialect = new PgDialect();

/** A Postgres SQL fragment as the Postgres dialect renders it. */
export const renderPgSql = (fragment: SQL, invokeSource?: "indexes"): string =>
  pgDialect.sqlToQuery(fragment, invokeSource).sql;

export const getSqliteColumnDefault = (
  column: PgColumn,
): SqliteColumnDefault | undefined => {
  const value = column.default;
  if (value === undefined) {
    return undefined;
  }
  if (!is(value, SQL)) {
    return { kind: "literal", value };
  }
  const text = renderPgSql(value).trim().toLowerCase();
  if (text === "now()" || text === "current_timestamp") {
    return { kind: "now" };
  }
  if (text === "gen_random_uuid()") {
    return { kind: "uuid" };
  }
  throw new Error(
    `Column "${column.name}" has a SQL default D1 cannot apply: ${text}`,
  );
};
