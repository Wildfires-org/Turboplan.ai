"use client";

import { useMemo, useState } from "react";

import type { MilestoneTaskSelection } from "../../types";

type MilestoneSelectionLike = {
  saved: boolean;
  tasks: Array<{ saved?: boolean }>;
};

type MilestoneSelectionState = {
  unsavedTaskIndices: number[];
  selectedUnsavedCount: number;
  isChecked: boolean;
  isIndeterminate: boolean;
};

export function useMilestoneTaskSelection<T extends MilestoneSelectionLike>(
  milestones: T[],
) {
  const [selectedByMilestone, setSelectedByMilestone] = useState<
    Map<number, Set<number>>
  >(new Map());

  const selectableTaskCount = useMemo(() => {
    return milestones.reduce((count, milestone) => {
      if (milestone.saved) return count;
      return (
        count + milestone.tasks.filter((task) => !(task.saved ?? false)).length
      );
    }, 0);
  }, [milestones]);

  const selectedTasksCount = useMemo(() => {
    return Array.from(selectedByMilestone.values()).reduce(
      (count, taskIndices) => count + taskIndices.size,
      0,
    );
  }, [selectedByMilestone]);

  const isAllSelected =
    selectableTaskCount > 0 && selectedTasksCount === selectableTaskCount;

  const getMilestoneState = (
    milestoneIndex: number,
  ): MilestoneSelectionState => {
    const milestone = milestones[milestoneIndex];
    if (!milestone) {
      return {
        unsavedTaskIndices: [],
        selectedUnsavedCount: 0,
        isChecked: false,
        isIndeterminate: false,
      };
    }

    const selectedTaskIndices =
      selectedByMilestone.get(milestoneIndex) ?? new Set<number>();
    const unsavedTaskIndices = milestone.tasks
      .map((_, taskIndex) => taskIndex)
      .filter((taskIndex) => !(milestone.tasks[taskIndex].saved ?? false));

    const selectedUnsavedCount = unsavedTaskIndices.filter((taskIndex) =>
      selectedTaskIndices.has(taskIndex),
    ).length;

    return {
      unsavedTaskIndices,
      selectedUnsavedCount,
      isChecked:
        unsavedTaskIndices.length > 0 &&
        selectedUnsavedCount === unsavedTaskIndices.length,
      isIndeterminate:
        selectedUnsavedCount > 0 &&
        selectedUnsavedCount < unsavedTaskIndices.length,
    };
  };

  const isTaskSelected = (milestoneIndex: number, taskIndex: number) => {
    const selectedTaskIndices = selectedByMilestone.get(milestoneIndex);
    return !!selectedTaskIndices?.has(taskIndex);
  };

  const toggleMilestone = (milestoneIndex: number) => {
    const milestone = milestones[milestoneIndex];
    if (!milestone || milestone.saved || milestone.tasks.length === 0) return;

    const unsavedTaskIndices = milestone.tasks
      .map((_, taskIndex) => taskIndex)
      .filter((taskIndex) => !(milestone.tasks[taskIndex].saved ?? false));

    if (unsavedTaskIndices.length === 0) return;

    setSelectedByMilestone((previous) => {
      const next = new Map(previous);
      const selectedTaskIndices = next.get(milestoneIndex);
      const selectedUnsavedCount = unsavedTaskIndices.filter((taskIndex) =>
        selectedTaskIndices?.has(taskIndex),
      ).length;

      if (selectedUnsavedCount === unsavedTaskIndices.length) {
        next.delete(milestoneIndex);
      } else {
        next.set(milestoneIndex, new Set(unsavedTaskIndices));
      }

      return next;
    });
  };

  const toggleTask = (milestoneIndex: number, taskIndex: number) => {
    const milestone = milestones[milestoneIndex];
    if (
      !milestone ||
      milestone.saved ||
      (milestone.tasks[taskIndex]?.saved ?? false)
    ) {
      return;
    }

    setSelectedByMilestone((previous) => {
      const next = new Map(previous);
      const selectedTaskIndices = new Set(next.get(milestoneIndex) ?? []);

      if (selectedTaskIndices.has(taskIndex)) {
        selectedTaskIndices.delete(taskIndex);
      } else {
        selectedTaskIndices.add(taskIndex);
      }

      if (selectedTaskIndices.size === 0) {
        next.delete(milestoneIndex);
      } else {
        next.set(milestoneIndex, selectedTaskIndices);
      }

      return next;
    });
  };

  const toggleAll = () => {
    setSelectedByMilestone((previous) => {
      if (previous.size > 0 && selectedTasksCount === selectableTaskCount) {
        return new Map();
      }

      const next = new Map<number, Set<number>>();

      milestones.forEach((milestone, milestoneIndex) => {
        if (milestone.saved) return;

        const unsavedTaskIndices = milestone.tasks
          .map((_, taskIndex) => taskIndex)
          .filter((taskIndex) => !(milestone.tasks[taskIndex].saved ?? false));

        if (unsavedTaskIndices.length > 0) {
          next.set(milestoneIndex, new Set(unsavedTaskIndices));
        }
      });

      return next;
    });
  };

  const clear = () => {
    setSelectedByMilestone(new Map());
  };

  const toSaveSelections = (): MilestoneTaskSelection[] => {
    return Array.from(selectedByMilestone.entries())
      .sort(([left], [right]) => left - right)
      .map(([milestoneIndex, taskIndices]) => ({
        milestoneIndex,
        taskIndices: [...taskIndices].sort((left, right) => left - right),
      }));
  };

  return {
    selectedByMilestone,
    selectedTasksCount,
    selectableTaskCount,
    isAllSelected,
    getMilestoneState,
    isTaskSelected,
    toggleAll,
    toggleMilestone,
    toggleTask,
    clear,
    toSaveSelections,
  };
}
