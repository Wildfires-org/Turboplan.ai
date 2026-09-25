import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { pinoLogger } from "hono-pino";
import pino from "pino";

import { adminMiddleware } from "@wildfires-org/turboplan-admin/server";
import { getApiEnv } from "@wildfires-org/turboplan-env";
import {
  configureRecorder,
  configureRecorderAnalytics,
} from "@wildfires-org/turboplan-timeline-records/server";

import { apiKeyMiddleware } from "./middleware/api-key.js";
import { authMiddleware } from "./middleware/auth.js";
import { corsMiddleware } from "./middleware/cors.js";
import {
  capturePosthogError,
  posthogMiddleware,
} from "./middleware/posthog.js";
import { requireSessionAuth } from "./middleware/session-only.js";
import { captureTimelineAnalytics } from "./middleware/timeline-analytics.js";
import { registerPrivateRoutes } from "./routes/privateRoutes.js";
import { registerPublicRoutes } from "./routes/publicRoutes.js";
import {
  registerResearchAgentWebhookRoutes,
  registerWebhookRoutes,
} from "./routes/webhookRoutes.js";
import { globalErrorHandler } from "./utils/error-handler.js";

export async function createApiRouter() {
  const ENV = getApiEnv();
  configureRecorder(capturePosthogError);
  configureRecorderAnalytics(captureTimelineAnalytics);

  const apiRouter = new Hono();

  apiRouter.onError(globalErrorHandler);

  // Registered first so every response — including CORS preflights and error
  // responses — carries the headers.
  apiRouter.use(
    "/*",
    secureHeaders({
      // The web app and landing page call this API from other origins, and
      // may load API-served resources (e.g. images) directly.
      crossOriginResourcePolicy: "cross-origin",
      // JSON API — no documents here need opener isolation, and COOP on an
      // auth redirect hop could sever popup/opener flows.
      crossOriginOpenerPolicy: false,
      xFrameOptions: "DENY",
      // HSTS only in production — never pin localhost to HTTPS during dev.
      strictTransportSecurity:
        ENV.NODE_ENV === "production"
          ? "max-age=63072000; includeSubDomains"
          : false,
    }),
  );

  const redactPaths = [
    'req.headers["x-internal-secret"]',
    'req.headers["authorization"]',
    'req.headers["cookie"]',
    'req.headers["x-api-key"]',
    'req.headers["x-auth-token"]',
  ];

  apiRouter.use(
    pinoLogger({
      pino: pino(
        ENV.NODE_ENV === "development"
          ? {
              transport: { target: "hono-pino/debug-log" },
              redact: { paths: redactPaths, censor: "[REDACTED]" },
            }
          : { redact: { paths: redactPaths, censor: "[REDACTED]" } },
      ),
    }),
  );
  apiRouter.use("/*", posthogMiddleware);
  apiRouter.use("/*", corsMiddleware);

  // ⚠️ IMPORTANT:
  // Route registration order matters!
  // Middleware applies to routes registered AFTER it.

  // PUBLIC ROUTES (no auth)
  await registerPublicRoutes(apiRouter);

  // RESEARCH AGENT WEBHOOKS (per-run webhook secret auth, no shared API key)
  await registerResearchAgentWebhookRoutes(apiRouter);

  // WEBHOOK ROUTES (API key auth)
  apiRouter.use("/api/webhooks/*", apiKeyMiddleware);
  await registerWebhookRoutes(apiRouter);

  // PRIVATE ROUTES (user auth required)
  apiRouter.use("/api/*", authMiddleware);
  // Admin routes require an interactive session — never a long-lived PAT.
  apiRouter.use("/api/admin/*", requireSessionAuth, adminMiddleware);
  await registerPrivateRoutes(apiRouter);

  return apiRouter;
}
