"use client";

import { useState } from "react";

import { Plus, Settings2, UserPlus } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import type { Organization } from "@wildfires-org/turboplan-db/types";
import { Action, type ActionType } from "@wildfires-org/turboplan-rbac";
import { Button } from "@wildfires-org/turboplan-utils";

import { CreateOfficeButton } from "@/components/dashboard/create-office-button";
import { EditOrganizationDialog } from "@/components/dashboard/edit-organization-dialog";
import { useInviteMembers } from "@/components/dashboard/invite-members-context";
import { HEADER_ACTION_BUTTON_CLASS } from "@/lib/glass";
import { isActiveLink } from "@/lib/nav/activeLink";
import { AppUrls } from "@/lib/nav/urls";

interface OrgBannerActionsProps {
  organization: Organization;
  /**
   * The user's allowed actions on the organization. Each button needs the
   * action its API checks: read access (any user on a government org, or a
   * role on one of its offices or projects) shows none of them.
   */
  actions: ActionType[];
}

export function OrgBannerActions({
  organization,
  actions,
}: OrgBannerActionsProps) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { openInviteForm } = useInviteMembers();

  const isMembersTab = isActiveLink(
    pathname,
    AppUrls.organizationMembers(organization.slug),
  );

  const canUpdate = actions.includes(Action.UPDATE);
  const canCreateOffice = actions.includes(Action.CREATE);
  const canManageMembers = actions.includes(Action.MANAGE_MEMBERS);

  return (
    <>
      {canUpdate && (
        <Button
          size="sm"
          variant="glass"
          className={HEADER_ACTION_BUTTON_CLASS}
          onClick={() => setEditDialogOpen(true)}
        >
          <Settings2 aria-hidden />
          Manage Organization
        </Button>
      )}

      {isMembersTab
        ? canManageMembers && (
            <Button
              size="sm"
              variant="brand"
              className={HEADER_ACTION_BUTTON_CLASS}
              onClick={openInviteForm}
            >
              <UserPlus aria-hidden />
              Invite Members
            </Button>
          )
        : canCreateOffice && (
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
      {canUpdate && editDialogOpen && (
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
