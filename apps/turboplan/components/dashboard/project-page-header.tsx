"use client";

import { useState } from "react";

import { ChevronsRight, Download, WandSparkles } from "lucide-react";
import type { User } from "next-auth";
import { toast } from "sonner";

import { ApiClient } from "@wildfires-org/turboplan-api-client";
import { OrganizationType } from "@wildfires-org/turboplan-db/types";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Card,
  generateInitialsFromName,
  ProjectImageHeader,
} from "@wildfires-org/turboplan-utils";
import type { Project } from "@wildfires-org/turboplan-workspace/types";

import { CoverImageGallery } from "@/components/cover-image-gallery";
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

const apiClient = new ApiClient();

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

  const projectAvatar = (
    <Avatar className="size-16 rounded-lg shadow-lg">
      {organization.logoUrl && (
        <AvatarImage
          src={organization.logoUrl}
          alt={`${project.name} organization logo`}
          className="object-contain rounded-lg"
        />
      )}
      <AvatarFallback className="bg-[#72DA9E] text-primary-foreground text-2xl font-semibold rounded-lg">
        {generateInitialsFromName(project.name)}
      </AvatarFallback>
    </Avatar>
  );

  // Right-side action cluster: Export + visibility eye. The `⋮` menu and
  // Submit button are owned by ProjectDetails; PublicVisibilityDropdown
  // self-gates (null for citizens / submitted-rejected / no-permission).
  const extraActions = (
    <>
      {/* TODO(TC-417): wire to a real project export handler once one exists.
          No export functionality exists in the codebase yet — placeholder. */}
      <Button
        variant="outline"
        size="sm"
        disabled
        className="border-white bg-white shadow-sm disabled:opacity-100 disabled:text-neutral-500"
      >
        <Download className="mr-1.5 size-4" />
        Export
      </Button>
      <PublicVisibilityDropdown project={project} userId={user?.id} />
    </>
  );

  return (
    <>
      {/*
        Full-bleed cover background. Positioned absolutely at the top of the
        scrollable page body (just below the sticky breadcrumb) so the header
        card and the top of the section content overlay it. The parent in
        page.tsx provides the `relative` positioning context; the cover sits at
        `z-0` while the header card and section modules are `z-10`, so content
        paints above the cover and stays clickable (cover is
        `pointer-events-none`). The tall (450px) cover fades to #F9FAFB via the
        gradient so no forest shows behind the section cards.
      */}
      <ProjectImageHeader
        projectName={project.name}
        organizationLogoUrl={organization.logoUrl}
        coverImageUrl={coverImageUrl}
        isLoading={isLoading}
        readOnly
        showAvatar={false}
        heightClassName="h-[450px]"
        gradientOverlay
        // eslint-disable-next-line tailwindcss/no-contradicting-classname
        gradientClassName="from-[#F4F9F7]/70 via-[#F4F9F7]/90 via-45% to-[#F4F9F7] to-75%"
        className="absolute inset-x-0 top-0 z-0 pointer-events-none"
      />
      <div className="relative z-10 container mx-auto px-6 pt-9">
        <Card className="rounded-2xl border-[1.5px] border-white/95 bg-white/[0.62] p-6 shadow-[0_20px_56px_-40px_rgba(15,23,42,0.28),inset_0_1px_0_rgba(255,255,255,0.95)] backdrop-blur-2xl backdrop-saturate-150 dark:border-white/10 dark:bg-slate-950/[0.62]">
          <ProjectDetails
            project={project}
            user={user}
            organizationSlug={readOnly ? undefined : organization.slug}
            officeSlug={readOnly ? undefined : office.slug}
            isPersonalWorkspace={
              organization.type === OrganizationType.PERSONAL
            }
            headerActions={readOnly ? null : undefined}
            showMembers={!readOnly}
            membersHref={membersHref}
            avatar={projectAvatar}
            extraActions={readOnly ? null : extraActions}
            progressSlot={
              <div className="mt-4">
                <ProjectProgress project={project} user={user} hideActions />
              </div>
            }
            onEditCover={readOnly ? undefined : () => setIsDrawerOpen(true)}
          />
        </Card>
      </div>

      {/* Cover edit Drawer — triggered from the ProjectDetails `⋮` menu. */}
      {!readOnly && (
        <>
          <Drawer
            direction="right"
            open={isDrawerOpen}
            onOpenChange={setIsDrawerOpen}
          >
            <DrawerContent className="h-screen top-0 right-0 left-auto mt-0 w-[500px] rounded-none">
              <DrawerClose>
                <div className="absolute top-4 right-4 z-50">
                  <ChevronsRight className="size-6" />
                </div>
              </DrawerClose>
              <ScrollArea className="h-screen">
                <div className="mx-auto w-full p-5">
                  <DrawerHeader>
                    <DrawerTitle>Cover Gallery</DrawerTitle>
                    <DrawerDescription>
                      Browse through generated images or select a default one.
                    </DrawerDescription>
                  </DrawerHeader>
                  <Button
                    variant="outline"
                    className="w-full mb-4"
                    onClick={handleSurpriseMe}
                  >
                    <WandSparkles className="size-4" />
                    Surprise me
                  </Button>
                  <CoverImageGallery
                    projectId={project.id}
                    currentCoverImageId={coverImageId}
                    onImageSelect={handleImageSelect}
                  />
                  <p className="text-sm text-muted-foreground mt-4">
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
