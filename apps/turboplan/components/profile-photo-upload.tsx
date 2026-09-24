"use client";

import { useMemo, useRef, useState } from "react";

import { useRouter } from "next/navigation";

import { useFileUpload } from "@wildfires-org/turboplan-upload/client";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  generateInitials,
  toast,
} from "@wildfires-org/turboplan-utils";

import {
  removeProfilePhoto,
  updateProfileAvatarUrl,
} from "@/app/(dashboard)/profile/upload-actions";

interface ProfilePhotoUploadProps {
  currentAvatarUrl?: string | null;
  /**
   * Optional because the caller reads it off the session, which can be missing
   * an id. It is only used to seed avatar initials when the profile has no
   * name, so there is nothing to do when it is absent.
   */
  userId?: string;
  firstName?: string | null;
  lastName?: string | null;
}

export function ProfilePhotoUpload({
  currentAvatarUrl,
  userId,
  firstName,
  lastName,
}: ProfilePhotoUploadProps) {
  const [isRemoving, setIsRemoving] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    currentAvatarUrl || null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Use the new upload hook with 10MB limit for profile photos
  const {
    upload,
    isUploading,
    progress,
    error: uploadError,
    reset: resetUpload,
  } = useFileUpload({
    maxSize: 10 * 1024 * 1024, // 10MB - sufficient for high-quality profile photos
    allowedTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    onError: (error) => {
      console.error("Upload error:", error);
      // Revert preview on error
      setPreviewUrl(currentAvatarUrl || null);
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

    // Reset any previous upload state
    resetUpload();

    // Create preview URL for immediate feedback
    const preview = URL.createObjectURL(file);
    setPreviewUrl(preview);

    try {
      // Upload file to Vercel Blob via client-side direct upload
      const result = await upload(file);

      // Update database with new avatar URL
      await updateProfileAvatarUrl(result.url);

      // Update preview to the actual uploaded URL
      setPreviewUrl(result.url);

      // Clean up the temporary preview URL
      URL.revokeObjectURL(preview);

      // Refresh to show updated data
      router.refresh();
    } catch (error) {
      console.error("Failed to upload photo:", error);
      // Revert preview on error
      setPreviewUrl(currentAvatarUrl || null);
      URL.revokeObjectURL(preview);
    }

    // Clear the file input for subsequent uploads
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemovePhoto = async () => {
    if (!previewUrl) return;

    setIsRemoving(true);
    try {
      await removeProfilePhoto();
      setPreviewUrl(null);
      router.refresh();
    } catch (error) {
      console.error("Failed to remove photo:", error);
      alert("Failed to remove photo. Please try again.");
    } finally {
      setIsRemoving(false);
    }
  };

  const handleChangePhoto = () => {
    fileInputRef.current?.click();
  };

  const initials = useMemo(() => {
    const userIdFallback = userId?.substring(0, 2).toUpperCase() ?? "";
    return generateInitials({ firstName, lastName }, userIdFallback);
  }, [firstName, lastName, userId]);

  const isBusy = isUploading || isRemoving;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      {/* Avatar */}
      <div className="relative shrink-0 self-start sm:self-auto">
        <Avatar className="size-20 ring-4 ring-white shadow-[0_10px_30px_-12px_rgba(21,102,71,0.35)] dark:ring-slate-900">
          <AvatarImage src={previewUrl || ""} alt="Profile photo" />
          <AvatarFallback className="bg-brand-50 text-2xl font-medium text-brand-900">
            {initials}
          </AvatarFallback>
        </Avatar>

        {/* Upload/Remove Progress Overlay */}
        {isBusy && (
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-full bg-brand-950/60">
            <div className="size-6 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            {isUploading && progress > 0 && (
              <span className="mt-1 text-xs tabular-nums text-white">
                {progress}%
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-3">
        <div>
          <p className="text-[15px] font-medium leading-6 tracking-[-0.01em] text-foreground">
            Profile photo
          </p>
          <p className="max-w-md text-[13px] leading-5 text-gray-550">
            Shown to your team on assignments, file ownership, and more.
            Recommended size is 256×256px.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="brand"
            size="sm"
            onClick={handleChangePhoto}
            disabled={isBusy}
            className="h-9 px-4"
          >
            Change photo
          </Button>

          {previewUrl && (
            <Button
              type="button"
              variant="glass"
              size="sm"
              onClick={handleRemovePhoto}
              disabled={isBusy}
              className="h-9 px-4 text-error-700 hover:text-error-800 dark:text-error-400"
            >
              Remove
            </Button>
          )}
        </div>

        {/* Error Message */}
        {uploadError && (
          <p role="alert" className="text-[13px] text-error-700">
            {uploadError.message}
          </p>
        )}
      </div>

      {/* Hidden File Input */}
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
