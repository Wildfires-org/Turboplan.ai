"use client";

import { useState } from "react";

import { ChevronDown, FileText, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { uploadBlobToProject } from "@wildfires-org/turboplan-documents/client";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@wildfires-org/turboplan-utils";

import { DownloadIcon } from "@/components/icons";

type ExportFormat = "pdf" | "docx";

const PDF_MIME = "application/pdf";
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

type BuiltBlob = {
  blob: Blob;
  filename: string;
  mime: string;
};

const formatLabel = (format: ExportFormat): string =>
  format === "pdf" ? "PDF" : "Word document";

const buildBlob = async (
  format: ExportFormat,
  content: string,
  title: string,
  projectId?: string,
): Promise<BuiltBlob> => {
  if (format === "pdf") {
    const { generatePdfFromMarkdownClient, sanitizePdfFilename } = await import(
      "@/lib/export/markdown-to-pdf"
    );
    const blob = await generatePdfFromMarkdownClient(content, title, projectId);
    return { blob, filename: sanitizePdfFilename(title), mime: PDF_MIME };
  }

  const { generateDocxFromMarkdown, sanitizeFilename } = await import(
    "@/lib/export/markdown-to-docx"
  );
  const { fetchLetterheadLogo } = await import("@/lib/export/letterhead-logo");
  const { fetchDocumentFooter } = await import("@/lib/export/document-footer");
  // The server embeds the logo and footer for PDFs; for client-generated docx
  // we fetch them here. Both resolve to empty when unconfigured and the export
  // proceeds without them.
  const [logo, footer] = await Promise.all([
    fetchLetterheadLogo(projectId),
    fetchDocumentFooter(projectId),
  ]);
  const blob = await generateDocxFromMarkdown(
    content,
    title,
    logo ?? undefined,
    footer,
  );
  return { blob, filename: sanitizeFilename(title), mime: DOCX_MIME };
};

interface ExportDocumentMenuProps {
  content: string;
  title: string;
  projectId?: string;
  disabled?: boolean;
}

export function ExportDocumentMenu({
  content,
  title,
  projectId,
  disabled = false,
}: ExportDocumentMenuProps) {
  const [isBusy, setIsBusy] = useState(false);
  const isInteractionBlocked = isBusy || disabled;

  const handleDownload = async (format: ExportFormat) => {
    setIsBusy(true);
    const toastId = toast.loading(`Preparing ${formatLabel(format)}…`);

    try {
      const { blob, filename } = await buildBlob(
        format,
        content,
        title,
        projectId,
      );
      const { downloadBlob } = await import("@/lib/export/markdown-to-docx");
      downloadBlob(blob, filename);
      toast.success("Document downloaded!", { id: toastId });
    } catch (_error) {
      toast.error("Failed to download document", { id: toastId });
    } finally {
      setIsBusy(false);
    }
  };

  const handleSave = async (format: ExportFormat) => {
    if (!projectId) {
      return;
    }

    setIsBusy(true);
    const toastId = toast.loading(`Saving ${formatLabel(format)} to project…`);

    try {
      const { blob, filename, mime } = await buildBlob(
        format,
        content,
        title,
        projectId,
      );
      const file = new File([blob], filename, { type: mime });
      await uploadBlobToProject(projectId, file);
      toast.success("Saved to project!", { id: toastId });
    } catch (_error) {
      toast.error("Failed to save document", { id: toastId });
    } finally {
      setIsBusy(false);
    }
  };

  const handleSaveAndDownload = async (format: ExportFormat) => {
    if (!projectId) {
      return;
    }

    setIsBusy(true);
    const toastId = toast.loading(
      `Saving & downloading ${formatLabel(format)}…`,
    );

    try {
      const { blob, filename, mime } = await buildBlob(
        format,
        content,
        title,
        projectId,
      );
      const { downloadBlob } = await import("@/lib/export/markdown-to-docx");
      downloadBlob(blob, filename);
      const file = new File([blob], filename, { type: mime });
      await uploadBlobToProject(projectId, file);
      toast.success("Saved to project and downloaded!", { id: toastId });
    } catch (_error) {
      toast.error("Failed to save and download document", { id: toastId });
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="h-fit py-1.5 px-2 dark:hover:bg-zinc-700"
          aria-label="Download or save document"
          disabled={isInteractionBlocked}
        >
          {isBusy ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <DownloadIcon size={18} />
          )}
          <span>Download</span>
          <ChevronDown size={16} />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <DownloadIcon size={16} />
            <span className="ml-2">Download</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem
              disabled={isInteractionBlocked}
              onClick={() => handleDownload("pdf")}
            >
              <FileText size={16} className="mr-2" />
              PDF
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={isInteractionBlocked}
              onClick={() => handleDownload("docx")}
            >
              <FileText size={16} className="mr-2" />
              Word (.docx)
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {projectId ? (
          <>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Save size={16} />
                <span className="ml-2">Save to project</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem
                  disabled={isInteractionBlocked}
                  onClick={() => handleSave("pdf")}
                >
                  <FileText size={16} className="mr-2" />
                  PDF
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={isInteractionBlocked}
                  onClick={() => handleSave("docx")}
                >
                  <FileText size={16} className="mr-2" />
                  Word (.docx)
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <DownloadIcon size={16} />
                <span className="ml-2">Save &amp; download</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem
                  disabled={isInteractionBlocked}
                  onClick={() => handleSaveAndDownload("pdf")}
                >
                  <FileText size={16} className="mr-2" />
                  PDF
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={isInteractionBlocked}
                  onClick={() => handleSaveAndDownload("docx")}
                >
                  <FileText size={16} className="mr-2" />
                  Word (.docx)
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
