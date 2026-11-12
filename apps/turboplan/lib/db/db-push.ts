import { config } from "dotenv";
import postgres from "postgres";

import { getDbProvider } from "@wildfires-org/turboplan-env";

config({ path: ".env.local" });

if (getDbProvider() === "d1") {
  console.error(
    "db:push is Postgres-only. On DB_PROVIDER=d1 run `pnpm db:migrate`, which " +
      "applies packages/core/turboplan-db/src/migrations-d1 (regenerate them " +
      "with `pnpm --filter @wildfires-org/turboplan-db d1:generate`).",
  );
  process.exit(1);
}

const url = process.env.POSTGRES_URL;
if (!url) {
  console.error("POSTGRES_URL is not set");
  process.exit(1);
}

const sql = postgres(url);

async function main() {
  const extensions = ["postgis", "pg_trgm"];

  for (const ext of extensions) {
    await sql.unsafe(`CREATE EXTENSION IF NOT EXISTS ${ext}`);
    console.log(`Extension "${ext}" ensured.`);
  }

  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
