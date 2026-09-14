/**
 * Numeric role levels for comparing role precedence.
 * Higher number = higher privilege.
 * Used when merging inherited memberships to keep the higher role.
 */
export const ROLE_LEVEL: Record<string, number> = {
  owner: 3,
  editor: 2,
  viewer: 1,
};
