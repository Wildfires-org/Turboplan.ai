import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getSession } from "@wildfires-org/turboplan-auth/session";
import { getLandingPageEnv } from "@wildfires-org/turboplan-env";
import type { GeospatialLayer } from "@wildfires-org/turboplan-map/client";
import type { MilestoneWithTasks } from "@wildfires-org/turboplan-tasks/types";
import type { EnrichedTimelineRecord } from "@wildfires-org/turboplan-timeline-records/types";
import {
  AccordionSection,
  type CommentData,
  ProjectImageHeader,
  ProjectProgress,
} from "@wildfires-org/turboplan-utils";

import { PublicCommentsSection } from "@/components/public-project/public-comments-section";
import { PublicDocumentsSection } from "@/components/public-project/public-documents-section";
import { PublicFieldsSection } from "@/components/public-project/public-fields-section";
import { PublicMapSection } from "@/components/public-project/public-map-section";
import { PublicTasksSection } from "@/components/public-project/public-tasks-section";
import { PublicTimelineSection } from "@/components/public-project/public-timeline-section";
import { ReadOnlyModulesRenderer } from "@/components/public-project/read-only-modules-renderer";
import { ReadOnlyPreviewDetails } from "@/components/public-project/read-only-preview-details";
import { brand } from "@/lib/brand";

interface PublicProjectDetail {
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

interface PublicProjectModules {
  map?: {
    layers: GeospatialLayer[];
    isHidden: boolean;
  };
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
      order?: number;
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
  timeline?: {
    isHidden: boolean;
  };
  moduleOrder: string[];
}

interface PublicCommentsResponse {
  comments: CommentData[];
  isHidden: boolean;
}

interface PublicTimelineResponse {
  records: EnrichedTimelineRecord[];
  isHidden: boolean;
}

interface ProjectPageProps {
  params: Promise<{
    organization: string;
    office: string;
    project: string;
  }>;
}

async function getPublicProject(
  orgSlug: string,
  officeSlug: string,
  projectSlug: string,
): Promise<PublicProjectDetail | null> {
  const { SERVER_URL } = getLandingPageEnv();

  try {
    const response = await fetch(
      `${SERVER_URL}/api/public/projects/${orgSlug}/${officeSlug}/${projectSlug}`,
      {
        next: { revalidate: 60 }, // Revalidate every 60 seconds
      },
    );

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      console.error("Failed to fetch public project:", response.statusText);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching public project:", error);
    return null;
  }
}

async function getPublicProjectModules(
  orgSlug: string,
  officeSlug: string,
  projectSlug: string,
): Promise<PublicProjectModules | null> {
  const { SERVER_URL } = getLandingPageEnv();

  try {
    const response = await fetch(
      `${SERVER_URL}/api/public/projects/${orgSlug}/${officeSlug}/${projectSlug}/modules`,
      {
        next: { revalidate: 60 },
      },
    );

    if (!response.ok) {
      console.error("Failed to fetch project modules:", response.statusText);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching project modules:", error);
    return null;
  }
}

async function getPublicComments(
  orgSlug: string,
  officeSlug: string,
  projectSlug: string,
): Promise<PublicCommentsResponse | null> {
  const { SERVER_URL } = getLandingPageEnv();

  try {
    const response = await fetch(
      `${SERVER_URL}/api/public/projects/${orgSlug}/${officeSlug}/${projectSlug}/comments`,
      {
        cache: "no-store",
      },
    );

    if (!response.ok) {
      console.error("Failed to fetch public comments:", response.statusText);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching public comments:", error);
    return null;
  }
}

async function getPublicTimeline(
  orgSlug: string,
  officeSlug: string,
  projectSlug: string,
): Promise<PublicTimelineResponse | null> {
  const { SERVER_URL } = getLandingPageEnv();

  try {
    const response = await fetch(
      `${SERVER_URL}/api/public/projects/${orgSlug}/${officeSlug}/${projectSlug}/timeline`,
      {
        cache: "no-store",
      },
    );

    if (!response.ok) {
      console.error("Failed to fetch public timeline:", response.statusText);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching public timeline:", error);
    return null;
  }
}

export async function generateMetadata({
  params,
}: ProjectPageProps): Promise<Metadata> {
  const { organization, office, project } = await params;
  const projectData = await getPublicProject(organization, office, project);

  if (!projectData) {
    return {
      title: `Project Not Found - ${brand.name}`,
      description:
        "This project could not be found or is not publicly available.",
    };
  }

  const title = `${projectData.name} - ${projectData.organization.name} | ${brand.name}`;
  const description =
    projectData.description ||
    `View the ${projectData.name} project from ${projectData.organization.name}`;
  const image = projectData.coverImageUrl || brand.ogImage;

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

export default async function PublicProjectPage({ params }: ProjectPageProps) {
  const { organization, office, project: projectSlug } = await params;
  const [project, modules, commentsData, timelineData, session] =
    await Promise.all([
      getPublicProject(organization, office, projectSlug),
      getPublicProjectModules(organization, office, projectSlug),
      getPublicComments(organization, office, projectSlug),
      getPublicTimeline(organization, office, projectSlug),
      getSession(),
    ]);

  if (!project) {
    notFound();
  }

  // Get module order and visibility
  // Note: Use length check because empty array [] is truthy in JS
  const moduleOrder =
    modules?.moduleOrder && modules.moduleOrder.length > 0
      ? modules.moduleOrder
      : ["map", "tasks", "fields", "documents", "timeline", "comments"];
  const isMapHidden = modules?.map?.isHidden ?? false;
  const isTasksHidden = modules?.tasks?.isHidden ?? false;
  const isFieldsHidden = modules?.fields?.isHidden ?? false;
  const isDocumentsHidden = modules?.documents?.isHidden ?? false;
  const documentsData = modules?.documents?.documents || [];
  const isTimelineHidden = modules?.timeline?.isHidden ?? false;
  const isCommentsHidden = commentsData?.isHidden ?? false;
  const mapLayers = modules?.map?.layers || [];
  const taskMilestones = modules?.tasks?.milestones || [];
  const fieldsData = modules?.fields?.fields || [];
  const timelineRecords = timelineData?.records || [];
  const publicComments = commentsData?.comments || [];

  // Get session user for comments (if logged in)
  const sessionUser = session?.user ? { id: session.user.id } : null;

  return (
    <div className="flex flex-col min-h-screen -mt-20">
      <div className="container mx-auto px-6 pt-4">
        <ProjectProgress
          startDate={project.startDate}
          endDate={project.endDate}
        />
      </div>

      <ProjectImageHeader
        projectName={project.name}
        coverImageUrl={project.coverImageUrl}
        readOnly={true}
      />

      <div className="flex-1 container mx-auto p-6 space-y-6">
        <ReadOnlyPreviewDetails
          name={project.name}
          description={project.description}
          organizationName={project.organization.name}
          updatedAt={project.updatedAt}
        />
        <ReadOnlyModulesRenderer
          moduleOrder={moduleOrder}
          entries={[
            {
              id: "map",
              isHidden: isMapHidden || mapLayers.length === 0,
              render: () => (
                <AccordionSection title="Map">
                  <PublicMapSection layers={mapLayers} />
                </AccordionSection>
              ),
            },
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
            {
              id: "timeline",
              isHidden: isTimelineHidden,
              render: () => (
                <AccordionSection title="Timeline">
                  <PublicTimelineSection records={timelineRecords} />
                </AccordionSection>
              ),
            },
            {
              id: "comments",
              isHidden: isCommentsHidden,
              render: () => (
                <PublicCommentsSection
                  orgSlug={organization}
                  officeSlug={office}
                  projectSlug={projectSlug}
                  initialComments={publicComments}
                  sessionUser={sessionUser}
                />
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}
