// Where files dropped on the project Context page go: the project, or its
// organization's context (shared with every project in it).

export type ContextUploadTarget = "project" | "organization";

type UploadTargetPermissions = {
  /** The project dropzone shows (project UPDATE, documents or map module on) */
  canAddProjectFiles: boolean;
  /** Organization UPDATE, with the organization context feature on */
  canAddOrganizationFiles: boolean;
};

/** The targets this user may add files to, project first. */
export const getContextUploadTargets = ({
  canAddProjectFiles,
  canAddOrganizationFiles,
}: UploadTargetPermissions): ContextUploadTarget[] => {
  const targets: ContextUploadTarget[] = [];
  if (canAddProjectFiles) {
    targets.push("project");
  }
  if (canAddOrganizationFiles) {
    targets.push("organization");
  }
  return targets;
};

/**
 * The remembered choice when it is still allowed, else the first allowed
 * target; null when files cannot be added anywhere. `preferred` comes from
 * localStorage, so any value is possible.
 */
export const pickContextUploadTarget = (
  targets: ContextUploadTarget[],
  preferred: unknown,
): ContextUploadTarget | null => {
  const match = targets.find((target) => target === preferred);
  return match ?? targets[0] ?? null;
};
