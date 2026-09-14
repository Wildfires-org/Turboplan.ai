"use client";

import { memo } from "react";

import { motion } from "framer-motion";

import { isTasksPackageEnabled } from "@wildfires-org/turboplan-feature-flags";
import { Button } from "@wildfires-org/turboplan-utils";

import type { ChatHelpers } from "@/hooks/use-chat-compat";

interface SuggestedActionsProps {
  chatId: string;
  append: ChatHelpers["append"];
}

// Suggestions that require artifacts/tasks feature
const taskSuggestions = [
  {
    title: "Create tasks",
    label: "for my new project",
    action: "Help me create a task list for my new project",
  },
  {
    title: "Help me plan",
    label: "project milestones",
    action: "Help me plan project milestones and deliverables",
  },
];

// General suggestions that work without artifacts
const generalSuggestions = [
  {
    title: "What should I consider",
    label: "when starting a restoration project?",
    action: "What should I consider when starting a restoration project?",
  },
  {
    title: "Explain how",
    label: "to organize project phases",
    action: "Explain how to organize project phases effectively",
  },
  {
    title: "Help me understand",
    label: "environmental compliance requirements",
    action:
      "Help me understand the key environmental compliance requirements for my project",
  },
  {
    title: "What are best practices",
    label: "for stakeholder engagement?",
    action:
      "What are best practices for stakeholder engagement in environmental projects?",
  },
];

function PureSuggestedActions({ chatId, append }: SuggestedActionsProps) {
  // Only include task-related suggestions if tasks feature is enabled
  const suggestedActions = isTasksPackageEnabled()
    ? [...taskSuggestions, ...generalSuggestions.slice(0, 2)]
    : generalSuggestions.slice(0, 4);

  return (
    <div
      data-testid="suggested-actions"
      className="grid sm:grid-cols-2 gap-2 w-full"
    >
      {suggestedActions.map((suggestedAction, index) => (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ delay: 0.05 * index }}
          key={`suggested-action-${suggestedAction.title}-${index}`}
          className={index > 1 ? "hidden sm:block" : "block"}
        >
          <Button
            variant="ghost"
            onClick={async () => {
              // No navigation - URL is managed by the parent component (project chat page)

              append({
                role: "user",
                content: suggestedAction.action,
              });
            }}
            className="text-left border rounded-xl px-4 py-3.5 text-sm flex-1 gap-1 sm:flex-col w-full h-auto justify-start items-start"
          >
            <span className="font-medium">{suggestedAction.title}</span>
            <span className="text-muted-foreground">
              {suggestedAction.label}
            </span>
          </Button>
        </motion.div>
      ))}
    </div>
  );
}

export const SuggestedActions = memo(PureSuggestedActions, () => true);
