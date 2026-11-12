/**
 * D1 migrations: plain SQL files in `src/migrations-d1/` (`0000_init.sql`,
 * `0001_…sql`), the layout `wrangler d1 migrations apply` reads. Applied ones
 * are recorded in wrangler's own `d1_migrations` table, so this runner and
 * wrangler can be used interchangeably on the same database.
 */

import { tokenizeSql } from "./sql-rewrite";
import type { SqliteTransport } from "./transports";

export type D1Migration = { name: string; sql: string };

/** Splits a SQL file into statements on `;` outside strings and comments. */
export const splitSqlStatements = (source: string): string[] => {
  const statements: string[] = [];
  let current = "";
  let hasCode = false;
  for (const token of tokenizeSql(source)) {
    if (token.type === "symbol" && token.text === ";") {
      if (hasCode) {
        statements.push(current.trim());
      }
      current = "";
      hasCode = false;
      continue;
    }
    current += token.text;
    if (token.type !== "space" && token.type !== "comment") {
      hasCode = true;
    }
  }
  if (hasCode) {
    statements.push(current.trim());
  }
  return statements;
};

const MIGRATIONS_TABLE = "d1_migrations";

/**
 * Applies the migrations not yet recorded, in name order. Returns the names
 * applied. Each statement runs on its own: like any D1 write, a migration is
 * not atomic as a whole when sent statement by statement.
 */
export const applyD1Migrations = async (
  transport: SqliteTransport,
  migrations: D1Migration[],
  { log = () => {} }: { log?: (message: string) => void } = {},
): Promise<string[]> => {
  await transport.objects(
    `CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL)`,
    [],
  );
  const { rows } = await transport.objects(
    `SELECT name FROM ${MIGRATIONS_TABLE}`,
    [],
  );
  const applied = new Set(rows.map((row) => String(row.name)));
  const pending = [...migrations]
    .sort((a, b) => a.name.localeCompare(b.name))
    .filter((migration) => !applied.has(migration.name));

  for (const migration of pending) {
    log(`Applying ${migration.name}`);
    for (const statement of splitSqlStatements(migration.sql)) {
      await transport.objects(statement, []);
    }
    await transport.objects(
      `INSERT INTO ${MIGRATIONS_TABLE} (name) VALUES (?1)`,
      [migration.name],
    );
  }
  return pending.map((migration) => migration.name);
};

// --- Schema comparison -----------------------------------------------------

export type SqliteColumnInfo = {
  type: string;
  notNull: boolean;
  defaultValue: string | null;
  primaryKeyPosition: number;
};

export type SqliteTableInfo = {
  columns: Record<string, SqliteColumnInfo>;
  /** Normalised `from->table(to) on delete … on update …` strings. */
  foreignKeys: string[];
  /** Column lists of UNIQUE constraints (their automatic indexes). */
  uniques: string[];
  checks: string[];
};

export type SqliteIndexInfo = {
  table: string;
  unique: boolean;
  columns: string;
  where: string | null;
};

export type SqliteSchemaInfo = {
  tables: Record<string, SqliteTableInfo>;
  indexes: Record<string, SqliteIndexInfo>;
};

const IGNORED_TABLES = new Set([MIGRATIONS_TABLE, "sqlite_sequence"]);

const normalizeWhitespace = (value: string): string =>
  value.replace(/\s+/g, " ").trim();

/** Reads tables, columns, keys, uniques, checks and indexes of a database. */
export const introspectSqliteSchema = async (
  transport: SqliteTransport,
): Promise<SqliteSchemaInfo> => {
  const query = async (sql: string) => (await transport.objects(sql, [])).rows;
  const objects = await query(
    "SELECT type, name, tbl_name, sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY name",
  );

  const tables: SqliteSchemaInfo["tables"] = {};
  const indexes: SqliteSchemaInfo["indexes"] = {};

  for (const object of objects) {
    const name = String(object.name);
    if (object.type !== "table" || IGNORED_TABLES.has(name)) {
      continue;
    }
    const quoted = `"${name.replace(/"/g, '""')}"`;
    const columns: SqliteTableInfo["columns"] = {};
    for (const column of await query(`PRAGMA table_info(${quoted})`)) {
      columns[String(column.name)] = {
        type: String(column.type).toUpperCase(),
        notNull: Number(column.notnull) === 1,
        defaultValue:
          column.dflt_value === null
            ? null
            : normalizeWhitespace(String(column.dflt_value)),
        primaryKeyPosition: Number(column.pk),
      };
    }

    const foreignKeys = (await query(`PRAGMA foreign_key_list(${quoted})`))
      .map(
        (fk) =>
          `${fk.from}->${fk.table}(${fk.to}) on delete ${String(fk.on_delete).toLowerCase()} on update ${String(fk.on_update).toLowerCase()}`,
      )
      .sort();

    const uniques: string[] = [];
    for (const index of await query(`PRAGMA index_list(${quoted})`)) {
      const indexName = String(index.name);
      const indexColumns = (
        await query(`PRAGMA index_info("${indexName.replace(/"/g, '""')}")`)
      )
        .sort((a, b) => Number(a.seqno) - Number(b.seqno))
        .map((column) => String(column.name))
        .join(",");
      if (index.origin === "u") {
        uniques.push(indexColumns);
      } else if (index.origin === "c") {
        const definition = objects.find((o) => o.name === indexName);
        const sqlText = definition?.sql ? String(definition.sql) : "";
        const whereMatch = /\bWHERE\b([\s\S]*)$/i.exec(sqlText);
        indexes[indexName] = {
          table: name,
          unique: Number(index.unique) === 1,
          columns: indexColumns,
          where: whereMatch?.[1] ? normalizeWhitespace(whereMatch[1]) : null,
        };
      }
    }

    const checks = [
      ...String(object.sql ?? "").matchAll(/CONSTRAINT\s+"([^"]+)"\s+CHECK/gi),
    ]
      .map((match) => match[1] as string)
      .sort();

    tables[name] = { columns, foreignKeys, uniques: uniques.sort(), checks };
  }

  return { tables, indexes };
};

export type SqliteSchemaDiff = {
  newTables: string[];
  newColumns: { table: string; column: string }[];
  newIndexes: string[];
  droppedIndexes: string[];
  /** Changes SQLite cannot make in place: they need a hand-written migration. */
  unsupported: string[];
};

export const isEmptySchemaDiff = (diff: SqliteSchemaDiff): boolean =>
  diff.newTables.length === 0 &&
  diff.newColumns.length === 0 &&
  diff.newIndexes.length === 0 &&
  diff.droppedIndexes.length === 0 &&
  diff.unsupported.length === 0;

const sameJson = (a: unknown, b: unknown): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

/** What it takes to turn `current` into `desired`. */
export const diffSqliteSchemas = (
  current: SqliteSchemaInfo,
  desired: SqliteSchemaInfo,
): SqliteSchemaDiff => {
  const diff: SqliteSchemaDiff = {
    newTables: [],
    newColumns: [],
    newIndexes: [],
    droppedIndexes: [],
    unsupported: [],
  };

  for (const [name, desiredTable] of Object.entries(desired.tables)) {
    const currentTable = current.tables[name];
    if (!currentTable) {
      diff.newTables.push(name);
      continue;
    }
    for (const [column, info] of Object.entries(desiredTable.columns)) {
      const existing = currentTable.columns[column];
      if (!existing) {
        diff.newColumns.push({ table: name, column });
      } else if (!sameJson(existing, info)) {
        diff.unsupported.push(
          `${name}.${column} changed: ${JSON.stringify(existing)} → ${JSON.stringify(info)}`,
        );
      }
    }
    for (const column of Object.keys(currentTable.columns)) {
      if (!desiredTable.columns[column]) {
        diff.unsupported.push(`${name}.${column} was removed`);
      }
    }
    for (const key of ["foreignKeys", "uniques", "checks"] as const) {
      if (!sameJson(currentTable[key], desiredTable[key])) {
        // A new column's own foreign key is added with the column.
        const added = desiredTable[key].filter(
          (entry) => !currentTable[key].includes(entry),
        );
        const removed = currentTable[key].filter(
          (entry) => !desiredTable[key].includes(entry),
        );
        const onlyNewColumnForeignKeys =
          key === "foreignKeys" &&
          removed.length === 0 &&
          added.every((entry) =>
            diff.newColumns.some(
              (c) => c.table === name && entry.startsWith(`${c.column}->`),
            ),
          );
        if (!onlyNewColumnForeignKeys) {
          diff.unsupported.push(
            `${name} ${key} changed: +${JSON.stringify(added)} -${JSON.stringify(removed)}`,
          );
        }
      }
    }
  }
  for (const name of Object.keys(current.tables)) {
    if (!desired.tables[name]) {
      diff.unsupported.push(`table ${name} was removed`);
    }
  }

  for (const [name, index] of Object.entries(desired.indexes)) {
    const existing = current.indexes[name];
    if (!existing) {
      if (!diff.newTables.includes(index.table)) {
        diff.newIndexes.push(name);
      }
    } else if (!sameJson(existing, index)) {
      diff.droppedIndexes.push(name);
      diff.newIndexes.push(name);
    }
  }
  for (const name of Object.keys(current.indexes)) {
    if (!desired.indexes[name]) {
      diff.droppedIndexes.push(name);
    }
  }

  return diff;
};
