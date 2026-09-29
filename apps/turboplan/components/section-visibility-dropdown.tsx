"use client";

import { Eye, EyeOff, Loader2, MoreVertical, X } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@wildfires-org/turboplan-utils";

interface SectionVisibilityDropdownProps {
  /** Whether the section is currently private (hidden from public) */
  isPrivate: boolean;
  /** Whether the public visibility toggle is in progress */
  isTogglingPublicVisibility?: boolean;
  /** Called when the public visibility item is clicked */
  onTogglePublicVisibility?: () => void;
  /** Whether the admin visibility toggle is in progress */
  isTogglingVisibility?: boolean;
  /** Called when "Remove Section" is clicked to hide from admin UI */
  onToggleVisibility?: () => void;
}

export function SectionVisibilityDropdown({
  isPrivate,
  isTogglingPublicVisibility = false,
  onTogglePublicVisibility,
  isTogglingVisibility = false,
  onToggleVisibility,
}: SectionVisibilityDropdownProps) {
  const isLoading = isTogglingPublicVisibility || isTogglingVisibility;

  const handleTogglePublic = (e: Event) => {
    e.preventDefault();
    onTogglePublicVisibility?.();
  };

  const handleRemoveSection = (e: Event) => {
    e.preventDefault();
    onToggleVisibility?.();
  };

  return (
    <div
      className="flex items-center gap-1"
      onClick={(e) => e.stopPropagation()}
    >
      <span
        aria-label={isPrivate ? "Private section" : "Public section"}
        title={isPrivate ? "Private" : "Public"}
        className="flex items-center text-gray-550"
      >
        {isPrivate ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={isLoading}
            aria-label="Section options"
            className="press flex size-8 items-center justify-center rounded-lg text-foreground hover:bg-white/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 disabled:cursor-not-allowed disabled:opacity-50 data-[state=open]:bg-white/90"
          >
            {isLoading ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <MoreVertical className="size-5" />
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={handleTogglePublic}
            disabled={!onTogglePublicVisibility || isTogglingPublicVisibility}
            className="gap-2 cursor-pointer"
          >
            {isTogglingPublicVisibility ? (
              <Loader2 className="size-4 animate-spin" />
            ) : isPrivate ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
            <span>{isPrivate ? "Private" : "Public"}</span>
          </DropdownMenuItem>
          {onToggleVisibility && (
            <DropdownMenuItem
              onSelect={handleRemoveSection}
              disabled={isTogglingVisibility}
              className="gap-2 cursor-pointer"
            >
              <X className="size-4" />
              <span>Remove Section</span>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
