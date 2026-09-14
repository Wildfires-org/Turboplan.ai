import { and, eq } from "drizzle-orm";

import { projectUsers } from "@wildfires-org/turboplan-db";
import { db } from "@wildfires-org/turboplan-db/db-client";
import { type MemberRoleType } from "@wildfires-org/turboplan-rbac";

export interface CreateProjectUserParams {
  userId: string;
  projectId: string;
  role?: MemberRoleType;
}

/**
 * Add a user to a project with a specific role
 * Default role is 'editor'
 */
export async function createProjectUser(
  params: CreateProjectUserParams,
): Promise<unknown> {
  const { userId, projectId, role = "editor" } = params;

  return db.insert(projectUsers).values({
    userId,
    projectId,
    role,
  });
}

/**
 * Automatically assign owner role to user when they create a project
 */
export async function assignProjectOwner(
  userId: string,
  projectId: string,
): Promise<unknown> {
  return createProjectUser({
    userId,
    projectId,
    role: "owner",
  });
}

/**
 * Get all users in a project with their roles
 */
export async function getProjectUsers(projectId: string) {
  return db
    .select()
    .from(projectUsers)
    .where(eq(projectUsers.projectId, projectId));
}

/**
 * Get all projects for a user with their roles
 */
export async function getUserProjects(userId: string) {
  return db.select().from(projectUsers).where(eq(projectUsers.userId, userId));
}

/**
 * Update user role in project
 */
export async function updateProjectUserRole(
  userId: string,
  projectId: string,
  role: MemberRoleType,
): Promise<unknown> {
  return db
    .update(projectUsers)
    .set({ role, updatedAt: new Date() })
    .where(
      and(
        eq(projectUsers.userId, userId),
        eq(projectUsers.projectId, projectId),
      ),
    );
}

/**
 * Remove user from project
 */
export async function removeProjectUser(
  userId: string,
  projectId: string,
): Promise<unknown> {
  return db
    .delete(projectUsers)
    .where(
      and(
        eq(projectUsers.userId, userId),
        eq(projectUsers.projectId, projectId),
      ),
    );
}
