import { ApiClient } from "@wildfires-org/turboplan-api-client";
import { getServerUrl } from "@wildfires-org/turboplan-env";
import type {
  DocumentLetterhead,
  LetterheadSelection,
} from "@wildfires-org/turboplan-workspace/types";

const apiClient = new ApiClient();

export type LetterheadOption = { id: string; name: string };

export type DocumentLetterheadResponse = {
  // The letterhead the document's selection resolves to (null for "none" or
  // when nothing is configured), with its markdown table.
  letterhead: DocumentLetterhead | null;
  markdown: string | null;
  selection: LetterheadSelection;
  // The office/org default, for labelling the "Default" choice.
  defaultLetterhead: DocumentLetterhead | null;
  // The organization's library letterheads.
  options: LetterheadOption[];
};

// Query string shared by the letterhead and letterhead-logo endpoints. Without
// a documentId the server resolves the project's default letterhead.
export const letterheadQuery = (
  projectId: string,
  documentId?: string | null,
) => {
  const params = new URLSearchParams({ projectId });
  if (documentId) {
    params.set("documentId", documentId);
  }
  return params.toString();
};

// Fetches the document's letterhead selection and what it resolves to. An
// unconfigured letterhead is a normal state, so this NEVER throws — any failure
// returns null and callers keep the AI-written letterhead.
export const fetchDocumentLetterhead = async (
  projectId?: string | null,
  documentId?: string | null,
): Promise<DocumentLetterheadResponse | null> => {
  if (!projectId) {
    return null;
  }

  try {
    const token = await apiClient.getToken();
    if (!token) {
      return null;
    }

    const res = await fetch(
      `${getServerUrl()}/api/documents/letterhead?${letterheadQuery(projectId, documentId)}`,
      {
        method: "GET",
        credentials: "include",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!res.ok) {
      return null;
    }

    return (await res.json()) as DocumentLetterheadResponse;
  } catch {
    return null;
  }
};
