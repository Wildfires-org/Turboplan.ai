/**
 * Canonical list of project module identifiers.
 *
 * Stored on the `project` row (see `privateModules` / `hiddenModules` JSON
 * columns). Lives in turboplan-db so both client packages (workspace) and
 * low-level infra (rbac) can type-check against the same source.
 */
export const PROJECT_MODULES = [
  "map",
  "tasks",
  "fields",
  "context",
  "documents",
  "timeline",
  "comments",
] as const;

export type ProjectModule = (typeof PROJECT_MODULES)[number];

/**
 * User-facing labels for each module.
 */
export const MODULE_DISPLAY_NAMES: Record<ProjectModule, string> = {
  map: "Map",
  tasks: "Tasks",
  fields: "Fields",
  context: "Context",
  documents: "Documents",
  comments: "Comments",
  timeline: "Timeline",
};
