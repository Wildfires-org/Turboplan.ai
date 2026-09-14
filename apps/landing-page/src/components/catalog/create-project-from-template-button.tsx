"use client";

import { type KeyboardEvent, useEffect, useMemo, useState } from "react";

import { FolderOpen, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import useSWR from "swr";

import { ApiClient } from "@wildfires-org/turboplan-api-client";
import { useSession } from "@wildfires-org/turboplan-auth/client";
import { getLandingPageEnv } from "@wildfires-org/turboplan-env";

import { CheckoutModal } from "@/components/checkout/checkout-modal";
import DialogBase from "@/components/dialogs/dialog-base/dialog-base";
import Cross from "@/components/icons/cross";
import LabeledAutocomplete from "@/components/shared/labeled-autocomplete";
import LabeledInput from "@/components/shared/labeled-input";
import LabeledTextarea from "@/components/shared/labeled-textarea";
import { Button } from "@/components/ui/button";
import { DialogDescription } from "@/components/ui/dialog";
import { useBillingAccess } from "@/hooks/use-billing-access";
import { useToast } from "@/hooks/use-toast";

const { SERVER_URL, TURBOPLAN_URL } = getLandingPageEnv();
const apiClient = new ApiClient({ baseUrl: SERVER_URL });

const GOVERNMENT_ORG_TYPE = "government";

interface OfficeWithOffices {
  id: string;
  slug: string;
  name: string;
}

interface OrganizationWithOffices {
  id: string;
  slug: string;
  name: string;
  shortName: string | null;
  type: string;
  offices: OfficeWithOffices[];
}

interface CreateFromTemplateResponse {
  project: { slug: string };
  submitted: boolean;
  location: {
    organizationSlug: string;
    officeSlug: string;
    projectSlug: string;
  };
}

interface CreateProjectFromTemplateButtonProps {
  templateId: string;
  templateName: string;
  templateDescription: string | null;
  initialOrganization: {
    id: string;
    name: string;
    slug: string;
  };
}

function getDefaultProjectName(templateName: string) {
  const withoutPrefix = templateName.replace(/^Template:\s*/i, "").trim();
  return withoutPrefix || templateName;
}

async function authenticatedFetcher<T>(endpoint: string): Promise<T> {
  const { data, error } = await apiClient.get<T>(endpoint);

  if (error || !data) {
    throw new Error(error || "Failed to load data");
  }

  return data;
}

export function CreateProjectFromTemplateButton({
  templateId,
  templateName,
  templateDescription,
  initialOrganization,
}: CreateProjectFromTemplateButtonProps) {
  const router = useRouter();
  const { toast } = useToast();
  const session = useSession();
  const isLoggedIn = !!session?.user;

  const { requiresUpgrade, isLoading: isBillingLoading } = useBillingAccess();

  const [isOpen, setIsOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [pendingOpen, setPendingOpen] = useState(false);
  const [projectTitle, setProjectTitle] = useState(
    getDefaultProjectName(templateName),
  );
  const [projectDescription, setProjectDescription] = useState(
    templateDescription ?? "",
  );
  const [organizationName, setOrganizationName] = useState("");
  const [officeName, setOfficeName] = useState("");
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [selectedOfficeId, setSelectedOfficeId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [hasInitializedDestination, setHasInitializedDestination] =
    useState(false);
  const [errors, setErrors] = useState<{
    projectTitle: boolean;
    organization: boolean;
    office: boolean;
  }>({
    projectTitle: false,
    organization: false,
    office: false,
  });

  const { data: allOrganizations = [] } = useSWR<OrganizationWithOffices[]>(
    isLoggedIn ? "/api/organizations/with-offices" : null,
    authenticatedFetcher<OrganizationWithOffices[]>,
  );

  // Submission targets are government organizations only; the project is
  // created in the user's personal org and submitted to one of these.
  const governmentOrganizations = useMemo(
    () => allOrganizations.filter((org) => org.type === GOVERNMENT_ORG_TYPE),
    [allOrganizations],
  );

  const selectedOrganization = useMemo(
    () =>
      governmentOrganizations.find((org) => org.id === selectedOrgId) ?? null,
    [governmentOrganizations, selectedOrgId],
  );

  const offices = useMemo(
    () => selectedOrganization?.offices ?? [],
    [selectedOrganization],
  );

  const organizationOptions = useMemo(
    () =>
      governmentOrganizations.map((org) => ({
        value: org.id,
        label: org.shortName || org.name,
      })),
    [governmentOrganizations],
  );

  const officeOptions = useMemo(
    () =>
      offices.map((office) => ({
        value: office.id,
        label: office.name,
      })),
    [offices],
  );

  useEffect(() => {
    if (!isOpen) {
      setHasInitializedDestination(false);
      return;
    }

    setProjectTitle(getDefaultProjectName(templateName));
    setProjectDescription(templateDescription ?? "");
    setOrganizationName("");
    setOfficeName("");
    setSelectedOrgId(null);
    setSelectedOfficeId(null);
    setIsSubmitting(false);
    setIsRedirecting(false);
    setErrors({ projectTitle: false, organization: false, office: false });
  }, [isOpen, templateDescription, templateName]);

  useEffect(() => {
    if (
      !isOpen ||
      hasInitializedDestination ||
      governmentOrganizations.length === 0
    ) {
      return;
    }

    const preferredOrganization =
      governmentOrganizations.find(
        (org) => org.id === initialOrganization.id,
      ) ?? governmentOrganizations[0];

    setOrganizationName(
      preferredOrganization.shortName || preferredOrganization.name,
    );
    setSelectedOrgId(preferredOrganization.id);
    setHasInitializedDestination(true);
  }, [
    hasInitializedDestination,
    initialOrganization.id,
    isOpen,
    governmentOrganizations,
  ]);

  // Gate the create modal on billing BEFORE it opens. The project always lands
  // in the user's personal workspace, so an over-quota user with no active
  // billing must upgrade first — we open the checkout wall instead of the modal.
  // Closing always passes through. When billing is still resolving on click, the
  // open is deferred until it settles (mirrors the prompt-input flow).
  const routeOpen = () => {
    if (requiresUpgrade) {
      setCheckoutOpen(true);
      return;
    }
    setIsOpen(true);
  };

  const handleDialogOpenChange = (open: boolean) => {
    if (!open) {
      setIsOpen(false);
      return;
    }
    if (isBillingLoading) {
      setPendingOpen(true);
      return;
    }
    routeOpen();
  };

  useEffect(() => {
    if (!pendingOpen || isBillingLoading) {
      return;
    }
    setPendingOpen(false);
    routeOpen();
    // routeOpen reads the latest requiresUpgrade from closure; only re-run when
    // the pending flag or billing-loading state changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingOpen, isBillingLoading]);

  const handleOrganizationChange = (value: string) => {
    setOrganizationName(value);

    const matchedOrg = governmentOrganizations.find(
      (org) =>
        org.name.toLowerCase() === value.toLowerCase() ||
        (org.shortName && org.shortName.toLowerCase() === value.toLowerCase()),
    );

    if (matchedOrg) {
      setSelectedOrgId(matchedOrg.id);
    } else {
      setSelectedOrgId(null);
    }

    setSelectedOfficeId(null);
    setOfficeName("");
  };

  const handleOfficeChange = (value: string) => {
    setOfficeName(value);

    const matchedOffice = offices.find(
      (office) => office.name.toLowerCase() === value.toLowerCase(),
    );
    setSelectedOfficeId(matchedOffice ? matchedOffice.id : null);
  };

  const handleSubmit = async () => {
    // Only the project title is required: the project is created in the user's
    // personal workspace. The organization/office are an optional default for a
    // later submit-for-review and never block creation.
    const nextErrors = {
      projectTitle: !projectTitle.trim(),
      organization: false,
      office: false,
    };
    setErrors(nextErrors);

    if (nextErrors.projectTitle) {
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await apiClient.post<CreateFromTemplateResponse>(
        `/api/projects/${templateId}/create-from-template`,
        {
          name: projectTitle.trim(),
          description: projectDescription.trim() || undefined,
          // Echoed back as the user's preferred submit target (a default for a
          // later explicit submit-for-review). Ignored by the server at creation.
          submitTo:
            selectedOrgId && selectedOfficeId
              ? {
                  organizationId: selectedOrgId,
                  officeId: selectedOfficeId,
                }
              : undefined,
        },
      );

      if (error || !data?.location) {
        throw new Error(error || "Failed to create project from template");
      }

      setIsRedirecting(true);
      toast({
        variant: "success",
        title: "Project created in your workspace",
        description: "Redirecting to your new project...",
      });

      const { location } = data;
      const targetUrl =
        `${TURBOPLAN_URL}/organizations/${location.organizationSlug}` +
        `/offices/${location.officeSlug}/projects/${location.projectSlug}`;
      router.push(targetUrl);
    } catch (error) {
      setIsRedirecting(false);
      setIsSubmitting(false);
      toast({
        variant: "destructive",
        title: "Could not create project",
        description:
          error instanceof Error
            ? error.message
            : "Failed to create project from template",
      });
    }
  };

  // Enter submits from the project-title input, mirroring the create button's
  // disabled conditions. The autocompletes consume Enter themselves and the
  // description textarea keeps Enter as a newline, so no form wrapper is used.
  const handleTitleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) {
      return;
    }

    event.preventDefault();

    if (isSubmitting || isRedirecting || !projectTitle.trim()) {
      return;
    }

    handleSubmit();
  };

  if (!isLoggedIn) {
    return null;
  }

  return (
    <>
      <DialogBase
        isOpen={isOpen}
        onOpenChange={handleDialogOpenChange}
        title="Create project from template"
        triggerSlot={
          <Button className="h-8 rounded-md border-[0.75px] border-neutral-grey bg-white px-3 text-sm font-medium text-neutral-black hover:bg-gray-10">
            <FolderOpen className="mr-2 size-4" />
            Use template
          </Button>
        }
        headerSlot={
          <div className="space-y-1 px-6 pt-6 pr-12">
            <Cross
              className="absolute right-6 top-6 cursor-pointer"
              onClick={(e) => {
                setIsOpen(false);
                e?.stopPropagation();
              }}
            />
            <h2 className="text-lg font-medium text-neutral-black">
              Create project from template
            </h2>
            <DialogDescription className="text-sm text-neutral-grey3">
              Create your project in your personal workspace.
            </DialogDescription>
          </div>
        }
        separator={false}
        className="w-[calc(100%-24px)] md:w-[560px] rounded-lg bg-neutral-light border-[0.75px] border-neutral-grey"
        footerSlot={
          <div className="flex items-center justify-end gap-2 border-t border-neutral-grey/60 px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isSubmitting || isRedirecting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-green-60 text-white hover:bg-green-60/90"
              onClick={handleSubmit}
              disabled={isSubmitting || isRedirecting || !projectTitle.trim()}
            >
              {isRedirecting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Redirecting...
                </>
              ) : isSubmitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create project"
              )}
            </Button>
          </div>
        }
      >
        <div className="max-h-[58vh] space-y-4 overflow-y-auto px-6 py-4">
          <LabeledAutocomplete
            label="Submit to organization (optional)"
            placeholder="Select an organization"
            value={organizationName}
            onValueChange={handleOrganizationChange}
            options={organizationOptions}
            hasError={errors.organization}
            inputClassName="bg-white"
            disabled={isSubmitting || isRedirecting}
            emptyMessage="No organizations available for submission"
          />

          <LabeledAutocomplete
            label="Office"
            placeholder="Select an office"
            value={officeName}
            onValueChange={handleOfficeChange}
            options={officeOptions}
            hasError={errors.office}
            inputClassName="bg-white"
            disabled={isSubmitting || isRedirecting || !selectedOrgId}
            emptyMessage={
              selectedOrgId
                ? "No offices found in this organization"
                : "Select organization first"
            }
          />

          <LabeledInput
            label="Project title"
            placeholder="Enter project title"
            value={projectTitle}
            hasError={errors.projectTitle}
            className="bg-white"
            onChange={(e) => setProjectTitle(e.target.value)}
            onKeyDown={handleTitleKeyDown}
            disabled={isSubmitting || isRedirecting}
          />

          <LabeledTextarea
            label="Description"
            placeholder="Optional project description"
            value={projectDescription}
            className="bg-white min-h-[96px]"
            onChange={(e) => setProjectDescription(e.target.value)}
            disabled={isSubmitting || isRedirecting}
          />
        </div>
      </DialogBase>
      <CheckoutModal isOpen={checkoutOpen} onOpenChange={setCheckoutOpen} />
    </>
  );
}
