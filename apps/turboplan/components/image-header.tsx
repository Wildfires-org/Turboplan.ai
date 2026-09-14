"use client";

import { ProjectImageHeader } from "@wildfires-org/turboplan-utils";

import { useCoverImage } from "@/hooks/use-cover-image";

interface ImageHeaderProps {
  projectId: string;
  projectName: string;
  organizationLogoUrl?: string | null;
  coverImageId?: string | null;
  coverImageUrl?: string | null;
  /**
   * Reserved for backward compatibility. Cover editing now lives in the
   * project page header's `⋮` menu (see `project-page-header.tsx`); this
   * component only renders the cover and polls for the generated image.
   */
  readOnly?: boolean;
}

/**
 * Read-only project cover display used by the template preview page. The cover
 * image is generated in the background after project creation, so we keep
 * polling via {@link useCoverImage} until the URL is available. Editing the
 * cover is handled elsewhere (the project page header menu).
 */
export default function ImageHeader({
  projectId,
  projectName,
  organizationLogoUrl,
  coverImageId: initialCoverImageId,
  coverImageUrl: initialCoverImageUrl,
}: ImageHeaderProps) {
  const { coverImageUrl, isLoading } = useCoverImage({
    projectId,
    initialCoverImageId,
    initialCoverImageUrl,
  });

  return (
    <ProjectImageHeader
      projectName={projectName}
      organizationLogoUrl={organizationLogoUrl}
      coverImageUrl={coverImageUrl}
      isLoading={isLoading}
      readOnly
    />
  );
}
