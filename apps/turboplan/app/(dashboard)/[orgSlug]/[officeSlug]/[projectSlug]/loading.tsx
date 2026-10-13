import { InertLoading } from "@/components/dashboard/inert-loading";
import { ProjectRouteLoading } from "@/components/dashboard/project-route-loading";

export default function ProjectLoading() {
  return (
    <InertLoading>
      <ProjectRouteLoading />
    </InertLoading>
  );
}
