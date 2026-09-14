import type { MiddlewareHandler } from "hono";
import { cors } from "hono/cors";

import { getApiEnv } from "@wildfires-org/turboplan-env";

/** CORS middleware configured for allowed origins. Reads env lazily per-request
 *  so it works in Cloudflare Workers where process.env is set at request time. */
export const corsMiddleware: MiddlewareHandler = (c, next) => {
  const ENV = getApiEnv();

  return cors({
    origin: (origin) => {
      const allowedOrigins = ENV.ALLOWED_ORIGINS?.split(/[,|]/) || [];
      const isNonProduction =
        ENV.NODE_ENV === "development" || ENV.NODE_ENV === "test";

      if (isNonProduction && origin?.includes("localhost")) {
        return origin;
      }

      if (!isNonProduction && origin && !origin.startsWith("https://")) {
        return null;
      }

      return allowedOrigins.includes(origin || "") ? origin : null;
    },
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "Cookie", "X-API-Key"],
  })(c, next);
};
