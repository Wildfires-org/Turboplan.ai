import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AccessError } from "@/components/access-error";
import { ProjectPageFrame } from "@/components/dashboard/project-page-frame";
import { ProjectTasks } from "@/components/dashboard/project-tasks";
import {
  getCachedSession,
  getValidatedProjectBySlug,
} from "@/lib/cache/dashboard";
import { FLUSH_PANEL_CLASS } from "@/lib/glass";
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

  return (
    <ProjectPageFrame
      organization={organization}
      office={office}
      project={project}
      coverImage={coverImage}
      user={session.user}
      section="Tasks"
    >
      <div className={FLUSH_PANEL_CLASS}>
        <ProjectTasks
          projectId={project.id}
          projectName={project.name}
          user={session.user}
        />
      </div>
    </ProjectPageFrame>
  );
}
