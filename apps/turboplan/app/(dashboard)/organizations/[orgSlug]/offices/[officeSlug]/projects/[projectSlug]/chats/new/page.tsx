import { Suspense } from "react";

import type { Metadata } from "next";
import { redirect } from "next/navigation";

import {
  getChatsByProjectId,
  getInitialChatByProjectId,
} from "@wildfires-org/turboplan-db/queries";
import { isResearchAgentPackageEnabled } from "@wildfires-org/turboplan-feature-flags";

import { AccessError } from "@/components/access-error";
import {
  ProjectChatPageFallback,
  ProjectChatPageShell,
} from "@/components/chat/project-chat-page-shell";
import { ProjectChatView } from "@/components/chat/project-chat-view";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import {
  getCachedSession,
  getValidatedProjectBySlug,
} from "@/lib/cache/dashboard";
import { AppUrls } from "@/lib/nav/urls";
import type { ProjectParams } from "@/types/dashboard";

interface NewChatPageProps {
  params: Promise<ProjectParams>;
  searchParams: Promise<{
    initialMessageContent?: string;
    prefillContent?: string;
  }>;
}

export async function generateMetadata({
  params,
}: NewChatPageProps): Promise<Metadata> {
  try {
    const session = await getCachedSession();
    const resolvedParams = await params;

    if (!session?.user?.id) {
      return { title: "New Chat" };
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
        title: `New Chat - ${project.name} - ${office.name}`,
        description: `New chat for ${project.name}`,
      };
    }

    return { title: "Access Restricted" };
  } catch (error) {
    console.error("Error generating metadata:", error);
    return {};
  }
}

export default async function NewChatPage({
  params,
  searchParams,
}: NewChatPageProps) {
  const session = await getCachedSession();
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

  if (!session?.user?.id) {
    redirect(AppUrls.login);
  }

  const { orgSlug, officeSlug, projectSlug } = resolvedParams;

  let data;
  try {
    const result = await getValidatedProjectBySlug(
      session.user.id,
      orgSlug,
      officeSlug,
      projectSlug,
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

  const { organization, office, project } = data;
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
    { label: "New Chat", isActive: true },
  ];

  return (
    <Suspense
      fallback={
        <ProjectChatPageFallback
          showResearchPane={
            isResearchAgentPackageEnabled() && !project.isResearchPhaseCompleted
          }
          breadcrumbs={
            <DashboardHeader
              breadcrumbs={breadcrumbs}
              userId={session.user.id}
            />
          }
        />
      }
    >
      <div className="flex flex-col shrink-0 min-h-screen">
        <DashboardHeader breadcrumbs={breadcrumbs} userId={session.user.id} />
        <NewChatPageContent
          project={project}
          userId={session.user.id}
          orgSlug={orgSlug}
          officeSlug={officeSlug}
          projectSlug={projectSlug}
          searchParams={resolvedSearchParams}
        />
      </div>
    </Suspense>
  );
}

async function NewChatPageContent({
  project,
  userId,
  orgSlug,
  officeSlug,
  projectSlug,
  searchParams,
}: {
  project: NonNullable<
    Awaited<ReturnType<typeof getValidatedProjectBySlug>>["data"]
  >["project"];
  userId: string;
  orgSlug: string;
  officeSlug: string;
  projectSlug: string;
  searchParams: {
    initialMessageContent?: string;
    prefillContent?: string;
  };
}) {
  const [initialChat, existingChats] = await Promise.all([
    getInitialChatByProjectId(project.id),
    getChatsByProjectId({
      projectId: project.id,
      limit: 1,
      offset: 0,
    }),
  ]);

  const queryString = new URLSearchParams();
  if (searchParams.initialMessageContent) {
    queryString.set(
      "initialMessageContent",
      searchParams.initialMessageContent,
    );
  }
  if (searchParams.prefillContent) {
    queryString.set("prefillContent", searchParams.prefillContent);
  }
  const redirectSuffix = queryString.toString()
    ? `?${queryString.toString()}`
    : "";

  if (initialChat && !project.isResearchPhaseCompleted) {
    redirect(
      `${AppUrls.projectChatById(orgSlug, officeSlug, projectSlug, initialChat.id)}${redirectSuffix}`,
    );
  }

  return (
    <ProjectChatPageShell>
      <ProjectChatView
        project={project}
        chat={null}
        isInitialChat={existingChats.length === 0}
        userId={userId}
      />
    </ProjectChatPageShell>
  );
}
