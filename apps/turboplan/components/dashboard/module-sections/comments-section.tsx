"use client";

import { MessageSquare } from "lucide-react";
import { toast } from "sonner";

import { Action, EntityType } from "@wildfires-org/turboplan-rbac";
import { useEntityPermission } from "@wildfires-org/turboplan-rbac/hooks";
import {
  type CommentPermissions,
  CommentsSection as CommentsSectionUI,
  getCommentCount,
} from "@wildfires-org/turboplan-utils";

import { useComments } from "@/hooks/use-comments";
import { SectionCard } from "../../section-card";
import type { DragHandleProps } from "../sortable-module";

interface CommentsSectionProps {
  projectId: string;
  userId?: string;
  isHidden: boolean;
  isToggling: boolean;
  onToggleVisibility: () => void;
  isPrivate: boolean;
  isTogglingPublicVisibility: boolean;
  onTogglePublicVisibility?: () => void;
  dragHandleProps?: DragHandleProps;
  /** When true, hides edit controls */
  readOnly?: boolean;
}

export function CommentsSection({
  projectId,
  userId,
  isHidden,
  isToggling,
  onToggleVisibility,
  isPrivate,
  isTogglingPublicVisibility,
  onTogglePublicVisibility,
  dragHandleProps,
  readOnly = false,
}: CommentsSectionProps) {
  // Fetch comments using the hook
  const {
    comments,
    isLoading,
    createComment,
    createReply,
    deleteComment,
    toggleVisibility,
  } = useComments({ projectId });

  // Check if user can moderate comments (MANAGE_MEMBERS permission)
  const { hasPermission: canModerate } = useEntityPermission({
    userId,
    entityType: EntityType.PROJECT,
    entityId: projectId,
    action: Action.MANAGE_MEMBERS,
  });

  // Build permissions object for the UI component
  const permissions: CommentPermissions = {
    currentUserId: userId ?? null,
    canModerate: canModerate ?? false,
  };

  // Calculate total comment count (including replies)
  const totalCount = getCommentCount(comments);
  const subtitle =
    totalCount > 0
      ? `${totalCount} comment${totalCount === 1 ? "" : "s"}`
      : undefined;

  // Handler for submitting a new comment
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

  // Handler for submitting a reply
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

  // Handler for deleting a comment
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

  // Handler for toggling visibility
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
    <SectionCard
      title="Comments"
      icon={<MessageSquare className="size-4" aria-hidden />}
      subtitle={subtitle}
      onToggleVisibility={onToggleVisibility}
      isHidden={isHidden}
      isTogglingVisibility={isToggling}
      onTogglePublicVisibility={onTogglePublicVisibility}
      isPrivate={isPrivate}
      isTogglingPublicVisibility={isTogglingPublicVisibility}
      dragHandleProps={dragHandleProps}
      readOnly={readOnly}
    >
      <CommentsSectionUI
        comments={comments}
        permissions={permissions}
        readOnly={readOnly}
        isLoading={isLoading}
        onSubmit={handleSubmit}
        onReply={handleReply}
        onDelete={handleDelete}
        onToggleVisibility={handleToggleVisibility}
        withAccordion={false}
      />
    </SectionCard>
  );
}
