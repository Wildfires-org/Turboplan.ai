"use client";

import { useMemo, useState } from "react";

import { ArrowUpRight, PlusIcon } from "lucide-react";
import Link from "next/link";

import BeaverRight from "@/../public/images/beaver_right.png";
import TemplatesBackground from "@/../public/images/templates.png";
import CatalogRequestDialog from "@/components/dialogs/catalog-request-dialog/catalog-request-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTemplates } from "@/hooks/use-templates";
import { routing } from "@/utils/routing";
import { Button } from "../ui/button";
import { CatalogEmptyState } from "./catalog-empty-state";
import TemplateCard from "./template-card";

const SORT_OPTIONS = {
  name: "name",
  newest: "newest",
} as const;

type SortOption = (typeof SORT_OPTIONS)[keyof typeof SORT_OPTIONS];

interface ProjectTemplatesSectionProps {
  organizationId?: string;
  organizationSlug?: string;
  officeId?: string;
  officeSlug?: string;
  /** Maximum number of templates to display (default: 6) */
  limit?: number;
  /** Whether to show the "More Templates" link (default: true) */
  showMoreLink?: boolean;
}

export function ProjectTemplatesSection({
  organizationId,
  organizationSlug,
  officeId,
  officeSlug,
  limit = 6,
  showMoreLink = true,
}: ProjectTemplatesSectionProps) {
  const [sortBy, setSortBy] = useState<SortOption>(SORT_OPTIONS.name);
  const { data, error, isLoading } = useTemplates({
    organizationId,
    organizationSlug,
    officeId,
    officeSlug,
    limit: showMoreLink ? limit : undefined,
  });

  const templates = data?.templates;
  const hasMoreTemplates = data?.hasMore ?? false;

  const sortedTemplates = useMemo(() => {
    if (!templates) return [];

    if (sortBy === SORT_OPTIONS.name) {
      return [...templates].sort((a, b) => a.name.localeCompare(b.name));
    }

    // "newest" — already sorted by createdAt desc from the API
    return templates;
  }, [templates, sortBy]);

  const moreTemplatesUrl = useMemo(() => {
    if (officeSlug && organizationSlug) {
      return routing.catalogOfficeTemplates({ organizationSlug, officeSlug });
    }
    if (organizationSlug) {
      return routing.catalogOrganizationTemplates({ organizationSlug });
    }
    return routing.catalogTemplates();
  }, [organizationSlug, officeSlug]);

  if (isLoading) {
    return (
      <section className="py-10">
        <p className="text-base text-green-60 mb-1">
          Get started with your project
        </p>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl tracking-tight">Project Templates</h2>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-neutral-grey p-6 animate-pulse"
            >
              <div className="h-4 bg-gray-200 rounded w-1/4 mb-4" />
              <div className="h-3 bg-gray-200 rounded w-1/2 mb-2" />
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-4" />
              <div className="h-2 bg-gray-200 rounded w-full mb-4" />
              <div className="h-8 bg-gray-200 rounded w-full" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="py-10">
        <p className="text-base text-green-60 mb-1">
          Get started with your project
        </p>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl tracking-tight">Project Templates</h2>
          </div>
        </div>
        <div className="text-center py-8 text-neutral-grey3">
          Failed to load templates. Please try again later.
        </div>
      </section>
    );
  }

  if (!templates || templates.length === 0) {
    return (
      <section className="py-10">
        <p className="text-base text-green-60 mb-1">
          Get started with your project
        </p>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl tracking-tight">Project Templates</h2>
          </div>
        </div>
        <CatalogEmptyState
          backgroundImage={TemplatesBackground}
          beaverImage={BeaverRight}
          beaverAlt="Beaver mascot waving"
          title="No templates found"
          description="There are no templates matching your current filters. Try adjusting your search or create a new template from scratch."
          actionButton={
            <CatalogRequestDialog>
              <Button
                variant="primary"
                size="small"
                onClick={() => {
                  document
                    .getElementById("accelerate-planning")
                    ?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                <PlusIcon className="size-4 mr-1.5" />
                Create Template
              </Button>
            </CatalogRequestDialog>
          }
        />
      </section>
    );
  }

  return (
    <section className="py-10">
      <p className="text-base text-green-60 mb-1">
        Get started with your project
      </p>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl tracking-tight">Project Templates</h2>
          {!showMoreLink && (
            <Button variant="outline" size="icon" className="size-8">
              <PlusIcon className="size-4" />
            </Button>
          )}
        </div>

        {!showMoreLink && (
          <div className="flex items-center gap-3">
            <Select
              value={sortBy}
              onValueChange={(v) => setSortBy(v as SortOption)}
            >
              <SelectTrigger className="w-fit h-9 bg-white rounded-full gap-1">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SORT_OPTIONS.name}>Name</SelectItem>
                <SelectItem value={SORT_OPTIONS.newest}>Newest</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedTemplates.map((template) => (
          <TemplateCard key={template.id} template={template} />
        ))}
      </div>

      {showMoreLink && hasMoreTemplates && (
        <div className="flex justify-end mt-6">
          <Link
            href={moreTemplatesUrl}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-neutral-black bg-white border border-neutral-grey rounded-full hover:bg-gray-50 transition-colors"
          >
            More Templates
            <ArrowUpRight className="h-4 w-4 text-green-70" />
          </Link>
        </div>
      )}
    </section>
  );
}
