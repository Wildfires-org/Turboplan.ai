import type { MilestoneWithTasks, RawDocumentMilestone, User } from "../types";

/**
 * Check if milestones need fallback assignee mapping
 */
export const needsFallbackMapping = (
  milestones: MilestoneWithTasks[],
  availableUsers: User[],
): boolean => {
  return (
    milestones.length > 0 &&
    availableUsers.length > 0 &&
    milestones.some(
      (m) =>
        !m.assignees ||
        (m.assignees.length === 0 && m.assigneeIds && m.assigneeIds.length > 0),
    )
  );
};

/**
 * Map assigneeIds to User objects using available users
 */
export const mapAssigneeIds = (
  assigneeIds: string[],
  availableUsers: User[],
): User[] => {
  return (assigneeIds || [])
    .map((id) => availableUsers.find((user) => user.id === id))
    .filter(Boolean) as User[];
};

/**
 * Apply fallback assignee mapping to milestones for current version
 */
export const applyFallbackMapping = (
  milestones: MilestoneWithTasks[],
  availableUsers: User[],
): MilestoneWithTasks[] => {
  return milestones.map((milestone) => ({
    ...milestone,
    assignees:
      milestone.assignees && milestone.assignees.length > 0
        ? milestone.assignees
        : mapAssigneeIds(milestone.assigneeIds || [], availableUsers),
    tasks: milestone.tasks.map((task) => ({
      ...task,
      assignees:
        task.assignees && task.assignees.length > 0
          ? task.assignees
          : mapAssigneeIds(task.assigneeIds || [], availableUsers),
    })),
  }));
};

/**
 * Map preview milestones from JSON content with assignee mapping
 */
export const mapPreviewMilestones = (
  rawMilestones: RawDocumentMilestone[],
  availableUsers: User[],
): MilestoneWithTasks[] => {
  return rawMilestones.map((milestone) => ({
    ...milestone,
    assignees: mapAssigneeIds(milestone.assigneeIds || [], availableUsers),
    tasks: (milestone.tasks || []).map((task) => ({
      ...task,
      assignees: mapAssigneeIds(task.assigneeIds || [], availableUsers),
    })),
  })) as unknown as MilestoneWithTasks[];
};

/**
 * Get display milestones based on current version status and content
 */
export const getDisplayMilestones = (
  isCurrentVersion: boolean,
  milestones: MilestoneWithTasks[],
  content: string,
  availableUsers: User[],
): MilestoneWithTasks[] => {
  if (isCurrentVersion) {
    // Show live database data for current version
    if (needsFallbackMapping(milestones, availableUsers)) {
      return applyFallbackMapping(milestones, availableUsers);
    }
    return milestones;
  } else {
    // Show preview data from JSON content for historical versions
    if (content) {
      try {
        const parsed = JSON.parse(content);
        const rawMilestones = parsed.milestones || [];
        return mapPreviewMilestones(rawMilestones, availableUsers);
      } catch (e) {
        console.error("Failed to parse content for preview:", e);
        return [];
      }
    }
    return [];
  }
};

/**
 * Check if milestones need data refresh for current version
 */
export const needsDataRefresh = (milestones: MilestoneWithTasks[]): boolean => {
  return (
    milestones.length > 0 &&
    milestones.some(
      (m) =>
        m.assigneeIds &&
        m.assigneeIds.length > 0 &&
        (!m.assignees || m.assignees.length === 0),
    )
  );
};
