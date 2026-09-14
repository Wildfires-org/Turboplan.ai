"use client";

import React from "react";

import { RedoIcon, SkipForwardIcon, UndoIcon } from "lucide-react";

import { TasksContainer, TasksLoader } from "../components";
import { useArtifactTasksUI } from "../hooks";
import { TasksProvider } from "../providers";
import type {
  Artifact,
  ArtifactActionContext,
  TasksArtifactMetadata,
  UIArtifact,
} from "../types";

interface TasksStreamPart {
  type: string;
  tasks?: string;
  milestones?: string;
}

export const tasksArtifact: Artifact<"tasks", TasksArtifactMetadata> = {
  kind: "tasks",
  description:
    "A list of tasks and milestones with support for creation, editing, and progress tracking.",
  initialize: async ({
    setMetadata,
  }: {
    setMetadata: (metadata: TasksArtifactMetadata) => void;
  }) => {
    setMetadata({ tasks: [], milestones: [] });
  },
  onRestore: async () => {
    // This is called when a version is restored via "Restore this version" button
    // Note: Sync functionality would need to be implemented here if required
  },
  onStreamPart: ({ streamPart, setArtifact }) => {
    const part = streamPart as TasksStreamPart;
    if (part.type === "tasks" || part.type === "milestones") {
      setArtifact((prevState: UIArtifact) => {
        const parsedTasks = JSON.parse(part.tasks || "[]");
        const parsedMilestones = JSON.parse(part.milestones || "[]");
        return {
          ...prevState,
          metadata: {
            tasks: parsedTasks,
            milestones: parsedMilestones,
          },
        };
      });
    }
  },

  content: ({
    content,
    documentId,
    isCurrentVersion,
    onSaveContent,
  }: {
    content: string;
    documentId: string;
    isCurrentVersion: boolean;
    onSaveContent: (updatedContent: string, debounce: boolean) => void;
  }) => {
    // Use the artifact-specific hook that adapts to TasksContainer interface
    const tasks = useArtifactTasksUI({
      documentId,
      content,
      isCurrentVersion,
      onSaveContent,
    });

    // Handle loading states
    if (tasks.loading) {
      let loadingMessage = "Loading your project tasks...";

      if (!isCurrentVersion) {
        loadingMessage = "Loading document version...";
      } else if (documentId === "init") {
        loadingMessage = "Initializing your workspace...";
      } else if (tasks.displayMilestones.length === 0) {
        loadingMessage = "Setting up your project structure...";
      }

      return <TasksLoader message={loadingMessage} />;
    }

    // Use the consolidated TasksContainer with clean architecture
    return (
      <TasksProvider tasks={tasks}>
        <TasksContainer
          className="w-full h-full min-h-[600px]"
          isCurrentVersion={isCurrentVersion}
          isPreview={!isCurrentVersion}
        />
      </TasksProvider>
    );
  },

  actions: [
    {
      icon: <UndoIcon size={18} />,
      description: "Switch to previous version",
      onClick: async (
        context: ArtifactActionContext<TasksArtifactMetadata>,
      ) => {
        context.handleVersionChange("prev");
        context.setMetadata({
          ...context.metadata,
          selectedVersion: `prev-${Date.now()}`,
        });
      },
      isDisabled: (context: ArtifactActionContext<TasksArtifactMetadata>) => {
        return context.currentVersionIndex === 0;
      },
    },
    {
      icon: <RedoIcon size={18} />,
      description: "Switch to next version",
      onClick: async (
        context: ArtifactActionContext<TasksArtifactMetadata>,
      ) => {
        context.handleVersionChange("next");
        context.setMetadata({
          ...context.metadata,
          selectedVersion: `next-${Date.now()}`,
        });
      },
      isDisabled: (context: ArtifactActionContext<TasksArtifactMetadata>) => {
        return context.isCurrentVersion;
      },
    },
    {
      icon: <SkipForwardIcon size={18} />,
      description: "Go to latest version",
      onClick: async (
        context: ArtifactActionContext<TasksArtifactMetadata>,
      ) => {
        context.handleVersionChange("latest");
        context.setMetadata({
          ...context.metadata,
          selectedVersion: `latest-${Date.now()}`,
        });
      },
      isDisabled: (context: ArtifactActionContext<TasksArtifactMetadata>) => {
        return context.isCurrentVersion;
      },
    },
  ],

  toolbar: [],
};
