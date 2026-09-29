"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileText,
  FileWarning,
  Layers,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { useDropzone } from "react-dropzone";

import { useProjectDocuments } from "@wildfires-org/turboplan-documents/client";
import { processAndSaveGisZip } from "@wildfires-org/turboplan-map/client";
import { useFileUpload } from "@wildfires-org/turboplan-upload/client";
import {
  classifyProjectFile,
  GIS_ARCHIVE_MAX_FILE_SIZE,
  GIS_ARCHIVE_MIME_TYPES,
  getProjectFileMaxSize,
  PROJECT_DOCUMENT_ACCEPT,
  PROJECT_DOCUMENT_MAX_FILE_SIZE,
  type ProjectFileKind,
  resolveProjectFileContentType,
} from "@wildfires-org/turboplan-upload/types";
import { Button } from "@wildfires-org/turboplan-utils";

import { CHIP_BASE_CLASS, CHIP_TONE_CLASS, type ChipTone } from "@/lib/glass";
import {
  type DropRow,
  type DropRowStatus,
  type DropRowTone,
  formatGisResult,
  formatMegabytes,
  getDropRowStatus,
  getDropRowTypeLabel,
  getGisResultPhase,
  hasPendingExtraction,
} from "@/lib/project-context-drop";
import { cn } from "@/lib/utils";

interface ProjectContextDropzoneProps {
  projectId: string;
  /** Documents module enabled: accept PDF / Word files */
  acceptsDocuments: boolean;
  /** Map module enabled: accept zipped GIS layers */
  acceptsGisLayers: boolean;
  className?: string;
}

// Poll the documents list while a dropped document waits for its text; the
// extraction worker picks new documents up within a few seconds.
const EXTRACTION_POLL_INTERVAL_MS = 4000;

const GIS_ALLOWED_TYPES = [...GIS_ARCHIVE_MIME_TYPES];

const TONE_CHIP: Record<DropRowTone, ChipTone> = {
  progress: "info",
  success: "brand",
  warning: "neutral",
  error: "danger",
};

const getErrorMessage = (error: unknown, fallback: string) => {
  return error instanceof Error && error.message ? error.message : fallback;
};

/** Re-wrap a file whose browser-reported type is missing or generic. */
const withResolvedContentType = (file: File): File => {
  const contentType = resolveProjectFileContentType(file);
  if (!contentType || contentType === file.type) {
    return file;
  }
  return new File([file], file.name, {
    type: contentType,
    lastModified: file.lastModified,
  });
};

const getDropHint = (acceptsDocuments: boolean, acceptsGisLayers: boolean) => {
  if (acceptsDocuments && acceptsGisLayers) {
    return "Drop PDFs, Word documents or zipped GIS layers (shapefile, geodatabase)";
  }
  if (acceptsGisLayers) {
    return "Drop zipped GIS layers (shapefile, geodatabase)";
  }
  return "Drop PDFs or Word documents";
};

const getLimitsHint = (
  acceptsDocuments: boolean,
  acceptsGisLayers: boolean,
) => {
  const limits: string[] = [];
  if (acceptsDocuments) {
    limits.push(
      `PDF, DOC, DOCX up to ${formatMegabytes(PROJECT_DOCUMENT_MAX_FILE_SIZE)}`,
    );
  }
  if (acceptsGisLayers) {
    limits.push(`ZIP up to ${formatMegabytes(GIS_ARCHIVE_MAX_FILE_SIZE)}`);
  }
  return limits.join(" · ");
};

/**
 * One drop target for everything that gives a project context: documents go
 * to the project documents (and get their text extracted for the AI), zipped
 * GIS layers go straight onto the project map. Takes many files at once and
 * shows a status row per file.
 */
export function ProjectContextDropzone({
  projectId,
  acceptsDocuments,
  acceptsGisLayers,
  className,
}: ProjectContextDropzoneProps) {
  const [rows, setRows] = useState<DropRow[]>([]);
  const nextRowIdRef = useRef(0);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  // Function form: SWR re-evaluates it on every render and after every poll,
  // so polling starts when a document is registered and stops once its text
  // extraction settles.
  const { documents: uploadedDocuments, uploadDocument } = useProjectDocuments({
    projectId,
    source: "upload",
    refreshInterval: (latestDocuments) =>
      hasPendingExtraction(rowsRef.current, latestDocuments ?? [])
        ? EXTRACTION_POLL_INTERVAL_MS
        : 0,
  });
  const { upload: uploadToStorage } = useFileUpload({
    maxSize: GIS_ARCHIVE_MAX_FILE_SIZE,
    allowedTypes: GIS_ALLOWED_TYPES,
  });

  const updateRow = useCallback((id: string, patch: Partial<DropRow>) => {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  }, []);

  const getRejection = useCallback(
    (file: File, kind: ProjectFileKind): string | null => {
      if (kind === "unsupported") {
        return "Unsupported file type";
      }
      if (kind === "document" && !acceptsDocuments) {
        return "Documents are not enabled for this project";
      }
      if (kind === "gis-zip" && !acceptsGisLayers) {
        return "Map layers are not enabled for this project";
      }
      const maxSize = getProjectFileMaxSize(kind);
      if (maxSize && file.size > maxSize) {
        return kind === "gis-zip"
          ? `GIS ZIP too large, max ${formatMegabytes(maxSize)}`
          : `File too large, max ${formatMegabytes(maxSize)}`;
      }
      return null;
    },
    [acceptsDocuments, acceptsGisLayers],
  );

  const importDocument = useCallback(
    async (row: DropRow, file: File) => {
      updateRow(row.id, { phase: "uploading" });
      try {
        const document = await uploadDocument(file);
        if (!document) {
          throw new Error("The document could not be registered");
        }
        updateRow(row.id, { phase: "registered", documentId: document.id });
      } catch (error) {
        updateRow(row.id, {
          phase: "error",
          message: getErrorMessage(error, "Upload failed"),
        });
      }
    },
    [updateRow, uploadDocument],
  );

  const importGisArchive = useCallback(
    async (row: DropRow, file: File) => {
      updateRow(row.id, { phase: "uploading" });
      try {
        const stored = await uploadToStorage(file);
        updateRow(row.id, { phase: "processing" });
        const result = await processAndSaveGisZip({
          projectId,
          url: stored.url,
          fileName: file.name,
        });
        const summary = formatGisResult(result);
        updateRow(row.id, {
          phase: getGisResultPhase(result),
          message:
            result.errors.length > 0
              ? `${summary}. ${result.errors[0]}`
              : summary,
        });
      } catch (error) {
        updateRow(row.id, {
          phase: "error",
          message: getErrorMessage(error, "Could not read GIS layers"),
        });
      }
    },
    [projectId, updateRow, uploadToStorage],
  );

  const handleDrop = useCallback(
    async (files: File[]) => {
      const queued = files.map((original) => {
        const file = withResolvedContentType(original);
        const kind = classifyProjectFile(file);
        const rejection = getRejection(file, kind);
        nextRowIdRef.current += 1;
        const row: DropRow = {
          id: `drop-${nextRowIdRef.current}`,
          name: file.name,
          kind,
          phase: rejection ? "error" : "queued",
          message: rejection ?? undefined,
        };
        return { row, file };
      });

      setRows((current) => [...queued.map(({ row }) => row), ...current]);

      // One file at a time: GIS processing is heavy, and a steady sequence
      // is easier to follow in the list than everything spinning at once.
      for (const { row, file } of queued) {
        if (row.phase === "error") {
          continue;
        }
        if (row.kind === "document") {
          await importDocument(row, file);
        } else {
          await importGisArchive(row, file);
        }
      }
    },
    [getRejection, importDocument, importGisArchive],
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop: handleDrop,
    multiple: true,
    noClick: true,
    noKeyboard: true,
  });

  const inputAccept = useMemo(() => {
    const accept: string[] = [];
    if (acceptsDocuments) {
      accept.push(PROJECT_DOCUMENT_ACCEPT);
    }
    if (acceptsGisLayers) {
      accept.push(...GIS_ARCHIVE_MIME_TYPES, ".zip");
    }
    return accept.join(",");
  }, [acceptsDocuments, acceptsGisLayers]);

  const rowStatuses = rows.map((row) => ({
    row,
    status: getDropRowStatus(row, uploadedDocuments),
  }));
  const hasFinishedRows = rowStatuses.some(({ status }) => status.isFinished);

  const handleDismiss = (id: string) => {
    setRows((current) => current.filter((row) => row.id !== id));
  };

  const handleClearFinished = () => {
    const finishedIds = new Set(
      rowStatuses
        .filter(({ status }) => status.isFinished)
        .map(({ row }) => row.id),
    );
    setRows((current) => current.filter((row) => !finishedIds.has(row.id)));
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div
        {...getRootProps()}
        className={cn(
          "flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-colors duration-150 sm:flex-row sm:text-left",
          isDragActive
            ? "border-brand-700 bg-brand-50/80"
            : "border-brand-800/25 bg-white/40 hover:border-brand-800/40 dark:bg-slate-900/30",
        )}
      >
        <input {...getInputProps()} accept={inputAccept} />
        <div
          aria-hidden
          className={cn(
            "flex size-14 shrink-0 items-center justify-center rounded-full border border-white/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_10px_30px_-12px_rgba(21,102,71,0.18)]",
            isDragActive ? "bg-brand-50" : "bg-white/55",
          )}
        >
          <Upload className="size-6 text-brand-800" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-[15px] font-medium leading-6 text-foreground">
            {isDragActive
              ? "Drop to add to this project"
              : getDropHint(acceptsDocuments, acceptsGisLayers)}
          </p>
          <p className="text-[13px] leading-5 text-gray-550">
            Documents are added to the project and read by the assistant; GIS
            layers go straight onto the project map.
          </p>
          <p className="text-xs leading-5 text-gray-550">
            {getLimitsHint(acceptsDocuments, acceptsGisLayers)}
          </p>
        </div>
        <Button
          type="button"
          variant="glass"
          size="sm"
          onClick={open}
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
          <ul aria-live="polite" className="space-y-2">
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
}

interface DropRowItemProps {
  row: DropRow;
  status: DropRowStatus;
  onDismiss: (id: string) => void;
}

function DropRowItem({ row, status, onDismiss }: DropRowItemProps) {
  const KindIcon =
    row.kind === "gis-zip"
      ? Layers
      : row.kind === "document"
        ? FileText
        : FileWarning;

  return (
    <li className="flex items-start gap-3 rounded-xl border border-white/90 bg-white/70 px-3 py-2.5 dark:border-white/10 dark:bg-slate-900/50">
      <span
        aria-hidden
        className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-brandAlt-100 text-brand-800 dark:bg-white/10"
      >
        <KindIcon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium leading-5 text-foreground">
          {row.name}
        </p>
        <p
          className={cn(
            "text-xs leading-5",
            status.tone === "error" ? "text-error-700" : "text-gray-550",
          )}
        >
          {getDropRowTypeLabel(row)}
          {status.detail ? ` · ${status.detail}` : ""}
        </p>
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
      </span>
      {status.isFinished && (
        <button
          type="button"
          onClick={() => onDismiss(row.id)}
          aria-label={`Dismiss ${row.name}`}
          className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-gray-550 hover:bg-white hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700 dark:hover:bg-white/10"
        >
          <X className="size-4" />
        </button>
      )}
    </li>
  );
}

function StatusIcon({
  tone,
  phase,
}: {
  tone: DropRowTone;
  phase: DropRow["phase"];
}) {
  if (tone === "success") {
    return <CheckCircle2 aria-hidden />;
  }
  if (tone === "error" || tone === "warning") {
    return <AlertCircle aria-hidden />;
  }
  if (phase === "queued") {
    return <Clock aria-hidden />;
  }
  return (
    <Loader2 aria-hidden className="animate-spin motion-reduce:animate-none" />
  );
}
