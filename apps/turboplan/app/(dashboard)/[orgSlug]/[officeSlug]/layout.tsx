import { isRedirectError } from "next/dist/client/components/redirect-error";
import { notFound, redirect } from "next/navigation";

import { AccessError } from "@/components/access-error";
import { DashboardProvider } from "@/components/providers/dashboard-provider";
import {
  getCachedSession,
  getOfficeAllowedActions,
  getValidatedOfficeBySlug,
} from "@/lib/cache/dashboard";
import { isRoutableSlugPath } from "@/lib/nav/route-slugs";
import { AppUrls } from "@/lib/nav/urls";
import { handleSlugRedirect } from "@/lib/slug-redirect";

interface OfficeLayoutProps {
  children: React.ReactNode;
  params: Promise<{
    orgSlug: string;
    officeSlug: string;
  }>;
}

export default async function OfficeLayout({
  children,
  params,
}: OfficeLayoutProps) {
  const resolvedParams = await params;

  // 404 malformed or reserved slugs before any session or DB work.
  if (!isRoutableSlugPath(resolvedParams)) {
    notFound();
  }

  const session = await getCachedSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  try {
    const { data, redirectTo } = await getValidatedOfficeBySlug(
      session.user.id,
      resolvedParams.orgSlug,
      resolvedParams.officeSlug,
    );

    // Redirect if accessed via historical slug, preserving the full path
    await handleSlugRedirect(
      redirectTo,
      AppUrls.office(resolvedParams.orgSlug, resolvedParams.officeSlug),
    );

    if (!data) {
      return <AccessError type="office" />;
    }

    const { organization, office } = data;
    const officeActions = await getOfficeAllowedActions(
      session.user.id,
      office.id,
    );

    return (
      <DashboardProvider
        organization={organization}
        office={office}
        officeActions={officeActions}
      >
        {children}
      </DashboardProvider>
    );
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("Error in office layout:", error);
    return <AccessError type="office" />;
  }
}
