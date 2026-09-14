"use client";

import { useMemo, useState } from "react";

import { ArrowDown, ArrowUp, FileSignature, Loader2 } from "lucide-react";
import { toast } from "sonner";
import useSWR from "swr";

import { fetcher } from "@wildfires-org/turboplan-api-client";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@wildfires-org/turboplan-utils";

import {
  type CreateRecipientInput,
  useCreateSigningRequest,
} from "../hooks/use-signing-requests";
import type { SigningMode, SigningRecipientRole } from "../types";
import { SignDocumentModal } from "./sign-document-modal";

type ProjectMember = {
  userId: string;
  role: string;
  user: {
    id: string;
    email: string;
  };
  profile: {
    firstName: string | null;
    lastName: string | null;
    avatarUrl: string | null;
  } | null;
};

type MembersResponse = {
  members: ProjectMember[];
};

type RequesterSigns = "first" | "last" | "no";

type InlineModalState = {
  signingToken: string;
  host: string;
  signingRequestId: string;
};

interface RequestSignaturesDialogProps {
  documentId: string;
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // The requester. Excluded from the selectable member list — their own signing
  // is controlled entirely by the "You sign" (requesterSigns) dropdown, so a
  // self checkbox row would be redundant (the server dedups it regardless).
  currentUserId?: string;
}

const getMemberDisplayName = (member: ProjectMember) => {
  if (member.profile?.firstName || member.profile?.lastName) {
    return [member.profile.firstName, member.profile.lastName]
      .filter(Boolean)
      .join(" ");
  }
  return member.user.email;
};

const getMemberInitials = (member: ProjectMember) => {
  if (member.profile?.firstName && member.profile?.lastName) {
    return `${member.profile.firstName[0]}${member.profile.lastName[0]}`.toUpperCase();
  }
  return member.user.email[0].toUpperCase();
};

export const RequestSignaturesDialog = ({
  documentId,
  projectId,
  open,
  onOpenChange,
  currentUserId,
}: RequestSignaturesDialogProps) => {
  // Ordered list of selected recipients (others — the requester is handled by
  // `requesterSigns`). Order is the sequential signing order.
  const [selected, setSelected] = useState<CreateRecipientInput[]>([]);
  const [signingMode, setSigningMode] = useState<SigningMode>("parallel");
  const [requesterSigns, setRequesterSigns] = useState<RequesterSigns>("first");
  const [inlineModal, setInlineModal] = useState<InlineModalState | null>(null);

  const { data, isLoading: isMembersLoading } = useSWR<MembersResponse>(
    open ? `/api/projects/${projectId}/members` : null,
    fetcher,
  );

  // Exclude the requester — they're handled by the "You sign" dropdown.
  const members = useMemo(
    () => (data?.members ?? []).filter((m) => m.userId !== currentUserId),
    [data, currentUserId],
  );

  const selectedById = useMemo(
    () => new Map(selected.map((r) => [r.userId, r])),
    [selected],
  );

  const resetState = () => {
    setSelected([]);
    setSigningMode("parallel");
    setRequesterSigns("first");
  };

  const { createSigningRequest, isCreating } = useCreateSigningRequest(
    (response) => {
      if (response.inline) {
        // Requester signs first, in-session.
        setInlineModal({
          signingToken: response.inline.signingToken,
          host: response.inline.host,
          signingRequestId: response.inline.signingRequestId,
        });
      } else {
        toast.success("Signing request sent");
        resetState();
        onOpenChange(false);
      }
    },
  );

  const handleToggleMember = (member: ProjectMember) => {
    setSelected((prev) => {
      if (prev.some((r) => r.userId === member.userId)) {
        return prev.filter((r) => r.userId !== member.userId);
      }
      return [...prev, { userId: member.userId, role: "signer" }];
    });
  };

  const handleRoleChange = (userId: string, role: SigningRecipientRole) => {
    setSelected((prev) =>
      prev.map((r) => (r.userId === userId ? { ...r, role } : r)),
    );
  };

  const handleMove = (index: number, direction: -1 | 1) => {
    setSelected((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) {
        return prev;
      }
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const handleSubmit = async () => {
    try {
      await createSigningRequest({
        documentId,
        projectId,
        recipients: selected,
        signingMode,
        requesterSigns,
      });
    } catch {
      toast.error("Failed to create signing request");
    }
  };

  const closeInlineModal = () => {
    setInlineModal(null);
    resetState();
    onOpenChange(false);
  };

  const signerCount =
    selected.filter((r) => r.role === "signer").length +
    (requesterSigns === "no" ? 0 : 1);
  const canSubmit = signerCount > 0 && !isCreating;

  // While the requester signs in-session, swap the dialog for the embedded modal.
  if (inlineModal) {
    return (
      <SignDocumentModal
        signingToken={inlineModal.signingToken}
        host={inlineModal.host}
        signingRequestId={inlineModal.signingRequestId}
        onCompleted={closeInlineModal}
        onClose={closeInlineModal}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSignature className="size-5" />
            Request Signatures
          </DialogTitle>
          <DialogDescription>
            Choose who signs this document. Leave recipients empty to sign it
            yourself.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                Signing order
              </span>
              <Select
                value={signingMode}
                onValueChange={(v) => setSigningMode(v as SigningMode)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="parallel">Everyone at once</SelectItem>
                  <SelectItem value="sequential">One after another</SelectItem>
                </SelectContent>
              </Select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                You sign
              </span>
              <Select
                value={requesterSigns}
                onValueChange={(v) => setRequesterSigns(v as RequesterSigns)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="first">First</SelectItem>
                  <SelectItem value="last">Last</SelectItem>
                  <SelectItem value="no">Don't sign</SelectItem>
                </SelectContent>
              </Select>
            </label>
          </div>

          {isMembersLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : members.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No other project members — submit to sign it yourself.
            </div>
          ) : (
            <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
              {members.map((member) => {
                const sel = selectedById.get(member.userId);
                const orderIndex = selected.findIndex(
                  (r) => r.userId === member.userId,
                );
                return (
                  <div
                    key={member.userId}
                    className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted"
                  >
                    <Checkbox
                      checked={!!sel}
                      onCheckedChange={() => handleToggleMember(member)}
                    />
                    <Avatar className="size-8">
                      <AvatarImage
                        src={member.profile?.avatarUrl ?? undefined}
                      />
                      <AvatarFallback className="text-xs">
                        {getMemberInitials(member)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium">
                        {getMemberDisplayName(member)}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {member.user.email}
                      </span>
                    </div>

                    {sel && (
                      <>
                        {signingMode === "sequential" && (
                          <div className="flex items-center">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-6"
                              disabled={orderIndex <= 0}
                              onClick={() => handleMove(orderIndex, -1)}
                            >
                              <ArrowUp className="size-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-6"
                              disabled={orderIndex >= selected.length - 1}
                              onClick={() => handleMove(orderIndex, 1)}
                            >
                              <ArrowDown className="size-3.5" />
                            </Button>
                          </div>
                        )}
                        <Select
                          value={sel.role}
                          onValueChange={(v) =>
                            handleRoleChange(
                              member.userId,
                              v as SigningRecipientRole,
                            )
                          }
                        >
                          <SelectTrigger className="h-8 w-24 shrink-0">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="signer">Signer</SelectItem>
                            <SelectItem value="cc">CC</SelectItem>
                          </SelectContent>
                        </Select>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {isCreating ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Sending...
              </>
            ) : requesterSigns === "first" && selected.length === 0 ? (
              "Sign now"
            ) : (
              `Send request${selected.length > 0 ? ` (${selected.length})` : ""}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
