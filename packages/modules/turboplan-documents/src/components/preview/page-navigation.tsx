"use client";

import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@wildfires-org/turboplan-utils";

interface PageNavigationProps {
  currentPage: number;
  totalPages: number;
  onPrevious: () => void;
  onNext: () => void;
  onPageChange?: (page: number) => void;
}

export function PageNavigation({
  currentPage,
  totalPages,
  onPrevious,
  onNext,
  onPageChange,
}: PageNavigationProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const commitValue = useCallback(() => {
    const parsed = Number.parseInt(inputValue, 10);
    if (!Number.isNaN(parsed) && parsed >= 1 && parsed <= totalPages) {
      onPageChange?.(parsed);
    }
    setIsEditing(false);
  }, [inputValue, totalPages, onPageChange]);

  const handleClick = useCallback(() => {
    if (!onPageChange) return;
    setInputValue(String(currentPage));
    setIsEditing(true);
  }, [currentPage, onPageChange]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commitValue();
      } else if (e.key === "Escape") {
        e.preventDefault();
        setIsEditing(false);
      }
      e.stopPropagation();
    },
    [commitValue],
  );

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center gap-1 rounded-full border bg-background px-2 py-1 shadow-sm">
      <Button
        variant="ghost"
        size="icon"
        className="size-7 rounded-full"
        onClick={onPrevious}
        disabled={currentPage <= 1}
      >
        <ChevronLeft className="size-4" />
      </Button>
      {isEditing ? (
        <span className="px-1 text-sm tabular-nums text-muted-foreground">
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onBlur={commitValue}
            onKeyDown={handleKeyDown}
            className="w-8 rounded bg-muted px-1 text-center text-sm tabular-nums text-foreground outline-none focus:ring-1 focus:ring-ring"
          />{" "}
          of {totalPages}
        </span>
      ) : (
        <span
          className="px-1 text-sm tabular-nums text-muted-foreground"
          onClick={handleClick}
          role={onPageChange ? "button" : undefined}
          tabIndex={onPageChange ? 0 : undefined}
          onKeyDown={
            onPageChange
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") handleClick();
                }
              : undefined
          }
        >
          <span
            className={
              onPageChange
                ? "cursor-pointer rounded px-1 hover:bg-muted"
                : undefined
            }
          >
            {currentPage}
          </span>{" "}
          of {totalPages}
        </span>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="size-7 rounded-full"
        onClick={onNext}
        disabled={currentPage >= totalPages}
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}
