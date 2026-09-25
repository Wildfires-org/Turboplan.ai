import type { ProjectModule } from "@wildfires-org/turboplan-db/types";

import { ENTITY_TYPES, type EntityType } from "../types";

/**
 * Project module each timeline entity type belongs to. `null` means the record
 * is about the project itself (or its membership) and is not gated by a module.
 */
const ENTITY_TYPE_MODULE: Record<EntityType, ProjectModule | null> = {
  project: null,
  member: null,
  task: "tasks",
  milestone: "tasks",
  dependency: "tasks",
  map_layer: "map",
  field: "fields",
  comment: "comments",
  context: "context",
  document: "documents",
};

/**
 * Entity types whose records a caller without a project role must not see,
 * because the project owner hid their module or kept it private.
 */
export const getPubliclyHiddenEntityTypes = (
  hiddenModules: readonly string[] | null | undefined,
  privateModules: readonly string[] | null | undefined,
): EntityType[] => {
  const restricted = new Set([
    ...(hiddenModules ?? []),
    ...(privateModules ?? []),
  ]);

  return ENTITY_TYPES.filter((entityType) => {
    const moduleName = ENTITY_TYPE_MODULE[entityType];
    return moduleName !== null && restricted.has(moduleName);
  });
};

/**
 * Projection served to anyone without a project role (the anonymous public
 * timeline and public-government readers): no author email, author id,
 * metadata or deletion marker.
 */
export const toPublicTimelineRecord = <T extends Record<string, unknown>>(
  record: T,
): Omit<T, "userId" | "metadata" | "deletedAt" | "authorEmail"> & {
  authorEmail: null;
} => {
  const {
    userId: _userId,
    metadata: _metadata,
    deletedAt: _deletedAt,
    authorEmail: _authorEmail,
    ...rest
  } = record;
  return { ...rest, authorEmail: null };
};
