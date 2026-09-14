"use client";

import { MessageSquare } from "lucide-react";

import { AccordionSection } from "../accordion-section";
import { CommentCard } from "./comment-card";
import { CommentInput } from "./comment-input";
import { type CommentData, type CommentPermissions } from "./types";
import { getCommentCount } from "./utils";

export interface CommentsSectionProps {
  /** List of comments to display */
  comments: CommentData[];
  /** Permissions for the current user */
  permissions: CommentPermissions;
  /** Whether to show in read-only mode (hides input and action buttons) */
  readOnly?: boolean;
  /** Whether the section is loading */
  isLoading?: boolean;
  /** Hide the visibility indicator (eye/lock icon) on comments */
  hideVisibilityIndicator?: boolean;
  /** Callback when a new comment is submitted */
  onSubmit?: (content: string) => Promise<void>;
  /** Callback when a reply is submitted */
  onReply?: (parentCommentId: string, content: string) => Promise<void>;
  /** Callback when a comment is deleted */
  onDelete?: (commentId: string) => Promise<void>;
  /** Callback when comment visibility is toggled */
  onToggleVisibility?: (commentId: string, isPublic: boolean) => Promise<void>;
  /** Title for the section header */
  title?: string;
  /** Whether to wrap in AccordionSection (default: true) */
  withAccordion?: boolean;
  /** Default open state for accordion (default: true) */
  defaultOpen?: boolean;
}

export function CommentsSection({
  comments,
  permissions,
  readOnly = false,
  isLoading = false,
  hideVisibilityIndicator = false,
  onSubmit,
  onReply,
  onDelete,
  onToggleVisibility,
  title = "Comments",
  withAccordion = true,
  defaultOpen = true,
}: CommentsSectionProps) {
  // Calculate total comment count (including replies)
  const totalCount = getCommentCount(comments);

  const content = (
    <div className="space-y-6">
      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <span className="text-sm">Loading comments...</span>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && comments.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
          <MessageSquare className="mb-2 h-8 w-8 opacity-50" />
          <p className="text-sm">No comments yet</p>
          {!readOnly && permissions.currentUserId && (
            <p className="mt-1 text-xs">Be the first to leave a comment!</p>
          )}
        </div>
      )}

      {/* Comments list */}
      {!isLoading && comments.length > 0 && (
        <div className="space-y-6">
          {comments.map((comment) => (
            <CommentCard
              key={comment.id}
              comment={comment}
              permissions={permissions}
              readOnly={readOnly}
              hideVisibilityIndicator={hideVisibilityIndicator}
              onReply={onReply}
              onDelete={onDelete}
              onToggleVisibility={onToggleVisibility}
            />
          ))}
        </div>
      )}

      {/* Comment input at bottom (only show when not read-only and user is logged in) */}
      {!readOnly && permissions.currentUserId && onSubmit && (
        <CommentInput onSubmit={onSubmit} placeholder="Leave a comment" />
      )}
    </div>
  );

  if (!withAccordion) {
    return content;
  }

  return (
    <AccordionSection
      title={title}
      defaultOpen={defaultOpen}
      count={totalCount}
    >
      {content}
    </AccordionSection>
  );
}
