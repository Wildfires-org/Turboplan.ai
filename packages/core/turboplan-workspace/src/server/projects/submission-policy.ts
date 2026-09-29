import type { ProjectSubmission } from "@wildfires-org/turboplan-db";
import { EntityType } from "@wildfires-org/turboplan-rbac";

/**
 * Visibility forced onto a project the moment it is submitted. An application
 * under review (and after acceptance) stays private and non-template until
 * agency staff explicitly publish it — whatever the citizen had set while the
 * project was still personal.
 */
export const SUBMITTED_PROJECT_VISIBILITY = {
  isPublic: false,
  isTemplate: false,
} as const;

export interface SubmissionReviewScope {
  entityType: typeof EntityType.OFFICE | typeof EntityType.ORGANIZATION;
  entityId: string;
}

/**
 * The entity whose staff may review a submission: the target office when the
 * submission names one (org owners inherit down to it), otherwise the target
 * organization (legacy submissions without a target office).
 *
 * Review is deliberately NOT authorised against the project itself — the
 * project's own members are the applicants and must never approve their own
 * application.
 */
export const getSubmissionReviewScope = (
  submission: Pick<
    ProjectSubmission,
    "targetOrganizationId" | "targetOfficeId"
  >,
): SubmissionReviewScope => {
  if (submission.targetOfficeId) {
    return {
      entityType: EntityType.OFFICE,
      entityId: submission.targetOfficeId,
    };
  }

  return {
    entityType: EntityType.ORGANIZATION,
    entityId: submission.targetOrganizationId,
  };
};
