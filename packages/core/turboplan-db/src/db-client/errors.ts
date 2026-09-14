/**
 * PostgreSQL error codes thrown by the `postgres` driver.
 * @see https://www.postgresql.org/docs/current/errcodes-appendix.html
 */
const PG_ERROR_CODE = {
  UNIQUE_VIOLATION: "23505",
} as const;

/**
 * Check whether an error is a PostgreSQL unique-constraint violation.
 * Works with the `postgres` (postgres.js) driver which exposes a `.code` property.
 */
export const isUniqueViolation = (error: unknown): boolean => {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as { code: string }).code === PG_ERROR_CODE.UNIQUE_VIOLATION
  );
};
