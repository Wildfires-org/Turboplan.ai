"use client";

import { useState } from "react";

import {
  ArrowRight,
  Edit,
  LayoutTemplate,
  MoreVertical,
  Search,
  Trash2,
} from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@wildfires-org/turboplan-utils";
import type { ProjectWithCoverImage } from "@wildfires-org/turboplan-workspace/types";

import { CardListEmptyState } from "@/components/dashboard/card-list-empty-state";
import { DeleteTemplateDialog } from "@/components/dashboard/delete-template-dialog";
import { EditProjectDialog } from "@/components/dashboard/edit-project-dialog";
import { EntityCard } from "@/components/dashboard/entity-card";
import { ProjectCardSkeleton } from "@/components/dashboard/project-card-skeleton";
import { useProjects } from "@/hooks/use-projects";
import {
  CHIP_BASE_CLASS,
  CHIP_TONE_CLASS,
  GLASS_ICON_BUTTON_CLASS,
  PAGE_LEAD_CLASS,
  SEARCH_FIELD_CLASS,
  SEARCH_INPUT_CLASS,
  STICKY_TOOLBAR_CLASS,
} from "@/lib/glass";
import { AppUrls } from "@/lib/nav/urls";
import { cn } from "@/lib/utils";

/** Fixed card height, shared with the loading skeleton (no layout shift). */
const TEMPLATE_CARD_HEIGHT_CLASS = "h-[300px]";

interface TemplatesGridSectionProps {
  organizationSlug: string;
  officeSlug: string;
}

export function TemplatesGridSection({
  organizationSlug,
  officeSlug,
}: TemplatesGridSectionProps) {
  const [searchTerm, setSearchTerm] = useQueryState(
    "q",
    parseAsString
      .withDefault("")
      .withOptions({ shallow: true, throttleMs: 300 }),
  );
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] =
    useState<ProjectWithCoverImage | null>(null);
  const [deletingTemplate, setDeletingTemplate] =
    useState<ProjectWithCoverImage | null>(null);

  const {
    projects: templates,
    isLoading,
    refreshProjects: refreshTemplates,
  } = useProjects({
    organizationSlug,
    officeSlug,
    filters: { isTemplate: true },
  });

  const filteredTemplates = templates.filter(
    (template) =>
      template.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.description?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="space-y-2">
      {/* Sticky title + search (same band as the office projects toolbar) */}
      <div className={STICKY_TOOLBAR_CLASS}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="flex min-h-10 items-center gap-2">
            <h2 className="text-[20px] font-medium leading-7 tracking-[-0.02em] text-foreground">
              Templates
            </h2>
            {!isLoading && (
              <span className={cn(CHIP_BASE_CLASS, CHIP_TONE_CLASS.neutral)}>
                {templates.length}
              </span>
            )}
          </div>

          <label className={SEARCH_FIELD_CLASS}>
            <Search aria-hidden className="size-4 shrink-0 text-gray-550" />
            <input
              aria-label="Search templates"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value || null)}
              placeholder="Search templates..."
              className={SEARCH_INPUT_CLASS}
            />
          </label>
        </div>
        <p className={cn(PAGE_LEAD_CLASS, "mt-1")}>
          Reusable project blueprints for this office. Open one to start a new
          project from it.
        </p>
      </div>

      {/* Templates grid */}
      {isLoading ? (
        <ProjectCardSkeleton cardClassName={TEMPLATE_CARD_HEIGHT_CLASS} />
      ) : filteredTemplates.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map((template) => (
            <div key={template.id} className="relative">
              <EntityCard
                className={TEMPLATE_CARD_HEIGHT_CLASS}
                href={AppUrls.template(
                  organizationSlug,
                  officeSlug,
                  template.slug,
                )}
                coverImageUrl={template.coverImageUrl}
                badges={
                  <span className={cn(CHIP_BASE_CLASS, CHIP_TONE_CLASS.brand)}>
                    <LayoutTemplate aria-hidden />
                    Template
                  </span>
                }
                title={template.name}
                description={template.description}
                footer={
                  <span className="inline-flex items-center gap-1 text-[13px] font-medium text-brand-800">
                    Start project
                    <ArrowRight
                      aria-hidden
                      className="size-3.5 transition-transform duration-200 ease-out group-hover:translate-x-0.5 motion-reduce:transition-none"
                    />
                  </span>
                }
              />

              {/* Dropdown overlay (sibling of the card link) */}
              <div className="absolute right-4 top-4 z-10">
                <DropdownMenu
                  modal={true}
                  open={openDropdown === template.id}
                  onOpenChange={(open) =>
                    setOpenDropdown(open ? template.id : null)
                  }
                >
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label={`Actions for ${template.name}`}
                      className={cn(
                        GLASS_ICON_BUTTON_CLASS,
                        "bg-white/70 data-[state=open]:bg-white",
                      )}
                    >
                      <MoreVertical className="size-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    side="bottom"
                    align="end"
                    className="w-[200px] p-1.5"
                  >
                    <DropdownMenuItem
                      onSelect={() => {
                        setEditingTemplate(template);
                        setOpenDropdown(null);
                      }}
                      className="cursor-pointer"
                    >
                      <Edit className="mr-2 size-4" />
                      Edit Template
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => {
                        setDeletingTemplate(template);
                        setOpenDropdown(null);
                      }}
                      className="cursor-pointer text-error-700 focus:bg-error-50 focus:text-error-700 data-[highlighted]:bg-error-50 data-[highlighted]:text-error-700"
                    >
                      <Trash2 className="mr-2 size-4" />
                      Delete Template
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <CardListEmptyState
          icon={LayoutTemplate}
          entityLabel="templates"
          hasSearchTerm={Boolean(searchTerm)}
          emptyDescription="Create a template from an existing project using the project menu."
        />
      )}

      {editingTemplate && (
        <EditProjectDialog
          project={editingTemplate}
          organizationSlug={organizationSlug}
          officeSlug={officeSlug}
          open={!!editingTemplate}
          onOpenChange={(open) => {
            if (!open) {
              setEditingTemplate(null);
              setOpenDropdown(null);
            }
          }}
          onSuccess={() => {
            refreshTemplates();
            setEditingTemplate(null);
            setOpenDropdown(null);
          }}
        />
      )}

      {deletingTemplate && (
        <DeleteTemplateDialog
          template={deletingTemplate}
          open={!!deletingTemplate}
          onOpenChange={(open) => {
            if (!open) {
              setDeletingTemplate(null);
              setOpenDropdown(null);
            }
          }}
          onSuccess={() => {
            refreshTemplates();
            setDeletingTemplate(null);
            setOpenDropdown(null);
          }}
        />
      )}
    </div>
  );
}
