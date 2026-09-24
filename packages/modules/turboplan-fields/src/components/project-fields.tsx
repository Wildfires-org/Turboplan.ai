"use client";

import { useState } from "react";

import { ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

import { Skeleton } from "@wildfires-org/turboplan-utils";

import { useProjectFields } from "../hooks";
import { FieldRow } from "./field-row";
import { FieldsFieldItem, FieldsListLayout } from "./fields-list-layout";

/** Number of fields to show before collapsing (even, so the two columns balance) */
const INITIAL_FIELDS_DISPLAY_COUNT = 6;

interface ProjectFieldsProps {
  projectId: string;
  readOnly?: boolean;
}

export function ProjectFields({
  projectId,
  readOnly = false,
}: ProjectFieldsProps) {
  const [showAll, setShowAll] = useState(false);

  const { fields, updateField, deleteField, isLoading, isMutating, error } =
    useProjectFields({ projectId });

  // Sort fields by order
  const sortedFields = [...fields].sort((a, b) => a.order - b.order);

  const displayFields = showAll
    ? sortedFields
    : sortedFields.slice(0, INITIAL_FIELDS_DISPLAY_COUNT);
  const hasMoreFields = sortedFields.length > INITIAL_FIELDS_DISPLAY_COUNT;

  const handleUpdateField = async (
    fieldId: string,
    data: {
      name?: string;
      type?: "text" | "list";
      isRequired?: boolean;
      tooltip?: string | null;
      values?: string[];
    },
  ) => {
    try {
      await updateField(fieldId, data);
      toast.success("Field updated");
    } catch {
      toast.error("Failed to update field");
    }
  };

  const handleDeleteField = async (fieldId: string) => {
    try {
      await deleteField(fieldId);
      toast.success("Field deleted");
    } catch {
      toast.error("Failed to delete field");
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <FieldsListLayout>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          // Same row metrics as FieldRow: label, value, 32px menu slot.
          <FieldsFieldItem key={i} withActions>
            <Skeleton className="h-3 w-44 shrink-0" />
            <Skeleton className="h-3 min-w-0 flex-1" />
            <span className="size-8 shrink-0" />
          </FieldsFieldItem>
        ))}
      </FieldsListLayout>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="rounded-xl bg-error-50 py-8 text-center text-error-700 ring-1 ring-inset ring-error-700/10">
        <p>Failed to load fields</p>
      </div>
    );
  }

  // Empty state
  if (fields.length === 0 && !isLoading) {
    return (
      <div className="group relative flex min-h-[220px] items-center justify-center overflow-hidden py-8">
        <div className="flex flex-col items-center gap-1.5 text-center">
          <h3 className="text-[15px] font-medium leading-6 tracking-[-0.01em] text-foreground">
            No fields yet
          </h3>
          <p className="max-w-xs text-[13px] leading-5 text-gray-600">
            Add custom fields to capture project metadata.
          </p>
        </div>
        <div className="pointer-events-none absolute bottom-0 right-6 translate-y-full transition-transform duration-300 ease-out group-hover:translate-y-[10%]">
          <img
            src="/images/shocked-beaver.png"
            alt=""
            width={118}
            height={129}
          />
        </div>
      </div>
    );
  }

  const footer = hasMoreFields ? (
    <button
      type="button"
      onClick={() => setShowAll(!showAll)}
      className="flex w-full items-center justify-center gap-1 rounded-xl border border-white/85 bg-white/55 px-5 py-2 text-sm font-medium text-brand-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_10px_30px_-12px_rgba(21,102,71,0.18)] transition-[background-color,transform] hover:bg-white/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 active:scale-[0.97] motion-reduce:active:scale-100"
    >
      {showAll ? (
        <>
          Show less
          <ChevronUp className="size-4" />
        </>
      ) : (
        <>
          Load {sortedFields.length - INITIAL_FIELDS_DISPLAY_COUNT} more fields
          <ChevronDown className="size-4" />
        </>
      )}
    </button>
  ) : undefined;

  return (
    <FieldsListLayout variant="bordered" footer={footer}>
      {displayFields.map((field) => (
        <FieldRow
          key={field.id}
          field={field}
          onUpdate={(data) => handleUpdateField(field.id, data)}
          onDelete={() => handleDeleteField(field.id)}
          isUpdating={isMutating}
          readOnly={readOnly}
        />
      ))}
    </FieldsListLayout>
  );
}
