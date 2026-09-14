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
      className="flex flex-row items-center justify-between p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-center gap-3">
        {exists ? (
          <CheckCircle2 className="size-5 text-green-500" />
        ) : (
          <Circle className="size-5 text-gray-400" />
        )}
        <div className="flex flex-col">
          <span className="font-medium">
            {displayName}: {exists ? layerName || displayName : displayName}
          </span>
          {!exists && (
            <span className="text-sm text-muted-foreground">
              No layer uploaded
            </span>
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
            className={`text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 transition-opacity ${
              isHovered ? "opacity-100" : "opacity-0"
            }`}
          >
            <Trash2 className="size-4" />
          </Button>
        ) : !exists && onUpload ? (
          <Button variant="outline" size="sm" onClick={onUpload}>
            Upload map
          </Button>
        ) : null}
      </div>
    </div>
  );
}
