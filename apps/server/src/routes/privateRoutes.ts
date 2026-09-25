import type { Hono } from "hono";

import {
  adminMeRouter,
  adminRouter,
} from "@wildfires-org/turboplan-admin/server";
import { imageGenerationRouter } from "@wildfires-org/turboplan-ai/server";
import {
  isBillingPackageEnabled,
  isFieldsPackageEnabled,
  isMapPackageEnabled,
  isProjectContextPackageEnabled,
  isResearchAgentPackageEnabled,
  isSigningPackageEnabled,
  isTasksPackageEnabled,
  isTimelineRecordsPackageEnabled,
} from "@wildfires-org/turboplan-feature-flags";
import { emailRouter } from "@wildfires-org/turboplan-mail/server";
import { permissionsRouter } from "@wildfires-org/turboplan-rbac/server";
import { uploadRouter } from "@wildfires-org/turboplan-upload/server";
import {
  commentsRouter,
  configureWorkspaceAnalytics,
  invitationsRouter,
  officesRouter,
  organizationSigningConfigRouter,
  organizationsRouter,
  projectDocumentsRouter,
  projectsRouter,
  usersRouter,
} from "@wildfires-org/turboplan-workspace/server";

import { captureEvent } from "../middleware/posthog.js";
import { featurePackageError } from "../utils/feature-package-error.js";
import { authRouter } from "./auth.js";
import { documentExportRouter } from "./document-export.js";
import { enhanceProjectPromptRouter } from "./enhance-project-prompt.js";
import { patRouter } from "./pat-routes.js";
import { validateProjectPromptRouter } from "./validate-project-prompt.js";

/**
 * Registers all PRIVATE routes that REQUIRE authentication.
 *
 * IMPORTANT: Auth and admin middleware must be applied BEFORE calling this function.
 */
export async function registerPrivateRoutes(router: Hono) {
  // Workspace event names are a subset of the analytics taxonomy — pass
  // through. Wired unconditionally (unlike billing) since the workspace
  // package is always mounted.
  configureWorkspaceAnalytics(({ distinctId, event, properties }) => {
    captureEvent(distinctId, event, properties);
  });

  // Auth routes (user session management)
  router.route("/api/auth", authRouter);

  // Personal Access Token management
  router.route("/api/auth/tokens", patRouter);

  // Admin status check (any authenticated user, outside /api/admin/* to bypass admin middleware)
  router.route("/api/admin-status", adminMeRouter);

  // Admin routes are mounted at the end of this function (after conditional admin sub-routes are added)

  // RBAC permissions
  router.route("/api/permissions", permissionsRouter);

  // File upload
  router.route("/api/upload", uploadRouter);

  // AI image generation
  router.route("/api/ai", imageGenerationRouter);

  // AI project prompt validation
  router.route("/api/ai", validateProjectPromptRouter);

  // AI project prompt enhancement
  router.route("/api/ai", enhanceProjectPromptRouter);

  // Email
  router.route("/api/email", emailRouter);

  // Workspace resources
  router.route("/api/organizations", organizationsRouter);
  router.route("/api/offices", officesRouter);
  router.route("/api/projects", projectsRouter);
  router.route("/api/project-documents", projectDocumentsRouter);
  router.route("/api/comments", commentsRouter);

  // Document export (PDF render from markdown — always available, content-only)
  router.route("/api/documents", documentExportRouter);

  // User search (for user selector component)
  router.route("/api/users", usersRouter);

  // Invitations (accept, revoke, resend)
  router.route("/api/invitations", invitationsRouter);

  // Conditionally add maps router if feature is enabled
  if (isMapPackageEnabled()) {
    try {
      const { mapsRouter } = await import(
        "@wildfires-org/turboplan-map/server"
      );
      router.route("/api/maps", mapsRouter);
    } catch (error) {
      throw featurePackageError("Maps", "@wildfires-org/turboplan-map", error);
    }
  }

  // Conditionally add fields router if feature is enabled
  if (isFieldsPackageEnabled()) {
    try {
      const { fieldsRouter } = await import(
        "@wildfires-org/turboplan-fields/server"
      );
      router.route("/api/projects", fieldsRouter);
    } catch (error) {
      throw new Error(
        `Fields feature is enabled but @wildfires-org/turboplan-fields package is not available. ` +
          `Either disable the fields feature or install the required package. ` +
          `Original error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // Conditionally add tasks router if feature is enabled
  if (isTasksPackageEnabled()) {
    try {
      const { milestonesRouter, tasksRouter } = await import(
        "@wildfires-org/turboplan-tasks/server"
      );

      router.route("/api/tasks", tasksRouter);
      router.route("/api/milestones", milestonesRouter);

      // Add project-specific endpoints that route to the appropriate task routers
      router.route("/api/projects", milestonesRouter);
    } catch (error) {
      throw featurePackageError(
        "Tasks",
        "@wildfires-org/turboplan-tasks",
        error,
      );
    }
  }

  // Conditionally add timeline records router if feature is enabled
  if (isTimelineRecordsPackageEnabled()) {
    try {
      const { timelineRouter } = await import(
        "@wildfires-org/turboplan-timeline-records/server"
      );
      router.route("/api/projects", timelineRouter);
    } catch (error) {
      throw featurePackageError(
        "Timeline Records",
        "@wildfires-org/turboplan-timeline-records",
        error,
      );
    }
  }

  // Conditionally add project context router if feature is enabled
  if (isProjectContextPackageEnabled()) {
    try {
      const { contextRouter } = await import(
        "@wildfires-org/turboplan-project-context/server"
      );
      router.route("/api/projects", contextRouter);
    } catch (error) {
      throw featurePackageError(
        "Project context",
        "@wildfires-org/turboplan-project-context",
        error,
      );
    }
  }

  // Conditionally add signing routers if feature is enabled
  if (isSigningPackageEnabled()) {
    // Organization-level signing configuration (from workspace package, no dynamic import needed)
    router.route("/api/organizations", organizationSigningConfigRouter);

    try {
      const { signingRouter } = await import(
        "@wildfires-org/turboplan-signing/server"
      );
      router.route("/api/signing-requests", signingRouter);
    } catch (error) {
      throw featurePackageError(
        "Signing",
        "@wildfires-org/turboplan-signing",
        error,
      );
    }
  }

  // Conditionally add billing router if feature is enabled
  if (isBillingPackageEnabled()) {
    try {
      const { billingRouter, configureBillingAnalytics } = await import(
        "@wildfires-org/turboplan-billing/server"
      );
      // Billing event names are a subset of the analytics taxonomy — pass through.
      configureBillingAnalytics(({ distinctId, event, properties }) => {
        captureEvent(distinctId, event, properties);
      });
      router.route("/api/billing", billingRouter);
    } catch (error) {
      throw featurePackageError(
        "Billing",
        "@wildfires-org/turboplan-billing",
        error,
      );
    }
  }

  // Conditionally add research agent routers if feature is enabled
  if (isResearchAgentPackageEnabled()) {
    try {
      const { bootstrapperRouter, catalogerAdminRouter, catalogerRouter } =
        await import(
          "@wildfires-org/turboplan-research-agent-integration/server"
        );

      // Proxy routers (TurboPlan Frontend → Research Agent)
      router.route("/api/ai/research-agent/bootstrapper", bootstrapperRouter);

      // Cataloger is platform-admin only (it creates GOVERNMENT orgs and public
      // template projects), so both its routers are composed into adminRouter
      // and protected via /api/admin/*. Webhook callbacks live separately.
      adminRouter.route("/cataloger", catalogerAdminRouter);
      adminRouter.route("/cataloger", catalogerRouter);
    } catch (error) {
      throw featurePackageError(
        "Research agent",
        "@wildfires-org/turboplan-research-agent-integration",
        error,
      );
    }
  }

  // Admin routes — mounted last so conditional admin sub-routes (e.g. cataloger) are included
  router.route("/api/admin", adminRouter);
}
