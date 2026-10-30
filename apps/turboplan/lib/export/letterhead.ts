import { ApiClient } from "@wildfires-org/turboplan-api-client";
import { getServerUrl } from "@wildfires-org/turboplan-env";
import type {
  GridLetterheadEdit,
  LetterheadSelection,
  PublicDocumentLetterhead,
} from "@wildfires-org/turboplan-workspace/types";

import type {
  DefaultLetterheadGridResponse,
  DefaultLetterheadGridSaveRequest,
} from "../default-letterhead-grid";

const apiClient = new ApiClient();

export type LetterheadOption = { id: string; name: string };

export type DocumentLetterheadResponse = {
  // The letterhead the document's selection resolves to (null for "none" or
  // when nothing is configured), with its markdown table (null for a banner
  // or a grid, which render from their image / structure). A grid's logo
  // cells carry their `index` (see `fetchLetterheadLogoBlob`), never a URL.
  letterhead: PublicDocumentLetterhead | null;
  markdown: string | null;
  selection: LetterheadSelection;
  // The office/org default, for labelling the "Default" choice.
  defaultLetterhead: PublicDocumentLetterhead | null;
  // The organization's library letterheads.
  options: LetterheadOption[];
  // The document's copy of the letterhead of the reference it was drafted
  // from ("own"), whatever is selected; null when it has none. `version`
  // identifies the copy's current state: the letterhead editor sends it back
  // with its edit, which the server refuses (409) once the copy changed.
  own: { referenceFilename: string; version: string } | null;
};

// PUT /api/documents/:documentId/letterhead/own.
export type OwnLetterheadSaveRequest = {
  projectId: string;
  // `own.version` when the editor opened.
  version: string;
  grid: GridLetterheadEdit;
};

export type OwnLetterheadSaveResponse = {
  // The saved copy, as GET /letterhead sends it (logo cells by `index`).
  letterhead: PublicDocumentLetterhead;
  // The copy's new version.
  version: string;
};

// POST /api/{organizations|offices}/:id/letterhead-grid/from-document.
export type SaveLetterheadAsDefaultRequest = {
  projectId: string;
  documentId: string;
};

const SAVE_FAILED_MESSAGE = "Failed to save letterhead";

/**
 * A refused letterhead save: the server's message, the HTTP status (null
 * when no answer came) and, for an invalid edit, the offending field of the
 * edit ("cells.1.url", "cells.0.lines.2.text").
 */
export class LetterheadSaveError extends Error {
  readonly status: number | null;
  readonly field: string | null;

  constructor(message: string, status: number | null, field: string | null) {
    super(message);
    this.name = "LetterheadSaveError";
    this.status = status;
    this.field = field;
  }
}

// Writes a letterhead (an editor's edit, a copy saved as a default). Unlike
// the shared `putFetcher` / `postFetcher` it keeps the status and the
// `field` of a refused save, so the editor can mark the field and tell a
// conflict (409) apart.
const sendLetterheadWrite = async <T>(
  method: "PUT" | "POST",
  url: string,
  body: unknown,
): Promise<T> => {
  let res: Response;
  try {
    res = await apiClient.fetchRaw(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new LetterheadSaveError(SAVE_FAILED_MESSAGE, null, null);
  }

  const answer: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const { error, field } = (answer ?? {}) as {
      error?: unknown;
      field?: unknown;
    };
    throw new LetterheadSaveError(
      typeof error === "string" && error ? error : SAVE_FAILED_MESSAGE,
      res.status,
      typeof field === "string" ? field : null,
    );
  }
  return answer as T;
};

/**
 * `useSWRMutation` fetcher saving the letterhead editor's edit of a
 * document's own copy (the key is the endpoint's path); refusals are
 * {@link LetterheadSaveError}s.
 */
export const saveOwnLetterheadFetcher = (
  url: string,
  { arg }: { arg: OwnLetterheadSaveRequest },
): Promise<OwnLetterheadSaveResponse> =>
  sendLetterheadWrite<OwnLetterheadSaveResponse>("PUT", url, arg);

/**
 * The same for an organization's or office's default grid
 * (`PUT /api/{organizations|offices}/:id/letterhead-grid`, the key): the
 * saved grid and its new version; refusals are {@link LetterheadSaveError}s
 * (409 once the grid changed after `arg.version`).
 */
export const saveDefaultLetterheadGridFetcher = (
  url: string,
  { arg }: { arg: DefaultLetterheadGridSaveRequest },
): Promise<DefaultLetterheadGridResponse> =>
  sendLetterheadWrite<DefaultLetterheadGridResponse>("PUT", url, arg);

/**
 * `useSWRMutation` fetcher saving a document's copy as an organization's or
 * office's default (`POST …/letterhead-grid/from-document`, the key): the
 * saved grid and its version; refusals are {@link LetterheadSaveError}s
 * (404 for every refusal of the copy, see the endpoint).
 */
export const saveLetterheadAsDefaultFetcher = (
  url: string,
  { arg }: { arg: SaveLetterheadAsDefaultRequest },
): Promise<DefaultLetterheadGridResponse> =>
  sendLetterheadWrite<DefaultLetterheadGridResponse>("POST", url, arg);

/**
 * The cached `GET /letterhead` response once the copy was saved: the saved
 * copy as the letterhead while it is the selection (the document shows it),
 * and its new version.
 */
export const withSavedOwnLetterhead = (
  current: DocumentLetterheadResponse,
  saved: OwnLetterheadSaveResponse,
): DocumentLetterheadResponse => ({
  ...current,
  letterhead:
    current.selection === "own" ? saved.letterhead : current.letterhead,
  own: current.own && { ...current.own, version: saved.version },
});

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
