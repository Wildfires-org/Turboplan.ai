import useSWR from "swr";

import { fetchDocumentLetterhead } from "@/lib/export/letterhead";

type DocumentLetterheadKey = readonly [
  "document-letterhead",
  string,
  string | null,
];

export const documentLetterheadKey = (
  projectId: string,
  documentId?: string | null,
): DocumentLetterheadKey => [
  "document-letterhead",
  projectId,
  documentId ?? null,
];

const fetchLetterhead = ([, projectId, documentId]: DocumentLetterheadKey) =>
  fetchDocumentLetterhead(projectId, documentId);

/**
 * The document's letterhead selection and what it resolves to (the office/org
 * default, a library letterhead or none), plus the choices for the picker.
 * Null while loading or on any error.
 */
export const useDocumentLetterhead = (
  projectId?: string | null,
  documentId?: string | null,
) => {
  const { data } = useSWR(
    projectId ? documentLetterheadKey(projectId, documentId) : null,
    fetchLetterhead,
    { revalidateOnFocus: false },
  );
  return data ?? null;
};
