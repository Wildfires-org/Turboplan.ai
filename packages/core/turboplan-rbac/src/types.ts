// ============================================================================
// ROLES
// ============================================================================

export enum MemberRole {
  OWNER = "owner",
  EDITOR = "editor",
  VIEWER = "viewer",
}

export type MemberRoleType = `${MemberRole}`;

// ============================================================================
// ENTITIES
// ============================================================================

export const EntityType = {
  ORGANIZATION: "organization",
  OFFICE: "office",
  PROJECT: "project",
} as const;

export type EntityTypeType = (typeof EntityType)[keyof typeof EntityType];

// Entity metadata interface
export interface EntityMetadata {
  id: string;
  type: EntityTypeType;
  parentId?: string; // For offices and projects
  parentType?: EntityTypeType; // For offices and projects
}

// Membership interface
export interface Membership {
  userId: string;
  entityId: string;
  entityType: EntityTypeType;
  role: MemberRoleType;
}

// ============================================================================
// ACTIONS
// ============================================================================

// Action types
export const Action = {
  // Basic CRUD operations
  CREATE: "create",
  READ: "read",
  UPDATE: "update",
  DELETE: "delete",

  // Member management
  MANAGE_MEMBERS: "manage_members",
} as const;

export type ActionType = (typeof Action)[keyof typeof Action];

// ============================================================================
// SERVICES & INTERFACES
// ============================================================================

// Permission check result
export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
  effectiveRole?: MemberRoleType;
}

// Every action a user may perform on an entity, resolved in one pass.
export interface AllowedActionsResult {
  actions: ActionType[];
  effectiveRole: MemberRoleType | null;
}

// Entity hierarchy service interface
export interface EntityHierarchyService {
  getParent(
    entityId: string,
    entityType: EntityTypeType,
  ): Promise<EntityMetadata | null>;
  getChildren(
    entityId: string,
    entityType: EntityTypeType,
  ): Promise<EntityMetadata[]>;
  getAncestors(
    entityId: string,
    entityType: EntityTypeType,
  ): Promise<EntityMetadata[]>;
  /**
   * Get ancestors for multiple entities in a single batch query.
   * Returns a Map from entityId to an array of ancestor EntityMetadata.
   * If an entity has no ancestors (e.g., Organization) or doesn't exist, returns an empty array.
   * @param entities - Array of entity identifiers to look up ancestors for
   * @returns Map from entityId to its ancestor chain
   */
  getAncestorsBatch(
    entities: Array<{ entityId: string; entityType: EntityTypeType }>,
  ): Promise<Map<string, EntityMetadata[]>>;
}

// Membership service interface
export interface MembershipService {
  getUserMemberships(userId: string): Promise<Membership[]>;
  getUserMembershipForEntity(
    userId: string,
    entityId: string,
    entityType: EntityTypeType,
  ): Promise<Membership | null>;
  addMembership(membership: Membership): Promise<void>;
  removeMembership(
    userId: string,
    entityId: string,
    entityType: EntityTypeType,
  ): Promise<void>;
  updateMembershipRole(
    userId: string,
    entityId: string,
    entityType: EntityTypeType,
    newRole: MemberRoleType,
  ): Promise<void>;
}
