import type { MemberRoleType } from "../../types";

export type MemberStatus = "active" | "inactive" | "pending";

export interface SubEntityTag {
  id: string;
  name: string;
}

interface MemberRowBase {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: MemberRoleType;
  status: MemberStatus;
  isCurrentUser: boolean;
  isDirect: boolean;
  inheritedFrom?: string;
  subEntities: SubEntityTag[];
}

interface MemberMemberRow extends MemberRowBase {
  type: "member";
}

interface InvitationMemberRow extends MemberRowBase {
  type: "invitation";
  invitationId: string;
}

export type MemberRow = MemberMemberRow | InvitationMemberRow;

export interface MembersTableConfig {
  subEntityLabel: string;
  showSubEntityColumn: boolean;
  showSubEntityFilter: boolean;
  canManageMembers: boolean;
  showAccessFilter: boolean;
}

export type AccessFilterValue = "direct" | "inherited" | "all";
export type RoleFilterValue = "all" | MemberRoleType;
export type StatusFilterValue = "all" | MemberStatus;
