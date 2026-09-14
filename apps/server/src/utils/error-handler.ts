import type { Context, ErrorHandler } from "hono";

import { capturePosthogException } from "../middleware/posthog.js";
import { captureSentryException } from "./sentry.js";

/** Global error handler for unhandled exceptions. */
export const globalErrorHandler: ErrorHandler = async (err, c: Context) => {
  console.error("Unhandled error:", err);

  captureSentryException(err, c);
  await capturePosthogException(err, c);

  return c.json({ error: "Internal Server Error" }, 500);
};
