import type { CommentWithAuthor } from "./comments";

/**
 * Projection served to callers without a project role (anonymous visitors and
 * public-government readers): no author email and no auto-response target
 * user. Applied recursively to replies.
 */
export const toPublicComment = (
  comment: CommentWithAuthor,
): CommentWithAuthor => {
  return {
    ...comment,
    targetUserId: null,
    author: { ...comment.author, email: null },
    ...(comment.replies && {
      replies: comment.replies.map(toPublicComment),
    }),
  };
};
