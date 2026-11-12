/**
 * SQLite reports constraint failures as messages ("UNIQUE constraint failed:
 * user.email"); D1 prefixes them ("D1_ERROR: …: SQLITE_CONSTRAINT"). The app
 * recognises Postgres SQLSTATE codes (`isUniqueViolation` checks 23505), so a
 * failure is re-thrown with the matching code and the original as `cause`.
 */

const SQLSTATE_BY_MESSAGE: Array<[RegExp, string]> = [
  [/UNIQUE constraint failed|PRIMARY KEY constraint failed/i, "23505"],
  [/FOREIGN KEY constraint failed/i, "23503"],
  [/NOT NULL constraint failed/i, "23502"],
  [/CHECK constraint failed/i, "23514"],
];

export class SqliteDriverError extends Error {
  readonly code: string | undefined;

  constructor(message: string, code: string | undefined, cause: unknown) {
    super(message, { cause });
    this.name = "SqliteDriverError";
    this.code = code;
  }
}

const messageOf = (error: unknown): string => {
  if (error instanceof Error) {
    const cause =
      error.cause instanceof Error ? ` (${error.cause.message})` : "";
    return `${error.message}${cause}`;
  }
  return String(error);
};

export const normalizeSqliteError = (error: unknown): SqliteDriverError => {
  if (error instanceof SqliteDriverError) {
    return error;
  }
  const message = messageOf(error);
  const code = SQLSTATE_BY_MESSAGE.find(([pattern]) =>
    pattern.test(message),
  )?.[1];
  return new SqliteDriverError(message, code, error);
};
