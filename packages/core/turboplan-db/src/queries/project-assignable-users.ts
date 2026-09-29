/**
 * The users a project's tasks and milestones may be assigned to, and whose
 * identity (email, name, avatar) a project reader may therefore see.
 *
 * That is everyone holding a role anywhere on the project's branch of the
 * hierarchy (the project itself, its office, its organization) plus anyone
 * already named in one of the project's `assigneeIds` arrays, so that existing
 * assignments keep resolving after the assignee leaves the project.
 *
 * Lives in turboplan-db so both the workspace router and the tasks package can
 * use it without depending on each other.
 */
import { and, eq, inArray, isNull } from "drizzle-orm";

import { db } from "../db-client";
import {
  milestones,
  office,
  officeUsers,
  organizationUsers,
  profile,
  project,
  projectUsers,
  tasks,
  user,
} from "../schemas";
import { milestoneInProject, taskInProject } from "./task-references";

export type AssignableUser = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Flatten `assigneeIds` arrays into a de-duplicated list of well-formed user
 * ids. The columns are free-form `text[]`, so anything that is not a UUID is
 * dropped rather than handed to a `uuid` comparison that would throw.
 */
export const collectAssigneeUserIds = (
  assigneeIdLists: Array<string[] | null>,
): string[] => {
  const ids = new Set<string>();
  for (const list of assigneeIdLists) {
    for (const id of list ?? []) {
      if (UUID_PATTERN.test(id)) {
        ids.add(id.toLowerCase());
      }
    }
  }
  return [...ids];
};

/** "First Last", whichever halves exist, or null when neither does. */
export const formatProfileName = (
  firstName: string | null,
  lastName: string | null,
): string | null => {
  const name = [firstName, lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
  return name.length > 0 ? name : null;
};

/**
 * Members of the project's hierarchy plus current assignees of its tasks and
 * milestones, sorted by email. An unknown or soft-deleted project yields `[]`.
 */
export const getProjectAssignableUsers = async (
  projectId: string,
): Promise<AssignableUser[]> => {
  const [hierarchy] = await db
    .select({
      officeId: project.officeId,
      organizationId: office.organizationId,
    })
    .from(project)
    .innerJoin(office, eq(office.id, project.officeId))
    .where(and(eq(project.id, projectId), isNull(project.deletedAt)))
    .limit(1);

  if (!hierarchy) {
    return [];
  }

  const [
    projectMembers,
    officeMembers,
    organizationMembers,
    taskAssignees,
    milestoneAssignees,
  ] = await Promise.all([
    db
      .select({ userId: projectUsers.userId })
      .from(projectUsers)
      .where(eq(projectUsers.projectId, projectId)),
    db
      .select({ userId: officeUsers.userId })
      .from(officeUsers)
      .where(eq(officeUsers.officeId, hierarchy.officeId)),
    db
      .select({ userId: organizationUsers.userId })
      .from(organizationUsers)
      .where(eq(organizationUsers.organizationId, hierarchy.organizationId)),
    db
      .select({ assigneeIds: tasks.assigneeIds })
      .from(tasks)
      .where(taskInProject(projectId)),
    db
      .select({ assigneeIds: milestones.assigneeIds })
      .from(milestones)
      .where(milestoneInProject(projectId)),
  ]);

  const userIds = collectAssigneeUserIds([
    [...projectMembers, ...officeMembers, ...organizationMembers].map(
      (member) => member.userId,
    ),
    ...taskAssignees.map((row) => row.assigneeIds),
    ...milestoneAssignees.map((row) => row.assigneeIds),
  ]);

  if (userIds.length === 0) {
    return [];
  }

  const rows = await db
    .select({
      id: user.id,
      email: user.email,
      firstName: profile.firstName,
      lastName: profile.lastName,
      avatarUrl: profile.avatarUrl,
    })
    .from(user)
    .leftJoin(profile, eq(profile.userId, user.id))
    .where(inArray(user.id, userIds))
    .orderBy(user.email);

  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    name: formatProfileName(row.firstName, row.lastName),
    avatarUrl: row.avatarUrl,
  }));
};
