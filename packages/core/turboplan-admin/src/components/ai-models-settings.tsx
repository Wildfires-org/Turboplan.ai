"use client";

import { useEffect, useState } from "react";

import { Loader2, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
} from "@wildfires-org/turboplan-utils";

import {
  useAiModels,
  useAvailableModels,
  useUpdateAiModels,
} from "../hooks/use-ai-models";
import { AiModelSelector } from "./ai-model-selector";

const AiModelsSettingsSkeleton = () => (
  <Card>
    <CardHeader>
      <Skeleton className="h-6 w-48" />
    </CardHeader>
    <CardContent className="space-y-6">
      <div className="space-y-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-10 w-full" />
      </div>
    </CardContent>
  </Card>
);

export function AiModelsSettings() {
  const { config, isLoading, error, refreshConfig } = useAiModels();
  const { trigger: updateModels, isMutating: isSaving } = useUpdateAiModels();
  const {
    languageModels,
    imageModels,
    isLoading: modelsLoading,
  } = useAvailableModels();

  const [primaryModel, setPrimaryModel] = useState("");
  const [liteModel, setLiteModel] = useState("");
  const [imagePrimaryModel, setImagePrimaryModel] = useState("");
  const [imageLiteModel, setImageLiteModel] = useState("");

  useEffect(() => {
    if (config) {
      setPrimaryModel(config.primary.currentValue ?? "");
      setLiteModel(config.lite.currentValue ?? "");
      setImagePrimaryModel(config.imagePrimary.currentValue ?? "");
      setImageLiteModel(config.imageLite.currentValue ?? "");
    }
  }, [config]);

  const handleSave = async () => {
    try {
      await updateModels({
        primaryModel: primaryModel.trim() || null,
        liteModel: liteModel.trim() || null,
        imagePrimaryModel: imagePrimaryModel.trim() || null,
        imageLiteModel: imageLiteModel.trim() || null,
      });
      toast.success(
        "AI model configuration saved. Changes take effect within 60 seconds.",
      );
      await refreshConfig();
    } catch {
      toast.error("Failed to save AI model configuration");
    }
  };

  const handleResetAll = async () => {
    try {
      await updateModels({
        primaryModel: null,
        liteModel: null,
        imagePrimaryModel: null,
        imageLiteModel: null,
      });
      setPrimaryModel("");
      setLiteModel("");
      setImagePrimaryModel("");
      setImageLiteModel("");
      toast.success(
        "All model overrides cleared. Changes take effect within 60 seconds.",
      );
      await refreshConfig();
    } catch {
      toast.error("Failed to reset AI model configuration");
    }
  };

  if (isLoading) {
    return <AiModelsSettingsSkeleton />;
  }

  if (error || !config) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-red-500">
            {error || "Failed to load AI model configuration"}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle>Model Configuration</CardTitle>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleResetAll}
            disabled={isSaving}
            className="gap-2"
          >
            {isSaving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RotateCcw className="size-4" />
            )}
            Reset All
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="gap-2">
            {isSaving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Save
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Language Models
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <AiModelSelector
              id="primary-model"
              label="Primary Model"
              value={primaryModel}
              defaultValue={config.primary.defaultValue}
              models={languageModels}
              modelsLoading={modelsLoading}
              onChange={setPrimaryModel}
              disabled={isSaving}
            />
            <AiModelSelector
              id="lite-model"
              label="Lite Model"
              value={liteModel}
              defaultValue={config.lite.defaultValue}
              models={languageModels}
              modelsLoading={modelsLoading}
              onChange={setLiteModel}
              disabled={isSaving}
            />
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Image Models
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <AiModelSelector
              id="image-primary-model"
              label="Image Primary"
              value={imagePrimaryModel}
              defaultValue={config.imagePrimary.defaultValue}
              models={imageModels}
              modelsLoading={modelsLoading}
              onChange={setImagePrimaryModel}
              disabled={isSaving}
            />
            <AiModelSelector
              id="image-lite-model"
              label="Image Lite"
              value={imageLiteModel}
              defaultValue={config.imageLite.defaultValue}
              models={imageModels}
              modelsLoading={modelsLoading}
              onChange={setImageLiteModel}
              disabled={isSaving}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
