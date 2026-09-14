import { type KeyboardEvent, useEffect, useMemo, useState } from "react";

import { cx } from "class-variance-authority";
import { Loader2, Sparkles, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { posthog } from "posthog-js";
import useSWR from "swr";

import {
  formatMissingDetails,
  useEnhanceProjectPrompt,
  useValidateProjectPrompt,
} from "@wildfires-org/turboplan-ai/client";
import { useSession } from "@wildfires-org/turboplan-auth/client";
import { getLandingPageEnv } from "@wildfires-org/turboplan-env";
import { BrandGradientIcon } from "@wildfires-org/turboplan-utils";

import DialogBase from "@/components/dialogs/dialog-base/dialog-base";
import {
  CONTEXT_RESOURCES_PARAM,
  EMAIL_PARAM,
  OFFICE_ID_PARAM,
  ORGANIZATION_ID_PARAM,
  POSTHOG_DISTINCT_ID_PARAM,
  PROJECT_DESCRIPTION_PARAM,
  PROJECT_TITLE_PARAM,
} from "@/consts/urlParams";
import { getAttributionParams } from "@/lib/attribution";
import { brand } from "@/lib/brand";
import { fetcher } from "@/lib/utils";
import { events } from "@/types/analytics";
import { routing } from "@/utils/routing";
import { validateEmail } from "@/utils/validate-email";
import Arrow from "../icons/arrow";
import Cross from "../icons/cross";
import ExclamationMarkIcon from "../icons/exclamation-mark";
import LabeledInput from "../shared/labeled-input";
import LabeledTextarea from "../shared/labeled-textarea";
import { inputErrorMessage } from "../shared/styles";
import { Button } from "../ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";

// Agency/office are not editable fields. They are resolved in the background
// from the template props (initialOrganizationName / initialOfficeName) and
// passed as hidden params (by ID only); empty when no template. Once both
// resolve, the target is surfaced read-only above the submit button with a
// clear button, so submitting to an agency is never invisible or irreversible.

interface Organization {
  id: string;
  name: string;
  shortName: string | null;
  slug: string;
  // The public endpoint lists both government agencies and environmental-planning
  // firms (for the catalog), so callers that need submission targets filter on this.
  type?: string;
}

interface Office {
  id: string;
  name: string;
  slug: string;
}

type FormData = {
  email: string;
  organizationName: string;
  officeName: string;
  projectTitle: string;
};

type FormErrors = {
  email: boolean;
  projectTitle: boolean;
  projectPrompt: boolean;
};

export const SignupModal = ({
  initialProjectTitle,
  initialOrganizationName,
  initialOfficeName,
  isOpen,
  onOpenChange,
  projectDescription,
}: {
  initialProjectTitle?: string;
  initialOrganizationName?: string;
  initialOfficeName?: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  projectDescription?: string;
}) => {
  const searchParams = useSearchParams();
  const ENV = getLandingPageEnv();
  const session = useSession();
  const isLoggedIn = !!session?.user;

  const [data, setData] = useState<FormData>({
    email: searchParams.get(EMAIL_PARAM) || "",
    organizationName: "",
    officeName: initialOfficeName || "",
    projectTitle: initialProjectTitle || "",
  });

  // For logged-in users, use their session email
  const effectiveEmail = isLoggedIn ? session?.user?.email || "" : data.email;

  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [selectedOfficeId, setSelectedOfficeId] = useState<string | null>(null);
  // Set when the user explicitly drops the resolved submission target. Without
  // it the auto-match effects below would immediately re-derive the same target
  // (their only guard is a null id), silently undoing the opt-out.
  const [isTargetCleared, setIsTargetCleared] = useState(false);
  const [isError, setIsError] = useState<FormErrors | null>(null);
  // Cross-origin hand-off to the app takes several seconds (SSR auth + bundle).
  // Keep the modal locked with a visible status until the browser leaves.
  const [isRedirecting, setIsRedirecting] = useState(false);

  const [projectPrompt, setProjectPrompt] = useState(projectDescription || "");
  const {
    validate: validatePrompt,
    isValidating: isValidatingPrompt,
    validation: promptValidation,
    reset: resetPromptValidation,
  } = useValidateProjectPrompt({ isPublic: true });
  const { enhance: enhancePrompt, isEnhancing } = useEnhanceProjectPrompt({
    isPublic: true,
  });

  // Fetch organizations with SWR. The fallback must be identity-stable —
  // an inline `= []` default creates a fresh array every render while the
  // fetch is unresolved/failing, which cascades through the org memos into
  // the setData effect and loops the render cycle.
  const { data: organizationsData } = useSWR<Organization[]>(
    `${ENV.SERVER_URL}/api/public/organizations`,
    fetcher,
  );
  const organizations = useMemo(
    () => organizationsData ?? [],
    [organizationsData],
  );

  // Fetch offices with SWR (conditional on selectedOrgId)
  const { data: officesResponse } = useSWR<{ items: Office[]; total: number }>(
    selectedOrgId
      ? `${ENV.SERVER_URL}/api/public/offices?organizationId=${selectedOrgId}`
      : null,
    fetcher,
  );
  const offices = useMemo(
    () => officesResponse?.items ?? [],
    [officesResponse],
  );

  // Submission targets are government-only server-side (the submission/review
  // flow rejects non-government orgs), so only government agencies are matched
  // even though the public endpoint also lists environmental-planning firms.
  const governmentOrganizations = useMemo(
    () => organizations.filter((org) => org.type === "government"),
    [organizations],
  );

  // Both ids are needed for the app to auto-submit, so the notice only shows
  // once the resolved target is complete — that is exactly when submitting
  // stops being a private draft and becomes a submission to an agency.
  const submissionTargetName = useMemo(() => {
    if (!selectedOrgId || !selectedOfficeId) {
      return null;
    }
    const matchedOrg = governmentOrganizations.find(
      (org) => org.id === selectedOrgId,
    );
    return matchedOrg?.name ?? null;
  }, [governmentOrganizations, selectedOrgId, selectedOfficeId]);

  // Auto-match office name to existing office when offices are loaded
  // This ensures AI-generated office names use existing offices instead of creating new ones
  useEffect(() => {
    if (isTargetCleared || selectedOfficeId || !data.officeName) {
      return;
    }
    const matchedOffice = offices.find(
      (off) => off.name.toLowerCase() === data.officeName.toLowerCase(),
    );
    if (matchedOffice) {
      setSelectedOfficeId(matchedOffice.id);
    }
  }, [offices, data.officeName, selectedOfficeId, isTargetCleared]);

  useEffect(() => {
    if (!isOpen) {
      setIsError(null);
      setIsRedirecting(false);
      resetPromptValidation();
    }
  }, [isOpen, resetPromptValidation]);

  // If the user navigates Back from the app, the browser may restore this page
  // from the bfcache with isRedirecting still true — which would leave the
  // modal permanently locked. pageshow with persisted=true is that restore.
  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        setIsRedirecting(false);
      }
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => {
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, []);

  // Auto-validate when modal opens with projectDescription populated
  useEffect(() => {
    if (isOpen && projectDescription) {
      setProjectPrompt(projectDescription);
      validatePrompt(projectDescription);
    }
  }, [isOpen, projectDescription, validatePrompt]);

  // The modal stays mounted inside SearchInput across open/close cycles, so a
  // submission target matched for an earlier prompt would otherwise survive into
  // the next one and auto-submit that project to the wrong agency. Every new set
  // of props starts from a clean slate; the effects above then re-derive the
  // target from the current props only.
  useEffect(() => {
    setData((p) => ({
      ...p,
      projectTitle: initialProjectTitle || "",
      organizationName: initialOrganizationName || "",
      officeName: initialOfficeName || "",
    }));
    setSelectedOrgId(null);
    setSelectedOfficeId(null);
    setIsTargetCleared(false);
  }, [initialProjectTitle, initialOrganizationName, initialOfficeName]);

  // Match the organization name to a known government agency. Kept separate
  // from the reset above so an SWR revalidation of the org list re-runs only
  // this (guarded) match instead of wiping a target the user just cleared.
  useEffect(() => {
    if (isTargetCleared || selectedOrgId || !data.organizationName) {
      return;
    }
    const organizationName = data.organizationName.toLowerCase();
    const matchedOrg = governmentOrganizations.find(
      (org) =>
        org.name.toLowerCase() === organizationName ||
        org.shortName?.toLowerCase() === organizationName,
    );
    if (matchedOrg) {
      setSelectedOrgId(matchedOrg.id);
    }
  }, [
    data.organizationName,
    governmentOrganizations,
    selectedOrgId,
    isTargetCleared,
  ]);

  const onSubmit = async () => {
    setIsError(null);
    const { projectTitle } = data;

    // For logged-in users, we don't need email validation
    const errors: FormErrors = {
      email: !isLoggedIn && !validateEmail(effectiveEmail),
      projectTitle: !projectTitle,
      projectPrompt: !projectPrompt.trim(),
    };

    setIsError(errors);

    if (Object.values(errors).some((error) => error)) {
      return;
    }

    // Validate prompt with AI before submitting
    const validation =
      promptValidation ?? (await validatePrompt(projectPrompt));
    if (validation && !validation.valid) {
      return;
    }

    const params = new URLSearchParams();
    // Only include email for non-logged-in users. The account role is detected
    // automatically from the email domain server-side, so it is not sent here.
    if (!isLoggedIn) {
      params.append(EMAIL_PARAM, effectiveEmail);
    }
    // Pass IDs for the chosen government org/office so the personal-org draft is
    // submitted to that agency for review. Omitting them keeps the project a
    // private draft in the user's own workspace.
    if (selectedOrgId) {
      params.append(ORGANIZATION_ID_PARAM, selectedOrgId);
    }
    if (selectedOfficeId) {
      params.append(OFFICE_ID_PARAM, selectedOfficeId);
    }
    params.append(PROJECT_TITLE_PARAM, projectTitle);
    if (projectPrompt.trim()) {
      params.append(PROJECT_DESCRIPTION_PARAM, projectPrompt.trim());
    }
    searchParams.getAll(CONTEXT_RESOURCES_PARAM).forEach((resource) => {
      params.append(CONTEXT_RESOURCES_PARAM, resource);
    });

    // Forward the PostHog distinct id so the app can alias this browser's
    // landing-page session to the account created on the other side.
    if (posthog.__loaded) {
      const distinctId = posthog.get_distinct_id();
      if (distinctId) {
        params.append(POSTHOG_DISTINCT_ID_PARAM, distinctId);
      }
    }

    // Campaign attribution — current URL first, then the values persisted on
    // first landing. Only params that have a value are appended.
    Object.entries(getAttributionParams(searchParams)).forEach(
      ([key, value]) => {
        params.append(key, value);
      },
    );

    const href = `${ENV.TURBOPLAN_URL}/self-service?${params.toString()}`;
    // sendBeacon: the full-page navigation right below would otherwise race
    // posthog's batched XHR queue and can drop this event (Safari especially).
    if (posthog.__loaded) {
      posthog.capture(events.SIGNUP_STARTED, undefined, {
        transport: "sendBeacon",
      });
    }
    setIsRedirecting(true);
    // Cross-origin target — a full navigation, not a Next.js route change.
    window.location.assign(href);
  };

  const isBusy = isValidatingPrompt || isEnhancing || isRedirecting;
  const busyLabel = isRedirecting
    ? "Taking you to your new project…"
    : isValidatingPrompt
      ? "Checking your project prompt…"
      : null;

  // Enter submits from the plain text inputs. The autocomplete fields handle
  // Enter themselves (selecting an option) and the prompt textarea keeps Enter
  // as a newline, so this is wired per-input rather than via a form wrapper.
  const handleFieldKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) {
      return;
    }

    event.preventDefault();

    if (isBusy) {
      return;
    }

    onSubmit();
  };

  // Dropping the target keeps the project a private draft in the user's own
  // workspace instead of auto-submitting it to the agency for review.
  const handleClearSubmissionTarget = () => {
    setSelectedOrgId(null);
    setSelectedOfficeId(null);
    setIsTargetCleared(true);
  };

  const handleEnhancePrompt = async () => {
    const currentPrompt = projectPrompt.trim();
    if (!currentPrompt) {
      return;
    }

    const enhanced = await enhancePrompt(
      `${data.projectTitle}: ${currentPrompt}`,
      promptValidation?.missing,
    );
    if (enhanced) {
      setProjectPrompt(enhanced);
      resetPromptValidation();
    }
  };

  return (
    <DialogBase
      className="w-[calc(100%-24px)] md:w-[448px] rounded-lg bg-neutral-light border-[0.75px] border-neutral-grey"
      separator={false}
      triggerSlot={null}
      headerSlot={null}
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (isRedirecting) {
          return;
        }
        onOpenChange(open);
      }}
    >
      <Cross
        className="absolute right-7 top-7 cursor-pointer"
        onClick={(e) => {
          if (!isRedirecting) {
            onOpenChange(false);
          }
          e?.stopPropagation();
        }}
      />
      <div className="w-full flex flex-col p-6 gap-2 items-center">
        <h2 className="text-neutral-black text-lg text-center pb-2">
          {isLoggedIn ? (
            <>Create a new project</>
          ) : (
            <>
              Sign up for <span className="text-green-60">{brand.name}</span>
            </>
          )}
        </h2>
        <div className="flex flex-col w-full gap-4">
          {/* Email - only show for non-logged-in users */}
          {!isLoggedIn && (
            <div className="w-full">
              <LabeledInput
                label="Email address"
                placeholder="john@company.com"
                className="bg-white"
                value={data.email}
                hasError={isError?.email}
                autoFocus
                onChange={(e) =>
                  setData((prev) => ({ ...prev, email: e.target.value }))
                }
                onKeyDown={handleFieldKeyDown}
              />
              {isError?.email && (
                <p
                  className={cx(
                    "mt-1 flex gap-1 text-destructive font-medium text-sm",
                    inputErrorMessage,
                  )}
                >
                  Please provide valid email address
                  <ExclamationMarkIcon size={16} />
                </p>
              )}
            </div>
          )}

          {/* Project name */}
          <div className="w-full">
            <LabeledInput
              label="Project name"
              placeholder="Forest Road 43 repair, Tahoe NF"
              className="bg-white"
              value={data.projectTitle}
              hasError={isError?.projectTitle}
              onChange={(e) =>
                setData((prev) => ({ ...prev, projectTitle: e.target.value }))
              }
              onKeyDown={handleFieldKeyDown}
            />
            {isError?.projectTitle && (
              <p
                className={cx(
                  "mt-1 flex gap-1 text-destructive font-medium text-sm",
                  inputErrorMessage,
                )}
              >
                Please provide Project name
                <ExclamationMarkIcon size={16} />
              </p>
            )}
          </div>

          {/* Project prompt */}
          <div className="w-full">
            <div className="relative">
              <LabeledTextarea
                label="Project prompt"
                placeholder="Describe your project goals, location, conditions, and desired outcomes..."
                className="bg-white min-h-[220px] max-h-[45vh] field-sizing-content"
                value={projectPrompt}
                hasError={
                  (promptValidation !== null && !promptValidation.valid) ||
                  isError?.projectPrompt
                }
                onChange={(e) => {
                  setProjectPrompt(e.target.value);
                  resetPromptValidation();
                }}
              />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className={cx(
                        "absolute bottom-2 right-2 rounded-md border border-gray-100 bg-white p-1.5 transition-colors hover:bg-gray-50",
                        promptValidation &&
                          !promptValidation.valid &&
                          "animate-scale-pulse",
                      )}
                      onClick={handleEnhancePrompt}
                      hidden={!projectPrompt.trim()}
                      disabled={isEnhancing || isRedirecting}
                    >
                      {isEnhancing ? (
                        <Loader2 className="size-5 animate-spin text-gray-400" />
                      ) : (
                        <BrandGradientIcon icon={Sparkles} className="size-5" />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    Enhance prompt with AI
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            {promptValidation && !promptValidation.valid && (
              <p
                className={cx(
                  "mt-1 flex gap-1 font-medium text-sm text-destructive",
                  inputErrorMessage,
                )}
              >
                {promptValidation.feedback ||
                  formatMissingDetails(promptValidation.missing)}
              </p>
            )}
            {isError?.projectPrompt && (
              <p
                className={cx(
                  "mt-1 flex gap-1 text-destructive font-medium text-sm",
                  inputErrorMessage,
                )}
              >
                Please provide a project prompt
                <ExclamationMarkIcon size={16} />
              </p>
            )}
          </div>
        </div>

        {submissionTargetName && (
          <div className="mt-2 flex w-full items-center gap-2 rounded-md border-[0.75px] border-neutral-grey bg-white px-3 py-2 text-sm">
            <span className="min-w-0 flex-1 text-neutral-grey3">
              Will be submitted to:{" "}
              <span className="text-neutral-black">{submissionTargetName}</span>
            </span>
            <button
              type="button"
              className="shrink-0 rounded-sm p-0.5 text-neutral-grey3 transition-colors hover:bg-neutral-light hover:text-neutral-black disabled:opacity-50"
              onClick={handleClearSubmissionTarget}
              disabled={isRedirecting}
              aria-label="Clear submission target"
            >
              <X className="size-4" />
            </button>
          </div>
        )}

        <Button
          onClick={onSubmit}
          disabled={isBusy}
          className="flex justify-center items-center pl-5 pr-3 w-min py-2 mt-2 gap-2 rounded-lg bg-green-60 text-white text-base leading-5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {(isValidatingPrompt || isRedirecting) && (
            <Loader2 className="mr-2 size-4 animate-spin" />
          )}
          <span className="whitespace-nowrap">
            {isRedirecting ? "Creating project" : "Create project"}
          </span>
          <Arrow size={18} color="currentColor" />
        </Button>
        {busyLabel && (
          <p
            className="text-sm text-neutral-grey3 text-center"
            aria-live="polite"
          >
            {busyLabel}
          </p>
        )}
      </div>
      {!isLoggedIn && (
        <>
          <hr className="w-full" />
          <div className="flex flex-row align-center justify-center py-[10px] text-sm items-center gap-1">
            <span className="text-neutral-grey3 text-center">
              Already have an account?
            </span>
            <a href={routing.signIn()}>Sign in</a>
          </div>
        </>
      )}
    </DialogBase>
  );
};
