"use client";

import { useState } from "react";

import { List } from "lucide-react";
import { toast } from "sonner";

import {
  AddFieldDialog,
  ProjectFields,
  useProjectFields,
} from "@wildfires-org/turboplan-fields/client";

import type { DragHandleProps } from "@/components/dashboard/sortable-module";
import { SectionCard } from "@/components/section-card";

interface FieldsSectionProps {
  projectId: string;
  isHidden: boolean;
  isToggling: boolean;
  onToggleVisibility: () => void;
  isPrivate: boolean;
  isTogglingPublicVisibility: boolean;
  onTogglePublicVisibility?: () => void;
  dragHandleProps?: DragHandleProps;
  readOnly?: boolean;
}

export function FieldsSection({
  projectId,
  isHidden,
  isToggling,
  onToggleVisibility,
  isPrivate,
  isTogglingPublicVisibility,
  onTogglePublicVisibility,
  dragHandleProps,
  readOnly = false,
}: FieldsSectionProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const { fields, addField, isMutating } = useProjectFields({ projectId });

  const fieldCount = fields.length;
  const populatedCount = fields.filter(
    (field) => field.values.length > 0,
  ).length;
  const subtitle =
    fieldCount > 0
      ? `${fieldCount} field${fieldCount === 1 ? "" : "s"}${
          populatedCount > 0 ? ` · ${populatedCount} populated` : ""
        }`
      : undefined;

  const handleAddField = async (data: {
    name: string;
    type: "text" | "list";
    isRequired: boolean;
    tooltip?: string;
  }) => {
    try {
      await addField({
        name: data.name,
        type: data.type,
        isRequired: data.isRequired,
        tooltip: data.tooltip,
        values: [],
      });
      toast.success("Field added successfully");
      setIsAddDialogOpen(false);
    } catch {
      toast.error("Failed to add field");
    }
  };

  return (
    <>
      <SectionCard
        title="Fields"
        icon={<List className="size-4" aria-hidden />}
        subtitle={subtitle}
        actionLink={
          !readOnly
            ? { label: "+ Add", onClick: () => setIsAddDialogOpen(true) }
            : undefined
        }
        onToggleVisibility={onToggleVisibility}
        isHidden={isHidden}
        isTogglingVisibility={isToggling}
        onTogglePublicVisibility={onTogglePublicVisibility}
        isPrivate={isPrivate}
        isTogglingPublicVisibility={isTogglingPublicVisibility}
        dragHandleProps={dragHandleProps}
        readOnly={readOnly}
      >
        <ProjectFields projectId={projectId} readOnly={readOnly} />
      </SectionCard>

      <AddFieldDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onSubmit={handleAddField}
        isSubmitting={isMutating}
      />
    </>
  );
}
