import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";

import { AccessError } from "@/components/access-error";
import { DashboardProvider } from "@/components/providers/dashboard-provider";
import { SidebarProjectRegistrar } from "@/components/sidebar/sidebar-project-registrar";
import {
  getCachedSession,
  getValidatedProjectBySlug,
} from "@/lib/cache/dashboard";
import { AppUrls } from "@/lib/nav/urls";
import { handleSlugRedirect } from "@/lib/slug-redirect";

interface ProjectLayoutProps {
  children: React.ReactNode;
  params: Promise<{
    orgSlug: string;
    officeSlug: string;
    projectSlug: string;
  }>;
}

export default async function ProjectLayout({
  children,
  params,
}: ProjectLayoutProps) {
  const session = await getCachedSession();
  const resolvedParams = await params;

  if (!session?.user?.id) {
    redirect("/login");
  }

  try {
    const { data, redirectTo } = await getValidatedProjectBySlug(
      session.user.id,
      resolvedParams.orgSlug,
      resolvedParams.officeSlug,
      resolvedParams.projectSlug,
    );

    // Redirect if accessed via historical slug, preserving the full path
    await handleSlugRedirect(
      redirectTo,
      AppUrls.project(
        resolvedParams.orgSlug,
        resolvedParams.officeSlug,
        resolvedParams.projectSlug,
      ),
    );

    if (!data) {
      return <AccessError type="project" />;
    }

    const { organization, office, project, coverImage } = data;

    // Templates are not accessible via the projects route
    if (project.isTemplate) {
      redirect(AppUrls.office(organization.slug, office.slug));
    }

    return (
      <DashboardProvider
        organization={organization}
        office={office}
        project={project}
        projectCoverImageUrl={coverImage?.imageUrl ?? null}
      >
        <SidebarProjectRegistrar
          projectName={project.name}
          projectId={project.id}
          isResearchPhaseCompleted={project.isResearchPhaseCompleted}
        />
        {children}
      </DashboardProvider>
    );
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("Error in project layout:", error);
    return <AccessError type="project" />;
  }
}
