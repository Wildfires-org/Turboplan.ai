import { EntityType, type EntityTypeType } from "@wildfires-org/turboplan-rbac";
import type { TaskContext } from "@wildfires-org/turboplan-workspace/client";

export const getEntityLabel = (entityType: EntityTypeType): string => {
  switch (entityType) {
    case EntityType.ORGANIZATION:
      return "organization";
    case EntityType.OFFICE:
      return "office";
    case EntityType.PROJECT:
      return "project";
    default:
      return "[unknown entity type]";
  }
};

export const getDialogTitle = (
  isAssignMode: boolean,
  taskContext: TaskContext | undefined,
  entityName: string,
): string => {
  if (isAssignMode) {
    if (taskContext?.taskTitle) {
      return `Assign Members - ${taskContext.taskTitle}`;
    }
    if (taskContext?.milestoneTitle) {
      return `Assign Members - ${taskContext.milestoneTitle}`;
    }
    return "Assign Members";
  }
  return `Manage Members - ${entityName}`;
};

export const getDialogDescription = (
  isAssignMode: boolean,
  canManageMembers: boolean,
  entityLabel: string,
): string => {
  if (isAssignMode) {
    return "Select team members to assign to this task. You can also invite new members.";
  }
  return canManageMembers
    ? `Add, remove, or change roles for ${entityLabel} members.`
    : `View ${entityLabel} members and their roles.`;
};
