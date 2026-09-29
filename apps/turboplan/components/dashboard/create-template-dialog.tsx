"use client";

import { useRef, useState } from "react";

import { Loader2, X } from "lucide-react";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Input,
  Label,
  Textarea,
} from "@wildfires-org/turboplan-utils";
import type { Project } from "@wildfires-org/turboplan-workspace/types";

interface CreateTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
  onConfirm: (data: { name: string; description: string }) => void;
  isLoading: boolean;
}

export function CreateTemplateDialog({
  open,
  onOpenChange,
  project,
  onConfirm,
  isLoading,
}: CreateTemplateDialogProps) {
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(`Template: ${project.name}`);
  const [description, setDescription] = useState(project.description ?? "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm({ name: name.trim(), description: description.trim() });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        className="max-w-md"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          nameInputRef.current?.focus();
        }}
      >
        <AlertDialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <AlertDialogTitle>Create Template</AlertDialogTitle>
              <AlertDialogDescription>
                Save &quot;{project.name}&quot; as a reusable template
              </AlertDialogDescription>
            </div>
            <Button
              variant="glass"
              size="icon"
              aria-label="Close"
              className="-mr-2 -mt-2 size-8 text-foreground"
              onClick={() => onOpenChange(false)}
            >
              <X className="size-4" />
            </Button>
          </div>
        </AlertDialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="template-name">Template Name</Label>
            <Input
              ref={nameInputRef}
              id="template-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="template-description">Description</Label>
            <Textarea
              id="template-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              disabled={isLoading}
            />
          </div>

          <AlertDialogFooter className="gap-2">
            <Button
              type="button"
              variant="glass"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="brand"
              disabled={isLoading || !name.trim()}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Template"
              )}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
