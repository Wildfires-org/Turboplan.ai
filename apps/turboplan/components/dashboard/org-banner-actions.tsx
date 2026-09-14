"use client";

import { useState } from "react";

import { Plus, Settings2, UserPlus } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import type { Organization } from "@wildfires-org/turboplan-db/types";
import { Button } from "@wildfires-org/turboplan-utils";

import { CreateOfficeButton } from "@/components/dashboard/create-office-button";
import { EditOrganizationDialog } from "@/components/dashboard/edit-organization-dialog";
import { useInviteMembers } from "@/components/dashboard/invite-members-context";
import { AppUrls } from "@/lib/nav/urls";

interface OrgBannerActionsProps {
  organization: Organization;
  /**
   * Whether the current user is a member of the organization. Government orgs
   * are viewable by any authenticated user, but these management actions are
   * member-only. Defaults to true since member-only pages already gate access.
   */
  isMember?: boolean;
}

export function OrgBannerActions({
  organization,
  isMember = true,
}: OrgBannerActionsProps) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { openInviteForm } = useInviteMembers();

  const isMembersTab = pathname.startsWith(
    AppUrls.organizationMembers(organization.slug),
  );

  if (!isMember) {
    return null;
  }

  return (
    <>
      <Button
        size="sm"
        className="gap-2 rounded-[6px] border border-gray-200 bg-white px-4 py-1.5 text-[14px] font-medium leading-[20px] text-foreground hover:bg-gray-50"
        onClick={() => setEditDialogOpen(true)}
      >
        <Settings2 className="size-5" />
        Manage Organization
      </Button>

      {isMembersTab ? (
        <Button
          size="sm"
          className="gap-2 rounded-[6px] bg-foreground px-4 py-1.5 text-[14px] font-medium leading-[20px] text-white hover:bg-foreground/90"
          onClick={openInviteForm}
        >
          <UserPlus className="size-5" />
          Invite Members
        </Button>
      ) : (
        <CreateOfficeButton
          organizationId={organization.id}
          organizationSlug={organization.slug}
          organizationName={organization.name}
          onSuccess={() => router.refresh()}
          size="sm"
          className="gap-2 rounded-[6px] bg-foreground px-4 py-1.5 text-[14px] font-medium leading-[20px] text-white hover:bg-foreground/90"
        >
          <Plus className="size-5" />
          New Office
        </CreateOfficeButton>
      )}

      {/* Mount only while open so form defaults, active tab, and child upload
          state reset on every open (cancelled edits must not reappear). */}
      {editDialogOpen && (
        <EditOrganizationDialog
          organization={organization}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          onSuccess={() => router.refresh()}
        />
      )}
    </>
  );
}
