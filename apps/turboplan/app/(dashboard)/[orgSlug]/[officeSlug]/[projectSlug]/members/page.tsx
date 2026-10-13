import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AccessError } from "@/components/access-error";
import { InviteMembersProvider } from "@/components/dashboard/invite-members-context";
import { ProjectMembersSection } from "@/components/dashboard/project-members-section";
import { ProjectPageFrame } from "@/components/dashboard/project-page-frame";
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

  return (
    <InviteMembersProvider>
      <ProjectPageFrame
        organization={organization}
        office={office}
        project={project}
        coverImage={coverImage}
        user={session.user}
        section="Members"
        hideSectionHeader
      >
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
      </ProjectPageFrame>
    </InviteMembersProvider>
  );
}
