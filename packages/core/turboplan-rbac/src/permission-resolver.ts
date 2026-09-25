import type {
  ActionType,
  AllowedActionsResult,
  EntityHierarchyService,
  EntityMetadata,
  EntityTypeType,
  MemberRoleType,
  Membership,
  MembershipService,
  PermissionCheckResult,
} from "./types";
import { Action, EntityType, MemberRole } from "./types";
import { getHighestRole, roleHasPermission } from "./utils/roles";

/**
 * Deny reason emitted when no membership (direct, inherited, or upward) grants
 * the requested action. Exported so middleware can reuse the exact string when
 * it needs to deny without running a permission check — keeping a "row does not
 * exist" response byte-identical to a "you cannot see this row" response.
 */
export const NO_PERMISSION_REASON = "No permission found";

/**
 * Grant reason for READ derived only from a membership on a child entity
 * (e.g. a project member reading its parent office/organization).
 */
export const UPWARD_READ_REASON = "Upward read access from child entity";

/**
 * True when the permission comes from a real role on the entity itself —
 * direct, inherited from a parent, or platform admin — and not merely from
 * upward READ via a child membership. Use it where "can see the entity" is not
 * enough, e.g. listing its staff.
 */
export const isMembershipGrant = (result: PermissionCheckResult): boolean =>
  result.allowed && result.reason !== UPWARD_READ_REASON;

export interface PermissionResolverConfig {
  entityHierarchyService: EntityHierarchyService;
  membershipService: MembershipService;
  adminCheck?: (userId: string, email?: string | null) => Promise<boolean>;
}

/** Identifies the entity a permission question is asked about. */
export interface EntityRef {
  entityId: string;
  entityType: EntityTypeType;
}

/**
 * The lookups that depend only on the user, not on the entity — so they are
 * fetched once and shared by every entity resolved in the same pass.
 */
interface UserLookups {
  admin: boolean;
  memberships: Membership[];
}

/**
 * Everything the grant chain is evaluated against for one entity.
 *
 * The hierarchy lookups are lazy and memoised: they only run when the cheap
 * decisive paths (platform admin, direct membership) did not already settle
 * the question, and never run twice for the same entity.
 */
interface GrantContext {
  admin: boolean;
  directMembership: Membership | undefined;
  ancestorRoles: () => Promise<MemberRoleType[]>;
  upwardRead: () => Promise<boolean>;
}

/** Result of the single grant-chain evaluation both public APIs build on. */
type Grant =
  | { granted: true; reason: string; effectiveRole: MemberRoleType }
  | { granted: false };

/** Runs `load` at most once, handing every later caller the same promise. */
const memoize = <T>(load: () => Promise<T>): (() => Promise<T>) => {
  let pending: Promise<T> | undefined;
  return () => {
    if (!pending) {
      pending = load();
    }
    return pending;
  };
};

export class PermissionResolver {
  constructor(private config: PermissionResolverConfig) {}

  /**
   * Check if a user can perform an action on an entity.
   *
   * A membership test on the one grant chain — see {@link resolveGrant}.
   */
  async checkPermission(
    userId: string,
    entityId: string,
    entityType: EntityTypeType,
    action: ActionType,
    options?: { email?: string },
  ): Promise<PermissionCheckResult> {
    const context = await this.createGrantContext(
      userId,
      { entityId, entityType },
      options,
    );

    const grant = await this.resolveGrant(context, action);

    if (!grant.granted) {
      return { allowed: false, reason: NO_PERMISSION_REASON };
    }

    return {
      allowed: true,
      reason: grant.reason,
      effectiveRole: grant.effectiveRole,
    };
  }

  /**
   * Resolve every action the user may perform on an entity in one pass.
   *
   * Semantically identical to running `checkPermission` for each `Action` —
   * both run the same {@link resolveGrant} chain — but the underlying lookups
   * are shared across the actions instead of repeated per action.
   *
   * `effectiveRole` follows `getEffectiveRole`: the highest direct/ancestor
   * role, or `null` when the only access is upward read.
   */
  async getAllowedActions(
    userId: string,
    entityId: string,
    entityType: EntityTypeType,
    options?: { email?: string },
  ): Promise<AllowedActionsResult> {
    const context = await this.createGrantContext(
      userId,
      { entityId, entityType },
      options,
    );

    return this.resolveAllowedActions(context);
  }

  /**
   * Resolve the allowed actions for several entities in one pass, reusing the
   * admin check, the membership list and a single batched ancestor lookup
   * across all of them.
   *
   * Results come back in the order the entities were passed. Each entry is
   * identical to what {@link getAllowedActions} would return for that entity —
   * this only removes the repeated lookups, not any of the evaluation.
   */
  async getAllowedActionsBatch(
    userId: string,
    entities: EntityRef[],
    options?: { email?: string },
  ): Promise<AllowedActionsResult[]> {
    const user = await this.loadUserLookups(userId, options);

    if (user.admin) {
      return entities.map(() => ({
        actions: Object.values(Action),
        effectiveRole: MemberRole.OWNER,
      }));
    }

    const ancestorsByEntityId =
      await this.config.entityHierarchyService.getAncestorsBatch(entities);

    return Promise.all(
      entities.map((entity) =>
        this.resolveAllowedActions(
          this.buildGrantContext(
            user,
            entity,
            ancestorsByEntityId.get(entity.entityId) ?? [],
          ),
        ),
      ),
    );
  }

  /**
   * The one grant chain. Every permission answer in this class comes from
   * here, so `checkPermission` and `getAllowedActions` cannot drift apart.
   *
   * Ordered cheapest-decisive-first: the platform-admin flag and a direct
   * membership settle most requests, and the hierarchy lookups behind
   * `ancestorRoles` / `upwardRead` are only awaited when they do not.
   */
  private async resolveGrant(
    context: GrantContext,
    action: ActionType,
  ): Promise<Grant> {
    if (context.admin) {
      return {
        granted: true,
        reason: "Platform admin",
        effectiveRole: MemberRole.OWNER,
      };
    }

    const { directMembership } = context;
    if (directMembership && roleHasPermission(directMembership.role, action)) {
      return {
        granted: true,
        reason: "Direct membership permission",
        effectiveRole: directMembership.role,
      };
    }

    // A direct role that lacks the action does not block an ancestor role that
    // has it, so inheritance is still consulted below.
    const ancestorRoles = await context.ancestorRoles();
    const inheritedRole = getHighestRole(
      ancestorRoles.filter((role) => roleHasPermission(role, action)),
    );

    if (inheritedRole) {
      return {
        granted: true,
        reason: "Inherited permission from parent entity",
        effectiveRole: inheritedRole,
      };
    }

    if (action === Action.READ && (await context.upwardRead())) {
      return {
        granted: true,
        reason: UPWARD_READ_REASON,
        effectiveRole: MemberRole.VIEWER,
      };
    }

    return { granted: false };
  }

  /** Filter every action through {@link resolveGrant} for one entity. */
  private async resolveAllowedActions(
    context: GrantContext,
  ): Promise<AllowedActionsResult> {
    const allActions = Object.values(Action);

    if (context.admin) {
      return { actions: [...allActions], effectiveRole: MemberRole.OWNER };
    }

    const actions: ActionType[] = [];
    for (const action of allActions) {
      // Sequential on purpose: the first action that needs the hierarchy
      // triggers the memoised lookup the rest then reuse.
      const grant = await this.resolveGrant(context, action);
      if (grant.granted) {
        actions.push(action);
      }
    }

    const roles: MemberRoleType[] = [];
    if (context.directMembership) {
      roles.push(context.directMembership.role);
    }
    roles.push(...(await context.ancestorRoles()));

    return { actions, effectiveRole: getHighestRole(roles) };
  }

  /** Load the user-scoped lookups and bind them to a single entity. */
  private async createGrantContext(
    userId: string,
    entity: EntityRef,
    options?: { email?: string },
  ): Promise<GrantContext> {
    const user = await this.loadUserLookups(userId, options);
    return this.buildGrantContext(user, entity);
  }

  /**
   * The admin flag and the membership list are independent, so they go out in
   * one parallel round. Both are needed on the common (non-admin) path; the
   * ancestor lookups deliberately stay out of this round because a direct
   * membership frequently makes them unnecessary.
   */
  private async loadUserLookups(
    userId: string,
    options?: { email?: string },
  ): Promise<UserLookups> {
    const [admin, memberships] = await Promise.all([
      this.config.adminCheck
        ? this.config.adminCheck(userId, options?.email)
        : Promise.resolve(false),
      this.config.membershipService.getUserMemberships(userId),
    ]);

    return { admin, memberships };
  }

  /**
   * Bind user-scoped lookups to one entity.
   *
   * `ancestors` may be supplied by a caller that already fetched them in bulk;
   * otherwise they are fetched on first use.
   */
  private buildGrantContext(
    user: UserLookups,
    entity: EntityRef,
    ancestors?: EntityMetadata[],
  ): GrantContext {
    const loadAncestors = memoize(async () =>
      ancestors
        ? ancestors
        : this.config.entityHierarchyService.getAncestors(
            entity.entityId,
            entity.entityType,
          ),
    );

    return {
      admin: user.admin,
      directMembership: user.memberships.find(
        (m) =>
          m.entityId === entity.entityId && m.entityType === entity.entityType,
      ),
      ancestorRoles: memoize(async () => {
        const entityAncestors = await loadAncestors();
        return user.memberships
          .filter((m) =>
            entityAncestors.some(
              (a) => a.id === m.entityId && a.type === m.entityType,
            ),
          )
          .map((m) => m.role);
      }),
      upwardRead: memoize(() =>
        this.checkUpwardReadAccess(
          user.memberships,
          entity.entityId,
          entity.entityType,
        ),
      ),
    };
  }

  /**
   * Check upward read access from child entities
   */
  private async checkUpwardReadAccess(
    memberships: Membership[],
    entityId: string,
    entityType: EntityTypeType,
  ): Promise<boolean> {
    // For organizations, check if user has membership in any child office or project
    if (entityType === EntityType.ORGANIZATION) {
      const officeAndProjectMemberships = memberships.filter(
        (m) =>
          m.entityType === EntityType.OFFICE ||
          m.entityType === EntityType.PROJECT,
      );

      if (officeAndProjectMemberships.length > 0) {
        const ancestorsMap = await this.getAncestorsForMemberships(
          officeAndProjectMemberships,
        );

        for (const ancestors of ancestorsMap.values()) {
          if (
            ancestors.some(
              (a) => a.id === entityId && a.type === EntityType.ORGANIZATION,
            )
          ) {
            return true;
          }
        }
      }
    }

    // For offices, check if user has membership in any child project
    if (entityType === EntityType.OFFICE) {
      const projectMemberships = memberships.filter(
        (m) => m.entityType === EntityType.PROJECT,
      );

      if (projectMemberships.length > 0) {
        const ancestorsMap =
          await this.getAncestorsForMemberships(projectMemberships);

        for (const ancestors of ancestorsMap.values()) {
          if (
            ancestors.some(
              (a) => a.id === entityId && a.type === EntityType.OFFICE,
            )
          ) {
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * Helper to get ancestors for multiple memberships efficiently
   */
  private async getAncestorsForMemberships(
    memberships: Membership[],
  ): Promise<Map<string, EntityMetadata[]>> {
    return this.config.entityHierarchyService.getAncestorsBatch(
      memberships.map((m) => ({
        entityId: m.entityId,
        entityType: m.entityType,
      })),
    );
  }

  /**
   * Get effective role for a user on an entity (considering inheritance)
   */
  async getEffectiveRole(
    userId: string,
    entityId: string,
    entityType: EntityTypeType,
  ): Promise<MemberRoleType | null> {
    // Independent lookups — one parallel round instead of two sequential ones.
    const [memberships, ancestors] = await Promise.all([
      this.config.membershipService.getUserMemberships(userId),
      this.config.entityHierarchyService.getAncestors(entityId, entityType),
    ]);

    // Check direct membership
    const directMembership = memberships.find(
      (m) => m.entityId === entityId && m.entityType === entityType,
    );

    const ancestorMemberships = memberships.filter((m) =>
      ancestors.some((a) => a.id === m.entityId && a.type === m.entityType),
    );

    // Combine all relevant roles and get the highest one
    const allRoles: MemberRoleType[] = [];
    if (directMembership) {
      allRoles.push(directMembership.role);
    }
    allRoles.push(...ancestorMemberships.map((m) => m.role));

    return getHighestRole(allRoles);
  }

  /**
   * Check if a user can manage members of an entity
   */
  async canManageMembers(
    userId: string,
    entityId: string,
    entityType: EntityTypeType,
  ): Promise<boolean> {
    const result = await this.checkPermission(
      userId,
      entityId,
      entityType,
      Action.MANAGE_MEMBERS,
    );
    return result.allowed;
  }
}
