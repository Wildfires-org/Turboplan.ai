"use client";

import { useCallback } from "react";

interface UseDocumentDownloadOptions {
  url: string;
  filename?: string;
}

export function useDocumentDownload({
  url,
  filename,
}: UseDocumentDownloadOptions) {
  const handleDownload = useCallback(async () => {
    const downloadFilename = filename || "download";

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Download failed with status ${response.status}`);
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = blobUrl;
      link.download = downloadFilename;
      link.style.display = "none";
      window.document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Failed to fetch file for download", error);

      // Conservative fallback: still request browser download semantics.
      const link = window.document.createElement("a");
      link.href = url;
      link.download = downloadFilename;
      link.style.display = "none";
      window.document.body.append(link);
      link.click();
      link.remove();
    }
  }, [filename, url]);

  return { handleDownload };
}
