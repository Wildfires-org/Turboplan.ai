"use client";

import { useMemo } from "react";

import { ArrowUpRight, PlusIcon } from "lucide-react";
import Link from "next/link";
import useSWR from "swr";

import { getLandingPageEnv } from "@wildfires-org/turboplan-env";

import BeaverLeft from "@/../public/images/beaver_left.png";
import ProjectsBackground from "@/../public/images/projects.png";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fetcher } from "@/lib/utils";
import type { PublicProject } from "@/types/public-project";
import { routing } from "@/utils/routing";
import { CatalogEmptyState } from "./catalog-empty-state";
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
      <section className="py-10">
        <p className="text-base text-green-60 mb-1">In progress</p>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h2 className="text-2xl tracking-tight">Projects</h2>
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
        <p className="text-base text-green-60 mb-1">In progress</p>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h2 className="text-2xl tracking-tight">Projects</h2>
        </div>
        <div className="text-center py-8 text-neutral-grey3">
          Failed to load projects. Please try again later.
        </div>
      </section>
    );
  }

  if (!projects || projects.length === 0) {
    return (
      <section className="py-10">
        <p className="text-base text-green-60 mb-1">In progress</p>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h2 className="text-2xl tracking-tight">Projects</h2>
        </div>
        <CatalogEmptyState
          backgroundImage={ProjectsBackground}
          beaverImage={BeaverLeft}
          beaverAlt="Beaver mascot pointing"
          title="Your project list is empty"
          description="Start a new project to track environmental assessments, manage documents, and collaborate with your team."
          actionButton={
            <Button
              variant="primary"
              size="small"
              onClick={() => {
                const container = document.getElementById(
                  "project-prompt-input",
                );
                if (!container) return;
                const input = container.querySelector<
                  HTMLInputElement | HTMLTextAreaElement
                >("input, textarea");
                if (input) {
                  input.focus({ preventScroll: true });
                  input.scrollIntoView({ behavior: "smooth", block: "center" });
                }
              }}
            >
              <PlusIcon className="size-4 mr-1.5" />
              Create Project
            </Button>
          }
        />
      </section>
    );
  }

  const displayedProjects =
    limit !== undefined ? projects.slice(0, limit) : projects;
  const hasMoreProjects = limit !== undefined && projects.length > limit;

  return (
    <section className="py-10">
      <p className="text-base text-green-60 mb-1">In progress</p>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h2 className="text-2xl tracking-tight">Projects</h2>

        <Badge
          variant="lightGray"
          className="flex items-center gap-2 w-fit rounded-full px-4 py-2 text-sm font-medium text-neutral-black"
        >
          <span className="text-[16px]">🇺🇸</span>
          US Agencies & Firms
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {displayedProjects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>

      {showMoreLink && hasMoreProjects && (
        <div className="flex justify-end mt-6">
          <Link
            href={moreProjectsUrl}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-neutral-black bg-white border border-neutral-grey rounded-full hover:bg-gray-50 transition-colors"
          >
            More Projects
            <ArrowUpRight className="h-4 w-4 text-green-70" />
          </Link>
        </div>
      )}
    </section>
  );
}
