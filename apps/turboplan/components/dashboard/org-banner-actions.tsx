"use client";

import { useState } from "react";

import { Plus, Settings2, UserPlus } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import type { Organization } from "@wildfires-org/turboplan-db/types";
import { Button } from "@wildfires-org/turboplan-utils";

import { CreateOfficeButton } from "@/components/dashboard/create-office-button";
import { EditOrganizationDialog } from "@/components/dashboard/edit-organization-dialog";
import { useInviteMembers } from "@/components/dashboard/invite-members-context";
import { HEADER_ACTION_BUTTON_CLASS } from "@/lib/glass";
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
        variant="glass"
        className={HEADER_ACTION_BUTTON_CLASS}
        onClick={() => setEditDialogOpen(true)}
      >
        <Settings2 aria-hidden />
        Manage Organization
      </Button>

      {isMembersTab ? (
        <Button
          size="sm"
          variant="brand"
          className={HEADER_ACTION_BUTTON_CLASS}
          onClick={openInviteForm}
        >
          <UserPlus aria-hidden />
          Invite Members
        </Button>
      ) : (
        <CreateOfficeButton
          organizationId={organization.id}
          organizationSlug={organization.slug}
          organizationName={organization.name}
          onSuccess={() => router.refresh()}
          size="sm"
          variant="brand"
          className={HEADER_ACTION_BUTTON_CLASS}
        >
          <Plus aria-hidden />
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
