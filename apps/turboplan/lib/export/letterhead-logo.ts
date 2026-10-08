import { ApiClient } from "@wildfires-org/turboplan-api-client";
import { getServerUrl } from "@wildfires-org/turboplan-env";

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

// Fetches the raw letterhead logo (PNG/JPEG) for a document's letterhead
// selection (or the project's default when no documentId). A missing logo is
// a normal state, so this NEVER throws — any failure returns null.
export const fetchLetterheadLogoBlob = async (
  projectId?: string | null,
  documentId?: string | null,
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
      `${getServerUrl()}/api/documents/letterhead-logo?${letterheadQuery(projectId, documentId)}`,
      {
        method: "GET",
        credentials: "include",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    // 204 (no logo configured) or any non-ok status means no logo.
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
  } catch {
    return null;
  }
};

// Fetches the letterhead logo so it can be embedded into a client-generated
// .docx. Never throws — the export proceeds without a logo on any failure.
export const fetchLetterheadLogo = async (
  projectId?: string | null,
  documentId?: string | null,
): Promise<DocxLetterheadLogo | null> => {
  const logo = await fetchLetterheadLogoBlob(projectId, documentId);
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
