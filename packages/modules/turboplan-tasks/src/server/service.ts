/**
 * Task Management Service
 * Contains business logic for handling milestones and tasks
 */
import {
  Milestone,
  MilestoneCreateInput,
  MilestoneRepository,
  MilestoneUpdateInput,
  MilestoneWithTasks,
  Task,
  TaskCreateInput,
  TaskRepository,
  TaskStatus,
  TaskUpdateInput,
} from "../types";
import { milestoneBelongsTo, projectIdOfMilestone } from "./milestone-project";

export class MilestoneService {
  constructor(private readonly milestoneRepository: MilestoneRepository) {}

  async getMilestoneById(id: string): Promise<Milestone | null> {
    return this.milestoneRepository.findById(id);
  }

  async getMilestonesWithTasks(
    documentId: string,
  ): Promise<MilestoneWithTasks[]> {
    return this.milestoneRepository.findAllWithTasks(documentId);
  }

  async getMilestonesByProjectId(
    projectId: string,
  ): Promise<MilestoneWithTasks[]> {
    return this.milestoneRepository.findByProjectId(projectId);
  }

  async getAllMilestones(documentId: string): Promise<Milestone[]> {
    return this.milestoneRepository.findAll(documentId);
  }

  async getMilestonesByStatus(
    documentId: string,
    status: TaskStatus,
  ): Promise<Milestone[]> {
    return this.milestoneRepository.findByStatus(documentId, status);
  }

  async createMilestone(data: MilestoneCreateInput): Promise<Milestone> {
    // Apply business logic/validation here
    const milestoneData: MilestoneCreateInput = {
      ...data,
      status: data.status || TaskStatus.NOT_STARTED,
    };

    // Validate date logic if both dates are provided
    if (milestoneData.startDate && milestoneData.dueDate) {
      if (milestoneData.startDate > milestoneData.dueDate) {
        throw new Error("Start date cannot be after due date");
      }
    }

    return this.milestoneRepository.create(milestoneData);
  }

  // Special method for restore operations
  async createMilestoneForRestore(
    data: MilestoneCreateInput & { id: string },
  ): Promise<Milestone> {
    // Apply same business logic but preserve ID
    const milestoneData = {
      ...data,
      status: data.status || TaskStatus.NOT_STARTED,
    };

    // Validate date logic if both dates are provided
    if (milestoneData.startDate && milestoneData.dueDate) {
      if (milestoneData.startDate > milestoneData.dueDate) {
        throw new Error("Start date cannot be after due date");
      }
    }

    return this.milestoneRepository.createForRestore(milestoneData);
  }

  async updateMilestone(
    id: string,
    data: MilestoneUpdateInput,
  ): Promise<Milestone | null> {
    const milestone = await this.milestoneRepository.findById(id);
    if (!milestone) {
      return null;
    }

    // Validate date logic if both dates are provided
    const startDate =
      data.startDate !== undefined ? data.startDate : milestone.startDate;
    const dueDate =
      data.dueDate !== undefined ? data.dueDate : milestone.dueDate;

    if (startDate && dueDate && startDate > dueDate) {
      throw new Error("Start date cannot be after due date");
    }

    return this.milestoneRepository.update(id, data);
  }

  async deleteMilestone(id: string): Promise<boolean> {
    const milestone = await this.milestoneRepository.findById(id);
    if (!milestone) {
      return false;
    }

    // Note: Tasks will be cascade deleted by the database constraint
    return this.milestoneRepository.delete(id);
  }

  async markMilestoneAsCompleted(id: string): Promise<Milestone | null> {
    return this.updateMilestone(id, { status: TaskStatus.COMPLETED });
  }

  async markMilestoneAsInProgress(id: string): Promise<Milestone | null> {
    return this.updateMilestone(id, { status: TaskStatus.IN_PROGRESS });
  }

  async markMilestoneAsDelayed(id: string): Promise<Milestone | null> {
    return this.updateMilestone(id, { status: TaskStatus.DELAYED });
  }

  /**
   * Calculate milestone status based on its tasks according to business rules:
   * - If all tasks are draft or any task is not_started -> milestone is not_started
   * - If any task is in_progress -> milestone is in_progress
   * - If all tasks are completed -> milestone is completed
   * - If tasks are completed but one is delayed -> milestone is in_progress
   */
  calculateMilestoneStatusFromTasks(tasks: Task[]): TaskStatus {
    if (tasks.length === 0) {
      return TaskStatus.NOT_STARTED;
    }

    const hasDelayed = tasks.some((task) => task.status === TaskStatus.DELAYED);
    const hasInProgress = tasks.some(
      (task) => task.status === TaskStatus.IN_PROGRESS,
    );
    const hasNotStarted = tasks.some(
      (task) => task.status === TaskStatus.NOT_STARTED,
    );
    const allCompleted = tasks.every(
      (task) => task.status === TaskStatus.COMPLETED,
    );
    const allDraftOrNotStarted = tasks.every(
      (task) =>
        task.status === TaskStatus.DRAFT ||
        task.status === TaskStatus.NOT_STARTED,
    );

    // If any task is in progress -> milestone is in progress
    if (hasInProgress) {
      return TaskStatus.IN_PROGRESS;
    }

    // If all completed but one delayed -> milestone is in progress
    if (
      hasDelayed &&
      tasks.filter((task) => task.status === TaskStatus.COMPLETED).length > 0
    ) {
      return TaskStatus.IN_PROGRESS;
    }

    // If all tasks are completed -> milestone is completed
    if (allCompleted) {
      return TaskStatus.COMPLETED;
    }

    // If all tasks are draft or any is not_started -> milestone is not_started
    if (allDraftOrNotStarted || hasNotStarted) {
      return TaskStatus.NOT_STARTED;
    }

    // Default fallback
    return TaskStatus.NOT_STARTED;
  }

  /**
   * Update milestone status based on its tasks
   */
  async updateMilestoneStatusFromTasks(
    milestoneId: string,
  ): Promise<Milestone | null> {
    const tasks = await this.taskRepository.findAllByMilestone(milestoneId);
    const newStatus = this.calculateMilestoneStatusFromTasks(tasks);

    return this.updateMilestone(milestoneId, { status: newStatus });
  }

  private taskRepository!: TaskRepository;

  setTaskRepository(taskRepository: TaskRepository) {
    this.taskRepository = taskRepository;
  }
}

export class TaskService {
  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly milestoneRepository: MilestoneRepository,
    private readonly milestoneService?: MilestoneService,
  ) {}

  /**
   * Load a milestone and assert it belongs to `projectId` — the project the
   * task is being created in or already lives in. A milestone from another
   * project is reported with the exact same error as a missing one so
   * cross-project existence is never leaked.
   *
   * `projectId` may also be the chat `Document` id a legacy artifact writes
   * tasks under; such milestones carry that id in `documentId`.
   */
  private async getMilestoneInProject(
    milestoneId: string,
    projectId: string,
  ): Promise<Milestone> {
    const milestone = await this.milestoneRepository.findById(milestoneId);
    if (!milestone || !milestoneBelongsTo(milestone, projectId)) {
      throw new Error(`Milestone with id ${milestoneId} not found`);
    }
    return milestone;
  }

  /**
   * The project an existing task belongs to: its milestone's project, falling
   * back to the task's own `documentId` (see `taskProjectId` in the db package).
   */
  private async getTaskProject(task: Task): Promise<string> {
    const milestone = await this.milestoneRepository.findById(task.milestoneId);
    return milestone ? projectIdOfMilestone(milestone) : task.documentId;
  }

  async getTaskById(id: string): Promise<Task | null> {
    return this.taskRepository.findById(id);
  }

  async getAllTasks(documentId: string): Promise<Task[]> {
    return this.taskRepository.findAll(documentId);
  }

  async getTasksByMilestone(milestoneId: string): Promise<Task[]> {
    return this.taskRepository.findAllByMilestone(milestoneId);
  }

  async getTasksByStatus(
    documentId: string,
    status: TaskStatus,
  ): Promise<Task[]> {
    return this.taskRepository.findByStatus(documentId, status);
  }

  async getTasksByMilestoneAndStatus(
    milestoneId: string,
    status: TaskStatus,
  ): Promise<Task[]> {
    return this.taskRepository.findByMilestoneAndStatus(milestoneId, status);
  }

  async createTask(data: TaskCreateInput): Promise<Task> {
    // Validate that the milestone exists and belongs to the same project
    await this.getMilestoneInProject(data.milestoneId, data.documentId);

    // Apply business logic/validation here
    const taskData: TaskCreateInput = {
      ...data,
      status: data.status || TaskStatus.DRAFT,
    };

    // Validate date logic if both dates are provided
    if (taskData.startDate && taskData.dueDate) {
      if (taskData.startDate > taskData.dueDate) {
        throw new Error("Start date cannot be after due date");
      }
    }

    const createdTask = await this.taskRepository.create(taskData);

    // Update milestone status based on its tasks
    await this.updateMilestoneStatusFromTasks(data.milestoneId);

    return createdTask;
  }

  // Special method for restore operations
  async createTaskForRestore(
    data: TaskCreateInput & { id: string },
  ): Promise<Task> {
    // Validate that the milestone exists and belongs to the same project
    await this.getMilestoneInProject(data.milestoneId, data.documentId);

    // Apply same business logic but preserve ID
    const taskData = {
      ...data,
      status: data.status || TaskStatus.DRAFT,
    };

    // Validate date logic if both dates are provided
    if (taskData.startDate && taskData.dueDate) {
      if (taskData.startDate > taskData.dueDate) {
        throw new Error("Start date cannot be after due date");
      }
    }

    const createdTask = await this.taskRepository.createForRestore(taskData);

    // Update milestone status based on its tasks
    await this.updateMilestoneStatusFromTasks(data.milestoneId);

    return createdTask;
  }

  async updateTask(id: string, data: TaskUpdateInput): Promise<Task | null> {
    const task = await this.taskRepository.findById(id);
    if (!task) {
      return null;
    }

    // If milestone is being changed, validate the new milestone exists and
    // belongs to the same project as the task (prevents cross-project linking)
    if (
      data.milestoneId !== undefined &&
      data.milestoneId !== task.milestoneId
    ) {
      await this.getMilestoneInProject(
        data.milestoneId,
        await this.getTaskProject(task),
      );
    }

    // Validate date logic
    const startDate =
      data.startDate !== undefined ? data.startDate : task.startDate;
    const dueDate = data.dueDate !== undefined ? data.dueDate : task.dueDate;

    if (startDate && dueDate && startDate > dueDate) {
      throw new Error("Start date cannot be after due date");
    }

    const updatedTask = await this.taskRepository.update(id, data);

    // Update milestone status if task status changed or milestone changed
    if (
      updatedTask &&
      (data.status !== undefined || data.milestoneId !== undefined)
    ) {
      await this.updateMilestoneStatusFromTasks(task.milestoneId); // old milestone
      if (
        data.milestoneId !== undefined &&
        data.milestoneId !== task.milestoneId
      ) {
        await this.updateMilestoneStatusFromTasks(data.milestoneId); // new milestone
      }
    }

    return updatedTask;
  }

  async deleteTask(id: string): Promise<boolean> {
    const task = await this.taskRepository.findById(id);
    if (!task) {
      return false;
    }

    const deleted = await this.taskRepository.delete(id);

    // Update milestone status after task deletion
    if (deleted) {
      await this.updateMilestoneStatusFromTasks(task.milestoneId);
    }

    return deleted;
  }

  async markTaskAsNotStarted(id: string): Promise<Task | null> {
    const result = await this.updateTask(id, {
      status: TaskStatus.NOT_STARTED,
    });
    return result;
  }

  async markTaskAsCompleted(id: string): Promise<Task | null> {
    const result = await this.updateTask(id, { status: TaskStatus.COMPLETED });
    return result;
  }

  async markTaskAsInProgress(id: string): Promise<Task | null> {
    const result = await this.updateTask(id, {
      status: TaskStatus.IN_PROGRESS,
    });
    return result;
  }

  async markTaskAsDelayed(id: string): Promise<Task | null> {
    const result = await this.updateTask(id, { status: TaskStatus.DELAYED });
    return result;
  }

  /**
   * Cross-project validation happens inside `updateTask`, which rejects a
   * milestone that belongs to a different project.
   */
  async moveTaskToMilestone(
    taskId: string,
    newMilestoneId: string,
  ): Promise<Task | null> {
    const result = await this.updateTask(taskId, {
      milestoneId: newMilestoneId,
    });

    // Update milestone status for both old and new milestones
    const task = await this.taskRepository.findById(taskId);
    if (task && result) {
      await this.updateMilestoneStatusFromTasks(task.milestoneId); // old milestone
      await this.updateMilestoneStatusFromTasks(newMilestoneId); // new milestone
    }

    return result;
  }

  /**
   * Helper method to update milestone status based on its tasks
   */
  private async updateMilestoneStatusFromTasks(
    milestoneId: string,
  ): Promise<void> {
    if (this.milestoneService) {
      await this.milestoneService.updateMilestoneStatusFromTasks(milestoneId);
    }
  }
}
