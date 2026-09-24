"use client";

import { type ReactNode, useMemo, useState } from "react";

import { ArrowUpRight, LayoutTemplate, PlusIcon } from "lucide-react";
import Link from "next/link";

import BeaverRight from "@/../public/images/beaver_right.png";
import CatalogRequestDialog from "@/components/dialogs/catalog-request-dialog/catalog-request-dialog";
import { PAGE_CONTAINER } from "@/components/home-v2/ui/layout";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTemplates } from "@/hooks/use-templates";
import { cn } from "@/lib/utils";
import { routing } from "@/utils/routing";
import { CatalogCardSkeletonGrid } from "./catalog-card-skeleton";
import { CatalogEmptyState } from "./catalog-empty-state";
import {
  CATALOG_GRID_CLASS,
  CATALOG_SECTION_CLASS,
  GLASS_BUTTON_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "./catalog-layout";
import { CatalogSectionHeader } from "./catalog-section-header";
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
    if (!templates) {
      return [];
    }

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
      <TemplatesSectionShell>
        <CatalogCardSkeletonGrid label="Loading templates" />
      </TemplatesSectionShell>
    );
  }

  if (error) {
    return (
      <TemplatesSectionShell>
        <div className="glass-card px-6 py-12 text-center font-inter text-[15px] text-egray-700">
          Failed to load templates. Please try again later.
        </div>
      </TemplatesSectionShell>
    );
  }

  if (!templates || templates.length === 0) {
    return (
      <TemplatesSectionShell>
        <CatalogEmptyState
          beaverImage={BeaverRight}
          beaverAlt="Beaver mascot waving"
          title="No templates found"
          description="There are no templates matching your current filters. Try adjusting your search or create a new template from scratch."
          actionButton={
            <CatalogRequestDialog>
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                onClick={() => {
                  document
                    .getElementById("accelerate-planning")
                    ?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                <PlusIcon className="size-4" />
                Create Template
              </button>
            </CatalogRequestDialog>
          }
        />
      </TemplatesSectionShell>
    );
  }

  return (
    <TemplatesSectionShell
      actions={
        !showMoreLink && (
          <>
            <button
              type="button"
              aria-label="Create template"
              className={cn(GLASS_BUTTON_CLASS, "size-10 px-0")}
            >
              <PlusIcon className="size-4" />
            </button>
            <Select
              value={sortBy}
              onValueChange={(v) => setSortBy(v as SortOption)}
            >
              <SelectTrigger className="glass h-10 w-fit gap-1 rounded-xl border-white/85 bg-white/55 px-4 font-inter text-[14px] text-egray-900 focus:ring-0 focus:ring-offset-0 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SORT_OPTIONS.name}>Name</SelectItem>
                <SelectItem value={SORT_OPTIONS.newest}>Newest</SelectItem>
              </SelectContent>
            </Select>
          </>
        )
      }
    >
      <div className={CATALOG_GRID_CLASS}>
        {sortedTemplates.map((template) => (
          <TemplateCard key={template.id} template={template} />
        ))}
      </div>

      {showMoreLink && hasMoreTemplates && (
        <div className="mt-8 flex justify-end">
          <Link href={moreTemplatesUrl} className={GLASS_BUTTON_CLASS}>
            More Templates
            <ArrowUpRight className="size-4" />
          </Link>
        </div>
      )}
    </TemplatesSectionShell>
  );
}

function TemplatesSectionShell({
  actions,
  children,
}: {
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={CATALOG_SECTION_CLASS}>
      <div className={PAGE_CONTAINER}>
        <CatalogSectionHeader
          icon={LayoutTemplate}
          eyebrow="Get started with your project"
          title="Project Templates"
          actions={actions}
        />
        {children}
      </div>
    </section>
  );
}
