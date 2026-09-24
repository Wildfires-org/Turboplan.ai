"use client";

import { useEffect, useRef, useState } from "react";

import { Loader2, Pencil, Settings, Settings2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { ApiClient } from "@wildfires-org/turboplan-api-client";
import type { Organization } from "@wildfires-org/turboplan-db/types";
import { Action, EntityType } from "@wildfires-org/turboplan-rbac";
import { useEntityPermission } from "@wildfires-org/turboplan-rbac/hooks";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
} from "@wildfires-org/turboplan-utils";
import type { Office, Project } from "@wildfires-org/turboplan-workspace/types";

import { toast } from "@/components/toast";
import { cn } from "@/lib/utils";
import { EditOfficeDialog } from "./edit-office-dialog";
import { EditOrganizationDialog } from "./edit-organization-dialog";
import { EditProjectDialog } from "./edit-project-dialog";

export type BreadcrumbEntity =
  | { type: "organization"; data: Organization }
  | { type: "office"; data: Office; organizationSlug: string }
  | {
      type: "project";
      data: Project;
      organizationSlug: string;
      officeSlug: string;
    };

interface BreadcrumbEntityActionsProps {
  label: string;
  href: string;
  entity: BreadcrumbEntity;
  userId?: string;
  /** The current (last) breadcrumb renders as foreground text, not a link. */
  isActive?: boolean;
}

const ENTITY_LABEL: Record<BreadcrumbEntity["type"], string> = {
  organization: "Organization",
  office: "Office",
  project: "Project",
};

const ENTITY_TYPE = {
  organization: EntityType.ORGANIZATION,
  office: EntityType.OFFICE,
  project: EntityType.PROJECT,
} as const;

const apiClient = new ApiClient();

export function BreadcrumbEntityActions({
  label,
  href,
  entity,
  userId,
  isActive = false,
}: BreadcrumbEntityActionsProps) {
  const router = useRouter();
  const pathname = usePathname();

  const { hasPermission, isChecking } = useEntityPermission({
    userId,
    entityType: ENTITY_TYPE[entity.type],
    entityId: entity.data.id,
    action: Action.UPDATE,
  });

  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(label);
  const [isSaving, setIsSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // Show the new name immediately after a rename, before the server refresh
  // propagates the updated `label` prop — otherwise the old name flashes back.
  const [optimisticLabel, setOptimisticLabel] = useState<string | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelRenameRef = useRef(false);
  const savingRef = useRef(false);

  const displayLabel = optimisticLabel ?? label;

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  // Once the refresh lands and the prop catches up, drop the optimistic value.
  useEffect(() => {
    if (optimisticLabel && label === optimisticLabel) {
      setOptimisticLabel(null);
    }
  }, [label, optimisticLabel]);

  const openMenu = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setMenuOpen(true);
  };

  const scheduleClose = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
    }
    closeTimerRef.current = setTimeout(() => {
      setMenuOpen(false);
      closeTimerRef.current = null;
    }, 200);
  };

  const cancelRename = () => {
    setIsRenaming(false);
    setRenameValue(displayLabel);
  };

  // After a rename the slug is regenerated server-side. Swap the stale slug
  // segment in the current URL so the user stays on the same page.
  const navigateAfterRename = (
    segment: "organizations" | "offices" | "projects",
    oldSlug: string,
    newSlug?: string,
  ) => {
    if (newSlug && newSlug !== oldSlug) {
      router.replace(
        pathname.replace(`/${segment}/${oldSlug}`, `/${segment}/${newSlug}`),
      );
    }
    router.refresh();
  };

  const renameOrganization = async (name: string) => {
    if (entity.type !== "organization") {
      return;
    }
    const organization = entity.data;
    // The organization PUT requires the full edit payload, so send the current
    // values with only the name overridden.
    const { data: updated, error } = await apiClient.put<Organization>(
      `/api/organizations/${organization.id}`,
      {
        name,
        shortName: organization.shortName ?? "",
        description: organization.description ?? "",
        country: organization.country ?? "",
        type: organization.type,
        status: organization.status,
        logoUrl: organization.logoUrl ?? "",
      },
    );

    if (error) {
      throw new Error(error || "Failed to rename organization");
    }
    navigateAfterRename("organizations", organization.slug, updated?.slug);
  };

  const renameOffice = async (name: string) => {
    if (entity.type !== "office") {
      return;
    }
    const office = entity.data;
    const { data: response, error } = await apiClient.put<{ office: Office }>(
      `/api/offices/${office.id}`,
      { name },
    );

    if (error) {
      throw new Error(error || "Failed to rename office");
    }
    navigateAfterRename("offices", office.slug, response?.office?.slug);
  };

  const renameProject = async (name: string) => {
    if (entity.type !== "project") {
      return;
    }
    const projectData = entity.data;
    const { data: response, error } = await apiClient.put<{ project: Project }>(
      `/api/projects/${projectData.id}`,
      { name },
    );

    if (error) {
      throw new Error(error || "Failed to rename project");
    }
    navigateAfterRename("projects", projectData.slug, response?.project?.slug);
  };

  const handleSaveRename = async () => {
    // Guard against re-entry: Enter blurs the input, and the unmount-on-success
    // also blurs it — without this the rename would fire (and toast) twice.
    if (savingRef.current) {
      return;
    }

    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === displayLabel) {
      cancelRename();
      return;
    }

    savingRef.current = true;
    setIsSaving(true);
    try {
      if (entity.type === "organization") {
        await renameOrganization(trimmed);
      } else if (entity.type === "office") {
        await renameOffice(trimmed);
      } else {
        await renameProject(trimmed);
      }

      toast({
        type: "success",
        description: `${ENTITY_LABEL[entity.type]} renamed successfully!`,
      });
      setOptimisticLabel(trimmed);
      setIsRenaming(false);
    } catch (error) {
      console.error("Error renaming entity:", error);
      toast({
        type: "error",
        description:
          error instanceof Error ? error.message : "Failed to rename",
      });
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  // Commit on blur is the single save path. Enter/Escape just blur the input
  // (Escape flags a cancel first) so a save never fires more than once.
  const handleBlur = () => {
    if (cancelRenameRef.current) {
      cancelRenameRef.current = false;
      cancelRename();
      return;
    }
    void handleSaveRename();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      inputRef.current?.blur();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      cancelRenameRef.current = true;
      inputRef.current?.blur();
    }
  };

  let editDialog: React.ReactNode = null;
  if (entity.type === "organization") {
    // Mount only while open so form defaults, active tab, and child upload
    // state reset on every open (cancelled edits must not reappear).
    editDialog = dialogOpen ? (
      <EditOrganizationDialog
        organization={entity.data}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={() => router.refresh()}
      />
    ) : null;
  } else if (entity.type === "office") {
    editDialog = (
      <EditOfficeDialog
        office={entity.data}
        organizationSlug={entity.organizationSlug}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={() => router.refresh()}
      />
    );
  } else {
    editDialog = (
      <EditProjectDialog
        project={entity.data}
        organizationSlug={entity.organizationSlug}
        officeSlug={entity.officeSlug}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={() => router.refresh()}
      />
    );
  }

  if (isRenaming) {
    return (
      <span className="group inline-flex items-center gap-1">
        <Input
          ref={inputRef}
          autoFocus
          value={renameValue}
          disabled={isSaving}
          onChange={(event) => setRenameValue(event.target.value)}
          onFocus={(event) => event.target.select()}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          className="h-6 px-1 py-0 text-sm"
          style={{ width: `${Math.max(renameValue.length, 4)}ch` }}
        />
        {isSaving && (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        )}
        {editDialog}
      </span>
    );
  }

  const interactive = !isChecking && hasPermission;

  // No edit rights → plain breadcrumb, identical to the default header.
  if (!interactive) {
    if (isActive) {
      return (
        <span className="font-medium text-foreground">{displayLabel}</span>
      );
    }
    return (
      <Link
        href={href}
        className="text-gray-550 transition-colors hover:text-foreground"
      >
        {displayLabel}
      </Link>
    );
  }

  const labelClassName = cn(
    "underline-offset-4 transition-colors group-hover:text-brand-800 group-hover:underline",
    isActive ? "font-medium text-foreground" : "text-gray-550",
    menuOpen && "text-brand-800 underline",
  );

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen} modal={false}>
        <DropdownMenuTrigger asChild>
          {/* The whole segment (label + icon) is the hover/menu anchor, so the
              menu centers under both. A non-active label still navigates on
              click — stopping pointer-down keeps Radix from toggling the menu. */}
          <span
            tabIndex={0}
            aria-label={`${entity.type} actions`}
            className="group inline-flex items-center gap-1 cursor-pointer"
            onMouseEnter={openMenu}
            onMouseLeave={scheduleClose}
          >
            {isActive ? (
              <span className={labelClassName}>{displayLabel}</span>
            ) : (
              <Link
                href={href}
                onPointerDown={(event) => event.stopPropagation()}
                className={labelClassName}
              >
                {displayLabel}
              </Link>
            )}
            <Settings2
              aria-hidden
              className={cn(
                "size-4 text-gray-550 transition-colors group-hover:text-brand-800",
                menuOpen && "text-brand-800",
              )}
            />
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="center"
          onCloseAutoFocus={(event) => event.preventDefault()}
          onMouseEnter={openMenu}
          onMouseLeave={scheduleClose}
        >
          <DropdownMenuItem
            onSelect={() => {
              setRenameValue(displayLabel);
              setIsRenaming(true);
            }}
          >
            <Pencil className="mr-2 size-4" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setDialogOpen(true)}>
            <Settings className="mr-2 size-4" />
            Settings
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {editDialog}
    </>
  );
}
