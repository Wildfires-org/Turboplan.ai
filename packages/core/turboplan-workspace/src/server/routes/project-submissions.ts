import { and, eq, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { Hono } from "hono";
import { z } from "zod";

import {
  generatedImages,
  OwnershipStatus,
  office,
  organization,
  profile,
  project,
  projectSubmission,
  projectUsers,
  user as userTable,
} from "@wildfires-org/turboplan-db";
import { db } from "@wildfires-org/turboplan-db/db-client";
import { getApiEnv } from "@wildfires-org/turboplan-env";
import { getMailService } from "@wildfires-org/turboplan-mail/server";
import { Action, EntityType, MemberRole } from "@wildfires-org/turboplan-rbac";
import {
  getRBACServiceForRequest,
  NO_PERMISSION_REASON,
  type RBACContext,
  requirePermission,
} from "@wildfires-org/turboplan-rbac/hono";
import { createTimelineRecord } from "@wildfires-org/turboplan-timeline-records/server";

import { generateUniqueProjectSlug } from "../projects/queries";
import { getSubmissionReviewScope } from "../projects/submission-policy";
import {
  getPendingSubmission,
  SubmissionError,
  submitProjectForReview,
} from "../projects/submissions";

/**
 * Fetches the email context for a project submission by joining
 * project -> office -> organization and looking up the citizen email.
 */
const getProjectEmailContext = async (projectId: string) => {
  const [row] = await db
    .select({
      projectSlug: project.slug,
      officeSlug: office.slug,
      organizationSlug: organization.slug,
      organizationName: organization.name,
      citizenEmail: userTable.email,
    })
    .from(projectSubmission)
    .innerJoin(project, eq(project.id, projectSubmission.projectId))
    .innerJoin(office, eq(office.id, project.officeId))
    .innerJoin(organization, eq(organization.id, office.organizationId))
    .innerJoin(userTable, eq(userTable.id, projectSubmission.submittedBy))
    .where(eq(projectSubmission.projectId, projectId))
    .limit(1);

  if (!row) {
    return null;
  }

  const env = getApiEnv();
  const projectUrl = `${env.TURBOPLAN_URL}/organizations/${row.organizationSlug}/offices/${row.officeSlug}/projects/${row.projectSlug}`;

  return {
    projectUrl,
    citizenEmail: row.citizenEmail,
    organizationName: row.organizationName,
  };
};

export const projectSubmissionsRouter = new Hono<RBACContext>();

// GET /user/submissions - List current user's project submissions
projectSubmissionsRouter.get("/user/submissions", async (c) => {
  try {
    const user = c.get("user");
    if (!user?.userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    // The project's CURRENT location (office + org) is resolved via the
    // project's live officeId, which differs from the submission's target org
    // after the project is moved (gov office while submitted/accepted, back in
    // the citizen office after reject). Alias these joins so they don't collide
    // with the `organization` join used for targetOrganizationName.
    const currentOffice = alias(office, "current_office");
    const currentOrganization = alias(organization, "current_organization");

    const submissions = await db
      .select({
        id: projectSubmission.id,
        projectId: projectSubmission.projectId,
        projectName: project.name,
        projectSlug: project.slug,
        projectDescription: project.description,
        ownershipStatus: project.ownershipStatus,
        targetOrganizationName: organization.name,
        currentOrganizationSlug: currentOrganization.slug,
        currentOfficeSlug: currentOffice.slug,
        coverImageUrl: generatedImages.imageUrl,
        creatorEmail: userTable.email,
        creatorFirstName: profile.firstName,
        creatorLastName: profile.lastName,
        createdAt: project.createdAt,
        submittedAt: projectSubmission.createdAt,
      })
      .from(projectSubmission)
      .innerJoin(project, eq(projectSubmission.projectId, project.id))
      .innerJoin(
        organization,
        eq(projectSubmission.targetOrganizationId, organization.id),
      )
      .innerJoin(currentOffice, eq(project.officeId, currentOffice.id))
      .innerJoin(
        currentOrganization,
        eq(currentOffice.organizationId, currentOrganization.id),
      )
      .leftJoin(generatedImages, eq(project.coverImageId, generatedImages.id))
      .leftJoin(userTable, eq(project.createdBy, userTable.id))
      .leftJoin(profile, eq(project.createdBy, profile.userId))
      .where(eq(projectSubmission.submittedBy, user.userId));

    return c.json(submissions);
  } catch (error) {
    console.error("Failed to get user submissions:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// PATCH /:projectId/review - Accept or reject a submitted project
const reviewProjectSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal(OwnershipStatus.ACCEPTED),
    // Destination office for the project. Required only when the submission
    // itself did not specify a targetOfficeId; the reviewer picks one here.
    officeId: z.string().uuid().optional(),
    ownerEmail: z.string().email().optional(),
    members: z
      .array(
        z.object({
          email: z.string().email(),
          role: z.enum([
            MemberRole.OWNER,
            MemberRole.EDITOR,
            MemberRole.VIEWER,
          ]),
        }),
      )
      .optional(),
  }),
  z.object({
    action: z.literal(OwnershipStatus.REJECTED),
    rejectionReason: z.string().min(1),
  }),
]);

projectSubmissionsRouter.patch(
  "/:projectId/review",
  // Authorisation is resolved inside the handler: the reviewer must hold
  // MANAGE_MEMBERS on the submission's TARGET office (or organization for
  // legacy rows), never on the project — the project's own members are the
  // applicants. Reviewing also mints project owners (ownerEmail + members[]),
  // which is a membership operation, hence MANAGE_MEMBERS.
  async (c) => {
    try {
      const projectId = c.req.param("projectId")!;
      const currentUser = c.get("user");

      if (!currentUser?.userId) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      // No pending submission answers with the same 403 as a denial so the
      // route is not an oracle for which projects are under review.
      const submission = await getPendingSubmission(projectId);
      if (!submission) {
        return c.json(
          { error: "Forbidden", reason: NO_PERMISSION_REASON },
          403,
        );
      }

      const reviewScope = getSubmissionReviewScope(submission);
      const permissionResult = await getRBACServiceForRequest(
        c,
      ).checkPermission(
        currentUser.userId,
        reviewScope.entityId,
        reviewScope.entityType,
        Action.MANAGE_MEMBERS,
        { email: currentUser.email },
      );

      if (!permissionResult.allowed) {
        return c.json(
          { error: "Forbidden", reason: permissionResult.reason },
          403,
        );
      }

      const body = await c.req.json();
      const validationResult = reviewProjectSchema.safeParse(body);

      if (!validationResult.success) {
        return c.json(
          {
            error: "Validation failed",
            details: validationResult.error.issues,
          },
          400,
        );
      }

      const validated = validationResult.data;
      const { action } = validated;

      // Verify the project exists and is in submitted status
      const [existingProject] = await db
        .select()
        .from(project)
        .where(eq(project.id, projectId))
        .limit(1);

      if (!existingProject) {
        return c.json({ error: "Project not found" }, 404);
      }

      if (existingProject.ownershipStatus !== OwnershipStatus.SUBMITTED) {
        return c.json(
          { error: "Only submitted projects can be reviewed" },
          400,
        );
      }

      // Resolve the destination office for an accepted submission. The project
      // physically moves into this office, which must belong to the target
      // organization the submission was made to.
      let destinationOfficeId: string | null = null;
      if (validated.action === OwnershipStatus.ACCEPTED) {
        destinationOfficeId =
          submission.targetOfficeId ?? validated.officeId ?? null;

        if (!destinationOfficeId) {
          return c.json({ error: "A destination office is required" }, 400);
        }

        const [destinationOffice] = await db
          .select({ id: office.id })
          .from(office)
          .where(
            and(
              eq(office.id, destinationOfficeId),
              eq(office.organizationId, submission.targetOrganizationId),
            ),
          )
          .limit(1);

        if (!destinationOffice) {
          return c.json(
            {
              error:
                "Destination office does not belong to the target organization",
            },
            400,
          );
        }
      }

      // On reject, move the project back to the office it lived in before the
      // submit-time move. Generate a fresh unique slug for that source office.
      // Legacy submissions may have a null sourceOfficeId — skip the move then.
      let rejectOfficeId: string | null = null;
      let rejectSlug: string | null = null;
      if (
        validated.action === OwnershipStatus.REJECTED &&
        submission.sourceOfficeId
      ) {
        rejectOfficeId = submission.sourceOfficeId;
        rejectSlug = await generateUniqueProjectSlug(
          rejectOfficeId,
          existingProject.name,
        );
      }

      const now = new Date();

      // Wrap all DB writes in a transaction for atomicity
      await db.transaction(async (tx) => {
        await tx
          .update(project)
          .set({
            ownershipStatus:
              // A rejected project returns to draft so the submitter can edit
              // and resubmit it; an accepted project records the accepted state.
              action === OwnershipStatus.REJECTED
                ? OwnershipStatus.DRAFT
                : action,
            // An accepted project is already in the target office (moved at
            // submit time), so this is effectively idempotent. Visibility is
            // NOT changed here — publishing is a separate, explicit action;
            // ownership transfer must not auto-publish.
            ...(action === OwnershipStatus.ACCEPTED && {
              officeId: destinationOfficeId!,
            }),
            // A rejected project moves back to its pre-submit source office
            // (when known) so it returns to the citizen's personal workspace.
            ...(rejectOfficeId &&
              rejectSlug && {
                officeId: rejectOfficeId,
                slug: rejectSlug,
                slugHistory: [
                  ...existingProject.slugHistory,
                  existingProject.slug,
                ],
              }),
          })
          .where(eq(project.id, projectId));

        // Update the submission record with review details
        await tx
          .update(projectSubmission)
          .set({
            reviewedBy: currentUser.userId,
            reviewedAt: now,
            rejectionReason:
              validated.action === OwnershipStatus.REJECTED
                ? validated.rejectionReason
                : null,
            updatedAt: now,
          })
          .where(eq(projectSubmission.id, submission.id));

        // Add owner and members when accepting a project
        if (validated.action === OwnershipStatus.ACCEPTED) {
          if (validated.ownerEmail) {
            const [ownerUser] = await tx
              .select({ id: userTable.id })
              .from(userTable)
              .where(eq(userTable.email, validated.ownerEmail))
              .limit(1);

            if (ownerUser) {
              await tx
                .insert(projectUsers)
                .values({
                  userId: ownerUser.id,
                  projectId,
                  role: MemberRole.OWNER,
                  createdAt: now,
                  updatedAt: now,
                })
                .onConflictDoUpdate({
                  target: [projectUsers.userId, projectUsers.projectId],
                  set: {
                    role: MemberRole.OWNER,
                    updatedAt: now,
                  },
                });
            }
          }

          // Batch lookup and insert members to avoid N+1 queries
          const { members } = validated;
          if (members && members.length > 0) {
            const emails = members.map((m) => m.email);
            const foundUsers = await tx
              .select({ id: userTable.id, email: userTable.email })
              .from(userTable)
              .where(inArray(userTable.email, emails));

            const emailToId = new Map(foundUsers.map((u) => [u.email, u.id]));

            const memberValues = members
              .filter((m) => emailToId.has(m.email))
              .map((m) => ({
                userId: emailToId.get(m.email)!,
                projectId,
                role: m.role,
                createdAt: now,
                updatedAt: now,
              }));

            if (memberValues.length > 0) {
              await tx
                .insert(projectUsers)
                .values(memberValues)
                .onConflictDoUpdate({
                  target: [projectUsers.userId, projectUsers.projectId],
                  set: {
                    role: sql`excluded.role`,
                    updatedAt: now,
                  },
                });
            }
          }
        }

        // Restore the submitter when rejecting: undo the submit-time downgrade
        // so they regain ownership and can edit / resubmit the draft. Submitting
        // requires MANAGE_MEMBERS, so the submitter was an owner beforehand.
        // Other members downgraded at submit time stay VIEWER — the restored
        // owner can re-grant roles, and nothing is escalated implicitly.
        if (validated.action === OwnershipStatus.REJECTED) {
          await tx
            .update(projectUsers)
            .set({ role: MemberRole.OWNER, updatedAt: now })
            .where(
              and(
                eq(projectUsers.userId, submission.submittedBy),
                eq(projectUsers.projectId, projectId),
              ),
            );
        }
      });

      // Timeline records and emails are kept outside the transaction
      // because they use their own DB client / external services
      if (action === OwnershipStatus.ACCEPTED) {
        await createTimelineRecord({
          projectId,
          userId: currentUser.userId,
          entityType: "project",
          entityId: projectId,
          entityName: existingProject.name,
          action: "updated",
          title: "Proposal approved",
          description:
            "The proposal has been approved and the project has been created.",
          changes: [
            {
              field: "ownershipStatus",
              previousValue: OwnershipStatus.SUBMITTED,
              newValue: OwnershipStatus.ACCEPTED,
              valueType: "enum",
            },
          ],
          isPublic: true,
        });

        // Send acceptance email to the citizen
        try {
          const emailContext = await getProjectEmailContext(projectId);
          if (emailContext) {
            const mailService = getMailService();
            await mailService.sendSubmissionAcceptanceEmail({
              to: emailContext.citizenEmail,
              citizenEmail: emailContext.citizenEmail,
              projectName: existingProject.name,
              organizationName: emailContext.organizationName,
              projectUrl: emailContext.projectUrl,
            });
          }
        } catch (emailError) {
          console.error("Failed to send acceptance email:", emailError);
        }
      }

      if (validated.action === OwnershipStatus.REJECTED) {
        const { rejectionReason } = validated;

        await createTimelineRecord({
          projectId,
          userId: currentUser.userId,
          entityType: "project",
          entityId: projectId,
          entityName: existingProject.name,
          action: "updated",
          title: "Proposal rejected",
          description: `The proposal has been rejected. Reason: ${rejectionReason}`,
          changes: [
            {
              field: "ownershipStatus",
              previousValue: OwnershipStatus.SUBMITTED,
              newValue: OwnershipStatus.REJECTED,
              valueType: "enum",
            },
          ],
          isPublic: true,
        });

        // Send rejection email to the citizen
        try {
          const emailContext = await getProjectEmailContext(projectId);
          if (emailContext) {
            const mailService = getMailService();
            await mailService.sendSubmissionRejectionEmail({
              to: emailContext.citizenEmail,
              citizenEmail: emailContext.citizenEmail,
              projectName: existingProject.name,
              organizationName: emailContext.organizationName,
              rejectionReason,
              submissionUrl: emailContext.projectUrl,
            });
          }
        } catch (emailError) {
          console.error("Failed to send rejection email:", emailError);
        }
      }

      return c.json({ success: true, ownershipStatus: action });
    } catch (error) {
      console.error("Failed to review project submission:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  },
);

// POST /:projectId/submit - Submit a citizen project to an organization
const submitProjectSchema = z.object({
  targetOrganizationId: z.string().uuid(),
  // Required: the citizen must pick a destination office. The project is
  // physically moved into this office at submit time so government reviewers
  // (who only get RBAC through their own org/office hierarchy) can see it.
  targetOfficeId: z.string().uuid(),
});

// Map a SubmissionError code to the HTTP status + error string this route has
// always returned, so the shared submit flow stays response-compatible.
const submissionErrorToResponse = (
  error: SubmissionError,
): { status: 400 | 404; body: { error: string } } => {
  switch (error.code) {
    case "not_found":
      return { status: 404, body: { error: "Project not found" } };
    case "not_draft":
      return {
        status: 400,
        body: { error: "Project can only be submitted from draft status" },
      };
    case "target_not_found":
      return { status: 404, body: { error: "Target organization not found" } };
    case "target_personal":
      return {
        status: 400,
        body: { error: "Cannot submit to a personal organization" },
      };
    case "office_mismatch":
      return {
        status: 404,
        body: { error: "Office not found in the target organization" },
      };
  }
};

projectSubmissionsRouter.post(
  "/:projectId/submit",
  // Submitting hands the project to another organization and strips every
  // member's role, so it is an owner-level (MANAGE_MEMBERS) operation — an
  // Editor must not be able to give away an Owner's project.
  requirePermission(
    EntityType.PROJECT,
    Action.MANAGE_MEMBERS,
    (c) => c.req.param("projectId")!,
  ),
  async (c) => {
    try {
      const projectId = c.req.param("projectId")!;
      const user = c.get("user");

      if (!user?.userId) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const body = await c.req.json();
      const validationResult = submitProjectSchema.safeParse(body);

      if (!validationResult.success) {
        return c.json(
          {
            error: "Validation failed",
            details: validationResult.error.issues,
          },
          400,
        );
      }

      const { targetOrganizationId, targetOfficeId } = validationResult.data;

      try {
        const { submission } = await submitProjectForReview({
          projectId,
          submittedBy: user.userId,
          targetOrganizationId,
          targetOfficeId,
        });

        return c.json(submission);
      } catch (error) {
        if (error instanceof SubmissionError) {
          const { status, body: errorBody } = submissionErrorToResponse(error);
          return c.json(errorBody, status);
        }
        throw error;
      }
    } catch (error) {
      console.error("Failed to submit project:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  },
);
