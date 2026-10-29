import { isRedirectError } from "next/dist/client/components/redirect-error";
import { notFound, redirect } from "next/navigation";

import { AccessError } from "@/components/access-error";
import {
  getCachedSession,
  getValidatedOrganizationBySlug,
} from "@/lib/cache/dashboard";
import { isRoutableSlugPath } from "@/lib/nav/route-slugs";
import { AppUrls } from "@/lib/nav/urls";
import { handleSlugRedirect } from "@/lib/slug-redirect";

interface OrganizationLayoutProps {
  children: React.ReactNode;
  params: Promise<{
    orgSlug: string;
  }>;
}

export default async function OrganizationLayout({
  children,
  params,
}: OrganizationLayoutProps) {
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
    const { data: organization, redirectTo } =
      await getValidatedOrganizationBySlug(
        session.user.id,
        resolvedParams.orgSlug,
      );

    // Redirect if accessed via historical slug, preserving the full path
    await handleSlugRedirect(
      redirectTo,
      AppUrls.organization(resolvedParams.orgSlug),
    );

    if (!organization) {
      return <AccessError type="organization" />;
    }

    return children;
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error("Error in organization layout:", error);
    return <AccessError type="organization" />;
  }
}
