"use client";

import { useState } from "react";

import { CheckSquare, Info, Loader2, Milestone } from "lucide-react";

import {
  Button,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@wildfires-org/turboplan-utils";

import type { UserSearchScope } from "../hooks/use-user-search";
import { MemberRole, type MemberRoleType } from "../types";
import { type SelectedUserValue, UserSelector } from "./user-selector";

/**
 * Task context passed when opening the dialog from a task/milestone
 */
export interface TaskContext {
  taskId?: string;
  milestoneId?: string;
  taskTitle?: string;
  milestoneTitle?: string;
}

interface AddMemberFormProps {
  onSubmit: (data: { email: string; role: MemberRoleType }) => Promise<void>;
  onCancel: () => void;
  /** Entity the user search runs for (see UserSelector) */
  searchScope: UserSearchScope;
  isSubmitting?: boolean;
  defaultRole?: MemberRoleType;
  /** Optional task context when inviting from a task/milestone */
  taskContext?: TaskContext;
  /**
   * When true, the owning organization has an active subscription, so adding an
   * Owner/Editor consumes a paid seat. Drives the seat-billing notice.
   */
  seatBillingActive?: boolean;
}

/**
 * Form component for adding new members to an entity (organization, office, or project)
 *
 * Features searchable user selection with autocomplete and "Create and invite" option.
 *
 * @example
 * ```tsx
 * <AddMemberForm
 *   onSubmit={async (data) => {
 *     await addMember(data);
 *   }}
 *   onCancel={() => setShowForm(false)}
 *   searchScope={{ entityType: "project", entityId: projectId }}
 *   isSubmitting={isAdding}
 *   defaultRole="viewer"
 * />
 * ```
 */
export function AddMemberForm({
  onSubmit,
  onCancel,
  searchScope,
  isSubmitting = false,
  defaultRole = MemberRole.VIEWER,
  taskContext,
  seatBillingActive = false,
}: AddMemberFormProps) {
  const [selectedUsers, setSelectedUsers] = useState<SelectedUserValue[]>([]);
  const [role, setRole] = useState<MemberRoleType>(defaultRole);
  const [error, setError] = useState<string | null>(null);

  const hasTaskContext =
    taskContext && (taskContext.taskTitle || taskContext.milestoneTitle);

  // Owner/Editor members each occupy a paid seat; viewers do not. Only warn when
  // the org actually has active billing (a non-viewer add will move the bill).
  const showSeatBillingNotice = seatBillingActive && role !== MemberRole.VIEWER;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (selectedUsers.length === 0) {
      setError("Please select a user or enter an email address");
      return;
    }

    const selected = selectedUsers[0];
    const email = selected.email;

    await onSubmit({ email, role });
    setSelectedUsers([]);
  };

  return (
    <div className="space-y-4 rounded-2xl bg-brandAlt-100/80 p-4 ring-1 ring-inset ring-brandAlt-200/70 dark:bg-white/5 dark:ring-white/10">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Add New Member</h3>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-2">
          <Label className="text-sm">User</Label>
          <UserSelector
            value={selectedUsers}
            onChange={setSelectedUsers}
            searchScope={searchScope}
            placeholder="Search by name or email..."
            maxSelections={1}
            allowInvite={true}
            disabled={isSubmitting}
          />
          {error && <p className="text-xs text-error-700">{error}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="role" className="text-sm">
            Role
          </Label>
          <Select
            value={role}
            onValueChange={(value) => setRole(value as MemberRoleType)}
            disabled={isSubmitting}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={MemberRole.OWNER}>Owner</SelectItem>
              <SelectItem value={MemberRole.EDITOR}>Editor</SelectItem>
              <SelectItem value={MemberRole.VIEWER}>Viewer</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {showSeatBillingNotice && (
          <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-amber-900 ring-1 ring-inset ring-amber-200">
            <Info className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <p className="text-xs">
              Owner and Editor members each use a paid seat. Adding this member
              will add a seat to your subscription and adjust your next invoice
              (prorated). Viewers don&apos;t use a seat.
            </p>
          </div>
        )}

        {/* Task Assignment Info */}
        {hasTaskContext && (
          <div className="space-y-2 rounded-xl bg-white/70 p-3 dark:bg-white/5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Will be assigned to
            </p>
            {taskContext.taskTitle && (
              <div className="flex items-center gap-2 text-sm">
                <CheckSquare className="size-4 text-blue-500" />
                <span>
                  Task: <strong>{taskContext.taskTitle}</strong>
                </span>
              </div>
            )}
            {taskContext.milestoneTitle && (
              <div className="flex items-center gap-2 text-sm">
                <Milestone className="size-4 text-purple-500" />
                <span>
                  Milestone: <strong>{taskContext.milestoneTitle}</strong>
                </span>
              </div>
            )}
          </div>
        )}

        <Button
          type="submit"
          variant="brand"
          disabled={isSubmitting || selectedUsers.length === 0}
          className="w-full"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Adding...
            </>
          ) : (
            "Add Member"
          )}
        </Button>
      </form>
    </div>
  );
}
