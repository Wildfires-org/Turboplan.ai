/**
 * Turns the SQL that drizzle's Postgres dialect (and our raw `sql` fragments)
 * produce into SQLite that D1 accepts. Only token-level differences live here;
 * structural ones (inserts, locking, relational queries) are handled by
 * `SqlitePgDialect`, and the few Postgres-only expressions by the helpers in
 * `db-client/dialect-helpers.ts`.
 *
 * The rewriter tokenizes, so string literals, quoted identifiers and comments
 * are never touched.
 */

import type { SqliteValue } from "./values";

type Token = {
  type:
    | "space"
    | "string"
    | "identifier"
    | "comment"
    | "param"
    | "word"
    | "number"
    | "cast"
    | "symbol";
  text: string;
};

const isWordStart = (char: string): boolean => /[A-Za-z_]/.test(char);
const isWordChar = (char: string): boolean => /[A-Za-z0-9_$]/.test(char);
const isDigit = (char: string): boolean => char >= "0" && char <= "9";

/** Reads a quoted run ('…' or "…") where a doubled quote escapes itself. */
const readQuoted = (sql: string, start: number, quote: string): number => {
  let i = start + 1;
  while (i < sql.length) {
    if (sql[i] === quote) {
      if (sql[i + 1] === quote) {
        i += 2;
        continue;
      }
      return i + 1;
    }
    i += 1;
  }
  return sql.length;
};

export const tokenizeSql = (sql: string): Token[] => {
  const tokens: Token[] = [];
  let i = 0;
  while (i < sql.length) {
    const char = sql[i] as string;
    let end = i + 1;
    let type: Token["type"] = "symbol";

    if (/\s/.test(char)) {
      while (end < sql.length && /\s/.test(sql[end] as string)) {
        end += 1;
      }
      type = "space";
    } else if (char === "'") {
      end = readQuoted(sql, i, "'");
      type = "string";
    } else if (char === '"') {
      end = readQuoted(sql, i, '"');
      type = "identifier";
    } else if (char === "-" && sql[i + 1] === "-") {
      const newline = sql.indexOf("\n", i);
      end = newline === -1 ? sql.length : newline;
      type = "comment";
    } else if (char === "/" && sql[i + 1] === "*") {
      const close = sql.indexOf("*/", i + 2);
      end = close === -1 ? sql.length : close + 2;
      type = "comment";
    } else if (char === "?") {
      while (end < sql.length && isDigit(sql[end] as string)) {
        end += 1;
      }
      type = "param";
    } else if (char === ":" && sql[i + 1] === ":") {
      end = i + 2;
      type = "cast";
    } else if (isWordStart(char)) {
      while (end < sql.length && isWordChar(sql[end] as string)) {
        end += 1;
      }
      type = "word";
    } else if (isDigit(char)) {
      while (end < sql.length && /[0-9.eE]/.test(sql[end] as string)) {
        end += 1;
      }
      type = "number";
    }

    tokens.push({ type, text: sql.slice(i, end) });
    i = end;
  }
  return tokens;
};

const nextSignificant = (tokens: Token[], from: number): number => {
  let i = from;
  while (
    i < tokens.length &&
    (tokens[i]?.type === "space" || tokens[i]?.type === "comment")
  ) {
    i += 1;
  }
  return i;
};

const lower = (token: Token | undefined): string =>
  token?.type === "word" ? token.text.toLowerCase() : "";

// Multi-word Postgres type names a cast may use.
const TYPE_CONTINUATIONS: Record<string, string[][]> = {
  timestamp: [
    ["with", "time", "zone"],
    ["without", "time", "zone"],
  ],
  time: [
    ["with", "time", "zone"],
    ["without", "time", "zone"],
  ],
  double: [["precision"]],
  character: [["varying"]],
};

/**
 * Index just past a Postgres cast's type (`int`, `varchar(10)`, `text[]`,
 * `timestamp with time zone`), starting at the first type word.
 */
const skipCastType = (tokens: Token[], start: number): number => {
  let i = start;
  const first = lower(tokens[i]);
  if (!first) {
    return start;
  }
  i += 1;

  for (const continuation of TYPE_CONTINUATIONS[first] ?? []) {
    let j = i;
    let matched = true;
    for (const word of continuation) {
      j = nextSignificant(tokens, j);
      if (lower(tokens[j]) !== word) {
        matched = false;
        break;
      }
      j += 1;
    }
    if (matched) {
      i = j;
      break;
    }
  }

  // Precision / length: `(10)` or `(12, 6)`.
  if (tokens[i]?.text === "(") {
    let depth = 0;
    while (i < tokens.length) {
      const text = tokens[i]?.text;
      if (text === "(") {
        depth += 1;
      } else if (text === ")") {
        depth -= 1;
        if (depth === 0) {
          i += 1;
          break;
        }
      }
      i += 1;
    }
  }

  // Array suffixes: `[]`.
  while (tokens[i]?.text === "[" && tokens[i + 1]?.text === "]") {
    i += 2;
  }
  return i;
};

export const SQLITE_NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

/**
 * Rewrites Postgres-only tokens:
 * - `x::type` casts are dropped (SQLite values carry their own type);
 * - `ilike` becomes `like` (case-insensitive for ASCII in SQLite), and a
 *   `like`/`ilike` whose pattern is a single parameter gets `escape '\'`, the
 *   escape character Postgres uses by default;
 * - `now()` becomes an ISO-8601 UTC timestamp, the format timestamps are
 *   stored in.
 */
export const rewritePgSqlForSqlite = (sql: string): string => {
  const tokens = tokenizeSql(sql);
  const out: string[] = [];

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i] as Token;

    if (token.type === "cast") {
      i = skipCastType(tokens, nextSignificant(tokens, i + 1)) - 1;
      continue;
    }

    if (token.type !== "word") {
      out.push(token.text);
      continue;
    }

    const word = token.text.toLowerCase();

    if (word === "ilike" || word === "like") {
      out.push("like");
      const operand = nextSignificant(tokens, i + 1);
      const afterOperand = nextSignificant(tokens, operand + 1);
      if (
        tokens[operand]?.type === "param" &&
        lower(tokens[afterOperand]) !== "escape"
      ) {
        for (let j = i + 1; j <= operand; j += 1) {
          out.push(tokens[j]?.text ?? "");
        }
        out.push(" escape '\\'");
        i = operand;
      }
      continue;
    }

    if (word === "now") {
      const open = nextSignificant(tokens, i + 1);
      const close = nextSignificant(tokens, open + 1);
      if (tokens[open]?.text === "(" && tokens[close]?.text === ")") {
        out.push(SQLITE_NOW);
        i = close;
        continue;
      }
    }

    out.push(token.text);
  }

  return out.join("");
};

/** A value as a SQLite literal, for statements that cannot bind it. */
export const toSqliteLiteral = (value: SqliteValue): string => {
  if (value === null) {
    return "NULL";
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return "NULL";
    }
    return String(value);
  }
  if (typeof value === "string") {
    return `'${value.replace(/'/g, "''")}'`;
  }
  const hex = Array.from(value, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `X'${hex}'`;
};

/**
 * Replaces every `?N` placeholder with its value as a literal. D1 caps a
 * statement at 100 bound parameters, so a large multi-row insert or a long
 * `in (…)` list is sent with its values inlined instead.
 */
export const inlineSqliteParams = (
  sql: string,
  params: SqliteValue[],
): string => {
  let anonymousIndex = 0;
  return tokenizeSql(sql)
    .map((token) => {
      if (token.type !== "param") {
        return token.text;
      }
      const index =
        token.text.length > 1
          ? Number(token.text.slice(1)) - 1
          : anonymousIndex++;
      if (index < 0 || index >= params.length) {
        throw new Error(`SQL parameter ${token.text} has no value`);
      }
      return toSqliteLiteral(params[index] as SqliteValue);
    })
    .join("");
};
