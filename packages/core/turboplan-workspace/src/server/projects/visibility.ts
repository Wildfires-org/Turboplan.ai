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

interface ListedProject {
  id: string;
  creatorEmail: string | null;
}

/**
 * Merge an office's public project list (shown to any signed-in user of a
 * publicly listed org) with the projects the user reaches through RBAC,
 * de-duplicated by id and keeping the public list's order first.
 *
 * A project the user knows only from the public list is someone else's: its
 * creator's email is dropped (`null`, rendered as "Unknown"). Projects the user
 * can access keep it.
 */
export const mergePublicAndAccessibleProjects = <T extends ListedProject>(
  publicProjects: T[],
  accessibleProjects: T[],
): T[] => {
  const accessibleIds = new Set(accessibleProjects.map((p) => p.id));
  const publicIds = new Set(publicProjects.map((p) => p.id));

  return [
    ...publicProjects.map((p) =>
      accessibleIds.has(p.id) ? p : { ...p, creatorEmail: null },
    ),
    ...accessibleProjects.filter((p) => !publicIds.has(p.id)),
  ];
};
