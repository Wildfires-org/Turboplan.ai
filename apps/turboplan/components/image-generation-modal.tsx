"use client";

import { useState } from "react";

import { Loader2, WandSparkles } from "lucide-react";
import Image from "next/image";

import { ApiClient } from "@wildfires-org/turboplan-api-client";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@wildfires-org/turboplan-utils";

const apiClient = new ApiClient();

interface GenerateImageResponse {
  image: {
    id: string;
    imageUrl: string;
  };
}

interface ImageGenerationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  onImageGenerated: (imageId: string, imageUrl: string) => void;
}

export function ImageGenerationModal({
  open,
  onOpenChange,
  projectId,
  projectName,
  onImageGenerated,
}: ImageGenerationModalProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImageId, setGeneratedImageId] = useState<string | null>(null);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    setGeneratedImageId(null);
    setGeneratedImageUrl(null);

    try {
      const { data, error: apiError } =
        await apiClient.post<GenerateImageResponse>("/api/ai/generate-image", {
          entityId: projectId,
          entityType: "project",
          title: projectName,
        });

      if (apiError || !data) {
        throw new Error(apiError || "Failed to generate image");
      }

      setGeneratedImageId(data.image.id);
      setGeneratedImageUrl(data.image.imageUrl);
    } catch (err) {
      console.error("Error generating image:", err);
      setError(err instanceof Error ? err.message : "Failed to generate image");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = () => {
    if (generatedImageId && generatedImageUrl) {
      onImageGenerated(generatedImageId, generatedImageUrl);
      onOpenChange(false);
      // Reset state for next time
      setGeneratedImageId(null);
      setGeneratedImageUrl(null);
      setError(null);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset state
    setGeneratedImageId(null);
    setGeneratedImageUrl(null);
    setError(null);
    setIsGenerating(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-screen-toast-mobile">
        <DialogHeader>
          <DialogTitle>Generate Cover Image</DialogTitle>
          <DialogDescription>
            AI will create a unique cover image based on your project &quot;
            {projectName}&quot;
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!generatedImageUrl && !isGenerating && !error && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <span className="glass flex size-16 items-center justify-center rounded-full text-brand-800">
                <WandSparkles aria-hidden className="size-7" />
              </span>
              <p className="text-sm text-muted-foreground text-center">
                Click the button below to generate a unique cover image
              </p>
              <Button onClick={handleGenerate} size="lg" variant="brand">
                <WandSparkles className="size-4" />
                Generate Image
              </Button>
            </div>
          )}

          {isGenerating && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="size-12 animate-spin text-brand-800 motion-reduce:animate-none" />
              <p className="text-sm text-muted-foreground">
                Generating your image...
              </p>
              <p className="text-xs text-muted-foreground">
                This may take 10-15 seconds
              </p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <p className="text-sm text-destructive">{error}</p>
              <Button onClick={handleGenerate} variant="glass">
                Try Again
              </Button>
            </div>
          )}

          {generatedImageUrl && (
            <div className="space-y-4">
              <div className="relative h-[200px] w-full overflow-hidden rounded-[18px] bg-brandAlt-200">
                <Image
                  src={generatedImageUrl}
                  alt="Generated cover"
                  fill
                  className="size-full object-cover"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button onClick={handleClose} variant="glass">
                  Cancel
                </Button>
                <Button onClick={handleSave} variant="brand">
                  Save Image
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
