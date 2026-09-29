"use client";

import { useState } from "react";

import { Layers, Loader2, Trash2 } from "lucide-react";

import {
  type GeospatialLayer,
  useLayerStatus,
} from "@wildfires-org/turboplan-map/client";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
} from "@wildfires-org/turboplan-utils";

import {
  CHIP_BASE_CLASS,
  CHIP_TONE_CLASS,
  DESTRUCTIVE_BUTTON_CLASS,
  PANEL_CLASS,
  PANEL_TITLE_CLASS,
} from "@/lib/glass";
import { cn } from "@/lib/utils";

interface ProjectGisLayersPanelProps {
  projectId: string;
  /** Removing a map layer needs DELETE on the project (owners) */
  canDelete: boolean;
}

const getFeatureCountLabel = (layer: GeospatialLayer) => {
  const count = layer.data?.features.length ?? 0;
  return `${count} feature${count === 1 ? "" : "s"}`;
};

/**
 * The project's map layers, listed on the Context page next to documents so
 * everything dropped into the project shows up in one place. Renders nothing
 * until the project has a layer.
 */
export function ProjectGisLayersPanel({
  projectId,
  canDelete,
}: ProjectGisLayersPanelProps) {
  const { layers, deleteLayer } = useLayerStatus(projectId);
  const [layerToDelete, setLayerToDelete] = useState<GeospatialLayer | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = useState(false);

  if (layers.length === 0) {
    return null;
  }

  const handleDeleteConfirm = async () => {
    if (!layerToDelete?.id) {
      return;
    }
    setIsDeleting(true);
    try {
      // deleteLayer reports success and failure with its own toasts
      await deleteLayer(
        layerToDelete.id,
        layerToDelete.isUnitLayer ? "Units" : "Map",
      );
      setLayerToDelete(null);
    } catch {
      // Already surfaced by deleteLayer
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <section className={cn(PANEL_CLASS, "space-y-4")}>
      <div>
        <h3 className={PANEL_TITLE_CLASS}>GIS layers</h3>
        <p className="text-[13px] leading-5 text-gray-550">
          Layers on the project map, from dropped or uploaded GIS files.
        </p>
      </div>

      <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {layers.map((layer) => (
          <li
            key={layer.id ?? `${layer.source}:${layer.layer}`}
            className="flex items-start gap-3 rounded-xl border border-white/90 bg-white/70 px-3 py-2.5 dark:border-white/10 dark:bg-slate-900/50"
          >
            <span
              aria-hidden
              className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-brandAlt-100 text-brand-800 dark:bg-white/10"
            >
              <Layers className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium leading-5 text-foreground">
                {layer.name}
              </p>
              <p className="truncate text-xs leading-5 text-gray-550">
                {getFeatureCountLabel(layer)}
                {layer.source ? ` · ${layer.source}` : ""}
              </p>
            </div>
            {layer.isUnitLayer && (
              <span
                className={cn(
                  CHIP_BASE_CLASS,
                  CHIP_TONE_CLASS.neutral,
                  "mt-1 shrink-0",
                )}
              >
                Units
              </span>
            )}
            {canDelete && layer.id && (
              <button
                type="button"
                onClick={() => setLayerToDelete(layer)}
                aria-label={`Remove ${layer.name}`}
                className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-gray-550 hover:bg-white hover:text-error-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700 dark:hover:bg-white/10"
              >
                <Trash2 className="size-4" />
              </button>
            )}
          </li>
        ))}
      </ul>

      <AlertDialog
        open={!!layerToDelete}
        onOpenChange={(open) => {
          if (!open) {
            setLayerToDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove map layer?</AlertDialogTitle>
            <AlertDialogDescription>
              {layerToDelete?.name} and its features will be removed from the
              project map. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <Button
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className={DESTRUCTIVE_BUTTON_CLASS}
            >
              {isDeleting && (
                <Loader2 className="animate-spin motion-reduce:animate-none" />
              )}
              Remove
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
