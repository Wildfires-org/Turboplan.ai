"use client";

import { useState } from "react";

import {
  Calendar,
  Edit,
  FileText,
  ImageIcon,
  MoreVertical,
  Search,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useDebounceCallback } from "usehooks-ts";

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
} from "@wildfires-org/turboplan-utils";
import type { ProjectWithCoverImage } from "@wildfires-org/turboplan-workspace/types";

import { EditProjectDialog } from "@/components/dashboard/edit-project-dialog";
import { useProjects } from "@/hooks/use-projects";
import { AppUrls } from "@/lib/nav/urls";
import { getStatusColor } from "@/lib/status-colors";

interface TemplatesTableSectionProps {
  organizationSlug: string;
  officeSlug: string;
}

export function TemplatesTableSection({
  organizationSlug,
  officeSlug,
}: TemplatesTableSectionProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] =
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

  // Debounce search term updates
  const debouncedSearch = useDebounceCallback(setDebouncedSearchTerm, 300);

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    debouncedSearch(value);
  };

  const filteredTemplates = templates.filter(
    (template) =>
      template.name
        ?.toLowerCase()
        .includes(debouncedSearchTerm.toLowerCase()) ||
      template.description
        ?.toLowerCase()
        .includes(debouncedSearchTerm.toLowerCase()),
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
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Templates Grid */}
      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={`skeleton-${i}`}
              className="animate-pulse bg-card rounded-lg border overflow-hidden"
            >
              <div className="h-32 w-full bg-muted" />
              <div className="p-6 space-y-4">
                <div className="h-5 bg-muted rounded w-3/4" />
                <div className="h-4 bg-muted rounded w-full" />
                <div className="flex justify-between">
                  <div className="h-4 bg-muted rounded w-24" />
                  <div className="h-4 bg-muted rounded w-16" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredTemplates.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map((template) => (
            <div
              key={template.id}
              className="bg-card rounded-lg border overflow-hidden hover:border-primary/50 transition-colors"
            >
              {/* Cover Image */}
              {template.coverImageUrl ? (
                <div className="relative h-32 w-full">
                  <Image
                    src={template.coverImageUrl}
                    alt={template.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  />
                </div>
              ) : (
                <div className="h-32 w-full bg-muted flex items-center justify-center">
                  <ImageIcon className="size-8 text-muted-foreground/50" />
                </div>
              )}

              <div className="p-6 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <Link
                      // Will implement link to template project page later
                      href="#"
                      className="text-lg font-semibold hover:text-primary transition-colors"
                    >
                      {template.name}
                    </Link>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {template.description || "No description provided"}
                    </p>
                  </div>
                  <DropdownMenu
                    modal={true}
                    open={openDropdown === template.id}
                    onOpenChange={(open) =>
                      setOpenDropdown(open ? template.id : null)
                    }
                  >
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-foreground -mr-2"
                      >
                        <MoreVertical className="size-4" />
                      </Button>
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
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <div className="flex items-center">
                    <Calendar className="size-3 mr-1" />
                    {new Date(template.createdAt).toLocaleDateString()}
                  </div>
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(template.status)}`}
                  >
                    {template.status.charAt(0).toUpperCase() +
                      template.status.slice(1)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="size-12 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
            <FileText className="size-6 opacity-50" />
          </div>
          <h3 className="text-lg font-medium text-muted-foreground mb-2">
            {debouncedSearchTerm ? "No templates found" : "No templates yet"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {debouncedSearchTerm
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
    </div>
  );
}
