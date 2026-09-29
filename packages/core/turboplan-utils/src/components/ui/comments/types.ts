// Types for comment components

export interface CommentAuthor {
  id: string;
  /** Null when served to viewers without a project role. */
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  jobTitle: string | null;
}

export interface CommentData {
  id: string;
  projectId: string;
  userId: string;
  parentCommentId: string | null;
  content: string;
  isPublic: boolean;
  /** Whether this comment is an AI-generated auto-response */
  isAutoResponse?: boolean;
  /** The user ID who should see this private auto-response (original commenter) */
  targetUserId?: string | null;
  /** Display name for auto-responses (e.g., "Office Name Responder") */
  autoResponderName?: string | null;
  createdAt: Date;
  updatedAt: Date;
  author: CommentAuthor;
  replies?: CommentData[];
}

export interface CommentPermissions {
  /** Current user ID (null if not logged in) */
  currentUserId: string | null;
  /** Whether the user can moderate comments (e.g., project owner with MANAGE_MEMBERS) */
  canModerate: boolean;
}
