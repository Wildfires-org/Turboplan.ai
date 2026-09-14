import React, { useEffect, useRef, useState } from "react";

import { Check, Network, Search, X } from "lucide-react";
import { useOnClickOutside } from "usehooks-ts";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  generateInitialsFromName,
  Input,
} from "@wildfires-org/turboplan-utils";

import type { MilestoneWithTasks, Task } from "../types";

interface TaskDependenciesModalProps {
  task: Task;
  milestones: MilestoneWithTasks[];
  isOpen: boolean;
  isLoading?: boolean;
  onClose: () => void;
  onSave: (taskId: string, dependencies: string[]) => void;
}

export const TaskDependenciesModal: React.FC<TaskDependenciesModalProps> = ({
  task,
  milestones,
  isOpen,
  isLoading = false,
  onClose,
  onSave,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [localSelectedTasks, setLocalSelectedTasks] = useState<Task[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(
    null,
  ) as React.RefObject<HTMLDivElement>;

  useEffect(() => {
    if (isOpen) {
      // Find selected tasks based on dependency IDs
      const selectedTasks = (task.dependencies || [])
        .map((depId) =>
          milestones
            .flatMap((milestone) => milestone.tasks)
            .find((t) => t.id === depId),
        )
        .filter(Boolean) as Task[];

      setLocalSelectedTasks(selectedTasks);
      setSearchTerm("");
      setShowSearchResults(false);
    }
  }, [isOpen, task.dependencies, milestones]);

  // Click outside to close search results
  useOnClickOutside(searchContainerRef, () => {
    if (showSearchResults) {
      setShowSearchResults(false);
    }
  });

  const SEARCH_LIMIT = 20;

  // Get all available tasks excluding the current task and completed tasks
  const availableTasks = milestones
    .flatMap((milestone) => milestone.tasks)
    .filter((t) => t.id !== task.id && t.status !== "completed");

  // Search results (only for dropdown)
  const searchResults =
    searchTerm.trim() === ""
      ? availableTasks.slice(0, SEARCH_LIMIT) // Show first 10 tasks when no search term
      : availableTasks
          .filter((availableTask) =>
            availableTask.title
              .toLowerCase()
              .includes(searchTerm.toLowerCase()),
          )
          .slice(0, SEARCH_LIMIT);

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    if (!showSearchResults) {
      setShowSearchResults(true);
    }
  };

  const handleSearchFocus = () => {
    setShowSearchResults(true);
  };

  const clearSearch = () => {
    setSearchTerm("");
    setShowSearchResults(false);
  };

  const isTaskSelected = (taskToCheck: Task) => {
    return localSelectedTasks.some(
      (selectedTask) => selectedTask.id === taskToCheck.id,
    );
  };

  const toggleTaskSelection = (taskToToggle: Task) => {
    setLocalSelectedTasks((prev) => {
      const isSelected = prev.some(
        (selectedTask) => selectedTask.id === taskToToggle.id,
      );
      if (isSelected) {
        return prev.filter(
          (selectedTask) => selectedTask.id !== taskToToggle.id,
        );
      } else {
        return [...prev, taskToToggle];
      }
    });
  };

  const handleSave = () => {
    const dependencyIds = localSelectedTasks.map((t) => t.id);
    onSave(task.id, dependencyIds);
    onClose();
  };

  const getMilestoneForTask = (taskId: string) => {
    return milestones.find((milestone) =>
      milestone.tasks.some((t) => t.id === taskId),
    );
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-2xl">
        <AlertDialogHeader>
          <div className="flex items-center justify-between">
            <AlertDialogTitle className="text-lg font-semibold">
              <div className="flex items-center gap-2">
                <Network className="h-5 w-5" />
                Manage Dependencies for "{task.title}"
              </div>
            </AlertDialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-6 w-6"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </AlertDialogHeader>

        <div className="space-y-4">
          {/* Selected Dependencies Section */}
          <div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Selected dependencies
            </div>
            <div className="max-h-40 overflow-y-auto space-y-2">
              {localSelectedTasks.map((selectedTask) => {
                const milestone = getMilestoneForTask(selectedTask.id);
                return (
                  <div
                    key={selectedTask.id}
                    className="flex items-center justify-between p-2 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800"
                  >
                    <div className="flex items-center gap-3">
                      {/* Task Icon */}
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-xs font-medium text-white">
                          {generateInitialsFromName(selectedTask.title)}
                        </div>
                      </div>

                      {/* Task Info */}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {selectedTask.title}
                        </div>
                        {milestone && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {milestone.title}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Remove Button */}
                    <button
                      onClick={() => toggleTaskSelection(selectedTask)}
                      className="flex-shrink-0 p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                      title="Remove dependency"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}

              {localSelectedTasks.length === 0 && (
                <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                  No dependencies selected
                </div>
              )}
            </div>
          </div>

          {/* Search Input */}
          <div className="relative" ref={searchContainerRef}>
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Search for tasks
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Click to browse tasks or type to search..."
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                onFocus={handleSearchFocus}
                className="pl-10 pr-10"
                disabled={isLoading}
              />
              {searchTerm && (
                <button
                  onClick={clearSearch}
                  className="absolute right-3 top-3 h-4 w-4 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Search Results Dropdown */}
            {showSearchResults && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-50 max-h-60 overflow-y-auto">
                {searchResults.map((availableTask) => {
                  const milestone = getMilestoneForTask(availableTask.id);
                  return (
                    <div
                      key={availableTask.id}
                      onClick={() => toggleTaskSelection(availableTask)}
                      className="flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        {/* Task Icon */}
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-xs font-medium text-white">
                            {generateInitialsFromName(availableTask.title)}
                          </div>
                        </div>

                        {/* Task Info */}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                            {availableTask.title}
                          </div>
                          {milestone && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {milestone.title}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Selection Indicator */}
                      {isTaskSelected(availableTask) && (
                        <Check className="h-4 w-4 text-blue-600" />
                      )}
                    </div>
                  );
                })}

                {searchResults.length === 0 && searchTerm.trim() !== "" && (
                  <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                    No tasks found for "{searchTerm}"
                  </div>
                )}

                {searchResults.length === 0 && searchTerm.trim() === "" && (
                  <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                    No tasks available
                  </div>
                )}

                {searchResults.length === SEARCH_LIMIT &&
                  searchTerm.trim() === "" && (
                    <div className="text-center py-2 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700">
                      Showing first {SEARCH_LIMIT} tasks. Type to search for
                      specific tasks.
                    </div>
                  )}

                {searchResults.length === SEARCH_LIMIT &&
                  searchTerm.trim() !== "" && (
                    <div className="text-center py-2 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700">
                      Showing first {SEARCH_LIMIT} results. Be more specific to
                      see others.
                    </div>
                  )}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <AlertDialogCancel asChild>
            <Button variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button onClick={handleSave} disabled={isLoading}>
              {isLoading ? "Saving..." : "Save Dependencies"}
            </Button>
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
};
