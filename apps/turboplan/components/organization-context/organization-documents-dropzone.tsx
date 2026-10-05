"use client";

import { motion } from "framer-motion";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileText,
  Info,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { useDropzone } from "react-dropzone";

import {
  PROJECT_DOCUMENT_ACCEPT,
  PROJECT_DOCUMENT_MAX_FILE_SIZE,
} from "@wildfires-org/turboplan-upload/types";
import { Button } from "@wildfires-org/turboplan-utils";
import { ORGANIZATION_DOCUMENTS_MAX } from "@wildfires-org/turboplan-workspace/types";

import { useOrganizationDocumentsDrop } from "@/hooks/use-organization-documents-drop";
import { formatMegabytes } from "@/lib/document-upload-queue";
import { CHIP_BASE_CLASS, CHIP_TONE_CLASS, type ChipTone } from "@/lib/glass";
import {
  getOrganizationDropRowStatus,
  ORGANIZATION_DOCUMENTS_LIMIT_MESSAGE,
  type OrganizationDropRow,
  type OrganizationDropRowStatus,
  type OrganizationDropRowTone,
} from "@/lib/organization-context";
import { cn } from "@/lib/utils";

interface OrganizationDocumentsDropzoneProps {
  organizationId: string;
  className?: string;
}

interface DropRowItemProps {
  row: OrganizationDropRow;
  status: OrganizationDropRowStatus;
  onDismiss: (id: string) => void;
}

const TONE_CHIP: Record<OrganizationDropRowTone, ChipTone> = {
  progress: "info",
  success: "brand",
  neutral: "neutral",
  error: "danger",
};

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

/**
 * Drop target for organization reference documents (PDF / Word, many at
 * once). Files upload one at a time with a status row each; duplicates are
 * skipped and nothing uploads past the organization's document limit.
 */
export const OrganizationDocumentsDropzone = ({
  organizationId,
  className,
}: OrganizationDocumentsDropzoneProps) => {
  const { rows, documentCount, handleDrop, removeRows } =
    useOrganizationDocumentsDrop(organizationId);
  const isFull = documentCount >= ORGANIZATION_DOCUMENTS_MAX;

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop: handleDrop,
    multiple: true,
    noClick: true,
    noKeyboard: true,
    disabled: isFull,
  });

  const rowStatuses = rows.map((row) => ({
    row,
    status: getOrganizationDropRowStatus(row),
  }));
  const hasFinishedRows = rowStatuses.some(({ status }) => status.isFinished);

  const handleDismiss = (id: string) => {
    removeRows(new Set([id]));
  };

  const handleClearFinished = () => {
    removeRows(
      new Set(
        rowStatuses
          .filter(({ status }) => status.isFinished)
          .map(({ row }) => row.id),
      ),
    );
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div
        {...getRootProps()}
        className={cn(
          "flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed px-5 py-6 text-center transition-colors duration-150 sm:flex-row sm:px-6 sm:text-left",
          isFull
            ? "border-slate-900/10 bg-white/30 dark:border-white/10 dark:bg-slate-900/20"
            : isDragActive
              ? "border-brand-700 bg-brand-50/80 dark:bg-brand-900/20"
              : "border-brand-800/25 bg-white/40 hover:border-brand-800/40 dark:bg-slate-900/30",
        )}
      >
        <input {...getInputProps()} accept={PROJECT_DOCUMENT_ACCEPT} />
        <div
          aria-hidden
          className={cn(
            "flex size-12 shrink-0 items-center justify-center rounded-full border border-white/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_10px_30px_-12px_rgba(21,102,71,0.18)] dark:border-white/10",
            isDragActive ? "bg-brand-50" : "bg-white/55 dark:bg-white/10",
          )}
        >
          <Upload
            className={cn(
              "size-5",
              isFull ? "text-gray-550" : "text-brand-800",
            )}
          />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-[15px] font-medium leading-6 text-foreground">
            {isFull
              ? "Document limit reached"
              : isDragActive
                ? "Drop to add to this organization"
                : "Drop PDFs or Word documents"}
          </p>
          <p className="text-[13px] leading-5 text-gray-550">
            {isFull
              ? ORGANIZATION_DOCUMENTS_LIMIT_MESSAGE
              : `PDF, DOC, DOCX up to ${formatMegabytes(PROJECT_DOCUMENT_MAX_FILE_SIZE)} each, ${ORGANIZATION_DOCUMENTS_MAX} documents in total.`}
          </p>
        </div>
        <Button
          type="button"
          variant="glass"
          size="sm"
          onClick={open}
          disabled={isFull}
          className="shrink-0"
        >
          Browse files
        </Button>
      </div>

      {rows.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] font-medium text-foreground">Uploads</p>
            {hasFinishedRows && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClearFinished}
                className="h-7 px-2 text-xs text-gray-550"
              >
                Clear finished
              </Button>
            )}
          </div>
          <ul aria-live="polite" aria-label="Uploads" className="space-y-2">
            {rowStatuses.map(({ row, status }) => (
              <DropRowItem
                key={row.id}
                row={row}
                status={status}
                onDismiss={handleDismiss}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

const DropRowItem = ({ row, status, onDismiss }: DropRowItemProps) => {
  const progress = row.progress ?? 0;

  return (
    <li className="flex items-start gap-3 rounded-xl border border-white/90 bg-white/70 px-3 py-2.5 dark:border-white/10 dark:bg-slate-900/50">
      <span
        aria-hidden
        className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-brandAlt-100 text-brand-800 dark:bg-white/10 dark:text-brand-200"
      >
        <FileText className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium leading-5 text-foreground">
          {row.name}
        </p>
        {status.detail && (
          <p
            className={cn(
              "text-xs leading-5 [overflow-wrap:anywhere]",
              status.tone === "error" ? "text-error-700" : "text-gray-550",
            )}
          >
            {status.detail}
          </p>
        )}
        {row.phase === "uploading" && (
          <div
            role="progressbar"
            aria-label={`Uploading ${row.name}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            className="mt-2 h-1 overflow-hidden rounded-full bg-brand-800/10 dark:bg-white/10"
          >
            <motion.div
              className="h-full origin-left rounded-full bg-brand-700"
              initial={false}
              animate={{ scaleX: progress / 100 }}
              transition={{ duration: 0.2, ease: EASE_OUT }}
            />
          </div>
        )}
      </div>
      <span
        className={cn(
          CHIP_BASE_CLASS,
          CHIP_TONE_CLASS[TONE_CHIP[status.tone]],
          "mt-1 shrink-0",
        )}
      >
        <StatusIcon tone={status.tone} phase={row.phase} />
        {status.label}
        {row.phase === "uploading" && (
          // Shown, not announced: the live list would read every percent.
          <span aria-hidden className="tabular-nums">
            {progress}%
          </span>
        )}
      </span>
      {status.isDismissable && (
        <button
          type="button"
          onClick={() => onDismiss(row.id)}
          aria-label={
            status.isFinished
              ? `Dismiss ${row.name}`
              : `Remove ${row.name} from the upload queue`
          }
          className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-gray-550 hover:bg-white hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700 dark:hover:bg-white/10"
        >
          <X aria-hidden className="size-4" />
        </button>
      )}
    </li>
  );
};

const StatusIcon = ({
  tone,
  phase,
}: {
  tone: OrganizationDropRowTone;
  phase: OrganizationDropRow["phase"];
}) => {
  if (tone === "success") {
    return <CheckCircle2 aria-hidden />;
  }
  if (tone === "error") {
    return <AlertCircle aria-hidden />;
  }
  if (tone === "neutral") {
    return <Info aria-hidden />;
  }
  if (phase === "queued") {
    return <Clock aria-hidden />;
  }
  return (
    <Loader2 aria-hidden className="animate-spin motion-reduce:animate-none" />
  );
};
