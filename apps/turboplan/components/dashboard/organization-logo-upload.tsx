"use client";

import { useRef, useState } from "react";

import { useFileUpload } from "@wildfires-org/turboplan-upload/client";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  generateInitialsFromName,
  toast,
} from "@wildfires-org/turboplan-utils";

interface OrganizationLogoUploadProps {
  currentLogoUrl: string | null;
  organizationName: string;
  onLogoChange: (url: string | null) => void;
  disabled?: boolean;
}

export function OrganizationLogoUpload({
  currentLogoUrl,
  organizationName,
  onLogoChange,
  disabled = false,
}: OrganizationLogoUploadProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    currentLogoUrl || null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    upload,
    isUploading,
    progress,
    error: uploadError,
    reset: resetUpload,
  } = useFileUpload({
    maxSize: 10 * 1024 * 1024,
    allowedTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    onError: (error) => {
      console.error("Logo upload error:", error);
      setPreviewUrl(currentLogoUrl || null);
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
    if (!file) return;

    resetUpload();

    const preview = URL.createObjectURL(file);
    setPreviewUrl(preview);

    try {
      const result = await upload(file);
      setPreviewUrl(result.url);
      onLogoChange(result.url);
      URL.revokeObjectURL(preview);
    } catch {
      setPreviewUrl(currentLogoUrl || null);
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
    onLogoChange(null);
  };

  const isBusy = isUploading || disabled;

  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        <Avatar className="size-16">
          <AvatarImage src={previewUrl || ""} alt={organizationName} />
          <AvatarFallback className="text-lg font-semibold">
            {generateInitialsFromName(organizationName)}
          </AvatarFallback>
        </Avatar>

        {isUploading && (
          <div className="absolute inset-0 bg-black/50 rounded-full flex flex-col items-center justify-center">
            <div className="animate-spin rounded-full size-5 border-b-2 border-white" />
            {progress > 0 && (
              <span className="text-white text-[10px] mt-0.5">{progress}%</span>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
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
              onClick={handleRemoveLogo}
              disabled={isBusy}
            >
              Remove
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          JPG, PNG, WebP or GIF. Max 10MB.
        </p>
      </div>

      {uploadError && (
        <p className="text-xs text-destructive">{uploadError.message}</p>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleFileSelect}
        disabled={isBusy}
        className="hidden"
      />
    </div>
  );
}
