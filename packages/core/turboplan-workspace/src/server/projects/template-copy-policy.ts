/**
 * Which kinds of project content a template copy carries over. Each flag maps
 * to the module that owns that content:
 * - fields → `projectField` rows ("fields")
 * - tasks → milestones, tasks and the `document` rows they reference ("tasks")
 * - uploadedDocuments → `projectDocument` with source "upload" ("documents")
 * - researchDocuments → `projectDocument` with source "research" ("context")
 */
export type TemplateCopyScope = {
  fields: boolean;
  tasks: boolean;
  uploadedDocuments: boolean;
  researchDocuments: boolean;
};

/**
 * Modules a caller without a project role must not receive: everything the
 * owner hid or kept private.
 */
export const getPubliclyRestrictedModules = (
  hiddenModules: readonly string[] | null | undefined,
  privateModules: readonly string[] | null | undefined,
): string[] => [
  ...new Set([...(hiddenModules ?? []), ...(privateModules ?? [])]),
];

export const resolveTemplateCopyScope = (
  excludedModules: readonly string[] = [],
): TemplateCopyScope => {
  const excluded = new Set(excludedModules);
  return {
    fields: !excluded.has("fields"),
    tasks: !excluded.has("tasks"),
    uploadedDocuments: !excluded.has("documents"),
    researchDocuments: !excluded.has("context"),
  };
};

/**
 * Whether a `projectDocument` row with the given `source` may be copied.
 * Unknown sources are treated as uploads (the column default).
 */
export const isProjectDocumentInScope = (
  source: string,
  scope: TemplateCopyScope,
): boolean =>
  source === "research" ? scope.researchDocuments : scope.uploadedDocuments;
