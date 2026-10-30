import { and, asc, count, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";

import { type DbInstance, db } from "../db-client";
import {
  type DocumentLetterheadStatus,
  letterheadPendingPredicate,
  MAX_LETTERHEAD_ATTEMPTS,
  type NewOrganizationDocument,
  type Organization,
  type OrganizationContext,
  type OrganizationDocument,
  type OrganizationDocumentExtractionStatus,
  type OrganizationMemory,
  office,
  organization,
  organizationContext,
  organizationDocument,
  organizationMemory,
  project,
  type StoredLetterheadAnalysis,
} from "../schemas";

/**
 * The shared client or an open transaction (the `db.transaction` callback
 * argument), for queries a caller runs under its own lock.
 */
type QueryExecutor = Pick<DbInstance, "select" | "insert">;

/** Characters of extracted text used as a fallback when a doc has no summary. */
export const ORGANIZATION_DOCUMENT_EXCERPT_CHARS = 400;

/**
 * Every organization document column except `extractedText`, which can hold up
 * to 40k characters per row, and the letterhead analysis columns. Queries that
 * return lists select this instead of `select()` so the text does not travel
 * with every listing.
 */
const organizationDocumentColumns = {
  id: organizationDocument.id,
  organizationId: organizationDocument.organizationId,
  filename: organizationDocument.filename,
  originalFilename: organizationDocument.originalFilename,
  mimeType: organizationDocument.mimeType,
  size: organizationDocument.size,
  url: organizationDocument.url,
  uploadedBy: organizationDocument.uploadedBy,
  isPinned: organizationDocument.isPinned,
  extractionStatus: organizationDocument.extractionStatus,
  extractionError: organizationDocument.extractionError,
  extractedAt: organizationDocument.extractedAt,
  summary: organizationDocument.summary,
  summarizedAt: organizationDocument.summarizedAt,
  createdAt: organizationDocument.createdAt,
  updatedAt: organizationDocument.updatedAt,
} as const;

/**
 * An organization document row without its (potentially huge) extracted text
 * and without the letterhead analysis, which only the analysis loop and
 * document creation read (through their own queries).
 */
export type OrganizationDocumentListItem = Omit<
  OrganizationDocument,
  | "extractedText"
  | "letterheadStatus"
  | "letterheadAnalysis"
  | "letterheadAttempts"
>;

export type OrganizationPrompt = Pick<
  OrganizationContext,
  "prompt" | "updatedAt" | "updatedBy"
>;

/** The subset of a pending document the extraction loop needs. */
export type OrganizationDocumentPendingExtraction = Pick<
  OrganizationDocument,
  "id" | "url" | "mimeType" | "originalFilename"
>;

export type OrganizationDocumentText = Pick<
  OrganizationDocument,
  "id" | "url" | "originalFilename" | "extractionStatus" | "extractedText"
>;

export type OrganizationContextSourceDocument = Pick<
  OrganizationDocument,
  | "id"
  | "originalFilename"
  | "isPinned"
  | "extractionStatus"
  | "summary"
  | "createdAt"
> & {
  /** First `ORGANIZATION_DOCUMENT_EXCERPT_CHARS` of the extracted text */
  excerpt: string | null;
};

/** An organization memory as listed to users (no organization id). */
export type OrganizationMemoryListItem = Pick<
  OrganizationMemory,
  "id" | "content" | "createdBy" | "createdAt"
>;

export type OrganizationContextSourceMemory = Pick<
  OrganizationMemory,
  "id" | "content"
>;

/** Everything the organization context block is built from. */
export type OrganizationContextSources = {
  organization: Pick<Organization, "id" | "name" | "type">;
  prompt: string;
  documents: OrganizationContextSourceDocument[];
  /** Newest first */
  memories: OrganizationContextSourceMemory[];
};

/** The organization's standing prompt, or null when none was ever saved. */
export const getOrganizationPrompt = async (
  organizationId: string,
): Promise<OrganizationPrompt | null> => {
  const [result] = await db
    .select({
      prompt: organizationContext.prompt,
      updatedAt: organizationContext.updatedAt,
      updatedBy: organizationContext.updatedBy,
    })
    .from(organizationContext)
    .where(eq(organizationContext.organizationId, organizationId))
    .limit(1);

  return result ?? null;
};

/** Create or replace the organization's standing prompt. */
export const upsertOrganizationPrompt = async ({
  organizationId,
  prompt,
  userId,
}: {
  organizationId: string;
  prompt: string;
  userId: string;
}): Promise<OrganizationContext> => {
  const [result] = await db
    .insert(organizationContext)
    .values({ organizationId, prompt, updatedBy: userId })
    .onConflictDoUpdate({
      target: organizationContext.organizationId,
      set: { prompt, updatedBy: userId, updatedAt: new Date() },
    })
    .returning();

  return result;
};

/** All documents of an organization, newest first, without extracted text. */
export const listOrganizationDocuments = async (
  organizationId: string,
): Promise<OrganizationDocumentListItem[]> => {
  return db
    .select(organizationDocumentColumns)
    .from(organizationDocument)
    .where(eq(organizationDocument.organizationId, organizationId))
    .orderBy(desc(organizationDocument.createdAt));
};

/** A single organization document without its extracted text. */
export const getOrganizationDocumentById = async (
  id: string,
): Promise<OrganizationDocumentListItem | null> => {
  const [result] = await db
    .select(organizationDocumentColumns)
    .from(organizationDocument)
    .where(eq(organizationDocument.id, id))
    .limit(1);

  return result ?? null;
};

export const createOrganizationDocument = async (
  values: NewOrganizationDocument,
): Promise<OrganizationDocumentListItem> => {
  const [result] = await db
    .insert(organizationDocument)
    .values(values)
    .returning(organizationDocumentColumns);

  return result;
};

/**
 * Rename (display name only) and/or pin a document. Storage fields
 * (`filename`, `url`) are intentionally left untouched.
 */
export const updateOrganizationDocument = async (
  id: string,
  data: { originalFilename?: string; isPinned?: boolean },
): Promise<OrganizationDocumentListItem | null> => {
  const [result] = await db
    .update(organizationDocument)
    .set({
      ...(data.originalFilename !== undefined
        ? { originalFilename: data.originalFilename }
        : {}),
      ...(data.isPinned !== undefined ? { isPinned: data.isPinned } : {}),
      updatedAt: new Date(),
    })
    .where(eq(organizationDocument.id, id))
    .returning(organizationDocumentColumns);

  return result ?? null;
};

/**
 * Delete a document row and return it, so the caller can remove the stored
 * object afterwards.
 */
export const deleteOrganizationDocument = async (
  id: string,
): Promise<OrganizationDocumentListItem | null> => {
  const [result] = await db
    .delete(organizationDocument)
    .where(eq(organizationDocument.id, id))
    .returning(organizationDocumentColumns);

  return result ?? null;
};

/**
 * Whether any organization document row references the stored object at
 * `url`. Checked before deleting the object, so a blob registered twice is
 * not removed from under the remaining row.
 */
export const hasOrganizationDocumentWithUrl = async (
  url: string,
): Promise<boolean> => {
  const [row] = await db
    .select({ id: organizationDocument.id })
    .from(organizationDocument)
    .where(eq(organizationDocument.url, url))
    .limit(1);
  return row !== undefined;
};

export const countOrganizationDocuments = async (
  organizationId: string,
): Promise<number> => {
  const [result] = await db
    .select({ value: count() })
    .from(organizationDocument)
    .where(eq(organizationDocument.organizationId, organizationId));

  return result?.value ?? 0;
};

/**
 * Oldest documents still awaiting extraction, for the extraction worker.
 * Served by `organization_document_extraction_status_idx`.
 */
export const getOrganizationDocumentsPendingExtraction = async (
  limit: number,
): Promise<OrganizationDocumentPendingExtraction[]> => {
  return db
    .select({
      id: organizationDocument.id,
      url: organizationDocument.url,
      mimeType: organizationDocument.mimeType,
      originalFilename: organizationDocument.originalFilename,
    })
    .from(organizationDocument)
    .where(eq(organizationDocument.extractionStatus, "pending"))
    .orderBy(asc(organizationDocument.createdAt))
    .limit(limit);
};

/**
 * Record the outcome of a text extraction (and optional summary) run.
 *
 * `extractedAt` is stamped only when the status is "done", `summarizedAt` only
 * when a summary string is passed. A failed or unsupported run leaves the
 * previous text and summary alone unless the caller explicitly passes `null`.
 * `updatedAt` is left alone: it tracks user edits (rename, pin), not the worker.
 */
export const updateOrganizationDocumentExtraction = async (
  id: string,
  data: {
    extractionStatus: OrganizationDocumentExtractionStatus;
    extractedText?: string | null;
    extractionError?: string | null;
    summary?: string | null;
  },
): Promise<OrganizationDocumentListItem | null> => {
  const [result] = await db
    .update(organizationDocument)
    .set({
      extractionStatus: data.extractionStatus,
      ...(data.extractedText !== undefined
        ? { extractedText: data.extractedText }
        : {}),
      ...(data.extractionError !== undefined
        ? { extractionError: data.extractionError }
        : {}),
      ...(data.extractionStatus === "done" ? { extractedAt: new Date() } : {}),
      ...(data.summary !== undefined ? { summary: data.summary } : {}),
      ...(typeof data.summary === "string" ? { summarizedAt: new Date() } : {}),
    })
    .where(eq(organizationDocument.id, id))
    .returning(organizationDocumentColumns);

  return result ?? null;
};

/** The subset of a pending document the letterhead analysis loop needs. */
export type OrganizationDocumentPendingLetterhead = Pick<
  OrganizationDocument,
  "id" | "url" | "mimeType" | "originalFilename"
>;

/**
 * Newest documents still awaiting letterhead analysis with attempts left, for
 * the research agent's analysis loop: a fresh upload is analyzed within
 * seconds even with a backlog of older documents (they drain after it).
 * Served by the partial `organization_document_letterhead_pending_idx`.
 */
export const getOrganizationDocumentsPendingLetterhead = async (
  limit: number,
): Promise<OrganizationDocumentPendingLetterhead[]> => {
  return db
    .select({
      id: organizationDocument.id,
      url: organizationDocument.url,
      mimeType: organizationDocument.mimeType,
      originalFilename: organizationDocument.originalFilename,
    })
    .from(organizationDocument)
    .where(
      and(
        letterheadPendingPredicate(organizationDocument.letterheadStatus),
        lt(organizationDocument.letterheadAttempts, MAX_LETTERHEAD_ATTEMPTS),
      ),
    )
    .orderBy(desc(organizationDocument.createdAt))
    .limit(limit);
};

/**
 * Count one letterhead analysis attempt on a pending document, right before
 * its run: the attempts made so far, this one included, or null when the
 * document is gone, no longer pending or out of attempts (skip it).
 * `updatedAt` is left alone: it tracks user edits.
 */
export const claimOrganizationDocumentLetterhead = async (
  id: string,
): Promise<number | null> => {
  const [claimed] = await db
    .update(organizationDocument)
    .set({
      letterheadAttempts: sql`${organizationDocument.letterheadAttempts} + 1`,
    })
    .where(
      and(
        eq(organizationDocument.id, id),
        letterheadPendingPredicate(organizationDocument.letterheadStatus),
        lt(organizationDocument.letterheadAttempts, MAX_LETTERHEAD_ATTEMPTS),
      ),
    )
    .returning({ attempts: organizationDocument.letterheadAttempts });

  return claimed?.attempts ?? null;
};

/**
 * Mark "failed" the documents still pending after their last attempt (each
 * failed temporarily, or crashed the process). Resolves how many.
 */
export const failExhaustedOrganizationDocumentLetterheads =
  async (): Promise<number> => {
    const failed = await db
      .update(organizationDocument)
      .set({ letterheadStatus: "failed" })
      .where(
        and(
          letterheadPendingPredicate(organizationDocument.letterheadStatus),
          gte(organizationDocument.letterheadAttempts, MAX_LETTERHEAD_ATTEMPTS),
        ),
      )
      .returning({ id: organizationDocument.id });

    return failed.length;
  };

/**
 * Record the outcome of a letterhead analysis run. False when the document no
 * longer exists. `updatedAt` is left alone: it tracks user edits.
 */
export const updateOrganizationDocumentLetterhead = async (
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
    .update(organizationDocument)
    .set({ letterheadStatus: status, letterheadAnalysis: analysis })
    .where(eq(organizationDocument.id, id))
    .returning({ id: organizationDocument.id });

  return updated.length > 0;
};

/** A reference document's letterhead analysis, as document creation reads it. */
export type OrganizationDocumentLetterheadAnalysis = Pick<
  OrganizationDocument,
  "id" | "originalFilename" | "letterheadStatus" | "letterheadAnalysis"
>;

/**
 * Letterhead analyses of the given documents of one organization. Ids
 * belonging to another organization are simply absent from the result (IDOR
 * guard).
 */
export const getOrganizationDocumentLetterheadAnalyses = async (
  organizationId: string,
  ids: string[],
): Promise<OrganizationDocumentLetterheadAnalysis[]> => {
  if (ids.length === 0) {
    return [];
  }
  return db
    .select({
      id: organizationDocument.id,
      originalFilename: organizationDocument.originalFilename,
      letterheadStatus: organizationDocument.letterheadStatus,
      letterheadAnalysis: organizationDocument.letterheadAnalysis,
    })
    .from(organizationDocument)
    .where(
      and(
        eq(organizationDocument.organizationId, organizationId),
        inArray(organizationDocument.id, ids),
      ),
    );
};

/**
 * Extracted text for the given documents of one organization. Ids belonging to
 * another organization are simply absent from the result (IDOR guard). This is
 * the one query that deliberately reads `extractedText`.
 */
export const getOrganizationDocumentTextsByIds = async (
  organizationId: string,
  ids: string[],
): Promise<OrganizationDocumentText[]> => {
  if (ids.length === 0) {
    return [];
  }
  return db
    .select({
      id: organizationDocument.id,
      url: organizationDocument.url,
      originalFilename: organizationDocument.originalFilename,
      extractionStatus: organizationDocument.extractionStatus,
      extractedText: organizationDocument.extractedText,
    })
    .from(organizationDocument)
    .where(
      and(
        eq(organizationDocument.organizationId, organizationId),
        inArray(organizationDocument.id, ids),
      ),
    );
};

/** Newest first; the id breaks ties so the order is stable for prompt caching. */
const organizationMemoryOrder = [
  desc(organizationMemory.createdAt),
  desc(organizationMemory.id),
] as const;

/** An organization's memories, newest first. */
export const listOrganizationMemories = async (
  organizationId: string,
): Promise<OrganizationMemoryListItem[]> => {
  return db
    .select({
      id: organizationMemory.id,
      content: organizationMemory.content,
      createdBy: organizationMemory.createdBy,
      createdAt: organizationMemory.createdAt,
    })
    .from(organizationMemory)
    .where(eq(organizationMemory.organizationId, organizationId))
    .orderBy(...organizationMemoryOrder);
};

export const getOrganizationMemoryById = async (
  id: string,
): Promise<OrganizationMemory | null> => {
  const [result] = await db
    .select()
    .from(organizationMemory)
    .where(eq(organizationMemory.id, id))
    .limit(1);

  return result ?? null;
};

/**
 * Insert a memory as given. Normalising the content, deduplicating and the
 * per-organization cap are the caller's job (`saveOrganizationMemory` in
 * turboplan-workspace).
 */
export const createOrganizationMemory = async (
  {
    organizationId,
    content,
    createdBy,
  }: { organizationId: string; content: string; createdBy: string | null },
  executor: QueryExecutor = db,
): Promise<OrganizationMemory> => {
  const [result] = await executor
    .insert(organizationMemory)
    .values({ organizationId, content, createdBy })
    .returning();

  return result;
};

/** Delete a memory and return the removed row, or null when none matched. */
export const deleteOrganizationMemory = async (
  id: string,
): Promise<OrganizationMemory | null> => {
  const [result] = await db
    .delete(organizationMemory)
    .where(eq(organizationMemory.id, id))
    .returning();

  return result ?? null;
};

export const countOrganizationMemories = async (
  organizationId: string,
  executor: QueryExecutor = db,
): Promise<number> => {
  const [result] = await executor
    .select({ value: count() })
    .from(organizationMemory)
    .where(eq(organizationMemory.organizationId, organizationId));

  return result?.value ?? 0;
};

/**
 * The organization's memory whose content equals `content`, ignoring case and
 * surrounding whitespace, or null. Used to skip saving the same note twice.
 */
export const findOrganizationMemoryByContent = async (
  organizationId: string,
  content: string,
  executor: QueryExecutor = db,
): Promise<OrganizationMemory | null> => {
  const [result] = await executor
    .select()
    .from(organizationMemory)
    .where(
      and(
        eq(organizationMemory.organizationId, organizationId),
        sql`lower(btrim(${organizationMemory.content}, E' \\t\\r\\n')) = lower(${content.trim()})`,
      ),
    )
    .orderBy(...organizationMemoryOrder)
    .limit(1);

  return result ?? null;
};

/**
 * Organization identity, standing prompt, every document (pinned first, then
 * newest) with its summary and a short text excerpt, and every memory (newest
 * first) — the inputs of the budgeted organization context block. Null when
 * the organization does not exist.
 */
export const getOrganizationContextSources = async (
  organizationId: string,
): Promise<OrganizationContextSources | null> => {
  const [[orgRow], documents, memories] = await Promise.all([
    db
      .select({
        id: organization.id,
        name: organization.name,
        type: organization.type,
        prompt: organizationContext.prompt,
      })
      .from(organization)
      .leftJoin(
        organizationContext,
        eq(organizationContext.organizationId, organization.id),
      )
      .where(eq(organization.id, organizationId))
      .limit(1),
    db
      .select({
        id: organizationDocument.id,
        originalFilename: organizationDocument.originalFilename,
        isPinned: organizationDocument.isPinned,
        extractionStatus: organizationDocument.extractionStatus,
        summary: organizationDocument.summary,
        excerpt: sql<
          string | null
        >`left(${organizationDocument.extractedText}, ${ORGANIZATION_DOCUMENT_EXCERPT_CHARS})`,
        createdAt: organizationDocument.createdAt,
      })
      .from(organizationDocument)
      .where(eq(organizationDocument.organizationId, organizationId))
      .orderBy(
        desc(organizationDocument.isPinned),
        desc(organizationDocument.createdAt),
      ),
    db
      .select({
        id: organizationMemory.id,
        content: organizationMemory.content,
      })
      .from(organizationMemory)
      .where(eq(organizationMemory.organizationId, organizationId))
      .orderBy(...organizationMemoryOrder),
  ]);

  if (!orgRow) {
    return null;
  }

  const { prompt, ...organizationFields } = orgRow;
  return {
    organization: organizationFields,
    prompt: prompt ?? "",
    documents,
    memories,
  };
};

/** project → office → organization, or null when the project does not exist. */
export const getOrganizationIdForProject = async (
  projectId: string,
): Promise<string | null> => {
  const [result] = await db
    .select({ organizationId: office.organizationId })
    .from(project)
    .innerJoin(office, eq(office.id, project.officeId))
    .where(eq(project.id, projectId))
    .limit(1);

  return result?.organizationId ?? null;
};
