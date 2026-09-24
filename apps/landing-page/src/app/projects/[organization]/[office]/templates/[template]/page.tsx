import {
  FileText,
  LayoutTemplate,
  ListChecks,
  SlidersHorizontal,
} from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getSession } from "@wildfires-org/turboplan-auth/session";
import { getLandingPageEnv } from "@wildfires-org/turboplan-env";
import type { MilestoneWithTasks } from "@wildfires-org/turboplan-tasks/types";

import {
  CARD_CHIP_CLASS,
  CATALOG_PAGE_CLASS,
  CATALOG_SECTION_CLASS,
} from "@/components/catalog/catalog-layout";
import { CreateProjectFromTemplateButton } from "@/components/catalog/create-project-from-template-button";
import { PAGE_CONTAINER } from "@/components/home-v2/ui/layout";
import { PublicDetailHero } from "@/components/public-project/public-detail-hero";
import { PublicDocumentsSection } from "@/components/public-project/public-documents-section";
import { PublicFieldsSection } from "@/components/public-project/public-fields-section";
import { PublicModuleSection } from "@/components/public-project/public-module-section";
import { PublicTasksSection } from "@/components/public-project/public-tasks-section";
import { ReadOnlyModulesRenderer } from "@/components/public-project/read-only-modules-renderer";
import { brand } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { routing } from "@/utils/routing";

interface PublicTemplateDetail {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  coverImageId: string | null;
  coverImageUrl: string | null;
  startDate: string | null;
  endDate: string | null;
  updatedAt: string | null;
  createdAt: string;
  office: {
    id: string;
    name: string;
    slug: string;
  };
  organization: {
    id: string;
    name: string;
    slug: string;
  };
}

interface PublicTemplateModules {
  tasks?: {
    milestones: MilestoneWithTasks[];
    isHidden: boolean;
  };
  fields?: {
    fields: Array<{
      id: string;
      name: string;
      type: "text" | "list";
      isRequired: boolean;
      tooltip: string | null;
      order: number;
      values: string[];
    }>;
    isHidden: boolean;
  };
  documents?: {
    documents: Array<{
      id: string;
      originalFilename: string;
      mimeType: string;
      size: number;
      url: string;
      createdAt: string;
    }>;
    isHidden: boolean;
  };
  moduleOrder: string[];
}

interface TemplatePageProps {
  params: Promise<{
    organization: string;
    office: string;
    template: string;
  }>;
}

async function getPublicTemplate(
  orgSlug: string,
  officeSlug: string,
  templateSlug: string,
): Promise<PublicTemplateDetail | null> {
  const { SERVER_URL } = getLandingPageEnv();

  try {
    const response = await fetch(
      `${SERVER_URL}/api/public/templates/${orgSlug}/${officeSlug}/${templateSlug}`,
      {
        next: { revalidate: 60 },
      },
    );

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      console.error("Failed to fetch public template:", response.statusText);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching public template:", error);
    return null;
  }
}

async function getPublicTemplateModules(
  orgSlug: string,
  officeSlug: string,
  templateSlug: string,
): Promise<PublicTemplateModules | null> {
  const { SERVER_URL } = getLandingPageEnv();

  try {
    const response = await fetch(
      `${SERVER_URL}/api/public/templates/${orgSlug}/${officeSlug}/${templateSlug}/modules`,
      {
        next: { revalidate: 60 },
      },
    );

    if (!response.ok) {
      console.error("Failed to fetch template modules:", response.statusText);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching template modules:", error);
    return null;
  }
}

export async function generateMetadata({
  params,
}: TemplatePageProps): Promise<Metadata> {
  const { organization, office, template } = await params;
  const templateData = await getPublicTemplate(organization, office, template);

  if (!templateData) {
    return {
      title: `Template Not Found - ${brand.name}`,
      description:
        "This template could not be found or is not publicly available.",
    };
  }

  const title = `${templateData.name} Template - ${templateData.organization.name} | ${brand.name}`;
  const description =
    templateData.description ||
    `Preview the ${templateData.name} template from ${templateData.organization.name}`;
  const image = templateData.coverImageUrl || brand.ogImage;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: brand.name,
      type: "website",
      images: [{ url: image }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function PublicTemplatePage({
  params,
}: TemplatePageProps) {
  const { organization, office, template: templateSlug } = await params;
  const [template, modules, session] = await Promise.all([
    getPublicTemplate(organization, office, templateSlug),
    getPublicTemplateModules(organization, office, templateSlug),
    getSession(),
  ]);

  if (!template) {
    notFound();
  }

  // Exclude map and comments modules from templates (always empty)
  const excludedModules = ["map", "comments"];
  const moduleOrder = (
    modules?.moduleOrder && modules.moduleOrder.length > 0
      ? modules.moduleOrder
      : ["tasks", "fields", "documents"]
  ).filter((m) => !excludedModules.includes(m));

  const isTasksHidden = modules?.tasks?.isHidden ?? false;
  const isFieldsHidden = modules?.fields?.isHidden ?? false;
  const isDocumentsHidden = modules?.documents?.isHidden ?? false;
  const taskMilestones = modules?.tasks?.milestones || [];
  const fieldsData = modules?.fields?.fields || [];
  const documentsData = modules?.documents?.documents || [];
  const showCreateFromTemplateCta = !!session?.user;

  return (
    <div className={CATALOG_PAGE_CLASS}>
      <PublicDetailHero
        breadcrumbs={[
          { name: "Projects", href: routing.catalog() },
          {
            name: template.organization.name,
            href: routing.catalogOrganization({
              organizationSlug: template.organization.slug,
            }),
          },
          {
            name: template.office.name,
            href: routing.catalogOffice({
              organizationSlug: template.organization.slug,
              officeSlug: template.office.slug,
            }),
          },
          {
            name: "Templates",
            href: routing.catalogOfficeTemplates({
              organizationSlug: template.organization.slug,
              officeSlug: template.office.slug,
            }),
          },
          { name: template.name },
        ]}
        searchPlaceholder={`Search ${template.office.name} projects...`}
        name={template.name}
        description={template.description}
        organizationName={template.organization.name}
        officeName={template.office.name}
        updatedAt={template.updatedAt}
        coverImageUrl={template.coverImageUrl}
        badge={
          <span className={cn(CARD_CHIP_CLASS, "gap-1.5 text-brand-800")}>
            <LayoutTemplate className="size-3.5" aria-hidden />
            Template
          </span>
        }
        actions={
          showCreateFromTemplateCta ? (
            <CreateProjectFromTemplateButton
              templateId={template.id}
              templateName={template.name}
              templateDescription={template.description}
              initialOrganization={template.organization}
            />
          ) : undefined
        }
      />

      <div className={CATALOG_SECTION_CLASS}>
        <div className={PAGE_CONTAINER}>
          <ReadOnlyModulesRenderer
            moduleOrder={moduleOrder}
            entries={[
              {
                id: "tasks",
                isHidden: isTasksHidden,
                render: () => (
                  <PublicModuleSection title="Tasks" icon={<ListChecks />}>
                    <PublicTasksSection milestones={taskMilestones} />
                  </PublicModuleSection>
                ),
              },
              {
                id: "fields",
                isHidden: isFieldsHidden,
                render: () => (
                  <PublicModuleSection
                    title="Fields"
                    icon={<SlidersHorizontal />}
                  >
                    <PublicFieldsSection
                      fields={fieldsData}
                      entity="template"
                    />
                  </PublicModuleSection>
                ),
              },
              {
                id: "documents",
                isHidden: isDocumentsHidden,
                render: () => (
                  <PublicModuleSection title="Documents" icon={<FileText />}>
                    <PublicDocumentsSection
                      documents={documentsData}
                      entity="template"
                    />
                  </PublicModuleSection>
                ),
              },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
