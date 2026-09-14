import { clearDatabase, isDbClearEnabled } from "./utils/clear-database";

/**
 * Global teardown runs once after all tests complete.
 * Clears the database unless E2E_SKIP_DB_CLEAR=true is set.
 */
const globalTeardown = async (): Promise<void> => {
  console.log("\n🧹 E2E Global Teardown: Starting...");

  // Clear database after tests (unless E2E_SKIP_DB_CLEAR=true)
  if (isDbClearEnabled()) {
    await clearDatabase();
  } else {
    console.log("⏭️  Database clearing skipped (E2E_SKIP_DB_CLEAR is set)");
  }

  console.log("✅ E2E Global Teardown: Complete");
};

export default globalTeardown;
