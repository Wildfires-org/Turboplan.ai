"use client";

import { useState } from "react";

import { Plus, Settings2, UserPlus } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import type { Office } from "@wildfires-org/turboplan-db/types";
import { Action } from "@wildfires-org/turboplan-rbac";
import { Button } from "@wildfires-org/turboplan-utils";

import { CreateProjectButton } from "@/components/dashboard/create-project-button";
import { EditOfficeDialog } from "@/components/dashboard/edit-office-dialog";
import { useInviteMembers } from "@/components/dashboard/invite-members-context";
import { useOptionalDashboard } from "@/components/providers/dashboard-provider";
import { HEADER_ACTION_BUTTON_CLASS } from "@/lib/glass";
import { isActiveLink } from "@/lib/nav/activeLink";
import { AppUrls } from "@/lib/nav/urls";

interface OfficeBannerActionsProps {
  organizationSlug: string;
  office: Office;
}

export function OfficeBannerActions({
  organizationSlug,
  office,
}: OfficeBannerActionsProps) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { openInviteForm } = useInviteMembers();
  // Resolved server-side by the office layout. Government offices are
  // readable by any signed-in user, so viewers without these permissions get
  // no management actions at all.
  const officeActions = useOptionalDashboard()?.officeActions ?? [];
  const canUpdate = officeActions.includes(Action.UPDATE);
  const canCreateProject = officeActions.includes(Action.CREATE);
  const canManageMembers = officeActions.includes(Action.MANAGE_MEMBERS);

  const isMembersTab = isActiveLink(
    pathname,
    AppUrls.officeMembers(organizationSlug, office.slug),
  );

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
          Manage Office
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
        : canCreateProject && (
            <CreateProjectButton
              organizationSlug={organizationSlug}
              officeSlug={office.slug}
              onSuccess={() => router.refresh()}
              size="sm"
              variant="brand"
              className={HEADER_ACTION_BUTTON_CLASS}
            >
              <Plus aria-hidden />
              New Project
            </CreateProjectButton>
          )}

      {canUpdate && (
        <EditOfficeDialog
          office={office}
          organizationSlug={organizationSlug}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          onSuccess={() => router.refresh()}
        />
      )}
    </>
  );
}
