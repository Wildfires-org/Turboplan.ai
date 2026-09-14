import { sql } from "drizzle-orm";

import { createTestDB } from "@wildfires-org/turboplan-db/db-client";

/**
 * Checks if database clearing is enabled via environment variable.
 * Set E2E_SKIP_DB_CLEAR=true to skip database clearing (useful for debugging).
 */
export const isDbClearEnabled = (): boolean => {
  const skipClear = process.env.E2E_SKIP_DB_CLEAR;
  return skipClear !== "true" && skipClear !== "1";
};

/**
 * Fully resets the database by dropping and recreating the public schema.
 * This ensures a clean slate for migrations and avoids any schema change conflicts.
 *
 * Note: This will drop ALL tables, types, and other objects in the public schema.
 * Only use this for test databases!
 *
 * @returns Promise that resolves when the database is cleared
 */
export const clearDatabase = async (): Promise<void> => {
  if (!isDbClearEnabled()) {
    console.log("⏭️  Database clearing skipped (E2E_SKIP_DB_CLEAR is set)");
    return;
  }

  const { db, close } = createTestDB();

  try {
    console.log("🗑️  Clearing database...");

    // Drop and recreate the public schema - this removes all tables, types, etc.
    // We use CASCADE to handle any dependencies
    await db.execute(sql`DROP SCHEMA public CASCADE`);
    await db.execute(sql`CREATE SCHEMA public`);

    // Restore default grants for the public schema
    await db.execute(sql`GRANT ALL ON SCHEMA public TO public`);

    console.log("✓ Database cleared successfully");
  } catch (error) {
    console.error("❌ Failed to clear database:", error);
    throw error;
  } finally {
    await close();
  }
};
