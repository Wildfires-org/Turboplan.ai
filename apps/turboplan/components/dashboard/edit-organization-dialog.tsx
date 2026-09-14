"use client";

import { useCallback, useRef, useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  AtSign,
  Building2,
  FileSignature,
  Loader2,
  type LucideIcon,
  Palette,
  SlidersHorizontal,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { ApiClient } from "@wildfires-org/turboplan-api-client";
import type { Organization } from "@wildfires-org/turboplan-db/types";
import { isSigningPackageEnabled } from "@wildfires-org/turboplan-feature-flags";
import { OrgSigningConfig } from "@wildfires-org/turboplan-signing/client";
import {
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@wildfires-org/turboplan-utils";
import {
  type EditOrganizationFormData,
  editOrganizationSchema,
  OrganizationStatus,
  OrganizationType,
} from "@wildfires-org/turboplan-workspace/types";

import { useUser } from "@/components/providers/user-provider";
import { toast } from "@/components/toast";
import { AppUrls } from "@/lib/nav/urls";
import { DocumentBrandingFields } from "./document-branding-fields";
import { OrgEmailDomainsSection } from "./org-email-domains-section";
import { OrganizationLogoUpload } from "./organization-logo-upload";

const apiClient = new ApiClient();

type OrgSettingsTab = "general" | "branding" | "domains" | "signing";

interface OrgSettingsTabConfig {
  key: OrgSettingsTab;
  label: string;
  icon: LucideIcon;
  /** Tab whose content lives inside the shared General/Branding form. */
  usesSharedForm?: boolean;
}

const BASE_TABS: OrgSettingsTabConfig[] = [
  {
    key: "general",
    label: "General",
    icon: SlidersHorizontal,
    usesSharedForm: true,
  },
  { key: "branding", label: "Branding", icon: Palette, usesSharedForm: true },
  { key: "domains", label: "Email Domains", icon: AtSign },
];

const SIGNING_TAB: OrgSettingsTabConfig = {
  key: "signing",
  label: "Document Signing",
  icon: FileSignature,
};

interface EditOrganizationDialogProps {
  organization: Organization;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditOrganizationDialog({
  organization,
  open,
  onOpenChange,
  onSuccess,
}: EditOrganizationDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<OrgSettingsTab>("general");
  const router = useRouter();
  const { user } = useUser();

  const signingEnabled = isSigningPackageEnabled();
  const tabs = signingEnabled ? [...BASE_TABS, SIGNING_TAB] : BASE_TABS;

  const isFormTab =
    tabs.find((tab) => tab.key === activeTab)?.usesSharedForm ?? false;

  // OrgEmailDomainsSection registers an Escape intercept here so the dialog can
  // ask the child whether Escape should close its inline add-domain input
  // rather than dismiss the whole dialog — without reaching into child DOM.
  const escapeInterceptRef = useRef<(() => boolean) | null>(null);
  const registerEscapeIntercept = useCallback((fn: (() => boolean) | null) => {
    escapeInterceptRef.current = fn;
  }, []);

  const form = useForm<EditOrganizationFormData>({
    resolver: zodResolver(editOrganizationSchema),
    defaultValues: {
      name: organization.name,
      shortName: organization.shortName || "",
      description: organization.description || "",
      country: organization.country || "",
      type: organization.type as OrganizationType,
      status: organization.status as OrganizationStatus,
      logoUrl: organization.logoUrl || "",
      documentLogoUrl: organization.documentLogoUrl || "",
      documentFooterText: organization.documentFooterText || "",
      documentFooterNote: organization.documentFooterNote || "",
      documentFooterLogoUrl: organization.documentFooterLogoUrl || "",
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = form;

  const watchedName = watch("name") as string;

  const onSubmit = handleSubmit(async (data) => {
    setIsLoading(true);

    try {
      const { data: updatedOrg, error } = await apiClient.put<Organization>(
        `/api/organizations/${organization.id}`,
        data,
      );

      if (error) {
        throw new Error(error || "Failed to update organization");
      }

      toast({
        type: "success",
        description: "Organization updated successfully!",
      });

      onSuccess();
      onOpenChange(false);

      // If slug changed, navigate to new URL
      if (updatedOrg && updatedOrg.slug !== organization.slug) {
        router.push(AppUrls.organization(updatedOrg.slug));
      }
    } catch (error) {
      console.error("Error updating organization:", error);
      toast({
        type: "error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to update organization",
      });
    } finally {
      setIsLoading(false);
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[780px] max-h-[90vh] w-[calc(100%-24px)] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:flex-row"
        onEscapeKeyDown={(event) => {
          // Radix dismisses on a capture-phase document Escape listener that
          // fires before the add-domain input's own onKeyDown, so the child
          // can't preempt dismissal itself — the dialog must be told to skip
          // it. OrgEmailDomainsSection registers an intercept (below): when its
          // inline add-domain input is focused it closes that input and returns
          // true, so we cancel Radix's dismiss and the keystroke only closes
          // the inline input, not the whole dialog.
          if (escapeInterceptRef.current?.()) {
            event.preventDefault();
          }
        }}
      >
        {/* Left tab rail (collapses to a top row on small screens) */}
        <nav
          aria-label="Organization settings sections"
          className="flex shrink-0 gap-1 overflow-x-auto border-b border-border bg-muted/30 p-2 sm:w-56 sm:flex-col sm:overflow-x-visible sm:border-b-0 sm:border-r sm:p-4"
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors",
                  isActive
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span className="whitespace-nowrap">{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right content pane */}
        <div className="flex min-w-0 flex-1 flex-col">
          <DialogHeader className="shrink-0 space-y-1 border-b border-border px-6 py-4 pr-12 text-left">
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="size-5" />
              Manage Organization
            </DialogTitle>
            <DialogDescription>
              Update settings for {organization.name}.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {/* General + Branding share ONE form and ONE submit. Both panes are
                kept mounted (hidden when inactive) so field state and uploads
                survive tab switches. */}
            <form
              id="edit-organization-form"
              onSubmit={onSubmit}
              className={cn(!isFormTab && "hidden")}
            >
              {/* General */}
              <div
                className={cn("space-y-4", activeTab !== "general" && "hidden")}
              >
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-medium">
                    Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="name"
                    placeholder="My Organization"
                    {...register("name")}
                  />
                  {errors.name && (
                    <p className="text-xs text-red-500">
                      {errors.name.message}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    The full name of your organization.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="shortName" className="text-sm font-medium">
                    Short Name / Abbreviation
                  </Label>
                  <Input
                    id="shortName"
                    placeholder="USFS"
                    {...register("shortName")}
                  />
                  {errors.shortName && (
                    <p className="text-xs text-red-500">
                      {errors.shortName.message}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Optional abbreviated name (e.g., USFS for US Forest
                    Service).
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description" className="text-sm font-medium">
                    Description
                  </Label>
                  <Textarea
                    id="description"
                    placeholder="Brief description of your organization..."
                    rows={3}
                    {...register("description")}
                  />
                  {errors.description && (
                    <p className="text-xs text-red-500">
                      {errors.description.message}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {((watch("description") as string) || "").length}/500
                    characters
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="type" className="text-sm font-medium">
                      Type
                    </Label>
                    <Select
                      value={watch("type") as string}
                      onValueChange={(value) =>
                        setValue(
                          "type",
                          value as EditOrganizationFormData["type"],
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="personal">Personal</SelectItem>
                        <SelectItem value="business">Business</SelectItem>
                        <SelectItem value="nonprofit">Non-profit</SelectItem>
                        <SelectItem value="government">Government</SelectItem>
                        <SelectItem value="environmental_planner">
                          Environmental Planner
                        </SelectItem>
                        <SelectItem value="demo">Demo</SelectItem>
                        <SelectItem value="internal">Internal</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.type && (
                      <p className="text-xs text-red-500">
                        {errors.type.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="status" className="text-sm font-medium">
                      Status
                    </Label>
                    <Select
                      value={watch("status") as string}
                      onValueChange={(value) =>
                        setValue(
                          "status",
                          value as EditOrganizationFormData["status"],
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.status && (
                      <p className="text-xs text-red-500">
                        {errors.status.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Branding */}
              <div
                className={cn(
                  "space-y-4",
                  activeTab !== "branding" && "hidden",
                )}
              >
                <OrganizationLogoUpload
                  currentLogoUrl={organization.logoUrl}
                  organizationName={watchedName}
                  onLogoChange={(url) => setValue("logoUrl", url ?? "")}
                  disabled={isLoading}
                />

                <DocumentBrandingFields
                  textField={register("documentFooterText")}
                  noteField={register("documentFooterNote")}
                  onDocumentLogoChange={(url) =>
                    setValue("documentLogoUrl", url ?? "")
                  }
                  onFooterLogoChange={(url) =>
                    setValue("documentFooterLogoUrl", url ?? "")
                  }
                  initialDocumentLogoUrl={organization.documentLogoUrl}
                  initialFooterLogoUrl={organization.documentFooterLogoUrl}
                  textError={errors.documentFooterText?.message}
                  noteError={errors.documentFooterNote?.message}
                  disabled={isLoading}
                />
              </div>
            </form>

            {/* Email Domains — saves via its own dedicated endpoint. Kept
                mounted (hidden when inactive) so unsaved pill edits survive tab
                switches and a save propagates without the pane reseeding from
                the stale `emailDomains` prop on tab roundtrip. */}
            <div className={cn(activeTab !== "domains" && "hidden")}>
              <OrgEmailDomainsSection
                organizationId={organization.id}
                initialDomains={organization.emailDomains}
                userId={user?.id}
                onSaved={onSuccess}
                onRegisterEscapeIntercept={registerEscapeIntercept}
              />
            </div>

            {/* Document Signing — feature-flagged. Unlike the other panes it has
                no shared form/pill state to preserve (it does its own fetch), so
                it only mounts while active; we accept the refetch on revisit. */}
            {signingEnabled && activeTab === "signing" && (
              <div data-testid="org-signing-pane">
                <OrgSigningConfig organizationId={organization.id} />
              </div>
            )}
          </div>

          {/* Shared footer for the General/Branding form. */}
          {isFormTab && (
            <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-6 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                form="edit-organization-form"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
