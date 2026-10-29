import { and, asc, count, eq } from "drizzle-orm";

import { db } from "../db-client";
import {
  type DocumentLetterheadRow,
  type DocumentLetterheadSelectionRow,
  documentLetterhead,
  documentLetterheadSelection,
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

/** Set the document's letterhead: an id, or null for "none". */
export const upsertDocumentLetterheadSelection = async ({
  documentId,
  letterheadId,
  updatedBy,
}: {
  documentId: string;
  letterheadId: string | null;
  updatedBy: string | null;
}): Promise<void> => {
  const updatedAt = new Date();
  await db
    .insert(documentLetterheadSelection)
    .values({ documentId, letterheadId, updatedBy, updatedAt })
    .onConflictDoUpdate({
      target: documentLetterheadSelection.documentId,
      set: { letterheadId, updatedBy, updatedAt },
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
