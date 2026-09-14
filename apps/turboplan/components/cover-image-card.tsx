"use client";

import { useState } from "react";

import { Loader2, Trash2 } from "lucide-react";
import Image from "next/image";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
} from "@wildfires-org/turboplan-utils";

interface CoverImageCardProps {
  id: string;
  imageUrl: string;
  isSelected: boolean;
  onSelect: (imageUrl: string) => void;
  onDelete: (id: string) => Promise<void>;
}

export function CoverImageCard({
  id,
  imageUrl,
  isSelected,
  onSelect,
  onDelete,
}: CoverImageCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteAlert(true);
  };

  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(id);
      setShowDeleteAlert(false);
    } catch (error) {
      // Error is handled by the parent component
      console.error("Delete failed:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div
        className={`relative w-full h-[80px] rounded-lg overflow-hidden cursor-pointer transition-all ${
          isSelected
            ? "ring-2 ring-primary"
            : "hover:ring-2 hover:ring-muted-foreground"
        }`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => onSelect(imageUrl)}
      >
        <Image
          src={imageUrl}
          alt="Cover option"
          fill
          className="size-full object-cover"
        />

        {isHovered && (
          <div className="absolute top-2 right-2 z-10">
            <Button
              variant="destructive"
              size="icon"
              className="size-8"
              onClick={handleDelete}
              aria-label="Delete image"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        )}

        {isSelected && (
          <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
            <div className="bg-primary text-primary-foreground px-2 py-1 rounded text-xs font-medium">
              Selected
            </div>
          </div>
        )}
      </div>

      <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Cover Image?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this generated image. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
