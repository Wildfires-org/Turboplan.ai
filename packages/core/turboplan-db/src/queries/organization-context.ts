import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "../db-client";
import {
  type NewOrganizationDocument,
  type Organization,
  type OrganizationContext,
  type OrganizationDocument,
  type OrganizationDocumentExtractionStatus,
  office,
  organization,
  organizationContext,
  organizationDocument,
  project,
} from "../schemas";

/** Characters of extracted text used as a fallback when a doc has no summary. */
export const ORGANIZATION_DOCUMENT_EXCERPT_CHARS = 400;

/**
 * Every organization document column except `extractedText`, which can hold up
 * to 40k characters per row. Queries that return lists select this instead of
 * `select()` so the text does not travel with every listing.
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

/** An organization document row without its (potentially huge) extracted text. */
export type OrganizationDocumentListItem = Omit<
  OrganizationDocument,
  "extractedText"
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
  "id" | "originalFilename" | "extractionStatus" | "extractedText"
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

/** Everything the organization context block is built from. */
export type OrganizationContextSources = {
  organization: Pick<Organization, "id" | "name" | "type">;
  prompt: string;
  documents: OrganizationContextSourceDocument[];
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

/**
 * Organization identity, standing prompt and every document (pinned first,
 * then newest) with its summary and a short text excerpt — the inputs of the
 * budgeted organization context block. Null when the organization does not
 * exist.
 */
export const getOrganizationContextSources = async (
  organizationId: string,
): Promise<OrganizationContextSources | null> => {
  const [[orgRow], documents] = await Promise.all([
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
  ]);

  if (!orgRow) {
    return null;
  }

  const { prompt, ...organizationFields } = orgRow;
  return {
    organization: organizationFields,
    prompt: prompt ?? "",
    documents,
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
