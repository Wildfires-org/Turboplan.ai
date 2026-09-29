import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ProjectMapViewer } from "@wildfires-org/turboplan-map/client";

import { AccessError } from "@/components/access-error";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { getProjectBreadcrumbs } from "@/components/dashboard/project-page-frame";
import {
  getCachedSession,
  getValidatedProjectBySlug,
} from "@/lib/cache/dashboard";
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

  return (
    <div className="flex flex-col h-screen">
      <DashboardHeader
        breadcrumbs={getProjectBreadcrumbs(
          organization,
          office,
          project,
          "Map",
        )}
        userId={session.user.id}
      />

      <ProjectMapViewer
        className="flex-1"
        organizationId={organization.id}
        officeId={office.id}
        projectId={project.id}
      />
    </div>
  );
}
