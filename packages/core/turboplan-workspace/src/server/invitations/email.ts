import { and, eq } from "drizzle-orm";

import {
  milestones,
  office,
  organization,
  profile,
  project,
  tasks,
} from "@wildfires-org/turboplan-db";
import { db } from "@wildfires-org/turboplan-db/db-client";
import {
  getUserById,
  milestoneInProject,
  taskInProject,
} from "@wildfires-org/turboplan-db/queries";
import { getApiEnv } from "@wildfires-org/turboplan-env";
import { getMailService } from "@wildfires-org/turboplan-mail/server";

import { getInvitationById } from "./queries";
import type { InvitationEntityType, TaskAssignment } from "./types";
import { getEntityName, getInviterName } from "./utils";

/**
 * Get task and milestone titles for email, scoped to the invitation's project
 * so a stored id can never surface another project's titles to the invitee.
 */
async function getTaskAssignmentTitles(
  projectId: string,
  taskAssignment: TaskAssignment,
): Promise<{ taskTitle?: string; milestoneTitle?: string }> {
  let taskTitle: string | undefined;
  let milestoneTitle: string | undefined;

  try {
    if (taskAssignment.taskId) {
      const [task] = await db
        .select({ title: tasks.title })
        .from(tasks)
        .where(
          and(eq(tasks.id, taskAssignment.taskId), taskInProject(projectId)),
        )
        .limit(1);
      taskTitle = task?.title;
    }

    if (taskAssignment.milestoneId) {
      const [milestone] = await db
        .select({ title: milestones.title })
        .from(milestones)
        .where(
          and(
            eq(milestones.id, taskAssignment.milestoneId),
            milestoneInProject(projectId),
          ),
        )
        .limit(1);
      milestoneTitle = milestone?.title;
    }
  } catch (error) {
    console.error("Failed to fetch task/milestone titles:", error);
  }

  return { taskTitle, milestoneTitle };
}

/**
 * Send invitation email for a given invitation ID.
 *
 * @param rawToken The unhashed token to embed in the link. Only its hash is
 *   stored on the record, so it must be passed in by the caller that generated
 *   it — it cannot be read back from the DB.
 */
export async function sendInvitationEmail(
  invitationId: string,
  rawToken: string,
): Promise<void> {
  const invitation = await getInvitationById(invitationId);
  if (!invitation) {
    throw new Error("Invitation not found");
  }

  const env = getApiEnv();
  const entityName = await getEntityName(
    invitation.entityType as InvitationEntityType,
    invitation.entityId,
  );
  const inviterName = await getInviterName(invitation.invitedBy);

  const inviteUrl = `${env.TURBOPLAN_URL}/invite/${rawToken}`;

  const mailService = getMailService();

  // Use project-specific email if it's a project with task assignment
  const taskAssignment = invitation.taskAssignment as TaskAssignment | null;
  if (
    invitation.entityType === "project" &&
    taskAssignment &&
    (taskAssignment.taskId || taskAssignment.milestoneId)
  ) {
    // Fetch task/milestone titles for the email
    const { taskTitle, milestoneTitle } = await getTaskAssignmentTitles(
      invitation.entityId,
      taskAssignment,
    );

    await mailService.sendProjectInvitationEmail({
      to: invitation.email,
      inviteeEmail: invitation.email,
      inviterName,
      projectName: entityName,
      role: invitation.role,
      taskTitle,
      milestoneTitle,
      inviteUrl,
    });
  } else {
    // Use standard invitation email
    await mailService.sendInvitationEmail({
      to: invitation.email,
      inviteeEmail: invitation.email,
      inviterName,
      entityName,
      entityType: invitation.entityType as InvitationEntityType,
      inviteUrl,
    });
  }
}

/**
 * Get the display name for a user from their profile, if available.
 */
async function getMemberDisplayName(
  userId: string,
): Promise<string | undefined> {
  const [member] = await db
    .select({
      firstName: profile.firstName,
      lastName: profile.lastName,
    })
    .from(profile)
    .where(eq(profile.userId, userId))
    .limit(1);

  if (member?.firstName || member?.lastName) {
    return [member.firstName, member.lastName].filter(Boolean).join(" ");
  }

  return undefined;
}

/**
 * Build a deep link to the entity page from its slugs.
 * Returns undefined if the entity (or its parents) cannot be resolved.
 */
async function getEntityUrl(
  entityType: InvitationEntityType,
  entityId: string,
): Promise<string | undefined> {
  const env = getApiEnv();
  const base = env.TURBOPLAN_URL;

  if (entityType === "organization") {
    const [org] = await db
      .select({ slug: organization.slug })
      .from(organization)
      .where(eq(organization.id, entityId))
      .limit(1);
    if (!org) {
      return undefined;
    }
    return `${base}/organizations/${org.slug}`;
  }

  if (entityType === "office") {
    const [off] = await db
      .select({
        officeSlug: office.slug,
        orgSlug: organization.slug,
      })
      .from(office)
      .innerJoin(organization, eq(office.organizationId, organization.id))
      .where(eq(office.id, entityId))
      .limit(1);
    if (!off) {
      return undefined;
    }
    return `${base}/organizations/${off.orgSlug}/offices/${off.officeSlug}`;
  }

  const [proj] = await db
    .select({
      projectSlug: project.slug,
      officeSlug: office.slug,
      orgSlug: organization.slug,
    })
    .from(project)
    .innerJoin(office, eq(project.officeId, office.id))
    .innerJoin(organization, eq(office.organizationId, organization.id))
    .where(eq(project.id, entityId))
    .limit(1);
  if (!proj) {
    return undefined;
  }
  return `${base}/organizations/${proj.orgSlug}/offices/${proj.officeSlug}/projects/${proj.projectSlug}`;
}

/**
 * Send a "you've been added" notification email to an existing user who was
 * added directly to an organization, office, or project.
 *
 * Failures are logged and swallowed — callers should treat this as best-effort.
 */
export async function sendMemberAddedNotification(params: {
  entityType: InvitationEntityType;
  entityId: string;
  memberUserId: string;
  addedByUserId: string;
}): Promise<void> {
  const { entityType, entityId, memberUserId, addedByUserId } = params;

  const member = await getUserById(memberUserId);
  if (!member) {
    console.error(
      "Cannot send member-added notification: member not found",
      memberUserId,
    );
    return;
  }

  const entityUrl = await getEntityUrl(entityType, entityId);
  if (!entityUrl) {
    console.error(
      "Cannot send member-added notification: entity not found",
      entityType,
      entityId,
    );
    return;
  }

  const [memberName, inviterName, entityName] = await Promise.all([
    getMemberDisplayName(memberUserId),
    getInviterName(addedByUserId),
    getEntityName(entityType, entityId),
  ]);

  const mailService = getMailService();

  await mailService.sendMemberAddedEmail({
    to: member.email,
    memberEmail: member.email,
    memberName,
    inviterName,
    entityName,
    entityType,
    entityUrl,
  });
}
