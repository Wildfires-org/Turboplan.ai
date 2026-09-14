"use server";

import { assertProjectCreationAllowed } from "@wildfires-org/turboplan-billing/server";
import { project, projectUsers } from "@wildfires-org/turboplan-db";
import { db } from "@wildfires-org/turboplan-db/db-client";
import { generateUniqueSlug } from "@wildfires-org/turboplan-utils/server";
import { getOrCreatePersonalWorkspace } from "@wildfires-org/turboplan-workspace/server";
import { MemberRole } from "@wildfires-org/turboplan-workspace/types";

import { auth } from "../(auth)/auth";
import {
  autoGenerateProjectImage,
  buildProjectChatUrl,
  sanitizeName,
} from "./helpers";
import type { CreateProjectInput, CreateProjectResult } from "./types";

/**
 * Create a project for an authenticated user.
 *
 * The project is ALWAYS created as a DRAFT in the user's PERSONAL workspace
 * (which they own). A government org (existingOrgId + existingOfficeId) is the
 * SUBMIT target — handled after creation via submitProjectForReview — never the
 * creation target. This mirrors createUserWithOrganization (the unauthenticated
 * signup flow) and, crucially, evaluates the billing gate against the user's own
 * billing org (where their subscription lives) instead of the government org,
 * which never carries the citizen's subscription.
 */
export async function createProjectForAuthenticatedUser(
  data: CreateProjectInput,
): Promise<CreateProjectResult> {
  try {
    const session = await auth();
    if (!session?.user?.id || !session?.user?.email) {
      console.error(
        "[createProjectForAuthenticatedUser] Unauthorized access attempt",
      );
      return { status: "failed", error: "Unauthorized" };
    }

    const userId = session.user.id;
    const email = session.user.email;

    // existingOrgId / existingOfficeId (a gov submit target picked on the landing
    // page) are NOT submitted to here: the project always lands in the user's
    // personal workspace. They are saved on the project as the default submit
    // target for a later explicit submit-for-review.
    const {
      projectTitle,
      projectDescription,
      existingOrgId,
      existingOfficeId,
    } = data;

    // Validate input
    if (!projectTitle) {
      return {
        status: "invalid_data",
        error: "Project title is required",
      };
    }

    // Resolve the user's PERSONAL workspace — the creation target and the org
    // whose billing covers this creation.
    const { organization: personalOrg, office: personalOffice } =
      await getOrCreatePersonalWorkspace(userId, email);

    // Billing gate: the personal org's plan caps active projects (Starter
    // allows one). Pure count check — nothing consumed, nothing to refund.
    // No-op when billing is disabled.
    const entitlement = await assertProjectCreationAllowed({
      organizationId: personalOrg.id,
    });
    if (!entitlement.allowed) {
      return {
        status: "upgrade_required",
        error: "UPGRADE_REQUIRED",
        organizationSlug: personalOrg.slug,
        organizationId: personalOrg.id,
      };
    }

    // Create the project as a DRAFT in the personal workspace office.
    const now = new Date();
    const sanitizedProjectTitle = sanitizeName(projectTitle);
    const projectSlug = generateUniqueSlug(sanitizedProjectTitle);

    // Calculate default end date (180 days from now)
    const defaultEndDate = new Date(now);
    defaultEndDate.setDate(defaultEndDate.getDate() + 180);

    const [newProject] = await db
      .insert(project)
      .values({
        name: sanitizedProjectTitle,
        slug: projectSlug,
        description: projectDescription || `Project: ${sanitizedProjectTitle}`,
        officeId: personalOffice.id,
        createdBy: userId,
        lastModifiedBy: userId,
        status: "active",
        isTemplate: false,
        startDate: now,
        endDate: defaultEndDate,
        intendedSubmissionOrganizationId: existingOrgId ?? null,
        intendedSubmissionOfficeId: existingOfficeId ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    if (!newProject) {
      return { status: "failed", error: "Failed to create project" };
    }

    // Assign user as owner of the project
    await db.insert(projectUsers).values({
      userId: userId,
      projectId: newProject.id,
      role: MemberRole.OWNER,
    });

    // Auto-generate cover image if feature is enabled (fire-and-forget for faster redirect)
    autoGenerateProjectImage(
      userId,
      newProject.id,
      newProject.name,
      "[Self-Service Authenticated]",
    ).catch((error) =>
      console.error(
        `[Self-Service Authenticated] Background image generation failed for project ${newProject.id}:`,
        error,
      ),
    );

    // The project stays in the user's PERSONAL workspace — it is NOT submitted
    // or moved to a government org at creation time. A gov org/office selected on
    // the landing page is only a default the user can later submit to explicitly;
    // creation always lands the project in the personal workspace, owned by them.
    return {
      status: "success",
      redirectTo: buildProjectChatUrl(
        personalOrg.slug,
        personalOffice.slug,
        newProject.slug,
        {
          initialMessageContent: projectDescription,
        },
      ),
    };
  } catch (error) {
    console.error("[createProjectForAuthenticatedUser] Failed:", error);
    return {
      status: "failed",
      error: error instanceof Error ? error.message : "An error occurred",
    };
  }
}
