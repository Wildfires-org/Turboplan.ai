"use client";

import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@wildfires-org/turboplan-utils";

import { ClockRewind, CopyIcon, RedoIcon, UndoIcon } from "@/components/icons";
import { stripPlaceholderNotes } from "@/lib/placeholders";

interface ArtifactActionsMenuProps {
  content: string;
  currentVersionIndex: number;
  isCurrentVersion: boolean;
  handleVersionChange: (type: "next" | "prev" | "toggle" | "latest") => void;
  disabled?: boolean;
}

export function ArtifactActionsMenu({
  content,
  currentVersionIndex,
  isCurrentVersion,
  handleVersionChange,
  disabled = false,
}: ArtifactActionsMenuProps) {
  const isFirstVersion = currentVersionIndex === 0;

  const handleCopy = () => {
    navigator.clipboard.writeText(stripPlaceholderNotes(content));
    toast.success("Copied to clipboard!");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="h-fit p-2 dark:hover:bg-zinc-700"
          aria-label="Document actions"
          disabled={disabled}
        >
          <MoreHorizontal size={18} />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <DropdownMenuItem
          disabled={isFirstVersion}
          onClick={() => handleVersionChange("toggle")}
        >
          <ClockRewind size={16} />
          <span className="ml-2">View changes</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={isFirstVersion}
          onClick={() => handleVersionChange("prev")}
        >
          <UndoIcon size={16} />
          <span className="ml-2">Previous version</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={isCurrentVersion}
          onClick={() => handleVersionChange("next")}
        >
          <RedoIcon size={16} />
          <span className="ml-2">Next version</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={handleCopy}>
          <CopyIcon size={16} />
          <span className="ml-2">Copy to clipboard</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
