"use client";

import { toast } from "sonner";

import { Action, EntityType } from "@wildfires-org/turboplan-rbac";
import { useEntityPermission } from "@wildfires-org/turboplan-rbac/hooks";
import {
  type CommentPermissions,
  CommentsSection as CommentsSectionUI,
} from "@wildfires-org/turboplan-utils";

import { useComments } from "@/hooks/use-comments";
import { PANEL_CLASS } from "@/lib/glass";

interface CommentsPageProps {
  projectId: string;
  userId: string;
}

export function CommentsPage({ projectId, userId }: CommentsPageProps) {
  const {
    comments,
    isLoading,
    createComment,
    createReply,
    deleteComment,
    toggleVisibility,
  } = useComments({ projectId });

  const { hasPermission: canModerate } = useEntityPermission({
    userId,
    entityType: EntityType.PROJECT,
    entityId: projectId,
    action: Action.MANAGE_MEMBERS,
  });

  const permissions: CommentPermissions = {
    currentUserId: userId,
    canModerate: canModerate ?? false,
  };

  const handleSubmit = async (content: string) => {
    try {
      await createComment(content);
      toast.success("Comment posted");
    } catch (error) {
      console.error("Failed to post comment:", error);
      toast.error("Failed to post comment");
      throw error;
    }
  };

  const handleReply = async (parentCommentId: string, content: string) => {
    try {
      await createReply(parentCommentId, content);
      toast.success("Reply posted");
    } catch (error) {
      console.error("Failed to post reply:", error);
      toast.error("Failed to post reply");
      throw error;
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      await deleteComment(commentId);
      toast.success("Comment deleted");
    } catch (error) {
      console.error("Failed to delete comment:", error);
      toast.error("Failed to delete comment");
      throw error;
    }
  };

  const handleToggleVisibility = async (
    commentId: string,
    isPublic: boolean,
  ) => {
    try {
      await toggleVisibility(commentId, isPublic);
      toast.success(
        isPublic ? "Comment is now public" : "Comment is now private",
      );
    } catch (error) {
      console.error("Failed to update comment visibility:", error);
      toast.error("Failed to update visibility");
      throw error;
    }
  };

  return (
    <div className={PANEL_CLASS}>
      <CommentsSectionUI
        comments={comments}
        permissions={permissions}
        isLoading={isLoading}
        onSubmit={handleSubmit}
        onReply={handleReply}
        onDelete={handleDelete}
        onToggleVisibility={handleToggleVisibility}
        title="Comments"
        withAccordion={false}
      />
    </div>
  );
}
