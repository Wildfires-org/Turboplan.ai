"use client";

import { useState } from "react";

import { Plus, Settings2, UserPlus } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import type { Office } from "@wildfires-org/turboplan-db/types";
import { Button } from "@wildfires-org/turboplan-utils";

import { CreateProjectButton } from "@/components/dashboard/create-project-button";
import { EditOfficeDialog } from "@/components/dashboard/edit-office-dialog";
import { useInviteMembers } from "@/components/dashboard/invite-members-context";
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
        className="gap-2 rounded-[6px] border border-gray-200 bg-white px-4 py-1.5 text-[14px] font-medium leading-[20px] text-foreground hover:bg-gray-50"
        onClick={() => setEditDialogOpen(true)}
      >
        <Settings2 className="size-5" />
        Manage Office
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
        <CreateProjectButton
          organizationSlug={organizationSlug}
          officeSlug={office.slug}
          onSuccess={() => router.refresh()}
          size="sm"
          className="gap-2 rounded-[6px] bg-foreground px-4 py-1.5 text-[14px] font-medium leading-[20px] text-white hover:bg-foreground/90"
        >
          <Plus className="size-5" />
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
