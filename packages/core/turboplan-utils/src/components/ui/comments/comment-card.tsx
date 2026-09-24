"use client";

import { useState } from "react";

import { format } from "date-fns";
import {
  Bot,
  ChevronDown,
  Eye,
  Lock,
  MoreHorizontal,
  Trash2,
} from "lucide-react";

import { cn } from "../../../tailwind";
import {
  generateDisplayName,
  generateInitials,
  generateInitialsFromName,
} from "../../../user";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "../avatar";
import { Button } from "../button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../dropdown";
import { CommentInput } from "./comment-input";
import { CommentReply } from "./comment-reply";
import type { CommentData, CommentPermissions } from "./types";

export interface CommentCardProps {
  comment: CommentData;
  permissions: CommentPermissions;
  readOnly?: boolean;
  /** Hide the visibility indicator (eye/lock icon) */
  hideVisibilityIndicator?: boolean;
  onReply?: (parentCommentId: string, content: string) => Promise<void>;
  onDelete?: (commentId: string) => Promise<void>;
  onToggleVisibility?: (commentId: string, isPublic: boolean) => Promise<void>;
}

export function CommentCard({
  comment,
  permissions,
  readOnly = false,
  hideVisibilityIndicator = false,
  onReply,
  onDelete,
  onToggleVisibility,
}: CommentCardProps) {
  const [isReplying, setIsReplying] = useState(false);
  const [replyMention, setReplyMention] = useState("");
  const [showReplies, setShowReplies] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { currentUserId, canModerate } = permissions;
  const isAuthor = currentUserId === comment.userId;
  const canEdit = isAuthor || canModerate;

  // For auto-responses, use the autoResponderName; otherwise build from author info
  const displayName =
    comment.isAutoResponse && comment.autoResponderName
      ? comment.autoResponderName
      : generateDisplayName(comment.author, comment.author.email);

  // For auto-responses, use first letter of responder name; otherwise use author initials
  const displayInitials =
    comment.isAutoResponse && comment.autoResponderName
      ? generateInitialsFromName(comment.autoResponderName)
      : generateInitials(comment.author);

  const roleBadge = comment.author.jobTitle || null;

  const formattedDate = format(new Date(comment.createdAt), "MMM d");
  const replyCount = comment.replies?.length || 0;

  const handleReplySubmit = async (content: string) => {
    if (!onReply) return;
    setIsSubmitting(true);
    try {
      await onReply(comment.id, content);
      setIsReplying(false);
      setReplyMention("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReplyToReply = (mentionName: string) => {
    setReplyMention(`@${mentionName} `);
    setIsReplying(true);
  };

  const handleCancelReply = () => {
    setIsReplying(false);
    setReplyMention("");
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setIsSubmitting(true);
    try {
      await onDelete(comment.id);
    } finally {
      setIsSubmitting(false);
      setShowDeleteDialog(false);
    }
  };

  const handleToggleVisibility = async () => {
    if (!onToggleVisibility) return;
    await onToggleVisibility(comment.id, !comment.isPublic);
  };

  return (
    <div className="group">
      <div className="flex gap-3">
        {/* Avatar */}
        <Avatar className="h-8 w-8 shrink-0">
          {!comment.isAutoResponse && comment.author.avatarUrl && (
            <AvatarImage src={comment.author.avatarUrl} alt={displayName} />
          )}
          <AvatarFallback className="bg-brandAlt-400 text-xs text-white">
            {displayInitials}
          </AvatarFallback>
        </Avatar>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {/* Header */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{displayName}</span>

            {/* Auto-response badge */}
            {comment.isAutoResponse && (
              <span
                className="flex items-center gap-1 rounded bg-neutral-900 px-1.5 py-0.5 text-[10px] leading-[14px] text-white"
                title="Automated acknowledgment"
              >
                <Bot className="h-3 w-3" />
                Auto
              </span>
            )}

            {/* Role badge (job title, department) */}
            {roleBadge && !comment.isAutoResponse && (
              <span className="rounded bg-neutral-900 px-1.5 py-0.5 text-[10px] leading-[14px] text-white">
                {roleBadge}
              </span>
            )}

            {/* Visibility indicator */}
            {!hideVisibilityIndicator && (
              <span
                className="text-muted-foreground"
                title={
                  comment.isPublic
                    ? "Visible to public"
                    : "Only visible on dashboard"
                }
              >
                {comment.isPublic ? (
                  <Eye className="h-3.5 w-3.5" />
                ) : (
                  <Lock className="h-3.5 w-3.5" />
                )}
              </span>
            )}
          </div>

          {/* Comment content */}
          <p className="mt-1 text-sm whitespace-pre-wrap break-words">
            {comment.content}
          </p>

          {/* Footer actions */}
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            {/* Date */}
            <span>{formattedDate}</span>

            {/* Reply count toggle */}
            {replyCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setShowReplies(!showReplies)}
              >
                {replyCount} {replyCount === 1 ? "Reply" : "Replies"}
                <ChevronDown
                  className={cn(
                    "ml-1 h-3 w-3 transition-transform",
                    showReplies && "rotate-180",
                  )}
                />
              </Button>
            )}

            {/* Reply button (only when not read-only) */}
            {!readOnly && currentUserId && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setReplyMention("");
                  setIsReplying(!isReplying);
                }}
                disabled={isSubmitting}
              >
                Reply
              </Button>
            )}

            {/* Actions menu (three dots) */}
            {canEdit && !readOnly && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1 text-muted-foreground hover:text-foreground"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleToggleVisibility}>
                    {comment.isPublic ? (
                      <>
                        <Lock className="mr-2 h-4 w-4" />
                        Make private
                      </>
                    ) : (
                      <>
                        <Eye className="mr-2 h-4 w-4" />
                        Make public
                      </>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setShowDeleteDialog(true)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Replies and reply input */}
          {(showReplies && comment.replies && comment.replies.length > 0) ||
          (isReplying && !readOnly) ? (
            <div className="mt-3 space-y-3 border-l-2 border-muted pl-4">
              {/* Existing replies */}
              {showReplies &&
                comment.replies?.map((reply) => (
                  <CommentReply
                    key={reply.id}
                    comment={reply}
                    permissions={permissions}
                    readOnly={readOnly}
                    hideVisibilityIndicator={hideVisibilityIndicator}
                    onReplyToReply={onReply ? handleReplyToReply : undefined}
                    onDelete={onDelete}
                    onToggleVisibility={onToggleVisibility}
                  />
                ))}

              {/* Reply input at the bottom */}
              {isReplying && !readOnly && (
                <CommentInput
                  placeholder="Write a reply..."
                  initialValue={replyMention}
                  onSubmit={handleReplySubmit}
                  onCancel={handleCancelReply}
                  isSubmitting={isSubmitting}
                  autoFocus
                />
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete comment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this comment
              {replyCount > 0 &&
                ` and its ${replyCount} ${replyCount === 1 ? "reply" : "replies"}`}
              . This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
