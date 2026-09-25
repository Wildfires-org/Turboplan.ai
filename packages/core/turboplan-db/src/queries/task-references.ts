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
import { and, eq, inArray, or, type SQL, sql } from "drizzle-orm";

import { db } from "../db-client";
import { milestones, tasks, user } from "../schemas";

/**
 * SQL condition: the milestone row belongs to `projectId`.
 *
 * Two columns can carry the project. New milestones set both `documentId` and
 * `projectId` to the project id; legacy milestones point `documentId` at the
 * chat `Document` they were generated from and hold the project only in
 * `projectId`. Either match counts.
 */
export const milestoneInProject = (projectId: string): SQL =>
  or(
    eq(milestones.documentId, projectId),
    eq(milestones.projectId, projectId),
  ) as SQL;

/**
 * SQL condition: the task row belongs to `projectId`.
 *
 * `tasks` has no `projectId` column. New tasks store the project in
 * `documentId`; legacy tasks store a chat `Document` id there, so for them
 * membership is inherited from their milestone (`milestoneId` is NOT NULL),
 * judged by {@link milestoneInProject}.
 */
export const taskInProject = (projectId: string): SQL =>
  or(
    eq(tasks.documentId, projectId),
    sql`exists (select 1 from ${milestones} where ${milestones.id} = ${tasks.milestoneId} and ${milestoneInProject(projectId)})`,
  ) as SQL;

/**
 * SQL expression: the project a milestone row belongs to.
 *
 * `projectId` wins when set — on legacy rows it is the only column holding the
 * project, `documentId` being the chat `Document` the milestone came from. New
 * milestones carry the project in both columns; the few that only ever set
 * `documentId` fall back to it.
 */
export const milestoneProjectId: SQL<string | null> = sql<
  string | null
>`coalesce(${milestones.projectId}, ${milestones.documentId})`;

/**
 * SQL expression: the project a task row belongs to.
 *
 * Inherited from the task's milestone (see {@link milestoneProjectId}), since a
 * legacy task's own `documentId` is a chat `Document` id. Falls back to the
 * task's `documentId` only if the milestone row is gone.
 */
export const taskProjectId: SQL<string | null> = sql<
  string | null
>`coalesce((select ${milestoneProjectId} from ${milestones} where ${milestones.id} = ${tasks.milestoneId}), ${tasks.documentId})`;

/**
 * The project owning milestone `id` (see {@link milestoneProjectId}), or `null`
 * when no such milestone exists.
 */
export const getMilestoneProjectId = async (
  id: string,
): Promise<string | null> => {
  const rows = await db
    .select({ projectId: milestoneProjectId })
    .from(milestones)
    .where(eq(milestones.id, id))
    .limit(1);

  return rows[0]?.projectId ?? null;
};

/**
 * The project owning task `id` (see {@link taskProjectId}), or `null` when no
 * such task exists.
 */
export const getTaskProjectId = async (id: string): Promise<string | null> => {
  const rows = await db
    .select({ projectId: taskProjectId })
    .from(tasks)
    .where(eq(tasks.id, id))
    .limit(1);

  return rows[0]?.projectId ?? null;
};

/** Of `ids`, those naming a task inside `projectId` (see {@link taskInProject}). */
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
    .where(and(inArray(tasks.id, ids), taskInProject(projectId)));

  return rows.map((row) => row.id);
};

/**
 * Of `ids`, those naming a milestone inside `projectId` (see
 * {@link milestoneInProject}).
 */
export const getMilestoneIdsInProject = async (
  projectId: string,
  ids: string[],
): Promise<string[]> => {
  if (ids.length === 0) {
    return [];
  }

  const rows = await db
    .select({ id: milestones.id })
    .from(milestones)
    .where(and(inArray(milestones.id, ids), milestoneInProject(projectId)));

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
