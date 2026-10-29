"use client";

import { useMemo } from "react";

import { TextCursorInput } from "lucide-react";

import { Button } from "@wildfires-org/turboplan-utils";

import { collectPlaceholders } from "@/lib/placeholder-fill";

interface DocumentPlaceholdersButtonProps {
  content: string;
  disabled?: boolean;
  onOpen: () => void;
}

// Header icon button that opens the "Fill in placeholders" sheet, with a badge
// counting the document's unique open placeholders. Hidden when there are none.
export function DocumentPlaceholdersButton({
  content,
  disabled = false,
  onOpen,
}: DocumentPlaceholdersButtonProps) {
  const count = useMemo(() => collectPlaceholders(content).length, [content]);

  if (count === 0) {
    return null;
  }

  return (
    <Button
      variant="outline"
      className="relative h-fit p-2 dark:hover:bg-zinc-700"
      aria-label="Fill placeholders"
      title="Fill placeholders"
      disabled={disabled}
      onClick={onOpen}
    >
      <TextCursorInput size={18} />
      <span
        aria-hidden
        className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-yellow-400 px-1 text-[10px] font-semibold leading-none tabular-nums text-yellow-950"
      >
        {count > 99 ? "99+" : count}
      </span>
    </Button>
  );
}
