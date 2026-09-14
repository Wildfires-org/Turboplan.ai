import { and, desc, eq, inArray } from "drizzle-orm";

import { db } from "../db-client";
import {
  type NewProjectDocument,
  type ProjectDocument,
  type ProjectDocumentSource,
  profile,
  projectDocument,
  user,
} from "../schemas";

/**
 * Get all documents for a project, ordered by creation date (newest first).
 * Includes uploader information (user email and profile).
 *
 * Pass `source` to return only documents of that origin (e.g. "upload" for the
 * Documents page, "research" for the Context page). Omit it to return all.
 */
export async function getProjectDocumentsByProjectId(
  projectId: string,
  source?: ProjectDocumentSource,
): Promise<
  Array<
    ProjectDocument & {
      uploader: {
        id: string;
        email: string;
        firstName: string | null;
        lastName: string | null;
      } | null;
    }
  >
> {
  const results = await db
    .select({
      id: projectDocument.id,
      projectId: projectDocument.projectId,
      userId: projectDocument.userId,
      filename: projectDocument.filename,
      originalFilename: projectDocument.originalFilename,
      mimeType: projectDocument.mimeType,
      size: projectDocument.size,
      url: projectDocument.url,
      source: projectDocument.source,
      relevance: projectDocument.relevance,
      context: projectDocument.context,
      folder: projectDocument.folder,
      folderDescription: projectDocument.folderDescription,
      createdAt: projectDocument.createdAt,
      uploader: {
        id: user.id,
        email: user.email,
        firstName: profile.firstName,
        lastName: profile.lastName,
      },
    })
    .from(projectDocument)
    .leftJoin(user, eq(projectDocument.userId, user.id))
    .leftJoin(profile, eq(user.id, profile.userId))
    .where(
      source
        ? and(
            eq(projectDocument.projectId, projectId),
            eq(projectDocument.source, source),
          )
        : eq(projectDocument.projectId, projectId),
    )
    .orderBy(desc(projectDocument.createdAt));

  return results.map((row) => ({
    ...row,
    uploader: row.uploader.id
      ? (row.uploader as {
          id: string;
          email: string;
          firstName: string | null;
          lastName: string | null;
        })
      : null,
  }));
}

/**
 * Get a single project document by ID
 */
export async function getProjectDocumentById(
  id: string,
): Promise<ProjectDocument | null> {
  const [result] = await db
    .select()
    .from(projectDocument)
    .where(eq(projectDocument.id, id))
    .limit(1);

  return result ?? null;
}

/**
 * Get multiple project documents by their IDs.
 *
 * Pass `projectId` to scope the lookup to a single project. Ids belonging to
 * another project are then simply absent from the result, so a caller can spot
 * a cross-project reference by comparing the result size to what it asked for —
 * without ever reading a foreign project's row. Callers that hand document
 * metadata (url, filename, mime type) to a project-scoped consumer such as a
 * timeline record MUST pass it.
 */
export async function getProjectDocumentsByIds(
  ids: string[],
  projectId?: string,
): Promise<ProjectDocument[]> {
  if (ids.length === 0) {
    return [];
  }
  return db
    .select()
    .from(projectDocument)
    .where(
      projectId
        ? and(
            inArray(projectDocument.id, ids),
            eq(projectDocument.projectId, projectId),
          )
        : inArray(projectDocument.id, ids),
    );
}

/**
 * Create a new project document record
 */
export async function createProjectDocument(
  data: NewProjectDocument,
): Promise<ProjectDocument> {
  const [result] = await db.insert(projectDocument).values(data).returning();

  return result;
}

/**
 * Delete a project document record
 */
export async function deleteProjectDocument(id: string): Promise<void> {
  await db.delete(projectDocument).where(eq(projectDocument.id, id));
}

/**
 * Update the display name (originalFilename) of a project document.
 * Storage fields (filename, url) are intentionally left untouched.
 */
export const updateProjectDocument = async (
  id: string,
  data: { originalFilename: string },
): Promise<ProjectDocument | null> => {
  const [result] = await db
    .update(projectDocument)
    .set({ originalFilename: data.originalFilename })
    .where(eq(projectDocument.id, id))
    .returning();

  return result ?? null;
};
