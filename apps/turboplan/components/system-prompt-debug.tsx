"use client";

import { useState } from "react";

import { Terminal } from "lucide-react";

import { getAppEnv } from "@wildfires-org/turboplan-env";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@wildfires-org/turboplan-utils";

interface SystemPromptDebugProps {
  projectId?: string;
  chatId?: string;
}

export function SystemPromptDebug({
  projectId,
  chatId,
}: SystemPromptDebugProps) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (getAppEnv() === "production") return null;

  const handleOpen = async () => {
    setOpen(true);
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (projectId) params.set("projectId", projectId);
      if (chatId) params.set("chatId", chatId);

      const res = await fetch(`/api/debug/system-prompt?${params}`);
      const data = await res.json();
      setPrompt(data.prompt);
    } catch {
      setPrompt("Failed to fetch system prompt.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="flex justify-center">
        <Button
          variant="outline"
          size="sm"
          onClick={handleOpen}
          className="gap-2 text-xs text-muted-foreground border-dashed"
        >
          <Terminal className="size-3" />
          View System Prompt
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>System Prompt</DialogTitle>
          </DialogHeader>
          <div className="overflow-auto flex-1">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : (
              <pre className="whitespace-pre-wrap text-sm leading-relaxed p-4 bg-muted rounded-md">
                {prompt}
              </pre>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
