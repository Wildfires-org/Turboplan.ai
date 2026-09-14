"use client";

import { type ReactNode, useEffect, useState } from "react";

import { Download, ExternalLink, FileText, Loader2, X } from "lucide-react";

import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@wildfires-org/turboplan-utils";

import { getPreviewDocumentMimeType } from "../../document-mime";
import { getFileTypeLabel } from "../utils";
import { DocxViewerLazy } from "./docx-viewer-lazy";
import { PageNavigation } from "./page-navigation";
import { PdfViewerLazy } from "./pdf-viewer-lazy";
import { useDocumentDownload } from "./use-document-download";
import { useDocumentPreviewPagination } from "./use-document-preview-pagination";

interface DocumentPreviewDialogBaseProps {
  id: string;
  filename: string;
  url: string;
  /** Optional URL for the in-dialog preview (e.g. a CORS-free blob URL).
   *  When `null`, a loading spinner is shown in the preview area.
   *  When omitted / `undefined`, `url` is used for the preview. */
  previewUrl?: string | null;
  /** Optional mime type hint. Derived from filename/url if omitted. */
  mimeType?: string | null;
  addToProject?: {
    isLoading: boolean;
    handler: () => void;
  };
  footer?: ReactNode;
}

interface DocumentPreviewDialogTriggerProps
  extends DocumentPreviewDialogBaseProps {
  trigger: ReactNode;
  open?: never;
  onOpenChange?: never;
}

interface DocumentPreviewDialogControlledProps
  extends DocumentPreviewDialogBaseProps {
  trigger?: never;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export type DocumentPreviewDialogProps =
  | DocumentPreviewDialogTriggerProps
  | DocumentPreviewDialogControlledProps;

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const DOC_MIME = "application/msword";

export function DocumentPreviewDialog(props: DocumentPreviewDialogProps) {
  const { id, filename, url, addToProject, footer } = props;
  // previewUrl: undefined → use url, null → loading, string → use it
  const resolvedPreviewUrl =
    props.previewUrl === undefined ? url : props.previewUrl;
  const isPreviewLoading = resolvedPreviewUrl === null;
  const resolvedMimeType =
    getPreviewDocumentMimeType({
      mimeType: props.mimeType,
      filename,
      url,
    }) ?? "application/octet-stream";

  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen =
    "trigger" in props && props.trigger ? internalOpen : props.open;

  const {
    currentPage,
    totalPages,
    setCurrentPage,
    setTotalPages,
    handlePrevious,
    handleNext,
    handlePageChange,
    handleCurrentPageChange,
    handleTotalPagesChange,
  } = useDocumentPreviewPagination();
  const { handleDownload } = useDocumentDownload({ url, filename });

  // Reset page when document changes
  useEffect(() => {
    setCurrentPage(1);
    setTotalPages(0);
  }, [id]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setCurrentPage((p) => Math.max(1, p - 1));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setCurrentPage((p) =>
          totalPages > 0 ? Math.max(1, Math.min(totalPages, p + 1)) : p,
        );
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, totalPages]);

  const isPdf = resolvedMimeType === "application/pdf";
  const isDocx = resolvedMimeType === DOCX_MIME;
  const isDoc = resolvedMimeType === DOC_MIME;

  const dialogProps =
    "trigger" in props && props.trigger
      ? {}
      : { open: props.open, onOpenChange: props.onOpenChange };

  const content = (
    <DialogContent
      // 53rem = A4 paper width (794px @ 96dpi) + dialog padding
      className="flex h-[85vh] w-[53rem] max-w-[95vw] flex-col gap-0 p-0"
      hideCloseButton
    >
      <DialogDescription className="sr-only">
        Preview of {filename}
      </DialogDescription>

      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4">
        <FileText className="size-5 shrink-0 text-muted-foreground" />
        <DialogTitle className="min-w-0 flex-1 truncate text-xl font-semibold">
          {filename}
        </DialogTitle>
        <span className="shrink-0 rounded bg-gray-200 px-2 py-1 text-xs text-foreground">
          {getFileTypeLabel(resolvedMimeType)}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          onClick={handleDownload}
          title="Download"
        >
          <Download className="size-4" />
        </Button>
        {/* Browsers can only display PDFs inline — for docx/doc a new tab
            just triggers a download, so hide the button for those types. */}
        {isPdf && (
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            asChild
          >
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              title="Open in new tab"
            >
              <ExternalLink className="size-4" />
            </a>
          </Button>
        )}
        <DialogClose asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            title="Close"
          >
            <X className="size-4" />
          </Button>
        </DialogClose>
      </div>

      {/* Preview area */}
      <div className="min-h-0 flex-1 overflow-hidden px-6 bg-white">
        {isPreviewLoading ? (
          <div className="flex size-full flex-col items-center justify-center gap-3">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Loading document preview…
            </p>
          </div>
        ) : (
          <>
            {isPdf && (
              <div className="size-full bg-muted px-8 border border-gray-100">
                <PdfViewerLazy
                  url={resolvedPreviewUrl}
                  currentPage={currentPage}
                  onTotalPagesChange={handleTotalPagesChange}
                  onCurrentPageChange={handleCurrentPageChange}
                />
              </div>
            )}

            {isDocx && (
              <div className="size-full">
                <DocxViewerLazy
                  url={resolvedPreviewUrl}
                  currentPage={currentPage}
                  onTotalPagesChange={handleTotalPagesChange}
                  onCurrentPageChange={handleCurrentPageChange}
                />
              </div>
            )}

            {isDoc && (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                <FileText className="size-12 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Preview is not available for .doc files.
                </p>
                <Button variant="outline" size="sm" onClick={handleDownload}>
                  <Download className="mr-2 size-4" />
                  Download to view
                </Button>
              </div>
            )}

            {!isPdf && !isDocx && !isDoc && (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                <FileText className="size-12 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Preview is not available for this file type.
                </p>
                <Button variant="outline" size="sm" onClick={handleDownload}>
                  <Download className="mr-2 size-4" />
                  Download to view
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="relative flex items-center justify-end gap-2 px-6 py-3">
        {/* Page navigation - pill floating over the border */}
        {totalPages > 1 && (
          <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2">
            <PageNavigation
              currentPage={currentPage}
              totalPages={totalPages}
              onPrevious={handlePrevious}
              onNext={handleNext}
              onPageChange={handlePageChange}
            />
          </div>
        )}
        {footer}
        {addToProject && (
          <Button
            size="sm"
            className="relative"
            onClick={addToProject.handler}
            disabled={addToProject.isLoading}
          >
            <span className={addToProject.isLoading ? "invisible" : ""}>
              Add to Project files
            </span>
            {addToProject.isLoading && (
              <Loader2 className="absolute size-4 animate-spin" />
            )}
          </Button>
        )}
      </div>
    </DialogContent>
  );

  if ("trigger" in props && props.trigger) {
    return (
      <Dialog open={internalOpen} onOpenChange={setInternalOpen}>
        <DialogTrigger asChild>{props.trigger}</DialogTrigger>
        {content}
      </Dialog>
    );
  }

  return <Dialog {...dialogProps}>{content}</Dialog>;
}
