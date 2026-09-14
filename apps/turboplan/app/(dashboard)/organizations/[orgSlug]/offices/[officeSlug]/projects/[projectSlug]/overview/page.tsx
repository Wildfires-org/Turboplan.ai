import { redirect } from "next/navigation";

import { AppUrls } from "@/lib/nav/urls";

interface ProjectOverviewPageProps {
  params: Promise<{
    orgSlug: string;
    officeSlug: string;
    projectSlug: string;
  }>;
}

export default async function ProjectOverviewPage({
  params,
}: ProjectOverviewPageProps) {
  const resolvedParams = await params;

  // Redirect to the main project page which contains the overview content
  redirect(
    AppUrls.project(
      resolvedParams.orgSlug,
      resolvedParams.officeSlug,
      resolvedParams.projectSlug,
    ),
  );
}
