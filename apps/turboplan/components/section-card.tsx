"use client";

import type { ReactNode } from "react";
import { useState } from "react";

import Link from "next/link";

import { Card } from "@wildfires-org/turboplan-utils";

import { cn } from "@/lib/utils";
import type { DragHandleProps } from "./dashboard/sortable-module";
import { SectionVisibilityDropdown } from "./section-visibility-dropdown";

type SectionActionLink = {
  label: string;
  href?: string;
  onClick?: () => void;
};

type SectionCardProps = {
  title: string;
  children: ReactNode;
  controls?: ReactNode;
  /** Toggle admin visibility (hide from admin UI) */
  onToggleVisibility?: () => void;
  isHidden?: boolean;
  isTogglingVisibility?: boolean;
  /** Toggle public visibility (hide from public catalog for non-logged-in users) */
  onTogglePublicVisibility?: () => void;
  isPrivate?: boolean;
  isTogglingPublicVisibility?: boolean;
  dragHandleProps?: DragHandleProps;
  /** When true, hides all edit controls (visibility toggle, controls, drag handle) */
  readOnly?: boolean;
  /** Optional count to display as badge next to title */
  count?: number;
  /** Leading section icon rendered before the title */
  icon?: ReactNode;
  /** Count/subtitle text rendered next to the title (e.g. "4 milestones · 7 tasks") */
  subtitle?: ReactNode;
  /** Blue action link rendered on the right side of the header */
  actionLink?: SectionActionLink;
};

export function SectionCard({
  title,
  children,
  controls,
  onToggleVisibility,
  isHidden = false,
  isTogglingVisibility = false,
  onTogglePublicVisibility,
  isPrivate = false,
  isTogglingPublicVisibility = false,
  dragHandleProps,
  readOnly = false,
  count,
  icon,
  subtitle,
  actionLink,
}: SectionCardProps) {
  const [isOpen, setIsOpen] = useState(true);

  const handleClick = () => {
    setIsOpen((o) => !o);
  };

  // In readOnly mode, disable drag functionality
  const isDraggable = !readOnly && dragHandleProps;

  // Show visibility dropdown when either toggle handler is provided
  const showVisibilityDropdown = onTogglePublicVisibility || onToggleVisibility;

  const linkClassName =
    "inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-xs font-medium text-blue-600 transition-colors hover:text-blue-700";

  const renderActionLink = () => {
    if (!actionLink) {
      return null;
    }

    if (actionLink.href) {
      return (
        <Link href={actionLink.href} className={linkClassName}>
          {actionLink.label}
        </Link>
      );
    }

    return (
      <button
        type="button"
        onClick={actionLink.onClick}
        className={linkClassName}
      >
        {actionLink.label}
      </button>
    );
  };

  return (
    <Card
      className={cn(
        "overflow-hidden rounded-2xl border-[1.5px] border-white/95 bg-white/[0.58]",
        "shadow-[0_18px_48px_-34px_rgba(15,23,42,0.24),inset_0_1px_0_rgba(255,255,255,0.9)]",
        "backdrop-blur-2xl backdrop-saturate-150",
        "dark:border-white/10 dark:bg-slate-950/60",
      )}
    >
      {/* Header row mirrors Figma: icon + title + count on the left, action link + controls on the right, separated from the body by a divider */}
      <div className="flex items-center justify-between gap-3 border-b border-white/75 px-4 py-3.5 dark:border-white/10">
        {/* Left cluster - drag region (entire cluster draggable when enabled and not readOnly) */}
        <div
          className={cn(
            "flex min-w-0 items-center gap-2",
            isDraggable && "cursor-grab touch-none active:cursor-grabbing",
          )}
          {...(isDraggable ? dragHandleProps.attributes : {})}
          {...(isDraggable ? dragHandleProps.listeners : {})}
        >
          {icon && (
            <span className="flex items-center text-foreground">{icon}</span>
          )}
          <button
            type="button"
            onClick={handleClick}
            aria-expanded={isOpen}
            className="flex min-w-0 cursor-pointer items-center gap-2 text-left"
          >
            <h2 className="truncate text-sm font-bold leading-[21px] text-foreground">
              {title}
            </h2>
            {count !== undefined && count > 0 && (
              <span className="flex size-5 items-center justify-center rounded-full bg-neutral-400 px-2 py-1 text-xs font-medium leading-4 text-white">
                {count}
              </span>
            )}
          </button>
          {subtitle && (
            <span className="shrink-0 whitespace-nowrap text-xs font-medium text-muted-foreground">
              {subtitle}
            </span>
          )}
        </div>
        {/* Right cluster - hidden in readOnly mode */}
        {!readOnly && (
          <div className="flex shrink-0 items-center gap-3">
            {renderActionLink()}
            {controls && <div>{controls}</div>}
            {showVisibilityDropdown && (
              <SectionVisibilityDropdown
                isPrivate={isPrivate}
                isTogglingPublicVisibility={isTogglingPublicVisibility}
                onTogglePublicVisibility={onTogglePublicVisibility}
                isTogglingVisibility={isTogglingVisibility}
                onToggleVisibility={onToggleVisibility}
              />
            )}
          </div>
        )}
      </div>
      {isOpen && !isHidden && <div className="p-4">{children}</div>}
    </Card>
  );
}
