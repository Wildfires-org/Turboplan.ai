"use client";

import { PanelRight, PanelRightDashed } from "lucide-react";

import {
  Button,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@wildfires-org/turboplan-utils";

interface SidebarPinButtonProps {
  isPinned: boolean;
  onToggle: () => void;
}

export function SidebarPinButton({
  isPinned,
  onToggle,
}: SidebarPinButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-6 shrink-0 rounded bg-neutral-100 p-1"
          onClick={onToggle}
        >
          {isPinned ? (
            <PanelRight className="size-4 text-green-600" />
          ) : (
            <PanelRightDashed className="size-4 text-muted-foreground" />
          )}
          <span className="sr-only">
            {isPinned ? "Unpin sidebar" : "Pin sidebar"}
          </span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right">
        {isPinned ? "Unpin sidebar" : "Pin sidebar"}
      </TooltipContent>
    </Tooltip>
  );
}
