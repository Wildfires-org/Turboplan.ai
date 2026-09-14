import { z } from "zod";

import { TaskStatus } from "../types";

/**
 * AI Interface Schemas
 *
 * Schemas for AI communication and analysis of task/milestone operations.
 * These schemas define the structure of AI analysis results.
 */

const assigneeChangeSchema = z.object({
  id: z.string().describe("ID of the item to update assignees for"),
  assigneeEmails: z
    .array(z.string().email())
    .describe("Array of email addresses to assign"),
});

const taskDeletionSchema = z.object({
  id: z.string().describe("ID of the task to delete"),
  title: z.string().describe("Title of the task being deleted"),
});

const milestoneDeletionSchema = z.object({
  id: z.string().describe("ID of the milestone to delete"),
  title: z.string().describe("Title of the milestone being deleted"),
});

const taskChangeSchema = z.object({
  id: z.string().describe("ID of the existing task to update"),
  changes: z
    .object({
      title: z.string().optional().describe("New title for the task"),
      description: z
        .string()
        .optional()
        .describe("New description for the task"),
      status: z
        .enum([
          TaskStatus.DRAFT,
          TaskStatus.NOT_STARTED,
          TaskStatus.IN_PROGRESS,
          TaskStatus.COMPLETED,
          TaskStatus.DELAYED,
        ])
        .optional()
        .describe("New status for the task"),
      startDate: z.string().optional().describe("New start date in ISO format"),
      dueDate: z.string().optional().describe("New due date in ISO format"),
      assigneeEmails: z
        .array(z.string().email())
        .optional()
        .describe("Array of email addresses to assign"),
      dependencies: z
        .array(z.string())
        .optional()
        .describe("Array of task IDs this task depends on"),
      order: z.number().optional().describe("New order position"),
      milestoneId: z
        .string()
        .optional()
        .describe("New milestone ID if moving task"),
    })
    .describe("Changes to apply to the task"),
});

const milestoneChangeSchema = z.object({
  id: z.string().describe("ID of the existing milestone to update"),
  changes: z
    .object({
      title: z.string().optional().describe("New title for the milestone"),
      status: z
        .enum([
          TaskStatus.DRAFT,
          TaskStatus.NOT_STARTED,
          TaskStatus.IN_PROGRESS,
          TaskStatus.COMPLETED,
          TaskStatus.DELAYED,
        ])
        .optional()
        .describe("New status for the milestone"),
      startDate: z.string().optional().describe("New start date in ISO format"),
      dueDate: z.string().optional().describe("New due date in ISO format"),
      assigneeEmails: z
        .array(z.string().email())
        .optional()
        .describe("Array of email addresses to assign"),
      order: z.number().optional().describe("New order position"),
    })
    .describe("Changes to apply to the milestone"),
});

const newTaskSchema = z.object({
  title: z.string().describe("Title for the new task"),
  description: z.string().optional().describe("Description for the new task"),
  milestoneId: z.string().describe("ID of the milestone this task belongs to"),
  status: z
    .enum([
      TaskStatus.DRAFT,
      TaskStatus.NOT_STARTED,
      TaskStatus.IN_PROGRESS,
      TaskStatus.COMPLETED,
      TaskStatus.DELAYED,
    ])
    .default(TaskStatus.DRAFT)
    .describe("Initial status for the task"),
  startDate: z.string().optional().describe("Start date in ISO format"),
  dueDate: z.string().optional().describe("Due date in ISO format"),
  assigneeEmails: z
    .array(z.string().email())
    .default([])
    .describe("Array of email addresses to assign"),
  dependencies: z
    .array(z.string())
    .default([])
    .describe("Array of task IDs this task depends on"),
  order: z.number().default(0).describe("Order position"),
});

const newMilestoneSchema = z.object({
  title: z.string().describe("Title for the new milestone"),
  status: z
    .enum([
      TaskStatus.DRAFT,
      TaskStatus.NOT_STARTED,
      TaskStatus.IN_PROGRESS,
      TaskStatus.COMPLETED,
      TaskStatus.DELAYED,
    ])
    .default(TaskStatus.DRAFT)
    .describe("Initial status for the milestone"),
  startDate: z.string().optional().describe("Start date in ISO format"),
  dueDate: z.string().optional().describe("Due date in ISO format"),
  assigneeEmails: z
    .array(z.string().email())
    .default([])
    .describe("Array of email addresses to assign"),
  order: z.number().default(0).describe("Order position"),
  tasks: z
    .array(newTaskSchema.omit({ milestoneId: true }))
    .default([])
    .describe("Tasks to create within this milestone"),
});

export const aiAnalysisResultSchema = z.object({
  explanation: z
    .string()
    .describe("Brief explanation of what changes will be made"),

  // Deletion operations (executed first)
  taskDeletions: z
    .array(taskDeletionSchema)
    .default([])
    .describe("Tasks to be deleted"),
  milestoneDeletions: z
    .array(milestoneDeletionSchema)
    .default([])
    .describe("Milestones to be deleted (cascades to tasks)"),

  // Update operations (executed second)
  taskChanges: z
    .array(taskChangeSchema)
    .default([])
    .describe("Existing tasks to be updated"),
  milestoneChanges: z
    .array(milestoneChangeSchema)
    .default([])
    .describe("Existing milestones to be updated"),

  // Create operations (executed last)
  newTasks: z
    .array(newTaskSchema)
    .default([])
    .describe("New tasks to be created"),
  newMilestones: z
    .array(newMilestoneSchema)
    .default([])
    .describe("New milestones to be created"),

  // Assignee operations (can be executed with updates)
  assigneeChanges: z
    .array(assigneeChangeSchema)
    .default([])
    .describe("Items that need assignee changes"),
});

// AI Generation schemas (accept string dates, no IDs required)
const aiTaskSchema = z.object({
  id: z
    .string()
    .optional()
    .describe("The unique identifier of the task (auto-generated)"),
  title: z.string().describe("The name or title of the task"),
  description: z
    .string()
    .optional()
    .describe("Optional detailed description of the task"),
  dependencies: z
    .array(z.string())
    .optional()
    .describe("Array of task IDs that this task depends on"),
  status: z
    .enum([
      TaskStatus.DRAFT,
      TaskStatus.NOT_STARTED,
      TaskStatus.IN_PROGRESS,
      TaskStatus.COMPLETED,
      TaskStatus.DELAYED,
    ])
    .describe("Current status of the task"),
  order: z
    .number()
    .describe(
      "Order position within the milestone for chronological sequencing (0-based, lower numbers come first)",
    ),
  startDate: z
    .string()
    .describe("Start date for the task in ISO string format"),
  dueDate: z.string().describe("Due date for the task in ISO string format"),
});

export const aiMilestoneWithTasksSchema = z.object({
  id: z
    .string()
    .optional()
    .describe("The unique identifier of the milestone (auto-generated)"),
  title: z.string().describe("The name or title of the milestone"),
  status: z
    .enum([
      TaskStatus.DRAFT,
      TaskStatus.NOT_STARTED,
      TaskStatus.IN_PROGRESS,
      TaskStatus.COMPLETED,
      TaskStatus.DELAYED,
    ])
    .describe("Current status of the milestone"),
  order: z
    .number()
    .describe(
      "Order position for chronological sequencing (0-based, lower numbers come first)",
    ),
  startDate: z
    .string()
    .describe("Start date for the milestone in ISO string format"),
  dueDate: z
    .string()
    .describe("Due date for the milestone in ISO string format"),
  tasks: z
    .array(aiTaskSchema)
    .describe("Array of tasks associated with this milestone"),
});

// Export types derived from schemas
export type AIAnalysisResult = z.infer<typeof aiAnalysisResultSchema>;
export type TaskDeletion = z.infer<typeof taskDeletionSchema>;
export type MilestoneDeletion = z.infer<typeof milestoneDeletionSchema>;
export type TaskChange = z.infer<typeof taskChangeSchema>;
export type MilestoneChange = z.infer<typeof milestoneChangeSchema>;
export type NewTask = z.infer<typeof newTaskSchema>;
export type NewMilestone = z.infer<typeof newMilestoneSchema>;
export type AssigneeChange = z.infer<typeof assigneeChangeSchema>;
export type AIMilestoneWithTasks = z.infer<typeof aiMilestoneWithTasksSchema>;
