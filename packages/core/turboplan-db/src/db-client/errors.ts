/**
 * PostgreSQL error codes thrown by the `postgres` driver.
 * @see https://www.postgresql.org/docs/current/errcodes-appendix.html
 */
const PG_ERROR_CODE = {
  UNIQUE_VIOLATION: "23505",
} as const;

const hasPgCode = (error: unknown, code: string): boolean => {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as { code: unknown }).code === code
  );
};

/**
 * Check whether an error is a PostgreSQL unique-constraint violation.
 *
 * Since drizzle-orm 0.44, query failures are wrapped in `DrizzleQueryError`
 * with the driver error (postgres.js, which exposes `.code`) as `cause`, so
 * both the error and its cause are checked.
 */
export const isUniqueViolation = (error: unknown): boolean => {
  if (hasPgCode(error, PG_ERROR_CODE.UNIQUE_VIOLATION)) {
    return true;
  }
  return (
    error instanceof Error &&
    hasPgCode(error.cause, PG_ERROR_CODE.UNIQUE_VIOLATION)
  );
};
