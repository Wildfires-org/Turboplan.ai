/**
 * Artifact Tasks UI Adapter
 * Thin wrapper that adapts project tasks UI hook for artifact context
 * Avoids code duplication by reusing existing business logic
 */

import { useEffect } from "react";

import { useTaskStore } from "../stores/task-store";
import {
  type UseProjectTasksUIReturn,
  useProjectTasksUI,
} from "./useProjectTasksUI";

interface UseArtifactTasksUIConfig {
  documentId: string;
  content: string;
  isCurrentVersion: boolean;
  onSaveContent: (updatedContent: string, debounce: boolean) => void;
}

/**
 * Adapter hook that makes useProjectTasksUI work with artifact context
 * Handles artifact-specific initialization while reusing all UI logic
 */
export function useArtifactTasksUI({
  documentId,
  content,
  isCurrentVersion,
  onSaveContent: _onSaveContent, // Not used in current implementation
}: UseArtifactTasksUIConfig): UseProjectTasksUIReturn {
  const { initializeMilestones } = useTaskStore();

  // Parse content for current version artifacts
  useEffect(() => {
    if (content && isCurrentVersion) {
      try {
        const parsed = JSON.parse(content);
        if (parsed.milestones) {
          initializeMilestones(parsed.milestones);
        }
      } catch {
        // Content might not be JSON, that's okay
      }
    }
  }, [content, isCurrentVersion, initializeMilestones]);

  // Use the existing project tasks UI hook - it handles everything
  return useProjectTasksUI({
    projectId: documentId,
    context: "document",
  });
}
