import { config } from "dotenv";

import { createDrizzleConfig } from "@wildfires-org/turboplan-db/drizzle-config";
import { getCommonEnv } from "@wildfires-org/turboplan-env";

// Load environment variables from Next.js app
config({ path: ".env.local" });

const ENV = getCommonEnv();

// Use centralized config from turboplan-db package with local env vars
export default createDrizzleConfig(ENV.POSTGRES_URL);
