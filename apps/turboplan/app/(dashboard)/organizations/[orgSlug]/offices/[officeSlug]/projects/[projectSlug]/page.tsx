import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AccessError } from "@/components/access-error";
import { ProjectModules } from "@/components/dashboard";
import { ProjectPageFrame } from "@/components/dashboard/project-page-frame";
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

  return (
    <SwrFallbackProvider fallback={permissionsFallback}>
      <ProjectPageFrame
        organization={organization}
        office={office}
        project={project}
        coverImage={coverImage}
        user={session.user}
        membersHref={AppUrls.projectMembers(
          organization.slug,
          office.slug,
          project.slug,
        )}
        topSlot={
          <SubmissionInfoBanner
            organizationName={organization.name}
            ownershipStatus={project.ownershipStatus}
            projectId={project.id}
            projectName={project.name}
            userId={session.user.id}
          />
        }
      >
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
      </ProjectPageFrame>
    </SwrFallbackProvider>
  );
}
