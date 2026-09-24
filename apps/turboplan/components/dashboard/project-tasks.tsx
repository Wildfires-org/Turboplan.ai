"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import Image from "next/image";
import { useRouter } from "next/navigation";
import type { User } from "next-auth";

import { useProjectDocuments } from "@wildfires-org/turboplan-documents/client";
import { EntityType } from "@wildfires-org/turboplan-rbac";
import {
  TasksContainer,
  TasksListSkeleton,
} from "@wildfires-org/turboplan-tasks/components";
import { useProjectTasksUI } from "@wildfires-org/turboplan-tasks/hooks";
import { TasksProvider } from "@wildfires-org/turboplan-tasks/providers";
import type { TaskInviteContext } from "@wildfires-org/turboplan-tasks/types";
import { Button, SuggestionPills } from "@wildfires-org/turboplan-utils";
import {
  type MembersDialogMode,
  useEmptyStateSuggestions,
} from "@wildfires-org/turboplan-workspace/client";

import { useDashboard } from "@/components/providers/dashboard-provider";
import { useCoverImage } from "@/hooks/use-cover-image";
import { useTimeline } from "@/hooks/use-timeline";
import { EMPTY_STATE_TEXT_CLASS, EMPTY_STATE_TITLE_CLASS } from "@/lib/glass";
import { AppUrls } from "@/lib/nav/urls";
import { cn } from "@/lib/utils";
import { ManageMembersDialog } from "./manage-members-dialog";
import { TimelineContent } from "./timeline/timeline-content";

interface ProjectTasksProps {
  projectId: string;
  projectName?: string;
  user?: User;
  readOnly?: boolean;
  /**
   * Optional callback reporting milestone/task counts so a parent (e.g. the
   * section card header) can render a subtitle without a second data fetch.
   */
  onCounts?: (counts: { milestones: number; tasks: number }) => void;
}

export function ProjectTasks({
  projectId,
  projectName,
  user,
  readOnly = false,
  onCounts,
}: ProjectTasksProps) {
  const router = useRouter();
  const { organization, office, project } = useDashboard();
  const isResearchPhaseCompleted = project?.isResearchPhaseCompleted ?? false;

  // Cover image for the task edit modal header
  const { coverImageUrl } = useCoverImage({
    projectId,
    initialCoverImageId: project?.coverImageId ?? null,
  });

  // Project documents for the task edit modal documents section
  const { documents: projectDocuments, uploadDocument } = useProjectDocuments({
    projectId,
  });

  // Breadcrumb path from organization/office names
  const projectPath = useMemo(() => {
    const segments: string[] = [];
    if (organization?.name) {
      segments.push(organization.name);
    }
    if (office?.name) {
      segments.push(office.name);
    }
    return segments;
  }, [organization?.name, office?.name]);

  const { suggestions, isLoading: isSuggestionsLoading } =
    useEmptyStateSuggestions({
      projectId,
      section: "tasks",
      enabled: isResearchPhaseCompleted,
    });
  const [isSuggestionClicked, setIsSuggestionClicked] = useState(false);

  // State for the manage members dialog
  const [isMembersDialogOpen, setIsMembersDialogOpen] = useState(false);
  const [taskContext, setTaskContext] = useState<TaskInviteContext | undefined>(
    undefined,
  );

  // Assignment mode state
  const [dialogMode, setDialogMode] = useState<MembersDialogMode>("manage");
  const [selectedAssignees, setSelectedAssignees] = useState<
    Array<{ id: string }>
  >([]);
  // Use ref for the callback to avoid issues with stale closures
  const assignCallbackRef = useRef<((userIds: string[]) => void) | null>(null);

  // Use the clean SOLID architecture hook
  const tasks = useProjectTasksUI({
    projectId,
    context: "project",
  });

  // Surface milestone/task counts to an optional parent (section card subtitle)
  // without triggering a second fetch. Stable primitive deps avoid extra calls.
  const milestoneCount = tasks.displayMilestones.length;
  const taskCount = tasks.totalTasks;
  useEffect(() => {
    onCounts?.({ milestones: milestoneCount, tasks: taskCount });
  }, [onCounts, milestoneCount, taskCount]);

  // Timeline data for task modal
  const {
    entries: timelineEntries,
    isLoading: timelineLoading,
    error: timelineError,
  } = useTimeline(projectId);
  const selectedTaskId = tasks.ui.selectedTask?.id;
  const timelineContent = useMemo(() => {
    if (!selectedTaskId) return undefined;
    const filtered = timelineEntries.filter(
      (e) => e.entityId === selectedTaskId,
    );
    if (filtered.length === 0 && !timelineLoading) return undefined;
    return (
      <TimelineContent
        entries={filtered}
        isLoading={timelineLoading}
        error={timelineError}
        readOnly
      />
    );
  }, [selectedTaskId, timelineEntries, timelineLoading, timelineError]);

  // Handle opening the dialog in assignment mode (from task avatar click)
  const handleOpenAssignmentDialog = useCallback(
    (
      context: TaskInviteContext,
      currentAssigneeIds: string[],
      onAssign: (userIds: string[]) => void,
    ) => {
      setTaskContext(context);
      setSelectedAssignees(currentAssigneeIds.map((id) => ({ id })));
      assignCallbackRef.current = onAssign;
      setDialogMode("assign");
      setIsMembersDialogOpen(true);
    },
    [],
  );

  // Handle assign callback from dialog
  const handleAssign = useCallback((userIds: string[]) => {
    if (assignCallbackRef.current) {
      assignCallbackRef.current(userIds);
      assignCallbackRef.current = null;
    }
  }, []);

  // Handle dialog close - reset state
  const handleDialogOpenChange = useCallback((open: boolean) => {
    setIsMembersDialogOpen(open);
    if (!open) {
      setTaskContext(undefined);
      setDialogMode("manage");
      setSelectedAssignees([]);
      assignCallbackRef.current = null;
    }
  }, []);

  // Loading state
  if (tasks.loading && tasks.displayMilestones.length === 0) {
    return <TasksListSkeleton />;
  }

  // Error state
  if (tasks.error && tasks.displayMilestones.length === 0) {
    return (
      <div className="min-h-[220px] flex items-center justify-center">
        <div className="text-center">
          <h3 className="mb-2 text-lg font-medium text-error-700">Error</h3>
          <p className="mb-4 text-gray-550">{tasks.error}</p>
          <Button variant="glass" onClick={tasks.handlers.handleRetry}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  // Empty state
  if (tasks.displayMilestones.length === 0 && !tasks.loading) {
    const handleSuggestionClick = (content: string) => {
      if (isSuggestionClicked) return;
      if (organization?.slug && office?.slug && project?.slug) {
        setIsSuggestionClicked(true);
        const chatUrl = AppUrls.projectNewChat(
          organization.slug,
          office.slug,
          project.slug,
        );
        router.push(`${chatUrl}?prefillContent=${encodeURIComponent(content)}`);
      }
    };

    const placeholderSuggestions = [
      { label: "Create project milestones", content: "" },
      { label: "Plan task breakdown", content: "" },
      { label: "Set up timeline", content: "" },
    ];

    return (
      <div className="group relative min-h-[220px] flex items-center justify-center overflow-hidden">
        <div className="flex flex-col items-center gap-5 text-center">
          <div className="flex flex-col items-center gap-1.5">
            <h3 className={EMPTY_STATE_TITLE_CLASS}>No tasks assigned</h3>
            {readOnly ? (
              <p className={cn(EMPTY_STATE_TEXT_CLASS, "max-w-xs")}>
                This project doesn&apos;t have any tasks or milestones yet.
              </p>
            ) : (
              <p className={cn(EMPTY_STATE_TEXT_CLASS, "max-w-xs")}>
                You can generate a compliant workflow schedule based on your
                NEPA pathway.
              </p>
            )}
          </div>
          {!readOnly && (
            <SuggestionPills
              suggestions={
                isResearchPhaseCompleted ? suggestions : placeholderSuggestions
              }
              isLoading={isResearchPhaseCompleted && isSuggestionsLoading}
              disabled={!isResearchPhaseCompleted || isSuggestionClicked}
              onSuggestionClick={handleSuggestionClick}
            />
          )}
        </div>
        {/* Beaver slides in from bottom on hover */}
        <div className="pointer-events-none absolute bottom-0 right-6 translate-y-full transition-transform duration-300 ease-out group-hover:translate-y-[10%]">
          <Image
            src="/images/shocked-beaver.png"
            alt=""
            width={118}
            height={129}
          />
        </div>
      </div>
    );
  }

  // SOLID Architecture: Context Provider eliminates prop drilling (20+ props → 3 props)
  return (
    <>
      <TasksProvider tasks={tasks}>
        <TasksContainer
          className="w-full"
          isCurrentVersion={!readOnly}
          isPreview={readOnly}
          timelineContent={timelineContent}
          coverImageUrl={coverImageUrl}
          projectPath={projectPath}
          projectDocuments={projectDocuments}
          onUploadDocument={uploadDocument}
          onOpenAssignmentDialog={
            !readOnly && user && projectName
              ? handleOpenAssignmentDialog
              : undefined
          }
        />
      </TasksProvider>

      {/* Manage Members Dialog - supports both manage and assign modes */}
      {user && projectName && (
        <ManageMembersDialog
          entityType={EntityType.PROJECT}
          entityId={projectId}
          entityName={projectName}
          user={user}
          open={isMembersDialogOpen}
          onOpenChange={handleDialogOpenChange}
          taskContext={taskContext}
          mode={dialogMode}
          selectedAssignees={selectedAssignees}
          onAssign={handleAssign}
        />
      )}
    </>
  );
}
