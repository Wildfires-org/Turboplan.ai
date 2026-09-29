"use client";

import { useEffect, useRef, useState } from "react";

import { Paperclip, Send } from "lucide-react";

import { cn } from "../../../tailwind";
import { Button } from "../button";
import { GLASS_INSET_CLASS } from "../glass-classes";

export interface CommentInputProps {
  placeholder?: string;
  /** Initial value for the input */
  initialValue?: string;
  onSubmit: (content: string) => Promise<void>;
  onCancel?: () => void;
  onAttach?: () => void;
  isSubmitting?: boolean;
  autoFocus?: boolean;
  className?: string;
  /** Compact mode for inline replies */
  compact?: boolean;
  /** Show attach document option */
  showAttach?: boolean;
}

export function CommentInput({
  placeholder = "Leave a comment",
  initialValue = "",
  onSubmit,
  onCancel,
  onAttach,
  isSubmitting = false,
  autoFocus = false,
  className,
  compact = false,
  showAttach = false,
}: CommentInputProps) {
  const [content, setContent] = useState(initialValue);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync content when initialValue changes (e.g., when mentioning a different user)
  useEffect(() => {
    setContent(initialValue);
  }, [initialValue]);

  const handleSubmit = async () => {
    const trimmedContent = content.trim();
    if (!trimmedContent || isSubmitting) return;

    await onSubmit(trimmedContent);
    setContent("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Submit on Enter
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    // Cancel on Escape
    if (e.key === "Escape" && onCancel) {
      e.preventDefault();
      onCancel();
    }
  };

  const canSubmit = content.trim().length > 0 && !isSubmitting;
  const showActions = isFocused || content.length > 0 || compact;

  return (
    <div className={cn("", className)}>
      <div
        className={cn(
          GLASS_INSET_CLASS,
          "flex items-center gap-1 rounded-xl px-4 py-3 focus-within:outline focus-within:outline-2 focus-within:outline-offset-0 focus-within:outline-brand-700/40",
        )}
      >
        <input
          ref={inputRef}
          type="text"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          disabled={isSubmitting}
          autoFocus={autoFocus}
          className="min-w-0 flex-1 bg-transparent text-xs leading-4 text-foreground outline-none placeholder:text-slate-500"
        />
        {showAttach && !showActions && (
          <button
            type="button"
            onClick={onAttach}
            disabled={isSubmitting}
            className="flex shrink-0 items-center gap-2 text-foreground hover:opacity-80 disabled:opacity-50"
          >
            <Paperclip className="h-4 w-4" />
            <span className="text-xs leading-5">Attach a document</span>
          </button>
        )}
        <div
          className={cn(
            "flex items-center gap-2 transition-opacity",
            showActions ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        >
          {onCancel && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={cn(
              "text-slate-500 hover:text-foreground",
              canSubmit && "text-brand-800 hover:text-brand-900",
            )}
          >
            <Send className="h-4 w-4" />
            <span className="sr-only">
              {isSubmitting ? "Posting..." : "Post"}
            </span>
          </Button>
        </div>
      </div>
    </div>
  );
}
