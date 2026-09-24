"use client";

import { useState } from "react";

import { ChevronsRight, Download, Loader2, WandSparkles } from "lucide-react";
import Image from "next/image";
import type { User } from "next-auth";
import { toast } from "sonner";

import { ApiClient } from "@wildfires-org/turboplan-api-client";
import { OrganizationType } from "@wildfires-org/turboplan-db/types";
import {
  Button,
  generateInitialsFromName,
} from "@wildfires-org/turboplan-utils";
import type { Project } from "@wildfires-org/turboplan-workspace/types";

import { CoverImageGallery } from "@/components/cover-image-gallery";
import { EntityBannerShell } from "@/components/dashboard/entity-banner";
import { ProjectDetails } from "@/components/dashboard/project-details";
import { ProjectProgress } from "@/components/dashboard/project-progress";
import { PublicVisibilityDropdown } from "@/components/dashboard/public-visibility-dropdown";
import { ImageGenerationModal } from "@/components/image-generation-modal";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCoverImage } from "@/hooks/use-cover-image";
import {
  GLASS_ICON_BUTTON_CLASS,
  HEADER_ACTION_BUTTON_CLASS,
} from "@/lib/glass";
import { cn } from "@/lib/utils";

const apiClient = new ApiClient();

const DEFAULT_COVER_URL = "/images/project-header-default-background.jpg";

export interface ProjectPageHeaderProps {
  project: Project;
  organization: { slug: string; logoUrl?: string | null; type?: string };
  office: { slug: string };
  coverImage: { imageUrl: string } | null;
  user?: User;
  /** Hide edit/action controls (download button, edit menu, cover edit). Default false */
  readOnly?: boolean;
  /** URL to navigate to when members avatars are clicked */
  membersHref?: string;
}

export function ProjectPageHeader({
  project,
  organization,
  office,
  coverImage,
  user,
  readOnly,
  membersHref,
}: ProjectPageHeaderProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Single source of truth for cover image state (shared with the gallery/modal).
  const { coverImageId, coverImageUrl, isLoading, setCoverImage } =
    useCoverImage({
      projectId: project.id,
      initialCoverImageId: project.coverImageId,
      initialCoverImageUrl: coverImage?.imageUrl,
    });

  // next/image throws on blank src; normalize like EntityBanner does.
  const safeOrgLogoUrl = organization.logoUrl?.trim() || null;

  const handleSurpriseMe = () => {
    setIsDrawerOpen(false);
    setIsModalOpen(true);
  };

  const handleImageSelect = async (imageId: string, imageUrl: string) => {
    try {
      const { error: apiError } = await apiClient.patch(
        `/api/projects/${project.id}/cover-image`,
        { imageId },
      );

      if (apiError) {
        throw new Error(apiError);
      }

      setCoverImage(imageId, imageUrl);
      toast.success("Cover image updated!");
    } catch (error) {
      console.error("Error updating cover image:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to update cover image",
      );
    }
  };

  const handleImageGenerated = async (imageId: string, imageUrl: string) => {
    setIsModalOpen(false);
    toast.success("Image generated successfully!");
    await handleImageSelect(imageId, imageUrl);
  };

  const projectAvatar = safeOrgLogoUrl ? (
    <Image
      src={safeOrgLogoUrl}
      alt={`${project.name} organization logo`}
      width={49}
      height={55}
      className="object-contain"
    />
  ) : (
    // brand-800 fill: white initials at 4.6:1 (same tile as the sidebar badge).
    <span
      aria-hidden
      className="flex size-full items-center justify-center bg-brand-800 text-[22px] font-semibold tracking-[-0.02em] text-white"
    >
      {generateInitialsFromName(project.name)}
    </span>
  );

  // Right-side action cluster: Export + visibility eye. The `⋮` menu and
  // Submit button are owned by ProjectDetails; PublicVisibilityDropdown
  // self-gates (null for citizens / submitted-rejected / no-permission).
  const extraActions = (
    <>
      {/* TODO(TC-417): wire to a real project export handler once one exists.
          No export functionality exists in the codebase yet — placeholder. */}
      <Button
        variant="glass"
        size="sm"
        disabled
        className={cn(
          HEADER_ACTION_BUTTON_CLASS,
          "text-foreground disabled:text-gray-550 disabled:opacity-100",
        )}
      >
        <Download aria-hidden />
        Export
      </Button>
      <PublicVisibilityDropdown project={project} userId={user?.id} />
    </>
  );

  return (
    <>
      <EntityBannerShell
        coverImageUrl={coverImageUrl?.trim() || DEFAULT_COVER_URL}
        logo={projectAvatar}
        coverOverlay={
          isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/35">
              <div className="glass flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] text-foreground">
                <Loader2
                  aria-hidden
                  className="size-3.5 animate-spin motion-reduce:animate-none"
                />
                Generating cover...
              </div>
            </div>
          )
        }
      >
        <ProjectDetails
          project={project}
          user={user}
          organizationSlug={readOnly ? undefined : organization.slug}
          officeSlug={readOnly ? undefined : office.slug}
          isPersonalWorkspace={organization.type === OrganizationType.PERSONAL}
          headerActions={readOnly ? null : undefined}
          showMembers={!readOnly}
          membersHref={membersHref}
          extraActions={readOnly ? null : extraActions}
          progressSlot={
            <div className="mt-4">
              <ProjectProgress project={project} user={user} hideActions />
            </div>
          }
          onEditCover={readOnly ? undefined : () => setIsDrawerOpen(true)}
        />
      </EntityBannerShell>

      {/* Cover edit Drawer — triggered from the ProjectDetails `⋮` menu. */}
      {!readOnly && (
        <>
          <Drawer
            direction="right"
            open={isDrawerOpen}
            onOpenChange={setIsDrawerOpen}
          >
            <DrawerContent className="left-auto right-0 top-0 mt-0 h-screen w-full max-w-[500px] rounded-none rounded-l-[24px] border-0 border-l-[1.5px] border-white bg-white/[0.94] shadow-[0_32px_80px_-32px_rgba(15,40,30,0.38)] backdrop-blur-2xl backdrop-saturate-150 dark:border-white/10 dark:bg-slate-950/[0.94] [&>div:first-child]:hidden">
              <DrawerClose
                aria-label="Close cover gallery"
                className={cn(
                  GLASS_ICON_BUTTON_CLASS,
                  "absolute right-4 top-4 z-50",
                )}
              >
                <ChevronsRight aria-hidden className="size-4" />
              </DrawerClose>
              <ScrollArea className="h-screen">
                <div className="mx-auto w-full p-5">
                  <DrawerHeader className="px-0 pr-10">
                    <DrawerTitle className="text-[20px] font-medium tracking-[-0.02em]">
                      Cover Gallery
                    </DrawerTitle>
                    <DrawerDescription className="text-gray-550">
                      Browse through generated images or select a default one.
                    </DrawerDescription>
                  </DrawerHeader>
                  <Button
                    variant="glass"
                    className="mb-4 w-full"
                    onClick={handleSurpriseMe}
                  >
                    <WandSparkles aria-hidden />
                    Surprise me
                  </Button>
                  <CoverImageGallery
                    projectId={project.id}
                    currentCoverImageId={coverImageId}
                    onImageSelect={handleImageSelect}
                  />
                  <p className="mt-4 text-sm text-gray-550">
                    These images are generated through AI text-to-image
                    algorithms, no project data is shared in the process.
                  </p>
                </div>
              </ScrollArea>
            </DrawerContent>
          </Drawer>

          <ImageGenerationModal
            open={isModalOpen}
            onOpenChange={setIsModalOpen}
            projectId={project.id}
            projectName={project.name}
            onImageGenerated={handleImageGenerated}
          />
        </>
      )}
    </>
  );
}
