import {
  Action,
  type ActionType,
  MemberRole,
  type MemberRoleType,
} from "../types";

// Role hierarchy - higher number = higher privileges
export const ROLE_HIERARCHY: Record<MemberRoleType, number> = {
  [MemberRole.OWNER]: 3,
  [MemberRole.EDITOR]: 2,
  [MemberRole.VIEWER]: 1,
};

// List of valid member roles for validation
export const VALID_MEMBER_ROLES: MemberRoleType[] = [
  MemberRole.OWNER,
  MemberRole.EDITOR,
  MemberRole.VIEWER,
];

// Define which roles can perform which actions
export const ROLE_PERMISSIONS: Record<MemberRoleType, ActionType[]> = {
  [MemberRole.OWNER]: [
    Action.CREATE,
    Action.READ,
    Action.UPDATE,
    Action.DELETE,
    Action.MANAGE_MEMBERS,
  ],
  [MemberRole.EDITOR]: [Action.CREATE, Action.READ, Action.UPDATE],
  [MemberRole.VIEWER]: [Action.READ],
};

// Helper to check if a role has permission for an action
export function roleHasPermission(
  role: MemberRoleType,
  action: ActionType,
): boolean {
  return ROLE_PERMISSIONS[role].includes(action);
}

// Helper to check if one role has higher privileges than another
export function hasHigherRole(
  role1: MemberRoleType,
  role2: MemberRoleType,
): boolean {
  return ROLE_HIERARCHY[role1] > ROLE_HIERARCHY[role2];
}

// Helper to check if roles are equal or higher
export function hasEqualOrHigherRole(
  role1: MemberRoleType,
  role2: MemberRoleType,
): boolean {
  return ROLE_HIERARCHY[role1] >= ROLE_HIERARCHY[role2];
}

// Get the highest role from a list of roles
export function getHighestRole(roles: MemberRoleType[]): MemberRoleType | null {
  if (roles.length === 0) return null;

  return roles.reduce((highest, current) =>
    ROLE_HIERARCHY[current] > ROLE_HIERARCHY[highest] ? current : highest,
  );
}
