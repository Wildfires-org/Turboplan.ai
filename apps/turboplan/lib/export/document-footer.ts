import { ApiClient } from "@wildfires-org/turboplan-api-client";
import { getServerUrl } from "@wildfires-org/turboplan-env";

import type { DocxDocumentFooter } from "./markdown-to-docx";

const apiClient = new ApiClient();

type FooterLogoType = NonNullable<DocxDocumentFooter["logo"]>["type"];

// Maps the API logo content type to the discriminated logo type docx accepts.
// Anything else (e.g. SVG, GIF, WebP) is unsupported and drops the footer logo.
const mimeToLogoType = (contentType: string): FooterLogoType | null => {
  const mime = contentType.split(";")[0]?.trim().toLowerCase();
  if (mime === "image/png") {
    return "png";
  }
  if (mime === "image/jpeg") {
    return "jpg";
  }
  return null;
};

// Decodes a base64 string into a standalone ArrayBuffer of the raw bytes docx's
// ImageRun expects. Returning an ArrayBuffer (rather than a Uint8Array view)
// keeps it assignable to BlobPart for the createImageBitmap dimension probe.
const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return bytes.buffer;
};

type FooterApiResponse = {
  text: string | null;
  note: string | null;
  logo: { dataBase64: string; contentType: string } | null;
};

// Fetches the org/office document footer (tagline, note, and small footer logo)
// for a project so it can be embedded into a client-generated .docx. A missing
// footer is a normal state, so this NEVER throws — any failure returns undefined
// and the export proceeds without a footer.
export const fetchDocumentFooter = async (
  projectId?: string,
): Promise<DocxDocumentFooter | undefined> => {
  if (!projectId) {
    return undefined;
  }

  try {
    const token = await apiClient.getToken();
    if (!token) {
      return undefined;
    }

    const res = await fetch(
      `${getServerUrl()}/api/documents/footer?projectId=${encodeURIComponent(
        projectId,
      )}`,
      {
        method: "GET",
        credentials: "include",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!res.ok) {
      return undefined;
    }

    const data = (await res.json()) as FooterApiResponse;

    let logo: DocxDocumentFooter["logo"] = null;
    if (data.logo) {
      const type = mimeToLogoType(data.logo.contentType);
      if (type) {
        const bytes = base64ToArrayBuffer(data.logo.dataBase64);

        // createImageBitmap gives intrinsic dimensions needed to preserve aspect
        // ratio when scaling the logo to its display height in the docx.
        const bitmap = await createImageBitmap(
          new Blob([bytes], { type: data.logo.contentType }),
        );
        const width = bitmap.width;
        const height = bitmap.height;
        bitmap.close();

        logo = { data: bytes, type, width, height };
      }
    }

    // No footer content at all means no footer to render.
    if (!data.text && !data.note && !logo) {
      return undefined;
    }

    return { text: data.text, note: data.note, logo };
  } catch {
    return undefined;
  }
};
