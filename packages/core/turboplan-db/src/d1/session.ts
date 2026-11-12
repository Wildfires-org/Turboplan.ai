import {
  Column,
  DrizzleQueryError,
  entityKind,
  fillPlaceholders,
  getTableName,
  is,
  type Logger,
  NoopLogger,
  type Query,
  SQL,
  Subquery,
  type TablesRelationalConfig,
} from "drizzle-orm";
import {
  type PgDialect,
  PgPreparedQuery,
  type PgQueryResultHKT,
  PgSession,
  PgTransaction,
  type PgTransactionConfig,
  type PreparedQueryConfig,
  type SelectedFieldsOrdered,
} from "drizzle-orm/pg-core";

import { normalizeSqliteError } from "./errors";
import { inlineSqliteParams } from "./sql-rewrite";
import type { SqliteTransport } from "./transports";
import { fromSqliteValue, type SqliteValue, toSqliteParam } from "./values";

/** D1 rejects statements with more bound parameters than this. */
export const D1_MAX_BOUND_PARAMETERS = 100;

/** What `db.execute()` resolves to: row objects, plus the changed-row count. */
export type SqliteRowList = Record<string, unknown>[] & { count?: number };

export interface SqliteQueryResultHKT extends PgQueryResultHKT {
  type: SqliteRowList;
}

type RelationalSchema = {
  fullSchema: Record<string, unknown>;
  schema: TablesRelationalConfig;
  tableNamesMap: Record<string, string>;
};

/**
 * Binds parameters the way SQLite accepts them, inlines them when a statement
 * has more than D1 allows, and turns driver errors into Postgres-coded ones.
 */
export class SqliteExecutor {
  constructor(
    readonly transport: SqliteTransport,
    private readonly maxBoundParameters = D1_MAX_BOUND_PARAMETERS,
  ) {}

  private prepare(
    sql: string,
    params: unknown[],
  ): { sql: string; params: SqliteValue[] } {
    const bound = params.map(toSqliteParam);
    if (bound.length > this.maxBoundParameters) {
      return { sql: inlineSqliteParams(sql, bound), params: [] };
    }
    return { sql, params: bound };
  }

  async values(sql: string, params: unknown[]): Promise<unknown[][]> {
    const prepared = this.prepare(sql, params);
    try {
      return await this.transport.values(prepared.sql, prepared.params);
    } catch (error) {
      throw new DrizzleQueryError(sql, params, normalizeSqliteError(error));
    }
  }

  async objects(sql: string, params: unknown[]): Promise<SqliteRowList> {
    const prepared = this.prepare(sql, params);
    try {
      const result = await this.transport.objects(
        prepared.sql,
        prepared.params,
      );
      const rows: SqliteRowList = result.rows;
      rows.count = result.changes ?? result.rows.length;
      return rows;
    } catch (error) {
      throw new DrizzleQueryError(sql, params, normalizeSqliteError(error));
    }
  }
}

type Decoder = { mapFromDriverValue: (value: unknown) => unknown };

// How `mapResultRow` picks a field's decoder.
const decoderOf = (field: SelectedFieldsOrdered[number]["field"]): unknown => {
  if (is(field, Column)) {
    return field;
  }
  if (is(field, SQL)) {
    return (field as unknown as { decoder: Decoder }).decoder;
  }
  if (is(field, Subquery)) {
    return (field as unknown as { _: { sql: { decoder: Decoder } } })._.sql
      .decoder;
  }
  return (field as unknown as { sql: { decoder: Decoder } }).sql.decoder;
};

/**
 * Drizzle's `mapResultRow`, with each raw SQLite value first turned into what
 * postgres.js would have returned for the column decoding it.
 */
const mapSqliteResultRow = (
  fields: SelectedFieldsOrdered,
  row: unknown[],
  joinsNotNullableMap: Record<string, boolean> | undefined,
): Record<string, unknown> => {
  const nullifyMap: Record<string, string | false> = {};
  const result = fields.reduce<Record<string, unknown>>(
    (acc, { path, field }, columnIndex) => {
      const decoder = decoderOf(field);
      let node = acc;
      for (const [pathChunkIndex, pathChunk] of path.entries()) {
        if (pathChunkIndex < path.length - 1) {
          if (!(pathChunk in node)) {
            node[pathChunk] = {};
          }
          node = node[pathChunk] as Record<string, unknown>;
          continue;
        }
        const rawValue = row[columnIndex];
        const value = (node[pathChunk] =
          rawValue === null || rawValue === undefined
            ? null
            : (decoder as Decoder).mapFromDriverValue(
                is(decoder, Column)
                  ? fromSqliteValue(decoder, rawValue)
                  : rawValue,
              ));
        if (joinsNotNullableMap && is(field, Column) && path.length === 2) {
          const objectName = path[0] as string;
          if (!(objectName in nullifyMap)) {
            nullifyMap[objectName] =
              value === null ? getTableName(field.table) : false;
          } else if (
            typeof nullifyMap[objectName] === "string" &&
            nullifyMap[objectName] !== getTableName(field.table)
          ) {
            nullifyMap[objectName] = false;
          }
        }
      }
      return acc;
    },
    {},
  );

  if (joinsNotNullableMap && Object.keys(nullifyMap).length > 0) {
    for (const [objectName, tableName] of Object.entries(nullifyMap)) {
      if (typeof tableName === "string" && !joinsNotNullableMap[tableName]) {
        result[objectName] = null;
      }
    }
  }
  return result;
};

export class SqlitePreparedQuery<
  T extends PreparedQueryConfig,
> extends PgPreparedQuery<T> {
  static override readonly [entityKind]: string = "SqlitePreparedQuery";

  constructor(
    private readonly executor: SqliteExecutor,
    query: Query,
    private readonly logger: Logger,
    private readonly fields: SelectedFieldsOrdered | undefined,
    private readonly responseInArrayMode: boolean,
    private readonly customResultMapper?: (rows: unknown[][]) => T["execute"],
  ) {
    super(query, undefined, undefined, undefined);
  }

  async execute(
    placeholderValues: Record<string, unknown> = {},
  ): Promise<T["execute"]> {
    const params = fillPlaceholders(this.query.params, placeholderValues);
    this.logger.logQuery(this.query.sql, params);

    const { fields, customResultMapper } = this;
    if (!fields && !customResultMapper) {
      return this.executor.objects(this.query.sql, params);
    }

    const rows = await this.executor.values(this.query.sql, params);
    if (customResultMapper) {
      return customResultMapper(rows);
    }
    // Set by the select builder after `prepareQuery` (drizzle-internal).
    const { joinsNotNullableMap } = this as unknown as {
      joinsNotNullableMap?: Record<string, boolean>;
    };
    return rows.map((row) =>
      mapSqliteResultRow(
        fields as SelectedFieldsOrdered,
        row,
        joinsNotNullableMap,
      ),
    ) as T["execute"];
  }

  async all(placeholderValues: Record<string, unknown> = {}) {
    const params = fillPlaceholders(this.query.params, placeholderValues);
    this.logger.logQuery(this.query.sql, params);
    return this.executor.objects(this.query.sql, params);
  }

  isResponseInArrayMode(): boolean {
    return this.responseInArrayMode;
  }
}

export class SqliteSession<
  TFullSchema extends Record<string, unknown>,
  TSchema extends TablesRelationalConfig,
> extends PgSession<SqliteQueryResultHKT, TFullSchema, TSchema> {
  static override readonly [entityKind]: string = "SqliteSession";

  private readonly logger: Logger;

  constructor(
    readonly executor: SqliteExecutor,
    readonly sqliteDialect: PgDialect,
    readonly relationalSchema: RelationalSchema | undefined,
    options: { logger?: Logger } = {},
  ) {
    super(sqliteDialect);
    this.logger = options.logger ?? new NoopLogger();
  }

  prepareQuery<T extends PreparedQueryConfig = PreparedQueryConfig>(
    query: Query,
    fields: SelectedFieldsOrdered | undefined,
    _name: string | undefined,
    isResponseInArrayMode: boolean,
    customResultMapper?: (rows: unknown[][]) => T["execute"],
  ): PgPreparedQuery<T> {
    return new SqlitePreparedQuery<T>(
      this.executor,
      query,
      this.logger,
      fields,
      isResponseInArrayMode,
      customResultMapper,
    );
  }

  /**
   * D1 has no interactive transactions, so the callback's statements run in
   * order on the same database, each one atomic on its own but **not** as a
   * group: a failure part-way leaves the earlier writes in place, and
   * `tx.rollback()` only throws. Isolation settings are ignored.
   */
  async transaction<T>(
    transaction: (
      tx: PgTransaction<SqliteQueryResultHKT, TFullSchema, TSchema>,
    ) => Promise<T>,
    _config?: PgTransactionConfig,
  ): Promise<T> {
    return transaction(
      new SqliteTransaction<TFullSchema, TSchema>(
        this.sqliteDialect,
        this,
        this.relationalSchema as RelationalSchema & { schema: TSchema },
      ),
    );
  }
}

export class SqliteTransaction<
  TFullSchema extends Record<string, unknown>,
  TSchema extends TablesRelationalConfig,
> extends PgTransaction<SqliteQueryResultHKT, TFullSchema, TSchema> {
  static override readonly [entityKind]: string = "SqliteTransaction";

  constructor(
    private readonly sqliteDialect: PgDialect,
    private readonly sqliteSession: SqliteSession<TFullSchema, TSchema>,
    relationalSchema: (RelationalSchema & { schema: TSchema }) | undefined,
    nestedIndex = 0,
  ) {
    super(sqliteDialect, sqliteSession, relationalSchema, nestedIndex);
  }

  override async setTransaction(_config: PgTransactionConfig): Promise<void> {}

  async transaction<T>(
    transaction: (
      tx: PgTransaction<SqliteQueryResultHKT, TFullSchema, TSchema>,
    ) => Promise<T>,
  ): Promise<T> {
    return transaction(
      new SqliteTransaction<TFullSchema, TSchema>(
        this.sqliteDialect,
        this.sqliteSession,
        this.schema as RelationalSchema & { schema: TSchema },
        this.nestedIndex + 1,
      ),
    );
  }
}
