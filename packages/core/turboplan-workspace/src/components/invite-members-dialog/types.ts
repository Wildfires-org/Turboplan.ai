import type { MemberRoleType } from "../../types";

export interface PendingInvitee {
  /** Unique key for React list rendering */
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: MemberRoleType;
  /** True if user doesn't exist in system (will receive email invitation) */
  isInvite: boolean;
}
