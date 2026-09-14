import { config } from "dotenv";

import { runMigrations } from "@wildfires-org/turboplan-db/migrate";
import { getCommonEnv } from "@wildfires-org/turboplan-env";

// Load environment variables from Next.js app
config({ path: ".env.local" });

const ENV = getCommonEnv();

// Run centralized migrations from turboplan-db package
runMigrations(ENV.POSTGRES_URL)
  .then(() => {
    console.log("✅ Migration completed successfully");
    process.exit(0);
  })
  .catch((err: unknown) => {
    console.error("❌ Migration failed");
    console.error(err);
    process.exit(1);
  });
