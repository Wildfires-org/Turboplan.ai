/**
 * The few query expressions that Postgres and SQLite (D1) spell differently.
 * Each helper returns exactly the SQL the call site used before on Postgres,
 * and an equivalent for D1.
 */

import { type SQL, type SQLWrapper, sql } from "drizzle-orm";

import { getDbProvider } from "@wildfires-org/turboplan-env";

/** True when the deployment runs on D1 (`DB_PROVIDER=d1`). */
export const isSqliteDb = (): boolean => getDbProvider() === "d1";

type JsonScalar = string | number | boolean;

/**
 * Whether a json/jsonb array column contains `element` — a scalar, or an
 * object matched by the listed keys. Postgres: `col::jsonb @> '[element]'`.
 */
export const jsonArrayContains = (
  column: SQLWrapper,
  element: JsonScalar | Record<string, JsonScalar | null>,
): SQL => {
  if (!isSqliteDb()) {
    return sql`${column}::jsonb @> ${JSON.stringify([element])}::jsonb`;
  }
  if (typeof element !== "object") {
    return sql`exists (select 1 from json_each(${column}) as je where je.value = ${element})`;
  }
  const conditions = Object.entries(element).map(([key, value]) => {
    const path = `$."${key.replace(/"/g, '\\"')}"`;
    return value === null
      ? sql`json_type(je.value, ${path}) = 'null'`
      : sql`json_extract(je.value, ${path}) = ${value}`;
  });
  return sql`exists (select 1 from json_each(${column}) as je where json_type(je.value) = 'object' and ${sql.join(conditions, sql` and `)})`;
};

/**
 * D1's stand-in for pg_trgm's `word_similarity` ranking: a case-insensitive
 * substring score per text (1 exact, 0.9 prefix, 0.8 word prefix, 0.6
 * anywhere, 0 otherwise) times its weight, highest wins. No typo tolerance.
 */
export const substringMatchRank = (
  query: string,
  weightedTexts: Array<[text: SQLWrapper, weight: number]>,
): SQL<number> => {
  const needle = query.trim().toLowerCase();
  const scores = weightedTexts.map(([text, weight]) => {
    const haystack = sql`lower(coalesce(${text}, ''))`;
    return sql`(case
      when ${haystack} = ${needle} then 1.0
      when instr(${haystack}, ${needle}) = 1 then 0.9
      when instr(' ' || ${haystack}, ${` ${needle}`}) > 0 then 0.8
      when instr(${haystack}, ${needle}) > 0 then 0.6
      else 0.0 end) * ${weight}`;
  });
  if (scores.length === 1) {
    return scores[0] as SQL<number>;
  }
  // SQLite's multi-argument max() is the scalar greatest().
  return sql<number>`max(${sql.join(scores, sql`, `)})`;
};
