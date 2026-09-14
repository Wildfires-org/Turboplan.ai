import { execSync } from "node:child_process";
import { sql } from "drizzle-orm";

import { createTestDB } from "@wildfires-org/turboplan-db/db-client";
import { getCommonEnv, resetEnvCache } from "@wildfires-org/turboplan-env";

import { clearDatabase, isDbClearEnabled } from "./utils/clear-database";

/**
 * Global setup runs once before all tests.
 * 1. Validates NODE_ENV=test and TEST_POSTGRES_URL are set (fail-fast safety check)
 * 2. Clears database (unless E2E_SKIP_DB_CLEAR=true)
 * 3. Ensures required extensions are installed (pg_trgm for search, PostGIS for maps)
 * 4. Runs database schema push to ensure schema is up-to-date
 */
const globalSetup = async (): Promise<void> => {
  console.log("🔧 E2E Global Setup: Starting...");

  // Early guard: Ensure NODE_ENV=test is set
  if (process.env.NODE_ENV !== "test") {
    throw new Error(
      `E2E tests require NODE_ENV=test, but got "${process.env.NODE_ENV}".\n` +
        "Ensure NODE_ENV=test is set in your e2e/.env file or environment.",
    );
  }

  // Early guard: Ensure TEST_POSTGRES_URL is set before any database operations
  if (!process.env.TEST_POSTGRES_URL) {
    throw new Error(
      "E2E tests require TEST_POSTGRES_URL environment variable.\n" +
        "This must be a PostgreSQL URL pointing to a dedicated test database.",
    );
  }

  // Reset environment cache to ensure fresh environment variables
  resetEnvCache();
  console.log("✓ Environment cache reset");

  // Get environment variables
  const ENV = getCommonEnv();
  const testDbUrl = ENV.TEST_POSTGRES_URL!;

  // Clear database before migrations (unless E2E_SKIP_DB_CLEAR=true)
  // This ensures db:push never asks questions about schema changes
  if (isDbClearEnabled()) {
    await clearDatabase();
  } else {
    console.log("⏭️  Database clearing skipped (E2E_SKIP_DB_CLEAR is set)");
  }

  // Create test database connection
  const { db, close } = createTestDB();
  console.log("✓ Test database connection established");

  // Install required PostgreSQL extensions
  console.log("🔌 Ensuring required PostgreSQL extensions are installed...");

  // Install pg_trgm extension (needed for trigram-based fuzzy text search)
  try {
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
    console.log("✓ pg_trgm extension ready");
  } catch (error) {
    console.error("❌ pg_trgm extension installation failed:", error);
    throw new Error(
      "pg_trgm extension is required for trigram-based search indexes. " +
        "Ensure your PostgreSQL instance has the pg_trgm extension available.",
    );
  }

  // Install PostGIS extension if not already installed (needed for maps module)
  try {
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS postgis`);
    console.log("✓ PostGIS extension ready");
  } catch (error) {
    console.warn(
      "⚠️  PostGIS extension installation failed (may not be available on this database):",
      error,
    );
    // Don't throw - some databases might not support PostGIS, and that's okay for basic tests
  }

  console.log("📦 Running database migrations...");
  try {
    // Run drizzle-kit push to ensure schema is up-to-date
    // This is safe to run multiple times - it only applies changes if needed
    execSync("cd ../apps/turboplan && pnpm db:push", {
      stdio: "inherit",
      env: { ...process.env, POSTGRES_URL: testDbUrl },
    });
    console.log("✓ Database migrations completed");
  } catch (error) {
    console.error("❌ Database migrations failed:", error);
    throw error;
  }

  // Verify database is accessible
  try {
    await db.execute(sql`SELECT 1`);
    console.log("✓ Database connection verified");
  } catch (error) {
    console.error("❌ Database connection verification failed:", error);
    throw error;
  }

  // Close database connection
  await close();
  console.log("🔌 Setup database connection closed");

  console.log("✅ E2E Global Setup: Complete");
};

export default globalSetup;
