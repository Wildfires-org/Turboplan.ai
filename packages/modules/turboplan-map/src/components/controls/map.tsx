"use client";

import React, { useCallback, useState } from "react";

import { ArrowRight, Settings } from "lucide-react";
import Link from "next/link";

import { ApiClient } from "@wildfires-org/turboplan-api-client";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  toast,
} from "@wildfires-org/turboplan-utils";

import { useLayerUpload, useMapFileUpload } from "../../client";
import { useLayerStatus } from "../../hooks/use-layer-status";
import type { GeospatialLayer, MapType } from "../../types";
import { getLayerKey } from "../../utils/layer-utils";
import { AddUnitLayerDialog } from "../map-settings/add-unit-layer-dialog";
import { LayerStatusItem } from "../map-settings/layer-status-item";

const apiClient = new ApiClient();

interface MapControlsProps {
  /**
   * When provided, renders a "Go to map" link. The project page omits this
   * (the link is surfaced via the section card's action link instead) and
   * passes only the remaining controls.
   */
  href?: string;
  projectId: string;
}

export function MapControls({ href, projectId }: MapControlsProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUnitDialogOpen, setIsUnitDialogOpen] = useState(false);
  const [previewLayers, setPreviewLayers] = useState<GeospatialLayer[]>([]);
  const [previewSelectedLayerId, setPreviewSelectedLayerId] = useState<
    string | null
  >(null);
  const [isSaving, setIsSaving] = useState(false);
  const [mapType] = useState<string>("openstreetmap");

  // Use layer status hook
  const { status, deleteLayer, refresh } = useLayerStatus(projectId);

  // Use file upload hook
  const { handleFileUpload: uploadFile } = useMapFileUpload();

  // Use layer upload hook
  const { uploadLayer } = useLayerUpload({
    onSuccess: () => {
      toast({
        type: "success",
        description: "Layer uploaded successfully",
      });
    },
    onError: (error) => {
      toast({
        type: "error",
        description: error,
      });
    },
  });

  // Handle opening unit layer upload dialog
  const handleOpenUnitDialog = useCallback(async () => {
    // Create a hidden file input to trigger file selection
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".geojson,.json,.kml,.gpx,.zip";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        try {
          const processedLayers = await uploadFile(file);
          const hasValidLayers = processedLayers.some(
            (layer) => !layer.error && layer.data,
          );

          if (!hasValidLayers) {
            toast({
              type: "error",
              description: "No valid layers found in the uploaded file",
            });
            return;
          }

          setPreviewLayers(processedLayers);
          const firstValidLayer = processedLayers.find(
            (layer) => !layer.error && layer.data,
          );
          if (firstValidLayer) {
            setPreviewSelectedLayerId(getLayerKey(firstValidLayer));
          }
          setIsUnitDialogOpen(true);
        } catch (error) {
          toast({
            type: "error",
            description: `Failed to process file: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
          });
        }
      }
    };
    input.click();
  }, [uploadFile]);

  // Handle saving unit layer
  const handleSaveUnitLayer = useCallback(
    async (unitLayerId: string, unitIdKey: string) => {
      setIsSaving(true);
      try {
        const unitLayer = previewLayers.find(
          (layer) => getLayerKey(layer) === unitLayerId,
        );

        if (!unitLayer || unitLayer.error || !unitLayer.data) {
          toast({
            type: "error",
            description: "Invalid unit layer selected",
          });
          return;
        }

        // Upload only the unit layer (no project layer)
        await uploadLayer(null, unitLayer, unitLayerId, projectId, unitIdKey);

        setIsUnitDialogOpen(false);
        setPreviewLayers([]);
        setPreviewSelectedLayerId(null);

        // Refresh layer status
        await refresh();
      } catch (error) {
        const errorMessage = `Failed to save layer: ${
          error instanceof Error ? error.message : "Unknown error"
        }`;
        toast({
          type: "error",
          description: errorMessage,
        });
      } finally {
        setIsSaving(false);
      }
    },
    [previewLayers, projectId, uploadLayer, refresh],
  );

  const handleDeleteAllLayers = async () => {
    if (
      !confirm(
        "Are you sure you want to delete all maps and layers? This action cannot be undone.",
      )
    ) {
      return;
    }

    setIsDeleting(true);
    try {
      const result = await apiClient.delete<{ success: boolean }>(
        `/api/maps/layers/project/${projectId}`,
      );

      if (result.error) {
        toast({
          type: "error",
          description: "Failed to delete layers. Please try again.",
        });
        throw new Error(result.error);
      }

      if (result.data?.success) {
        // Revalidate the layers cache to refresh the map
        await refresh();
        setIsSettingsOpen(false);
        toast({
          type: "success",
          description: "All layers deleted successfully",
        });
      }
    } catch (error) {
      console.error("Error deleting layers:", error);
      toast({
        type: "error",
        description: "Failed to delete layers. Please try again.",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteLayer = async (layerId: string) => {
    const layerType =
      status?.projectBoundary.layerId === layerId
        ? "Project Boundary"
        : "Units Boundary";
    await deleteLayer(layerId, layerType);
  };

  // Only show controls if there are layers
  if (!status?.hasAnyLayers) {
    return null;
  }

  return (
    <>
      <div className="flex items-center gap-2">
        {href && (
          <Button variant="glass" size="sm" asChild>
            <Link href={href}>
              Go to map
              <ArrowRight className="size-4 ml-2" />
            </Link>
          </Button>
        )}
        {!status?.unitsBoundary.exists && (
          <Button variant="glass" size="sm" onClick={handleOpenUnitDialog}>
            Add unit map
          </Button>
        )}
        <button
          type="button"
          aria-label="Map settings"
          onClick={() => setIsSettingsOpen(true)}
          className="flex size-8 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-white/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
        >
          <Settings aria-hidden className="size-4" />
        </button>
      </div>

      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader className="text-left">
            <DialogTitle>Map Settings</DialogTitle>
            <DialogDescription>
              Manage your project map layers and boundaries.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* Layer Status Section */}
            <div className="space-y-3">
              <h3 className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-600 dark:text-gray-300">
                Layer Status
              </h3>
              <LayerStatusItem
                layerType="project_boundary"
                exists={status?.projectBoundary.exists || false}
                layerName={status?.projectBoundary.name}
                layerId={status?.projectBoundary.layerId}
                onDelete={handleDeleteLayer}
              />
              <LayerStatusItem
                layerType="units_boundary"
                exists={status?.unitsBoundary.exists || false}
                layerName={status?.unitsBoundary.name}
                layerId={status?.unitsBoundary.layerId}
                onUpload={handleOpenUnitDialog}
                onDelete={handleDeleteLayer}
              />
            </div>

            {/* Remove All Section */}
            <div className="flex flex-row items-center justify-between gap-2 rounded-xl bg-error-50 p-4 ring-1 ring-inset ring-error-700/10 dark:bg-red-900/10">
              <div className="flex flex-col gap-1">
                <h3 className="text-sm font-semibold text-red-900 dark:text-red-100">
                  Remove all maps and layers
                </h3>
                <p className="text-sm text-error-700 dark:text-red-300">
                  This will remove all maps and layers from the project.
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteAllLayers}
                disabled={isDeleting}
              >
                {isDeleting ? "Removing..." : "Remove all"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Unit Layer Upload Dialog */}
      <AddUnitLayerDialog
        isOpen={isUnitDialogOpen}
        onClose={() => {
          setIsUnitDialogOpen(false);
          setPreviewLayers([]);
          setPreviewSelectedLayerId(null);
        }}
        validPreviewLayers={previewLayers.filter((layer) => !layer.error)}
        previewSelectedLayerId={previewSelectedLayerId}
        setPreviewSelectedLayerId={setPreviewSelectedLayerId}
        mapType={mapType}
        isSaving={isSaving}
        onSave={handleSaveUnitLayer}
      />
    </>
  );
}
