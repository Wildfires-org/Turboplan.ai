import { ProjectChatRouteLoading } from "@/components/chat/project-chat-route-loading";
import { InertLoading } from "@/components/dashboard/inert-loading";

export default function ProjectChatLoading() {
  return (
    <InertLoading>
      <ProjectChatRouteLoading />
    </InertLoading>
  );
}
