import { milestones } from "@wildfires-org/turboplan-db";
import { db } from "@wildfires-org/turboplan-db/db-client";

/**
 * Seed an empty milestone directly in the database, so a project's Tasks page
 * renders the Gantt table (with its "+ Add Task" row) without running the
 * AI-generated schedule. For milestones `documentId` is the project id.
 */
export const createTestMilestone = async (params: {
  projectId: string;
  userId: string;
  title: string;
}): Promise<{ id: string; title: string }> => {
  const { projectId, userId, title } = params;
  const startDate = new Date();
  const dueDate = new Date(startDate);
  dueDate.setDate(dueDate.getDate() + 14);

  const [milestone] = await db
    .insert(milestones)
    .values({
      title,
      startDate,
      dueDate,
      documentId: projectId,
      projectId,
      userId,
    })
    .returning({ id: milestones.id, title: milestones.title });

  return milestone;
};
