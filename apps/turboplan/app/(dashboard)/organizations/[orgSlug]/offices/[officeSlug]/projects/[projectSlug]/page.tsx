import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AccessError } from "@/components/access-error";
import { ProjectModules } from "@/components/dashboard";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { ProjectPageWithHeader } from "@/components/dashboard/project-page-with-header";
import { SubmissionInfoBanner } from "@/components/dashboard/submission-info-banner";
import { SwrFallbackProvider } from "@/components/providers/swr-fallback-provider";
import {
  getCachedSession,
  getValidatedProjectBySlug,
} from "@/lib/cache/dashboard";
import { AppUrls } from "@/lib/nav/urls";
import { getProjectPageActionsFallback } from "@/lib/permissions/entity-actions-fallback";
import type { ProjectPageProps } from "@/types/dashboard";

export async function generateMetadata({
  params,
}: ProjectPageProps): Promise<Metadata> {
  try {
    const session = await getCachedSession();
    const resolvedParams = await params;

    if (!session?.user?.id) {
      return {
        title: "Project",
      };
    }

    const { data } = await getValidatedProjectBySlug(
      session.user.id,
      resolvedParams.orgSlug,
      resolvedParams.officeSlug,
      resolvedParams.projectSlug,
    );

    if (!data) {
      return {
        title: "Access Restricted",
        description: "You do not have access to this resource",
      };
    }

    const { office, project } = data;

    return {
      title: `${project.name} - ${office.name}`,
      description: `Manage ${project.name} in ${office.name}`,
    };
  } catch (error) {
    console.error("Error generating metadata:", error);
    return {};
  }
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const session = await getCachedSession();
  const resolvedParams = await params;

  if (!session?.user?.id) {
    redirect(AppUrls.login);
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

  const { organization, office, project, coverImage, isMember } = data;

  // Seed SWR so the client permission checks below render without an extra
  // round-trip after hydration.
  const permissionsFallback = await getProjectPageActionsFallback({
    userId: session.user.id,
    email: session.user.email ?? undefined,
    organizationId: organization.id,
    officeId: office.id,
    projectId: project.id,
  });

  // Create breadcrumbs with slug-based URLs
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
      isActive: true,
      entity: {
        type: "project" as const,
        data: project,
        organizationSlug: organization.slug,
        officeSlug: office.slug,
      },
    },
  ];

  return (
    <SwrFallbackProvider fallback={permissionsFallback}>
      <div className="flex flex-col shrink-0 min-h-screen">
        <DashboardHeader breadcrumbs={breadcrumbs} userId={session.user.id} />
        <SubmissionInfoBanner
          organizationName={organization.name}
          ownershipStatus={project.ownershipStatus}
          projectId={project.id}
          projectName={project.name}
          userId={session.user.id}
        />
        <ProjectPageWithHeader
          project={project}
          organization={organization}
          office={office}
          coverImage={coverImage}
          user={session.user}
          membersHref={AppUrls.projectMembers(
            organization.slug,
            office.slug,
            project.slug,
          )}
        >
          <div className="flex-1 container mx-auto p-6 space-y-6">
            <ProjectModules
              projectId={project.id}
              organizationSlug={organization.slug}
              officeSlug={office.slug}
              projectSlug={project.slug}
              userId={session.user.id}
              user={session.user}
              projectName={project.name}
              isResearchPhaseCompleted={project.isResearchPhaseCompleted}
              isMember={isMember}
              initialProject={project}
            />
          </div>
        </ProjectPageWithHeader>
      </div>
    </SwrFallbackProvider>
  );
}
