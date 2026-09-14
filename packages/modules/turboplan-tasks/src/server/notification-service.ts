/**
 * Task Notification Service
 * Handles sending email notifications for task-related events
 */
import { and, eq, inArray } from "drizzle-orm";

import {
  milestones,
  office,
  organization,
  profile,
  project,
  projectUsers,
  user,
} from "@wildfires-org/turboplan-db";
import { db } from "@wildfires-org/turboplan-db/db-client";
import { getApiEnv } from "@wildfires-org/turboplan-env";
import { getMailService } from "@wildfires-org/turboplan-mail/server";

interface UserWithProfile {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

interface TaskNotificationContext {
  taskId: string;
  taskTitle: string;
  taskDescription?: string | null;
  milestoneId: string;
  projectId?: string | null;
}

/**
 * Service for handling task-related email notifications
 */
class TaskNotificationService {
  /**
   * Send assignment notification emails to newly assigned users.
   * Only sends emails to users who are already project members.
   * Users being invited to the project will receive a project invitation email instead.
   */
  async notifyNewAssignees(
    newAssigneeIds: string[],
    assignerId: string,
    context: TaskNotificationContext,
  ): Promise<void> {
    if (newAssigneeIds.length === 0) return;

    try {
      // Fetch milestone info first to get projectId
      const milestoneData = await this.getMilestoneTitle(context.milestoneId);

      // Get project ID from milestone data (tasks don't have projectId directly)
      const projectId = context.projectId || milestoneData?.projectId;

      if (!projectId) {
        // No project context, skip notifications
        console.warn(
          "Cannot send task assignment notifications: no project ID found",
        );
        return;
      }

      // Filter to only existing project members
      // (newly invited users will get project invitation email instead)
      const existingMemberIds = await this.getExistingProjectMembers(
        projectId,
        newAssigneeIds,
      );

      if (existingMemberIds.length === 0) {
        // All assignees are being invited, they'll get project invitation emails
        return;
      }

      // Fetch user data and assigner info in parallel
      const [existingMembers, assigner, projectData] = await Promise.all([
        this.getUsersWithProfiles(existingMemberIds),
        this.getUserWithProfile(assignerId),
        this.getProjectInfo(projectId),
      ]);

      if (!assigner) {
        console.error(
          "Could not find assigner for task notification:",
          assignerId,
        );
        return;
      }

      const assignerName = this.formatUserName(assigner);
      const projectName = projectData?.name || "Project";
      const taskUrl = this.buildTaskUrl(projectData);

      const mailService = getMailService();

      // Send notifications to each existing member who was assigned
      await Promise.all(
        existingMembers.map(async (assignee) => {
          try {
            await mailService.sendTaskAssignmentEmail({
              to: assignee.email,
              assigneeEmail: assignee.email,
              assigneeName: this.formatUserName(assignee) || undefined,
              assignerName,
              projectName,
              taskTitle: context.taskTitle,
              milestoneTitle: milestoneData?.title,
              taskDescription: context.taskDescription || undefined,
              taskUrl,
            });
          } catch (error) {
            console.error(
              `Failed to send task assignment email to ${assignee.email}:`,
              error,
            );
          }
        }),
      );
    } catch (error) {
      console.error("Failed to send task assignment notifications:", error);
    }
  }

  /**
   * Get user IDs that are already members of the given project
   */
  private async getExistingProjectMembers(
    projectId: string,
    userIds: string[],
  ): Promise<string[]> {
    if (userIds.length === 0) return [];

    const results = await db
      .select({ userId: projectUsers.userId })
      .from(projectUsers)
      .where(
        and(
          eq(projectUsers.projectId, projectId),
          inArray(projectUsers.userId, userIds),
        ),
      );

    return results.map((r) => r.userId);
  }

  /**
   * Get users with their profile information
   */
  private async getUsersWithProfiles(
    userIds: string[],
  ): Promise<UserWithProfile[]> {
    if (userIds.length === 0) return [];

    const results = await db
      .select({
        id: user.id,
        email: user.email,
        firstName: profile.firstName,
        lastName: profile.lastName,
      })
      .from(user)
      .leftJoin(profile, eq(user.id, profile.userId))
      .where(inArray(user.id, userIds));

    return results;
  }

  /**
   * Get a single user with profile
   */
  private async getUserWithProfile(
    userId: string,
  ): Promise<UserWithProfile | null> {
    const results = await this.getUsersWithProfiles([userId]);
    return results[0] || null;
  }

  /**
   * Get milestone title
   */
  private async getMilestoneTitle(
    milestoneId: string,
  ): Promise<{ title: string; projectId: string | null } | null> {
    const results = await db
      .select({
        title: milestones.title,
        projectId: milestones.projectId,
      })
      .from(milestones)
      .where(eq(milestones.id, milestoneId))
      .limit(1);

    return results[0] || null;
  }

  /**
   * Get project information including full slug path for URL construction
   */
  private async getProjectInfo(projectId: string): Promise<{
    name: string;
    projectSlug: string;
    officeSlug: string;
    orgSlug: string;
  } | null> {
    const results = await db
      .select({
        name: project.name,
        projectSlug: project.slug,
        officeSlug: office.slug,
        orgSlug: organization.slug,
      })
      .from(project)
      .innerJoin(office, eq(project.officeId, office.id))
      .innerJoin(organization, eq(office.organizationId, organization.id))
      .where(eq(project.id, projectId))
      .limit(1);

    return results[0] || null;
  }

  /**
   * Format user name from profile data
   */
  private formatUserName(user: UserWithProfile): string {
    if (user.firstName || user.lastName) {
      return `${user.firstName || ""} ${user.lastName || ""}`.trim();
    }
    // Fall back to email username
    return user.email.split("@")[0];
  }

  /**
   * Build URL to the project tasks page
   */
  private buildTaskUrl(
    projectData: {
      projectSlug: string;
      officeSlug: string;
      orgSlug: string;
    } | null,
  ): string {
    const env = getApiEnv();
    const baseUrl = env.TURBOPLAN_URL;

    if (projectData) {
      return `${baseUrl}/organizations/${projectData.orgSlug}/offices/${projectData.officeSlug}/projects/${projectData.projectSlug}/tasks`;
    }

    return baseUrl;
  }
}

// Singleton instance
let notificationService: TaskNotificationService | null = null;

export function getTaskNotificationService(): TaskNotificationService {
  if (!notificationService) {
    notificationService = new TaskNotificationService();
  }
  return notificationService;
}
