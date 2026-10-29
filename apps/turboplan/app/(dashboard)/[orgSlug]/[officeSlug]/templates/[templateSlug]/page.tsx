import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AccessError } from "@/components/access-error";
import {
  ProjectDetails,
  ProjectModules,
  TemplateHeaderActions,
} from "@/components/dashboard";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import ImageHeader from "@/components/image-header";
import { SwrFallbackProvider } from "@/components/providers/swr-fallback-provider";
import {
  getCachedSession,
  getValidatedProjectBySlug,
} from "@/lib/cache/dashboard";
import { AppUrls } from "@/lib/nav/urls";
import { getProjectPageActionsFallback } from "@/lib/permissions/entity-actions-fallback";
import type { TemplatePageProps } from "@/types/dashboard";

export async function generateMetadata({
  params,
}: TemplatePageProps): Promise<Metadata> {
  try {
    const session = await getCachedSession();
    const resolvedParams = await params;

    if (!session?.user?.id) {
      return {
        title: "Template",
      };
    }

    const { data } = await getValidatedProjectBySlug(
      session.user.id,
      resolvedParams.orgSlug,
      resolvedParams.officeSlug,
      resolvedParams.templateSlug,
    );

    if (!data) {
      return {
        title: "Access Restricted",
        description: "You do not have access to this resource",
      };
    }

    const { office, project } = data;

    return {
      title: `${project.name} (Template) - ${office.name}`,
      description: `Preview template ${project.name} in ${office.name}`,
    };
  } catch (error) {
    console.error("Error generating metadata:", error);
    return {};
  }
}

export default async function TemplatePage({ params }: TemplatePageProps) {
  const session = await getCachedSession();
  const resolvedParams = await params;

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { data } = await getValidatedProjectBySlug(
    session.user.id,
    resolvedParams.orgSlug,
    resolvedParams.officeSlug,
    resolvedParams.templateSlug,
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
      label: "Templates",
      href: AppUrls.officeProjectTemplates(organization.slug, office.slug),
      isActive: false,
    },
    {
      label: project.name,
      isActive: true,
    },
  ];

  return (
    <SwrFallbackProvider fallback={permissionsFallback}>
      <div className="flex flex-col shrink-0 min-h-screen">
        <DashboardHeader breadcrumbs={breadcrumbs} userId={session.user.id} />
        <ImageHeader
          projectId={project.id}
          projectName={project.name}
          coverImageId={project.coverImageId}
          coverImageUrl={coverImage?.imageUrl}
          readOnly
        />
        <div className="flex-1 container mx-auto p-6 space-y-6">
          <ProjectDetails
            className="mt-6"
            project={project}
            user={session.user}
            badge={
              <span className="inline-flex items-center rounded-md bg-blue-100 px-1.5 py-1 text-xs font-medium text-blue-700">
                Template
              </span>
            }
            headerActions={
              <TemplateHeaderActions
                project={project}
                organizationSlug={organization.slug}
                officeSlug={office.slug}
              />
            }
            showMembers={false}
          />
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
            readOnly
            excludeModules={["map", "comments"]}
          />
        </div>
      </div>
    </SwrFallbackProvider>
  );
}
