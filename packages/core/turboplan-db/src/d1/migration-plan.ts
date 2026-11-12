import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  applyD1Migrations,
  type D1Migration,
  diffSqliteSchemas,
  introspectSqliteSchema,
  type SqliteSchemaDiff,
  type SqliteSchemaInfo,
  splitSqlStatements,
} from "./migrations";
import {
  generateSqliteSchemaDdl,
  renderSqliteSchemaSql,
  type SqliteTableDdl,
} from "./schema-ddl";
import { createLocalSqliteTransport } from "./transports";

export const D1_MIGRATION_HEADER =
  "-- D1 (SQLite) schema migration. Generated from the pg-core schema by\n" +
  "-- `pnpm --filter @wildfires-org/turboplan-db d1:generate`; see\n" +
  '-- "Database providers" in CONFIGURATION.md.\n\n';

export const readD1Migrations = async (
  directory: string,
): Promise<D1Migration[]> => {
  const files = (await readdir(directory).catch(() => [] as string[]))
    .filter((file) => /^\d{4}_.+\.sql$/.test(file))
    .sort();
  return Promise.all(
    files.map(async (file) => ({
      name: file,
      sql: await readFile(join(directory, file), "utf8"),
    })),
  );
};

const schemaAfter = async (
  migrations: D1Migration[],
): Promise<SqliteSchemaInfo> => {
  const transport = createLocalSqliteTransport(":memory:");
  try {
    await applyD1Migrations(transport, migrations);
    return await introspectSqliteSchema(transport);
  } finally {
    await transport.close?.();
  }
};

export type D1MigrationPlan = {
  tables: SqliteTableDdl[];
  diff: SqliteSchemaDiff;
  /** The next migration's statements (empty when up to date). */
  statements: string[];
  /** Changes that need a hand-written migration (a table rebuild). */
  problems: string[];
};

// ALTER TABLE ADD COLUMN cannot add these.
const notAddableColumn = (definition: string): string | null => {
  if (/\bPRIMARY KEY\b/i.test(definition)) {
    return "a primary key column";
  }
  if (/\bDEFAULT \(/i.test(definition)) {
    return "a column with an expression default";
  }
  if (/\bNOT NULL\b/i.test(definition) && !/\bDEFAULT\b/i.test(definition)) {
    return "a NOT NULL column without a default";
  }
  return null;
};

/**
 * Compares the checked-in D1 migrations with the pg-core schema and plans the
 * migration that would bring them in line.
 */
export const planD1Migration = async (
  schema: Record<string, unknown>,
  existing: D1Migration[],
): Promise<D1MigrationPlan> => {
  const tables = generateSqliteSchemaDdl(schema);
  const desiredSql = renderSqliteSchemaSql(tables);
  const [current, desired] = await Promise.all([
    schemaAfter(existing),
    schemaAfter([{ name: "0000_desired.sql", sql: desiredSql }]),
  ]);
  const diff = diffSqliteSchemas(current, desired);
  const problems = [...diff.unsupported];
  const statements: string[] = [];
  const byName = new Map(tables.map((table) => [table.name, table]));
  const indexSql = new Map(
    tables.flatMap((table) => table.indexes.map((i) => [i.name, i.sql])),
  );

  for (const name of diff.droppedIndexes) {
    statements.push(`DROP INDEX IF EXISTS "${name}"`);
  }
  for (const name of diff.newTables) {
    const table = byName.get(name) as SqliteTableDdl;
    statements.push(table.createTable, ...table.indexes.map((i) => i.sql));
  }
  for (const { table, column } of diff.newColumns) {
    const ddl = byName.get(table) as SqliteTableDdl;
    const definition = ddl.columns[column] as string;
    const reason = notAddableColumn(definition);
    if (reason) {
      problems.push(`${table}.${column} is ${reason}, which SQLite cannot add`);
      continue;
    }
    // A single-column foreign key goes on the column itself; any other
    // constraint change on the table is reported by the diff.
    const foreignKey = ddl.columnForeignKeys[column];
    statements.push(
      `ALTER TABLE "${table}" ADD COLUMN ${definition}${foreignKey ? ` ${foreignKey}` : ""}`,
    );
  }
  for (const name of diff.newIndexes) {
    statements.push(indexSql.get(name) as string);
  }

  return { tables, diff, statements, problems };
};

export const renderD1Migration = (
  statements: string[],
  notes: string[] = [],
): string => {
  const noteLines = notes.map((note) => `-- ${note}\n`).join("");
  return `${D1_MIGRATION_HEADER}${noteLines ? `${noteLines}\n` : ""}${statements.map((statement) => `${statement};`).join("\n\n")}\n`;
};

export { splitSqlStatements };
