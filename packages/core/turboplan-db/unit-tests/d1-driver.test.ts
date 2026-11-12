import assert from "node:assert";
import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { relations, sql } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  PgDialect,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { SqlitePgDialect } from "../src/d1/dialect";
import { drizzleSqlite } from "../src/d1/driver";
import { normalizeSqliteError } from "../src/d1/errors";
import {
  createD1BindingTransport,
  createD1HttpTransport,
  createLocalSqliteTransport,
  type D1DatabaseLike,
  type SqliteTransport,
} from "../src/d1/transports";
import type { SqliteValue } from "../src/d1/values";
import {
  jsonArrayContains,
  substringMatchRank,
} from "../src/db-client/dialect-helpers";
import { isUniqueViolation } from "../src/db-client/errors";

const author = pgTable("author", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  active: boolean("active").notNull().default(true),
  tags: text("tags").array().notNull().default([]),
  meta: jsonb("meta").$type<{ a?: number }>().default({}),
  rank: integer("rank").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

const book = pgTable("book", {
  id: uuid("id").primaryKey().defaultRandom(),
  authorId: uuid("author_id").notNull(),
  title: text("title").notNull(),
});

const authorRelations = relations(author, ({ many }) => ({
  books: many(book),
}));
const bookRelations = relations(book, ({ one }) => ({
  author: one(author, { fields: [book.authorId], references: [author.id] }),
}));

const schema = { author, book, authorRelations, bookRelations };

type Call = { sql: string; params: SqliteValue[] };

/** Records each statement and answers with canned array rows. */
const captureTransport = (rows: unknown[][] = []) => {
  const calls: Call[] = [];
  const transport: SqliteTransport = {
    kind: "local-file",
    values: async (query, params) => {
      calls.push({ sql: query, params });
      return rows;
    },
    objects: async (query, params) => {
      calls.push({ sql: query, params });
      return { rows: [], changes: 0 };
    },
  };
  return { calls, transport };
};

describe("SqlitePgDialect SQL", () => {
  it("spells out column defaults in inserts and uses ?N parameters", async () => {
    const { calls, transport } = captureTransport();
    const db = drizzleSqlite(transport, { schema });
    const before = Date.now();
    await db
      .insert(author)
      .values({ name: "Ada" })
      .returning({ id: author.id });

    const [call] = calls;
    assert.ok(call);
    assert.strictEqual(
      call.sql,
      'insert into "author" ("id", "name", "active", "tags", "meta", "rank", "created_at", "updated_at") values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8) returning "id"',
    );
    const [id, name, active, tags, meta, rank, createdAt, updatedAt] =
      call.params;
    assert.match(String(id), /^[0-9a-f-]{36}$/);
    assert.strictEqual(name, "Ada");
    assert.strictEqual(active, 1);
    assert.strictEqual(tags, "{}");
    assert.strictEqual(meta, "{}");
    assert.strictEqual(rank, 0);
    assert.ok(Date.parse(String(createdAt)) >= before - 1);
    assert.match(String(updatedAt), /Z$/);
  });

  it("drops locking clauses and rewrites casts, ilike and now()", async () => {
    const { calls, transport } = captureTransport();
    const db = drizzleSqlite(transport, { schema });
    await db
      .select({ n: sql<number>`count(*)::int` })
      .from(author)
      .where(sql`${author.name} ilike ${"%a%"} and ${author.createdAt} < now()`)
      .for("update");
    assert.strictEqual(
      calls[0]?.sql,
      `select count(*) from "author" where "author"."name" like ?1 escape '\\' and "author"."created_at" < strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
    );
  });

  it("writes set operations without the parentheses SQLite rejects", async () => {
    const { calls, transport } = captureTransport();
    const db = drizzleSqlite(transport, { schema });
    await db
      .select({ id: author.id })
      .from(author)
      .union(db.select({ id: book.id }).from(book));
    assert.strictEqual(
      calls[0]?.sql,
      'select * from (select "id" from "author") union select * from (select "id" from "book")',
    );
  });

  it("builds relational queries from correlated json subqueries", async () => {
    const { calls, transport } = captureTransport();
    const db = drizzleSqlite(transport, { schema });
    await db.query.author.findMany({
      columns: { id: true },
      with: { books: { columns: { title: true } } },
    });
    assert.strictEqual(
      calls[0]?.sql,
      'select "id", (select coalesce(json_group_array(json_array("title")), json_array()) as "data" from "book" "author_books" where "author_books"."author_id" = "author"."id") as "books" from "author" "author"',
    );
  });

  it("inlines parameters above the bound-parameter limit", async () => {
    const { calls, transport } = captureTransport();
    const db = drizzleSqlite(transport, { schema, maxBoundParameters: 2 });
    await db.execute(sql`select ${1}, ${"it's"}, ${true}`);
    assert.deepStrictEqual(calls[0], {
      sql: "select 1, 'it''s', 1",
      params: [],
    });
  });

  it("refuses `select distinct on`", async () => {
    const { transport } = captureTransport();
    const db = drizzleSqlite(transport, { schema });
    assert.throws(
      () => db.selectDistinctOn([author.name]).from(author).toSQL(),
      /distinct on/,
    );
  });
});

describe("D1 helpers", () => {
  const previous = process.env.DB_PROVIDER;
  afterEach(() => {
    if (previous === undefined) {
      delete process.env.DB_PROVIDER;
    } else {
      process.env.DB_PROVIDER = previous;
    }
  });
  const render = (fragment: ReturnType<typeof sql>, sqlite: boolean) =>
    (sqlite ? new SqlitePgDialect() : new PgDialect()).sqlToQuery(fragment);

  it("keeps the Postgres jsonb containment on Postgres", () => {
    process.env.DB_PROVIDER = "postgres";
    const query = render(jsonArrayContains(author.meta, "old-slug"), false);
    assert.strictEqual(query.sql, '"author"."meta"::jsonb @> $1::jsonb');
    assert.deepStrictEqual(query.params, ['["old-slug"]']);
  });

  it("uses json_each on D1", () => {
    process.env.DB_PROVIDER = "d1";
    assert.strictEqual(
      render(jsonArrayContains(author.meta, "old-slug"), true).sql,
      'exists (select 1 from json_each("author"."meta") as je where je.value = ?1)',
    );
    const objectMatch = render(
      jsonArrayContains(author.meta, { userId: "u", role: "signer" }),
      true,
    );
    assert.strictEqual(
      objectMatch.sql,
      `exists (select 1 from json_each("author"."meta") as je where json_type(je.value) = 'object' and json_extract(je.value, ?1) = ?2 and json_extract(je.value, ?3) = ?4)`,
    );
    assert.deepStrictEqual(objectMatch.params, [
      '$."userId"',
      "u",
      '$."role"',
      "signer",
    ]);
    assert.match(
      render(substringMatchRank("Ad", [[author.name, 1]]), true).sql,
      /^\(case/,
    );
  });
});

describe("errors", () => {
  it("gives SQLite constraint failures their Postgres SQLSTATE", () => {
    assert.strictEqual(
      normalizeSqliteError(
        new Error(
          "D1_ERROR: UNIQUE constraint failed: user.email: SQLITE_CONSTRAINT",
        ),
      ).code,
      "23505",
    );
    assert.strictEqual(
      normalizeSqliteError(new Error("FOREIGN KEY constraint failed")).code,
      "23503",
    );
    assert.strictEqual(
      normalizeSqliteError(new Error("no such table")).code,
      undefined,
    );
  });

  it("lets isUniqueViolation see a duplicate insert", async () => {
    const transport: SqliteTransport = {
      kind: "local-file",
      values: async () => {
        throw new Error("UNIQUE constraint failed: author.id");
      },
      objects: async () => {
        throw new Error("UNIQUE constraint failed: author.id");
      },
    };
    const db = drizzleSqlite(transport, { schema });
    await assert.rejects(db.insert(author).values({ name: "Ada" }), (error) =>
      isUniqueViolation(error),
    );
  });
});

describe("transports", () => {
  it("binding transport binds parameters and reads raw rows and changes", async () => {
    const seen: unknown[][] = [];
    const binding: D1DatabaseLike = {
      prepare: (query) => {
        const statement = {
          bind: (...values: unknown[]) => {
            seen.push([query, ...values]);
            return statement;
          },
          raw: async <T>() => [[1, "a"]] as T[],
          all: async <T>() => ({
            results: [{ id: 1 }] as T[],
            meta: { changes: 3 },
          }),
        };
        return statement;
      },
    };
    const transport = createD1BindingTransport(binding);
    assert.deepStrictEqual(await transport.values("select ?1", [1]), [
      [1, "a"],
    ]);
    assert.deepStrictEqual(await transport.objects("update x", []), {
      rows: [{ id: 1 }],
      changes: 3,
    });
    assert.deepStrictEqual(seen, [["select ?1", 1], ["update x"]]);
  });

  describe("D1 HTTP API", () => {
    let requests: { url: string; init: RequestInit }[] = [];
    let reply: { status: number; body: unknown };
    const fakeFetch = (async (url: string, init: RequestInit) => {
      requests.push({ url, init });
      return new Response(JSON.stringify(reply.body), { status: reply.status });
    }) as unknown as typeof fetch;
    const transport = createD1HttpTransport({
      accountId: "acct",
      databaseId: "db-id",
      apiToken: "test-token",
      fetch: fakeFetch,
    });
    beforeEach(() => {
      requests = [];
    });

    it("posts the statement to /raw and maps columns", async () => {
      reply = {
        status: 200,
        body: {
          success: true,
          result: [
            {
              results: { columns: ["id", "name"], rows: [[1, "Ada"]] },
              meta: { changes: 0 },
            },
          ],
        },
      };
      assert.deepStrictEqual(
        await transport.objects(
          'select "id", "name" from t where id = ?1',
          [1],
        ),
        { rows: [{ id: 1, name: "Ada" }], changes: 0 },
      );
      assert.deepStrictEqual(await transport.values("select 1", []), [
        [1, "Ada"],
      ]);
      const [request] = requests;
      assert.strictEqual(
        request?.url,
        "https://api.cloudflare.com/client/v4/accounts/acct/d1/database/db-id/raw",
      );
      assert.strictEqual(request?.init.method, "POST");
      assert.strictEqual(
        (request?.init.headers as Record<string, string>).Authorization,
        "Bearer test-token",
      );
      assert.deepStrictEqual(JSON.parse(String(request?.init.body)), {
        sql: 'select "id", "name" from t where id = ?1',
        params: [1],
      });
    });

    it("surfaces the API's error message", async () => {
      reply = {
        status: 400,
        body: {
          success: false,
          errors: [
            { message: "UNIQUE constraint failed: t.id: SQLITE_CONSTRAINT" },
          ],
        },
      };
      await assert.rejects(transport.objects("insert", []), (error: Error) => {
        assert.match(error.message, /UNIQUE constraint failed/);
        return normalizeSqliteError(error).code === "23505";
      });
    });
  });

  it("local file transport opens node:sqlite without an import a bundler must resolve", async () => {
    const transport = createLocalSqliteTransport(":memory:");
    try {
      assert.deepStrictEqual(await transport.values("select ?1 + 1", [1]), [
        [2],
      ]);
    } finally {
      await transport.close?.();
    }
    // The web Worker's build (Next.js, then OpenNext's esbuild) bundles this
    // module. Its minifier folds an import() of a constant specifier into
    // import("bun:sqlite"), which esbuild cannot resolve.
    const source = await readFile(
      fileURLToPath(new URL("../src/d1/transports.ts", import.meta.url)),
      "utf8",
    );
    assert.doesNotMatch(source, /\bimport\s*\(/);
  });
});
