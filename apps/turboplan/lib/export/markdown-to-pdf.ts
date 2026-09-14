import { ApiClient } from "@wildfires-org/turboplan-api-client";
import { getServerUrl } from "@wildfires-org/turboplan-env";

const apiClient = new ApiClient();

export const generatePdfFromMarkdownClient = async (
  content: string,
  title: string,
  projectId?: string,
): Promise<Blob> => {
  // The PDF endpoint lives on the Hono server (getServerUrl), not the Next app.
  // ApiClient.post parses JSON, so it can't return binary — replicate its auth
  // (bearer token) and read the response as an ArrayBuffer instead.
  const token = await apiClient.getToken();

  if (!token) {
    throw new Error("Authentication required");
  }

  const res = await fetch(`${getServerUrl()}/api/documents/export-pdf`, {
    method: "POST",
    credentials: "include",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ content, title, projectId }),
  });

  if (!res.ok) {
    throw new Error(`Failed to export PDF (status ${res.status})`);
  }

  return new Blob([await res.arrayBuffer()], { type: "application/pdf" });
};

export const sanitizePdfFilename = (title: string): string => {
  const cleaned = title
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 100);
  return `${cleaned || "document"}.pdf`;
};
