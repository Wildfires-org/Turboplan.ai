"use client";

import { useCallback } from "react";

import { CheckCheck, ExternalLink, FileSymlink } from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Checkbox,
} from "@wildfires-org/turboplan-utils";

import type { ContextItem } from "../../../types";
import { useSectionSaveRegistration } from "../../contexts/save-to-project-context";
import { useIndexSelection } from "../../hooks/use-index-selection";
import { useSaveToProject } from "../../hooks/use-save-to-project";
import {
  ResearchSectionBody,
  ResearchSectionHeader,
  ResearchSectionRoot,
  SelectAllControl,
} from "../ui/research-section";
import { sectionItemSurfaceVariants } from "../ui/section-item";

const getHostname = (url: string) => {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
};

type ContextSectionProps = {
  messageId: string;
  projectId?: string;
  context: ContextItem[];
};

export function ContextSection({
  messageId,
  projectId,
  context,
}: ContextSectionProps) {
  const { save, isSaving } = useSaveToProject(messageId, "context", projectId);
  const isSelectable = useCallback((item: ContextItem) => !item.saved, []);
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
    items: context,
    isSelectable,
  });

  const handleSave = useCallback(async () => {
    if (selectedCount === 0) {
      return null;
    }
    try {
      const itemNames = [...selectedIndices].map((i) => context[i].label);
      const result = await save({ itemIndices: [...selectedIndices] });
      if (result) {
        return { savedCount: result.savedCount, itemNames };
      }
      return null;
    } catch (error) {
      console.error("[ContextSection] Save failed:", error);
      return null;
    }
  }, [save, selectedCount, selectedIndices, context]);

  useSectionSaveRegistration("context", selectedCount, handleSave, clear);

  return (
    <ResearchSectionRoot tone="indigo">
      <ResearchSectionHeader
        tone="indigo"
        icon={<FileSymlink className="size-4" />}
        title="Relevant Context"
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
      <ResearchSectionBody className="gap-0">
        <Accordion
          type="multiple"
          defaultValue={context.length > 0 ? ["ctx-0"] : undefined}
          className="flex flex-col gap-2"
        >
          {context.map((item, index) => (
            <AccordionItem
              key={`${item.label}-${index}`}
              value={`ctx-${index}`}
              className={sectionItemSurfaceVariants()}
            >
              <div className="flex items-center gap-3">
                {item.saved ? (
                  <CheckCheck className="size-4 text-brand-700 shrink-0" />
                ) : (
                  <Checkbox
                    checked={isIndexSelected(index)}
                    onCheckedChange={() => toggleIndex(index)}
                    disabled={isSaving}
                    aria-label={`Select context ${item.label}`}
                    variant="dark"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <AccordionTrigger className="min-w-0 p-0 leading-none hover:no-underline">
                    <span className="min-w-0 flex-1 truncate pr-2 text-xs text-neutral-700 font-semibold text-left leading-4">
                      {item.label}
                    </span>
                  </AccordionTrigger>
                </div>
              </div>
              <AccordionContent>
                <div className="pl-7">
                  <p className="text-xs text-gray-550 leading-4">
                    {item.content}
                  </p>
                  {item.url && (
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-sm border bg-brand-50 border-brandAlt-200 text-brand-800 hover:bg-brand-100 dark:bg-brand-950/30 dark:border-white/10 dark:text-brand-300 transition-colors"
                      >
                        <ExternalLink className="size-3" />
                        {getHostname(item.url)}
                      </a>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </ResearchSectionBody>
    </ResearchSectionRoot>
  );
}
