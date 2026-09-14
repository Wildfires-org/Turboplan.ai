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
  userId: string;
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
    const userIdFallback = userId.substring(0, 2).toUpperCase();
    return generateInitials({ firstName, lastName }, userIdFallback);
  }, [firstName, lastName, userId]);

  const isBusy = isUploading || isRemoving;

  return (
    <div className="flex flex-col items-center space-y-4">
      {/* Photo Description */}
      <div className="text-center max-w-md">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Your photo will be displayed on your professional profile to
          communicate with your team on assignments, file ownership, and more.
        </p>
      </div>

      {/* Photo Display and Controls */}
      <div className="flex items-center space-x-4">
        {/* Avatar */}
        <div className="relative">
          <Avatar className="size-20">
            <AvatarImage src={previewUrl || ""} alt="Profile photo" />
            <AvatarFallback className="text-2xl font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>

          {/* Upload/Remove Progress Overlay */}
          {isBusy && (
            <div className="absolute inset-0 bg-black/50 rounded-full flex flex-col items-center justify-center">
              <div className="animate-spin rounded-full size-6 border-b-2 border-white" />
              {isUploading && progress > 0 && (
                <span className="text-white text-xs mt-1">{progress}%</span>
              )}
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="flex space-x-3">
          <Button
            type="button"
            onClick={handleChangePhoto}
            disabled={isBusy}
            className="text-sm px-4 py-2"
          >
            Change photo
          </Button>

          {previewUrl && (
            <Button
              type="button"
              onClick={handleRemovePhoto}
              disabled={isBusy}
              variant="ghost"
              className="text-sm px-4 py-2"
            >
              Remove
            </Button>
          )}
        </div>

        {/* Recommendation Text */}
        <div className="text-xs text-muted-foreground">
          Recommended size is
          <br />
          256×256px
        </div>
      </div>

      {/* Error Message */}
      {uploadError && (
        <p className="text-sm text-destructive">{uploadError.message}</p>
      )}

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
