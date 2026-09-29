/**
 * Public Module Queries
 *
 * Database queries for fetching project module data (tasks, milestones)
 * without authentication.
 */

import { and, asc, desc, eq, inArray } from "drizzle-orm";

import {
  milestones,
  projectDocument,
  projectField,
  tasks,
} from "@wildfires-org/turboplan-db";
import { db } from "@wildfires-org/turboplan-db/db-client";

/**
 * Get milestones for a project.
 */
export async function getMilestonesByProjectId(projectId: string) {
  return db
    .select({
      id: milestones.id,
      title: milestones.title,
      startDate: milestones.startDate,
      dueDate: milestones.dueDate,
      status: milestones.status,
      order: milestones.order,
    })
    .from(milestones)
    .where(eq(milestones.projectId, projectId))
    .orderBy(asc(milestones.order));
}

/**
 * Get tasks for a list of milestone IDs.
 */
export async function getTasksByMilestoneIds(milestoneIds: string[]) {
  if (milestoneIds.length === 0) {
    return [];
  }

  return db
    .select({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      startDate: tasks.startDate,
      dueDate: tasks.dueDate,
      status: tasks.status,
      order: tasks.order,
      milestoneId: tasks.milestoneId,
    })
    .from(tasks)
    .where(inArray(tasks.milestoneId, milestoneIds))
    .orderBy(asc(tasks.order));
}

/**
 * Get milestones with their tasks for a project.
 */
export async function getMilestonesWithTasks(projectId: string) {
  const projectMilestones = await getMilestonesByProjectId(projectId);

  const milestoneIds = projectMilestones.map((m) => m.id);
  const projectTasks = await getTasksByMilestoneIds(milestoneIds);

  const tasksByMilestone = new Map<string, typeof projectTasks>();
  for (const task of projectTasks) {
    if (!tasksByMilestone.has(task.milestoneId)) {
      tasksByMilestone.set(task.milestoneId, []);
    }
    tasksByMilestone.get(task.milestoneId)!.push(task);
  }

  return projectMilestones.map((milestone) => ({
    ...milestone,
    tasks: tasksByMilestone.get(milestone.id) || [],
  }));
}

/**
 * Get fields for a project.
 */
export async function getFieldsByProjectId(projectId: string) {
  return db
    .select({
      id: projectField.id,
      name: projectField.name,
      type: projectField.type,
      isRequired: projectField.isRequired,
      tooltip: projectField.tooltip,
      order: projectField.order,
      values: projectField.values,
    })
    .from(projectField)
    .where(eq(projectField.projectId, projectId))
    .orderBy(asc(projectField.order));
}

/**
 * Get uploaded documents for a project (public view - no uploader info).
 * Research documents belong to the "context" module, which the public view does
 * not show, so they are excluded even when "documents" is public.
 */
export async function getDocumentsByProjectId(projectId: string) {
  return db
    .select({
      id: projectDocument.id,
      originalFilename: projectDocument.originalFilename,
      mimeType: projectDocument.mimeType,
      size: projectDocument.size,
      url: projectDocument.url,
      createdAt: projectDocument.createdAt,
    })
    .from(projectDocument)
    .where(
      and(
        eq(projectDocument.projectId, projectId),
        eq(projectDocument.source, "upload"),
      ),
    )
    .orderBy(desc(projectDocument.createdAt));
}
