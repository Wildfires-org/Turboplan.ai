import { and, asc, desc, eq, inArray, isNull, or } from "drizzle-orm";

import { db } from "../db-client";
import {
  type Comment,
  comment,
  type NewComment,
  profile,
  user,
} from "../schemas";
import { toPublicComment } from "./comment-public-view";

// Type for comment with author info
export interface CommentWithAuthor extends Comment {
  author: {
    id: string;
    /** Null in the public view (callers without a project role). */
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    avatarUrl: string | null;
    jobTitle: string | null;
  };
  replies?: CommentWithAuthor[];
}

/**
 * Options for fetching comments
 */
export interface GetCommentsOptions {
  projectId: string;
  /** Filter private comments to this user only (they see their own private comments) */
  currentUserId?: string;
  /** If true, show all comments including all private ones (for moderators) */
  showAllPrivate?: boolean;
  /**
   * If true, return the projection served to callers without a project role
   * (anonymous visitors, public-government readers): no author email and no
   * auto-response target user.
   */
  publicView?: boolean;
}

/**
 * Build visibility condition for comment queries
 * - showAllPrivate: no filter (moderators see everything)
 * - currentUserId: public OR (private AND own) OR (private auto-response targeted at user)
 * - neither: only public (anonymous/public routes)
 */
function buildVisibilityCondition(
  currentUserId?: string,
  showAllPrivate?: boolean,
) {
  if (showAllPrivate) {
    // Moderators see everything - no visibility filter
    return undefined;
  }
  if (currentUserId) {
    // Users see:
    // 1. Public comments (non-auto-response)
    // 2. Own private comments
    // 3. Private auto-responses targeted at this user
    return or(
      eq(comment.isPublic, true),
      and(eq(comment.isPublic, false), eq(comment.userId, currentUserId)),
      and(
        eq(comment.isAutoResponse, true),
        eq(comment.isPublic, false),
        eq(comment.targetUserId, currentUserId),
      ),
    );
  }
  // Anonymous: only public
  return eq(comment.isPublic, true);
}

/**
 * Get all comments for a project with author info and replies
 * @param options - Options for fetching comments
 */
export async function getCommentsByProjectId(
  options: GetCommentsOptions,
): Promise<CommentWithAuthor[]> {
  const { projectId, currentUserId, showAllPrivate, publicView } = options;

  try {
    const visibilityCondition = buildVisibilityCondition(
      currentUserId,
      showAllPrivate,
    );

    // Build where conditions for top-level comments
    const baseConditions = and(
      eq(comment.projectId, projectId),
      isNull(comment.parentCommentId),
    );
    const conditions = visibilityCondition
      ? and(baseConditions, visibilityCondition)
      : baseConditions;

    // Get top-level comments (no parent)
    const topLevelComments = await db
      .select({
        comment: comment,
        author: {
          id: user.id,
          email: user.email,
          firstName: profile.firstName,
          lastName: profile.lastName,
          avatarUrl: profile.avatarUrl,
          jobTitle: profile.jobTitle,
        },
      })
      .from(comment)
      .innerJoin(user, eq(comment.userId, user.id))
      .leftJoin(profile, eq(user.id, profile.userId))
      .where(conditions)
      .orderBy(desc(comment.createdAt));

    // Get all replies for these comments
    const commentIds = topLevelComments.map((c) => c.comment.id);

    if (commentIds.length === 0) {
      return [];
    }

    // Build reply conditions - use SQL IN clause for efficiency
    const baseReplyConditions = inArray(comment.parentCommentId, commentIds);
    const replyConditions = visibilityCondition
      ? and(baseReplyConditions, visibilityCondition)
      : baseReplyConditions;

    const allReplies = await db
      .select({
        comment: comment,
        author: {
          id: user.id,
          email: user.email,
          firstName: profile.firstName,
          lastName: profile.lastName,
          avatarUrl: profile.avatarUrl,
          jobTitle: profile.jobTitle,
        },
      })
      .from(comment)
      .innerJoin(user, eq(comment.userId, user.id))
      .leftJoin(profile, eq(user.id, profile.userId))
      .where(replyConditions)
      .orderBy(asc(comment.createdAt));

    // Group replies by parent comment ID
    const repliesMap = new Map<string, CommentWithAuthor[]>();
    for (const reply of allReplies) {
      const parentId = reply.comment.parentCommentId!;
      if (!repliesMap.has(parentId)) {
        repliesMap.set(parentId, []);
      }
      repliesMap.get(parentId)!.push({
        ...reply.comment,
        author: reply.author,
      });
    }

    // Combine comments with their replies
    const comments: CommentWithAuthor[] = topLevelComments.map((c) => ({
      ...c.comment,
      author: c.author,
      replies: repliesMap.get(c.comment.id) || [],
    }));

    return publicView ? comments.map(toPublicComment) : comments;
  } catch (error) {
    console.error("Failed to get comments by project id from database", error);
    throw error;
  }
}

/**
 * Get a single comment by ID with author info
 */
export async function getCommentById(
  id: string,
): Promise<CommentWithAuthor | null> {
  try {
    const [result] = await db
      .select({
        comment: comment,
        author: {
          id: user.id,
          email: user.email,
          firstName: profile.firstName,
          lastName: profile.lastName,
          avatarUrl: profile.avatarUrl,
          jobTitle: profile.jobTitle,
        },
      })
      .from(comment)
      .innerJoin(user, eq(comment.userId, user.id))
      .leftJoin(profile, eq(user.id, profile.userId))
      .where(eq(comment.id, id));

    if (!result) {
      return null;
    }

    return {
      ...result.comment,
      author: result.author,
    };
  } catch (error) {
    console.error("Failed to get comment by id from database", error);
    throw error;
  }
}

/**
 * Create a new comment
 * Validates one-level nesting constraint (replies cannot have replies)
 */
export async function createComment(
  data: Omit<NewComment, "id" | "createdAt" | "updatedAt">,
): Promise<Comment> {
  try {
    // If this is a reply, validate one-level nesting
    if (data.parentCommentId) {
      const parentComment = await db
        .select({
          parentCommentId: comment.parentCommentId,
          projectId: comment.projectId,
        })
        .from(comment)
        .where(eq(comment.id, data.parentCommentId));

      if (parentComment.length === 0) {
        throw new Error("Parent comment not found");
      }

      // Parent must belong to the same project — prevents cross-project
      // threading (IDOR) via an unvalidated parentCommentId.
      if (parentComment[0].projectId !== data.projectId) {
        throw new Error("Parent comment not found");
      }

      // Check if parent is already a reply (has its own parent)
      if (parentComment[0].parentCommentId !== null) {
        throw new Error(
          "Cannot reply to a reply - only one level of nesting allowed",
        );
      }
    }

    const now = new Date();
    const [newComment] = await db
      .insert(comment)
      .values({
        ...data,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return newComment;
  } catch (error) {
    console.error("Failed to create comment in database", error);
    throw error;
  }
}

/**
 * Create a new comment and return it with author info.
 * Optimized version that avoids a separate getCommentById call.
 */
export async function createCommentWithAuthor(
  data: Omit<NewComment, "id" | "createdAt" | "updatedAt">,
): Promise<CommentWithAuthor> {
  try {
    // If this is a reply, validate one-level nesting
    if (data.parentCommentId) {
      const parentComment = await db
        .select({
          parentCommentId: comment.parentCommentId,
          projectId: comment.projectId,
        })
        .from(comment)
        .where(eq(comment.id, data.parentCommentId));

      if (parentComment.length === 0) {
        throw new Error("Parent comment not found");
      }

      // Parent must belong to the same project — prevents cross-project
      // threading (IDOR) via an unvalidated parentCommentId.
      if (parentComment[0].projectId !== data.projectId) {
        throw new Error("Parent comment not found");
      }

      if (parentComment[0].parentCommentId !== null) {
        throw new Error(
          "Cannot reply to a reply - only one level of nesting allowed",
        );
      }
    }

    const now = new Date();

    // Insert and fetch with author in a single query using subquery
    const [newComment] = await db
      .insert(comment)
      .values({
        ...data,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    // Fetch with author info
    const [result] = await db
      .select({
        comment: comment,
        author: {
          id: user.id,
          email: user.email,
          firstName: profile.firstName,
          lastName: profile.lastName,
          avatarUrl: profile.avatarUrl,
          jobTitle: profile.jobTitle,
        },
      })
      .from(comment)
      .innerJoin(user, eq(comment.userId, user.id))
      .leftJoin(profile, eq(user.id, profile.userId))
      .where(eq(comment.id, newComment.id));

    return {
      ...result.comment,
      author: result.author,
    };
  } catch (error) {
    console.error("Failed to create comment in database", error);
    throw error;
  }
}

/**
 * Delete a comment by ID
 * Also deletes all replies to this comment (cascade)
 */
export async function deleteComment(id: string): Promise<void> {
  try {
    // First delete any replies to this comment
    await db.delete(comment).where(eq(comment.parentCommentId, id));

    // Then delete the comment itself
    await db.delete(comment).where(eq(comment.id, id));
  } catch (error) {
    console.error("Failed to delete comment from database", error);
    throw error;
  }
}

/**
 * Update comment visibility (isPublic)
 */
export async function updateCommentVisibility(
  id: string,
  isPublic: boolean,
): Promise<Comment | null> {
  try {
    const [updated] = await db
      .update(comment)
      .set({
        isPublic,
        updatedAt: new Date(),
      })
      .where(eq(comment.id, id))
      .returning();

    return updated || null;
  } catch (error) {
    console.error("Failed to update comment visibility in database", error);
    throw error;
  }
}
