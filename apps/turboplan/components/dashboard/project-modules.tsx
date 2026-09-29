"use client";

import { useEffect, useRef, useState } from "react";

import {
  closestCorners,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { User } from "next-auth";
import { toast } from "sonner";

import {
  MODULE_DISPLAY_NAMES,
  type ProjectModule,
} from "@wildfires-org/turboplan-db/types";
import {
  isDocumentsPackageEnabled,
  isFieldsPackageEnabled,
  isMapPackageEnabled,
  isProjectContextPackageEnabled,
  isTasksPackageEnabled,
  isTimelineRecordsPackageEnabled,
} from "@wildfires-org/turboplan-feature-flags";
import { Action, EntityType } from "@wildfires-org/turboplan-rbac";
import { useEntityPermission } from "@wildfires-org/turboplan-rbac/hooks";
import {
  DEFAULT_MODULE_COLUMNS,
  type Project,
  useModuleColumns,
  useModuleOrder,
  useModulePublicVisibility,
  useModuleVisibility,
} from "@wildfires-org/turboplan-workspace/client";

import { cn } from "@/lib/utils";
import { AddSectionsBar } from "./add-sections-bar";
import {
  CommentsSection,
  ContextSection,
  DocumentsSection,
  FieldsSection,
  MapSection,
  TasksSection,
  TimelineSection,
} from "./module-sections";
import { ProjectModulesSkeleton } from "./module-skeleton";
import { type DragHandleProps, SortableModule } from "./sortable-module";

/**
 * ProjectModules Component
 */

type ColumnId = "main" | "sidebar";

const DROPPABLE_IDS: Record<ColumnId, string> = {
  main: "col-main",
  sidebar: "col-sidebar",
};

interface ProjectModulesProps {
  projectId: string;
  organizationSlug: string;
  officeSlug: string;
  projectSlug: string;
  /** User ID for permission checks in modules like comments */
  userId?: string;
  /** Full user object for task invitation functionality */
  user?: User;
  /** Project name for task invitation dialog */
  projectName?: string;
  /** When true, disables all editing: drag-to-reorder, visibility toggles, add sections bar */
  readOnly?: boolean;
  /** Whether the research phase is completed */
  isResearchPhaseCompleted: boolean;
  /** Module names to exclude from rendering (e.g. ["map", "comments"] for templates) */
  excludeModules?: string[];
  /**
   * Whether the current viewer has RBAC membership on the project. When
   * false (e.g. a citizen browsing a public government project), modules
   * flagged as private via privateModules are hidden entirely so no tiles
   * render with "Error fetching" banners. Required so the safe default is
   * a deliberate call at every call site rather than an implicit "show all".
   */
  isMember: boolean;
  /**
   * Server-rendered project row. When provided it seeds the module hooks' SWR
   * cache so the modules mount on first paint instead of waiting on
   * `/api/projects/:id`, which every module data fetch is otherwise queued
   * behind. Pass it from pages that already read the project on the server.
   */
  initialProject?: Project;
}

/**
 * Droppable wrapper for a single column. Always renders a droppable region so
 * empty columns remain valid drop targets during cross-column drags.
 */
interface DroppableColumnProps {
  columnId: ColumnId;
  isEmpty: boolean;
  children: React.ReactNode;
}

function DroppableColumn({
  columnId,
  isEmpty,
  children,
}: DroppableColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: DROPPABLE_IDS[columnId] });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "space-y-6",
        // Empty columns need a tangible drop zone so they stay targetable.
        isEmpty &&
          "min-h-[120px] rounded-xl border-2 border-dashed border-muted transition-colors",
        isEmpty && isOver && "border-primary/50 bg-muted/30",
      )}
    >
      {children}
    </div>
  );
}

export function ProjectModules({
  projectId,
  organizationSlug,
  officeSlug,
  projectSlug,
  userId,
  user,
  projectName,
  readOnly = false,
  isResearchPhaseCompleted,
  excludeModules = [],
  isMember,
  initialProject,
}: ProjectModulesProps) {
  const {
    hiddenModules,
    isModuleHidden,
    toggleModuleVisibility,
    isLoading: isVisibilityLoading,
  } = useModuleVisibility({
    projectId,
    initialProject,
  });

  const {
    isModulePrivate,
    toggleModulePublicVisibility,
    isLoading: isPublicVisibilityLoading,
  } = useModulePublicVisibility({
    projectId,
    initialProject,
  });

  const {
    moduleOrder,
    updateModuleOrder,
    isLoading: isOrderLoading,
    mutate: mutateProject,
  } = useModuleOrder({
    projectId,
    initialProject,
  });

  const { moduleColumns, updateModuleColumns } = useModuleColumns({
    projectId,
    initialProject,
  });

  const { hasPermission: canUpdate, isChecking: isCheckingPermission } =
    useEntityPermission({
      userId,
      entityType: EntityType.PROJECT,
      entityId: projectId,
      action: Action.UPDATE,
    });

  // If user lacks UPDATE permission, force readOnly mode
  const effectiveReadOnly = readOnly || (!isCheckingPermission && !canUpdate);

  // Track all modules currently being toggled (visibility)
  const [togglingModules, setTogglingModules] = useState<Set<string>>(
    new Set(),
  );

  // Track all modules currently being toggled (public visibility)
  const [togglingPublicModules, setTogglingPublicModules] = useState<
    Set<string>
  >(new Set());

  // Configure DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Filter to modules that are available (feature flags enabled)
  const allAvailableModules = moduleOrder.filter((moduleName) => {
    if (moduleName === "map" && !isMapPackageEnabled()) return false;
    if (moduleName === "tasks" && !isTasksPackageEnabled()) return false;
    if (moduleName === "fields" && !isFieldsPackageEnabled()) return false;
    if (moduleName === "context" && !isProjectContextPackageEnabled())
      return false;
    if (moduleName === "documents" && !isDocumentsPackageEnabled())
      return false;
    if (moduleName === "timeline" && !isTimelineRecordsPackageEnabled())
      return false;
    return true;
  });

  // Filter to only show visible modules in their sorted order
  // Note: Each module requires its respective package to be enabled (feature flags)
  const visibleModules = moduleOrder.filter((moduleName) => {
    if (excludeModules.includes(moduleName)) {
      return false;
    }
    // Non-members (e.g. citizens browsing a public gov project) must not see
    // modules marked as private by the project owner.
    if (!isMember && isModulePrivate(moduleName)) {
      return false;
    }
    if (
      moduleName === "map" &&
      (!isMapPackageEnabled() || isModuleHidden("map"))
    ) {
      return false;
    }
    if (
      moduleName === "tasks" &&
      (!isTasksPackageEnabled() || isModuleHidden("tasks"))
    ) {
      return false;
    }
    if (
      moduleName === "fields" &&
      (!isFieldsPackageEnabled() || isModuleHidden("fields"))
    ) {
      return false;
    }
    if (
      moduleName === "context" &&
      (!isProjectContextPackageEnabled() || isModuleHidden("context"))
    ) {
      return false;
    }
    if (
      moduleName === "documents" &&
      (!isDocumentsPackageEnabled() || isModuleHidden("documents"))
    ) {
      return false;
    }
    if (
      moduleName === "timeline" &&
      (!isTimelineRecordsPackageEnabled() || isModuleHidden("timeline"))
    ) {
      return false;
    }
    // Comments module - always available, just check visibility
    if (moduleName === "comments" && isModuleHidden("comments")) {
      return false;
    }
    return true;
  });

  // Resolve the column for a module (stored value already merged over defaults
  // by the hook; keep the fallback for safety).
  const resolveColumn = (moduleName: string): ColumnId =>
    moduleColumns[moduleName as ProjectModule] ??
    DEFAULT_MODULE_COLUMNS[moduleName as ProjectModule] ??
    "main";

  // Partition the already-filtered/ordered visibleModules into the two columns,
  // preserving their relative order from visibleModules.
  const mainModules = visibleModules.filter((m) => resolveColumn(m) === "main");
  const sidebarModules = visibleModules.filter(
    (m) => resolveColumn(m) === "sidebar",
  );

  // Local working arrays drive the dnd preview. They are seeded from the
  // partition and re-synced whenever the source data changes and no drag is in
  // progress (a drag uses these arrays as the live preview).
  const [mainIds, setMainIds] = useState<string[]>(mainModules);
  const [sidebarIds, setSidebarIds] = useState<string[]>(sidebarModules);
  const isDraggingRef = useRef(false);

  const mainKey = mainModules.join("|");
  const sidebarKey = sidebarModules.join("|");

  useEffect(() => {
    if (isDraggingRef.current) {
      return;
    }
    setMainIds(mainModules);
    setSidebarIds(sidebarModules);
    // mainModules/sidebarModules are derived; the join keys are stable proxies
    // for their contents so we only resync when the partition actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainKey, sidebarKey]);

  // Determine which working column a given id belongs to. The id may be a
  // module id (in one of the arrays) or a column droppable id.
  const findColumn = (id: string): ColumnId | null => {
    if (id === DROPPABLE_IDS.main) {
      return "main";
    }
    if (id === DROPPABLE_IDS.sidebar) {
      return "sidebar";
    }
    if (mainIds.includes(id)) {
      return "main";
    }
    if (sidebarIds.includes(id)) {
      return "sidebar";
    }
    return null;
  };

  const getColumnArray = (column: ColumnId) =>
    column === "main" ? mainIds : sidebarIds;

  const setColumnArray = (column: ColumnId, next: string[]) => {
    if (column === "main") {
      setMainIds(next);
    } else {
      setSidebarIds(next);
    }
  };

  const handleDragStart = () => {
    isDraggingRef.current = true;
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) {
      return;
    }

    const activeIdStr = active.id as string;
    const overIdStr = over.id as string;

    const activeColumn = findColumn(activeIdStr);
    const overColumn = findColumn(overIdStr);

    if (!activeColumn || !overColumn || activeColumn === overColumn) {
      return;
    }

    // Move the active item from its column into the over column (live preview).
    const sourceArr = getColumnArray(activeColumn);
    const destArr = getColumnArray(overColumn);

    const activeIndex = sourceArr.indexOf(activeIdStr);
    if (activeIndex === -1) {
      return;
    }

    // Insert at the position of the over item; when hovering the empty column
    // droppable itself, append to the end.
    let insertIndex = destArr.indexOf(overIdStr);
    if (insertIndex === -1) {
      insertIndex = destArr.length;
    }

    const nextSource = sourceArr.filter((id) => id !== activeIdStr);
    const nextDest = [
      ...destArr.slice(0, insertIndex),
      activeIdStr,
      ...destArr.slice(insertIndex),
    ];

    setColumnArray(activeColumn, nextSource);
    setColumnArray(overColumn, nextDest);
  };

  const resetWorkingArrays = () => {
    setMainIds(mainModules);
    setSidebarIds(sidebarModules);
  };

  const handleDragCancel = () => {
    isDraggingRef.current = false;
    resetWorkingArrays();
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    const activeIdStr = active.id as string;

    // Snapshot working arrays — onDragOver has already moved items across
    // columns, so these reflect the in-flight cross-column layout.
    let finalMain = [...mainIds];
    let finalSidebar = [...sidebarIds];

    // Original layout (from source data) for change detection.
    const originalColumn = resolveColumn(activeIdStr);

    const clearDrag = () => {
      isDraggingRef.current = false;
    };

    if (!over) {
      clearDrag();
      resetWorkingArrays();
      return;
    }

    const overIdStr = over.id as string;
    const destColumn = finalMain.includes(activeIdStr) ? "main" : "sidebar";

    // Reorder within the destination column if dropping onto another item.
    const destArr = destColumn === "main" ? finalMain : finalSidebar;
    const oldIndex = destArr.indexOf(activeIdStr);
    const overIndex = destArr.indexOf(overIdStr);
    if (oldIndex !== -1 && overIndex !== -1 && oldIndex !== overIndex) {
      const reordered = arrayMove(destArr, oldIndex, overIndex);
      if (destColumn === "main") {
        finalMain = reordered;
      } else {
        finalSidebar = reordered;
      }
    }

    const columnChanged = destColumn !== originalColumn;

    // Detect order change against the source-derived partition.
    const orderChanged =
      finalMain.join("|") !== mainModules.join("|") ||
      finalSidebar.join("|") !== sidebarModules.join("|");

    if (!columnChanged && !orderChanged) {
      clearDrag();
      resetWorkingArrays();
      return;
    }

    // Optimistically reflect the final layout in the working arrays.
    setMainIds(finalMain);
    setSidebarIds(finalSidebar);

    // Splice the reordered visible modules back into the full moduleOrder so
    // hidden / private / feature-flagged-off modules keep their stored
    // positions (they are absent from finalMain/finalSidebar). Replacing only
    // the visible slots preserves each column's relative order.
    const reorderedVisible = [...finalMain, ...finalSidebar];
    const visibleSet = new Set(reorderedVisible);
    let visibleIndex = 0;
    const newOrder = moduleOrder.map((moduleName) =>
      visibleSet.has(moduleName)
        ? reorderedVisible[visibleIndex++]
        : moduleName,
    );

    try {
      // Sequence the mutations to avoid racing optimistic updates on the shared
      // `/api/projects/:id` SWR cache key, then revalidate once to reconcile.
      if (columnChanged) {
        const nextColumns: Record<string, ColumnId> = {
          ...moduleColumns,
          [activeIdStr]: destColumn,
        };
        await updateModuleColumns(nextColumns);
      }
      await updateModuleOrder(newOrder);
      await mutateProject();
      toast.success("Layout updated");
    } catch (error) {
      console.error("Failed to update module layout:", error);
      toast.error("Failed to update layout. Please try again.");
      // Revalidate to pull the canonical layout back after a failed mutation.
      await mutateProject();
    } finally {
      clearDrag();
    }
  };

  const handleToggleModule = async (moduleName: string) => {
    if (togglingModules.has(moduleName)) {
      return;
    }

    setTogglingModules((prev) => new Set([...prev, moduleName]));

    const displayName =
      MODULE_DISPLAY_NAMES[moduleName as ProjectModule] || moduleName;
    const wasHidden = isModuleHidden(moduleName);

    try {
      await toggleModuleVisibility(moduleName);
      toast.success(
        wasHidden
          ? `${displayName} section shown`
          : `${displayName} section hidden`,
      );
    } catch (error) {
      console.error(`Failed to toggle ${moduleName}:`, error);
      toast.error(
        `Failed to ${wasHidden ? "show" : "hide"} ${displayName} section. Please try again.`,
      );
    } finally {
      setTogglingModules((prev) => {
        const next = new Set(prev);
        next.delete(moduleName);
        return next;
      });
    }
  };

  const handleTogglePublicModule = async (moduleName: string) => {
    if (togglingPublicModules.has(moduleName)) {
      return;
    }

    setTogglingPublicModules((prev) => new Set([...prev, moduleName]));

    const displayName =
      MODULE_DISPLAY_NAMES[moduleName as ProjectModule] || moduleName;
    const wasPrivate = isModulePrivate(moduleName);

    try {
      await toggleModulePublicVisibility(moduleName);
      toast.success(
        wasPrivate
          ? `${displayName} section is now public`
          : `${displayName} section hidden from public`,
      );
    } catch (error) {
      console.error(
        `Failed to toggle public visibility for ${moduleName}:`,
        error,
      );
      toast.error(
        `Failed to update ${displayName} public visibility. Please try again.`,
      );
    } finally {
      setTogglingPublicModules((prev) => {
        const next = new Set(prev);
        next.delete(moduleName);
        return next;
      });
    }
  };

  const publicToggle = (moduleName: string) => () =>
    handleTogglePublicModule(moduleName);

  // Render module content based on module name
  const renderModuleContent = (
    moduleName: string,
    dragHandleProps: DragHandleProps,
  ) => {
    switch (moduleName) {
      case "map":
        return (
          <MapSection
            projectId={projectId}
            organizationSlug={organizationSlug}
            officeSlug={officeSlug}
            projectSlug={projectSlug}
            isHidden={isModuleHidden("map")}
            isToggling={togglingModules.has("map")}
            onToggleVisibility={() => handleToggleModule("map")}
            isPrivate={isModulePrivate("map")}
            isTogglingPublicVisibility={togglingPublicModules.has("map")}
            onTogglePublicVisibility={publicToggle("map")}
            dragHandleProps={dragHandleProps}
            readOnly={effectiveReadOnly}
          />
        );
      case "tasks":
        return (
          <TasksSection
            projectId={projectId}
            projectName={projectName}
            user={user}
            isHidden={isModuleHidden("tasks")}
            isToggling={togglingModules.has("tasks")}
            onToggleVisibility={() => handleToggleModule("tasks")}
            isPrivate={isModulePrivate("tasks")}
            isTogglingPublicVisibility={togglingPublicModules.has("tasks")}
            onTogglePublicVisibility={publicToggle("tasks")}
            dragHandleProps={dragHandleProps}
            readOnly={effectiveReadOnly}
          />
        );
      case "fields":
        return (
          <FieldsSection
            projectId={projectId}
            isHidden={isModuleHidden("fields")}
            isToggling={togglingModules.has("fields")}
            onToggleVisibility={() => handleToggleModule("fields")}
            isPrivate={isModulePrivate("fields")}
            isTogglingPublicVisibility={togglingPublicModules.has("fields")}
            onTogglePublicVisibility={publicToggle("fields")}
            dragHandleProps={dragHandleProps}
            readOnly={effectiveReadOnly}
          />
        );
      case "context":
        return (
          <ContextSection
            projectId={projectId}
            isHidden={isModuleHidden("context")}
            isToggling={togglingModules.has("context")}
            onToggleVisibility={() => handleToggleModule("context")}
            isPrivate={isModulePrivate("context")}
            isTogglingPublicVisibility={togglingPublicModules.has("context")}
            onTogglePublicVisibility={publicToggle("context")}
            dragHandleProps={dragHandleProps}
            readOnly={effectiveReadOnly}
          />
        );
      case "documents":
        return (
          <DocumentsSection
            projectId={projectId}
            userId={userId}
            isHidden={isModuleHidden("documents")}
            isToggling={togglingModules.has("documents")}
            onToggleVisibility={() => handleToggleModule("documents")}
            isPrivate={isModulePrivate("documents")}
            isTogglingPublicVisibility={togglingPublicModules.has("documents")}
            onTogglePublicVisibility={publicToggle("documents")}
            dragHandleProps={dragHandleProps}
            readOnly={effectiveReadOnly}
            isResearchPhaseCompleted={isResearchPhaseCompleted}
            chatBaseUrl={`/organizations/${organizationSlug}/offices/${officeSlug}/projects/${projectSlug}/chat/new`}
          />
        );
      case "timeline":
        return (
          <TimelineSection
            projectId={projectId}
            isHidden={isModuleHidden("timeline")}
            isToggling={togglingModules.has("timeline")}
            onToggleVisibility={() => handleToggleModule("timeline")}
            isPrivate={isModulePrivate("timeline")}
            isTogglingPublicVisibility={togglingPublicModules.has("timeline")}
            onTogglePublicVisibility={publicToggle("timeline")}
            dragHandleProps={dragHandleProps}
            readOnly={effectiveReadOnly}
          />
        );
      case "comments":
        return (
          <CommentsSection
            projectId={projectId}
            userId={userId}
            isHidden={isModuleHidden("comments")}
            isToggling={togglingModules.has("comments")}
            onToggleVisibility={() => handleToggleModule("comments")}
            isPrivate={isModulePrivate("comments")}
            isTogglingPublicVisibility={togglingPublicModules.has("comments")}
            onTogglePublicVisibility={publicToggle("comments")}
            dragHandleProps={dragHandleProps}
            readOnly={effectiveReadOnly}
          />
        );
      default:
        return null;
    }
  };

  const renderColumnItems = (ids: string[]) =>
    ids.map((moduleName) => (
      <SortableModule key={moduleName} id={moduleName}>
        {(dragHandleProps) => renderModuleContent(moduleName, dragHandleProps)}
      </SortableModule>
    ));

  // Show skeleton while loading initial data
  const isLoading =
    isVisibilityLoading || isPublicVisibilityLoading || isOrderLoading;
  if (isLoading) {
    return <ProjectModulesSkeleton />;
  }

  // Read-only / viewer mode: no dnd, no empty drop zones. Empty columns render
  // nothing at all.
  if (effectiveReadOnly) {
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {mainModules.length > 0 && (
          <div className="space-y-6">{renderColumnItems(mainModules)}</div>
        )}
        {sidebarModules.length > 0 && (
          <div className="space-y-6">{renderColumnItems(sidebarModules)}</div>
        )}
      </div>
    );
  }

  return (
    <>
      {/* Add Sections Bar - only shows when modules are hidden and not in readOnly mode */}
      <AddSectionsBar
        hiddenModules={hiddenModules}
        allModules={allAvailableModules}
        onToggle={handleToggleModule}
        isLoading={togglingModules.size > 0}
      />

      {/* Two-column multi-container dnd layout */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* Main column (wide) — rendered first so it stacks on top on narrow */}
          <DroppableColumn columnId="main" isEmpty={mainIds.length === 0}>
            <SortableContext
              items={mainIds}
              strategy={verticalListSortingStrategy}
            >
              {renderColumnItems(mainIds)}
            </SortableContext>
          </DroppableColumn>

          {/* Sidebar column (narrow) */}
          <DroppableColumn columnId="sidebar" isEmpty={sidebarIds.length === 0}>
            <SortableContext
              items={sidebarIds}
              strategy={verticalListSortingStrategy}
            >
              {renderColumnItems(sidebarIds)}
            </SortableContext>
          </DroppableColumn>
        </div>
      </DndContext>
    </>
  );
}
