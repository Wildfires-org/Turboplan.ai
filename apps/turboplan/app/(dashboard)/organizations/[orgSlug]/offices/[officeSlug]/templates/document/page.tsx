import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AccessError } from "@/components/access-error";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import {
  getCachedSession,
  getValidatedOfficeBySlug,
} from "@/lib/cache/dashboard";
import { AppUrls } from "@/lib/nav/urls";
import type { AuthSession } from "@/lib/types/auth";
import type { OfficePageProps } from "@/types/dashboard";

export async function generateMetadata({
  params,
}: OfficePageProps): Promise<Metadata> {
  try {
    const session = await getCachedSession();
    const resolvedParams = await params;

    if (!session?.user?.id) {
      return {
        title: "Document Templates",
      };
    }

    const { data } = await getValidatedOfficeBySlug(
      session.user.id,
      resolvedParams.orgSlug,
      resolvedParams.officeSlug,
    );

    if (!data) {
      return {
        title: "Access Restricted",
        description: "You do not have access to this resource",
      };
    }

    const { office } = data;

    return {
      title: `Document Templates - ${office.name}`,
      description: `Manage document templates for ${office.name}`,
    };
  } catch (error) {
    console.error("Error generating metadata:", error);
    return {};
  }
}

export default async function DocumentTemplatesPage({
  params,
}: OfficePageProps) {
  const session = (await getCachedSession()) as AuthSession;
  const resolvedParams = await params;

  if (!session?.user?.id) {
    redirect("/login");
  }

  // Get office data with full access validation using slugs
  let data;
  try {
    const result = await getValidatedOfficeBySlug(
      session.user.id,
      resolvedParams.orgSlug,
      resolvedParams.officeSlug,
    );
    data = result.data;
  } catch (error) {
    console.error("Error fetching office data:", error);
    return <AccessError type="office" message="Could not load office data." />;
  }

  if (!data) {
    return <AccessError type="office" />;
  }

  const { organization, office } = data;

  // Create breadcrumbs with slug-based URLs
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
      label: "Document Templates",
      isActive: true,
    },
  ];

  return (
    <div className="flex flex-col shrink-0 min-h-screen">
      <DashboardHeader breadcrumbs={breadcrumbs} userId={session.user.id} />
      <div className="flex-1 container mx-auto p-6">
        <div className="space-y-6">
          {/* Page Header */}
          <div className="border-b pb-6">
            <h1 className="text-3xl font-bold">Document Templates</h1>
            <p className="text-muted-foreground mt-1">
              Manage reusable document templates for {office.name}
            </p>
          </div>

          {/* Templates Content */}
          <div className="bg-card rounded-lg border p-8">
            <div className="text-center py-12">
              <div className="size-16 mx-auto mb-4 bg-secondary rounded-lg flex items-center justify-center">
                <svg
                  className="size-8 text-muted-foreground"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium mb-2">
                Document Templates Coming Soon
              </h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                This feature will allow you to create and manage reusable
                document templates for your projects. Stay tuned for updates!
              </p>
            </div>
          </div>

          {/* Placeholder Content */}
          <div className="grid gap-6 md:grid-cols-2">
            <div className="bg-card rounded-lg border p-6">
              <h3 className="font-semibold mb-2">Template Types</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Future document template categories will include:
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <div className="size-1.5 bg-blue-500 rounded-full" />
                  Project reports
                </li>
                <li className="flex items-center gap-2">
                  <div className="size-1.5 bg-green-500 rounded-full" />
                  Meeting minutes
                </li>
                <li className="flex items-center gap-2">
                  <div className="size-1.5 bg-purple-500 rounded-full" />
                  Proposal templates
                </li>
                <li className="flex items-center gap-2">
                  <div className="size-1.5 bg-orange-500 rounded-full" />
                  Contract templates
                </li>
              </ul>
            </div>

            <div className="bg-card rounded-lg border p-6">
              <h3 className="font-semibold mb-2">Features</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Upcoming document template features:
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <div className="size-1.5 bg-blue-500 rounded-full" />
                  Rich text editing
                </li>
                <li className="flex items-center gap-2">
                  <div className="size-1.5 bg-green-500 rounded-full" />
                  Variable placeholders
                </li>
                <li className="flex items-center gap-2">
                  <div className="size-1.5 bg-purple-500 rounded-full" />
                  Version control
                </li>
                <li className="flex items-center gap-2">
                  <div className="size-1.5 bg-orange-500 rounded-full" />
                  Collaboration tools
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
