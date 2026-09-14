import { and, eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import {
  officeUsers,
  organizationUsers,
  projectUsers,
} from "@wildfires-org/turboplan-db";

import type {
  EntityTypeType,
  MemberRoleType,
  Membership,
  MembershipService,
} from "../types";
import { EntityType } from "../types";

// Type-safe database with workspace schemas
type WorkspaceSchemas = {
  organizationUsers: typeof organizationUsers;
  officeUsers: typeof officeUsers;
  projectUsers: typeof projectUsers;
};

type Database = PostgresJsDatabase<WorkspaceSchemas>;

export class DrizzleMembershipService implements MembershipService {
  constructor(private db: Database) {}

  async getUserMemberships(userId: string): Promise<Membership[]> {
    // Run all 3 membership queries in parallel
    const [orgMemberships, officeMemberships, projectMemberships] =
      await Promise.all([
        this.db
          .select()
          .from(organizationUsers)
          .where(eq(organizationUsers.userId, userId)),
        this.db
          .select()
          .from(officeUsers)
          .where(eq(officeUsers.userId, userId)),
        this.db
          .select()
          .from(projectUsers)
          .where(eq(projectUsers.userId, userId)),
      ]);

    // Map all memberships to unified format
    return [
      ...orgMemberships.map((m) => ({
        userId: m.userId,
        entityId: m.organizationId,
        entityType: EntityType.ORGANIZATION as EntityTypeType,
        role: m.role as MemberRoleType,
      })),
      ...officeMemberships.map((m) => ({
        userId: m.userId,
        entityId: m.officeId,
        entityType: EntityType.OFFICE as EntityTypeType,
        role: m.role as MemberRoleType,
      })),
      ...projectMemberships.map((m) => ({
        userId: m.userId,
        entityId: m.projectId,
        entityType: EntityType.PROJECT as EntityTypeType,
        role: m.role as MemberRoleType,
      })),
    ];
  }

  async getUserMembershipForEntity(
    userId: string,
    entityId: string,
    entityType: EntityTypeType,
  ): Promise<Membership | null> {
    switch (entityType) {
      case EntityType.ORGANIZATION: {
        const result = await this.db
          .select()
          .from(organizationUsers)
          .where(
            and(
              eq(organizationUsers.userId, userId),
              eq(organizationUsers.organizationId, entityId),
            ),
          )
          .limit(1);

        if (result.length === 0) return null;

        return {
          userId: result[0].userId,
          entityId: result[0].organizationId,
          entityType: EntityType.ORGANIZATION,
          role: result[0].role as MemberRoleType,
        };
      }

      case EntityType.OFFICE: {
        const result = await this.db
          .select()
          .from(officeUsers)
          .where(
            and(
              eq(officeUsers.userId, userId),
              eq(officeUsers.officeId, entityId),
            ),
          )
          .limit(1);

        if (result.length === 0) return null;

        return {
          userId: result[0].userId,
          entityId: result[0].officeId,
          entityType: EntityType.OFFICE,
          role: result[0].role as MemberRoleType,
        };
      }

      case EntityType.PROJECT: {
        const result = await this.db
          .select()
          .from(projectUsers)
          .where(
            and(
              eq(projectUsers.userId, userId),
              eq(projectUsers.projectId, entityId),
            ),
          )
          .limit(1);

        if (result.length === 0) return null;

        return {
          userId: result[0].userId,
          entityId: result[0].projectId,
          entityType: EntityType.PROJECT,
          role: result[0].role as MemberRoleType,
        };
      }

      default:
        throw new Error(`Unknown entity type: ${entityType}`);
    }
  }

  async addMembership(membership: Membership): Promise<void> {
    switch (membership.entityType) {
      case EntityType.ORGANIZATION:
        await this.db.insert(organizationUsers).values({
          userId: membership.userId,
          organizationId: membership.entityId,
          role: membership.role,
        });
        break;

      case EntityType.OFFICE:
        await this.db.insert(officeUsers).values({
          userId: membership.userId,
          officeId: membership.entityId,
          role: membership.role,
        });
        break;

      case EntityType.PROJECT:
        await this.db.insert(projectUsers).values({
          userId: membership.userId,
          projectId: membership.entityId,
          role: membership.role,
        });
        break;

      default:
        throw new Error(`Unknown entity type: ${membership.entityType}`);
    }
  }

  async removeMembership(
    userId: string,
    entityId: string,
    entityType: EntityTypeType,
  ): Promise<void> {
    switch (entityType) {
      case EntityType.ORGANIZATION:
        await this.db
          .delete(organizationUsers)
          .where(
            and(
              eq(organizationUsers.userId, userId),
              eq(organizationUsers.organizationId, entityId),
            ),
          );
        break;

      case EntityType.OFFICE:
        await this.db
          .delete(officeUsers)
          .where(
            and(
              eq(officeUsers.userId, userId),
              eq(officeUsers.officeId, entityId),
            ),
          );
        break;

      case EntityType.PROJECT:
        await this.db
          .delete(projectUsers)
          .where(
            and(
              eq(projectUsers.userId, userId),
              eq(projectUsers.projectId, entityId),
            ),
          );
        break;

      default:
        throw new Error(`Unknown entity type: ${entityType}`);
    }
  }

  async updateMembershipRole(
    userId: string,
    entityId: string,
    entityType: EntityTypeType,
    newRole: MemberRoleType,
  ): Promise<void> {
    switch (entityType) {
      case EntityType.ORGANIZATION:
        await this.db
          .update(organizationUsers)
          .set({ role: newRole })
          .where(
            and(
              eq(organizationUsers.userId, userId),
              eq(organizationUsers.organizationId, entityId),
            ),
          );
        break;

      case EntityType.OFFICE:
        await this.db
          .update(officeUsers)
          .set({ role: newRole })
          .where(
            and(
              eq(officeUsers.userId, userId),
              eq(officeUsers.officeId, entityId),
            ),
          );
        break;

      case EntityType.PROJECT:
        await this.db
          .update(projectUsers)
          .set({ role: newRole })
          .where(
            and(
              eq(projectUsers.userId, userId),
              eq(projectUsers.projectId, entityId),
            ),
          );
        break;

      default:
        throw new Error(`Unknown entity type: ${entityType}`);
    }
  }

  /**
   * Get all members of an entity.
   *
   * Pass `{ forUpdate: true }` to take a row lock (`SELECT … FOR UPDATE`) on the
   * membership rows — only meaningful inside a transaction. `ensureNotLastOwner`
   * uses it so two concurrent owner removals/demotions serialize instead of both
   * reading "one other owner" and leaving the entity with zero owners.
   */
  async getEntityMembers(
    entityId: string,
    entityType: EntityTypeType,
    options?: { forUpdate?: boolean },
  ): Promise<Membership[]> {
    const forUpdate = options?.forUpdate ?? false;

    switch (entityType) {
      case EntityType.ORGANIZATION: {
        const base = this.db
          .select()
          .from(organizationUsers)
          .where(eq(organizationUsers.organizationId, entityId));
        const members = forUpdate ? await base.for("update") : await base;

        return members.map((m) => ({
          userId: m.userId,
          entityId: m.organizationId,
          entityType: EntityType.ORGANIZATION,
          role: m.role as MemberRoleType,
        }));
      }

      case EntityType.OFFICE: {
        const base = this.db
          .select()
          .from(officeUsers)
          .where(eq(officeUsers.officeId, entityId));
        const members = forUpdate ? await base.for("update") : await base;

        return members.map((m) => ({
          userId: m.userId,
          entityId: m.officeId,
          entityType: EntityType.OFFICE,
          role: m.role as MemberRoleType,
        }));
      }

      case EntityType.PROJECT: {
        const base = this.db
          .select()
          .from(projectUsers)
          .where(eq(projectUsers.projectId, entityId));
        const members = forUpdate ? await base.for("update") : await base;

        return members.map((m) => ({
          userId: m.userId,
          entityId: m.projectId,
          entityType: EntityType.PROJECT,
          role: m.role as MemberRoleType,
        }));
      }

      default:
        throw new Error(`Unknown entity type: ${entityType}`);
    }
  }
}
