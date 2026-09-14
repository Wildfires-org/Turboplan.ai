"use client";

import { Loader2, Shield, ShieldCheck, Trash2 } from "lucide-react";
import useSWRMutation from "swr/mutation";

import { deleteFetcher } from "@wildfires-org/turboplan-api-client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  cn,
  generateDisplayName,
  generateInitials,
  Skeleton,
} from "@wildfires-org/turboplan-utils";

import type { AdminUserProfile } from "../hooks/use-admin-users";

interface AdminUsersListProps {
  adminUsers: AdminUserProfile[];
  isLoading: boolean;
  isSuperAdmin: boolean;
  onRemoved: () => void;
}

export function AdminUsersList({
  adminUsers,
  isLoading,
  isSuperAdmin,
  onRemoved,
}: AdminUsersListProps) {
  const { trigger: removeUser, isMutating: isRemoving } = useSWRMutation(
    "/api/admin/admin-users",
    deleteFetcher,
    { onSuccess: () => onRemoved() },
  );

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={`skeleton-${i}`}
            className="flex items-center gap-3 rounded-lg border p-4"
          >
            <Skeleton className="size-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (adminUsers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
        <Shield className="size-10 text-muted-foreground/50" />
        <p className="mt-3 text-sm text-muted-foreground">
          No admin users added yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {adminUsers.map(({ adminUser, user, profile }) => (
        <div
          key={adminUser.id}
          className="flex items-center gap-3 rounded-lg border p-4"
        >
          <Avatar className="size-10 text-sm font-medium">
            <AvatarImage src={profile?.avatarUrl ?? undefined} alt="" />
            <AvatarFallback>
              {generateInitials({
                firstName: profile?.firstName,
                lastName: profile?.lastName,
                email: user.email,
              })}
            </AvatarFallback>
          </Avatar>

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center gap-2">
              <span className="truncate font-medium">
                {generateDisplayName({
                  firstName: profile?.firstName,
                  lastName: profile?.lastName,
                  email: user.email,
                })}
              </span>
              <ShieldCheck className="size-4 shrink-0 text-muted-foreground" />
            </div>
            <span className="truncate text-sm text-muted-foreground">
              {user.email}
            </span>
          </div>

          {isSuperAdmin && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "text-muted-foreground hover:text-destructive",
                    isRemoving && "pointer-events-none",
                  )}
                  disabled={isRemoving}
                >
                  {isRemoving ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove admin access</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to remove admin access for{" "}
                    <span className="font-medium text-foreground">
                      {generateDisplayName({
                        firstName: profile?.firstName,
                        lastName: profile?.lastName,
                        email: user.email,
                      })}
                    </span>
                    ? They will lose access to the admin panel.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => removeUser(adminUser.userId)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Remove
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      ))}
    </div>
  );
}
