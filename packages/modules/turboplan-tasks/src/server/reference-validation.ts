/**
 * Cross-entity reference validation for task and milestone writes.
 *
 * A task carries three arrays of ids that point at rows other than its own —
 * `projectDocumentIds`, `dependencies` (other tasks) and `assigneeIds`; a
 * milestone carries `assigneeIds`. None of them is a foreign key, and the RBAC
 * guard only proves the caller may write *this* project, so nothing otherwise
 * stops an Editor on project A from submitting ids owned by project B. That is
 * not merely untidy: the task update handler expands `projectDocumentIds` into
 * url/filename/mimeType on project A's timeline record, which turns an
 * unvalidated id into a cross-tenant metadata and storage-URL leak.
 *
 * Two rules hold everywhere below.
 *
 * Reject, never drop. Filtering the offending ids out would hide an attack and
 * an ordinary client bug equally well; the caller gets a 400 instead.
 *
 * One message for both failures. An id that does not exist and an id that
 * belongs to another project are reported identically, so these endpoints
 * cannot be used to enumerate another tenant's rows.
 *
 * `assigneeIds` is deliberately the weak one — see {@link validateAssigneeIds}.
 */

import {
  getExistingUserIds,
  getProjectDocumentsByIds,
  getTaskIdsInProject,
} from "@wildfires-org/turboplan-db/queries";

/** Ids a task write may carry that name rows outside the task itself. */
type TaskReferences = {
  projectDocumentIds?: string[];
  dependencies?: string[];
  assigneeIds?: string[];
};

/** A caller-facing 400 message, or `null` when every reference checks out. */
export type ReferenceValidationError = string | null;

const unique = (ids: string[] | undefined): string[] =>
  ids === undefined ? [] : [...new Set(ids)];

/** True when any requested id is absent from what the lookup resolved. */
const anyUnresolved = (requested: string[], resolved: string[]): boolean => {
  const found = new Set(resolved);
  return requested.some((id) => !found.has(id));
};

/**
 * Check that every assignee names a real user.
 *
 * Assignment is intentionally *not* restricted to members of the project. The
 * picker is fed by `GET /api/projects/:id/assignable-users` (hierarchy members
 * plus existing assignees), but other flows — AI-generated plans resolving an
 * email, invite-with-task-assignment — may legitimately name someone outside
 * that list. Residual risk is small: an assignee id is a user id the caller
 * already held, and unlike a document id it is never expanded into row data on
 * the timeline.
 */
export const validateAssigneeIds = async (
  assigneeIds: string[] | undefined,
): Promise<ReferenceValidationError> => {
  const ids = unique(assigneeIds);
  if (ids.length === 0) {
    return null;
  }

  const existing = await getExistingUserIds(ids);
  if (anyUnresolved(ids, existing)) {
    return "One or more assigneeIds do not name an existing user";
  }

  return null;
};

/**
 * Check every cross-entity id on a task write against `projectId`, the project
 * the task belongs to (its `documentId`).
 */
export const validateTaskReferences = async (
  projectId: string,
  references: TaskReferences,
): Promise<ReferenceValidationError> => {
  const documentIds = unique(references.projectDocumentIds);
  if (documentIds.length > 0) {
    const documents = await getProjectDocumentsByIds(documentIds, projectId);
    if (
      anyUnresolved(
        documentIds,
        documents.map((document) => document.id),
      )
    ) {
      return "One or more projectDocumentIds do not belong to this project";
    }
  }

  const dependencyIds = unique(references.dependencies);
  if (dependencyIds.length > 0) {
    const resolved = await getTaskIdsInProject(projectId, dependencyIds);
    if (anyUnresolved(dependencyIds, resolved)) {
      return "One or more dependencies do not belong to this project";
    }
  }

  return validateAssigneeIds(references.assigneeIds);
};
