"use client";

import type { User } from "next-auth";

import { OrganizationType } from "@wildfires-org/turboplan-db/types";

import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { ProjectDetails } from "@/components/dashboard/project-details";
import { useDashboard } from "@/components/providers/dashboard-provider";
import { AppUrls } from "@/lib/nav/urls";

interface ProjectPageContentProps {
  user: User;
}

export function ProjectPageContent({ user }: ProjectPageContentProps) {
  // Get data from context instead of fetching - solves N+1 query problem!
  const { organization, office, project } = useDashboard();

  // This should never happen due to layout validation, but good to be safe
  if (!organization || !office || !project) {
    return (
      <div className="flex flex-col min-h-screen">
        <div className="flex-1 container mx-auto p-6">
          <p className="text-muted-foreground">Loading project data...</p>
        </div>
      </div>
    );
  }

  // Create breadcrumbs with organization, office, and project names (slug-based URLs)
  const breadcrumbs = [
    {
      label: organization.name,
      href: AppUrls.organization(organization.slug),
      isActive: false,
    },
    {
      label: office.name,
      href: AppUrls.office(organization.slug, office.slug),
      isActive: false,
    },
    {
      label: project.name,
      isActive: true,
    },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      <DashboardHeader breadcrumbs={breadcrumbs} />
      <div className="flex-1 container mx-auto p-6">
        <ProjectDetails
          project={project}
          user={user}
          organizationSlug={organization.slug}
          officeSlug={office.slug}
          isPersonalWorkspace={organization.type === OrganizationType.PERSONAL}
        />
      </div>
    </div>
  );
}
