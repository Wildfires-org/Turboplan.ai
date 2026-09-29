/**
 * Operations Executor
 *
 * Executes operations identified by AI analysis, converting AI-friendly
 * formats (emails, string dates) to database operations (IDs, Date objects).
 *
 * Responsibilities:
 * - Convert AI analysis results to database operations
 * - Handle email-to-ID conversion for assignees
 * - Execute operations in correct order (delete → update → create)
 * - Compute metadata (like task counts) server-side
 */
import type { Session } from "next-auth";

import type { AIAnalysisResult } from "../schemas/ai-interface";
import type { UserRepository } from "../server/repository";
import { MilestoneService, TaskService } from "../server/service";
import type {
  MilestoneCreateInput,
  MilestoneUpdateInput,
  MilestoneWithTasks,
  TaskCreateInput,
  TaskUpdateInput,
} from "../types";

/**
 * Assignee resolver - converts emails to user IDs
 */
export class AssigneeResolver {
  constructor(private userRepository: UserRepository) {}

  async resolveEmails(emails: string[]): Promise<string[]> {
    const userIds: string[] = [];
    for (const email of emails) {
      const user = await this.userRepository.findByEmail(
        email.toLowerCase().trim(),
      );
      if (user) {
        userIds.push(user.id);
        console.log(`Resolved assignee: ${email} → ${user.id}`);
      } else {
        console.warn(`User not found for email: ${email}`);
      }
    }
    return userIds;
  }
}

/**
 * Deletion executor - handles cascade deletion and metadata computation
 */
export class DeletionExecutor {
  constructor(
    private taskService: TaskService,
    private milestoneService: MilestoneService,
    private getCurrentMilestones: (
      documentId: string,
    ) => Promise<MilestoneWithTasks[]>,
  ) {}

  async executeDeletions(
    analysisResult: AIAnalysisResult,
    documentId: string,
  ): Promise<void> {
    // Delete tasks first to avoid conflicts
    for (const taskDeletion of analysisResult.taskDeletions) {
      console.log(`Deleting task ${taskDeletion.id}: "${taskDeletion.title}"`);
      const deleted = await this.taskService.deleteTask(taskDeletion.id);
      if (!deleted) {
        console.warn(`Failed to delete task ${taskDeletion.id}`);
      }
    }

    // Delete milestones (with cascade task deletion)
    for (const milestoneDeletion of analysisResult.milestoneDeletions) {
      // Compute task count server-side for better accuracy
      const currentMilestones = await this.getCurrentMilestones(documentId);
      const milestone = currentMilestones.find(
        (m) => m.id === milestoneDeletion.id,
      );
      const taskCount = milestone?.tasks?.length || 0;

      console.log(
        `Deleting milestone ${milestoneDeletion.id}: "${milestoneDeletion.title}" ` +
          `(${taskCount} tasks will be cascade deleted)`,
      );

      const deleted = await this.milestoneService.deleteMilestone(
        milestoneDeletion.id,
      );
      if (!deleted) {
        console.warn(`Failed to delete milestone ${milestoneDeletion.id}`);
      }
    }
  }
}

/**
 * CRUD executor - handles create and update operations
 */
export class CrudExecutor {
  constructor(
    private taskService: TaskService,
    private milestoneService: MilestoneService,
    private assigneeResolver: AssigneeResolver,
  ) {}

  async executeUpdates(
    analysisResult: AIAnalysisResult,
    session: Session,
  ): Promise<void> {
    // Update milestones
    for (const milestoneChange of analysisResult.milestoneChanges) {
      console.log(
        `Updating milestone ${milestoneChange.id}:`,
        milestoneChange.changes,
      );

      const updateData: MilestoneUpdateInput = {};
      const changes = milestoneChange.changes;

      // Map basic fields
      if (changes.title) updateData.title = changes.title;
      if (changes.status) updateData.status = changes.status;
      if (changes.order !== undefined) updateData.order = changes.order;
      if (changes.startDate) updateData.startDate = new Date(changes.startDate);
      if (changes.dueDate) updateData.dueDate = new Date(changes.dueDate);

      // Handle assignee conversion
      if (changes.assigneeEmails !== undefined) {
        const assigneeIds = await this.assigneeResolver.resolveEmails(
          changes.assigneeEmails,
        );
        updateData.assigneeIds = assigneeIds;
      }

      await this.milestoneService.updateMilestone(
        milestoneChange.id,
        updateData,
      );
    }

    // Update tasks
    for (const taskChange of analysisResult.taskChanges) {
      console.log(`Updating task ${taskChange.id}:`, taskChange.changes);

      const updateData: TaskUpdateInput = {};
      const changes = taskChange.changes;

      // Map basic fields
      if (changes.title) updateData.title = changes.title;
      if (changes.description) updateData.description = changes.description;
      if (changes.status) updateData.status = changes.status;
      if (changes.order !== undefined) updateData.order = changes.order;
      if (changes.dependencies) updateData.dependencies = changes.dependencies;
      if (changes.startDate) updateData.startDate = new Date(changes.startDate);
      if (changes.dueDate) updateData.dueDate = new Date(changes.dueDate);
      if (changes.milestoneId) updateData.milestoneId = changes.milestoneId;

      // Handle assignee conversion
      if (changes.assigneeEmails !== undefined) {
        const assigneeIds = await this.assigneeResolver.resolveEmails(
          changes.assigneeEmails,
        );
        updateData.assigneeIds = assigneeIds;
      }

      await this.taskService.updateTask(taskChange.id, updateData);
    }
  }

  async executeCreations(
    analysisResult: AIAnalysisResult,
    documentId: string,
    session: Session,
    projectId?: string,
  ): Promise<void> {
    // Create milestones
    for (const newMilestone of analysisResult.newMilestones) {
      console.log(`Creating milestone: ${newMilestone.title}`);

      const createData: MilestoneCreateInput = {
        title: newMilestone.title,
        status: newMilestone.status,
        order: newMilestone.order,
        startDate: newMilestone.startDate
          ? new Date(newMilestone.startDate)
          : new Date(),
        dueDate: newMilestone.dueDate
          ? new Date(newMilestone.dueDate)
          : new Date(),
        documentId,
        // Without it the milestone (and its tasks) resolve to no project.
        projectId,
        userId: session.user?.id ?? "",
      };

      // Handle assignee conversion or use default
      if (newMilestone.assigneeEmails !== undefined) {
        if (newMilestone.assigneeEmails.length > 0) {
          createData.assigneeIds = await this.assigneeResolver.resolveEmails(
            newMilestone.assigneeEmails,
          );
        } else {
          createData.assigneeIds = []; // Explicit empty
        }
      }
      // If undefined, let system use default (current user)

      await this.milestoneService.createMilestone(createData);
    }

    // Create tasks
    for (const newTask of analysisResult.newTasks) {
      console.log(`Creating task: ${newTask.title}`);

      const createData: TaskCreateInput = {
        title: newTask.title,
        description: newTask.description,
        status: newTask.status,
        order: newTask.order,
        dependencies: newTask.dependencies,
        startDate: newTask.startDate ? new Date(newTask.startDate) : new Date(),
        dueDate: newTask.dueDate ? new Date(newTask.dueDate) : new Date(),
        milestoneId: newTask.milestoneId ?? "",
        documentId,
        userId: session.user?.id ?? "",
      };

      // Handle assignee conversion or use default
      if (newTask.assigneeEmails !== undefined) {
        if (newTask.assigneeEmails.length > 0) {
          createData.assigneeIds = await this.assigneeResolver.resolveEmails(
            newTask.assigneeEmails,
          );
        } else {
          createData.assigneeIds = []; // Explicit empty
        }
      }
      // If undefined, let system use default (current user)

      await this.taskService.createTask(createData);
    }
  }
}

/**
 * Main Operations Executor - orchestrates all operations
 */
export class OperationsExecutor {
  private assigneeResolver: AssigneeResolver;
  private deletionExecutor: DeletionExecutor;
  private crudExecutor: CrudExecutor;

  constructor(
    private taskService: TaskService,
    private milestoneService: MilestoneService,
    userRepository: UserRepository,
    getCurrentMilestones: (documentId: string) => Promise<MilestoneWithTasks[]>,
  ) {
    this.assigneeResolver = new AssigneeResolver(userRepository);
    this.deletionExecutor = new DeletionExecutor(
      taskService,
      milestoneService,
      getCurrentMilestones,
    );
    this.crudExecutor = new CrudExecutor(
      taskService,
      milestoneService,
      this.assigneeResolver,
    );
  }

  async executeOperations(
    analysisResult: AIAnalysisResult,
    documentId: string,
    session: Session,
    projectId?: string,
  ): Promise<void> {
    console.log("Executing AI analysis result:", {
      milestoneChanges: analysisResult.milestoneChanges.length,
      taskChanges: analysisResult.taskChanges.length,
      newMilestones: analysisResult.newMilestones.length,
      newTasks: analysisResult.newTasks.length,
      milestoneDeletions: analysisResult.milestoneDeletions.length,
      taskDeletions: analysisResult.taskDeletions.length,
    });

    // Execute in proper order: delete → update → create
    await this.deletionExecutor.executeDeletions(analysisResult, documentId);
    await this.crudExecutor.executeUpdates(analysisResult, session);
    await this.crudExecutor.executeCreations(
      analysisResult,
      documentId,
      session,
      projectId,
    );

    console.log("All operations completed successfully");
  }
}
