import { config } from "dotenv";

import {
  runD1Migrations,
  runMigrations,
} from "@wildfires-org/turboplan-db/migrate";
import { getCommonEnv, getDbProvider } from "@wildfires-org/turboplan-env";

// Load environment variables from Next.js app
config({ path: ".env.local" });

const ENV = getCommonEnv();

// Run centralized migrations from turboplan-db package
(getDbProvider() === "d1" ? runD1Migrations() : runMigrations(ENV.POSTGRES_URL))
  .then(() => {
    console.log("✅ Migration completed successfully");
    process.exit(0);
  })
  .catch((err: unknown) => {
    console.error("❌ Migration failed");
    console.error(err);
    process.exit(1);
  });
