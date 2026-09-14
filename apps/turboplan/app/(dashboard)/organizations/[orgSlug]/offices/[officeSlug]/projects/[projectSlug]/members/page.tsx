import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AccessError } from "@/components/access-error";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { InviteMembersProvider } from "@/components/dashboard/invite-members-context";
import { ProjectMembersSection } from "@/components/dashboard/project-members-section";
import { ProjectPageWithHeader } from "@/components/dashboard/project-page-with-header";
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
      return { title: "Project Members" };
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
        title: `Members - ${project.name} - ${office.name}`,
      };
    }

    return { title: "Access Restricted" };
  } catch (error) {
    console.error("Error generating metadata:", error);
    return {};
  }
}

export default async function ProjectMembersPage({ params }: ProjectPageProps) {
  const session = await getCachedSession();
  const resolvedParams = await params;

  if (!session?.user?.id) {
    redirect(AppUrls.login);
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
    { label: "Members", isActive: true },
  ];

  return (
    <InviteMembersProvider>
      <div className="flex flex-col shrink-0 min-h-screen h-full">
        <DashboardHeader breadcrumbs={breadcrumbs} userId={session.user.id} />
        <ProjectPageWithHeader
          project={project}
          organization={organization}
          office={office}
          coverImage={coverImage}
          user={session.user}
          readOnly
        >
          <div className="flex-1 container mx-auto p-6">
            <ProjectMembersSection
              user={session.user}
              project={project}
              organizationId={organization.id}
              backHref={AppUrls.project(
                organization.slug,
                office.slug,
                project.slug,
              )}
            />
          </div>
        </ProjectPageWithHeader>
      </div>
    </InviteMembersProvider>
  );
}
