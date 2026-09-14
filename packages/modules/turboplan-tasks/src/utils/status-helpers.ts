import { TaskStatus } from "../types";

export const getStatusText = (status: TaskStatus | string): string => {
  switch (status) {
    case TaskStatus.DRAFT:
      return "Initiate";
    case TaskStatus.NOT_STARTED:
      return "Not Started";
    case TaskStatus.IN_PROGRESS:
      return "In Progress";
    case TaskStatus.COMPLETED:
      return "Complete";
    case TaskStatus.DELAYED:
      return "Delayed";
    default:
      return "Not Started";
  }
};

export const getStatusIcon = (status: TaskStatus | string): string => {
  switch (status) {
    case TaskStatus.DRAFT:
      return "⚡";
    case TaskStatus.NOT_STARTED:
      return "⭕";
    case TaskStatus.IN_PROGRESS:
      return "🔄";
    case TaskStatus.COMPLETED:
      return "✅";
    case TaskStatus.DELAYED:
      return "⏰";
    default:
      return "⭕";
  }
};
