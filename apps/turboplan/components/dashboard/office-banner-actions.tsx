"use client";

import { useState } from "react";

import { Plus, Settings2, UserPlus } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import type { Office } from "@wildfires-org/turboplan-db/types";
import { Button } from "@wildfires-org/turboplan-utils";

import { CreateProjectButton } from "@/components/dashboard/create-project-button";
import { EditOfficeDialog } from "@/components/dashboard/edit-office-dialog";
import { useInviteMembers } from "@/components/dashboard/invite-members-context";
import { HEADER_ACTION_BUTTON_CLASS } from "@/lib/glass";
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

  const isMembersTab = pathname.startsWith(
    AppUrls.officeMembers(organizationSlug, office.slug),
  );

  return (
    <>
      <Button
        size="sm"
        variant="glass"
        className={HEADER_ACTION_BUTTON_CLASS}
        onClick={() => setEditDialogOpen(true)}
      >
        <Settings2 aria-hidden />
        Manage Office
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

      <EditOfficeDialog
        office={office}
        organizationSlug={organizationSlug}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSuccess={() => router.refresh()}
      />
    </>
  );
}
