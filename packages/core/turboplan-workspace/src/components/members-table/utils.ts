import type { MemberRoleType } from "../../types";
import type { MemberRow, SubEntityTag } from "./types";

export const ROLE_ORDER: Record<string, number> = {
  owner: 0,
  editor: 1,
  viewer: 2,
};

export const STATUS_ORDER: Record<string, number> = {
  active: 0,
  inactive: 1,
  pending: 2,
};

export const getRoleDisplayName = (role: MemberRoleType): string => {
  switch (role) {
    case "owner":
      return "Owner";
    case "editor":
      return "Editor";
    case "viewer":
      return "Viewer";
    default:
      return role;
  }
};

export const collectSubEntities = (rows: MemberRow[]): SubEntityTag[] => {
  const map = new Map<string, SubEntityTag>();
  for (const row of rows) {
    for (const entity of row.subEntities) {
      if (!map.has(entity.id)) {
        map.set(entity.id, entity);
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
};
