/**
 * Existence lookups backing cross-entity reference validation on tasks and
 * milestones.
 *
 * `tasks.dependencies`, `tasks.projectDocumentIds`, `tasks.assigneeIds` and
 * `milestones.assigneeIds` are plain `text[]` columns with no foreign keys, so
 * the database accepts any id a caller submits — including ids owned by a
 * different project. These helpers return the subset of the requested ids that
 * actually resolves, letting a caller reject the whole write when anything is
 * unaccounted for.
 *
 * They deliberately return ids rather than rows: the caller only needs to know
 * "did all of these resolve", and an id that does not exist must be
 * indistinguishable from one that belongs to somebody else.
 */
import { and, eq, inArray } from "drizzle-orm";

import { db } from "../db-client";
import { tasks, user } from "../schemas";

/**
 * Of `ids`, those naming a task inside `projectId`.
 *
 * A task stores its owning project in `documentId` — the client passes
 * `documentId: projectId` for every task operation (see the tasks package's
 * `rbac-guards.ts`), and `tasks` has no `projectId` column of its own.
 */
export const getTaskIdsInProject = async (
  projectId: string,
  ids: string[],
): Promise<string[]> => {
  if (ids.length === 0) {
    return [];
  }

  const rows = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.documentId, projectId), inArray(tasks.id, ids)));

  return rows.map((row) => row.id);
};

/** Of `ids`, those naming an existing user. */
export const getExistingUserIds = async (ids: string[]): Promise<string[]> => {
  if (ids.length === 0) {
    return [];
  }

  const rows = await db
    .select({ id: user.id })
    .from(user)
    .where(inArray(user.id, ids));

  return rows.map((row) => row.id);
};
