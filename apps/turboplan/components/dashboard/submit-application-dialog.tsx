"use client";

import { useEffect, useMemo, useState } from "react";

import { AlertTriangle, ChevronsUpDown, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { mutate } from "swr";
import useSWRMutation from "swr/mutation";

import { postFetcher } from "@wildfires-org/turboplan-api-client";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Checkbox,
  cn,
  GLASS_INSET_CLASS,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@wildfires-org/turboplan-utils";

import { OrgAvatar } from "@/components/org-avatar";
import { SidebarOrgOfficeSearch } from "@/components/sidebar/sidebar-org-office-search";
import { toast } from "@/components/toast";
import { useOrganizationsWithOffices } from "@/hooks/use-organizations-with-offices";
import { AppUrls } from "@/lib/nav/urls";

interface SubmitApplicationDialogProps {
  projectId: string;
  projectName: string;
  organizationSlug: string;
  officeSlug: string;
  /**
   * Saved default submit target chosen at project creation (a gov org/office
   * id). When set and resolvable, the dialog pre-selects it instead of the
   * project's current location.
   */
  preferredOrganizationId?: string | null;
  preferredOfficeId?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SubmitApplicationDialog({
  projectId,
  projectName,
  organizationSlug,
  officeSlug,
  preferredOrganizationId,
  preferredOfficeId,
  open,
  onOpenChange,
}: SubmitApplicationDialogProps) {
  const router = useRouter();
  const [selectedOrgSlug, setSelectedOrgSlug] =
    useState<string>(organizationSlug);
  const [selectedOfficeSlug, setSelectedOfficeSlug] =
    useState<string>(officeSlug);
  const [confirmed, setConfirmed] = useState(false);
  const [officeSelectorOpen, setOfficeSelectorOpen] = useState(false);
  const [hasInitializedTarget, setHasInitializedTarget] = useState(false);

  const { trigger: submitApplication, isMutating: isSubmitting } =
    useSWRMutation(`/api/projects/${projectId}/submit`, postFetcher);

  const { organizations, isLoading: isLoadingOrgs } =
    useOrganizationsWithOffices();

  // Reset state when the dialog opens and pre-select the target ONCE: prefer the
  // saved default (the agency chosen at creation), resolving its id -> slug from
  // the loaded org list; otherwise fall back to the project's current location.
  // Initialize only once per open so a later org-list refresh can't clobber a
  // manual selection.
  useEffect(() => {
    if (!open) {
      setHasInitializedTarget(false);
      return;
    }

    if (hasInitializedTarget) {
      return;
    }

    // Wait for the org list before resolving a preferred id; once loaded we
    // either match it or fall back, so there is no infinite wait.
    if (preferredOrganizationId && isLoadingOrgs) {
      return;
    }

    const preferredOrg = preferredOrganizationId
      ? organizations.find((o) => o.id === preferredOrganizationId)
      : undefined;
    const preferredOffice = preferredOrg?.offices.find(
      (o) => o.id === preferredOfficeId,
    );

    if (preferredOrg && preferredOffice) {
      setSelectedOrgSlug(preferredOrg.slug);
      setSelectedOfficeSlug(preferredOffice.slug);
    } else {
      setSelectedOrgSlug(organizationSlug);
      setSelectedOfficeSlug(officeSlug);
    }

    setConfirmed(false);
    setHasInitializedTarget(true);
  }, [
    open,
    hasInitializedTarget,
    isLoadingOrgs,
    organizations,
    preferredOrganizationId,
    preferredOfficeId,
    organizationSlug,
    officeSlug,
  ]);

  const selectedOrg = useMemo(
    () => organizations.find((o) => o.slug === selectedOrgSlug),
    [organizations, selectedOrgSlug],
  );

  const selectedOffice = useMemo(
    () => selectedOrg?.offices.find((o) => o.slug === selectedOfficeSlug),
    [selectedOrg, selectedOfficeSlug],
  );

  const handleOfficeSelect = (orgSlug: string, officeSlug: string) => {
    setSelectedOrgSlug(orgSlug);
    setSelectedOfficeSlug(officeSlug);
    setOfficeSelectorOpen(false);
  };

  const handleOrgSelect = (orgSlug: string) => {
    const org = organizations.find((o) => o.slug === orgSlug);
    if (org) {
      // With requireOffice, SidebarOrgOfficeSearch only fires onOrgSelect for
      // orgs that have at least one office, so the first office always exists.
      setSelectedOrgSlug(orgSlug);
      setSelectedOfficeSlug(org.offices[0].slug);
    }
    setOfficeSelectorOpen(false);
  };

  const isDisabled =
    !confirmed || !selectedOrgSlug || !selectedOfficeSlug || isSubmitting;

  const handleSubmit = async () => {
    if (isDisabled) {
      return;
    }

    const org = organizations.find((o) => o.slug === selectedOrgSlug);
    const office = selectedOrg?.offices.find(
      (o) => o.slug === selectedOfficeSlug,
    );

    if (!org) {
      toast({ type: "error", description: "Please select an organization" });
      return;
    }

    if (!office) {
      toast({ type: "error", description: "Please select an office" });
      return;
    }

    try {
      await submitApplication({
        targetOrganizationId: org.id,
        targetOfficeId: office.id,
      });

      toast({
        type: "success",
        description: "Application submitted. You now have view-only access.",
      });
      onOpenChange(false);
      // Revalidate all SWR caches (permissions, project data, etc.)
      await mutate(() => true, undefined, { revalidate: true });
      // The project has physically moved into the gov office, so the citizen's
      // current page is now stale (would 404 / AccessError). Redirect to the
      // citizen's "My Submissions" page instead of refreshing in place.
      router.push(AppUrls.officeMySubmissions(organizationSlug, officeSlug));
    } catch (error) {
      console.error("Error submitting application:", error);
      toast({
        type: "error",
        description: "Failed to submit application",
      });
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="min-w-[620px]">
        <AlertDialogHeader className="flex flex-row items-center gap-3">
          <div className="flex-1">
            <AlertDialogTitle className="flex items-center gap-2 text-xl">
              Submit Project Application
              <span className="rounded-full bg-slate-900/[0.05] px-2.5 py-0.5 text-sm font-normal text-gray-550 ring-1 ring-inset ring-slate-900/[0.06]">
                {projectName}
              </span>
            </AlertDialogTitle>
            <AlertDialogDescription>
              Select the agency to review your project proposal.
            </AlertDialogDescription>
          </div>
          <Button
            variant="glass"
            size="icon"
            aria-label="Close"
            className="size-8 shrink-0 text-foreground"
            onClick={() => onOpenChange(false)}
          >
            <X className="size-4" />
          </Button>
        </AlertDialogHeader>

        <div className="space-y-4">
          {/* Warning Banner */}
          <div className="flex gap-3 rounded-xl bg-amber-50 p-3 ring-1 ring-inset ring-amber-800/15">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-700" />
            <p className="text-sm text-amber-900">
              <span className="font-semibold">Important:</span> Submitting this
              application will transfer its ownership to the selected
              organization.{" "}
              <span className="font-semibold">
                Your role will be changed to &quot;Viewer&quot;
              </span>{" "}
              and you will no longer be able to edit these documents.
            </p>
          </div>

          {/* Organization / Office Selector */}
          <div className="space-y-1.5">
            <Label>Organization / Office</Label>
            <Popover
              open={officeSelectorOpen}
              onOpenChange={setOfficeSelectorOpen}
              modal
            >
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    GLASS_INSET_CLASS,
                    "flex w-full items-center gap-2 rounded-xl p-2 transition-colors",
                  )}
                >
                  {selectedOrg ? (
                    <>
                      <OrgAvatar
                        name={selectedOrg.name}
                        logoUrl={selectedOrg.logoUrl}
                        className="size-[35px] shrink-0 rounded border border-gray-100 shadow-sm"
                      />
                      <span className="min-w-0 flex-1 truncate text-left text-sm font-medium text-foreground">
                        {selectedOffice?.name ?? selectedOrg.name}
                      </span>
                    </>
                  ) : isLoadingOrgs ? (
                    <span className="min-w-0 flex-1 py-1.5 pl-1 text-left text-sm text-gray-550">
                      Loading...
                    </span>
                  ) : (
                    <span className="min-w-0 flex-1 py-1.5 pl-1 text-left text-sm text-gray-550">
                      Select an organization...
                    </span>
                  )}
                  <ChevronsUpDown className="ml-auto size-4 shrink-0 text-gray-550" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                side="bottom"
                align="start"
                sideOffset={4}
                className="w-[var(--radix-popover-trigger-width)] py-2 pl-2 pr-0"
              >
                <SidebarOrgOfficeSearch
                  organizations={organizations}
                  currentOrgSlug={selectedOrgSlug}
                  currentOfficeSlug={selectedOfficeSlug}
                  onOfficeSelect={handleOfficeSelect}
                  onOrgSelect={handleOrgSelect}
                  listClassName="max-h-[30vh]"
                  requireOffice
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Confirmation Checkbox */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="confirm"
              checked={confirmed}
              onCheckedChange={(checked) => setConfirmed(checked === true)}
            />
            <label
              htmlFor="confirm"
              className="text-sm leading-snug text-foreground"
            >
              I understand that I am transferring ownership of this project and
              will lose editing rights.
            </label>
          </div>

          <div className="h-px bg-slate-900/[0.08]" />

          <AlertDialogFooter className="gap-2">
            <Button
              type="button"
              variant="glass"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="brand"
              disabled={isDisabled}
              onClick={handleSubmit}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Application"
              )}
            </Button>
          </AlertDialogFooter>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
