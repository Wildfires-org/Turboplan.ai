import useSWR from "swr";

import { fetchLetterheadLogoBlob } from "@/lib/export/letterhead-logo";

export type LetterheadLogoKey = readonly [
  "letterhead-logo",
  string,
  string | null,
  number,
];

// `index`: a grid's logo cell (see `fetchLetterheadLogoBlob`); 0 is the
// single logo of every other letterhead.
export const letterheadLogoKey = (
  projectId: string,
  documentId?: string | null,
  index = 0,
): LetterheadLogoKey => [
  "letterhead-logo",
  projectId,
  documentId ?? null,
  index,
];

/**
 * SWR key filter for every logo of a document's letterhead (all indexes), for
 * `mutate(letterheadLogoKeysOf(projectId, documentId))` after its letterhead
 * changes. `mutate(letterheadLogoKey(projectId, documentId))` reaches index 0
 * only.
 */
export const letterheadLogoKeysOf =
  (projectId: string, documentId?: string | null) => (key: unknown) =>
    Array.isArray(key) &&
    key[0] === "letterhead-logo" &&
    key[1] === projectId &&
    key[2] === (documentId ?? null);

/** SWR key filter for every letterhead logo the client holds (any document). */
export const isLetterheadLogoKey = (key: unknown) =>
  Array.isArray(key) && key[0] === "letterhead-logo";

export const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

export const fetchLetterheadLogoDataUrl = async ([
  ,
  projectId,
  documentId,
  index,
]: LetterheadLogoKey) => {
  const logo = await fetchLetterheadLogoBlob(projectId, documentId, index);
  if (!logo) {
    return null;
  }
  return blobToDataUrl(logo.blob);
};

/**
 * The logo of the document's letterhead selection as a data URL, so the
 * document preview shows the same logo the PDF/DOCX export embeds: a grid's
 * logo cell `index`, or the single logo of every other letterhead (any
 * index). `src` is null while loading, when the selection is "none" or when
 * no logo is configured; `isLoading` tells the first apart (a grid cell keeps
 * its box while its logo loads and collapses only once it is missing).
 */
export const useLetterheadLogoState = (
  projectId?: string | null,
  documentId?: string | null,
  index = 0,
): { src: string | null; isLoading: boolean } => {
  const { data, isLoading } = useSWR(
    projectId ? letterheadLogoKey(projectId, documentId, index) : null,
    fetchLetterheadLogoDataUrl,
    { revalidateOnFocus: false },
  );
  return { src: data ?? null, isLoading };
};

/** {@link useLetterheadLogoState}'s `src` alone. */
export const useLetterheadLogo = (
  projectId?: string | null,
  documentId?: string | null,
  index = 0,
) => useLetterheadLogoState(projectId, documentId, index).src;
