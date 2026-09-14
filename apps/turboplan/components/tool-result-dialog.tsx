"use client";

import { useState } from "react";

import { getAppEnv } from "@wildfires-org/turboplan-env";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  JsonBlock,
} from "@wildfires-org/turboplan-utils";

import { Tools } from "@/types/Tools";

const TOOL_LABELS: Partial<Record<Tools, string>> = {};

interface ToolResultDialogProps {
  toolName: Tools;
  result: Record<string, unknown>;
}

export const ToolResultDialog = ({
  toolName,
  result,
}: ToolResultDialogProps) => {
  const [open, setOpen] = useState(false);

  if (getAppEnv() === "production") {
    return null;
  }

  const label = TOOL_LABELS[toolName] ?? toolName;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="sm"
        className="text-xs text-muted-foreground hover:text-foreground border"
        onClick={() => setOpen(true)}
      >
        {label} result
      </Button>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{label} Result</DialogTitle>
        </DialogHeader>
        <JsonBlock
          label="Result"
          data={result}
          className="overflow-auto flex-1"
        />
      </DialogContent>
    </Dialog>
  );
};
