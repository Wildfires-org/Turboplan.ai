import { OwnershipStatus } from "@wildfires-org/turboplan-db";

interface DraftVisibilityProject {
  ownershipStatus: string;
  createdBy: string;
}

/**
 * Draft-project visibility rule (org-type dependent).
 *
 * In government orgs a draft is a citizen submission that has not been sent yet,
 * so gov staff must not see it pre-submission — drafts are visible only to their
 * creator. In non-government orgs (personal, etc.) citizens can't submit, so a
 * draft would otherwise stay draft forever and be invisible to every other
 * member; there any member with RBAC READ access may see the draft.
 *
 * @param isGovOrg    whether the owning organization is a government org.
 * @param hasRbacRead whether the user has real RBAC READ access to the project.
 *                    False when they only reached the project via the
 *                    public-government-project bypass — such users never see
 *                    other people's drafts.
 * @returns true when the draft must be hidden from this user.
 */
export const isDraftHiddenFromUser = (
  project: DraftVisibilityProject,
  userId: string,
  isGovOrg: boolean,
  hasRbacRead: boolean,
): boolean => {
  if (project.ownershipStatus !== OwnershipStatus.DRAFT) {
    return false;
  }
  if (project.createdBy === userId) {
    return false;
  }
  return isGovOrg || !hasRbacRead;
};
