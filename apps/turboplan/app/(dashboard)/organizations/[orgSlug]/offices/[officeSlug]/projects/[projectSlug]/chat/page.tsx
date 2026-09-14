import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getInitialChatByProjectId } from "@wildfires-org/turboplan-db/queries";

import { AccessError } from "@/components/access-error";
import {
  getCachedSession,
  getValidatedProjectBySlug,
} from "@/lib/cache/dashboard";
import { AppUrls } from "@/lib/nav/urls";
import type { ProjectParams } from "@/types/dashboard";

interface ProjectChatPageProps {
  params: Promise<ProjectParams>;
  searchParams: Promise<{
    chatId?: string;
    initialMessageContent?: string;
    prefillContent?: string;
  }>;
}

export async function generateMetadata({
  params,
}: ProjectChatPageProps): Promise<Metadata> {
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

export default async function ProjectChatPage({
  params,
  searchParams,
}: ProjectChatPageProps) {
  const session = await getCachedSession();
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

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

  const { orgSlug, officeSlug, projectSlug } = resolvedParams;
  const { project } = data;

  // Build query string from preserved search params
  const buildQueryString = () => {
    const params = new URLSearchParams();
    if (resolvedSearchParams.initialMessageContent) {
      params.set(
        "initialMessageContent",
        resolvedSearchParams.initialMessageContent,
      );
    }
    if (resolvedSearchParams.prefillContent) {
      params.set("prefillContent", resolvedSearchParams.prefillContent);
    }
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  };

  // If chatId is in search params, redirect to the new URL format
  if (resolvedSearchParams.chatId) {
    redirect(
      `${AppUrls.projectChatById(
        orgSlug,
        officeSlug,
        projectSlug,
        resolvedSearchParams.chatId,
      )}${buildQueryString()}`,
    );
  }

  // Otherwise, find the initial chat and redirect
  const initialChat = await getInitialChatByProjectId(project.id);

  if (initialChat) {
    redirect(
      `${AppUrls.projectChatById(orgSlug, officeSlug, projectSlug, initialChat.id)}${buildQueryString()}`,
    );
  }

  // No chats exist, redirect to new chat
  const newChatUrl = AppUrls.projectNewChat(orgSlug, officeSlug, projectSlug);
  redirect(`${newChatUrl}${buildQueryString()}`);
}
