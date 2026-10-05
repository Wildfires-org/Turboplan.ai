"use client";

import { useEffect, useId, useRef, useState } from "react";

import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Info,
  Loader2,
  MoreHorizontal,
  Pencil,
  Pin,
  Trash2,
} from "lucide-react";

import { useIsExtractionStale } from "@wildfires-org/turboplan-documents/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  isSafeHttpUrl,
} from "@wildfires-org/turboplan-utils";

import { CHIP_BASE_CLASS, CHIP_TONE_CLASS, type ChipTone } from "@/lib/glass";
import {
  DOCUMENT_EXCERPT_CHARS,
  formatCount,
  formatFileSize,
  formatShortDate,
  getDocumentTypeLabel,
  getOrganizationDocumentStatus,
  type OrganizationDocumentStatusTone,
} from "@/lib/organization-context";
import { cn } from "@/lib/utils";
import type { OrganizationDocument } from "@/types/organization-context";

interface OrganizationDocumentRowProps {
  document: OrganizationDocument;
  /** Owner or editor: pin, rename and delete */
  canEdit: boolean;
  /** When this client first saw the document pending (epoch ms) */
  pendingSince?: number;
  onTogglePin: (document: OrganizationDocument) => void;
  onRename: (document: OrganizationDocument) => void;
  onDelete: (document: OrganizationDocument) => void;
}

const TONE_CHIP: Record<OrganizationDocumentStatusTone, ChipTone> = {
  progress: "info",
  success: "brand",
  neutral: "neutral",
  error: "danger",
};

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

const ROW_ICON_BUTTON_CLASS =
  "inline-flex size-8 items-center justify-center rounded-full text-gray-550 transition-colors hover:bg-white hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 data-[state=open]:bg-white dark:hover:bg-white/10 dark:data-[state=open]:bg-white/10";

const KEY_DOCUMENT_HINT = "Key document — always included for the AI first";

/**
 * One organization document: name, type, size, processing status, the key
 * document toggle and actions, and what the AI gets from it.
 */
export const OrganizationDocumentRow = ({
  document,
  canEdit,
  pendingSince,
  onTogglePin,
  onRename,
  onDelete,
}: OrganizationDocumentRowProps) => {
  const isPending = document.extractionStatus === "pending";
  const isStale = useIsExtractionStale(
    isPending,
    pendingSince ?? Date.parse(document.createdAt),
  );
  const status = getOrganizationDocumentStatus(document, isStale);
  const addedOn = formatShortDate(document.createdAt);
  const name = document.originalFilename;

  const [isExpanded, setIsExpanded] = useState(false);
  const panelId = useId();

  // Pinning re-sorts the list, and a row React moves loses focus: put it
  // back on the toggle the user pressed.
  const pinButtonRef = useRef<HTMLButtonElement>(null);
  const shouldRestoreFocusRef = useRef(false);
  useEffect(() => {
    if (!shouldRestoreFocusRef.current) {
      return;
    }
    shouldRestoreFocusRef.current = false;
    pinButtonRef.current?.focus();
  }, [document.isPinned]);

  const handlePinClick = () => {
    shouldRestoreFocusRef.current = true;
    onTogglePin(document);
  };

  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      transition={{ duration: 0.2, ease: EASE_OUT }}
      className="rounded-xl border border-white/90 bg-white/70 px-3 py-3 dark:border-white/10 dark:bg-slate-900/50"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-brandAlt-100 text-brand-800 dark:bg-white/10 dark:text-brand-200"
        >
          <FileText className="size-4" />
        </span>

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex min-w-0 items-center gap-2">
            {isSafeHttpUrl(document.url) ? (
              <a
                href={document.url}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate rounded text-sm font-medium leading-5 text-foreground hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
              >
                {name}
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            ) : (
              <p className="truncate text-sm font-medium leading-5 text-foreground">
                {name}
              </p>
            )}
            {document.isPinned && (
              <span
                className={cn(
                  CHIP_BASE_CLASS,
                  CHIP_TONE_CLASS.brand,
                  "shrink-0",
                )}
              >
                <Pin aria-hidden />
                Key document
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span
              className={cn(
                CHIP_BASE_CLASS,
                CHIP_TONE_CLASS[TONE_CHIP[status.tone]],
              )}
            >
              <StatusIcon document={document} isStale={isStale} />
              {status.label}
            </span>
            <span className="text-xs leading-5 text-gray-550">
              {getDocumentTypeLabel(document.mimeType)} ·{" "}
              {formatFileSize(document.size)}
              {addedOn ? ` · Added ${addedOn}` : ""}
            </span>
          </div>

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
        </div>

        {canEdit && (
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              ref={pinButtonRef}
              type="button"
              onClick={handlePinClick}
              aria-pressed={document.isPinned}
              aria-label={`Key document: ${name}`}
              title={
                document.isPinned ? "Unmark as key document" : KEY_DOCUMENT_HINT
              }
              className={cn(
                ROW_ICON_BUTTON_CLASS,
                document.isPinned &&
                  "bg-brand-50 text-brand-800 hover:bg-brand-100 hover:text-brand-900 dark:bg-brand-900/30 dark:text-brand-200",
              )}
            >
              <Pin
                aria-hidden
                className={cn("size-4", document.isPinned && "fill-current")}
              />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={`More actions for ${name}`}
                  className={ROW_ICON_BUTTON_CLASS}
                >
                  <MoreHorizontal aria-hidden className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => onRename(document)}>
                  <Pencil aria-hidden className="mr-2 size-4" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => onDelete(document)}
                  className="text-error-700 focus:text-error-700 data-[highlighted]:text-error-700"
                >
                  <Trash2 aria-hidden className="mr-2 size-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {document.extractionStatus === "done" && (
        <div className="mt-2 pl-11">
          <button
            type="button"
            onClick={() => setIsExpanded((expanded) => !expanded)}
            aria-expanded={isExpanded}
            aria-controls={panelId}
            className="inline-flex items-center gap-1 rounded text-xs font-medium leading-5 text-brand-800 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 dark:text-brand-300"
          >
            <ChevronRight
              aria-hidden
              className={cn(
                "size-3.5 transition-transform duration-200 motion-reduce:transition-none",
                isExpanded && "rotate-90",
              )}
            />
            What the AI sees
          </button>
          <AnimatePresence initial={false}>
            {isExpanded && (
              <motion.div
                id={panelId}
                key="ai-preview"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: EASE_OUT }}
                className="overflow-hidden"
              >
                <div className="mt-2 whitespace-pre-line rounded-lg bg-slate-900/[0.03] px-3 py-2 text-[13px] leading-5 text-foreground ring-1 ring-inset ring-slate-900/[0.06] [overflow-wrap:anywhere] dark:bg-white/5 dark:ring-white/10">
                  {document.summary ??
                    `No summary — the AI sees the first ${formatCount(DOCUMENT_EXCERPT_CHARS)} characters of the text.`}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.li>
  );
};

const StatusIcon = ({
  document,
  isStale,
}: {
  document: OrganizationDocument;
  isStale: boolean;
}) => {
  switch (document.extractionStatus) {
    case "pending":
      return isStale ? (
        <Clock aria-hidden />
      ) : (
        <Loader2
          aria-hidden
          className="animate-spin motion-reduce:animate-none"
        />
      );
    case "done":
      return document.summary ? (
        <CheckCircle2 aria-hidden />
      ) : (
        <Info aria-hidden />
      );
    case "failed":
      return <AlertCircle aria-hidden />;
    case "unsupported":
      return <Info aria-hidden />;
  }
};
