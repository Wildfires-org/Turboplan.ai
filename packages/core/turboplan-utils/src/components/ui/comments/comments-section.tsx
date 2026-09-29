"use client";

import { MessageSquare } from "lucide-react";

import { cn } from "../../../tailwind";
import { AccordionSection } from "../accordion-section";
import { Skeleton } from "../skeleton";
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
        // Comment rows at CommentCard's metrics: 32px avatar, name line,
        // body line, 24px action row.
        <div role="status" aria-label="Loading comments" className="space-y-6">
          {["w-3/4", "w-1/2"].map((bodyWidth) => (
            <div key={bodyWidth} className="flex gap-3">
              <Skeleton className="size-8 shrink-0 rounded-full" />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="flex h-5 items-center">
                  <Skeleton className="h-3 w-28" />
                </span>
                <span className="mt-1 flex h-5 items-center">
                  <Skeleton className={cn("h-3", bodyWidth)} />
                </span>
                <span className="mt-2 flex h-6 items-center">
                  <Skeleton className="h-3 w-16" />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && comments.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-center text-slate-600">
          <span className="mb-2 flex size-10 items-center justify-center rounded-full border border-white/85 bg-white/55 text-brand-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.95)]">
            <MessageSquare aria-hidden className="size-5" />
          </span>
          <p className="text-sm font-medium text-foreground">No comments yet</p>
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
