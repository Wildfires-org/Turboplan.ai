import { FileText } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AccessError } from "@/components/access-error";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import {
  getCachedSession,
  getValidatedOfficeBySlug,
} from "@/lib/cache/dashboard";
import {
  EMPTY_STATE_TEXT_CLASS,
  EMPTY_STATE_TITLE_CLASS,
  PAGE_CONTAINER_CLASS,
  PAGE_LEAD_CLASS,
  PAGE_TITLE_CLASS,
  PANEL_CLASS,
  PANEL_TITLE_CLASS,
} from "@/lib/glass";
import { AppUrls } from "@/lib/nav/urls";
import type { AuthSession } from "@/lib/types/auth";
import { cn } from "@/lib/utils";
import type { OfficePageProps } from "@/types/dashboard";

const TEMPLATE_TYPES = [
  "Project reports",
  "Meeting minutes",
  "Proposal templates",
  "Contract templates",
];

const TEMPLATE_FEATURES = [
  "Rich text editing",
  "Variable placeholders",
  "Version control",
  "Collaboration tools",
];

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
    <div className="flex min-h-screen shrink-0 flex-col">
      <DashboardHeader breadcrumbs={breadcrumbs} userId={session.user.id} />
      <div className={cn(PAGE_CONTAINER_CLASS, "flex-1 pb-12 pt-8")}>
        <div className="mb-6">
          <h1 className={PAGE_TITLE_CLASS}>Document Templates</h1>
          <p className={cn(PAGE_LEAD_CLASS, "mt-1.5")}>
            Manage reusable document templates for {office.name}
          </p>
        </div>

        <div className="space-y-4">
          <section
            className={cn(
              PANEL_CLASS,
              "flex flex-col items-center px-6 py-12 text-center sm:px-6 sm:py-12",
            )}
          >
            <span className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-brandAlt-100 text-brand-800">
              <FileText aria-hidden className="size-6" />
            </span>
            <h2 className={EMPTY_STATE_TITLE_CLASS}>
              Document Templates Coming Soon
            </h2>
            <p className={cn(EMPTY_STATE_TEXT_CLASS, "mt-1.5 max-w-md")}>
              This feature will allow you to create and manage reusable document
              templates for your projects. Stay tuned for updates!
            </p>
          </section>

          <div className="grid gap-4 md:grid-cols-2">
            <ComingSoonList
              title="Template Types"
              lead="Future document template categories will include:"
              items={TEMPLATE_TYPES}
            />
            <ComingSoonList
              title="Features"
              lead="Upcoming document template features:"
              items={TEMPLATE_FEATURES}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

const ComingSoonList = ({
  title,
  lead,
  items,
}: {
  title: string;
  lead: string;
  items: string[];
}) => (
  <section className={PANEL_CLASS}>
    <h2 className={PANEL_TITLE_CLASS}>{title}</h2>
    <p className={cn(EMPTY_STATE_TEXT_CLASS, "mb-3 mt-1")}>{lead}</p>
    <ul className="space-y-2 text-[13px] leading-5 text-foreground">
      {items.map((item) => (
        <li key={item} className="flex items-center gap-2.5">
          <span aria-hidden className="size-1.5 rounded-full bg-brand-800" />
          {item}
        </li>
      ))}
    </ul>
  </section>
);
