"use client";

import { type ChangeEvent, type DragEvent, useRef, useState } from "react";

import { FileText, Upload, X } from "lucide-react";

import {
  ACCEPT_STRING,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
} from "@wildfires-org/turboplan-documents/client";
import { cn, Label } from "@wildfires-org/turboplan-utils";

interface DocumentDropzoneProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  disabled?: boolean;
}

const ALLOWED_MIME_KEYS = Object.keys(ALLOWED_MIME_TYPES);
const MAX_FILE_SIZE_MB = Math.round(MAX_FILE_SIZE / (1024 * 1024));

// Cap the selection — every file is uploaded to storage in parallel before the
// project create, so an unbounded multi-select would spike memory and writes.
const MAX_DOCUMENT_FILES = 10;

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Returns an inline error message for an invalid file, or null when it passes.
const validateFile = (file: File): string | null => {
  if (!ALLOWED_MIME_KEYS.includes(file.type)) {
    return "unsupported file type (PDF or Word only)";
  }
  if (file.size > MAX_FILE_SIZE) {
    return `exceeds the ${MAX_FILE_SIZE_MB}MB limit`;
  }
  return null;
};

export function DocumentDropzone({
  files,
  onFilesChange,
  disabled,
}: DocumentDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const addFiles = (incoming: File[]) => {
    let accepted: File[] = [];
    const rejected: string[] = [];

    for (const file of incoming) {
      const error = validateFile(file);
      if (error) {
        rejected.push(`${file.name}: ${error}`);
        continue;
      }
      // Skip files already selected (matched by name + size) so the same file
      // isn't added twice across separate drops/browses.
      const isDuplicate = files.some(
        (existing) =>
          existing.name === file.name && existing.size === file.size,
      );
      if (!isDuplicate) {
        accepted.push(file);
      }
    }

    const remainingSlots = Math.max(0, MAX_DOCUMENT_FILES - files.length);
    if (accepted.length > remainingSlots) {
      rejected.push(
        `Only ${MAX_DOCUMENT_FILES} documents can be attached — ${accepted.length - remainingSlots} file(s) skipped`,
      );
      accepted = accepted.slice(0, remainingSlots);
    }

    setErrors(rejected);
    if (accepted.length > 0) {
      onFilesChange([...files, ...accepted]);
    }
  };

  const handleDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (disabled) {
      return;
    }
    addFiles(Array.from(event.dataTransfer.files));
  };

  const handleDragOver = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (!disabled) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleBrowse = () => {
    if (!disabled) {
      inputRef.current?.click();
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(event.target.files ?? []));
    // Reset the input so selecting the same file again re-triggers change.
    event.target.value = "";
  };

  const handleRemove = (index: number) => {
    onFilesChange(files.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <Label>Documents (optional)</Label>

      <button
        type="button"
        onClick={handleBrowse}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        disabled={disabled}
        className={cn(
          "flex w-full flex-col items-center justify-center gap-1 rounded-2xl border-[1.5px] border-dashed border-brandAlt-300 bg-brandAlt-100/70 px-4 py-6 text-center transition-colors hover:bg-brandAlt-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700",
          isDragging && "border-brand-700 bg-brand-50",
          disabled && "cursor-not-allowed opacity-60 hover:bg-brandAlt-100/70",
        )}
      >
        <Upload aria-hidden className="size-5 text-brand-800" />
        <p className="text-sm text-gray-550">
          <span className="font-medium text-brand-800">Click to upload</span> or
          drag and drop
        </p>
        <p className="text-xs text-gray-550">
          PDF or Word, up to {MAX_FILE_SIZE_MB}MB, max {MAX_DOCUMENT_FILES}{" "}
          files
        </p>
      </button>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT_STRING}
        onChange={handleFileChange}
        disabled={disabled}
        className="hidden"
        tabIndex={-1}
      />

      {errors.length > 0 && (
        <ul className="space-y-0.5">
          {errors.map((error) => (
            <li key={error} className="text-sm text-error-700">
              {error}
            </li>
          ))}
        </ul>
      )}

      {files.length > 0 && (
        <ul className="space-y-1.5">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${file.size}`}
              className="glass flex items-center justify-between gap-2 rounded-xl px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <FileText
                  aria-hidden
                  className="size-4 shrink-0 text-brand-800"
                />
                <span className="truncate text-sm text-foreground">
                  {file.name}
                </span>
                <span className="shrink-0 text-xs text-gray-550">
                  {formatFileSize(file.size)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleRemove(index)}
                disabled={disabled}
                aria-label={`Remove ${file.name}`}
                className="shrink-0 rounded p-0.5 text-gray-550 transition-colors hover:text-foreground disabled:opacity-50"
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
