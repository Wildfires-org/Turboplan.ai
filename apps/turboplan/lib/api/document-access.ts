import { getProjectIdByDocumentId } from "@wildfires-org/turboplan-db/queries";
import { Action, EntityType } from "@wildfires-org/turboplan-rbac";
import { getRBACService } from "@wildfires-org/turboplan-rbac/server";
import { checkUserProjectAccess } from "@wildfires-org/turboplan-workspace/server";

/**
 * `read` — any effective role on the owning project (viewer included).
 * `write` — a real write permission (`Action.UPDATE`) on the owning project.
 *   Membership alone is NOT enough: a read-only viewer must not be able to
 *   overwrite or truncate another member's document.
 */
export type DocumentAccessLevel = "read" | "write";

interface DocumentAccessParams {
  documentId: string;
  /** `userId` of the document row being accessed. */
  documentOwnerId: string;
  /** The authenticated caller. */
  userId: string;
  access: DocumentAccessLevel;
}

/**
 * Single decision point for "can this user touch this document".
 *
 * Documents are owned by their author but shared through the project they hang
 * off, so every route that reads or writes one answers the same question. It
 * lives here so the answer cannot drift per route.
 *
 * Callers must have authenticated the user first — a `false` result means
 * "access denied" (HTTP 403), never "not signed in" (HTTP 401).
 */
export const hasDocumentAccess = async ({
  documentId,
  documentOwnerId,
  userId,
  access,
}: DocumentAccessParams): Promise<boolean> => {
  if (documentOwnerId === userId) {
    return true;
  }

  const projectId = await getProjectIdByDocumentId({ id: documentId });

  if (!projectId) {
    return false;
  }

  // Membership gate: also rejects soft-deleted projects.
  const isMember = await checkUserProjectAccess(userId, projectId);

  if (!isMember) {
    return false;
  }

  if (access === "read") {
    return true;
  }

  const permission = await getRBACService().checkPermission(
    userId,
    projectId,
    EntityType.PROJECT,
    Action.UPDATE,
  );

  return permission.allowed;
};
