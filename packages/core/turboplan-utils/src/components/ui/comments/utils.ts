import type { CommentData } from "./types";

/**
 * Calculate total comment count including replies
 */
export function getCommentCount(comments: CommentData[]): number {
  return comments.reduce((acc, comment) => {
    return acc + 1 + (comment.replies?.length || 0);
  }, 0);
}
