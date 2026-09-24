"use client";

import type { ReactNode } from "react";

import Image from "next/image";

import { cn } from "../../tailwind";
import { generateInitialsFromName } from "../../user";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";

export interface ProjectImageHeaderProps {
  /** Project name - used for initials avatar */
  projectName: string;
  /** Organization logo URL - shown instead of initials when available */
  organizationLogoUrl?: string | null;
  /** Cover image URL - falls back to default if not provided */
  coverImageUrl?: string | null;
  /** Default image to show when coverImageUrl is not available */
  defaultImageUrl?: string;
  /** When true, hides edit controls */
  readOnly?: boolean;
  /** Loading state - shows loading overlay */
  isLoading?: boolean;
  /** Edit controls to render (only shown when readOnly=false and not loading) */
  editControls?: ReactNode;
  /**
   * Tailwind height class for the cover. Defaults to `h-[140px]` so existing
   * callers are unchanged; the project page passes a taller value.
   */
  heightClassName?: string;
  /**
   * Whether to render the built-in project initials/logo avatar overlay.
   * Set to false when the consumer renders its own avatar (e.g. inside an
   * overlapping header card). Defaults to true.
   */
  showAvatar?: boolean;
  /**
   * Whether to render a white gradient fading the cover into the content
   * below (so an overlapping header card melds with the image). Defaults to
   * false to keep other callers unchanged.
   */
  gradientOverlay?: boolean;
  /**
   * Tailwind classes for the gradient overlay element. Only used when
   * `gradientOverlay` is true. Defaults to a gentle white fade; pass a steeper
   * stop set when the cover is a tall full-bleed background that must fully
   * fade to `#F9FAFB` before the page content begins.
   */
  gradientClassName?: string;
  /**
   * Extra classes applied to the root cover container. Use to position the
   * cover absolutely as a full-bleed background (e.g. `absolute inset-x-0 top-0
   * -z-10 pointer-events-none`). Defaults to empty so other callers are
   * unchanged (cover stays in normal flow).
   */
  className?: string;
}

/**
 * Shared project image header component.
 * Displays cover image with project initials avatar overlay.
 * Supports optional edit controls that are hidden in readOnly mode.
 */
export function ProjectImageHeader({
  projectName,
  organizationLogoUrl,
  coverImageUrl,
  defaultImageUrl = "/images/project-header-default-background.jpg",
  readOnly = false,
  isLoading = false,
  editControls,
  heightClassName = "h-[140px]",
  showAvatar = true,
  gradientOverlay = false,
  gradientClassName,
  className,
}: ProjectImageHeaderProps) {
  const displayImageUrl = coverImageUrl || defaultImageUrl;

  return (
    <div
      className={cn(
        "relative w-full shrink-0 group bg-muted",
        heightClassName,
        className,
      )}
    >
      <Image
        src={displayImageUrl}
        alt="Project cover"
        fill
        className="object-cover"
        priority
      />

      {/* Gradient fades the cover into the #F9FAFB content/header below */}
      {gradientOverlay && (
        <div
          className={cn(
            "pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-[#F9FAFB]/30 to-[#F9FAFB]",
            gradientClassName,
          )}
        />
      )}

      {/* Loading indicator overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center z-0">
          <div className="flex items-center gap-2 text-white/90 text-sm">
            <div className="size-4 border-2 border-white/90 border-t-transparent rounded-full animate-spin" />
            <span>Generating cover...</span>
          </div>
        </div>
      )}

      {/* Project initials avatar overlay */}
      {showAvatar && (
        <div className="absolute bottom-[-32px] left-0 right-0">
          <div className="container mx-auto px-6">
            <Avatar className="size-16 rounded-lg shadow-lg">
              {organizationLogoUrl && (
                <AvatarImage
                  src={organizationLogoUrl}
                  alt={`${projectName} organization logo`}
                  className="object-contain rounded-lg"
                />
              )}
              <AvatarFallback className="bg-[#72DA9E] text-primary-foreground text-2xl font-semibold rounded-lg">
                {generateInitialsFromName(projectName)}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
      )}

      {/* Edit controls - only shown when not loading and not readOnly */}
      {!isLoading && !readOnly && editControls}
    </div>
  );
}
