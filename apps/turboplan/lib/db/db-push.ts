import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

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
