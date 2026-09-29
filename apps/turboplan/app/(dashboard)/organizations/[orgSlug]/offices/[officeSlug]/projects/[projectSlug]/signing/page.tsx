import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ProjectSigningPage as ProjectSigningContent } from "@wildfires-org/turboplan-signing/client";

import { AccessError } from "@/components/access-error";
import { ProjectPageFrame } from "@/components/dashboard/project-page-frame";
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
      return { title: "Signing" };
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
        title: `${project.name} Signing - ${office.name}`,
        description: `Document signing for ${project.name}`,
      };
    }

    return { title: "Access Restricted" };
  } catch (error) {
    console.error("Error generating metadata:", error);
    return {};
  }
}

export default async function ProjectSigningPage({ params }: ProjectPageProps) {
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

  const { organization, office, project, coverImage } = data;

  return (
    <ProjectPageFrame
      organization={organization}
      office={office}
      project={project}
      coverImage={coverImage}
      user={session.user}
      section="Signing"
    >
      <ProjectSigningContent
        projectId={project.id}
        currentUserId={session.user.id}
      />
    </ProjectPageFrame>
  );
}
