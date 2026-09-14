/**
 * Milestone Operations Module
 * Contains all milestone-related CRUD operations with optimistic updates
 */

import type { Milestone, MilestoneWithTasks } from "../../types";
import { TaskStatus } from "../../types";
import type { ITaskDataService } from "../../types/service";

export interface MilestoneStoreActions {
  addMilestone: (milestone: MilestoneWithTasks) => void;
  updateMilestone: (milestoneId: string, updates: Partial<Milestone>) => void;
  removeMilestone: (milestoneId: string) => void;
  setError: (error: string) => void;
}

export interface MilestoneOperationsConfig {
  projectId: string;
  userId?: string;
  milestones: MilestoneWithTasks[];
  storeActions: MilestoneStoreActions;
  executeOptimistic: <T>(
    optimisticUpdate: () => void,
    apiOperation: () => Promise<T>,
    revertUpdate: () => void,
    operationName: string,
  ) => Promise<T>;
  taskService: ITaskDataService;
}

/**
 * Creates milestone operation handlers with optimistic updates
 */
export function createMilestoneOperations(config: MilestoneOperationsConfig) {
  const {
    projectId,
    milestones,
    storeActions,
    executeOptimistic,
    taskService,
  } = config;

  const { addMilestone, updateMilestone, removeMilestone, setError } =
    storeActions;

  // ===== MILESTONE CRUD OPERATIONS =====

  const createMilestone = async (milestoneData?: Partial<Milestone>) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date();
    dayAfter.setDate(dayAfter.getDate() + 2);

    const optimisticMilestone: MilestoneWithTasks = {
      id: `temp-milestone-${crypto.randomUUID()}`,
      title: milestoneData?.title || "New Milestone",
      status: milestoneData?.status || TaskStatus.NOT_STARTED,
      assigneeIds: milestoneData?.assigneeIds || [],
      startDate: milestoneData?.startDate || tomorrow,
      dueDate: milestoneData?.dueDate || dayAfter,
      order: milestoneData?.order || 0,
      documentId: projectId,
      projectId: null,
      userId: config.userId || "", // Backend should validate/populate from session
      createdAt: new Date(),
      updatedAt: new Date(),
      tasks: [],
    };

    await executeOptimistic(
      // Optimistic update
      () => addMilestone(optimisticMilestone),

      // API operation
      async () => {
        const milestoneCreateData = {
          ...milestoneData,
          documentId: projectId,
        };
        return await taskService.createMilestone(milestoneCreateData);
      },

      // Revert
      () => removeMilestone(optimisticMilestone.id),

      "createMilestone",
    );
  };

  const updateMilestoneById = async (
    milestoneId: string,
    updates: Partial<Milestone>,
  ) => {
    // Store original milestone for revert
    const originalMilestone = milestones.find((m) => m.id === milestoneId);
    if (!originalMilestone) {
      setError("Milestone not found");
      return;
    }

    const originalData = { ...originalMilestone };

    await executeOptimistic(
      // Optimistic update
      () => updateMilestone(milestoneId, updates),

      // API operation
      () => taskService.updateMilestone(milestoneId, updates),

      // Revert
      () => updateMilestone(milestoneId, originalData),

      "updateMilestone",
    );
  };

  const deleteMilestone = async (milestoneId: string) => {
    // Store original milestone for revert
    const originalMilestone = milestones.find((m) => m.id === milestoneId);
    if (!originalMilestone) {
      setError("Milestone not found");
      return;
    }

    await executeOptimistic(
      // Optimistic update
      () => removeMilestone(milestoneId),

      // API operation
      () => taskService.deleteMilestone(milestoneId),

      // Revert
      () => addMilestone(originalMilestone),

      "deleteMilestone",
    );
  };

  // ===== MILESTONE STATUS OPERATIONS =====

  const markMilestoneAsCompleted = async (milestoneId: string) => {
    await updateMilestoneById(milestoneId, { status: TaskStatus.COMPLETED });
  };

  const markMilestoneAsInProgress = async (milestoneId: string) => {
    await updateMilestoneById(milestoneId, { status: TaskStatus.IN_PROGRESS });
  };

  const markMilestoneAsDelayed = async (milestoneId: string) => {
    await updateMilestoneById(milestoneId, { status: TaskStatus.DELAYED });
  };

  return {
    createMilestone,
    updateMilestone: updateMilestoneById,
    deleteMilestone,
    markMilestoneAsCompleted,
    markMilestoneAsInProgress,
    markMilestoneAsDelayed,
  };
}
