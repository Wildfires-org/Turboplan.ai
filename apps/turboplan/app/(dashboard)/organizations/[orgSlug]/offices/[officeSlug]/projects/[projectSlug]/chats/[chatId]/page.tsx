import { Suspense } from "react";

import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getChatById } from "@wildfires-org/turboplan-db/queries";
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

interface ChatByIdPageProps {
  params: Promise<ProjectParams & { chatId: string }>;
}

export async function generateMetadata({
  params,
}: ChatByIdPageProps): Promise<Metadata> {
  try {
    const session = await getCachedSession();
    const resolvedParams = await params;

    if (!session?.user?.id) {
      return { title: "Project Chat" };
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
        title: `${project.name} Chat - ${office.name}`,
        description: `Project chat for ${project.name}`,
      };
    }

    return { title: "Access Restricted" };
  } catch (error) {
    console.error("Error generating metadata:", error);
    return {};
  }
}

export default async function ChatByIdPage({ params }: ChatByIdPageProps) {
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
    { label: "Chat", isActive: true },
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
        <ChatByIdPageContent
          project={project}
          userId={session.user.id}
          chatId={resolvedParams.chatId}
          orgSlug={resolvedParams.orgSlug}
          officeSlug={resolvedParams.officeSlug}
          projectSlug={resolvedParams.projectSlug}
        />
      </div>
    </Suspense>
  );
}

async function ChatByIdPageContent({
  project,
  userId,
  chatId,
  orgSlug,
  officeSlug,
  projectSlug,
}: {
  project: NonNullable<
    Awaited<ReturnType<typeof getValidatedProjectBySlug>>["data"]
  >["project"];
  userId: string;
  chatId: string;
  orgSlug: string;
  officeSlug: string;
  projectSlug: string;
}) {
  const chat = await getChatById({ id: chatId });

  if (!chat || chat.projectId !== project.id) {
    redirect(AppUrls.projectNewChat(orgSlug, officeSlug, projectSlug));
  }

  return (
    <ProjectChatPageShell>
      <ProjectChatView
        project={project}
        chat={chat}
        isInitialChat={chat.isInitial}
        userId={userId}
      />
    </ProjectChatPageShell>
  );
}
