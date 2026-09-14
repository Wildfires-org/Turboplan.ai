import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getSession } from "@wildfires-org/turboplan-auth/session";
import { getLandingPageEnv } from "@wildfires-org/turboplan-env";
import type { MilestoneWithTasks } from "@wildfires-org/turboplan-tasks/types";
import {
  AccordionSection,
  ProjectImageHeader,
} from "@wildfires-org/turboplan-utils";

import { CreateProjectFromTemplateButton } from "@/components/catalog/create-project-from-template-button";
import { PublicDocumentsSection } from "@/components/public-project/public-documents-section";
import { PublicFieldsSection } from "@/components/public-project/public-fields-section";
import { PublicTasksSection } from "@/components/public-project/public-tasks-section";
import { ReadOnlyModulesRenderer } from "@/components/public-project/read-only-modules-renderer";
import { ReadOnlyPreviewDetails } from "@/components/public-project/read-only-preview-details";
import { Badge } from "@/components/ui/badge";
import { brand } from "@/lib/brand";

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
    <div className="flex flex-col min-h-screen -mt-20">
      <ProjectImageHeader
        projectName={template.name}
        coverImageUrl={template.coverImageUrl}
        readOnly={true}
      />

      <div className="flex-1 container mx-auto p-6 space-y-6">
        <ReadOnlyPreviewDetails
          name={template.name}
          description={template.description}
          organizationName={template.organization.name}
          updatedAt={template.updatedAt}
          badge={<Badge className="bg-blue-100 text-blue-700">Template</Badge>}
          titleActions={
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
        <ReadOnlyModulesRenderer
          moduleOrder={moduleOrder}
          entries={[
            {
              id: "tasks",
              isHidden: isTasksHidden,
              render: () => (
                <AccordionSection title="Tasks">
                  <PublicTasksSection milestones={taskMilestones} />
                </AccordionSection>
              ),
            },
            {
              id: "fields",
              isHidden: isFieldsHidden,
              render: () => (
                <AccordionSection title="Fields">
                  <PublicFieldsSection fields={fieldsData} />
                </AccordionSection>
              ),
            },
            {
              id: "documents",
              isHidden: isDocumentsHidden,
              render: () => (
                <AccordionSection title="Documents">
                  <PublicDocumentsSection documents={documentsData} />
                </AccordionSection>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}
