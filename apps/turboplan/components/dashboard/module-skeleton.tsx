"use client";

import type { ReactNode } from "react";

import {
  BookOpen,
  CheckSquare,
  Clock,
  FileText,
  List,
  Map as MapIcon,
  MessageSquare,
} from "lucide-react";

import {
  isDocumentsPackageEnabled,
  isFieldsPackageEnabled,
  isMapPackageEnabled,
  isProjectContextPackageEnabled,
  isTasksPackageEnabled,
  isTimelineRecordsPackageEnabled,
} from "@wildfires-org/turboplan-feature-flags";
import { TasksListSkeleton } from "@wildfires-org/turboplan-tasks/components";

import { SectionCard } from "@/components/section-card";
import { SKELETON_BAR_CLASS } from "@/lib/glass";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────

interface ModuleSkeletonProps {
  title: string;
  icon: ReactNode;
  /** Body placeholder height, matched to the module's own loading body. */
  bodyClassName: string;
  /** Module-provided placeholder, used instead of the plain block. */
  body?: ReactNode;
}

interface ModuleSkeletonSpec extends ModuleSkeletonProps {
  key: string;
  enabled: () => boolean;
}

// ── Constants ─────────────────────────────────────────────────────────

const ICON_CLASS = "size-4";
const always = () => true;

// Default column placement/order (see DEFAULT_MODULE_COLUMNS). Body heights
// match each module's own loading placeholder (map frame 400px, 3 document
// rows, 3 context/timeline entries, 6 field rows, 2 comments + input), which
// is what replaces this skeleton once visibility/order resolve.
const MAIN_MODULES: ModuleSkeletonSpec[] = [
  {
    key: "map",
    title: "Map",
    icon: <MapIcon className={ICON_CLASS} aria-hidden />,
    bodyClassName: "h-[400px]",
    enabled: isMapPackageEnabled,
  },
  {
    key: "tasks",
    title: "Tasks",
    icon: <CheckSquare className={ICON_CLASS} aria-hidden />,
    bodyClassName: "",
    body: <TasksListSkeleton />,
    enabled: isTasksPackageEnabled,
  },
  {
    key: "fields",
    title: "Fields",
    icon: <List className={ICON_CLASS} aria-hidden />,
    bodyClassName: "h-[146px]",
    enabled: isFieldsPackageEnabled,
  },
  {
    key: "comments",
    title: "Comments",
    icon: <MessageSquare className={ICON_CLASS} aria-hidden />,
    bodyClassName: "h-[226px]",
    enabled: always,
  },
];

const SIDEBAR_MODULES: ModuleSkeletonSpec[] = [
  {
    key: "context",
    title: "Context",
    icon: <BookOpen className={ICON_CLASS} aria-hidden />,
    bodyClassName: "h-[566px]",
    enabled: isProjectContextPackageEnabled,
  },
  {
    key: "documents",
    title: "Documents",
    icon: <FileText className={ICON_CLASS} aria-hidden />,
    bodyClassName: "h-[155px]",
    enabled: isDocumentsPackageEnabled,
  },
  {
    key: "timeline",
    title: "Timeline",
    icon: <Clock className={ICON_CLASS} aria-hidden />,
    bodyClassName: "h-[366px]",
    enabled: isTimelineRecordsPackageEnabled,
  },
];

/** Same 32px footprint as SectionCard's visibility menu trigger. */
const CONTROLS_PLACEHOLDER = (
  <span aria-hidden className="flex h-8 items-center gap-3">
    <span className={cn(SKELETON_BAR_CLASS, "h-3 w-10")} />
    <span className={cn(SKELETON_BAR_CLASS, "size-4 rounded")} />
    <span className={cn(SKELETON_BAR_CLASS, "size-5 rounded")} />
  </span>
);

// ── Components ────────────────────────────────────────────────────────

/** A module placeholder: the real SectionCard shell (same header metrics),
 * with a soft block where the body goes. */
export function ModuleSkeleton({
  title,
  icon,
  bodyClassName,
  body,
}: ModuleSkeletonProps) {
  return (
    <SectionCard title={title} icon={icon} controls={CONTROLS_PLACEHOLDER}>
      {body ?? (
        <div
          aria-hidden
          className={cn(SKELETON_BAR_CLASS, "rounded-xl", bodyClassName)}
        />
      )}
    </SectionCard>
  );
}

/** Overview modules grid before visibility/order resolve (and in the route
 * loading state): same two-column grid, default order. */
export function ProjectModulesSkeleton() {
  const renderColumn = (specs: ModuleSkeletonSpec[]) =>
    specs
      .filter((spec) => spec.enabled())
      .map(({ key, enabled: _enabled, ...spec }) => (
        <ModuleSkeleton key={key} {...spec} />
      ));

  return (
    <div
      aria-busy
      aria-label="Loading project modules"
      className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]"
    >
      <div className="space-y-6">{renderColumn(MAIN_MODULES)}</div>
      <div className="space-y-6">{renderColumn(SIDEBAR_MODULES)}</div>
    </div>
  );
}
