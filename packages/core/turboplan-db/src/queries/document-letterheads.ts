import { and, asc, count, eq, sql } from "drizzle-orm";

import { db } from "../db-client";
import {
  type DocumentLetterheadRow,
  type DocumentLetterheadSelectionRow,
  type DocumentOwnLetterheadRow,
  documentLetterhead,
  documentLetterheadSelection,
  documentOwnLetterhead,
  type StoredLetterheadGrid,
} from "../schemas";

// `color` omitted (undefined) leaves the stored color unchanged on update.
export type DocumentLetterheadFields = Pick<
  DocumentLetterheadRow,
  "name" | "description" | "layout" | "lines" | "contact" | "logoUrl"
> & { color?: string | null };

/** An organization's library letterheads, oldest first. */
export const listDocumentLetterheads = async (
  organizationId: string,
): Promise<DocumentLetterheadRow[]> => {
  return db
    .select()
    .from(documentLetterhead)
    .where(eq(documentLetterhead.organizationId, organizationId))
    .orderBy(asc(documentLetterhead.createdAt), asc(documentLetterhead.id));
};

export const getDocumentLetterheadById = async (
  id: string,
): Promise<DocumentLetterheadRow | null> => {
  const [result] = await db
    .select()
    .from(documentLetterhead)
    .where(eq(documentLetterhead.id, id))
    .limit(1);

  return result ?? null;
};

export const countDocumentLetterheads = async (
  organizationId: string,
): Promise<number> => {
  const [result] = await db
    .select({ value: count() })
    .from(documentLetterhead)
    .where(eq(documentLetterhead.organizationId, organizationId));

  return result?.value ?? 0;
};

export const createDocumentLetterhead = async ({
  organizationId,
  createdBy,
  ...fields
}: DocumentLetterheadFields & {
  organizationId: string;
  createdBy: string | null;
}): Promise<DocumentLetterheadRow> => {
  const [result] = await db
    .insert(documentLetterhead)
    .values({ organizationId, createdBy, ...fields })
    .returning();

  return result;
};

/** Update a letterhead of `organizationId`; null when none matched. */
export const updateDocumentLetterhead = async (
  organizationId: string,
  id: string,
  fields: DocumentLetterheadFields,
): Promise<DocumentLetterheadRow | null> => {
  const [result] = await db
    .update(documentLetterhead)
    .set({ ...fields, updatedAt: new Date() })
    .where(
      and(
        eq(documentLetterhead.id, id),
        eq(documentLetterhead.organizationId, organizationId),
      ),
    )
    .returning();

  return result ?? null;
};

/** Delete a letterhead of `organizationId`; null when none matched. */
export const deleteDocumentLetterhead = async (
  organizationId: string,
  id: string,
): Promise<DocumentLetterheadRow | null> => {
  const [result] = await db
    .delete(documentLetterhead)
    .where(
      and(
        eq(documentLetterhead.id, id),
        eq(documentLetterhead.organizationId, organizationId),
      ),
    )
    .returning();

  return result ?? null;
};

export const getDocumentLetterheadSelectionRow = async (
  documentId: string,
): Promise<DocumentLetterheadSelectionRow | null> => {
  const [result] = await db
    .select()
    .from(documentLetterheadSelection)
    .where(eq(documentLetterheadSelection.documentId, documentId))
    .limit(1);

  return result ?? null;
};

// A stored (non-default) selection: a library letterhead id, or null with
// `useOwn` for the document's own copy (true) or none (false, the default).
type DocumentLetterheadSelectionValue =
  | { letterheadId: string; useOwn?: false }
  | { letterheadId: null; useOwn?: boolean };

/**
 * Set the document's letterhead: a library id, the document's own copy
 * (`letterheadId: null, useOwn: true`) or none (`letterheadId: null`).
 */
export const upsertDocumentLetterheadSelection = async ({
  documentId,
  letterheadId,
  useOwn = false,
  updatedBy,
}: DocumentLetterheadSelectionValue & {
  documentId: string;
  updatedBy: string | null;
}): Promise<void> => {
  const updatedAt = new Date();
  await db
    .insert(documentLetterheadSelection)
    .values({ documentId, letterheadId, useOwn, updatedBy, updatedAt })
    .onConflictDoUpdate({
      target: documentLetterheadSelection.documentId,
      set: { letterheadId, useOwn, updatedBy, updatedAt },
    });
};

/** Back to the default letterhead. */
export const deleteDocumentLetterheadSelection = async (
  documentId: string,
): Promise<void> => {
  await db
    .delete(documentLetterheadSelection)
    .where(eq(documentLetterheadSelection.documentId, documentId));
};

/** The document's own copy of its reference's letterhead, or null. */
export const getDocumentOwnLetterhead = async (
  documentId: string,
): Promise<DocumentOwnLetterheadRow | null> => {
  const [result] = await db
    .select()
    .from(documentOwnLetterhead)
    .where(eq(documentOwnLetterhead.documentId, documentId))
    .limit(1);

  return result ?? null;
};

/**
 * Store the document's own copy of a reference's letterhead, replacing any
 * earlier copy (and its reference) for the document.
 */
export const upsertDocumentOwnLetterhead = async ({
  documentId,
  letterhead,
  referenceFilename,
  referenceProjectDocumentId = null,
  referenceOrganizationDocumentId = null,
  updatedBy,
}: {
  documentId: string;
  letterhead: StoredLetterheadGrid;
  referenceFilename: string;
  referenceProjectDocumentId?: string | null;
  referenceOrganizationDocumentId?: string | null;
  updatedBy: string | null;
}): Promise<void> => {
  const updatedAt = new Date();
  const values = {
    letterhead,
    referenceFilename,
    referenceProjectDocumentId,
    referenceOrganizationDocumentId,
    updatedBy,
    updatedAt,
  };
  await db
    .insert(documentOwnLetterhead)
    .values({ documentId, ...values })
    .onConflictDoUpdate({
      target: documentOwnLetterhead.documentId,
      set: values,
    });
};

/**
 * Replace the grid of the document's own copy, only while it is still the
 * version the edit was made on: `expectedUpdatedAt` is the copy's
 * `updated_at` when it was read (compared to the millisecond, the precision
 * a JS Date keeps). The copy's new `updated_at`, or null when the document
 * has no copy or it changed meanwhile.
 */
export const updateDocumentOwnLetterhead = async ({
  documentId,
  letterhead,
  updatedBy,
  expectedUpdatedAt,
}: {
  documentId: string;
  letterhead: StoredLetterheadGrid;
  updatedBy: string | null;
  expectedUpdatedAt: Date;
}): Promise<Date | null> => {
  const [result] = await db
    .update(documentOwnLetterhead)
    .set({ letterhead, updatedBy, updatedAt: new Date() })
    .where(
      and(
        eq(documentOwnLetterhead.documentId, documentId),
        // The column has no time zone; an ISO string's "Z" is ignored by the
        // cast, as when drizzle writes a Date.
        sql`date_trunc('milliseconds', ${documentOwnLetterhead.updatedAt}) = ${expectedUpdatedAt.toISOString()}::timestamp`,
      ),
    )
    .returning({ updatedAt: documentOwnLetterhead.updatedAt });

  return result?.updatedAt ?? null;
};
