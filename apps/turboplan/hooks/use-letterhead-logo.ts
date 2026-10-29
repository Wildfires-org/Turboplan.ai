import useSWR from "swr";

import { fetchLetterheadLogoBlob } from "@/lib/export/letterhead-logo";

type LetterheadLogoKey = readonly ["letterhead-logo", string, string | null];

export const letterheadLogoKey = (
  projectId: string,
  documentId?: string | null,
): LetterheadLogoKey => ["letterhead-logo", projectId, documentId ?? null];

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

const fetchLetterheadLogoDataUrl = async ([
  ,
  projectId,
  documentId,
]: LetterheadLogoKey) => {
  const logo = await fetchLetterheadLogoBlob(projectId, documentId);
  if (!logo) {
    return null;
  }
  return blobToDataUrl(logo.blob);
};

/**
 * The logo of the document's letterhead selection as a data URL, so the
 * document preview shows the same logo the PDF/DOCX export embeds. Null while
 * loading, when the selection is "none" or when no logo is configured.
 */
export const useLetterheadLogo = (
  projectId?: string | null,
  documentId?: string | null,
) => {
  const { data } = useSWR(
    projectId ? letterheadLogoKey(projectId, documentId) : null,
    fetchLetterheadLogoDataUrl,
    { revalidateOnFocus: false },
  );
  return data ?? null;
};
