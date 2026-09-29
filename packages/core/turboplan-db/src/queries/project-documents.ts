import { and, asc, desc, eq, inArray } from "drizzle-orm";

import { db } from "../db-client";
import {
  type NewProjectDocument,
  type ProjectDocument,
  type ProjectDocumentExtractionStatus,
  type ProjectDocumentSource,
  profile,
  projectDocument,
  user,
} from "../schemas";

/**
 * Every project document column except `extractedText`, which can hold up to
 * 40k characters per row and is only ever wanted one document at a time.
 * Queries that return lists select this instead of `select()` so the text does
 * not travel with every listing.
 */
const projectDocumentColumns = {
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
  extractionStatus: projectDocument.extractionStatus,
  extractionError: projectDocument.extractionError,
  extractedAt: projectDocument.extractedAt,
  createdAt: projectDocument.createdAt,
} as const;

/** A project document row without its (potentially huge) extracted text. */
export type ProjectDocumentListItem = Omit<ProjectDocument, "extractedText">;

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
    ProjectDocumentListItem & {
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
      ...projectDocumentColumns,
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
): Promise<ProjectDocumentListItem[]> {
  if (ids.length === 0) {
    return [];
  }
  return db
    .select(projectDocumentColumns)
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
 * Whether any project document row still points at `url`. Copied projects
 * (templates, duplicates) share one stored object across rows, so the object
 * may only be deleted once no row references it.
 */
export const hasProjectDocumentWithUrl = async (
  url: string,
): Promise<boolean> => {
  const [row] = await db
    .select({ id: projectDocument.id })
    .from(projectDocument)
    .where(eq(projectDocument.url, url))
    .limit(1);
  return row !== undefined;
};

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

/**
 * Record the outcome of a text extraction run for a document.
 *
 * `extractedAt` is stamped only when the status is "done" — a failed or
 * unsupported run leaves the previous timestamp (and text) alone unless the
 * caller explicitly passes `extractedText: null`.
 */
export const updateProjectDocumentExtraction = async (
  id: string,
  data: {
    extractionStatus: ProjectDocumentExtractionStatus;
    extractedText?: string | null;
    extractionError?: string | null;
  },
): Promise<ProjectDocument | null> => {
  const [result] = await db
    .update(projectDocument)
    .set({
      extractionStatus: data.extractionStatus,
      ...(data.extractedText !== undefined
        ? { extractedText: data.extractedText }
        : {}),
      ...(data.extractionError !== undefined
        ? { extractionError: data.extractionError }
        : {}),
      ...(data.extractionStatus === "done" ? { extractedAt: new Date() } : {}),
    })
    .where(eq(projectDocument.id, id))
    .returning();

  return result ?? null;
};

/**
 * Oldest documents still awaiting extraction, for a backfill/worker pass.
 * Served by `project_document_extraction_status_idx`.
 */
export const getProjectDocumentsPendingExtraction = async (
  limit: number,
): Promise<ProjectDocumentListItem[]> => {
  return db
    .select(projectDocumentColumns)
    .from(projectDocument)
    .where(eq(projectDocument.extractionStatus, "pending"))
    .orderBy(asc(projectDocument.createdAt))
    .limit(limit);
};

/** Extraction payload for a document, as the chat tool reads it. */
export type ProjectDocumentExtraction = {
  id: string;
  projectId: string;
  originalFilename: string;
  mimeType: string;
  url: string;
  extractionStatus: ProjectDocumentExtractionStatus;
  extractedText: string | null;
  extractionError: string | null;
};

/**
 * Extracted text (plus the metadata needed to explain a miss) for the given
 * documents. This is the one query that deliberately reads `extractedText`.
 */
export const getProjectDocumentExtractionByIds = async (
  ids: string[],
): Promise<ProjectDocumentExtraction[]> => {
  if (ids.length === 0) {
    return [];
  }
  return db
    .select({
      id: projectDocument.id,
      projectId: projectDocument.projectId,
      originalFilename: projectDocument.originalFilename,
      mimeType: projectDocument.mimeType,
      url: projectDocument.url,
      extractionStatus: projectDocument.extractionStatus,
      extractedText: projectDocument.extractedText,
      extractionError: projectDocument.extractionError,
    })
    .from(projectDocument)
    .where(inArray(projectDocument.id, ids));
};
