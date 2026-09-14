"use client";

import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import useSWR from "swr";

import { ApiClient, fetcher } from "@wildfires-org/turboplan-api-client";

import { CoverImageCard } from "./cover-image-card";

const apiClient = new ApiClient();

interface GeneratedImage {
  id: string;
  imageUrl: string;
  entityId: string;
  entityType: string;
  prompt: string;
  createdAt: string;
}

interface CoverImageGalleryProps {
  projectId: string;
  currentCoverImageId?: string | null;
  onImageSelect: (imageId: string, imageUrl: string) => void;
}

export function CoverImageGallery({
  projectId,
  currentCoverImageId,
  onImageSelect,
}: CoverImageGalleryProps) {
  const { data, error, isLoading, mutate } = useSWR<{
    images: GeneratedImage[];
  }>(`/api/projects/${projectId}/generated-images`, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });

  const handleDelete = async (imageId: string) => {
    try {
      const { error: apiError } = await apiClient.delete(
        `/api/ai/generated-images/${imageId}`,
      );

      if (apiError) {
        throw new Error(apiError);
      }

      // Revalidate to refresh the list
      await mutate();

      toast.success("Image deleted successfully");
    } catch (err) {
      console.error("Error deleting image:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to delete image",
      );
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-destructive text-center py-4">
        {error.message || "Failed to load images"}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const images = data.images;

  if (images.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-8">
        No generated images yet. Click &quot;Surprise me&quot; to create one!
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {images.map((image) => (
        <CoverImageCard
          key={image.id}
          id={image.id}
          imageUrl={image.imageUrl}
          isSelected={currentCoverImageId === image.id}
          onSelect={(imageUrl) => onImageSelect(image.id, imageUrl)}
          onDelete={handleDelete}
        />
      ))}
    </div>
  );
}
