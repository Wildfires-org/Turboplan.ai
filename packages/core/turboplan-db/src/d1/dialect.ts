import {
  aliasedTable,
  aliasedTableColumn,
  and,
  type BuildRelationalQueryResult,
  Column,
  type DBQueryConfig,
  DrizzleError,
  entityKind,
  eq,
  getOperators,
  getOrderByOperators,
  getTableColumns,
  getTableUniqueName,
  is,
  Many,
  mapColumnsInAliasedSQLToAlias,
  mapColumnsInSQLToAlias,
  normalizeRelation,
  One,
  Param,
  type Placeholder,
  type QueryWithTypings,
  type Relation,
  SQL,
  Subquery,
  sql,
  type TableRelationalConfig,
  type TablesRelationalConfig,
} from "drizzle-orm";
import {
  type PgColumn,
  PgDialect,
  type PgInsertConfig,
  type PgSelectConfig,
  PgTable,
} from "drizzle-orm/pg-core";

import { getSqliteColumnDefault } from "./column-defaults";
import { rewritePgSqlForSqlite } from "./sql-rewrite";
import { fromSqliteValue } from "./values";

type SelectionItem = BuildRelationalQueryResult<
  PgTable,
  PgColumn
>["selection"][number];

const columnDecoders = new WeakMap<Column, SQL>();

/**
 * A stand-in selection field whose decoder converts the raw SQLite value
 * before the column's own decoder runs (relational rows are decoded by
 * drizzle's `mapRelationalRow`, which only consults `field.decoder`).
 */
const sqliteColumnDecoder = (column: Column): SQL => {
  let decoder = columnDecoders.get(column);
  if (!decoder) {
    decoder = sql``.mapWith((value: unknown) =>
      column.mapFromDriverValue(fromSqliteValue(column, value)),
    );
    columnDecoders.set(column, decoder);
  }
  return decoder;
};

const withSqliteDecoders = (selection: SelectionItem[]): SelectionItem[] =>
  selection.map((item) =>
    !item.isJson && is(item.field, Column)
      ? { ...item, field: sqliteColumnDecoder(item.field) }
      : item,
  );

/**
 * Drizzle's Postgres dialect, emitting SQL that SQLite (D1) runs. Every query
 * builder keeps its Postgres API and types; only the generated SQL changes:
 *
 * - parameters are `?N`;
 * - inserts spell out column defaults (`now()`, `gen_random_uuid()`, literals)
 *   as values instead of the `default` keyword SQLite lacks in VALUES lists;
 * - `for update` and other locking clauses are dropped (D1 has one writer);
 * - set operations drop the parentheses SQLite rejects;
 * - relational queries use correlated subqueries with `json_array` /
 *   `json_group_array`, ported from drizzle's SQLite dialect, instead of
 *   `left join lateral` with `json_agg`;
 * - casts, `ilike` and `now()` are rewritten token by token
 *   (see `rewritePgSqlForSqlite`).
 */
export class SqlitePgDialect extends PgDialect {
  static override readonly [entityKind]: string = "SqlitePgDialect";

  override escapeParam(num: number): string {
    return `?${num + 1}`;
  }

  override sqlToQuery(
    fragment: SQL,
    invokeSource?: "indexes" | undefined,
  ): QueryWithTypings {
    const query = super.sqlToQuery(fragment, invokeSource);
    return { ...query, sql: rewritePgSqlForSqlite(query.sql) };
  }

  override buildInsertQuery(config: PgInsertConfig): SQL {
    if (config.select) {
      return super.buildInsertQuery(config);
    }
    const columns = Object.entries(getTableColumns(config.table));
    const values = (config.values as Record<string, Param | SQL>[]).map(
      (row) => {
        const filled: Record<string, Param | SQL> = { ...row };
        for (const [key, column] of columns) {
          // Generated / identity columns (drizzle-internal check).
          if (
            (
              column as unknown as { shouldDisableInsert: () => boolean }
            ).shouldDisableInsert()
          ) {
            continue;
          }
          const value = filled[key];
          const missing =
            value === undefined ||
            (is(value, Param) && value.value === undefined);
          // Postgres would emit `default` here; the base dialect keeps
          // handling `$defaultFn` / `$onUpdate` itself.
          if (
            !missing ||
            column.defaultFn !== undefined ||
            (!column.default && column.onUpdateFn !== undefined)
          ) {
            continue;
          }
          filled[key] = sqliteInsertDefault(column as PgColumn);
        }
        return filled;
      },
    );
    return super.buildInsertQuery({
      ...config,
      values: values as PgInsertConfig["values"],
    });
  }

  override buildSelectQuery(config: PgSelectConfig): SQL {
    if (config.distinct && config.distinct !== true) {
      throw new DrizzleError({
        message: "`select distinct on` is not supported on D1",
      });
    }
    return super.buildSelectQuery({ ...config, lockingClause: undefined });
  }

  override buildSetOperationQuery({
    leftSelect,
    setOperator: { type, isAll, rightSelect, limit, orderBy, offset },
  }: Parameters<PgDialect["buildSetOperationQuery"]>[0]): SQL {
    // SQLite rejects `(select …) union (select …)`; selecting from each side
    // as a subquery keeps their own limit / order by valid.
    const leftChunk = sql`select * from (${leftSelect.getSQL()}) `;
    const rightChunk = sql`select * from (${rightSelect.getSQL()})`;
    const operatorChunk = sql.raw(`${type} ${isAll ? "all " : ""}`);
    const orderBySql =
      orderBy && orderBy.length > 0
        ? sql` order by ${sql.join(
            orderBy.map((value) =>
              is(value, Column)
                ? sql.identifier(value.name)
                : sql`${value as SQL}`,
            ),
            sql`, `,
          )}`
        : undefined;
    const limitSql =
      typeof limit === "object" || (typeof limit === "number" && limit >= 0)
        ? sql` limit ${limit}`
        : undefined;
    const offsetSql = offset ? sql` offset ${offset}` : undefined;
    return sql`${leftChunk}${operatorChunk}${rightChunk}${orderBySql}${limitSql}${offsetSql}`;
  }

  override buildRelationalQueryWithoutPK({
    fullSchema,
    schema,
    tableNamesMap,
    table,
    tableConfig,
    queryConfig: config,
    tableAlias,
    nestedQueryRelation,
    joinOn,
  }: {
    fullSchema: Record<string, unknown>;
    schema: TablesRelationalConfig;
    tableNamesMap: Record<string, string>;
    table: PgTable;
    tableConfig: TableRelationalConfig;
    queryConfig: true | DBQueryConfig<"many", true>;
    tableAlias: string;
    nestedQueryRelation?: Relation;
    joinOn?: SQL;
  }): BuildRelationalQueryResult<PgTable, PgColumn> {
    let selection: SelectionItem[] = [];
    let limit: number | Placeholder | undefined;
    let offset: number | Placeholder | undefined;
    let orderBy: (PgColumn | SQL | SQL.Aliased)[] | undefined = [];
    let where: SQL | undefined;

    if (config === true) {
      selection = Object.entries(tableConfig.columns).map(([key, value]) => ({
        dbKey: value.name,
        tsKey: key,
        field: aliasedTableColumn(value as PgColumn, tableAlias),
        relationTableTsKey: undefined,
        isJson: false,
        selection: [],
      }));
    } else {
      const aliasedColumns = Object.fromEntries(
        Object.entries(tableConfig.columns).map(([key, value]) => [
          key,
          aliasedTableColumn(value, tableAlias),
        ]),
      );

      if (config.where) {
        const whereSql =
          typeof config.where === "function"
            ? config.where(aliasedColumns, getOperators())
            : config.where;
        where = whereSql && mapColumnsInSQLToAlias(whereSql, tableAlias);
      }

      const fieldsSelection: {
        tsKey: string;
        value: PgColumn | SQL.Aliased;
      }[] = [];
      let selectedColumns: string[] = [];

      if (config.columns) {
        let isIncludeMode = false;
        for (const [field, value] of Object.entries(config.columns)) {
          if (value === undefined) {
            continue;
          }
          if (field in tableConfig.columns) {
            if (!isIncludeMode && value === true) {
              isIncludeMode = true;
            }
            selectedColumns.push(field);
          }
        }
        if (selectedColumns.length > 0) {
          selectedColumns = isIncludeMode
            ? selectedColumns.filter((c) => config.columns?.[c] === true)
            : Object.keys(tableConfig.columns).filter(
                (key) => !selectedColumns.includes(key),
              );
        }
      } else {
        selectedColumns = Object.keys(tableConfig.columns);
      }

      for (const field of selectedColumns) {
        const column = tableConfig.columns[field] as PgColumn;
        fieldsSelection.push({ tsKey: field, value: column });
      }

      let selectedRelations: {
        tsKey: string;
        queryConfig: true | DBQueryConfig<"many", false>;
        relation: Relation;
      }[] = [];
      if (config.with) {
        selectedRelations = Object.entries(config.with)
          .filter(
            (entry): entry is [string, true | DBQueryConfig<"many", false>] =>
              !!entry[1],
          )
          .map(([tsKey, queryConfig]) => ({
            tsKey,
            queryConfig,
            relation: tableConfig.relations[tsKey] as Relation,
          }));
      }

      if (config.extras) {
        const extras =
          typeof config.extras === "function"
            ? config.extras(aliasedColumns, { sql })
            : config.extras;
        for (const [tsKey, value] of Object.entries(extras)) {
          fieldsSelection.push({
            tsKey,
            value: mapColumnsInAliasedSQLToAlias(value, tableAlias),
          });
        }
      }

      for (const { tsKey, value } of fieldsSelection) {
        selection.push({
          dbKey: is(value, SQL.Aliased)
            ? value.fieldAlias
            : (tableConfig.columns[tsKey] as PgColumn).name,
          tsKey,
          field: is(value, Column)
            ? aliasedTableColumn(value, tableAlias)
            : value,
          relationTableTsKey: undefined,
          isJson: false,
          selection: [],
        });
      }

      let orderByOrig =
        typeof config.orderBy === "function"
          ? config.orderBy(aliasedColumns, getOrderByOperators())
          : (config.orderBy ?? []);
      if (!Array.isArray(orderByOrig)) {
        orderByOrig = [orderByOrig];
      }
      orderBy = orderByOrig.map((orderByValue) => {
        if (is(orderByValue, Column)) {
          return aliasedTableColumn(orderByValue, tableAlias) as PgColumn;
        }
        return mapColumnsInSQLToAlias(orderByValue, tableAlias);
      });

      limit = config.limit;
      offset = config.offset;

      for (const {
        tsKey: selectedRelationTsKey,
        queryConfig: selectedRelationConfigValue,
        relation,
      } of selectedRelations) {
        const normalizedRelation = normalizeRelation(
          schema,
          tableNamesMap,
          relation,
        );
        const relationTableName = getTableUniqueName(relation.referencedTable);
        const relationTableTsName = tableNamesMap[relationTableName] as string;
        const relationTableAlias = `${tableAlias}_${selectedRelationTsKey}`;
        const relationJoinOn = and(
          ...normalizedRelation.fields.map((field, i) =>
            eq(
              aliasedTableColumn(
                normalizedRelation.references[i] as PgColumn,
                relationTableAlias,
              ),
              aliasedTableColumn(field, tableAlias),
            ),
          ),
        );
        const builtRelation = this.buildRelationalQueryWithoutPK({
          fullSchema,
          schema,
          tableNamesMap,
          table: fullSchema[relationTableTsName] as PgTable,
          tableConfig: schema[relationTableTsName] as TableRelationalConfig,
          queryConfig: is(relation, One)
            ? selectedRelationConfigValue === true
              ? { limit: 1 }
              : { ...selectedRelationConfigValue, limit: 1 }
            : selectedRelationConfigValue,
          tableAlias: relationTableAlias,
          joinOn: relationJoinOn,
          nestedQueryRelation: relation,
        });
        selection.push({
          dbKey: selectedRelationTsKey,
          tsKey: selectedRelationTsKey,
          field: sql`(${builtRelation.sql})`.as(selectedRelationTsKey),
          relationTableTsKey: relationTableTsName,
          isJson: true,
          selection: builtRelation.selection,
        });
      }
    }

    if (selection.length === 0) {
      throw new DrizzleError({
        message: `No fields selected for table "${tableConfig.tsName}" ("${tableAlias}")`,
      });
    }

    let result: SQL;
    where = and(joinOn, where);

    if (nestedQueryRelation) {
      let field = sql`json_array(${sql.join(
        selection.map(({ field: itemField }) =>
          is(itemField, Column)
            ? sql.identifier(itemField.name)
            : is(itemField, SQL.Aliased)
              ? itemField.sql
              : (itemField as SQL),
        ),
        sql`, `,
      )})`;
      if (is(nestedQueryRelation, Many)) {
        field = sql`coalesce(json_group_array(${field}), json_array())`;
      }
      const nestedField = field.as("data");

      const needsSubquery =
        limit !== undefined ||
        offset !== undefined ||
        (orderBy?.length ?? 0) > 0;
      let from: PgTable | Subquery = aliasedTable(table, tableAlias);
      if (needsSubquery) {
        const inner = this.buildSelectQuery({
          table: aliasedTable(table, tableAlias),
          fields: {},
          fieldsFlat: [{ path: [], field: sql.raw("*") }],
          where,
          limit,
          offset,
          orderBy: orderBy as PgSelectConfig["orderBy"],
          setOperators: [],
        });
        from = new Subquery(inner, {}, tableAlias);
        where = undefined;
        limit = undefined;
        offset = undefined;
        orderBy = undefined;
      }

      result = this.buildSelectQuery({
        table: is(from, PgTable) ? from : (from as Subquery),
        fields: {},
        fieldsFlat: [{ path: [], field: nestedField }],
        where,
        limit,
        offset,
        orderBy: orderBy as PgSelectConfig["orderBy"],
        setOperators: [],
      });
    } else {
      result = this.buildSelectQuery({
        table: aliasedTable(table, tableAlias),
        fields: {},
        fieldsFlat: selection.map(({ field }) => ({
          path: [],
          field: is(field, Column)
            ? aliasedTableColumn(field as PgColumn, tableAlias)
            : field,
        })),
        where,
        limit,
        offset,
        orderBy: orderBy as PgSelectConfig["orderBy"],
        setOperators: [],
      });
    }

    return {
      tableTsKey: tableConfig.tsName,
      sql: result,
      selection: withSqliteDecoders(selection),
    };
  }
}

const sqliteInsertDefault = (column: PgColumn): Param | SQL => {
  const resolved = getSqliteColumnDefault(column);
  if (!resolved) {
    return sql`null`;
  }
  if (resolved.kind === "now") {
    return new Param(new Date(), column);
  }
  if (resolved.kind === "uuid") {
    return new Param(globalThis.crypto.randomUUID(), column);
  }
  return new Param(resolved.value, column);
};
