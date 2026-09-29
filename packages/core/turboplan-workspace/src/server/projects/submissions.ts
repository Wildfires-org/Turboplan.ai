import { and, desc, eq, isNull, ne } from "drizzle-orm";

import {
  invitations,
  type Office,
  type Organization,
  OwnershipStatus,
  office,
  organization,
  type Project,
  type ProjectSubmission,
  project,
  projectSubmission,
  projectUsers,
} from "@wildfires-org/turboplan-db";
import { db } from "@wildfires-org/turboplan-db/db-client";
import { MemberRole } from "@wildfires-org/turboplan-rbac";
import { createTimelineRecord } from "@wildfires-org/turboplan-timeline-records/server";

import { generateUniqueProjectSlug } from "./queries";
import { SUBMITTED_PROJECT_VISIBILITY } from "./submission-policy";

// Transaction handle type used by applySubmissionTx. Drizzle does not export a
// dedicated tx type, so derive it from the db client's transaction callback.
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Stable error codes a caller can map to HTTP responses without string-matching.
 */
export type SubmissionErrorCode =
  | "not_found"
  | "not_draft"
  | "target_not_found"
  | "target_personal"
  | "office_mismatch";

/**
 * Typed error thrown by the submission flow so HTTP callers can map a stable
 * `code` to a status + message instead of inspecting free-text error strings.
 */
export class SubmissionError extends Error {
  readonly code: SubmissionErrorCode;

  constructor(code: SubmissionErrorCode, message: string) {
    super(message);
    this.name = "SubmissionError";
    this.code = code;
  }
}

interface PrepareSubmissionArgs {
  project: Project;
  targetOrganizationId: string;
  targetOfficeId: string;
}

interface PreparedSubmission {
  targetOrg: Organization;
  targetOffice: Office;
  newSlug: string;
}

/**
 * Validate the submission target and compute the destination slug.
 *
 * Runs OUTSIDE any transaction: generateUniqueProjectSlug queries the global db
 * client and cannot observe uncommitted writes, so the slug must be generated
 * before the tx (mirrors createProjectFromTemplate / createProject).
 *
 * Throws SubmissionError with a stable code on validation failure.
 */
export const prepareSubmission = async ({
  project: proj,
  targetOrganizationId,
  targetOfficeId,
}: PrepareSubmissionArgs): Promise<PreparedSubmission> => {
  const [targetOrg] = await db
    .select()
    .from(organization)
    .where(eq(organization.id, targetOrganizationId))
    .limit(1);

  if (!targetOrg) {
    throw new SubmissionError(
      "target_not_found",
      "Target organization not found",
    );
  }

  if (targetOrg.type === "personal") {
    throw new SubmissionError(
      "target_personal",
      "Cannot submit to a personal organization",
    );
  }

  // The destination office must belong to the target organization.
  const [targetOffice] = await db
    .select()
    .from(office)
    .where(
      and(
        eq(office.id, targetOfficeId),
        eq(office.organizationId, targetOrganizationId),
      ),
    )
    .limit(1);

  if (!targetOffice) {
    throw new SubmissionError(
      "office_mismatch",
      "Office not found in the target organization",
    );
  }

  const newSlug = await generateUniqueProjectSlug(targetOfficeId, proj.name);

  return { targetOrg, targetOffice, newSlug };
};

interface ApplySubmissionTxArgs {
  project: Project;
  targetOrganizationId: string;
  targetOfficeId: string;
  newSlug: string;
  submittedBy: string;
  now: Date;
}

/**
 * Apply the three atomic writes of a submission inside a transaction:
 * 1. Insert the projectSubmission record (capturing sourceOfficeId for revert).
 * 2. Physically MOVE the project into the destination office so government
 *    reviewers gain inherited RBAC over it; old slug is appended to slugHistory.
 *    The project is forced private and non-template (see
 *    SUBMITTED_PROJECT_VISIBILITY) — only agency staff may publish it later.
 * 3. Downgrade EVERY direct project member (and every pending project
 *    invitation) to VIEWER. Only the target organization's staff may manage
 *    the application from here on; a co-owner left in place could otherwise
 *    approve, publish or re-staff the application themselves.
 *
 * Returns the inserted submission row.
 */
export const applySubmissionTx = async (
  tx: Tx,
  {
    project: proj,
    targetOrganizationId,
    targetOfficeId,
    newSlug,
    submittedBy,
    now,
  }: ApplySubmissionTxArgs,
): Promise<ProjectSubmission> => {
  const [submission] = await tx
    .insert(projectSubmission)
    .values({
      projectId: proj.id,
      targetOrganizationId,
      targetOfficeId,
      // Capture the project's current office so a rejection can revert it.
      sourceOfficeId: proj.officeId,
      submittedBy,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  await tx
    .update(project)
    .set({
      officeId: targetOfficeId,
      slug: newSlug,
      slugHistory: [...proj.slugHistory, proj.slug],
      ownershipStatus: OwnershipStatus.SUBMITTED,
      ...SUBMITTED_PROJECT_VISIBILITY,
    })
    .where(eq(project.id, proj.id));

  await tx
    .update(projectUsers)
    .set({ role: MemberRole.VIEWER, updatedAt: now })
    .where(
      and(
        eq(projectUsers.projectId, proj.id),
        ne(projectUsers.role, MemberRole.VIEWER),
      ),
    );

  await tx
    .update(invitations)
    .set({ role: MemberRole.VIEWER, updatedAt: now })
    .where(
      and(
        eq(invitations.entityType, "project"),
        eq(invitations.entityId, proj.id),
        eq(invitations.status, "pending"),
        ne(invitations.role, MemberRole.VIEWER),
      ),
    );

  return submission;
};

/**
 * The submission currently awaiting review for a project: the newest row not
 * yet reviewed. A project can accumulate several rows (reject -> resubmit,
 * possibly to a different organization), so never pick an arbitrary one.
 */
export const getPendingSubmission = async (
  projectId: string,
): Promise<ProjectSubmission | null> => {
  const [submission] = await db
    .select()
    .from(projectSubmission)
    .where(
      and(
        eq(projectSubmission.projectId, projectId),
        isNull(projectSubmission.reviewedAt),
      ),
    )
    .orderBy(desc(projectSubmission.createdAt))
    .limit(1);

  return submission ?? null;
};

interface SubmitProjectForReviewArgs {
  projectId: string;
  submittedBy: string;
  targetOrganizationId: string;
  targetOfficeId: string;
}

interface SubmitProjectForReviewResult {
  submission: ProjectSubmission;
  location: {
    organizationSlug: string;
    officeSlug: string;
    projectSlug: string;
  };
}

/**
 * Full submit-for-review orchestration. Fetches the project, asserts it is in
 * DRAFT status, validates the target (prepareSubmission), runs the atomic writes
 * in a transaction, and writes the timeline record. Returns the inserted
 * submission plus the project's post-move location slugs so callers can redirect.
 *
 * Throws SubmissionError (with a stable code) for any validation failure so HTTP
 * callers can map to the appropriate status code.
 */
export const submitProjectForReview = async ({
  projectId,
  submittedBy,
  targetOrganizationId,
  targetOfficeId,
}: SubmitProjectForReviewArgs): Promise<SubmitProjectForReviewResult> => {
  const [existingProject] = await db
    .select()
    .from(project)
    .where(eq(project.id, projectId))
    .limit(1);

  if (!existingProject) {
    throw new SubmissionError("not_found", "Project not found");
  }

  if (existingProject.ownershipStatus !== OwnershipStatus.DRAFT) {
    throw new SubmissionError(
      "not_draft",
      "Project can only be submitted from draft status",
    );
  }

  const { targetOrg, targetOffice, newSlug } = await prepareSubmission({
    project: existingProject,
    targetOrganizationId,
    targetOfficeId,
  });

  const now = new Date();

  const submission = await db.transaction((tx) =>
    applySubmissionTx(tx, {
      project: existingProject,
      targetOrganizationId,
      targetOfficeId,
      newSlug,
      submittedBy,
      now,
    }),
  );

  await createTimelineRecord({
    projectId,
    userId: submittedBy,
    entityType: "project",
    entityId: projectId,
    entityName: existingProject.name,
    action: "updated",
    title: "Submitted proposal for review",
    description: `Project submitted to ${targetOrg.name} for ownership transfer.`,
    changes: [
      {
        field: "ownershipStatus",
        previousValue: OwnershipStatus.DRAFT,
        newValue: OwnershipStatus.SUBMITTED,
        valueType: "enum",
      },
    ],
    isPublic: true,
  });

  return {
    submission,
    location: {
      organizationSlug: targetOrg.slug,
      officeSlug: targetOffice.slug,
      projectSlug: newSlug,
    },
  };
};
