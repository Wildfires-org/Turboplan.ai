import type { Config } from "drizzle-kit";

/**
 * Creates a Drizzle config for the turboplan-db package.
 * This is meant to be imported by the Next.js app's drizzle.config.ts
 * where environment variables are properly loaded.
 *
 * Uses relative paths from the app directory to the centralized
 * turboplan-db package schemas and migrations.
 *
 * @param postgresUrl - Database connection URL
 * @returns Drizzle config object
 */
export const createDrizzleConfig = (postgresUrl: string): Config => ({
  schema: "../../packages/core/turboplan-db/src/schemas/index.ts",
  out: "../../packages/core/turboplan-db/src/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: postgresUrl,
  },
  extensionsFilters: ["postgis"],
});

// IMPORTANT: All database operations should be run from apps/turboplan where env vars are properly loaded.
