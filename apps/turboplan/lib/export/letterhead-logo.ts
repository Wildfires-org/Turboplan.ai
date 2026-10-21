import { ApiClient } from "@wildfires-org/turboplan-api-client";
import { getServerUrl } from "@wildfires-org/turboplan-env";
import {
  gridLogoCells,
  type PublicGridLetterhead,
} from "@wildfires-org/turboplan-workspace/types";

import {
  type DefaultLetterheadGridOwner,
  defaultLetterheadGridUrl,
} from "../default-letterhead-grid";
import { letterheadQuery } from "./letterhead";
import type { DocxLetterheadLogo } from "./markdown-to-docx";

const apiClient = new ApiClient();

// Maps the response Content-Type to the discriminated logo type docx/PDFKit
// accept. Anything else (e.g. SVG, GIF, WebP) is unsupported for letterheads.
const mimeToLogoType = (
  contentType: string | null,
): DocxLetterheadLogo["type"] | null => {
  const mime = contentType?.split(";")[0]?.trim().toLowerCase();
  if (mime === "image/png") {
    return "png";
  }
  if (mime === "image/jpeg") {
    return "jpg";
  }
  return null;
};

// The letterhead-logo query: the letterhead query plus the logo `index` (a
// grid's logo cell, see `PublicGridLetterheadLogoCell`), omitted for 0 — the
// server's default and the single logo of every other letterhead.
const letterheadLogoQuery = (
  projectId: string,
  documentId: string | null | undefined,
  index: number,
) => {
  const query = letterheadQuery(projectId, documentId);
  return index > 0 ? `${query}&index=${index}` : query;
};

// Fetches the raw letterhead logo (PNG/JPEG) for a document's letterhead
// selection (or the project's default when no documentId): a grid's logo cell
// `index`, or — for every other letterhead and a grid without logo cells —
// its single logo, whatever the index. A missing logo is a normal state, so
// this NEVER throws — any failure returns null.
export const fetchLetterheadLogoBlob = async (
  projectId?: string | null,
  documentId?: string | null,
  index = 0,
): Promise<{ blob: Blob; type: DocxLetterheadLogo["type"] } | null> => {
  if (!projectId) {
    return null;
  }

  try {
    const token = await apiClient.getToken();
    if (!token) {
      return null;
    }

    const res = await fetch(
      `${getServerUrl()}/api/documents/letterhead-logo?${letterheadLogoQuery(projectId, documentId, index)}`,
      {
        method: "GET",
        credentials: "include",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    return await readLogoResponse(res);
  } catch {
    return null;
  }
};

// A logo proxy's answer as the logo, or null: 204 (no logo configured), any
// non-ok status, an unsupported type or an empty body mean no logo.
const readLogoResponse = async (
  res: Response,
): Promise<{ blob: Blob; type: DocxLetterheadLogo["type"] } | null> => {
  if (res.status === 204 || !res.ok) {
    return null;
  }

  const type = mimeToLogoType(res.headers.get("Content-Type"));
  if (!type) {
    return null;
  }

  const blob = await res.blob();
  if (blob.size === 0) {
    return null;
  }

  return { blob, type };
};

// Fetches one logo of an organization's or office's default grid letterhead
// by its logo `index`, through the settings' logo proxy
// (`GET /api/{organizations|offices}/:id/letterhead-grid/logo`). A missing
// logo is a normal state, so this NEVER throws — any failure returns null.
export const fetchDefaultLetterheadGridLogoBlob = async (
  owner: DefaultLetterheadGridOwner,
  index: number,
): Promise<{ blob: Blob; type: DocxLetterheadLogo["type"] } | null> => {
  try {
    const res = await apiClient.fetchRaw(
      `${defaultLetterheadGridUrl(owner)}/logo?index=${index}`,
    );
    return await readLogoResponse(res);
  } catch {
    return null;
  }
};

// Fetches the letterhead logo (see `fetchLetterheadLogoBlob` for `index`) so
// it can be embedded into a client-generated .docx. Never throws — the export
// proceeds without a logo on any failure.
export const fetchLetterheadLogo = async (
  projectId?: string | null,
  documentId?: string | null,
  index = 0,
): Promise<DocxLetterheadLogo | null> => {
  const logo = await fetchLetterheadLogoBlob(projectId, documentId, index);
  if (!logo) {
    return null;
  }

  try {
    // createImageBitmap gives intrinsic dimensions needed to preserve aspect
    // ratio when scaling the logo to its display height in the docx.
    const bitmap = await createImageBitmap(logo.blob);
    const width = bitmap.width;
    const height = bitmap.height;
    bitmap.close();

    const data = await logo.blob.arrayBuffer();

    return { data, type: logo.type, width, height };
  } catch {
    return null;
  }
};

// Every logo of a grid letterhead, in parallel, by cell `index` (the slot of
// a logo that does not load is null). `first` is the index-0 logo when the
// caller already fetched it (`fetchLetterheadLogo` without an index serves a
// grid's first logo cell), reused instead of fetched again. Never throws.
export const fetchGridLetterheadLogos = (
  projectId: string | null | undefined,
  documentId: string | null | undefined,
  grid: PublicGridLetterhead,
  first?: DocxLetterheadLogo | null,
): Promise<(DocxLetterheadLogo | null)[]> =>
  Promise.all(
    gridLogoCells(grid).map((cell) =>
      cell.index === 0 && first !== undefined
        ? first
        : fetchLetterheadLogo(projectId, documentId, cell.index),
    ),
  );
