import * as Sentry from "@sentry/cloudflare";
import { Hono } from "hono";

import { scrubSentryEvent } from "./utils/sentry.js";

type CloudflareEnv = Record<string, unknown> & {
  HYPERDRIVE?: { connectionString: string };
};

const asString = (value: unknown): string | undefined => {
  return typeof value === "string" ? value : undefined;
};

let app: Hono | null = null;
let initPromise: Promise<Hono> | null = null;

const BRIDGE_KEYS = [
  "AUTH_SECRET",
  // Per-surface secrets — see turboplan-env. INTERNAL_API_SECRET and
  // JWT_SIGNING_SECRET must match the web app's values byte for byte.
  "INTERNAL_API_SECRET",
  "ENCRYPTION_KEY",
  "JWT_SIGNING_SECRET",
  "POSTGRES_URL",
  "SERVER_API_KEY",
  "OPENROUTER_API_KEY",
  "NODE_ENV",
  "ENVIRONMENT",
  "WORKER_RUNTIME",
  "TURBOPLAN_URL",
  "SERVER_URL",
  "LANDING_URL",
  "MAP_SERVICE_URL",
  "RESEARCH_AGENT_SERVICE_URL",
  "ALLOWED_ORIGINS",
  "AUTH_COOKIE_DOMAIN",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
  "R2_ACCOUNT_ID",
  "R2_PUBLIC_URL",
  "MAP_SERVICE_API_KEY",
  "RESEARCH_AGENT_SERVICE_API_KEY",
  "RESEND_API_KEY",
  "POSTHOG_API_KEY",
  "APP_NAME",
  "APP_ENV",
  "ADMIN_EMAILS",
  "USE_EXTERNAL_PROMPTS",
  "IS_TASKS_PACKAGE_ENABLED",
  "IS_FIELDS_PACKAGE_ENABLED",
  "IS_MAPS_PACKAGE_ENABLED",
  "IS_DOCUMENTS_PACKAGE_ENABLED",
  "IS_RESEARCH_AGENT_INTEGRATION_PACKAGE_ENABLED",
  "IS_TIMELINE_RECORDS_PACKAGE_ENABLED",
  "IS_PROJECT_CONTEXT_PACKAGE_ENABLED",
  "IS_BILLING_PACKAGE_ENABLED",
  "IS_SIGNING_PACKAGE_ENABLED",
  "OPENROUTER_MODEL_PRIMARY",
  "OPENROUTER_MODEL_LITE",
  "OPENROUTER_MODEL_IMAGE_PRIMARY",
  "OPENROUTER_MODEL_IMAGE_LITE",
  "DISABLE_AUTO_PROJECT_IMAGE_GENERATION",
  "RESEND_FROM_EMAIL",
  "MAIL_REPLY_TO_EMAIL",
  "RELEASE_VERSION",
  "RELEASE_DATE",
  "RELEASE_BRANCH",
  "PR_NUMBER",
  // Stripe billing — required by getApiEnv() when IS_BILLING_PACKAGE_ENABLED=true.
  // Without these the deployed worker throws on env validation and cannot run
  // billing (webhooks, checkout, seat reconciliation). Plan/seat/overage price
  // ids are not env vars — they resolve from catalog lookup keys at runtime.
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  // Optional shared secret for the manual seat-reconciliation endpoint. Without
  // it bridged, the deployed worker cannot enable POST /api/billing/reconcile.
  "RECONCILE_SECRET",
  // Documenso signing — required by getApiEnv() when IS_SIGNING_PACKAGE_ENABLED
  // is set. The flag alone is not enough: without these bridged the deployed
  // worker throws on env validation and cannot start at all.
  "DOCUMENSO_API_URL",
  "DOCUMENSO_API_KEY",
  "DOCUMENSO_WEBHOOK_SECRET",
  // Sentry error monitoring — optional, monitoring disabled when unset
  "SENTRY_DSN",
];

/**
 * Copies the Cloudflare-provided env (vars + secrets) into `process.env` so the
 * shared `@wildfires-org/turboplan-env` accessors work at runtime, and swaps in
 * the Hyperdrive pooled connection string when present. Extracted from
 * {@link initApp} so the env bridge is a single, reusable step.
 */
const bridgeEnv = (env: CloudflareEnv): void => {
  for (const key of BRIDGE_KEYS) {
    const value = env[key];
    if (typeof value === "string") {
      process.env[key] = value;
    }
  }

  // Use Hyperdrive connection string if available (connection pooling proxy)
  if (env.HYPERDRIVE?.connectionString) {
    process.env.POSTGRES_URL = env.HYPERDRIVE.connectionString;
  }
};

const initApp = async (env: CloudflareEnv): Promise<Hono> => {
  bridgeEnv(env);

  const { createApiRouter } = await import("./router.js");

  const instance = new Hono();
  const apiRouter = await createApiRouter();
  instance.route("/", apiRouter);
  app = instance;

  return instance;
};

export default Sentry.withSentry(
  (env: CloudflareEnv) => ({
    dsn: asString(env.SENTRY_DSN) || undefined,
    environment: asString(env.ENVIRONMENT) ?? asString(env.NODE_ENV),
    release: asString(env.RELEASE_VERSION),
    tracesSampleRate: 0,
    sendDefaultPii: false,
    initialScope: { tags: { service: "api" } },
    beforeSend: scrubSentryEvent,
  }),
  {
    async fetch(
      request: Request,
      env: CloudflareEnv,
      ctx: { waitUntil: (promise: Promise<unknown>) => void },
    ): Promise<Response> {
      const handler = app ?? (await (initPromise ??= initApp(env)));
      const { runWithWorkerConnection } = await import(
        "@wildfires-org/turboplan-db/db-client"
      );
      return runWithWorkerConnection(async () =>
        handler.fetch(request, env, ctx as never),
      );
    },
  },
);
