import { and, eq, gt, isNotNull, isNull } from "drizzle-orm";

import { createToken } from "@wildfires-org/turboplan-api-client";
import { project } from "@wildfires-org/turboplan-db";
import { db } from "@wildfires-org/turboplan-db/db-client";
import { getWebEnv } from "@wildfires-org/turboplan-env";
import { isResearchAgentPackageEnabled } from "@wildfires-org/turboplan-feature-flags";

import { AppUrls } from "@/lib/nav/urls";

/**
 * Description stored on a self-service project when the user did not provide
 * one. Used at verification time to tell "user wrote a prompt" (research agent
 * should run) from "no prompt" (skip), mirroring the original signup gate.
 */
export const buildFallbackProjectDescription = (projectTitle: string) =>
  `Project: ${projectTitle}`;

/**
 * Sanitize names for safe database storage
 */
export function sanitizeName(name: string, maxLength: number = 100): string {
  return (
    name
      // Remove potentially dangerous characters, keep alphanumeric, spaces, hyphens, periods, commas
      .replace(/[^\w\s\-.,]/g, "")
      .trim()
      .slice(0, maxLength)
  );
}

/**
 * Helper function to build redirect URL for project chat (slug-based)
 */
export function buildProjectChatUrl(
  orgSlug: string,
  officeSlug: string,
  projectSlug: string,
  options?: {
    chatId?: string;
    initialMessageContent?: string;
  },
): string {
  let url = options?.chatId
    ? AppUrls.projectChatById(orgSlug, officeSlug, projectSlug, options.chatId)
    : AppUrls.projectNewChat(orgSlug, officeSlug, projectSlug);

  if (options?.initialMessageContent) {
    const params = new URLSearchParams({
      initialMessageContent: options.initialMessageContent,
    });
    url += `?${params.toString()}`;
  }

  return url;
}

/**
 * Auto-generates a cover image for a project by calling the backend API.
 * Handles errors internally without throwing to avoid blocking the calling code.
 *
 * @param userId - The ID of the user making the request
 * @param projectId - The ID of the project to generate an image for
 * @param projectTitle - The title of the project (used for image generation)
 * @param logPrefix - Optional prefix for console logs (e.g., "[Self-Service]")
 * @returns true when the image was generated (or generation is disabled — a
 *   no-op counts as done), false when the attempt failed and should be retried
 */
export async function autoGenerateProjectImage(
  userId: string,
  projectId: string,
  projectTitle: string,
  logPrefix: string = "[Self-Service]",
): Promise<boolean> {
  const ENV = getWebEnv();

  if (ENV.DISABLE_AUTO_PROJECT_IMAGE_GENERATION) {
    return true;
  }

  try {
    const apiToken = await createToken({ id: userId });

    // Wait for the fetch call, but errors are caught locally so don't block upper code
    try {
      const response = await fetch(
        `${ENV.SERVER_URL}/api/ai/auto-generate-project-image`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiToken}`,
          },
          body: JSON.stringify({
            projectId,
            projectTitle,
          }),
        },
      );

      const result = await response.json();
      if (result.success) {
        console.log(
          `${logPrefix} Auto-generated cover image for project ${projectId}`,
        );
        return true;
      }
      console.log(
        `${logPrefix} Failed to auto-generate cover image: ${result.error}`,
      );
    } catch (fetchError) {
      console.error(
        `${logPrefix} Error in fetching auto-generate endpoint:`,
        fetchError,
      );
    }
    // catching error from token creation
  } catch (tokenError) {
    console.error(`${logPrefix} Failed to create API token:`, tokenError);
  }

  return false;
}

export const triggerResearchAgent = async (
  userId: string,
  projectId: string,
): Promise<boolean> => {
  const ENV = getWebEnv();

  try {
    const apiToken = await createToken({ id: userId });
    const response = await fetch(
      `${ENV.SERVER_URL}/api/ai/research-agent/bootstrapper/project/${projectId}/start`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiToken}`,
        },
        body: JSON.stringify({}),
      },
    );
    if (!response.ok) {
      console.error(
        `[Self-Service] Research agent trigger failed with status ${response.status} for project ${projectId}`,
      );
      return false;
    }
    const result = await response.json();
    console.log(
      `[Self-Service] Research agent triggered for project ${projectId}:`,
      result,
    );
    return true;
  } catch (error) {
    console.error(`[Self-Service] Research agent trigger error:`, error);
    return false;
  }
};

/**
 * Background work for the project created via self-service signup: cover image
 * generation and the research agent bootstrap. Deliberately NOT run at signup —
 * the email is unverified then, so anyone could burn AI budget with fake
 * signups. Called from `verifyMagicLink` for every project still carrying
 * `selfServiceSetupPendingAt` (stamped at signup, cleared here on success), so
 * a failed attempt is retried on the user's next magic-link verification
 * instead of being lost forever.
 *
 * Idempotent per task: image generation is skipped when a cover image already
 * exists, and the bootstrapper `/start` endpoint itself no-ops on active or
 * completed runs — so a retry only redoes the pieces that actually failed.
 *
 * Scoped to projects the user created (`createdBy` re-checked here), so it can
 * never target somebody else's project. Soft-deleted projects are skipped.
 *
 * Concurrency: the pending flag is claimed (cleared) inside a row-locking
 * transaction before any work runs, so two concurrent verifications (the same
 * link opened in two tabs) cannot double-run paid image generation — the
 * second claim finds the flag gone and exits. On failure the flag is restored
 * with its ORIGINAL timestamp so the retry window keeps counting from the
 * first attempt.
 *
 * Every side effect is awaited: the caller wraps this in `after()`, and a
 * serverless runtime may be frozen the moment that callback resolves, which
 * would kill any promise left dangling.
 */
export const runDeferredSelfServiceProjectSetup = async (
  userId: string,
  projectId: string,
): Promise<void> => {
  const claimed = await db.transaction(async (tx) => {
    const [p] = await tx
      .select({
        id: project.id,
        name: project.name,
        description: project.description,
        coverImageId: project.coverImageId,
        setupPendingAt: project.selfServiceSetupPendingAt,
      })
      .from(project)
      .where(
        and(
          eq(project.id, projectId),
          eq(project.createdBy, userId),
          isNull(project.deletedAt),
          isNotNull(project.selfServiceSetupPendingAt),
        ),
      )
      .limit(1)
      .for("update");

    if (!p) {
      return null;
    }

    await tx
      .update(project)
      .set({ selfServiceSetupPendingAt: null })
      .where(eq(project.id, p.id));

    return p;
  });

  if (!claimed) {
    // Already claimed by a concurrent verification, already completed,
    // soft-deleted, or not this user's project — nothing to do.
    return;
  }

  const tasks: Array<{ label: string; run: Promise<boolean> }> = [];

  if (!claimed.coverImageId) {
    tasks.push({
      label: `image generation for project ${claimed.id}`,
      run: autoGenerateProjectImage(
        userId,
        claimed.id,
        claimed.name,
        "[Verify]",
      ),
    });
  }

  const hasUserPrompt =
    !!claimed.description &&
    claimed.description !== buildFallbackProjectDescription(claimed.name);
  if (hasUserPrompt && isResearchAgentPackageEnabled()) {
    tasks.push({
      label: `research agent trigger for project ${claimed.id}`,
      run: triggerResearchAgent(userId, claimed.id),
    });
  }

  const results = await Promise.allSettled(tasks.map((task) => task.run));

  let allSucceeded = true;
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      allSucceeded = false;
      console.error(
        `[Verify] Deferred ${tasks[index].label} failed:`,
        result.reason,
      );
    } else if (!result.value) {
      allSucceeded = false;
    }
  });

  // On failure, restore the flag with its original timestamp so the next
  // magic-link verification retries — but only within the retry window
  // (see runPendingSelfServiceProjectSetups), so a permanently failing setup
  // (revoked permissions, exhausted credits) does not re-fire paid HTTP calls
  // on every login forever.
  if (!allSucceeded) {
    await db
      .update(project)
      .set({ selfServiceSetupPendingAt: claimed.setupPendingAt })
      .where(eq(project.id, claimed.id));
  }
};

/**
 * How long after signup the deferred setup keeps being retried. Past this,
 * pending rows are simply ignored — the flag stays set but stops triggering
 * work, bounding the cost of permanent failures (revoked access, dead
 * feature flags, exhausted credits).
 */
const SELF_SERVICE_SETUP_RETRY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Run the deferred self-service setup for every project of this user that
 * still has it pending. Called from `verifyMagicLink` on every successful
 * verification (first or repeat), inside `after()`. Cheap when nothing is
 * pending: a single select (partial index on created_by where the flag is
 * set) and no side effects.
 */
export const runPendingSelfServiceProjectSetups = async (
  userId: string,
): Promise<void> => {
  const retryCutoff = new Date(Date.now() - SELF_SERVICE_SETUP_RETRY_WINDOW_MS);
  const pending = await db
    .select({ id: project.id })
    .from(project)
    .where(
      and(
        eq(project.createdBy, userId),
        isNotNull(project.selfServiceSetupPendingAt),
        gt(project.selfServiceSetupPendingAt, retryCutoff),
        isNull(project.deletedAt),
      ),
    );

  for (const { id } of pending) {
    await runDeferredSelfServiceProjectSetup(userId, id);
  }
};
