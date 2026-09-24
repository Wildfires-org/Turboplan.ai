"use client";

import { useRef, useState } from "react";

import { ImageIcon } from "lucide-react";

import { useFileUpload } from "@wildfires-org/turboplan-upload/client";
import { Button, toast } from "@wildfires-org/turboplan-utils";

interface DocumentLogoUploadProps {
  label: string;
  value: string | null;
  onChange: (url: string | null) => void;
  helperText?: string;
  disabled?: boolean;
}

const ACCEPT = "image/png,image/jpeg";
const ALLOWED_TYPES = ["image/png", "image/jpeg"];
const DEFAULT_HELPER_TEXT =
  "PNG or JPEG. Shown at the top of generated PDF/Word documents.";

export function DocumentLogoUpload({
  label,
  value,
  onChange,
  helperText = DEFAULT_HELPER_TEXT,
  disabled = false,
}: DocumentLogoUploadProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(value || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    upload,
    isUploading,
    progress,
    error: uploadError,
    reset: resetUpload,
  } = useFileUpload({
    maxSize: 10 * 1024 * 1024,
    allowedTypes: ALLOWED_TYPES,
    onError: (error) => {
      console.error("Document logo upload error:", error);
      setPreviewUrl(value || null);
      toast({
        type: "error",
        description: error.message,
      });
    },
  });

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    resetUpload();

    const preview = URL.createObjectURL(file);
    setPreviewUrl(preview);

    try {
      const result = await upload(file);
      setPreviewUrl(result.url);
      onChange(result.url);
      URL.revokeObjectURL(preview);
    } catch {
      setPreviewUrl(value || null);
      URL.revokeObjectURL(preview);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleChangeLogo = () => {
    fileInputRef.current?.click();
  };

  const handleRemoveLogo = () => {
    setPreviewUrl(null);
    onChange(null);
  };

  const isBusy = isUploading || disabled;

  return (
    <div className="space-y-2">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-4">
        <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-white shadow-[inset_0_2px_6px_rgba(15,23,42,0.10),inset_0_1px_2px_rgba(15,23,42,0.08)] dark:bg-slate-900">
          {previewUrl ? (
            // Logo previews are user-uploaded blob/remote URLs of unknown
            // dimensions, so a plain img keeps the square thumbnail simple.
            <img
              src={previewUrl}
              alt={label}
              className="size-full object-contain"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-brandAlt-400">
              <ImageIcon className="size-6" />
            </div>
          )}

          {isUploading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-brand-950/60">
              <div className="size-5 animate-spin rounded-full border-b-2 border-white" />
              {progress > 0 && (
                <span className="mt-0.5 text-[10px] text-white">
                  {progress}%
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="glass"
              size="sm"
              onClick={handleChangeLogo}
              disabled={isBusy}
            >
              {previewUrl ? "Change logo" : "Upload logo"}
            </Button>

            {previewUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="rounded-xl text-gray-550 hover:bg-brandAlt-100 hover:text-foreground"
                onClick={handleRemoveLogo}
                disabled={isBusy}
              >
                Remove
              </Button>
            )}
          </div>
          <p className="text-xs text-gray-550">{helperText}</p>
          {uploadError && (
            <p className="text-xs text-destructive">{uploadError.message}</p>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT}
          onChange={handleFileSelect}
          disabled={isBusy}
          className="hidden"
        />
      </div>
    </div>
  );
}
