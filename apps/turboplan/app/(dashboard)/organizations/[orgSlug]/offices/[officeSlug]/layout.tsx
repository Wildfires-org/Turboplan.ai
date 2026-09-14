import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";

import { AccessError } from "@/components/access-error";
import { DashboardProvider } from "@/components/providers/dashboard-provider";
import {
  getCachedSession,
  getValidatedOfficeBySlug,
} from "@/lib/cache/dashboard";
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
  const session = await getCachedSession();
  const resolvedParams = await params;

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

    return (
      <DashboardProvider organization={organization} office={office}>
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
