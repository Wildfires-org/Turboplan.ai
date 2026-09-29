"use client";

import { useState } from "react";

import { Loader2, UserPlus } from "lucide-react";
import useSWRMutation from "swr/mutation";

import { postFetcher } from "@wildfires-org/turboplan-api-client";
import { Button } from "@wildfires-org/turboplan-utils";
import {
  isInviteUser,
  type SelectedUserValue,
  UserSelector,
} from "@wildfires-org/turboplan-workspace/client";

interface AddAdminUserFormProps {
  onAdded: () => void;
}

export function AddAdminUserForm({ onAdded }: AddAdminUserFormProps) {
  const [selected, setSelected] = useState<SelectedUserValue[]>([]);

  const { trigger, isMutating, error } = useSWRMutation(
    "/api/admin/admin-users",
    postFetcher,
  );

  const selectedUser = selected[0];
  const canSubmit = selectedUser && !isInviteUser(selectedUser) && !isMutating;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    await trigger({ userId: selectedUser.id });
    setSelected([]);
    onAdded();
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="flex-1">
          <UserSelector
            value={selected}
            onChange={setSelected}
            searchScope="admin"
            placeholder="Search for a user to add as admin..."
            maxSelections={1}
            allowInvite={false}
            disabled={isMutating}
          />
        </div>
        <Button onClick={handleSubmit} disabled={!canSubmit} size="default">
          {isMutating ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <UserPlus className="size-4" />
          )}
          <span className="ml-1.5">Add</span>
        </Button>
      </div>
      {error && (
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : "Failed to add admin user"}
        </p>
      )}
    </div>
  );
}
