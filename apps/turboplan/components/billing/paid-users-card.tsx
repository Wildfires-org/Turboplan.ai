"use client";

import { useState } from "react";

import { ArrowDownCircle, MoreHorizontal, UserMinus } from "lucide-react";
import useSWR from "swr";
import useSWRMutation from "swr/mutation";

import { deleteFetcher, fetcher } from "@wildfires-org/turboplan-api-client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Skeleton,
  toast,
} from "@wildfires-org/turboplan-utils";

import type {
  SeatActionMode,
  SeatChangeResponse,
  SeatMember,
  SeatsResponse,
  Subscription,
} from "./types";

interface PendingSeatAction {
  member: SeatMember;
  mode: SeatActionMode;
}

interface PaidUsersCardProps {
  organizationId: string;
  /** Signed-in user's id — enables the "This is you" self-action warning. */
  currentUserId?: string;
  subscription: Subscription;
  /** Seats covered by the flat workspace price. */
  includedSeats: number;
  /** Billable members beyond the included count (each bills separately). */
  extraSeatCount: number;
  /** Monthly price per extra seat; 0 when the plan has no seat expansion. */
  extraSeatPrice: number;
  /** Refetches the subscription after a seat change (seat count/price shift). */
  mutateSubscription: () => Promise<unknown>;
}

/** Display label for a paid-seat member — name when present, else email. */
const seatLabel = (member: SeatMember): string => member.name || member.email;

export function PaidUsersCard({
  organizationId,
  currentUserId,
  subscription,
  includedSeats,
  extraSeatCount,
  extraSeatPrice,
  mutateSubscription,
}: PaidUsersCardProps) {
  const {
    data: seatsData,
    isLoading: isSeatsLoading,
    mutate: mutateSeats,
  } = useSWR<SeatsResponse>(
    `/api/billing/seats?organizationId=${organizationId}`,
    fetcher,
  );

  const { trigger: changeSeat, isMutating: isChangingSeat } = useSWRMutation(
    "/api/billing/seats",
    deleteFetcher<SeatChangeResponse>,
  );

  const [pendingSeatAction, setPendingSeatAction] =
    useState<PendingSeatAction | null>(null);

  const seatsUsed = seatsData?.used ?? subscription.seats;
  const extraSeatCost = extraSeatCount * extraSeatPrice;

  const handleConfirmSeatAction = async () => {
    if (!pendingSeatAction) {
      return;
    }

    const { member, mode } = pendingSeatAction;
    try {
      // Both ids are server-issued uuids, but encode anyway so a crafted value
      // can never smuggle path segments or extra query params into the request.
      await changeSeat(
        `${encodeURIComponent(member.userId)}?organizationId=${encodeURIComponent(organizationId)}&mode=${mode}`,
      );
      // Both the roster and the seat count/price on the subscription change.
      await Promise.all([mutateSeats(), mutateSubscription()]);
      setPendingSeatAction(null);
      toast({
        type: "success",
        description:
          mode === "remove"
            ? `${seatLabel(member)} was removed from the organization.`
            : `${seatLabel(member)} was downgraded to viewer.`,
      });
    } catch (error) {
      // Surfaces server messages like "Cannot remove the last owner".
      setPendingSeatAction(null);
      toast({
        type: "error",
        description:
          error instanceof Error
            ? error.message
            : "Could not update this seat. Please try again.",
      });
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Paid users</CardTitle>
          <CardDescription>
            Contributors (owners and editors) consume a seat. Viewers and
            commenters are always free.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-2 text-sm">
            <div>
              <span className="text-2xl font-semibold">{seatsUsed}</span>{" "}
              <span className="text-muted-foreground">
                seat{seatsUsed === 1 ? "" : "s"} used
              </span>
            </div>
            <div className="text-muted-foreground">
              {includedSeats} included
              {extraSeatCount > 0 ? `, ${extraSeatCount} extra` : ""}
            </div>
            {extraSeatCount > 0 && extraSeatPrice > 0 && (
              <div className="ml-auto text-muted-foreground">
                {extraSeatCount} extra × ${extraSeatPrice} ={" "}
                <span className="font-medium text-foreground">
                  ${extraSeatCost}
                </span>{" "}
                /month
              </div>
            )}
          </div>

          {isSeatsLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : seatsData && seatsData.members.length > 0 ? (
            <ul className="divide-y rounded-md border">
              {seatsData.members.map((member) => (
                <li
                  key={member.userId}
                  className="flex items-center justify-between gap-4 px-3 py-2 text-sm"
                >
                  <span className="truncate">{seatLabel(member)}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="capitalize">
                      {member.role}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground"
                          aria-label={`Manage ${seatLabel(member)}`}
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onSelect={() =>
                            setPendingSeatAction({
                              member,
                              mode: "downgrade",
                            })
                          }
                        >
                          <ArrowDownCircle className="size-4" />
                          Downgrade to viewer
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onSelect={() =>
                            setPendingSeatAction({ member, mode: "remove" })
                          }
                        >
                          <UserMinus className="size-4" />
                          Remove from organization
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No paid users yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Per-member seat action confirmation */}
      {pendingSeatAction && (
        <AlertDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setPendingSeatAction(null);
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {pendingSeatAction.mode === "remove"
                  ? `Remove ${seatLabel(pendingSeatAction.member)} from the organization?`
                  : `Downgrade ${seatLabel(pendingSeatAction.member)} to viewer?`}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {pendingSeatAction.mode === "remove"
                  ? "This removes all of their owner and editor access across this organization, its offices, and projects. Frees 1 billable seat; if that seat was a paid extra, your price drops at the next billing cycle."
                  : "They keep read-only access everywhere but can no longer edit. Frees 1 billable seat; if that seat was a paid extra, your price drops at the next billing cycle."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            {currentUserId &&
              pendingSeatAction.member.userId === currentUserId && (
                <p className="text-sm font-medium text-amber-600">
                  This is you — you will lose your own contributor access.
                </p>
              )}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isChangingSeat}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                className={
                  pendingSeatAction.mode === "remove"
                    ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    : undefined
                }
                disabled={isChangingSeat}
                onClick={(event) => {
                  event.preventDefault();
                  void handleConfirmSeatAction();
                }}
              >
                {isChangingSeat
                  ? pendingSeatAction.mode === "remove"
                    ? "Removing…"
                    : "Downgrading…"
                  : pendingSeatAction.mode === "remove"
                    ? "Remove"
                    : "Downgrade"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
