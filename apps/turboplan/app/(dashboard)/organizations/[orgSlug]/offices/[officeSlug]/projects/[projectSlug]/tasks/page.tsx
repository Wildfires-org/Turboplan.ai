import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AccessError } from "@/components/access-error";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { ProjectPageWithHeader } from "@/components/dashboard/project-page-with-header";
import { ProjectSubpageHeader } from "@/components/dashboard/project-subpage-header";
import { ProjectTasks } from "@/components/dashboard/project-tasks";
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
      return { title: "Project Tasks" };
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
        title: `${project.name} Tasks - ${office.name}`,
        description: `Task management for ${project.name}`,
      };
    }

    return { title: "Access Restricted" };
  } catch (error) {
    console.error("Error generating meta", error);
    return {};
  }
}

export default async function ProjectTasksPage({ params }: ProjectPageProps) {
  const session = await getCachedSession();
  const resolvedParams = await params;

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { data } = await getValidatedProjectBySlug(
    session.user.id,
    resolvedParams.orgSlug,
    resolvedParams.officeSlug,
    resolvedParams.projectSlug,
  );

  if (!data) {
    return <AccessError type="project" />;
  }

  const { organization, office, project, coverImage } = data;

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
    { label: "Tasks", isActive: true },
  ];

  return (
    <div className="flex flex-col shrink-0 min-h-screen">
      <DashboardHeader breadcrumbs={breadcrumbs} userId={session.user.id} />
      <ProjectPageWithHeader
        project={project}
        organization={organization}
        office={office}
        coverImage={coverImage}
        user={session.user}
        readOnly
      >
        <div className="flex-1 container mx-auto p-6 space-y-6">
          <ProjectSubpageHeader
            title="Tasks"
            backHref={AppUrls.project(
              organization.slug,
              office.slug,
              project.slug,
            )}
          />
          <ProjectTasks
            projectId={project.id}
            projectName={project.name}
            user={session.user}
          />
        </div>
      </ProjectPageWithHeader>
    </div>
  );
}
