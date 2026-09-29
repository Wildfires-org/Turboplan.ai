import React, { useCallback, useEffect, useMemo, useState } from "react";

import {
  Calendar,
  ChevronDown,
  ChevronUp,
  FileText,
  MoreVertical,
  Plus,
  X,
} from "lucide-react";

import { DocumentCardEditable } from "@wildfires-org/turboplan-documents/client";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  Textarea,
} from "@wildfires-org/turboplan-utils";

import type {
  ProjectDocumentInfo,
  Task,
  TaskUpdateInput,
  User,
} from "../types";
import { TaskStatus } from "../types";
import { AssigneeDisplay } from "./assignee-display";
import { getStatusTone } from "./status-chip";

// Form data type that includes assignees for UI state
interface TaskFormData {
  title: string;
  description?: string | null;
  status: TaskStatus;
  startDate?: Date;
  dueDate?: Date;
  assignees: User[];
}

interface TaskEditModalProps {
  task: Task | null;
  isOpen: boolean;
  isLoading?: boolean;
  isCreatingNew?: boolean;
  milestoneId?: string;
  timelineContent?: React.ReactNode;
  coverImageUrl?: string | null;
  projectPath?: string[];
  projectDocuments?: ProjectDocumentInfo[];
  /** Document IDs already linked to any task in the project (for filtering suggestions) */
  allLinkedDocumentIds?: string[];
  onUploadDocument?: (file: File) => Promise<ProjectDocumentInfo | undefined>;
  onTaskUpdate?: (updatedTask: Partial<Task>) => void;
  onOpenAssignmentDialog?: (
    context: { taskId?: string; taskTitle?: string },
    currentAssigneeIds: string[],
    onAssign: (userIds: string[]) => void,
  ) => void;
  onDeleteTask?: (taskId: string) => Promise<void>;
  readOnly?: boolean;
  onClose: () => void;
  onSave: (updatedTask: Partial<Task>) => void;
}

const statusLabels = {
  [TaskStatus.DRAFT]: "Draft",
  [TaskStatus.NOT_STARTED]: "Not Started",
  [TaskStatus.IN_PROGRESS]: "In Progress",
  [TaskStatus.COMPLETED]: "Completed",
  [TaskStatus.DELAYED]: "Delayed",
};

// Same tinted chips as the task table (contrast-safe at 12px).
const statusBadgeColors = {
  [TaskStatus.DRAFT]: `ring-1 ring-inset ${getStatusTone(TaskStatus.NOT_STARTED).className}`,
  [TaskStatus.NOT_STARTED]: `ring-1 ring-inset ${getStatusTone(TaskStatus.NOT_STARTED).className}`,
  [TaskStatus.IN_PROGRESS]: `ring-1 ring-inset ${getStatusTone(TaskStatus.IN_PROGRESS).className}`,
  [TaskStatus.COMPLETED]: `ring-1 ring-inset ${getStatusTone(TaskStatus.COMPLETED).className}`,
  [TaskStatus.DELAYED]: `ring-1 ring-inset ${getStatusTone(TaskStatus.DELAYED).className}`,
};

export const TaskEditModal: React.FC<TaskEditModalProps> = ({
  task,
  isOpen,
  isLoading = false,
  isCreatingNew = false,
  milestoneId,
  timelineContent,
  coverImageUrl,
  projectPath,
  projectDocuments = [],
  allLinkedDocumentIds = [],
  onUploadDocument,
  onTaskUpdate,
  onOpenAssignmentDialog,
  onDeleteTask,
  readOnly = false,
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState<TaskFormData>({
    title: task?.title || "",
    description: task?.description || null,
    status: task?.status || TaskStatus.DRAFT,
    startDate: task?.startDate,
    dueDate: task?.dueDate,
    assignees: task?.assignees || [],
  });

  const [documentsExpanded, setDocumentsExpanded] = useState(true);
  const [timelineExpanded, setTimelineExpanded] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Hidden date inputs refs
  const startDateRef = React.useRef<HTMLInputElement>(null);
  const dueDateRef = React.useRef<HTMLInputElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Compute linked vs unlinked documents
  const linkedDocumentIds = useMemo(
    () => task?.projectDocumentIds ?? [],
    [task?.projectDocumentIds],
  );

  const linkedDocuments = useMemo(
    () => projectDocuments.filter((doc) => linkedDocumentIds.includes(doc.id)),
    [projectDocuments, linkedDocumentIds],
  );

  const unlinkedDocuments = useMemo(
    () =>
      projectDocuments.filter(
        (doc) =>
          !linkedDocumentIds.includes(doc.id) &&
          !allLinkedDocumentIds.includes(doc.id),
      ),
    [projectDocuments, linkedDocumentIds, allLinkedDocumentIds],
  );

  // Save without closing — used for document operations and inline edits
  const saveWithoutClose = useCallback(
    (update: Partial<Task>) => {
      if (onTaskUpdate) {
        onTaskUpdate(update);
      } else {
        onSave(update);
      }
    },
    [onTaskUpdate, onSave],
  );

  // Document linking
  const handleLinkDocument = useCallback(
    (documentId: string) => {
      if (!task) {
        return;
      }
      const updatedIds = [...linkedDocumentIds, documentId];
      saveWithoutClose({ projectDocumentIds: updatedIds });
    },
    [task, linkedDocumentIds, saveWithoutClose],
  );

  const handleUnlinkDocument = useCallback(
    (documentId: string) => {
      if (!task) {
        return;
      }
      const updatedIds = linkedDocumentIds.filter((id) => id !== documentId);
      saveWithoutClose({ projectDocumentIds: updatedIds });
    },
    [task, linkedDocumentIds, saveWithoutClose],
  );

  // File upload + link (accumulates IDs locally to avoid stale closure across iterations)
  const handleFileUpload = useCallback(
    async (files: FileList | File[]) => {
      if (!onUploadDocument || !task || isUploading) {
        return;
      }
      setIsUploading(true);
      try {
        let currentIds = [...(task.projectDocumentIds ?? [])];
        for (const file of Array.from(files)) {
          const doc = await onUploadDocument(file);
          if (doc) {
            currentIds = [...currentIds, doc.id];
          }
        }
        if (currentIds.length !== (task.projectDocumentIds ?? []).length) {
          saveWithoutClose({
            projectDocumentIds: currentIds,
          });
        }
      } finally {
        setIsUploading(false);
      }
    },
    [onUploadDocument, task, isUploading, saveWithoutClose],
  );

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        handleFileUpload(e.dataTransfer.files);
      }
    },
    [handleFileUpload],
  );

  const handleBrowseClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFileUpload(e.target.files);
        // Reset input so same file can be selected again
        e.target.value = "";
      }
    },
    [handleFileUpload],
  );

  // Open assignment dialog for the current task
  const handleAddAssignee = useCallback(() => {
    if (!task || !onOpenAssignmentDialog) {
      return;
    }
    const currentAssigneeIds = (task.assignees || []).map((u) => u.id);
    onOpenAssignmentDialog(
      { taskId: task.id, taskTitle: task.title },
      currentAssigneeIds,
      (userIds: string[]) => {
        saveWithoutClose({ assigneeIds: userIds });
      },
    );
  }, [task, onOpenAssignmentDialog, saveWithoutClose]);

  // Delete task and close modal
  const handleDeleteTask = useCallback(async () => {
    if (!task || !onDeleteTask) {
      return;
    }
    await onDeleteTask(task.id);
    setShowDeleteConfirm(false);
    onClose();
  }, [task, onDeleteTask, onClose]);

  // Update form data when task changes or modal opens
  useEffect(() => {
    if (isOpen) {
      if (task) {
        setFormData({
          title: task.title,
          description: task.description || "",
          status: task.status,
          startDate: task.startDate,
          dueDate: task.dueDate,
          assignees: task.assignees || [],
        });
      } else if (isCreatingNew) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);

        const dayAfterTomorrow = new Date();
        dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
        dayAfterTomorrow.setHours(0, 0, 0, 0);

        setFormData({
          title: "",
          description: "",
          status: TaskStatus.DRAFT,
          startDate: tomorrow,
          dueDate: dayAfterTomorrow,
          assignees: [],
        });
      }
    }
  }, [task, isOpen, isCreatingNew]);

  const handleSaveDescription = () => {
    if (!formData.title.trim()) {
      return;
    }

    const taskUpdate: TaskUpdateInput = {
      title: formData.title,
      description: formData.description ?? undefined,
      status: formData.status,
      startDate: formData.startDate,
      dueDate: formData.dueDate,
      assigneeIds: formData.assignees?.map((user: User) => user.id) || [],
    };

    if (isCreatingNew && milestoneId) {
      taskUpdate.milestoneId = milestoneId;
    }

    if (isCreatingNew) {
      taskUpdate.status = taskUpdate.status || TaskStatus.DRAFT;
    }

    onSave(taskUpdate);
    // Only close on create — editing saves in place without closing
    if (isCreatingNew) {
      onClose();
    }
  };

  // Enter in the title field saves the task, mirroring the save button. The
  // description textarea deliberately keeps Enter as a newline.
  const handleTitleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) {
      return;
    }

    event.preventDefault();

    if (isLoading || readOnly) {
      return;
    }

    handleSaveDescription();
  };

  const handleStatusChange = (newStatus: TaskStatus) => {
    setFormData((prev) => ({ ...prev, status: newStatus }));
  };

  const handleDateChange = (field: "startDate" | "dueDate", value: string) => {
    const date = value ? new Date(value) : undefined;
    setFormData((prev) => ({ ...prev, [field]: date }));
  };

  const formatDateForInput = (date: Date | undefined) => {
    if (!date) {
      return "";
    }
    return new Date(date).toISOString().split("T")[0];
  };

  const breadcrumbText = projectPath?.join(" / ") || "";
  const currentStatus = formData.status || task?.status || TaskStatus.DRAFT;

  return (
    <>
      <AlertDialog
        open={isOpen}
        onOpenChange={(open) => {
          if (!open && !isUploading) {
            onClose();
          }
        }}
      >
        <AlertDialogContent className="max-w-[800px] gap-0 overflow-hidden rounded-[24px] p-0">
          {/* The visible title is an editable input; name the dialog for AT. */}
          <AlertDialogTitle className="sr-only">
            {formData.title || "Task"}
          </AlertDialogTitle>
          <AlertDialogDescription className="sr-only">
            Task details, documents and timeline
          </AlertDialogDescription>
          {/* Header with cover image */}
          <div className="relative h-20 w-full overflow-hidden bg-brandAlt-200">
            {coverImageUrl ? (
              <img
                src={coverImageUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="size-full bg-gradient-to-r from-brandAlt-300 to-brandAlt-200" />
            )}
            {/* Breadcrumb overlay */}
            {breadcrumbText && (
              <div className="absolute bottom-2 left-3">
                <span className="inline-flex items-center rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
                  {breadcrumbText}
                </span>
              </div>
            )}
            {/* Top-right controls */}
            <div className="absolute top-2 right-3 flex items-center gap-1.5">
              {!readOnly && onDeleteTask && task && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-full bg-black/40 text-white hover:bg-black/60 hover:text-white"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => setShowDeleteConfirm(true)}
                      className="text-error-700 focus:text-error-700"
                    >
                      Delete task
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-7 w-7 rounded-full bg-black/40 text-white hover:bg-black/60 hover:text-white"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Scrollable content area */}
          <div className="overflow-y-auto max-h-[calc(80vh-80px)]">
            {/* Main section */}
            <div className="px-6 pt-5 pb-4">
              {/* Title */}
              <Input
                value={formData.title}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, title: e.target.value }))
                }
                onKeyDown={handleTitleKeyDown}
                placeholder="Task title"
                disabled={isLoading || readOnly}
                className="text-2xl font-semibold border-none shadow-none p-0 h-auto focus-visible:ring-0"
                style={{ fontSize: "24px" }}
              />

              {/* Description label + Save button */}
              <div className="flex items-center justify-between mt-4 mb-2">
                <span className="text-sm text-gray-600">Task description</span>
                {!readOnly && (
                  <Button
                    size="sm"
                    variant="brand"
                    onClick={handleSaveDescription}
                    disabled={isLoading || !formData.title.trim()}
                    className="h-8 px-4 text-sm"
                  >
                    {isLoading
                      ? "Saving..."
                      : isCreatingNew
                        ? "Create Task"
                        : "Save"}
                  </Button>
                )}
              </div>

              {/* Description textarea */}
              <Textarea
                value={formData.description || ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value || null,
                  }))
                }
                placeholder="Add task description or context..."
                rows={3}
                disabled={isLoading || readOnly}
                className="resize-none rounded-xl text-sm"
              />

              {/* Metadata row */}
              <div className="flex items-center justify-between mt-4">
                {/* Left: assignee avatars + add button */}
                <div className="flex items-center gap-2">
                  <AssigneeDisplay
                    assignees={formData.assignees || []}
                    size="sm"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleAddAssignee}
                    disabled={!onOpenAssignmentDialog || !task}
                    aria-label="Assign members"
                    className="size-7 rounded-full border border-dashed border-brand-800/30 text-brand-800 hover:bg-brand-50 hover:text-brand-900"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {/* Right: status badge + date range badge */}
                <div className="flex items-center gap-2">
                  {/* Status badge */}
                  {readOnly ? (
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium",
                        statusBadgeColors[currentStatus],
                      )}
                    >
                      {statusLabels[currentStatus]}
                    </span>
                  ) : (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium cursor-pointer transition-opacity hover:opacity-80",
                            statusBadgeColors[currentStatus],
                          )}
                        >
                          {statusLabels[currentStatus]}
                          <ChevronDown className="h-3 w-3" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        {Object.values(TaskStatus).map((status) => (
                          <DropdownMenuItem
                            key={status}
                            onClick={() => handleStatusChange(status)}
                            className="p-2"
                          >
                            <span
                              className={cn(
                                "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                                statusBadgeColors[status],
                              )}
                            >
                              {statusLabels[status]}
                            </span>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}

                  {/* Date range badge */}
                  <div className="relative inline-flex items-center gap-0 rounded-full bg-slate-900/[0.04] px-3 py-1.5 text-xs font-medium tabular-nums text-gray-700 ring-1 ring-inset ring-slate-900/[0.08]">
                    <Calendar className="h-3 w-3 mr-1.5" />
                    <button
                      type="button"
                      disabled={readOnly}
                      onClick={() => startDateRef.current?.showPicker?.()}
                      className="hover:underline disabled:pointer-events-none"
                    >
                      {formData.startDate
                        ? new Date(formData.startDate).toLocaleDateString(
                            "en-US",
                            { month: "short", day: "numeric", year: "numeric" },
                          )
                        : "Start"}
                    </button>
                    <span className="mx-1">-</span>
                    <button
                      type="button"
                      disabled={readOnly}
                      onClick={() => dueDateRef.current?.showPicker?.()}
                      className="hover:underline disabled:pointer-events-none"
                    >
                      {formData.dueDate
                        ? new Date(formData.dueDate).toLocaleDateString(
                            "en-US",
                            {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            },
                          )
                        : "End"}
                    </button>
                    {/* Hidden date inputs */}
                    <input
                      ref={startDateRef}
                      type="date"
                      value={formatDateForInput(formData.startDate)}
                      onChange={(e) =>
                        handleDateChange("startDate", e.target.value)
                      }
                      className="absolute opacity-0 w-0 h-0 pointer-events-none"
                      tabIndex={-1}
                    />
                    <input
                      ref={dueDateRef}
                      type="date"
                      value={formatDateForInput(formData.dueDate)}
                      onChange={(e) =>
                        handleDateChange("dueDate", e.target.value)
                      }
                      className="absolute opacity-0 w-0 h-0 pointer-events-none"
                      tabIndex={-1}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-brandAlt-200/70" />

            {/* Documents Section (collapsible) */}
            {!isCreatingNew && (
              <>
                <div className="p-6">
                  <button
                    type="button"
                    onClick={() => setDocumentsExpanded((prev) => !prev)}
                    className="flex items-center gap-2 w-full text-left"
                  >
                    {documentsExpanded ? (
                      <ChevronUp className="h-5 w-5 text-gray-900" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-gray-900" />
                    )}
                    <span className="text-base font-semibold text-gray-900">
                      Documents
                    </span>
                  </button>

                  {documentsExpanded && (
                    <div className="mt-3 flex flex-col isolate pb-1.5">
                      {/* Linked documents */}
                      {linkedDocuments.length > 0 && (
                        <div className="relative z-[2] -mb-1.5 overflow-hidden rounded-xl border border-white/90 bg-brandAlt-100/70 p-4">
                          <div className="grid grid-cols-2 gap-4">
                            {linkedDocuments.map((doc) => (
                              <DocumentCardEditable
                                key={doc.id}
                                document={doc}
                                actions={
                                  !readOnly ? (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleUnlinkDocument(doc.id);
                                      }}
                                      aria-label="Remove from task"
                                      className="rounded-md p-1 text-gray-500 hover:bg-error-50 hover:text-error-700"
                                      title="Remove from task"
                                    >
                                      <X className="h-4 w-4" />
                                    </button>
                                  ) : undefined
                                }
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Suggested templates (unlinked project documents) */}
                      {!readOnly && unlinkedDocuments.length > 0 && (
                        <div className="relative z-[2] -mb-1.5 rounded-lg bg-[#F8F9F9] border border-[#EAEBEE] p-4 overflow-hidden">
                          <div className="flex items-center justify-between gap-3 mb-3">
                            <span className="text-sm font-medium text-[#0C0D0E]">
                              Suggested templates
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            {unlinkedDocuments.map((doc) => (
                              <DocumentCardEditable
                                key={doc.id}
                                document={doc}
                                onClick={() => handleLinkDocument(doc.id)}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Empty state: no documents at all */}
                      {linkedDocuments.length === 0 &&
                        unlinkedDocuments.length === 0 && (
                          <div className="flex flex-col items-center gap-2 py-6 text-center">
                            <FileText className="size-8 text-brand-800/40" />
                            <p className="text-sm text-gray-600">
                              No documents linked to this task.
                            </p>
                          </div>
                        )}

                      {/* Upload drop zone */}
                      {!readOnly && (
                        <div
                          onDragOver={handleDragOver}
                          onDragLeave={handleDragLeave}
                          onDrop={handleDrop}
                          className={cn(
                            "relative z-[1] flex h-[52px] items-center justify-center rounded-b-xl border-l border-r border-b border-dashed pt-1.5 transition-colors",
                            isDragging
                              ? "border-brand-700 bg-brand-50"
                              : "border-brand-800/25",
                          )}
                        >
                          {isUploading ? (
                            <span className="text-sm text-gray-600">
                              Uploading...
                            </span>
                          ) : (
                            <span className="text-sm text-gray-600">
                              or drag your files here,{" "}
                              <button
                                type="button"
                                onClick={handleBrowseClick}
                                className="rounded font-medium text-brand-800 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700"
                              >
                                browse
                              </button>
                            </span>
                          )}
                          <input
                            ref={fileInputRef}
                            type="file"
                            onChange={handleFileInputChange}
                            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                            multiple
                            className="hidden"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div className="border-t border-brandAlt-200/70" />
              </>
            )}

            {/* Timeline Section (collapsible) */}
            {!isCreatingNew && timelineContent && (
              <div className="p-6">
                <button
                  type="button"
                  onClick={() => setTimelineExpanded((prev) => !prev)}
                  className="flex items-center gap-2 w-full text-left"
                >
                  {timelineExpanded ? (
                    <ChevronUp className="h-5 w-5 text-gray-900" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-gray-900" />
                  )}
                  <span className="text-base font-semibold text-gray-900">
                    Timeline
                  </span>
                </button>

                {timelineExpanded && (
                  <div className="mt-3">{timelineContent}</div>
                )}
              </div>
            )}

            {/* Bottom padding */}
            <div className="h-4" />
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation dialog — sibling to avoid Radix nested dialog issues */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="max-w-sm">
          <div className="flex flex-col gap-4">
            <div>
              <AlertDialogTitle className="text-lg font-semibold">
                Delete task
              </AlertDialogTitle>
              <AlertDialogDescription className="mt-1 text-sm text-gray-600">
                Are you sure you want to delete this task? This action cannot be
                undone.
              </AlertDialogDescription>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="glass"
                size="sm"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteTask}
              >
                Delete
              </Button>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
