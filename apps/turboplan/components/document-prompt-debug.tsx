"use client";

import { useState } from "react";

import { Copy, Terminal } from "lucide-react";
import { toast } from "sonner";

import { getAppEnv } from "@wildfires-org/turboplan-env";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@wildfires-org/turboplan-utils";

import { cn } from "@/lib/utils";

interface DocumentPromptDebugProps {
  kind: string;
  documentId: string;
}

interface DocumentPromptResponse {
  toolDescription: string;
  creationPrompt: string;
  updatePrompt: string;
}

interface RuntimeContext {
  userContext?: string;
  projectContext?: string;
}

const SECTION_LABELS: Record<string, string> = {
  "Document title:": "title",
  "Additional context from the user:": "user-request",
  "## Project Context": "project-context",
  "# PROJECT CONTEXT": "project-context",
  "Source:": "source",
};

const highlightContent = (text: string) => {
  const lines = text.split("\n");

  return lines.map((line, i) => {
    for (const [marker, type] of Object.entries(SECTION_LABELS)) {
      if (line.includes(marker)) {
        if (type === "title") {
          return (
            <span key={i} className="text-purple-400 font-semibold">
              {line}
              {"\n"}
            </span>
          );
        }
        if (type === "user-request") {
          return (
            <span key={i} className="text-yellow-400 font-semibold">
              {line}
              {"\n"}
            </span>
          );
        }
        if (type === "project-context") {
          return (
            <span key={i} className="text-blue-400 font-semibold">
              {line}
              {"\n"}
            </span>
          );
        }
        if (type === "source") {
          return (
            <span key={i} className="text-green-400">
              {line}
              {"\n"}
            </span>
          );
        }
      }
    }

    if (line.startsWith("- **")) {
      return (
        <span key={i} className="text-blue-300">
          {line}
          {"\n"}
        </span>
      );
    }

    if (line.startsWith("#")) {
      return (
        <span key={i} className="text-orange-400 font-semibold">
          {line}
          {"\n"}
        </span>
      );
    }

    return (
      <span key={i}>
        {line}
        {"\n"}
      </span>
    );
  });
};

interface PromptSectionProps {
  title: string;
  content: string;
  borderClass?: string;
}

const PromptSection = ({ title, content, borderClass }: PromptSectionProps) => {
  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    toast.success("Copied to clipboard!");
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-6 gap-1 text-xs text-muted-foreground"
        >
          <Copy className="size-3" />
          Copy
        </Button>
      </div>
      <pre
        className={cn(
          "whitespace-pre-wrap text-sm leading-relaxed p-4 bg-muted rounded-md",
          borderClass,
        )}
      >
        {highlightContent(content)}
      </pre>
    </div>
  );
};

export const DocumentPromptDebug = ({
  kind,
  documentId,
}: DocumentPromptDebugProps) => {
  const [open, setOpen] = useState(false);
  const [prompts, setPrompts] = useState<DocumentPromptResponse | null>(null);
  const [runtimeContext, setRuntimeContext] = useState<RuntimeContext>({});
  const [loading, setLoading] = useState(false);

  if (getAppEnv() === "production") {
    return null;
  }

  const handleOpen = async () => {
    setOpen(true);
    setLoading(true);

    try {
      const stored = localStorage.getItem(`doc-debug-${documentId}`);
      if (stored) {
        setRuntimeContext(JSON.parse(stored));
      }
    } catch {
      // noop
    }

    try {
      const params = new URLSearchParams({ kind });
      const res = await fetch(`/api/debug/document-prompt?${params}`);
      const data = await res.json();
      setPrompts(data);
    } catch {
      setPrompts({
        toolDescription: "",
        creationPrompt: "Failed to fetch document prompts.",
        updatePrompt: "",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyAll = () => {
    const parts = [
      prompts?.toolDescription &&
        `=== Tool Description ===\n${prompts.toolDescription}`,
      prompts?.creationPrompt &&
        `=== Creation Prompt ===\n${prompts.creationPrompt}`,
      prompts?.updatePrompt && `=== Update Prompt ===\n${prompts.updatePrompt}`,
      runtimeContext.userContext &&
        `=== User Context ===\n${runtimeContext.userContext}`,
      runtimeContext.projectContext &&
        `=== Project Context ===\n${runtimeContext.projectContext}`,
    ].filter(Boolean);

    navigator.clipboard.writeText(parts.join("\n\n"));
    toast.success("All prompts copied!");
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleOpen}
        className="gap-2 text-xs text-muted-foreground border-dashed"
      >
        <Terminal className="size-3" />
        Prompt
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
          <DialogHeader className="flex flex-row items-center justify-between">
            <DialogTitle>Document Prompts — {kind}</DialogTitle>
            {!loading && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyAll}
                className="gap-1 text-xs"
              >
                <Copy className="size-3" />
                Copy All
              </Button>
            )}
          </DialogHeader>
          <div className="overflow-auto flex-1 space-y-6">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : (
              <>
                {prompts?.toolDescription ? (
                  <PromptSection
                    title="Tool Description (what main chat agent sees)"
                    content={prompts.toolDescription}
                  />
                ) : null}

                {prompts?.creationPrompt ? (
                  <PromptSection
                    title="Creation Prompt (system prompt for document generation)"
                    content={prompts.creationPrompt}
                  />
                ) : null}

                {prompts?.updatePrompt ? (
                  <PromptSection
                    title="Update Prompt (system prompt for document updates)"
                    content={prompts.updatePrompt}
                  />
                ) : null}

                {runtimeContext.userContext ? (
                  <PromptSection
                    title="User Context (passed by main agent at tool call)"
                    content={runtimeContext.userContext}
                    borderClass="border border-dashed border-yellow-500/50"
                  />
                ) : null}

                {runtimeContext.projectContext ? (
                  <PromptSection
                    title="Project Context (fetched server-side)"
                    content={runtimeContext.projectContext}
                    borderClass="border border-dashed border-blue-500/50"
                  />
                ) : null}

                {!runtimeContext.userContext &&
                !runtimeContext.projectContext ? (
                  <p className="text-xs text-muted-foreground italic">
                    No runtime context captured. Context is only stored when a
                    document is generated during this session.
                  </p>
                ) : null}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
