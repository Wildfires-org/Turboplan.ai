import { redirect } from "next/navigation";

import {
  getOfficesByOrganization,
  getUserAccessibleOrganizations,
  OrganizationType,
} from "@wildfires-org/turboplan-workspace/server";

import { auth } from "@/app/(auth)/auth";
import { EntryPage } from "@/components/entry-point/entry-page";
import { isPromptEntryPoint } from "@/lib/entry-point/config";
import { AppUrls } from "@/lib/nav/urls";

/**
 * Root entry: resolves the user's landing office and redirects there. A
 * signed-out visitor goes to login, or sees the prompt entry page when the
 * build turns it on (lib/entry-point/config.ts).
 *
 * Deliberately lives OUTSIDE the `(dashboard)` route group. Inside it, Next
 * streams the dashboard layout (sidebar + its data hooks) before this page's
 * two DB lookups finish, so the sidebar hydrated and fired ~7 API calls that
 * were cancelled moments later by the redirect. Under the bare root layout
 * nothing renders until the redirect is sent.
 */
export default async function RootPage({
  searchParams,
}: {
  searchParams: Promise<{
    setup?: string;
    projectDescription?: string | string[];
  }>;
}) {
  const session = await auth();
  const params = await searchParams;

  if (!session?.user?.id) {
    if (isPromptEntryPoint) {
      const { projectDescription } = params;
      return (
        <EntryPage
          initialPrompt={
            typeof projectDescription === "string"
              ? projectDescription
              : undefined
          }
        />
      );
    }
    redirect("/login");
  }

  const organizations = await getUserAccessibleOrganizations(session.user.id);

  if (organizations.length === 0) {
    redirect("/setup/personal");
  }

  const personalOrg = organizations.find(
    (org) => org.type === OrganizationType.PERSONAL,
  );
  const targetOrg = personalOrg || organizations[0];

  const offices = await getOfficesByOrganization(targetOrg.id, { limit: 1 });
  const isPostSetup = params.setup === "true";

  if (offices.length > 0) {
    const officeUrl = AppUrls.office(targetOrg.slug, offices[0].slug);
    redirect(isPostSetup ? `${officeUrl}?create-project=true` : officeUrl);
  }

  redirect(AppUrls.organization(targetOrg.slug));
}
