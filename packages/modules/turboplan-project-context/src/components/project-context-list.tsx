"use client";

import { useState } from "react";

import { toast } from "sonner";

import {
  type CreateContextInput,
  type UpdateContextInput,
  useProjectContext,
} from "../hooks";
import type { ContextEntryWithCreator } from "../types";
import { ContextEntryCard } from "./context-entry-card";
import { ContextFormDialog } from "./context-form-dialog";

interface ProjectContextListProps {
  projectId: string;
  readOnly: boolean;
}

export function ProjectContextList({
  projectId,
  readOnly,
}: ProjectContextListProps) {
  const { entries, updateEntry, deleteEntry, isLoading, isUpdating, error } =
    useProjectContext({ projectId });
  const [editingEntry, setEditingEntry] =
    useState<ContextEntryWithCreator | null>(null);

  const handleDelete = async (contextId: string) => {
    try {
      await deleteEntry(contextId);
      toast.success("Context entry deleted");
    } catch {
      toast.error("Failed to delete context entry");
    }
  };

  const handleUpdate = async (data: CreateContextInput) => {
    if (!editingEntry) return;
    try {
      const input: UpdateContextInput = {
        contextId: editingEntry.id,
        label: data.label,
        content: data.content,
        url: data.url ?? null,
      };
      await updateEntry(input);
      toast.success("Context entry updated");
      setEditingEntry(null);
    } catch {
      toast.error("Failed to update context entry");
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 py-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <div className="flex items-center gap-4">
              <div className="size-6 shrink-0 animate-pulse rounded-full bg-gray-200" />
              <div className="h-4 w-48 animate-pulse rounded bg-gray-200" />
            </div>
            <div className="flex gap-4">
              <div className="w-6 shrink-0" />
              <div className="h-24 flex-1 animate-pulse rounded-lg bg-gray-100" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="py-4 text-sm text-gray-500">
        Failed to load context entries.
      </div>
    );
  }

  // Empty state
  if (entries.length === 0) {
    return (
      <div className="group relative flex min-h-[220px] items-center justify-center overflow-hidden">
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="font-semibold">No context entries yet</p>
          <p className="text-sm text-gray-500">
            Add context entries to capture key project information.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-1">
        {entries.map((entry, index) => (
          <ContextEntryCard
            key={entry.id}
            entry={entry}
            onEdit={() => setEditingEntry(entry)}
            onDelete={() => handleDelete(entry.id)}
            isLast={index === entries.length - 1}
            readOnly={readOnly}
          />
        ))}
      </div>

      {editingEntry && (
        <ContextFormDialog
          open={!!editingEntry}
          onOpenChange={(open) => {
            if (!open) setEditingEntry(null);
          }}
          onSubmit={handleUpdate}
          isSubmitting={isUpdating}
          title="Edit Context"
          description="Update the context entry details."
          submitLabel="Save Changes"
          submittingLabel="Saving..."
          initialValues={{
            label: editingEntry.label,
            content: editingEntry.content,
            url: editingEntry.url ?? "",
          }}
        />
      )}
    </>
  );
}
