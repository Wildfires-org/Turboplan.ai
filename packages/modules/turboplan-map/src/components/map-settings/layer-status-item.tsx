"use client";

import React, { useState } from "react";

import { CheckCircle2, Circle, Trash2 } from "lucide-react";

import { Button } from "@wildfires-org/turboplan-utils";

interface LayerStatusItemProps {
  layerType: "project_boundary" | "units_boundary";
  exists: boolean;
  layerName?: string;
  layerId?: string;
  onUpload?: () => void;
  onDelete?: (layerId: string) => Promise<void>;
}

/**
 * Component for displaying individual layer status with action buttons
 * Following Single Responsibility Principle - only displays status and handles user actions
 */
export function LayerStatusItem({
  layerType,
  exists,
  layerName,
  layerId,
  onUpload,
  onDelete,
}: LayerStatusItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const displayName =
    layerType === "project_boundary" ? "Project Boundary" : "Units Boundary";

  const handleDelete = async () => {
    if (!layerId || !onDelete) return;

    if (
      !confirm(
        `Are you sure you want to delete the ${displayName.toLowerCase()} layer? This action cannot be undone.`,
      )
    ) {
      return;
    }

    setIsDeleting(true);
    try {
      await onDelete(layerId);
    } catch (error) {
      console.error("Error deleting layer:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      className="flex flex-row items-center justify-between rounded-xl border border-white/90 bg-white/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.95)] transition-colors hover:bg-white dark:border-white/10 dark:bg-slate-900/40 dark:hover:bg-gray-800"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-center gap-3">
        {exists ? (
          <CheckCircle2 className="size-5 text-brand-800" />
        ) : (
          <Circle className="size-5 text-gray-500" />
        )}
        <div className="flex flex-col">
          <span className="font-medium">
            {displayName}: {exists ? layerName || displayName : displayName}
          </span>
          {!exists && (
            <span className="text-sm text-gray-600">No layer uploaded</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 min-w-[100px] justify-end">
        {exists && onDelete && layerId ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={isDeleting}
            aria-label="Delete layer"
            className={`text-error-700 transition-opacity hover:bg-error-50 hover:text-error-800 focus-visible:opacity-100 dark:hover:bg-red-900/20 ${
              isHovered ? "opacity-100" : "opacity-0"
            }`}
          >
            <Trash2 className="size-4" />
          </Button>
        ) : !exists && onUpload ? (
          <Button variant="glass" size="sm" onClick={onUpload}>
            Upload map
          </Button>
        ) : null}
      </div>
    </div>
  );
}
