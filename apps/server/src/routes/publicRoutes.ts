import type { Hono } from "hono";

import { getReleaseInfo } from "@wildfires-org/turboplan-env";
import {
  isBillingPackageEnabled,
  isSigningPackageEnabled,
} from "@wildfires-org/turboplan-feature-flags";
import { internalEmailRouter } from "@wildfires-org/turboplan-mail/server";
import {
  publicCommentsRouter,
  publicImagesRouter,
  publicModulesRouter,
  publicOfficesRouter,
  publicOrganizationsRouter,
  publicProjectsRouter,
  publicTemplatesRouter,
  publicTimelineRouter,
} from "@wildfires-org/turboplan-public/server";
import { searchRouter } from "@wildfires-org/turboplan-search/server";
import { publicInvitationsRouter } from "@wildfires-org/turboplan-workspace/server";

import { magicLinkAnalyticsMiddleware } from "../middleware/magic-link-analytics.js";
import { tokenRouter } from "./auth/token.js";
import { publicEnhanceProjectPromptRouter } from "./enhance-project-prompt.js";
import { generateTitleRouter } from "./generate-title.js";
import { publicValidateProjectPromptRouter } from "./validate-project-prompt.js";

/**
 * Registers all PUBLIC routes that do NOT require authentication.
 *
 * IMPORTANT: All routes registered here are accessible without authentication.
 * Only add routes here if they are intentionally public-facing.
 */
export async function registerPublicRoutes(router: Hono) {
  // Health check endpoint
  router.get("/health", (c) => {
    return c.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      release: getReleaseInfo(),
    });
  });

  // Title generation endpoint (no auth required)
  router.route("/", generateTitleRouter);

  // Public search endpoint
  router.route("/api/search", searchRouter);

  // Public routes (no authentication required)
  router.route("/api/public/projects", publicProjectsRouter);
  router.route("/api/public/projects", publicModulesRouter);
  router.route("/api/public/projects", publicCommentsRouter);
  router.route("/api/public/images", publicImagesRouter);
  router.route("/api/public/organizations", publicOrganizationsRouter);
  router.route("/api/public/offices", publicOfficesRouter);
  router.route("/api/public/templates", publicTemplatesRouter);
  router.route("/api/public/projects", publicTimelineRouter);

  // Public project prompt validation endpoint (no auth)
  router.route("/api/public", publicValidateProjectPromptRouter);

  // Public project prompt enhancement endpoint (no auth)
  router.route("/api/public", publicEnhanceProjectPromptRouter);

  // Public invitation details (for acceptance page before login)
  router.route("/api/public/invitations", publicInvitationsRouter);

  // Internal authentication endpoints (protected by INTERNAL_API_SECRET header)
  // Used for magic link emails during registration/login
  router.use("/internal/auth/magic-link", magicLinkAnalyticsMiddleware);
  router.route("/internal/auth", internalEmailRouter);

  // Public token endpoint - converts session cookie to API token
  // Must be mounted BEFORE authMiddleware since it's the entry point for authentication
  router.route("/api/auth", tokenRouter);

  // Documenso signing webhook (uses its own secret header for auth)
  if (isSigningPackageEnabled()) {
    const { signingWebhookRouter } = await import(
      "@wildfires-org/turboplan-signing/server"
    );
    router.route("/api/webhooks/signing", signingWebhookRouter);
  }

  // Stripe billing webhook (authenticated via Stripe signature only) and the
  // manual seat-reconciliation endpoint (authenticated via the RECONCILE_SECRET
  // header). Registered here in the pre-auth section so they bypass both the
  // `/api/webhooks/*` API-key middleware and the `/api/*` authMiddleware —
  // Stripe sends neither an API key nor a session token, and external
  // schedulers hitting /reconcile carry no session either.
  if (isBillingPackageEnabled()) {
    const { stripeWebhookRouter, reconcileRouter } = await import(
      "@wildfires-org/turboplan-billing/server"
    );
    router.route("/api/billing/stripe-webhook", stripeWebhookRouter);
    router.route("/api/billing/reconcile", reconcileRouter);
  }
}
