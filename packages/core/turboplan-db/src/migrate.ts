import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Runs database migrations from the turboplan-db package.
 * This function should be called from the Next.js app where env vars are loaded.
 *
 * @param postgresUrl - Database connection URL
 */
export const runMigrations = async (postgresUrl: string): Promise<void> => {
  if (!postgresUrl) {
    throw new Error("POSTGRES_URL is not defined");
  }

  const connection = postgres(postgresUrl, { max: 1 });
  const db = drizzle(connection);

  console.log("⏳ Running migrations...");

  const start = Date.now();
  const migrationsFolder = resolve(__dirname, "./migrations");

  await migrate(db, { migrationsFolder });

  const end = Date.now();

  console.log("✅ Migrations completed in", end - start, "ms");

  await connection.end();
};
