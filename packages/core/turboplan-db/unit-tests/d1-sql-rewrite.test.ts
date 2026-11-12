import assert from "node:assert";
import { describe, it } from "node:test";
import {
  boolean,
  integer,
  pgTable,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import {
  inlineSqliteParams,
  rewritePgSqlForSqlite,
  SQLITE_NOW,
} from "../src/d1/sql-rewrite";
import {
  fromSqliteValue,
  parseSqliteTimestamp,
  toSqliteParam,
} from "../src/d1/values";

describe("rewritePgSqlForSqlite", () => {
  it("drops Postgres casts, including multi-word and array types", () => {
    assert.strictEqual(
      rewritePgSqlForSqlite(
        `select count(*)::int, count(*) filter (where "s" = 'x')::int, ?1::timestamp with time zone, ?2::jsonb, '{}'::text[], "n"::numeric(12, 6), ?3::double precision`,
      ),
      `select count(*), count(*) filter (where "s" = 'x'), ?1, ?2, '{}', "n", ?3`,
    );
  });

  it("turns ilike into like with the Postgres escape character", () => {
    assert.strictEqual(
      rewritePgSqlForSqlite(`"email" ILIKE ?1 OR "name" not ilike ?2`),
      `"email" like ?1 escape '\\' OR "name" not like ?2 escape '\\'`,
    );
    // An explicit escape clause is kept as written.
    assert.strictEqual(
      rewritePgSqlForSqlite(`"a" like ?1 escape '!'`),
      `"a" like ?1 escape '!'`,
    );
  });

  it("maps now() to an ISO-8601 UTC timestamp", () => {
    assert.strictEqual(
      rewritePgSqlForSqlite(`coalesce("t"."at", now())`),
      `coalesce("t"."at", ${SQLITE_NOW})`,
    );
  });

  it("never touches string literals, quoted identifiers or comments", () => {
    const sql = `select 'a::int ilike now()', "x::y", 'it''s' -- ::int ilike\n`;
    assert.strictEqual(rewritePgSqlForSqlite(sql), sql);
  });
});

describe("inlineSqliteParams", () => {
  it("replaces numbered and anonymous placeholders with literals", () => {
    assert.strictEqual(
      inlineSqliteParams(`values (?1, ?2, ?3, ?4, '?1')`, [
        "it's",
        3.5,
        null,
        new Uint8Array([1, 255]),
      ]),
      `values ('it''s', 3.5, NULL, X'01ff', '?1')`,
    );
    assert.strictEqual(inlineSqliteParams("? + ?", [1, 2]), "1 + 2");
  });

  it("refuses a placeholder without a value", () => {
    assert.throws(() => inlineSqliteParams("?2", [1]), /no value/);
  });
});

describe("value mapping", () => {
  const table = pgTable("t", {
    id: uuid("id"),
    flag: boolean("flag"),
    at: timestamp("at"),
    atTz: timestamp("at_tz", { withTimezone: true }),
    n: integer("n"),
  });

  it("binds JS values the way SQLite accepts them", () => {
    assert.strictEqual(toSqliteParam(true), 1);
    assert.strictEqual(toSqliteParam(false), 0);
    assert.strictEqual(toSqliteParam(undefined), null);
    assert.strictEqual(
      toSqliteParam(new Date("2026-01-02T03:04:05.678Z")),
      "2026-01-02T03:04:05.678Z",
    );
    assert.strictEqual(toSqliteParam(12n), 12);
    assert.strictEqual(toSqliteParam({ a: [1] }), '{"a":[1]}');
  });

  it("reads SQLite values back as the pg-core column expects", () => {
    assert.strictEqual(fromSqliteValue(table.flag, 1), true);
    assert.strictEqual(fromSqliteValue(table.flag, 0), false);
    assert.strictEqual(fromSqliteValue(table.n, 1), 1);
    const at = fromSqliteValue(table.at, "2026-01-02T03:04:05.678Z") as Date;
    assert.ok(at instanceof Date);
    assert.strictEqual(at.toISOString(), "2026-01-02T03:04:05.678Z");
    // The column's own decoder then passes the Date through unchanged.
    assert.strictEqual(table.at.mapFromDriverValue(at as never), at);
    assert.strictEqual(
      (
        fromSqliteValue(table.atTz, "2026-01-02T03:04:05.678Z") as Date
      ).getTime(),
      Date.UTC(2026, 0, 2, 3, 4, 5, 678),
    );
  });

  it("reads zone-less timestamps (SQLite's datetime()) as UTC", () => {
    assert.strictEqual(
      parseSqliteTimestamp("2026-01-02 03:04:05").toISOString(),
      "2026-01-02T03:04:05.000Z",
    );
    assert.strictEqual(
      parseSqliteTimestamp("2026-01-02T03:04:05+02:00").toISOString(),
      "2026-01-02T01:04:05.000Z",
    );
  });
});
