"use client";

import { useCallback } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { ApiClient } from "@wildfires-org/turboplan-api-client";
import { EntityType } from "@wildfires-org/turboplan-rbac";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@wildfires-org/turboplan-utils";
import {
  MemberAssignRow,
  PendingInviteeRow,
  useMemberInvitation,
} from "@wildfires-org/turboplan-workspace/client";
import {
  type CreateOfficeClientFormData,
  createOfficeClientSchema,
  type Office,
  OfficeStatus,
} from "@wildfires-org/turboplan-workspace/types";

import { toast } from "@/components/toast";
import { AppUrls } from "@/lib/nav/urls";
import { sendInvitations } from "@/lib/send-invitations";

const apiClient = new ApiClient();

interface AddOfficeDialogProps {
  organizationId: string;
  organizationSlug: string;
  organizationName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AddOfficeDialog({
  organizationId,
  organizationSlug,
  organizationName,
  open,
  onOpenChange,
  onSuccess,
}: AddOfficeDialogProps) {
  const router = useRouter();
  const form = useForm<CreateOfficeClientFormData>({
    resolver: zodResolver(createOfficeClientSchema),
    defaultValues: {
      name: "",
      organizationId,
      status: OfficeStatus.ACTIVE,
    },
  });
  const {
    currentRole,
    excludedEmails,
    handleAssign,
    handleRemove,
    handleRoleChange,
    pendingInvitees,
    resetInvitations,
    selectedUsers,
    setCurrentRole,
    setSelectedUsers,
  } = useMemberInvitation();

  const resetState = useCallback(() => {
    form.reset();
    resetInvitations();
  }, [form, resetInvitations]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) resetState();
      onOpenChange(nextOpen);
    },
    [onOpenChange, resetState],
  );

  const handleSubmit = async (data: CreateOfficeClientFormData) => {
    try {
      const { data: newOffice, error } = await apiClient.post<Office>(
        "/api/offices",
        data,
      );

      if (error || !newOffice) {
        throw new Error(error || "Failed to create office");
      }

      // Send member invitations if any
      if (pendingInvitees.length > 0) {
        const inviteOfficeMember = async ({
          email,
          role,
        }: {
          email: string;
          role: string;
        }) => {
          const { data, error: inviteError } = await apiClient.post(
            `/api/offices/${newOffice.id}/members`,
            {
              email,
              role,
            },
          );

          if (inviteError) {
            throw new Error(inviteError);
          }

          return data;
        };

        const { failed: failedCount } = await sendInvitations(
          pendingInvitees,
          inviteOfficeMember,
        );
        if (failedCount > 0) {
          toast({
            type: "error",
            description: `Office created, but ${failedCount} invitation(s) failed.`,
          });
        } else {
          toast({
            type: "success",
            description: "Office created and members invited successfully",
          });
        }
      } else {
        toast({ type: "success", description: "Office created successfully" });
      }

      resetState();
      onSuccess();
      onOpenChange(false);

      // Redirect to the newly created office
      router.push(AppUrls.office(organizationSlug, newOffice.slug));
    } catch (error) {
      console.error("Error creating office:", error);
      toast({
        type: "error",
        description:
          error instanceof Error ? error.message : "Failed to create office",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[620px] gap-6 sm:rounded-2xl">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-4">
            <DialogTitle className="text-xl font-semibold leading-8 tracking-normal">
              Create New Office
            </DialogTitle>
            <span className="rounded bg-neutral-200 px-2 py-1 text-xs leading-4 text-gray-950">
              {organizationName}
            </span>
          </div>
          <DialogDescription className="text-gray-350">
            Add a new office to your organization.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          {/* Office */}
          <div className="space-y-1.5">
            <Label className="text-sm font-normal text-neutral-500">
              Office
            </Label>
            <Input
              placeholder="Office name"
              className="border-gray-250 bg-gray-150 pr-20 pl-4"
              {...form.register("name")}
              disabled={form.formState.isSubmitting}
            />
            {form.formState.errors.name && (
              <p className="text-sm text-red-500">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          <div className="h-px bg-neutral-200" />

          {/* Add Members */}
          <div className="space-y-1.5">
            <Label className="text-sm font-normal text-neutral-500">
              Add Members
            </Label>
            <MemberAssignRow
              selectedUsers={selectedUsers}
              onSelectedUsersChange={setSelectedUsers}
              searchScope={{
                entityType: EntityType.ORGANIZATION,
                entityId: organizationId,
              }}
              currentRole={currentRole}
              onRoleChange={setCurrentRole}
              onAssign={handleAssign}
              disabled={form.formState.isSubmitting}
              excludeEmails={excludedEmails}
            />
          </div>

          {/* Pending invitees list */}
          {pendingInvitees.length > 0 && (
            <>
              <div className="h-px bg-neutral-200" />
              <div className="max-h-60 space-y-4 overflow-y-auto">
                {pendingInvitees.map((invitee) => (
                  <PendingInviteeRow
                    key={invitee.id}
                    invitee={invitee}
                    onRoleChange={handleRoleChange}
                    onRemove={handleRemove}
                  />
                ))}
              </div>
            </>
          )}

          <DialogFooter className="gap-3 pt-4 sm:space-x-0">
            <Button
              type="button"
              variant="ghost"
              className="text-gray-950"
              onClick={() => handleOpenChange(false)}
              disabled={form.formState.isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={form.formState.isSubmitting}
              className="bg-foreground text-background hover:bg-foreground/90"
            >
              {form.formState.isSubmitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create New Office"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
