"use client";

import { useMemo } from "react";

import { Download, FileText, Loader2, RefreshCw } from "lucide-react";
import useSWR from "swr";

import { fetcher } from "@wildfires-org/turboplan-api-client";
import { Button } from "@wildfires-org/turboplan-utils";

import type { ProjectDocumentText } from "../../types";

export interface DocTextViewerProps {
  /** Project document to read the extracted text of */
  documentId: string;
  onDownload: () => void;
}

/** Blank lines separate paragraphs; single line breaks stay inside one. */
const splitParagraphs = (text: string) => {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
};

/**
 * Text-only preview for legacy Word (.doc) files, which no in-browser viewer
 * can render: shows the text the extraction worker pulled out of the file.
 */
export function DocTextViewer({ documentId, onDownload }: DocTextViewerProps) {
  const { data, error, isLoading, isValidating, mutate } =
    useSWR<ProjectDocumentText>(
      `/api/project-documents/${encodeURIComponent(documentId)}/text`,
      fetcher,
      { revalidateOnFocus: false },
    );

  const paragraphs = useMemo(
    () => (data?.text ? splitParagraphs(data.text) : []),
    [data?.text],
  );

  if (isLoading) {
    return (
      <div className="flex size-full flex-col items-center justify-center gap-3">
        <Loader2 className="size-8 animate-spin text-muted-foreground motion-reduce:animate-none" />
        <p className="text-sm text-muted-foreground">Loading document text…</p>
      </div>
    );
  }

  if (data?.status === "pending") {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <FileText className="size-12 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Text is still being extracted — try again in a moment.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => mutate()}
          disabled={isValidating}
        >
          <RefreshCw className="mr-2 size-4" />
          Try again
        </Button>
      </div>
    );
  }

  if (error || !data || data.status !== "done" || paragraphs.length === 0) {
    const message =
      data?.error ??
      (error instanceof Error ? error.message : null) ??
      "No text could be read from this document.";
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <FileText className="size-12 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Preview is not available for this .doc file.
        </p>
        <p className="max-w-md text-xs text-muted-foreground">{message}</p>
        <Button variant="outline" size="sm" onClick={onDownload}>
          <Download className="mr-2 size-4" />
          Download to view
        </Button>
      </div>
    );
  }

  return (
    <div className="size-full overflow-y-auto border border-gray-100 bg-muted px-8 [scrollbar-gutter:stable]">
      <article className="mx-auto my-6 max-w-[44rem] bg-white px-10 py-8 shadow-sm">
        <p className="mb-6 text-xs text-muted-foreground">
          Text-only preview of an older Word (.doc) file
        </p>
        <div className="space-y-4 text-[15px] leading-7 text-foreground">
          {paragraphs.map((paragraph, index) => (
            <p
              // Paragraphs never reorder, and the text has no stable ids
              key={index}
              className="whitespace-pre-line break-words"
            >
              {paragraph}
            </p>
          ))}
        </div>
      </article>
    </div>
  );
}
