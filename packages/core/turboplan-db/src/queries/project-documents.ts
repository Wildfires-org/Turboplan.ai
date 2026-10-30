import { and, asc, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";

import { db } from "../db-client";
import {
  type DocumentLetterheadStatus,
  letterheadPendingPredicate,
  MAX_LETTERHEAD_ATTEMPTS,
  type NewProjectDocument,
  type ProjectDocument,
  type ProjectDocumentExtractionStatus,
  type ProjectDocumentSource,
  profile,
  projectDocument,
  type StoredLetterheadAnalysis,
  user,
} from "../schemas";

/**
 * Every project document column except `extractedText`, which can hold up to
 * 40k characters per row and is only ever wanted one document at a time, and
 * the letterhead analysis columns.
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

/**
 * A project document row without its (potentially huge) extracted text and
 * without the letterhead analysis, which only the analysis loop and document
 * creation read (through their own queries).
 */
export type ProjectDocumentListItem = Omit<
  ProjectDocument,
  | "extractedText"
  | "letterheadStatus"
  | "letterheadAnalysis"
  | "letterheadAttempts"
>;

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
 * Storage fields (filename, url) are intentionally left untouched. Returns the
 * list columns: the rename route sends the row to the client as is.
 */
export const updateProjectDocument = async (
  id: string,
  data: { originalFilename: string },
): Promise<ProjectDocumentListItem | null> => {
  const [result] = await db
    .update(projectDocument)
    .set({ originalFilename: data.originalFilename })
    .where(eq(projectDocument.id, id))
    .returning(projectDocumentColumns);

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
  /** See {@link ProjectDocumentSource}; the column is a plain varchar */
  source: string;
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
      source: projectDocument.source,
      extractionStatus: projectDocument.extractionStatus,
      extractedText: projectDocument.extractedText,
      extractionError: projectDocument.extractionError,
    })
    .from(projectDocument)
    .where(inArray(projectDocument.id, ids));
};

/** The subset of a pending document the letterhead analysis loop needs. */
export type ProjectDocumentPendingLetterhead = Pick<
  ProjectDocument,
  "id" | "url" | "mimeType" | "originalFilename"
>;

/**
 * Newest documents still awaiting letterhead analysis with attempts left, for
 * the research agent's analysis loop: a fresh upload is analyzed within
 * seconds even with a backlog of older documents (they drain after it).
 * Served by the partial `project_document_letterhead_pending_idx`.
 */
export const getProjectDocumentsPendingLetterhead = async (
  limit: number,
): Promise<ProjectDocumentPendingLetterhead[]> => {
  return db
    .select({
      id: projectDocument.id,
      url: projectDocument.url,
      mimeType: projectDocument.mimeType,
      originalFilename: projectDocument.originalFilename,
    })
    .from(projectDocument)
    .where(
      and(
        letterheadPendingPredicate(projectDocument.letterheadStatus),
        lt(projectDocument.letterheadAttempts, MAX_LETTERHEAD_ATTEMPTS),
      ),
    )
    .orderBy(desc(projectDocument.createdAt))
    .limit(limit);
};

/**
 * Count one letterhead analysis attempt on a pending document, right before
 * its run: the attempts made so far, this one included, or null when the
 * document is gone, no longer pending or out of attempts (skip it).
 */
export const claimProjectDocumentLetterhead = async (
  id: string,
): Promise<number | null> => {
  const [claimed] = await db
    .update(projectDocument)
    .set({ letterheadAttempts: sql`${projectDocument.letterheadAttempts} + 1` })
    .where(
      and(
        eq(projectDocument.id, id),
        letterheadPendingPredicate(projectDocument.letterheadStatus),
        lt(projectDocument.letterheadAttempts, MAX_LETTERHEAD_ATTEMPTS),
      ),
    )
    .returning({ attempts: projectDocument.letterheadAttempts });

  return claimed?.attempts ?? null;
};

/**
 * Mark "failed" the documents still pending after their last attempt (each
 * failed temporarily, or crashed the process). Resolves how many.
 */
export const failExhaustedProjectDocumentLetterheads =
  async (): Promise<number> => {
    const failed = await db
      .update(projectDocument)
      .set({ letterheadStatus: "failed" })
      .where(
        and(
          letterheadPendingPredicate(projectDocument.letterheadStatus),
          gte(projectDocument.letterheadAttempts, MAX_LETTERHEAD_ATTEMPTS),
        ),
      )
      .returning({ id: projectDocument.id });

    return failed.length;
  };

/**
 * Record the outcome of a letterhead analysis run. False when the document no
 * longer exists.
 */
export const updateProjectDocumentLetterhead = async (
  id: string,
  {
    status,
    analysis,
  }: {
    status: DocumentLetterheadStatus;
    analysis: StoredLetterheadAnalysis | null;
  },
): Promise<boolean> => {
  const updated = await db
    .update(projectDocument)
    .set({ letterheadStatus: status, letterheadAnalysis: analysis })
    .where(eq(projectDocument.id, id))
    .returning({ id: projectDocument.id });

  return updated.length > 0;
};

/** A reference document's letterhead analysis, as document creation reads it. */
export type ProjectDocumentLetterheadAnalysis = Pick<
  ProjectDocument,
  "id" | "originalFilename" | "letterheadStatus" | "letterheadAnalysis"
>;

/**
 * Letterhead analyses of the given documents of one project. Ids belonging to
 * another project are simply absent from the result (IDOR guard).
 */
export const getProjectDocumentLetterheadAnalyses = async (
  projectId: string,
  ids: string[],
): Promise<ProjectDocumentLetterheadAnalysis[]> => {
  if (ids.length === 0) {
    return [];
  }
  return db
    .select({
      id: projectDocument.id,
      originalFilename: projectDocument.originalFilename,
      letterheadStatus: projectDocument.letterheadStatus,
      letterheadAnalysis: projectDocument.letterheadAnalysis,
    })
    .from(projectDocument)
    .where(
      and(
        eq(projectDocument.projectId, projectId),
        inArray(projectDocument.id, ids),
      ),
    );
};
