import { type DbInstance, getDB } from "@wildfires-org/turboplan-db/db-client";

import { isMembershipGrant, PermissionResolver } from "../permission-resolver";
import type {
  ActionType,
  AllowedActionsResult,
  EntityTypeType,
  MemberRoleType,
  PermissionCheckResult,
} from "../types";
import { Action, MemberRole } from "../types";
import { isAdmin } from "../utils/admin-server";
import { DrizzleEntityHierarchyService } from "./entity-hierarchy.service";
import { DrizzleMembershipService } from "./membership.service";

export type RBACServiceOptions = {
  /**
   * Whether a platform admin is granted every action on every entity without
   * holding a membership. Defaults to `true`. Pass `false` for credentials that
   * must never carry admin powers (personal access tokens): the caller is then
   * judged on their memberships alone.
   */
  platformAdminBypass?: boolean;
};

export class RBACService {
  private permissionResolver: PermissionResolver;
  private entityHierarchyService: DrizzleEntityHierarchyService;
  private membershipService: DrizzleMembershipService;

  constructor(
    private db: DbInstance = getDB(),
    options: RBACServiceOptions = {},
  ) {
    this.entityHierarchyService = new DrizzleEntityHierarchyService(db);
    this.membershipService = new DrizzleMembershipService(db);

    this.permissionResolver = new PermissionResolver({
      entityHierarchyService: this.entityHierarchyService,
      membershipService: this.membershipService,
      adminCheck: options.platformAdminBypass === false ? undefined : isAdmin,
    });
  }

  /**
   * Check if a user has permission to perform an action on an entity
   */
  async checkPermission(
    userId: string,
    entityId: string,
    entityType: EntityTypeType,
    action: ActionType,
    options?: { email?: string },
  ): Promise<PermissionCheckResult> {
    return this.permissionResolver.checkPermission(
      userId,
      entityId,
      entityType,
      action,
      options,
    );
  }

  /**
   * Whether the user holds a role on the entity itself — direct, inherited
   * from a parent, or platform admin. Upward READ derived only from a child
   * membership (e.g. being a member of one project in an office) does not
   * count.
   */
  async hasMembershipAccess(
    userId: string,
    entityId: string,
    entityType: EntityTypeType,
    options?: { email?: string },
  ): Promise<boolean> {
    const result = await this.checkPermission(
      userId,
      entityId,
      entityType,
      Action.READ,
      options,
    );
    return isMembershipGrant(result);
  }

  /**
   * Resolve every action the user may perform on an entity in a single pass.
   */
  async getAllowedActions(
    userId: string,
    entityId: string,
    entityType: EntityTypeType,
    options?: { email?: string },
  ): Promise<AllowedActionsResult> {
    return this.permissionResolver.getAllowedActions(
      userId,
      entityId,
      entityType,
      options,
    );
  }

  /**
   * Resolve the allowed actions for several entities in one pass, sharing the
   * admin check, the membership lookup and a single batched ancestor query
   * across all of them. Results come back in the order the entities were
   * passed, each identical to a `getAllowedActions` call for that entity.
   */
  async getAllowedActionsBatch(
    userId: string,
    entities: Array<{ entityId: string; entityType: EntityTypeType }>,
    options?: { email?: string },
  ): Promise<AllowedActionsResult[]> {
    return this.permissionResolver.getAllowedActionsBatch(
      userId,
      entities,
      options,
    );
  }

  /**
   * Get the effective role for a user on an entity
   */
  async getEffectiveRole(
    userId: string,
    entityId: string,
    entityType: EntityTypeType,
  ): Promise<MemberRoleType | null> {
    return this.permissionResolver.getEffectiveRole(
      userId,
      entityId,
      entityType,
    );
  }

  // ============================================================================
  // Hierarchy Methods
  // ============================================================================

  /**
   * Get all ancestors of an entity (parents up the hierarchy)
   * Uses optimized JOINs to fetch entire hierarchy in one query
   */
  async getAncestors(entityId: string, entityType: EntityTypeType) {
    return this.entityHierarchyService.getAncestors(entityId, entityType);
  }

  /**
   * Get ancestors for multiple entities in a single batch query (optimized for bulk lookups)
   * Returns a Map from entityId to its ancestor chain
   */
  async getAncestorsBatch(
    entities: Array<{ entityId: string; entityType: EntityTypeType }>,
  ) {
    return this.entityHierarchyService.getAncestorsBatch(entities);
  }

  /**
   * Get all user memberships across all entities
   */
  async getUserMemberships(userId: string) {
    return this.membershipService.getUserMemberships(userId);
  }

  // ============================================================================
  // Membership Management Methods
  // ============================================================================

  /**
   * Get user's membership for a specific entity
   */
  async getUserMembershipForEntity(
    userId: string,
    entityId: string,
    entityType: EntityTypeType,
  ) {
    return this.membershipService.getUserMembershipForEntity(
      userId,
      entityId,
      entityType,
    );
  }

  /**
   * Add a new membership
   */
  async addMembership(
    userId: string,
    entityId: string,
    entityType: EntityTypeType,
    role: MemberRoleType,
  ): Promise<void> {
    await this.membershipService.addMembership({
      userId,
      entityId,
      entityType,
      role,
    });
  }

  /**
   * Update a member's role
   */
  async updateMembershipRole(
    userId: string,
    entityId: string,
    entityType: EntityTypeType,
    newRole: MemberRoleType,
  ): Promise<void> {
    await this.membershipService.updateMembershipRole(
      userId,
      entityId,
      entityType,
      newRole,
    );
  }

  /**
   * Remove a membership
   */
  async removeMembership(
    userId: string,
    entityId: string,
    entityType: EntityTypeType,
  ): Promise<void> {
    await this.membershipService.removeMembership(userId, entityId, entityType);
  }

  /**
   * Get all members of an entity
   */
  async getEntityMembers(entityId: string, entityType: EntityTypeType) {
    return this.membershipService.getEntityMembers(entityId, entityType);
  }

  /**
   * Check if a user can be removed from an entity without violating the last owner rule.
   * This should be called within a transaction to ensure consistency.
   * @param userId - User ID to check
   * @param entityId - Entity ID
   * @param entityType - Entity type
   * @throws Error if the user is the last owner and cannot be removed
   */
  async ensureNotLastOwner(
    userId: string,
    entityId: string,
    entityType: EntityTypeType,
  ): Promise<void> {
    const effectiveRole = await this.getEffectiveRole(
      userId,
      entityId,
      entityType,
    );

    if (effectiveRole === MemberRole.OWNER) {
      // Lock the membership rows so a concurrent removal/demotion in another
      // transaction can't also pass this check (last-owner race).
      const allMembers = await this.membershipService.getEntityMembers(
        entityId,
        entityType,
        { forUpdate: true },
      );

      const otherOwners = allMembers.filter(
        (m) => m.userId !== userId && m.role === MemberRole.OWNER,
      );

      if (otherOwners.length === 0) {
        throw new Error("Cannot remove the last owner");
      }
    }
  }
}

export function getRBACService(
  db: DbInstance = getDB(),
  options?: RBACServiceOptions,
): RBACService {
  return new RBACService(db, options);
}
