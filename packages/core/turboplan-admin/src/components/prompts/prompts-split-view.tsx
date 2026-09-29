"use client";

import { useEffect, useMemo, useState } from "react";

import { motion } from "framer-motion";
import {
  ChevronRight,
  Code,
  FileText,
  FolderKanban,
  ListTodo,
  type LucideIcon,
  MessageSquare,
  MoreHorizontal,
  Search,
  Wrench,
} from "lucide-react";

import {
  PROMPT_CATEGORIES,
  type PromptCategory,
  PromptCategoryKey,
} from "@wildfires-org/turboplan-db/types";
import { getActivePromptVersion } from "@wildfires-org/turboplan-db/utils";
import {
  Badge,
  cn,
  ScrollArea,
  Skeleton,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@wildfires-org/turboplan-utils";

import { usePrompts } from "../../hooks/use-prompts";
import { PromptEditorWithHistory } from "./prompt-editor-with-history";

const CATEGORY_META: Record<
  PromptCategory,
  { icon: LucideIcon; color: string }
> = {
  [PromptCategoryKey.ProjectChat]: {
    icon: MessageSquare,
    color: "text-blue-500",
  },
  [PromptCategoryKey.Artifacts]: { icon: Code, color: "text-amber-500" },
  [PromptCategoryKey.ResearchAgent]: {
    icon: Search,
    color: "text-purple-500",
  },
  [PromptCategoryKey.Tasks]: { icon: ListTodo, color: "text-green-500" },
  [PromptCategoryKey.Tools]: { icon: Wrench, color: "text-orange-500" },
  [PromptCategoryKey.Project]: { icon: FolderKanban, color: "text-teal-500" },
  [PromptCategoryKey.Other]: { icon: MoreHorizontal, color: "text-zinc-500" },
};

const ALL_CATEGORY_KEYS = Object.keys(PROMPT_CATEGORIES) as PromptCategory[];

export function PromptsSplitView() {
  const { prompts, isLoading, error } = usePrompts();
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<
    Record<string, boolean>
  >(
    Object.fromEntries(ALL_CATEGORY_KEYS.map((key) => [key, true])) as Record<
      PromptCategory,
      boolean
    >,
  );

  // Group prompts by category, derived from PROMPT_CATEGORIES keys
  const promptsByCategory = useMemo(() => {
    const grouped = ALL_CATEGORY_KEYS.reduce(
      (acc, key) => {
        acc[key] = [];
        return acc;
      },
      {} as Record<PromptCategory, typeof prompts>,
    );

    for (const p of prompts) {
      const category =
        (p.category as PromptCategory) || PromptCategoryKey.Other;
      if (grouped[category]) {
        grouped[category].push(p);
      } else {
        grouped[PromptCategoryKey.Other].push(p);
      }
    }

    return grouped;
  }, [prompts]);

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  // Auto-select first prompt if none selected
  useEffect(() => {
    if (!selectedPrompt && prompts.length > 0) {
      setSelectedPrompt(prompts[0].name);
    }
  }, [prompts, selectedPrompt]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-[600px] text-red-500">
        Error loading prompts: {error}
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh/var(--ui-scale,1)-180px)] min-h-[600px] border rounded-lg overflow-hidden bg-background">
      {/* Left Sidebar - Categories & Prompts List */}
      <div className="w-80 border-r flex flex-col bg-muted/30">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            Prompts
          </h2>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2">
            {isLoading ? (
              <PromptsSidebarSkeleton />
            ) : (
              ALL_CATEGORY_KEYS.map((category) => {
                const categoryInfo = PROMPT_CATEGORIES[category];
                const categoryPrompts = promptsByCategory[category];
                const meta = CATEGORY_META[category];
                const Icon = meta.icon;
                const isExpanded = expandedCategories[category];

                if (categoryPrompts.length === 0) return null;

                return (
                  <div key={category} className="mb-2">
                    <button
                      type="button"
                      onClick={() => toggleCategory(category)}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted/50 transition-colors text-sm font-medium"
                    >
                      <ChevronRight
                        className={cn(
                          "size-4 transition-transform",
                          isExpanded && "rotate-90",
                        )}
                      />
                      <Icon className={cn("size-4", meta.color)} />
                      <span className="flex-1 text-left">
                        {categoryInfo.label}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {categoryPrompts.length}
                      </Badge>
                    </button>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="ml-4 mt-1 space-y-0.5"
                      >
                        {categoryPrompts.map((prompt) => {
                          const activeVersion = getActivePromptVersion(
                            prompt.versions,
                          );
                          const isSelected = selectedPrompt === prompt.name;

                          return (
                            <TooltipProvider
                              key={prompt.id}
                              delayDuration={300}
                            >
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setSelectedPrompt(prompt.name)
                                    }
                                    className={cn(
                                      "w-full text-left px-3 py-2 rounded-md text-sm transition-colors group",
                                      isSelected
                                        ? "bg-primary text-primary-foreground"
                                        : "hover:bg-muted",
                                    )}
                                  >
                                    <div className="font-medium truncate">
                                      {prompt.title}
                                    </div>
                                    <div
                                      className={cn(
                                        "text-xs truncate mt-0.5",
                                        isSelected
                                          ? "text-primary-foreground/70"
                                          : "text-muted-foreground",
                                      )}
                                    >
                                      <span className="font-mono">
                                        {prompt.name}
                                      </span>
                                      {activeVersion && (
                                        <span className="ml-2">
                                          v{activeVersion.version}
                                        </span>
                                      )}
                                    </div>
                                  </button>
                                </TooltipTrigger>
                                {prompt.description && (
                                  <TooltipContent
                                    side="right"
                                    className="max-w-xs"
                                  >
                                    <p>{prompt.description}</p>
                                  </TooltipContent>
                                )}
                              </Tooltip>
                            </TooltipProvider>
                          );
                        })}
                      </motion.div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Right Panel - Prompt Editor */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedPrompt ? (
          <ScrollArea className="flex-1">
            <div className="p-6">
              <PromptEditorWithHistory
                key={selectedPrompt}
                name={selectedPrompt}
              />
            </div>
          </ScrollArea>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <FileText className="size-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">Select a prompt</p>
              <p className="text-sm">
                Choose a prompt from the sidebar to view and edit
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PromptsSidebarSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-8 w-full" />
          <div className="ml-4 space-y-1">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
