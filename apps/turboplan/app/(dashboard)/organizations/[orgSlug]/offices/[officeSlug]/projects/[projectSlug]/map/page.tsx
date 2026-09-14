import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ProjectMapViewer } from "@wildfires-org/turboplan-map/client";

import { AccessError } from "@/components/access-error";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import {
  getCachedSession,
  getValidatedProjectBySlug,
} from "@/lib/cache/dashboard";
import { AppUrls } from "@/lib/nav/urls";
import type { ProjectPageProps } from "@/types/dashboard";

export async function generateMetadata({
  params,
}: ProjectPageProps): Promise<Metadata> {
  try {
    const session = await getCachedSession();
    const resolvedParams = await params;

    if (!session?.user?.id) {
      return { title: "Project Map" };
    }

    const { data } = await getValidatedProjectBySlug(
      session.user.id,
      resolvedParams.orgSlug,
      resolvedParams.officeSlug,
      resolvedParams.projectSlug,
    );

    if (data) {
      const { office, project } = data;
      return {
        title: `${project.name} Map - ${office.name}`,
        description: `Interactive map for ${project.name}`,
      };
    }

    return { title: "Access Restricted" };
  } catch (error) {
    console.error("Error generating metadata:", error);
    return {};
  }
}

export default async function ProjectMapPage({ params }: ProjectPageProps) {
  const session = await getCachedSession();
  const resolvedParams = await params;

  if (!session?.user?.id) {
    redirect("/login");
  }

  let data;
  try {
    const result = await getValidatedProjectBySlug(
      session.user.id,
      resolvedParams.orgSlug,
      resolvedParams.officeSlug,
      resolvedParams.projectSlug,
    );
    data = result.data;
  } catch (error) {
    console.error("Error fetching project:", error);
    return (
      <AccessError type="project" message="Could not load project data." />
    );
  }

  if (!data) {
    return <AccessError type="project" />;
  }

  const { organization, office, project } = data;

  const breadcrumbs = [
    {
      label: organization.name,
      href: AppUrls.organization(organization.slug),
      isActive: false,
      entity: { type: "organization" as const, data: organization },
    },
    {
      label: office.name,
      href: AppUrls.office(organization.slug, office.slug),
      isActive: false,
      entity: {
        type: "office" as const,
        data: office,
        organizationSlug: organization.slug,
      },
    },
    {
      label: project.name,
      href: AppUrls.project(organization.slug, office.slug, project.slug),
      isActive: false,
      entity: {
        type: "project" as const,
        data: project,
        organizationSlug: organization.slug,
        officeSlug: office.slug,
      },
    },
    { label: "Map", isActive: true },
  ];

  return (
    <div className="flex flex-col h-screen">
      <DashboardHeader breadcrumbs={breadcrumbs} userId={session.user.id} />

      <ProjectMapViewer
        className="flex-1"
        organizationId={organization.id}
        officeId={office.id}
        projectId={project.id}
      />
    </div>
  );
}
