/**
 * Drizzle implementation of MilestoneRepository and TaskRepository
 * This provides database access using Drizzle ORM
 */
import { and, asc, eq, inArray, sql } from "drizzle-orm";

import type { Milestone, Task, User } from "@wildfires-org/turboplan-db";
import {
  milestones,
  tasks as tasksSchema,
  user,
} from "@wildfires-org/turboplan-db";
import { db } from "@wildfires-org/turboplan-db/db-client";
import {
  milestoneInProject,
  taskInProject,
} from "@wildfires-org/turboplan-db/queries";

import {
  MilestoneCreateInput,
  MilestoneRepository,
  MilestoneUpdateInput,
  MilestoneWithTasks,
  TaskCreateInput,
  TaskRepository,
  TaskStatus,
  TaskUpdateInput,
} from "../types";

/**
 * User repository interface - READ-ONLY for task/milestone context
 * Only allows reading users for assignee resolution. There is deliberately no
 * "list every user" method: pickers use the project-scoped
 * `getProjectAssignableUsers` instead.
 */
export interface UserRepository {
  findByIds(ids: string[]): Promise<User[]>;
  findByEmail(email: string): Promise<User | null>;
}

export class DrizzleUserRepository implements UserRepository {
  async findByIds(ids: string[]): Promise<User[]> {
    if (ids.length === 0) return [];

    const results = await db
      .select({
        id: user.id,
        email: user.email,
      })
      .from(user)
      .where(inArray(user.id, ids));

    return results.map((r) => ({
      id: r.id,
      email: r.email,
      emailVerified: null,
    }));
  }

  async findByEmail(email: string): Promise<User | null> {
    const results = await db
      .select({
        id: user.id,
        email: user.email,
      })
      .from(user)
      .where(eq(user.email, email))
      .limit(1);
    return results.length > 0
      ? { id: results[0].id, email: results[0].email, emailVerified: null }
      : null;
  }

  // NOTE: No mapping methods needed - queries now select only safe fields
}

export class DrizzleMilestoneRepository implements MilestoneRepository {
  constructor(private readonly userRepository?: UserRepository) {}
  async findAll(documentId: string): Promise<Milestone[]> {
    const results = await db
      .select()
      .from(milestones)
      .where(milestoneInProject(documentId))
      .orderBy(
        asc(milestones.order),
        asc(milestones.createdAt),
        asc(milestones.id),
      );
    return results.map(this.mapToDomainEntity);
  }

  async findAllWithTasks(documentId: string): Promise<MilestoneWithTasks[]> {
    const results = await db
      .select()
      .from(milestones)
      .where(milestoneInProject(documentId))
      .orderBy(
        asc(milestones.order),
        asc(milestones.createdAt),
        asc(milestones.id),
      );

    if (results.length === 0) {
      return [];
    }

    return this.buildMilestonesWithTasks(results);
  }

  async findByProjectId(projectId: string): Promise<MilestoneWithTasks[]> {
    const results = await db
      .select()
      .from(milestones)
      .where(milestoneInProject(projectId))
      .orderBy(
        asc(milestones.order),
        asc(milestones.createdAt),
        asc(milestones.id),
      );

    if (results.length === 0) {
      return [];
    }

    return this.buildMilestonesWithTasks(results);
  }

  async findByStatus(
    documentId: string,
    status: TaskStatus,
  ): Promise<Milestone[]> {
    const results = await db
      .select()
      .from(milestones)
      .where(and(milestoneInProject(documentId), eq(milestones.status, status)))
      .orderBy(asc(milestones.createdAt), asc(milestones.id));
    return results.map(this.mapToDomainEntity);
  }

  async findById(id: string): Promise<Milestone | null> {
    const results = await db
      .select()
      .from(milestones)
      .where(eq(milestones.id, id))
      .limit(1);
    return results.length > 0 ? this.mapToDomainEntity(results[0]) : null;
  }

  async create(data: MilestoneCreateInput): Promise<Milestone> {
    // Always calculate order server-side for new milestones - ignore any client-provided order
    let order: number;

    // Use COUNT to get the next order number within the document
    const countResult = await db
      .select({ count: sql`COUNT(*)`.as("count") })
      .from(milestones)
      .where(milestoneInProject(data.projectId ?? data.documentId));

    const existingMilestoneCount = Number(countResult[0]?.count || 0);
    order = existingMilestoneCount + 1; // Next order number

    console.log("MilestoneRepository.create - Milestone count in document:", {
      documentId: data.documentId,
      existingMilestoneCount,
      newOrder: order,
    });

    const insertData = {
      title: data.title,
      assigneeIds: data.assigneeIds || [data.userId], // Default to creator
      startDate: data.startDate,
      dueDate: data.dueDate,
      status: data.status || TaskStatus.DRAFT,
      order: order,
      documentId: data.documentId,
      projectId: data.projectId,
      userId: data.userId,
    };

    const result = await db.insert(milestones).values(insertData).returning();

    return this.mapToDomainEntity(result[0]);
  }

  // Special method for restore operations that preserves original IDs
  async createForRestore(
    data: MilestoneCreateInput & { id: string },
  ): Promise<Milestone> {
    const insertData = {
      id: data.id, // Use provided ID for restore
      title: data.title,
      assigneeIds: data.assigneeIds || [data.userId],
      startDate: data.startDate,
      dueDate: data.dueDate,
      status: data.status || TaskStatus.DRAFT,
      order: data.order || 0,
      documentId: data.documentId,
      projectId: data.projectId,
      userId: data.userId,
    };

    const result = await db.insert(milestones).values(insertData).returning();

    return this.mapToDomainEntity(result[0]);
  }

  async update(
    id: string,
    data: MilestoneUpdateInput,
  ): Promise<Milestone | null> {
    const updateData: MilestoneUpdateInput & { updatedAt: Date } = {
      updatedAt: new Date(),
    };

    if (data.title !== undefined) updateData.title = data.title;
    if (data.assigneeIds !== undefined)
      updateData.assigneeIds = data.assigneeIds;
    if (data.startDate !== undefined) updateData.startDate = data.startDate;
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.order !== undefined) updateData.order = data.order;

    const result = await db
      .update(milestones)
      .set(updateData)
      .where(eq(milestones.id, id))
      .returning();

    return result.length > 0 ? this.mapToDomainEntity(result[0]) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await db
      .delete(milestones)
      .where(eq(milestones.id, id))
      .returning({ id: milestones.id });

    return result.length > 0;
  }

  private async buildMilestonesWithTasks(
    results: Milestone[],
  ): Promise<MilestoneWithTasks[]> {
    const milestoneIds = results.map((m) => m.id);

    // Batch-fetch all tasks for all milestones in one query
    const allTasks = await db
      .select()
      .from(tasksSchema)
      .where(inArray(tasksSchema.milestoneId, milestoneIds))
      .orderBy(
        asc(tasksSchema.order),
        asc(tasksSchema.createdAt),
        asc(tasksSchema.id),
      );

    // Batch-fetch all assignees if userRepository available
    let assigneesMap = new Map<string, User[]>();
    if (this.userRepository) {
      const allAssigneeIds = new Set<string>();
      for (const m of results) {
        for (const id of m.assigneeIds || []) {
          allAssigneeIds.add(id);
        }
      }
      for (const t of allTasks) {
        for (const id of t.assigneeIds || []) {
          allAssigneeIds.add(id);
        }
      }

      if (allAssigneeIds.size > 0) {
        const allUsers = await this.userRepository.findByIds(
          Array.from(allAssigneeIds),
        );
        const usersById = new Map(allUsers.map((u) => [u.id, u]));

        // Build assignees for each entity by their assigneeIds
        const resolveAssignees = (ids: string[]): User[] =>
          ids.map((id) => usersById.get(id)).filter(Boolean) as User[];

        for (const m of results) {
          assigneesMap.set(m.id, resolveAssignees(m.assigneeIds || []));
        }
        for (const t of allTasks) {
          assigneesMap.set(t.id, resolveAssignees(t.assigneeIds || []));
        }
      }
    }

    // Group tasks by milestoneId
    const tasksByMilestone = new Map<string, Task[]>();
    for (const task of allTasks) {
      const mapped = this.mapTaskToDomainEntity(task);
      const withAssignees = assigneesMap.has(task.id)
        ? ({ ...mapped, assignees: assigneesMap.get(task.id) } as Task)
        : mapped;

      const existing = tasksByMilestone.get(task.milestoneId) ?? [];
      existing.push(withAssignees);
      tasksByMilestone.set(task.milestoneId, existing);
    }

    return results.map((milestone) => {
      const baseMilestone = this.mapToDomainEntity(milestone);
      const milestoneWithAssignees = assigneesMap.has(milestone.id)
        ? ({
            ...baseMilestone,
            assignees: assigneesMap.get(milestone.id),
          } as Milestone)
        : baseMilestone;

      return {
        ...milestoneWithAssignees,
        tasks: tasksByMilestone.get(milestone.id) ?? [],
      };
    });
  }

  private mapToDomainEntity(dbEntity: Milestone): Milestone {
    return {
      id: dbEntity.id,
      title: dbEntity.title,
      assigneeIds: dbEntity.assigneeIds || [],
      startDate: dbEntity.startDate,
      dueDate: dbEntity.dueDate,
      status: dbEntity.status as TaskStatus,
      order: dbEntity.order,
      documentId: dbEntity.documentId,
      projectId: dbEntity.projectId,
      userId: dbEntity.userId,
      createdAt: dbEntity.createdAt,
      updatedAt: dbEntity.updatedAt,
    };
  }

  private async mapToDomainEntityWithAssignees(
    dbEntity: Milestone,
  ): Promise<Milestone> {
    const assignees = await this.getAssignees(dbEntity.assigneeIds || []);
    const baseMilestone = this.mapToDomainEntity(dbEntity);
    return {
      ...baseMilestone,
      assignees,
    } as Milestone;
  }

  private async getAssignees(assigneeIds: string[]): Promise<User[]> {
    if (assigneeIds.length === 0 || !this.userRepository) return [];

    return await this.userRepository.findByIds(assigneeIds);
  }

  private mapTaskToDomainEntity(dbEntity: Task): Task {
    return {
      id: dbEntity.id,
      title: dbEntity.title,
      description: dbEntity.description,
      assigneeIds: dbEntity.assigneeIds || [],
      dependencies: dbEntity.dependencies || [],
      projectDocumentIds: dbEntity.projectDocumentIds || [],
      startDate: dbEntity.startDate,
      dueDate: dbEntity.dueDate,
      status: dbEntity.status as TaskStatus,
      order: dbEntity.order,
      milestoneId: dbEntity.milestoneId,
      documentId: dbEntity.documentId,
      userId: dbEntity.userId,
      createdAt: dbEntity.createdAt,
      updatedAt: dbEntity.updatedAt,
    };
  }
}

export class DrizzleTaskRepository implements TaskRepository {
  constructor(private readonly userRepository?: UserRepository) {}
  async findAll(documentId: string): Promise<Task[]> {
    const results = await db
      .select()
      .from(tasksSchema)
      .where(taskInProject(documentId))
      .orderBy(
        asc(tasksSchema.order),
        asc(tasksSchema.createdAt),
        asc(tasksSchema.id),
      );
    return results.map(this.mapToDomainEntity);
  }

  async findAllByMilestone(milestoneId: string): Promise<Task[]> {
    const results = await db
      .select()
      .from(tasksSchema)
      .where(eq(tasksSchema.milestoneId, milestoneId))
      .orderBy(
        asc(tasksSchema.order),
        asc(tasksSchema.createdAt),
        asc(tasksSchema.id),
      );
    return results.map(this.mapToDomainEntity);
  }

  async findByStatus(documentId: string, status: TaskStatus): Promise<Task[]> {
    const results = await db
      .select()
      .from(tasksSchema)
      .where(and(taskInProject(documentId), eq(tasksSchema.status, status)))
      .orderBy(
        asc(tasksSchema.order),
        asc(tasksSchema.createdAt),
        asc(tasksSchema.id),
      );
    return results.map(this.mapToDomainEntity);
  }

  async findByMilestoneAndStatus(
    milestoneId: string,
    status: TaskStatus,
  ): Promise<Task[]> {
    const results = await db
      .select()
      .from(tasksSchema)
      .where(
        and(
          eq(tasksSchema.milestoneId, milestoneId),
          eq(tasksSchema.status, status),
        ),
      )
      .orderBy(
        asc(tasksSchema.order),
        asc(tasksSchema.createdAt),
        asc(tasksSchema.id),
      );
    return results.map(this.mapToDomainEntity);
  }

  async findById(id: string): Promise<Task | null> {
    const results = await db
      .select()
      .from(tasksSchema)
      .where(eq(tasksSchema.id, id))
      .limit(1);
    return results.length > 0 ? this.mapToDomainEntity(results[0]) : null;
  }

  async create(data: TaskCreateInput): Promise<Task> {
    // Always calculate order server-side for new tasks - ignore any client-provided order
    let order: number;

    if (data.milestoneId) {
      // Use COUNT to get the next order number within the specific milestone
      const countResult = await db
        .select({ count: sql`COUNT(*)`.as("count") })
        .from(tasksSchema)
        .where(eq(tasksSchema.milestoneId, data.milestoneId));

      const existingTaskCount = Number(countResult[0]?.count || 0);
      order = existingTaskCount + 1; // Next order number
    } else {
      // Use COUNT to get the next order number within the document
      const countResult = await db
        .select({ count: sql`COUNT(*)`.as("count") })
        .from(tasksSchema)
        .where(eq(tasksSchema.documentId, data.documentId));

      const existingTaskCount = Number(countResult[0]?.count || 0);
      order = existingTaskCount + 1; // Next order number
    }

    const insertData = {
      title: data.title,
      description: data.description,
      assigneeIds: data.assigneeIds || [data.userId], // Default to creator
      dependencies: data.dependencies || [],
      projectDocumentIds: data.projectDocumentIds || [],
      startDate: data.startDate,
      dueDate: data.dueDate,
      status: data.status || TaskStatus.DRAFT,
      order: order,
      milestoneId: data.milestoneId,
      documentId: data.documentId,
      userId: data.userId,
    };

    const result = await db.insert(tasksSchema).values(insertData).returning();

    return this.mapToDomainEntity(result[0]);
  }

  // Special method for restore operations that preserves original IDs
  async createForRestore(
    data: TaskCreateInput & { id: string },
  ): Promise<Task> {
    const insertData = {
      id: data.id, // Use provided ID for restore
      title: data.title,
      description: data.description,
      assigneeIds: data.assigneeIds || [data.userId],
      dependencies: data.dependencies || [],
      projectDocumentIds: data.projectDocumentIds || [],
      startDate: data.startDate,
      dueDate: data.dueDate,
      status: data.status || TaskStatus.DRAFT,
      order: data.order || 0,
      milestoneId: data.milestoneId,
      documentId: data.documentId,
      userId: data.userId,
    };

    const result = await db.insert(tasksSchema).values(insertData).returning();

    return this.mapToDomainEntity(result[0]);
  }

  async update(id: string, data: TaskUpdateInput): Promise<Task | null> {
    const updateData: TaskUpdateInput & { updatedAt: Date } = {
      updatedAt: new Date(),
    };

    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined)
      updateData.description = data.description;
    if (data.assigneeIds !== undefined)
      updateData.assigneeIds = data.assigneeIds;
    if (data.dependencies !== undefined)
      updateData.dependencies = data.dependencies;
    if (data.projectDocumentIds !== undefined)
      updateData.projectDocumentIds = data.projectDocumentIds;
    if (data.startDate !== undefined) updateData.startDate = data.startDate;
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.order !== undefined) updateData.order = data.order;
    if (data.milestoneId !== undefined)
      updateData.milestoneId = data.milestoneId;

    const result = await db
      .update(tasksSchema)
      .set(updateData)
      .where(eq(tasksSchema.id, id))
      .returning();

    return result.length > 0 ? this.mapToDomainEntity(result[0]) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await db
      .delete(tasksSchema)
      .where(eq(tasksSchema.id, id))
      .returning({ id: tasksSchema.id });

    return result.length > 0;
  }

  async deleteByMilestone(milestoneId: string): Promise<number> {
    const result = await db
      .delete(tasksSchema)
      .where(eq(tasksSchema.milestoneId, milestoneId))
      .returning({ id: tasksSchema.id });

    return result.length;
  }

  mapToDomainEntity(dbEntity: Task): Task {
    return {
      id: dbEntity.id,
      title: dbEntity.title,
      description: dbEntity.description,
      assigneeIds: dbEntity.assigneeIds || [],
      dependencies: dbEntity.dependencies || [],
      projectDocumentIds: dbEntity.projectDocumentIds || [],
      startDate: dbEntity.startDate,
      dueDate: dbEntity.dueDate,
      status: dbEntity.status as TaskStatus,
      order: dbEntity.order,
      milestoneId: dbEntity.milestoneId,
      documentId: dbEntity.documentId,
      userId: dbEntity.userId,
      createdAt: dbEntity.createdAt,
      updatedAt: dbEntity.updatedAt,
    };
  }

  async mapToDomainEntityWithAssignees(dbEntity: Task): Promise<Task> {
    const assignees = await this.getAssignees(dbEntity.assigneeIds || []);
    const baseTask = this.mapToDomainEntity(dbEntity);
    return {
      ...baseTask,
      assignees,
    } as Task;
  }

  private async getAssignees(assigneeIds: string[]): Promise<User[]> {
    if (assigneeIds.length === 0 || !this.userRepository) return [];

    return await this.userRepository.findByIds(assigneeIds);
  }
}
