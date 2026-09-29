"use client";

import { useEffect, useMemo, useState } from "react";

import { UserCheck, UserPlus, Users } from "lucide-react";
import type { User } from "next-auth";

import { Action, type EntityTypeType } from "@wildfires-org/turboplan-rbac";
import { useEntityPermission } from "@wildfires-org/turboplan-rbac/hooks";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@wildfires-org/turboplan-utils";
import {
  AddMemberForm,
  type MemberRoleType,
  type MembersDialogMode,
  type TaskContext,
  useMemberManagement,
} from "@wildfires-org/turboplan-workspace/client";

import { toast } from "@/components/toast";
import { Separator } from "@/components/ui/separator";
import { useSeatBillingActive } from "@/hooks/use-seat-billing-active";
import { DeleteMemberConfirmDialog } from "./delete-member-confirm-dialog";
import { MembersListSection } from "./members-list-section";
import { PendingInvitationsSection } from "./pending-invitations-section";
import { getDialogDescription, getDialogTitle, getEntityLabel } from "./utils";

interface ManageMembersDialogProps {
  entityType: EntityTypeType;
  entityId: string;
  entityName: string;
  user: User | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional task context when opening from a task/milestone */
  taskContext?: TaskContext;
  /** Dialog mode: "manage" for member management, "assign" for task assignment */
  mode?: MembersDialogMode;
  /** Currently assigned user IDs (for pre-selection in assign mode) */
  selectedAssignees?: Array<{ id: string }>;
  /** Callback when assignment is saved (assign mode only) */
  onAssign?: (userIds: string[]) => void;
}

export const ManageMembersDialog = ({
  entityType,
  entityId,
  entityName,
  user,
  open,
  onOpenChange,
  taskContext,
  mode = "manage",
  selectedAssignees = [],
  onAssign,
}: ManageMembersDialogProps) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  // Assignment mode state
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(
    new Set(),
  );

  const isAssignMode = mode === "assign";
  const entityLabel = getEntityLabel(entityType);

  // Memoize assignee IDs to create stable dependency for useEffect
  // This prevents unnecessary re-renders when selectedAssignees array reference changes
  const initialAssigneeIds = useMemo(
    () => selectedAssignees.map((u) => u.id).join(","),
    [selectedAssignees],
  );

  // Initialize selected users when dialog opens in assign mode
  useEffect(() => {
    if (open && isAssignMode) {
      const ids = initialAssigneeIds ? initialAssigneeIds.split(",") : [];
      setSelectedUserIds(new Set(ids.filter(Boolean)));
    }
  }, [open, isAssignMode, initialAssigneeIds]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setShowAddForm(false);
      setSelectedUserIds(new Set());
    }
  }, [open]);

  // Check if user can manage members
  const { hasPermission: canManageMembers } = useEntityPermission({
    userId: user?.id,
    entityType,
    entityId,
    action: Action.MANAGE_MEMBERS,
  });

  // Whether adding an Owner/Editor here moves the org's seat-based bill. Fetched
  // only while the add form is open; resolves the owning org from any entity
  // (org/office/project) and is false when there is no active subscription.
  const seatBillingActive = useSeatBillingActive(
    entityType,
    entityId,
    open && showAddForm,
  );

  // Use shared member management hook
  const {
    members,
    pendingInvitations,
    isLoading,
    mutate,
    addMember,
    isAdding,
    updateMemberRole,
    isUpdating,
    removeMember,
    isRemoving,
    resendInvitation,
    isResending,
    revokeInvitation,
    isRevoking,
  } = useMemberManagement({
    entityType,
    entityId,
    enabled: open,
  });

  // Toggle user selection (assign mode)
  const handleToggleUser = (userId: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  // Handle assign button click
  const handleAssign = () => {
    if (onAssign) {
      onAssign(Array.from(selectedUserIds));
      onOpenChange(false);
    }
  };

  const handleAddMember = async (data: {
    email: string;
    role: MemberRoleType;
  }) => {
    try {
      // Include task assignment if context is provided
      const memberData = taskContext
        ? {
            ...data,
            taskAssignment: {
              taskId: taskContext.taskId,
              milestoneId: taskContext.milestoneId,
            },
          }
        : data;

      await addMember(memberData);

      const successMessage = taskContext?.taskTitle
        ? `User added and assigned to "${taskContext.taskTitle}"!`
        : taskContext?.milestoneTitle
          ? `User added and assigned to "${taskContext.milestoneTitle}"!`
          : "User added successfully!";

      toast({
        type: "success",
        description: successMessage,
      });

      setShowAddForm(false);
      mutate();
    } catch (error) {
      console.error("Error adding user:", error);
      toast({
        type: "error",
        description:
          error instanceof Error ? error.message : "Failed to add user",
      });
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await updateMemberRole({ userId, role: newRole });

      toast({
        type: "success",
        description: "Role updated successfully!",
      });

      mutate();
    } catch (error) {
      console.error("Error updating role:", error);
      toast({
        type: "error",
        description:
          error instanceof Error ? error.message : "Failed to update role",
      });
    }
  };

  const handleRemoveMember = async (userId: string) => {
    try {
      await removeMember({ userId });

      toast({
        type: "success",
        description: "Member removed successfully!",
      });

      setDeletingUserId(null);
      mutate();
    } catch (error) {
      console.error("Error removing member:", error);
      toast({
        type: "error",
        description:
          error instanceof Error ? error.message : "Failed to remove member",
      });
      setDeletingUserId(null);
    }
  };

  const handleResendInvitation = async (invitationId: string) => {
    try {
      await resendInvitation({ invitationId });

      toast({
        type: "success",
        description: "Invitation resent successfully!",
      });

      mutate();
    } catch (error) {
      console.error("Error resending invitation:", error);
      toast({
        type: "error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to resend invitation",
      });
    }
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    try {
      await revokeInvitation({ invitationId });

      toast({
        type: "success",
        description: "Invitation revoked successfully!",
      });

      mutate();
    } catch (error) {
      console.error("Error revoking invitation:", error);
      toast({
        type: "error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to revoke invitation",
      });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto p-6 sm:p-7">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isAssignMode ? (
                <UserCheck aria-hidden className="size-5 text-brand-800" />
              ) : (
                <Users aria-hidden className="size-5 text-brand-800" />
              )}
              {getDialogTitle(isAssignMode, taskContext, entityName)}
            </DialogTitle>
            <DialogDescription>
              {getDialogDescription(
                isAssignMode,
                canManageMembers,
                entityLabel,
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Add Member Button - Visible in both modes if user can manage */}
            {canManageMembers && !showAddForm && (
              <Button
                onClick={() => setShowAddForm(true)}
                variant="glass"
                className="w-full"
              >
                <UserPlus className="mr-2 size-4" />
                {isAssignMode ? "Invite New Member" : "Add Member"}
              </Button>
            )}

            {/* Add Member Form */}
            {canManageMembers && showAddForm && (
              <AddMemberForm
                onSubmit={handleAddMember}
                onCancel={() => setShowAddForm(false)}
                searchScope={{ entityType, entityId }}
                isSubmitting={isAdding}
                taskContext={taskContext}
                seatBillingActive={seatBillingActive}
              />
            )}

            {canManageMembers && showAddForm && <Separator />}

            {/* Members List */}
            <MembersListSection
              members={members}
              isLoading={isLoading}
              isAssignMode={isAssignMode}
              canManageMembers={canManageMembers}
              currentUserId={user?.id}
              selectedUserIds={selectedUserIds}
              onToggleUser={handleToggleUser}
              onRoleChange={handleRoleChange}
              onRemove={(userId) => setDeletingUserId(userId)}
              isUpdating={isUpdating}
              isRemoving={isRemoving}
            />

            {/* Pending Invitations - Only show in manage mode */}
            {!isAssignMode && (
              <PendingInvitationsSection
                invitations={pendingInvitations}
                onResend={handleResendInvitation}
                onRevoke={handleRevokeInvitation}
                canManage={canManageMembers}
                isResending={isResending}
                isRevoking={isRevoking}
              />
            )}
          </div>

          <DialogFooter className="gap-2 sm:space-x-0">
            {isAssignMode ? (
              <>
                <Button variant="glass" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button variant="brand" onClick={handleAssign}>
                  <UserCheck className="mr-2 size-4" />
                  Assign ({selectedUserIds.size})
                </Button>
              </>
            ) : (
              <Button variant="glass" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation - Only used in manage mode */}
      <DeleteMemberConfirmDialog
        open={!!deletingUserId}
        onOpenChange={(open) => !open && setDeletingUserId(null)}
        onConfirm={() => deletingUserId && handleRemoveMember(deletingUserId)}
        isRemoving={isRemoving}
        entityLabel={entityLabel}
      />
    </>
  );
};
