import assert from "node:assert";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { getTableColumns, is, sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  PgTable,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { getSqliteColumnDefault } from "../src/d1/column-defaults";
import {
  planD1Migration,
  readD1Migrations,
  renderD1Migration,
} from "../src/d1/migration-plan";
import {
  applyD1Migrations,
  introspectSqliteSchema,
  splitSqlStatements,
} from "../src/d1/migrations";
import { generateSqliteTableDdl } from "../src/d1/schema-ddl";
import { createLocalSqliteTransport } from "../src/d1/transports";
import * as schema from "../src/schemas";

const MIGRATIONS_DIR = fileURLToPath(
  new URL("../src/migrations-d1", import.meta.url),
);

describe("splitSqlStatements", () => {
  it("splits on semicolons outside strings and comments", () => {
    assert.deepStrictEqual(
      splitSqlStatements(
        `-- header; still a comment\nCREATE TABLE "a" ("x" TEXT DEFAULT ';');\n\nCREATE INDEX "i" ON "a" ("x");\n`,
      ),
      [
        `-- header; still a comment\nCREATE TABLE "a" ("x" TEXT DEFAULT ';')`,
        `CREATE INDEX "i" ON "a" ("x")`,
      ],
    );
  });
});

describe("D1 migrations", () => {
  it("are up to date with the pg-core schema", async () => {
    const plan = await planD1Migration(
      schema,
      await readD1Migrations(MIGRATIONS_DIR),
    );
    assert.deepStrictEqual(
      { statements: plan.statements, problems: plan.problems },
      { statements: [], problems: [] },
      "The D1 migrations are stale: run `pnpm --filter @wildfires-org/turboplan-db d1:generate <name>`",
    );
  });

  it("support every column default in the schema", () => {
    for (const table of Object.values(schema)) {
      if (!is(table, PgTable)) {
        continue;
      }
      for (const column of Object.values(getTableColumns(table))) {
        assert.doesNotThrow(() => getSqliteColumnDefault(column), column.name);
      }
    }
  });

  it("apply on a fresh database and record themselves like wrangler", async () => {
    const transport = createLocalSqliteTransport(":memory:");
    try {
      const migrations = await readD1Migrations(MIGRATIONS_DIR);
      assert.deepStrictEqual(
        await applyD1Migrations(transport, migrations),
        migrations.map((m) => m.name),
      );
      assert.deepStrictEqual(
        await applyD1Migrations(transport, migrations),
        [],
      );
      const info = await introspectSqliteSchema(transport);
      assert.ok(info.tables.user?.columns.email);
      assert.ok(info.tables.project?.foreignKeys.length);
      const { rows } = await transport.objects(
        "SELECT name FROM d1_migrations ORDER BY id",
        [],
      );
      assert.deepStrictEqual(
        rows.map((row) => row.name),
        migrations.map((m) => m.name),
      );
    } finally {
      await transport.close?.();
    }
  });
});

describe("D1 migration planning", () => {
  const v1 = {
    note: pgTable("note", {
      id: uuid("id").primaryKey().defaultRandom(),
      body: text("body").notNull(),
      createdAt: timestamp("created_at").notNull().defaultNow(),
    }),
  };

  it("plans new tables, columns and indexes, then nothing", async () => {
    const first = await planD1Migration(v1, []);
    assert.deepStrictEqual(first.problems, []);
    const init = {
      name: "0000_init.sql",
      sql: renderD1Migration(first.statements),
    };

    const tag = pgTable("tag", { id: uuid("id").primaryKey().defaultRandom() });
    const v2 = {
      note: pgTable(
        "note",
        {
          id: uuid("id").primaryKey().defaultRandom(),
          body: text("body").notNull(),
          createdAt: timestamp("created_at").notNull().defaultNow(),
          pinned: boolean("pinned").notNull().default(false),
          tagId: uuid("tag_id").references(() => tag.id, {
            onDelete: "set null",
          }),
        },
        (t) => [index("note_tag_idx").on(t.tagId, t.createdAt.desc())],
      ),
      tag,
    };
    const second = await planD1Migration(v2, [init]);
    assert.deepStrictEqual(second.problems, []);
    assert.deepStrictEqual(second.statements, [
      "CREATE TABLE \"tag\" (\n  \"id\" TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))))\n)",
      'ALTER TABLE "note" ADD COLUMN "pinned" INTEGER NOT NULL DEFAULT 0',
      'ALTER TABLE "note" ADD COLUMN "tag_id" TEXT CONSTRAINT "note_tag_id_tag_id_fk" REFERENCES "tag" ("id") ON DELETE SET NULL ON UPDATE NO ACTION',
      'CREATE INDEX "note_tag_idx" ON "note" ("tag_id", "created_at" DESC)',
    ]);

    const third = await planD1Migration(v2, [
      init,
      { name: "0001_tags.sql", sql: renderD1Migration(second.statements) },
    ]);
    assert.deepStrictEqual(
      { statements: third.statements, problems: third.problems },
      { statements: [], problems: [] },
    );
  });

  it("refuses a change SQLite cannot make in place", async () => {
    const init = {
      name: "0000_init.sql",
      sql: renderD1Migration((await planD1Migration(v1, [])).statements),
    };
    const plan = await planD1Migration(
      {
        note: pgTable("note", {
          id: uuid("id").primaryKey().defaultRandom(),
          body: text("body"),
          createdAt: timestamp("created_at").notNull().defaultNow(),
          ownerId: text("owner_id").notNull(),
        }),
      },
      [init],
    );
    assert.deepStrictEqual(plan.problems.length, 2);
    assert.match(plan.problems.join("\n"), /note\.body changed/);
    assert.match(
      plan.problems.join("\n"),
      /note\.owner_id is a NOT NULL column without a default/,
    );
  });
});

describe("SQLite DDL", () => {
  it("renders checks and skips Postgres-only index methods", () => {
    const ddl = generateSqliteTableDdl(
      pgTable(
        "doc",
        {
          id: uuid("id").primaryKey(),
          a: text("a"),
          b: text("b"),
          n: integer("n").default(-1),
        },
        (t) => [
          check("doc_n_range", sql`${t.n} between ${-1} and ${10}`),
          index("doc_a_trgm").using("gin", sql`${t.a} gin_trgm_ops`),
          index("doc_b_partial").on(t.b).where(sql`${t.n} > ${0}`),
        ],
      ),
    );
    assert.match(ddl.columns.n ?? "", /DEFAULT \(-1\)$/);
    assert.match(
      ddl.createTable,
      /CONSTRAINT "doc_n_range" CHECK \("n" between -1 and 10\)/,
    );
    assert.deepStrictEqual(ddl.skippedIndexes, [
      { name: "doc_a_trgm", reason: "gin index" },
    ]);
    assert.deepStrictEqual(ddl.indexes, [
      {
        name: "doc_b_partial",
        sql: 'CREATE INDEX "doc_b_partial" ON "doc" ("b") WHERE "n" > 0',
      },
    ]);
  });

  it("refuses a Postgres-only function without a translation", () => {
    const table = pgTable("doc", { a: text("a"), b: text("b") }, (t) => [
      check("doc_one", sql`num_nonnulls(${t.a}, ${t.b}) <= 1`),
    ]);
    assert.throws(
      () => generateSqliteTableDdl(table),
      /no SQLite translation .*num_nonnulls\("a", "b"\) <= 1/,
    );
  });

  it("translates the schema's document-reference check", () => {
    assert.match(
      generateSqliteTableDdl(schema.documentOwnLetterhead).createTable,
      /CONSTRAINT "document_own_letterhead_single_reference" CHECK \(\(\("reference_project_document_id" IS NOT NULL\) \+ \("reference_organization_document_id" IS NOT NULL\)\) <= 1\)/,
    );
  });
});
