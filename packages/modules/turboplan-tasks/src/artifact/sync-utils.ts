import { apiService } from "../services/api-service";
import type {
  AssignableItem,
  MilestoneWithTasks,
  RawDocumentMilestone,
  RawDocumentTask,
  Task,
} from "../types";

/**
 * Helper function to extract assigneeIds from different document formats
 */
export const extractAssigneeIds = (item: AssignableItem): string[] => {
  // Prefer assigneeIds if available
  if (item.assigneeIds && Array.isArray(item.assigneeIds)) {
    return item.assigneeIds.filter(
      (id): id is string => typeof id === "string",
    );
  }
  // Fallback to extracting IDs from assignees objects
  if (item.assignees && Array.isArray(item.assignees)) {
    return item.assignees
      .map((assignee) => assignee.id)
      .filter((id): id is string => typeof id === "string");
  }
  return [];
};

/**
 * Verify that a milestone exists in the database with retry logic
 */
export const verifyMilestoneExists = async (
  milestoneId: string,
  documentId: string,
  maxRetries = 5,
): Promise<boolean> => {
  let milestoneVerified = false;
  let retries = 0;

  while (!milestoneVerified && retries < maxRetries) {
    try {
      const verifyMilestones =
        await apiService.fetchMilestonesWithTasks(documentId);
      milestoneVerified = verifyMilestones.some((m) => m.id === milestoneId);

      if (!milestoneVerified) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        retries++;
      }
    } catch (_error) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      retries++;
    }
  }

  return milestoneVerified;
};

/**
 * Sync database with document version content for restore operations
 */
export const syncDatabaseWithDocumentVersion = async (
  documentContent: string,
  documentId: string,
  initializeMilestones: (milestones: MilestoneWithTasks[]) => void,
  setLoading: (loading: boolean) => void,
  setError: (error: string | null) => void,
): Promise<void> => {
  if (!documentContent) return;

  try {
    const parsed = JSON.parse(documentContent);
    if (!parsed.milestones) return;

    setLoading(true);

    // 1. Get current database state
    const currentMilestones =
      await apiService.fetchMilestonesWithTasks(documentId);
    const documentMilestones = parsed.milestones;

    // 2. Compare and sync milestones
    const currentMilestoneIds = new Set(
      currentMilestones.map((m: MilestoneWithTasks) => m.id),
    );
    const documentMilestoneIds = new Set(
      documentMilestones.map((m: RawDocumentMilestone) => m.id),
    );

    // Delete milestones that exist in DB but not in document
    for (const currentMilestone of currentMilestones) {
      if (!documentMilestoneIds.has(currentMilestone.id)) {
        try {
          await apiService.deleteMilestone(currentMilestone.id);
        } catch (error) {
          console.error(
            `❌ Failed to delete milestone ${currentMilestone.id}:`,
            error,
          );
        }
      }
    }

    // Process each milestone from document
    for (const docMilestone of documentMilestones) {
      // First handle milestone creation/update
      if (!currentMilestoneIds.has(docMilestone.id)) {
        // Create new milestone
        try {
          await apiService.createMilestoneForRestore({
            id: docMilestone.id,
            title: docMilestone.title,
            status: docMilestone.status,
            startDate: new Date(docMilestone.startDate).toISOString(),
            dueDate: new Date(docMilestone.dueDate).toISOString(),
            order: docMilestone.order,
            assigneeIds: extractAssigneeIds(docMilestone),
            documentId,
          });

          // Verify milestone exists before proceeding with tasks
          const milestoneVerified = await verifyMilestoneExists(
            docMilestone.id,
            documentId,
          );

          if (!milestoneVerified) {
            console.error(
              `❌ Could not verify milestone ${docMilestone.id} after retries`,
            );
            continue;
          }
        } catch (error) {
          console.error(
            `❌ Failed to create milestone ${docMilestone.id}:`,
            error,
          );
          continue;
        }
      } else {
        // Update existing milestone
        try {
          await apiService.updateMilestone(docMilestone.id, {
            title: docMilestone.title,
            status: docMilestone.status,
            startDate: new Date(docMilestone.startDate),
            dueDate: new Date(docMilestone.dueDate),
            order: docMilestone.order,
            assigneeIds: extractAssigneeIds(docMilestone),
          });
        } catch (error) {
          console.error(
            `❌ Failed to update milestone ${docMilestone.id}:`,
            error,
          );
          continue;
        }
      }

      // 3. Sync tasks for this milestone
      const currentMilestone = currentMilestones.find(
        (m) => m.id === docMilestone.id,
      );
      const currentTasks = currentMilestone?.tasks || [];
      const documentTasks = docMilestone.tasks || [];

      const currentTaskIds = new Set(currentTasks.map((t: Task) => t.id));
      const documentTaskIds = new Set(
        documentTasks.map((t: RawDocumentTask) => t.id),
      );

      // Delete tasks that exist in DB but not in document
      for (const currentTask of currentTasks) {
        if (!documentTaskIds.has(currentTask.id)) {
          try {
            await apiService.deleteTask(currentTask.id);
          } catch (error) {
            console.error(`❌ Failed to delete task ${currentTask.id}:`, error);
          }
        }
      }

      // Process each task from document
      for (const docTask of documentTasks) {
        if (!currentTaskIds.has(docTask.id)) {
          // Create new task
          const taskData = {
            id: docTask.id,
            title: docTask.title,
            description: docTask.description,
            status: docTask.status,
            startDate: new Date(docTask.startDate).toISOString(),
            dueDate: new Date(docTask.dueDate).toISOString(),
            order: docTask.order,
            assigneeIds: extractAssigneeIds(docTask),
            dependencies: docTask.dependencies || [],
            milestoneId: docMilestone.id,
            documentId,
          };

          try {
            await apiService.createTaskForRestore(taskData);
          } catch (error) {
            console.error(`❌ Failed to create task ${docTask.id}:`, error);
            console.error("Full error details:", error);
          }
        } else {
          // Update existing task
          try {
            await apiService.updateTask(docTask.id, {
              title: docTask.title,
              description: docTask.description,
              status: docTask.status,
              startDate: new Date(docTask.startDate),
              dueDate: new Date(docTask.dueDate),
              order: docTask.order,
              assigneeIds: extractAssigneeIds(docTask),
              dependencies: docTask.dependencies || [],
              milestoneId: docMilestone.id,
            });
          } catch (error) {
            console.error(`Failed to update task ${docTask.id}:`, error);
          }
        }
      }
    }

    // 4. Refresh the UI with updated data
    const refreshedMilestones =
      await apiService.fetchMilestonesWithTasks(documentId);
    initializeMilestones(refreshedMilestones);
  } catch (error) {
    console.error("Failed to sync database with document version:", error);
    setError("Failed to load document version");
  } finally {
    setLoading(false);
  }
};
