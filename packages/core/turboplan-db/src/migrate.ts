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

/**
 * Applies the D1 migrations (`migrations-d1/`) to the database `DB_PROVIDER=d1`
 * resolves to outside a Worker: `D1_LOCAL_PATH`, or the D1 HTTP API. Applied
 * migrations are tracked in wrangler's `d1_migrations` table, so
 * `wrangler d1 migrations apply` sees the same state.
 */
export const runD1Migrations = async (): Promise<void> => {
  const { getD1Env } = await import("@wildfires-org/turboplan-env");
  const { createD1HttpTransport, createLocalSqliteTransport } = await import(
    "./d1/transports"
  );
  const { applyD1Migrations } = await import("./d1/migrations");
  const { readD1Migrations } = await import("./d1/migration-plan");

  const env = getD1Env();
  const transport = env.D1_LOCAL_PATH
    ? createLocalSqliteTransport(env.D1_LOCAL_PATH)
    : env.CLOUDFLARE_ACCOUNT_ID &&
        env.D1_DATABASE_ID &&
        env.CLOUDFLARE_API_TOKEN
      ? createD1HttpTransport({
          accountId: env.CLOUDFLARE_ACCOUNT_ID,
          databaseId: env.D1_DATABASE_ID,
          apiToken: env.CLOUDFLARE_API_TOKEN,
        })
      : null;
  if (!transport) {
    throw new Error(
      "D1 migrations need `D1_LOCAL_PATH`, or `CLOUDFLARE_ACCOUNT_ID`, " +
        "`D1_DATABASE_ID` and `CLOUDFLARE_API_TOKEN`",
    );
  }

  console.log(`⏳ Running D1 migrations (${transport.kind})...`);
  const start = Date.now();
  try {
    const applied = await applyD1Migrations(
      transport,
      await readD1Migrations(resolve(__dirname, "./migrations-d1")),
      { log: (message) => console.log(`  ${message}`) },
    );
    console.log(
      applied.length === 0
        ? "✅ D1 database already up to date"
        : `✅ Applied ${applied.length} D1 migration(s) in ${Date.now() - start} ms`,
    );
  } finally {
    await transport.close?.();
  }
};
