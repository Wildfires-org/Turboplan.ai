"use client";

import { useState } from "react";

import {
  ArrowRight,
  Edit,
  FileText,
  MoreVertical,
  Search,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { parseAsString, useQueryState } from "nuqs";

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  TemplateCard,
} from "@wildfires-org/turboplan-utils";
import type { ProjectWithCoverImage } from "@wildfires-org/turboplan-workspace/types";

import { DeleteTemplateDialog } from "@/components/dashboard/delete-template-dialog";
import { EditProjectDialog } from "@/components/dashboard/edit-project-dialog";
import { useProjects } from "@/hooks/use-projects";
import { AppUrls } from "@/lib/nav/urls";

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Templates</h1>
          <p className="text-muted-foreground mt-1">
            Manage reusable project templates in this office.
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search templates..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value || null)}
          className="pl-10"
        />
      </div>

      {/* Templates Grid */}
      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={`skeleton-${i}`}
              className="animate-pulse bg-card rounded-xl border overflow-hidden"
            >
              <div className="aspect-video w-full bg-muted" />
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="size-4 bg-muted rounded" />
                  <div className="h-4 bg-muted rounded w-3/4" />
                </div>
                <div className="h-4 bg-muted rounded w-full" />
                <div className="h-9 bg-muted rounded w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredTemplates.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map((template) => (
            <div key={template.id} className="block">
              <TemplateCard
                name={template.name}
                description={template.description}
                imageUrl={template.coverImageUrl}
                menuSlot={
                  <div onClick={(e) => e.preventDefault()}>
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
                          className="size-8 rounded-full bg-white/80 flex items-center justify-center hover:bg-white transition-colors"
                          aria-label="More options"
                        >
                          <MoreVertical className="size-4 text-[#74777C]" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent side="bottom" align="end">
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
                          className="cursor-pointer text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 size-4" />
                          Delete Template
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                }
                actionSlot={
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="group w-full justify-center hover:bg-brand-800 hover:text-white"
                  >
                    <Link
                      href={AppUrls.template(
                        organizationSlug,
                        officeSlug,
                        template.slug,
                      )}
                    >
                      Start project
                      <ArrowRight className="ml-1 size-3.5 group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </Button>
                }
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="size-12 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
            <FileText className="size-6 opacity-50" />
          </div>
          <h3 className="text-lg font-medium text-muted-foreground mb-2">
            {searchTerm ? "No templates found" : "No templates yet"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {searchTerm
              ? "Try adjusting your search terms to find what you're looking for."
              : "Create a template from an existing project using the project menu."}
          </p>
        </div>
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
