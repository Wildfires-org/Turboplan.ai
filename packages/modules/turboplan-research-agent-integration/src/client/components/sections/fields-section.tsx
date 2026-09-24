"use client";

import { useCallback } from "react";

import { CheckCheck, Tag } from "lucide-react";

import { Checkbox } from "@wildfires-org/turboplan-utils";

import type { FieldItem } from "../../../types";
import { useSectionSaveRegistration } from "../../contexts/save-to-project-context";
import { useIndexSelection } from "../../hooks/use-index-selection";
import { useSaveToProject } from "../../hooks/use-save-to-project";
import {
  ResearchSectionBody,
  ResearchSectionHeader,
  ResearchSectionRoot,
  SelectAllControl,
} from "../ui/research-section";
import { SectionItemCard } from "../ui/section-item";

type FieldsSectionProps = {
  messageId: string;
  projectId?: string;
  fields: FieldItem[];
};

export function FieldsSection({
  messageId,
  projectId,
  fields,
}: FieldsSectionProps) {
  const { save, isSaving } = useSaveToProject(messageId, "fields", projectId);
  const isSelectable = useCallback((field: FieldItem) => !field.saved, []);
  const {
    selectedIndices,
    selectedCount,
    selectableIndices,
    isAllSelected,
    isIndexSelected,
    toggleIndex,
    toggleAll,
    clear,
  } = useIndexSelection({
    items: fields,
    isSelectable,
  });

  const handleSave = useCallback(async () => {
    if (selectedCount === 0) {
      return null;
    }
    try {
      const itemNames = [...selectedIndices].map((i) => fields[i].label);
      const result = await save({ itemIndices: [...selectedIndices] });
      if (result) {
        return { savedCount: result.savedCount, itemNames };
      }
      return null;
    } catch (error) {
      console.error("[FieldsSection] Save failed:", error);
      return null;
    }
  }, [save, selectedCount, selectedIndices, fields]);

  useSectionSaveRegistration("fields", selectedCount, handleSave, clear);

  return (
    <ResearchSectionRoot tone="purple">
      <ResearchSectionHeader
        tone="purple"
        icon={<Tag className="size-4" />}
        title="Project Fields"
        count={fields.length}
        actions={
          selectableIndices.length > 0 ? (
            <SelectAllControl
              checked={isAllSelected}
              onChange={toggleAll}
              disabled={isSaving}
            />
          ) : undefined
        }
      />
      <ResearchSectionBody>
        {fields.map((field, index) => (
          <SectionItemCard key={`${field.label}-${index}`} layout="row">
            {field.saved ? (
              <CheckCheck className="size-4 text-brand-700 shrink-0" />
            ) : (
              <Checkbox
                checked={isIndexSelected(index)}
                onCheckedChange={() => toggleIndex(index)}
                disabled={isSaving}
                aria-label={`Select field ${field.label}`}
                variant="dark"
              />
            )}
            <div className="flex-1 min-w-0 leading-4">
              <span className="text-xs text-neutral-700 font-semibold">
                {field.label}
              </span>
              <span className="text-xs text-gray-550 ml-2">{field.value}</span>
            </div>
          </SectionItemCard>
        ))}
      </ResearchSectionBody>
    </ResearchSectionRoot>
  );
}
