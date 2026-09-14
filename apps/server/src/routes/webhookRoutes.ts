import type { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";

import { isResearchAgentPackageEnabled } from "@wildfires-org/turboplan-feature-flags";

import { featurePackageError } from "../utils/feature-package-error.js";

/**
 * Ceiling on a research-agent webhook body. The largest schema-legal payload is
 * the cataloger entry / bootstrapper milestones batch: 50 milestones x 100 tasks
 * (see `bootstrapperAddMilestonesSchema`), which at a generous ~400 bytes per
 * task serializes to roughly 2 MB. 4 MB leaves headroom for that worst case
 * while still bounding what an unauthenticated caller can make us buffer and
 * parse — the secret check only runs after the body has been read.
 */
const WEBHOOK_MAX_BODY_BYTES = 4 * 1024 * 1024;

/**
 * Registers research-agent webhook routes. These authenticate with the per-run
 * `x-webhook-secret` only (validated inside each router) and are deliberately
 * NOT behind the shared API key middleware: the agent's callback URL is
 * caller-supplied, so the callback must carry no credential worth stealing.
 *
 * Request logging lives INSIDE each router, behind that secret check, so an
 * anonymous caller cannot drive inserts into `webhook_request_log`.
 *
 * Must be called BEFORE the API key middleware is applied to `/api/webhooks/*`.
 */
export async function registerResearchAgentWebhookRoutes(router: Hono) {
  if (!isResearchAgentPackageEnabled()) {
    return;
  }

  try {
    const { bootstrapperWebhookRouter, catalogerWebhookRouter } = await import(
      "@wildfires-org/turboplan-research-agent-integration/server"
    );

    router.use(
      "/api/webhooks/research-agent/*",
      bodyLimit({
        maxSize: WEBHOOK_MAX_BODY_BYTES,
        onError: (c) => {
          return c.json({ error: "Payload too large" }, 413);
        },
      }),
    );

    router.route(
      "/api/webhooks/research-agent/bootstrapper",
      bootstrapperWebhookRouter,
    );

    router.route(
      "/api/webhooks/research-agent/cataloger",
      catalogerWebhookRouter,
    );
  } catch (error) {
    throw featurePackageError(
      "Research agent",
      "@wildfires-org/turboplan-research-agent-integration",
      error,
    );
  }
}

/**
 * Registers WEBHOOK routes protected by API key authentication.
 *
 * IMPORTANT: All routes registered here are protected by the API key middleware.
 * The API key middleware must be applied BEFORE calling this function.
 */
export async function registerWebhookRoutes(router: Hono) {
  // Simple endpoint for e2e tests to verify API key middleware
  router.post("/api/webhooks/test", (c) => {
    return c.json({ success: true });
  });
}
