import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";

import { AccessError } from "@/components/access-error";
import { DashboardProvider } from "@/components/providers/dashboard-provider";
import {
  getCachedSession,
  getValidatedProjectBySlug,
} from "@/lib/cache/dashboard";
import { AppUrls } from "@/lib/nav/urls";

interface TemplateLayoutProps {
  children: React.ReactNode;
  params: Promise<{
    orgSlug: string;
    officeSlug: string;
    templateSlug: string;
  }>;
}

export default async function TemplateLayout({
  children,
  params,
}: TemplateLayoutProps) {
  const session = await getCachedSession();
  const resolvedParams = await params;

  if (!session?.user?.id) {
    redirect("/login");
  }

  try {
    const { data } = await getValidatedProjectBySlug(
      session.user.id,
      resolvedParams.orgSlug,
      resolvedParams.officeSlug,
      resolvedParams.templateSlug,
    );

    if (!data) {
      return <AccessError type="project" />;
    }

    const { organization, office, project } = data;

    // Only templates are accessible via the templates route
    if (!project.isTemplate) {
      redirect(AppUrls.project(organization.slug, office.slug, project.slug));
    }

    // Handle historical slug redirect — build template URL from resolved data
    if (project.slug !== resolvedParams.templateSlug) {
      redirect(AppUrls.template(organization.slug, office.slug, project.slug));
    }

    return (
      <DashboardProvider
        organization={organization}
        office={office}
        project={project}
      >
        {children}
      </DashboardProvider>
    );
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("Error in template layout:", error);
    return <AccessError type="project" />;
  }
}
