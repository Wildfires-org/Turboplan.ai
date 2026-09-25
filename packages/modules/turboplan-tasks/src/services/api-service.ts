import { ApiClient } from "@wildfires-org/turboplan-api-client";

import type {
  DateChangedPayload,
  Milestone,
  MilestoneRestoreData,
  MilestoneWithTasks,
  Task,
  TaskRestoreData,
  User,
} from "../types";

// API response wrapper types
type WrappedMilestonesResponse = { milestones: MilestoneWithTasks[] };
type WrappedUsersResponse = { users: User[] };

const apiClient = new ApiClient();

/**
 * Secure API Service using @wildfires-org/turboplan-api-client for authenticated requests
 */
export const apiService = {
  // Fetch milestones and tasks for a document
  fetchMilestonesWithTasks: async (
    documentId: string,
  ): Promise<MilestoneWithTasks[]> => {
    if (!documentId?.trim()) {
      throw new Error("Document ID is required and cannot be empty");
    }

    const { data, error } = await apiClient.get<MilestoneWithTasks[]>(
      `/api/milestones/document/${documentId}/tasks`,
    );

    if (error) {
      throw new Error(`Failed to fetch data: ${error}`);
    }

    // Handle both direct array and wrapped object responses
    let milestones: MilestoneWithTasks[] = [];
    if (Array.isArray(data)) {
      milestones = data;
    } else if (
      data &&
      typeof data === "object" &&
      "milestones" in data &&
      Array.isArray((data as WrappedMilestonesResponse).milestones)
    ) {
      milestones = (data as WrappedMilestonesResponse).milestones;
    } else {
      milestones = [];
    }

    return milestones;
  },

  // Fetch milestones and tasks for a project
  fetchProjectMilestones: async (
    projectId: string,
  ): Promise<MilestoneWithTasks[]> => {
    if (!projectId?.trim()) {
      throw new Error("Project ID is required and cannot be empty");
    }

    const { data, error } = await apiClient.get<MilestoneWithTasks[]>(
      `/api/projects/${projectId}/milestones`,
    );

    if (error) {
      throw new Error(`Failed to fetch project milestones: ${error}`);
    }

    // Handle both direct array and wrapped object responses
    let milestones: MilestoneWithTasks[] = [];
    if (Array.isArray(data)) {
      milestones = data;
    } else if (
      data &&
      typeof data === "object" &&
      "milestones" in data &&
      Array.isArray((data as WrappedMilestonesResponse).milestones)
    ) {
      milestones = (data as WrappedMilestonesResponse).milestones;
    } else {
      milestones = [];
    }

    return milestones;
  },

  // Fetch the users this project's tasks/milestones can be assigned to
  fetchUsers: async (projectId: string) => {
    if (!projectId?.trim()) {
      throw new Error("Project ID is required and cannot be empty");
    }

    const { data, error } = await apiClient.get<
      Array<{
        id: string;
        email: string;
        emailVerified: Date | null;
      }>
    >(`/api/projects/${projectId}/assignable-users`);

    if (error) {
      throw new Error(`Failed to fetch users: ${error}`);
    }

    // Handle both direct array and wrapped object responses
    let users: User[] = [];
    if (Array.isArray(data)) {
      users = data;
    } else if (
      data &&
      typeof data === "object" &&
      "users" in data &&
      Array.isArray((data as WrappedUsersResponse).users)
    ) {
      users = (data as WrappedUsersResponse).users;
    } else {
      users = [];
    }

    return users;
  },

  // Task operations
  createTask: async (taskData: Partial<Task>) => {
    // Extract documentId from taskData for the URL
    const { documentId, ...taskPayload } = taskData;

    if (!documentId) {
      throw new Error("Document ID is required for task creation");
    }

    const { data, error } = await apiClient.post(
      `/api/tasks/document/${documentId}`,
      taskPayload,
    );

    if (error) {
      throw new Error(`Failed to create task: ${error}`);
    }

    return data;
  },

  // Special method for restore operations
  createTaskForRestore: async (taskData: TaskRestoreData) => {
    // Extract documentId from taskData for the URL
    const { documentId, ...taskPayload } = taskData;

    if (!documentId) {
      throw new Error("Document ID is required for task creation");
    }

    const { data, error } = await apiClient.post(
      `/api/tasks/document/${documentId}/restore`,
      taskPayload,
    );

    if (error) {
      throw new Error(`Failed to create task for restore: ${error}`);
    }

    return data;
  },

  updateTask: async (taskId: string, updatedTask: Partial<Task>) => {
    if (!taskId?.trim()) {
      throw new Error("Task ID is required and cannot be empty");
    }
    if (!updatedTask || typeof updatedTask !== "object") {
      throw new Error("Updated task data is required");
    }

    const { data, error } = await apiClient.put(
      `/api/tasks/${taskId}`,
      updatedTask,
    );

    if (error) {
      throw new Error(`Failed to update task: ${error}`);
    }

    return data;
  },

  markTaskAsNotStarted: async (taskId: string) => {
    const { data, error } = await apiClient.patch(
      `/api/tasks/${taskId}/not-started`,
    );

    if (error) {
      throw new Error(`Failed to mark task as not started: ${error}`);
    }

    return data;
  },

  deleteTask: async (taskId: string) => {
    const { data, error } = await apiClient.delete(`/api/tasks/${taskId}`);

    if (error) {
      throw new Error(`Failed to delete task: ${error}`);
    }

    return data;
  },

  // Milestone operations
  createMilestone: async (milestoneData: Partial<Milestone>) => {
    // Extract documentId from milestoneData for the URL
    const { documentId, ...milestonePayload } = milestoneData;

    if (!documentId) {
      throw new Error("Document ID is required for milestone creation");
    }

    const { data, error } = await apiClient.post(
      `/api/milestones/document/${documentId}`,
      milestonePayload,
    );

    if (error) {
      throw new Error(`Failed to create milestone: ${error}`);
    }

    return data;
  },

  // Special method for restore operations
  createMilestoneForRestore: async (milestoneData: MilestoneRestoreData) => {
    // Extract documentId from milestoneData for the URL
    const { documentId, ...milestonePayload } = milestoneData;

    if (!documentId) {
      throw new Error("Document ID is required for milestone creation");
    }

    const { data, error } = await apiClient.post(
      `/api/milestones/document/${documentId}/restore`,
      milestonePayload,
    );

    if (error) {
      throw new Error(`Failed to create milestone for restore: ${error}`);
    }

    return data;
  },

  updateMilestone: async (
    milestoneId: string,
    updatedMilestone: Partial<Milestone>,
  ) => {
    const { data, error } = await apiClient.put(
      `/api/milestones/${milestoneId}`,
      updatedMilestone,
    );

    if (error) {
      throw new Error(`Failed to update milestone: ${error}`);
    }

    return data;
  },

  deleteMilestone: async (milestoneId: string) => {
    const { data, error } = await apiClient.delete(
      `/api/milestones/${milestoneId}`,
    );

    if (error) {
      throw new Error(`Failed to delete milestone: ${error}`);
    }

    return data;
  },

  // Date operations
  updateItemDates: async (
    payload: DateChangedPayload,
    isMilestone: boolean,
  ) => {
    const updateData = {
      startDate: payload.start.toISOString(),
      dueDate: payload.end.toISOString(),
    };

    const endpoint = isMilestone
      ? `/api/milestones/${payload.id}`
      : `/api/tasks/${payload.id}`;

    const { data, error } = await apiClient.put(endpoint, updateData);

    if (error) {
      throw new Error(
        `Failed to update ${isMilestone ? "milestone" : "task"} dates: ${error}`,
      );
    }

    return data;
  },

  // Additional task operations that might be needed
  markTaskAsCompleted: async (taskId: string) => {
    const { data, error } = await apiClient.patch(
      `/api/tasks/${taskId}/complete`,
    );

    if (error) {
      throw new Error(`Failed to mark task as completed: ${error}`);
    }

    return data;
  },

  markTaskAsInProgress: async (taskId: string) => {
    const { data, error } = await apiClient.patch(
      `/api/tasks/${taskId}/in-progress`,
    );

    if (error) {
      throw new Error(`Failed to mark task as in progress: ${error}`);
    }

    return data;
  },

  markTaskAsDelayed: async (taskId: string) => {
    const { data, error } = await apiClient.patch(
      `/api/tasks/${taskId}/delayed`,
    );

    if (error) {
      throw new Error(`Failed to mark task as delayed: ${error}`);
    }

    return data;
  },

  moveTaskToMilestone: async (taskId: string, milestoneId: string) => {
    const { data, error } = await apiClient.patch(`/api/tasks/${taskId}/move`, {
      milestoneId,
    });

    if (error) {
      throw new Error(`Failed to move task to milestone: ${error}`);
    }

    return data;
  },

  // Additional milestone operations
  markMilestoneAsCompleted: async (milestoneId: string) => {
    const { data, error } = await apiClient.patch(
      `/api/milestones/${milestoneId}/complete`,
    );

    if (error) {
      throw new Error(`Failed to mark milestone as completed: ${error}`);
    }

    return data;
  },

  markMilestoneAsInProgress: async (milestoneId: string) => {
    const { data, error } = await apiClient.patch(
      `/api/milestones/${milestoneId}/in-progress`,
    );

    if (error) {
      throw new Error(`Failed to mark milestone as in progress: ${error}`);
    }

    return data;
  },

  markMilestoneAsDelayed: async (milestoneId: string) => {
    const { data, error } = await apiClient.patch(
      `/api/milestones/${milestoneId}/delayed`,
    );

    if (error) {
      throw new Error(`Failed to mark milestone as delayed: ${error}`);
    }

    return data;
  },

  // Utility methods for authentication
  clearAuthentication: () => {
    apiClient.clearToken();
  },

  // Get current authentication status
  isAuthenticated: async (): Promise<boolean> => {
    const token = await apiClient.getToken();
    return token !== null;
  },
};
