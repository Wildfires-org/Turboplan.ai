import type { UIMessageStreamWriter } from "ai";
import { generateObject } from "ai";
import type { Session } from "next-auth";
import { z } from "zod";

import { getModel } from "@wildfires-org/turboplan-ai/server";
import {
  meterAiCall,
  resolveBillingOrgForProject,
  resolveBillingOrgForUser,
} from "@wildfires-org/turboplan-billing/server";
import { getProjectAssignableUsers } from "@wildfires-org/turboplan-db/queries";

import { taskCreationPrompt } from "../prompts";
import { aiMilestoneWithTasksSchema } from "../schemas";
import {
  DrizzleMilestoneRepository,
  DrizzleTaskRepository,
  DrizzleUserRepository,
} from "../server/repository";
import { MilestoneService, TaskService } from "../server/service";
import type { MilestoneWithTasks } from "../types";
import { AITaskAnalyzer } from "./ai-task-analyzer";
import { OperationsExecutor } from "./operations-executor";

// ============================================================================
// SERVICE INITIALIZATION
// ============================================================================

const userRepository = new DrizzleUserRepository();
const taskRepository = new DrizzleTaskRepository(userRepository);
const milestoneRepository = new DrizzleMilestoneRepository(userRepository);
const milestoneService = new MilestoneService(milestoneRepository);
milestoneService.setTaskRepository(taskRepository);
const taskService = new TaskService(
  taskRepository,
  milestoneRepository,
  milestoneService,
);

// ============================================================================
// DOCUMENT HANDLER INTERFACES
// ============================================================================

export interface SaveDocumentProps {
  id: string;
  title: string;
  kind: "tasks";
  content: string;
  userId: string;
}

export interface CreateDocumentCallbackProps {
  id: string;
  title: string;
  userContext?: string;
  writer: UIMessageStreamWriter;
  session: Session;
  projectId?: string;
}

export interface UpdateDocumentCallbackProps {
  document: {
    id: string;
  };
  description: string;
  writer: UIMessageStreamWriter;
  session: Session;
}

export interface TasksStreamData {
  type: "tasks-delta";
}

// ============================================================================
// MAIN DOCUMENT HANDLER
// ============================================================================

const operationsExecutor = new OperationsExecutor(
  taskService,
  milestoneService,
  userRepository,
  (documentId: string) => milestoneService.getMilestonesWithTasks(documentId),
);

export const taskDocumentHandler = {
  kind: "tasks" as const,

  /**
   * Create new task document - generates initial milestone and task structure
   */
  onCreateDocument: async ({
    id: documentId,
    title,
    userContext,
    writer,
    session,
    projectId,
  }: CreateDocumentCallbackProps) => {
    if (!session.user || !session.user.id) {
      throw new Error("User not authenticated");
    }

    // Use original user context if available, fall back to title
    const analysisPrompt = userContext || title;

    try {
      const model = await getModel("primary");

      // Get existing project tasks for context (if projectId is provided)
      let existingProjectTasks: MilestoneWithTasks[] = [];
      if (projectId) {
        existingProjectTasks =
          await milestoneService.getMilestonesByProjectId(projectId);
      }

      const milestonesSchema = z.object({
        milestones: z.array(aiMilestoneWithTasksSchema),
      });
      const milestones = await generateObject({
        model,
        prompt: taskCreationPrompt(analysisPrompt, existingProjectTasks),
        schema: milestonesSchema,
      });

      // Consume-only: this artifact runs inside an already-gated chat.
      const createBillingOrgId = projectId
        ? await resolveBillingOrgForProject(projectId)
        : await resolveBillingOrgForUser(session.user.id);
      await meterAiCall({
        billing: createBillingOrgId
          ? { organizationId: createBillingOrgId, userId: session.user.id }
          : null,
        source: "tasks",
        usage: milestones.usage,
        providerMetadata: milestones.providerMetadata,
        metadata: { tool: "tasksArtifactCreate" },
      });

      const parsed = milestones.object as z.infer<typeof milestonesSchema>;
      if (!parsed || !Array.isArray(parsed.milestones)) {
        const received = JSON.stringify(milestones.object).substring(0, 200);
        throw new Error(
          `AI generated invalid milestone structure. Expected object with milestones array, got: ${received}${milestones.object && JSON.stringify(milestones.object).length > 200 ? "..." : ""}`,
        );
      }

      const createdMilestones = [];
      for (const milestone of parsed.milestones) {
        const createdMilestone = await milestoneService.createMilestone({
          title: milestone.title,
          status: milestone.status,
          order: milestone.order,
          startDate: new Date(milestone.startDate),
          dueDate: new Date(milestone.dueDate),
          userId: session.user.id,
          documentId,
          projectId,
        });
        const createdTasks = [];
        for (const task of milestone.tasks) {
          const createdTask = await taskService.createTask({
            title: task.title || "Untitled Task",
            description: task.description,
            status: task.status,
            order: task.order,
            dependencies: task.dependencies,
            startDate: new Date(task.startDate),
            dueDate: new Date(task.dueDate),
            userId: session.user.id,
            milestoneId: createdMilestone.id,
            documentId,
          });
          createdTasks.push(createdTask);
        }
        createdMilestones.push({
          ...createdMilestone,
          tasks: createdTasks,
        });
      }

      writer.write({
        type: "data-artifact",
        data: { type: "tasks-delta" },
      });

      return JSON.stringify({
        milestones: createdMilestones,
      });
    } catch (error) {
      console.error("Error creating task:", error);
      throw error;
    }
  },

  /**
   * Update task document - uses AI analysis and modular execution
   */
  onUpdateDocument: async ({
    document,
    description,
    writer,
    session,
  }: UpdateDocumentCallbackProps) => {
    if (!session.user || !session.user.id) {
      throw new Error("User not authenticated");
    }

    try {
      const model = await getModel("primary");

      // Get current state
      const currentMilestones = await milestoneService.getMilestonesWithTasks(
        document.id,
      );

      if (!currentMilestones) {
        throw new Error("No milestones found for this document");
      }

      // Billing target: the milestones' project org, else the user's
      // personal org. Consume-only — the invoking chat ran the gate.
      const updateProjectId = currentMilestones[0]?.projectId ?? null;
      const updateBillingOrgId = updateProjectId
        ? await resolveBillingOrgForProject(updateProjectId)
        : await resolveBillingOrgForUser(session.user.id);
      const aiAnalyzer = new AITaskAnalyzer(
        model,
        updateBillingOrgId
          ? { organizationId: updateBillingOrgId, userId: session.user.id }
          : null,
      );

      // Assignee candidates for AI context: the project's people only, never
      // the whole user base (every email would otherwise land in the prompt).
      const availableUsers = updateProjectId
        ? (await getProjectAssignableUsers(updateProjectId)).map(
            ({ id, email }) => ({ id, email, emailVerified: null }),
          )
        : [];

      // Get ALL project tasks for deduplication context (if this document has a projectId)
      let allProjectTasks: MilestoneWithTasks[] = [];
      if (currentMilestones.length > 0 && currentMilestones[0].projectId) {
        const projectId = currentMilestones[0].projectId;
        allProjectTasks =
          await milestoneService.getMilestonesByProjectId(projectId);
      }

      // Use AI to analyze the update request
      const analysisResult = await aiAnalyzer.analyzeUpdateRequest(
        description,
        currentMilestones,
        availableUsers,
        allProjectTasks, // Pass project-wide tasks for deduplication
      );

      // Execute all operations using modular executor
      await operationsExecutor.executeOperations(
        analysisResult,
        document.id,
        session,
        updateProjectId ?? undefined,
      );

      // Get the updated structure to return
      const updatedMilestones = await milestoneService.getMilestonesWithTasks(
        document.id,
      );

      writer.write({
        type: "data-artifact",
        data: { type: "tasks-delta" },
      });

      return JSON.stringify({
        milestones: updatedMilestones || [],
      });
    } catch (error) {
      console.error("Error updating task:", error);
      throw error;
    }
  },
};
