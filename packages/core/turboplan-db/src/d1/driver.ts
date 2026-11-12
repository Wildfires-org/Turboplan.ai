import {
  createTableRelationsHelpers,
  DefaultLogger,
  type ExtractTablesWithRelations,
  entityKind,
  extractTablesRelationalConfig,
  type Logger,
} from "drizzle-orm";
import { PgDatabase } from "drizzle-orm/pg-core";

import { SqlitePgDialect } from "./dialect";
import {
  SqliteExecutor,
  type SqliteQueryResultHKT,
  SqliteSession,
} from "./session";
import type { SqliteTransport } from "./transports";

export class SqlitePgDatabase<
  TSchema extends Record<string, unknown>,
> extends PgDatabase<
  SqliteQueryResultHKT,
  TSchema,
  ExtractTablesWithRelations<TSchema>
> {
  static override readonly [entityKind]: string = "SqlitePgDatabase";
  declare $client: SqliteTransport;
}

export type SqliteDrizzleConfig<TSchema extends Record<string, unknown>> = {
  schema?: TSchema;
  logger?: boolean | Logger;
  /** Statements with more parameters are sent with them inlined (D1: 100). */
  maxBoundParameters?: number;
};

/**
 * A drizzle Postgres database (`PgDatabase`, the same API and types every
 * service is written against) that runs on SQLite through `transport`.
 */
export const drizzleSqlite = <TSchema extends Record<string, unknown>>(
  transport: SqliteTransport,
  config: SqliteDrizzleConfig<TSchema> = {},
): SqlitePgDatabase<TSchema> => {
  const dialect = new SqlitePgDialect();
  const logger =
    config.logger === true
      ? new DefaultLogger()
      : config.logger === false
        ? undefined
        : config.logger;

  let relationalSchema:
    | {
        fullSchema: Record<string, unknown>;
        schema: ExtractTablesWithRelations<TSchema>;
        tableNamesMap: Record<string, string>;
      }
    | undefined;
  if (config.schema) {
    const tablesConfig = extractTablesRelationalConfig(
      config.schema,
      createTableRelationsHelpers,
    );
    relationalSchema = {
      fullSchema: config.schema,
      schema: tablesConfig.tables as ExtractTablesWithRelations<TSchema>,
      tableNamesMap: tablesConfig.tableNamesMap,
    };
  }

  const session = new SqliteSession<
    TSchema,
    ExtractTablesWithRelations<TSchema>
  >(
    new SqliteExecutor(transport, config.maxBoundParameters),
    dialect,
    relationalSchema,
    { logger },
  );
  const db = new SqlitePgDatabase<TSchema>(dialect, session, relationalSchema);
  db.$client = transport;
  return db;
};
