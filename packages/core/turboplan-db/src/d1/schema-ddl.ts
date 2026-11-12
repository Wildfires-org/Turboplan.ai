/**
 * SQLite DDL for the pg-core schema: the D1 database is the same tables,
 * columns, keys, uniques, checks and indexes, with SQLite types. Postgres-only
 * index methods (GIN trigram, GiST spatial) have no SQLite equivalent and are
 * left out; the maps module's PostGIS geometry is stored as TEXT (maps are not
 * supported on D1).
 */

import { is, SQL, sql } from "drizzle-orm";
import {
  getTableConfig,
  type IndexedColumn,
  type PgColumn,
  PgTable,
} from "drizzle-orm/pg-core";

import { getSqliteColumnDefault, renderPgSql } from "./column-defaults";
import { SqlitePgDialect } from "./dialect";
import { toSqliteLiteral } from "./sql-rewrite";
import { toSqliteParam } from "./values";

export type SqliteTableDdl = {
  name: string;
  /** Column name → its definition (`"col" TEXT NOT NULL DEFAULT …`). */
  columns: Record<string, string>;
  /**
   * Column name → its single-column foreign key as a column constraint
   * (`CONSTRAINT … REFERENCES …`), for adding the column with ALTER TABLE.
   */
  columnForeignKeys: Record<string, string>;
  createTable: string;
  indexes: { name: string; sql: string }[];
  /** Indexes skipped because SQLite has no equivalent, with the reason. */
  skippedIndexes: { name: string; reason: string }[];
};

const INTEGER_TYPES = new Set([
  "PgBoolean",
  "PgInteger",
  "PgSmallInt",
  "PgBigInt53",
  "PgBigInt64",
  "PgSerial",
  "PgSmallSerial",
  "PgBigSerial53",
  "PgBigSerial64",
]);
const REAL_TYPES = new Set(["PgReal", "PgDoublePrecision"]);
const NUMERIC_TYPES = new Set([
  "PgNumeric",
  "PgNumericNumber",
  "PgNumericBigInt",
]);

/** SQLite storage type for a pg-core column. Everything else is TEXT. */
export const sqliteColumnType = (column: PgColumn): string => {
  if (INTEGER_TYPES.has(column.columnType)) {
    return "INTEGER";
  }
  if (REAL_TYPES.has(column.columnType)) {
    return "REAL";
  }
  if (NUMERIC_TYPES.has(column.columnType)) {
    return "NUMERIC";
  }
  return "TEXT";
};

const SQLITE_UUID_V4 =
  "(lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || " +
  "substr(hex(randomblob(2)), 2) || '-' || " +
  "substr('89ab', 1 + (abs(random()) % 4), 1) || " +
  "substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))))";

export const SQLITE_NOW_DEFAULT = "(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))";

const defaultClause = (column: PgColumn): string => {
  const resolved = getSqliteColumnDefault(column);
  if (!resolved) {
    return "";
  }
  if (resolved.kind === "now") {
    return ` DEFAULT ${SQLITE_NOW_DEFAULT}`;
  }
  if (resolved.kind === "uuid") {
    return ` DEFAULT ${SQLITE_UUID_V4}`;
  }
  const literal = toSqliteLiteral(
    toSqliteParam(column.mapToDriverValue(resolved.value)),
  );
  // SQLite needs an expression default parenthesised; a bare negative number
  // is one.
  return ` DEFAULT ${/^-/.test(literal) ? `(${literal})` : literal}`;
};

const q = (name: string): string => `"${name.replace(/"/g, '""')}"`;

const dialect = new SqlitePgDialect();

/**
 * Postgres expressions in checks and partial-index predicates that need a
 * different spelling on SQLite, keyed by the Postgres text so a change to the
 * schema expression is caught instead of keeping a stale translation.
 */
const EXPRESSION_TRANSLATIONS: Record<string, string> = {
  'num_nonnulls("reference_project_document_id", "reference_organization_document_id") <= 1':
    '(("reference_project_document_id" IS NOT NULL) + ("reference_organization_document_id" IS NOT NULL)) <= 1',
};

const PG_ONLY_FUNCTION =
  /\b(num_nonnulls|num_nulls|array_length|cardinality|jsonb_\w+|to_tsvector|similarity)\s*\(/i;

/** A check / partial-index predicate as SQLite SQL, with inlined values. */
const renderExpression = (expression: SQL): string => {
  const pgText = renderPgSql(sql`${expression}`.inlineParams(), "indexes");
  const translated = EXPRESSION_TRANSLATIONS[pgText];
  if (translated) {
    return translated;
  }
  const sqliteText = dialect.sqlToQuery(
    // Unqualified column names, values inlined: what an index or a check
    // constraint needs. Wrapped so the schema's own SQL object is not mutated.
    sql`${expression}`.inlineParams(),
    "indexes",
  ).sql;
  if (PG_ONLY_FUNCTION.test(sqliteText)) {
    throw new Error(
      `Expression has no SQLite translation (add one to EXPRESSION_TRANSLATIONS): ${pgText}`,
    );
  }
  return sqliteText;
};

const isIndexedColumn = (value: unknown): value is IndexedColumn =>
  typeof value === "object" &&
  value !== null &&
  "indexConfig" in value &&
  "name" in value;

export const generateSqliteTableDdl = (table: PgTable): SqliteTableDdl => {
  const config = getTableConfig(table);
  const compositePrimaryKey = config.primaryKeys[0];
  const columns: Record<string, string> = {};

  for (const column of config.columns) {
    let definition = `${q(column.name)} ${sqliteColumnType(column)}`;
    if (column.primary && !compositePrimaryKey) {
      definition += " PRIMARY KEY";
    }
    // SQLite lets a non-INTEGER primary key hold NULL unless told otherwise.
    if (column.notNull || column.primary) {
      definition += " NOT NULL";
    }
    definition += defaultClause(column);
    columns[column.name] = definition;
  }

  const constraints: string[] = [];
  if (compositePrimaryKey) {
    constraints.push(
      `PRIMARY KEY (${compositePrimaryKey.columns.map((c) => q(c.name)).join(", ")})`,
    );
  }
  for (const column of config.columns) {
    if (column.isUnique) {
      constraints.push(
        `CONSTRAINT ${q(column.uniqueName ?? `${config.name}_${column.name}_unique`)} UNIQUE (${q(column.name)})`,
      );
    }
  }
  for (const unique of config.uniqueConstraints) {
    constraints.push(
      `CONSTRAINT ${q(unique.getName() ?? `${config.name}_${unique.columns.map((c) => c.name).join("_")}_unique`)} UNIQUE (${unique.columns.map((c) => q(c.name)).join(", ")})`,
    );
  }
  const foreignKeys = [...config.foreignKeys].sort((a, b) =>
    a.getName().localeCompare(b.getName()),
  );
  const columnForeignKeys: Record<string, string> = {};
  for (const foreignKey of foreignKeys) {
    const reference = foreignKey.reference();
    const references =
      `REFERENCES ${q(getTableConfig(reference.foreignTable).name)} (${reference.foreignColumns.map((c) => q(c.name)).join(", ")}) ` +
      `ON DELETE ${(foreignKey.onDelete ?? "no action").toUpperCase()} ` +
      `ON UPDATE ${(foreignKey.onUpdate ?? "no action").toUpperCase()}`;
    constraints.push(
      `CONSTRAINT ${q(foreignKey.getName())} FOREIGN KEY (${reference.columns.map((c) => q(c.name)).join(", ")}) ${references}`,
    );
    const [onlyColumn, ...otherColumns] = reference.columns;
    if (onlyColumn && otherColumns.length === 0) {
      columnForeignKeys[onlyColumn.name] =
        `CONSTRAINT ${q(foreignKey.getName())} ${references}`;
    }
  }
  for (const check of [...config.checks].sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    constraints.push(
      `CONSTRAINT ${q(check.name)} CHECK (${renderExpression(check.value)})`,
    );
  }

  const body = [...Object.values(columns), ...constraints]
    .map((line) => `  ${line}`)
    .join(",\n");
  const createTable = `CREATE TABLE ${q(config.name)} (\n${body}\n)`;

  const indexes: SqliteTableDdl["indexes"] = [];
  const skippedIndexes: SqliteTableDdl["skippedIndexes"] = [];
  for (const index of [...config.indexes].sort((a, b) =>
    (a.config.name ?? "").localeCompare(b.config.name ?? ""),
  )) {
    const { name, method, unique, where } = index.config;
    if (!name) {
      throw new Error(`An index on "${config.name}" has no name`);
    }
    if (method && method !== "btree") {
      skippedIndexes.push({ name, reason: `${method} index` });
      continue;
    }
    const parts = index.config.columns.map((column) => {
      if (is(column, SQL)) {
        return `(${renderExpression(column)})`;
      }
      if (!isIndexedColumn(column)) {
        throw new Error(`Unsupported column in index "${name}"`);
      }
      const order = column.indexConfig?.order === "desc" ? " DESC" : "";
      return `${q(column.name as string)}${order}`;
    });
    const whereSql = where ? ` WHERE ${renderExpression(where)}` : "";
    indexes.push({
      name,
      sql: `CREATE ${unique ? "UNIQUE " : ""}INDEX ${q(name)} ON ${q(config.name)} (${parts.join(", ")})${whereSql}`,
    });
  }

  return {
    name: config.name,
    columns,
    columnForeignKeys,
    createTable,
    indexes,
    skippedIndexes,
  };
};

/** Every table of a schema module, sorted by name for a stable output. */
export const generateSqliteSchemaDdl = (
  schema: Record<string, unknown>,
): SqliteTableDdl[] =>
  Object.values(schema)
    .filter((value): value is PgTable => is(value, PgTable))
    .map(generateSqliteTableDdl)
    .sort((a, b) => a.name.localeCompare(b.name));

export const renderSqliteSchemaSql = (tables: SqliteTableDdl[]): string => {
  const statements: string[] = [];
  for (const table of tables) {
    statements.push(`${table.createTable};`);
    for (const index of table.indexes) {
      statements.push(`${index.sql};`);
    }
  }
  return `${statements.join("\n\n")}\n`;
};
