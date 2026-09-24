"use client";

import { type ReactNode, useMemo } from "react";

import { ArrowUpRight, FolderKanban, PlusIcon } from "lucide-react";
import Link from "next/link";
import useSWR from "swr";

import { getLandingPageEnv } from "@wildfires-org/turboplan-env";

import BeaverLeft from "@/../public/images/beaver_left.png";
import { PAGE_CONTAINER } from "@/components/home-v2/ui/layout";
import { fetcher } from "@/lib/utils";
import type { PublicProject } from "@/types/public-project";
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
import { ProjectCard } from "./project-card";

interface ProjectsSectionProps {
  organizationId?: string;
  officeId?: string;
  organizationSlug?: string;
  officeSlug?: string;
  /** Maximum number of projects to display. Omit to show all. */
  limit?: number;
  /** Whether to show the "More Projects" link (default: true) */
  showMoreLink?: boolean;
}

export function ProjectsSection({
  organizationId,
  officeId,
  organizationSlug,
  officeSlug,
  limit,
  showMoreLink = true,
}: ProjectsSectionProps) {
  const { SERVER_URL } = getLandingPageEnv();

  // Build URL with optional query parameters
  const apiUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (organizationId) params.set("organizationId", organizationId);
    if (organizationSlug) params.set("organizationSlug", organizationSlug);
    if (officeId) params.set("officeId", officeId);
    if (officeSlug) params.set("officeSlug", officeSlug);
    const query = params.toString();
    return `${SERVER_URL}/api/public/projects${query ? `?${query}` : ""}`;
  }, [SERVER_URL, organizationId, organizationSlug, officeId, officeSlug]);

  // Build "More Projects" URL based on context
  const moreProjectsUrl = useMemo(() => {
    if (officeSlug && organizationSlug) {
      return routing.catalogOfficeProjects({ organizationSlug, officeSlug });
    }
    if (organizationSlug) {
      return routing.catalogOrganizationProjects({ organizationSlug });
    }
    return routing.catalogProjects();
  }, [organizationSlug, officeSlug]);

  const {
    data: projects,
    error,
    isLoading,
  } = useSWR<PublicProject[]>(apiUrl, fetcher);

  if (isLoading) {
    return (
      <ProjectsSectionShell>
        <CatalogCardSkeletonGrid label="Loading projects" />
      </ProjectsSectionShell>
    );
  }

  if (error) {
    return (
      <ProjectsSectionShell>
        <div className="glass-card px-6 py-12 text-center font-inter text-[15px] text-egray-700">
          Failed to load projects. Please try again later.
        </div>
      </ProjectsSectionShell>
    );
  }

  if (!projects || projects.length === 0) {
    return (
      <ProjectsSectionShell>
        <CatalogEmptyState
          beaverImage={BeaverLeft}
          beaverAlt="Beaver mascot pointing"
          title="Your project list is empty"
          description="Start a new project to track environmental assessments, manage documents, and collaborate with your team."
          actionButton={
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              onClick={() => {
                const container = document.getElementById(
                  "project-prompt-input",
                );
                if (!container) {
                  return;
                }
                const input = container.querySelector<
                  HTMLInputElement | HTMLTextAreaElement
                >("input, textarea");
                if (input) {
                  input.focus({ preventScroll: true });
                  input.scrollIntoView({ behavior: "smooth", block: "center" });
                }
              }}
            >
              <PlusIcon className="size-4" />
              Create Project
            </button>
          }
        />
      </ProjectsSectionShell>
    );
  }

  const displayedProjects =
    limit !== undefined ? projects.slice(0, limit) : projects;
  const hasMoreProjects = limit !== undefined && projects.length > limit;

  return (
    <ProjectsSectionShell
      actions={
        <span className="glass inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 font-inter text-[13px] font-medium leading-[18px] text-egray-900">
          <span aria-hidden>🇺🇸</span>
          US Agencies &amp; Firms
        </span>
      }
    >
      <div className={CATALOG_GRID_CLASS}>
        {displayedProjects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>

      {showMoreLink && hasMoreProjects && (
        <div className="mt-8 flex justify-end">
          <Link href={moreProjectsUrl} className={GLASS_BUTTON_CLASS}>
            More Projects
            <ArrowUpRight className="size-4" />
          </Link>
        </div>
      )}
    </ProjectsSectionShell>
  );
}

function ProjectsSectionShell({
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
          icon={FolderKanban}
          eyebrow="In progress"
          title="Projects"
          actions={actions}
        />
        {children}
      </div>
    </section>
  );
}
