/**
 * Assignee redaction for readers who hold no role on the project.
 *
 * Task and milestone READ routes also admit the public-government fallback: any
 * signed-in user may read the tasks of a public project owned by a publicly
 * listed organization. Such a reader sees the plan, but not who is assigned —
 * `assignees` carries each person's email, so it is emptied for them. The
 * opaque `assigneeIds` stay; they cannot be resolved without project access.
 */

/** A task, a milestone, or a milestone carrying its tasks. */
export type AssigneeCarrier = {
  assignees?: unknown[];
  tasks?: AssigneeCarrier[];
};

/** Copy of `item` (and its nested tasks) with `assignees` emptied. */
export const withoutAssignees = <T extends AssigneeCarrier>(item: T): T => {
  if (!item.tasks) {
    return { ...item, assignees: [] };
  }
  return {
    ...item,
    assignees: [],
    tasks: item.tasks.map(withoutAssignees),
  };
};
