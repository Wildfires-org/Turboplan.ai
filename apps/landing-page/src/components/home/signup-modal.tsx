"use client";

import {
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  Suspense,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  AlertCircle,
  ArrowRight,
  ChevronDown,
  FileText,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";
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
import { LANDING_UPLOADS_PARAM } from "@wildfires-org/turboplan-upload/types";
import { BrandGradientIcon } from "@wildfires-org/turboplan-utils";

import {
  GLASS_INPUT_CLASS,
  MODAL_CLOSE_BUTTON_CLASS,
  MODAL_SURFACE_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "@/components/catalog/catalog-layout";
import LabeledInput from "@/components/shared/labeled-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  CONTEXT_RESOURCES_PARAM,
  EMAIL_PARAM,
  OFFICE_ID_PARAM,
  ORGANIZATION_ID_PARAM,
  POSTHOG_DISTINCT_ID_PARAM,
  PROJECT_DESCRIPTION_PARAM,
  PROJECT_TITLE_PARAM,
} from "@/consts/urlParams";
import type { AttachedDocument } from "@/hooks/use-prompt-attachments";
import { getAttributionParams } from "@/lib/attribution";
import { cn, fetcher } from "@/lib/utils";
import { events } from "@/types/analytics";
import { routing } from "@/utils/routing";
import { validateEmail } from "@/utils/validate-email";

// Anonymous visitors already typed their prompt and the project name is
// generated, so the default view asks only for an email: a read-only summary
// of the project, the email field and the button. Name and prompt editing sit
// behind "Edit details", which opens by itself when a check blocks the submit.
//
// Agency/office are not editable fields. They are resolved in the background
// from the proposed names (initialOrganizationName / initialOfficeName) and
// passed as hidden params (by ID only); empty when none match.

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

// "checking": the submit waits on the prompt check; "redirecting": the
// browser is leaving for the app.
type SubmitStatus = "idle" | "checking" | "redirecting";

const NO_DOCUMENTS: AttachedDocument[] = [];

const FIELD_ERROR_CLASS =
  "outline-solid outline-2 outline-red-60 focus-visible:outline-red-60";

type SignupModalProps = {
  initialProjectTitle?: string;
  initialOrganizationName?: string;
  initialOfficeName?: string;
  /** Generated names are still on their way; the summary says so. */
  isProjectTitlePending?: boolean;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  projectDescription?: string;
  /** Documents already uploaded from the hero; they come along as params. */
  attachedDocuments?: AttachedDocument[];
};

// The modal reads search params (prefilled email, attribution), so it carries
// its own Suspense boundary: rendered unwrapped on a statically prerendered
// page it would opt the whole page out of server rendering. It starts closed,
// so nothing visible waits on the boundary.
export const SignupModal = (props: SignupModalProps) => {
  return (
    <Suspense>
      <SignupModalContent {...props} />
    </Suspense>
  );
};

const SignupModalContent = ({
  initialProjectTitle,
  initialOrganizationName,
  initialOfficeName,
  isProjectTitlePending = false,
  isOpen,
  onOpenChange,
  projectDescription,
  attachedDocuments = NO_DOCUMENTS,
}: SignupModalProps) => {
  const searchParams = useSearchParams();
  const ENV = getLandingPageEnv();
  const session = useSession();
  const isLoggedIn = !!session?.user;

  const fieldId = useId();
  const emailId = `${fieldId}-email`;
  const emailErrorId = `${fieldId}-email-error`;
  const titleId = `${fieldId}-title`;
  const titleErrorId = `${fieldId}-title-error`;
  const promptId = `${fieldId}-prompt`;
  const promptErrorId = `${fieldId}-prompt-error`;
  const detailsId = `${fieldId}-details`;

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
  const [isError, setIsError] = useState<FormErrors | null>(null);
  // Cross-origin hand-off to the app takes several seconds (SSR auth + bundle).
  // Keep the modal locked with a visible status until the browser leaves.
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");
  const isSubmitting = submitStatus !== "idle";
  const isRedirecting = submitStatus === "redirecting";
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  // A project name the user typed is theirs: a late generated one never
  // replaces it.
  const [hasEditedTitle, setHasEditedTitle] = useState(false);
  // Bumped when a blocked submit needs the prompt field in front of the user.
  const [promptFocusRequest, setPromptFocusRequest] = useState(0);
  const promptRef = useRef<HTMLTextAreaElement>(null);

  // Bumped on close, so a submit still waiting on the prompt check stops.
  const submitAttemptRef = useRef(0);
  // The proposed names last copied into the form (see the effect below).
  const appliedProposalRef = useRef<string | null>(null);

  const [projectPrompt, setProjectPrompt] = useState(projectDescription || "");
  // The details the prompt check looks for may well be in the attached
  // documents, so it does not gate the submission when there are any.
  const hasAttachedDocuments = attachedDocuments.length > 0;
  const {
    validate: validatePrompt,
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

  // Auto-match office name to existing office when offices are loaded
  // This ensures AI-generated office names use existing offices instead of creating new ones
  useEffect(() => {
    if (selectedOfficeId || !data.officeName) {
      return;
    }
    const matchedOffice = offices.find(
      (off) => off.name.toLowerCase() === data.officeName.toLowerCase(),
    );
    if (matchedOffice) {
      setSelectedOfficeId(matchedOffice.id);
    }
  }, [offices, data.officeName, selectedOfficeId]);

  // A close resets what the next open must not inherit.
  useEffect(() => {
    if (!isOpen) {
      setIsError(null);
      setSubmitStatus("idle");
      setIsDetailsOpen(false);
      setHasEditedTitle(false);
      resetPromptValidation();
      submitAttemptRef.current += 1;
      appliedProposalRef.current = null;
    }
  }, [isOpen, resetPromptValidation]);

  // If the user navigates Back from the app, the browser may restore this page
  // from the bfcache with the redirect status still set — which would leave
  // the modal permanently locked. pageshow with persisted=true is that restore.
  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        setSubmitStatus("idle");
      }
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => {
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, []);

  // Auto-validate when modal opens with projectDescription populated. The
  // result shows only in the details, which a blocked submit opens.
  useEffect(() => {
    if (isOpen && projectDescription) {
      setProjectPrompt(projectDescription);
      if (!hasAttachedDocuments) {
        validatePrompt(projectDescription);
      }
    }
  }, [isOpen, projectDescription, hasAttachedDocuments, validatePrompt]);

  // The proposed names arrive twice per open: the prompt-based fallback at
  // once, then the generated ones seconds later. Each new set replaces the
  // last, and the submission target is re-derived from it (the modal stays
  // mounted across opens, so a target matched for an earlier prompt must not
  // survive into the next one). A name the user typed stays, and nothing
  // changes under a submit in flight: names that arrive during the prompt
  // check apply once it settles, and never once the browser is leaving.
  useEffect(() => {
    if (!isOpen || isSubmitting) {
      return;
    }
    const proposal = JSON.stringify([
      initialProjectTitle,
      initialOrganizationName,
      initialOfficeName,
    ]);
    if (appliedProposalRef.current === proposal) {
      return;
    }
    appliedProposalRef.current = proposal;
    setData((prev) => ({
      ...prev,
      projectTitle: hasEditedTitle
        ? prev.projectTitle
        : initialProjectTitle || "",
      organizationName: initialOrganizationName || "",
      officeName: initialOfficeName || "",
    }));
    setSelectedOrgId(null);
    setSelectedOfficeId(null);
  }, [
    isOpen,
    isSubmitting,
    hasEditedTitle,
    initialProjectTitle,
    initialOrganizationName,
    initialOfficeName,
  ]);

  // Match the organization name to a known government agency. Kept separate
  // from the reset above so an SWR revalidation of the org list re-runs only
  // this (guarded) match instead of resetting the form.
  useEffect(() => {
    if (selectedOrgId || !data.organizationName) {
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
  }, [data.organizationName, governmentOrganizations, selectedOrgId]);

  // A blocked submit opened the details: put the prompt (and the message
  // under it) in view.
  useEffect(() => {
    if (promptFocusRequest > 0) {
      promptRef.current?.focus();
    }
  }, [promptFocusRequest]);

  const openDetails = () => {
    setIsDetailsOpen(true);
  };

  const handleToggleDetails = () => {
    if (isDetailsOpen) {
      setIsDetailsOpen(false);
      return;
    }
    openDetails();
  };

  const handleOpenChange = (open: boolean) => {
    if (isRedirecting) {
      return;
    }
    onOpenChange(open);
  };

  const handleSubmit = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (isSubmitting || isEnhancing) {
      return;
    }

    const projectTitle = data.projectTitle.trim();
    const prompt = projectPrompt.trim();

    // For logged-in users, we don't need email validation
    const errors: FormErrors = {
      email: !isLoggedIn && !validateEmail(effectiveEmail.trim()),
      projectTitle: !projectTitle,
      projectPrompt: !prompt,
    };
    setIsError(errors);

    if (errors.projectTitle || errors.projectPrompt) {
      openDetails();
    }
    if (Object.values(errors).some(Boolean)) {
      return;
    }

    const attempt = submitAttemptRef.current;
    setSubmitStatus("checking");

    // Validate prompt with AI before submitting
    if (!hasAttachedDocuments) {
      const validation = promptValidation ?? (await validatePrompt(prompt));
      if (attempt !== submitAttemptRef.current) {
        // Closed while the check ran.
        return;
      }
      if (validation && !validation.valid) {
        setSubmitStatus("idle");
        openDetails();
        setPromptFocusRequest((count) => count + 1);
        return;
      }
    }

    const params = new URLSearchParams();
    // Only include email for non-logged-in users. The account role is detected
    // automatically from the email domain server-side, so it is not sent here.
    if (!isLoggedIn) {
      params.append(EMAIL_PARAM, effectiveEmail.trim());
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
    params.append(PROJECT_DESCRIPTION_PARAM, prompt);
    searchParams.getAll(CONTEXT_RESOURCES_PARAM).forEach((resource) => {
      params.append(CONTEXT_RESOURCES_PARAM, resource);
    });
    attachedDocuments.forEach((attached) => {
      params.append(LANDING_UPLOADS_PARAM, attached.key);
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
    setSubmitStatus("redirecting");
    // Cross-origin target — a full navigation, not a Next.js route change.
    window.location.assign(href);
  };

  // A held Enter key from the hero prompt must not submit the email field
  // the moment the modal opens and focuses it.
  const handleFieldKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && event.repeat) {
      event.preventDefault();
    }
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

  const isPromptInvalid = promptValidation !== null && !promptValidation.valid;
  const isTitlePending = isProjectTitlePending && !hasEditedTitle;

  const busyLabel =
    submitStatus === "checking"
      ? "Checking your project details…"
      : isRedirecting
        ? "Creating your project…"
        : "";

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        // The email field focuses itself; Radix would pick the close button.
        onOpenAutoFocus={(event) => event.preventDefault()}
        className={cn(
          MODAL_SURFACE_CLASS,
          "flex max-h-[90dvh] w-[calc(100%-24px)] flex-col gap-0 overflow-hidden p-0 outline-hidden sm:w-[440px]",
        )}
      >
        <button
          type="button"
          aria-label="Close"
          className={cn(
            MODAL_CLOSE_BUTTON_CLASS,
            "disabled:pointer-events-none disabled:opacity-50",
          )}
          disabled={isRedirecting}
          onClick={(event) => {
            handleOpenChange(false);
            event.stopPropagation();
          }}
        >
          <X className="size-4" aria-hidden />
        </button>

        <form
          noValidate
          aria-busy={isSubmitting}
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-col overflow-y-auto"
        >
          <div className="flex flex-col gap-5 px-5 pt-6 pb-6 sm:px-7 sm:pt-7">
            <header className="pr-10">
              <DialogTitle className="font-heading text-[24px] font-normal leading-[1.2] tracking-[-0.02em] text-egray-900 sm:text-[26px]">
                {isLoggedIn ? "Create a new project" : "Create your project"}
              </DialogTitle>
              <DialogDescription className="mt-1.5 font-inter text-[15px] leading-[22px] text-egray-700">
                {isLoggedIn
                  ? "We'll create it in your workspace and open it."
                  : "We'll email you a link to open it."}
              </DialogDescription>
            </header>

            <div>
              <div className="flex items-center justify-between gap-3">
                <p className="font-inter text-[13px] font-medium leading-5 text-egray-600">
                  Your project
                </p>
                <button
                  type="button"
                  aria-expanded={isDetailsOpen}
                  aria-controls={detailsId}
                  onClick={handleToggleDetails}
                  disabled={isRedirecting}
                  className="-mr-1.5 inline-flex h-8 items-center gap-1 rounded-lg px-1.5 font-inter text-[13px] font-medium text-brand-800 hover:bg-white/70 focus-visible:outline-2 focus-visible:outline-brand-700 disabled:opacity-50"
                >
                  {isDetailsOpen ? "Hide details" : "Edit details"}
                  <ChevronDown
                    aria-hidden
                    className={cn(
                      "size-4 transition-transform duration-200 motion-reduce:transition-none",
                      isDetailsOpen && "rotate-180",
                    )}
                  />
                </button>
              </div>

              <div id={detailsId} className="mt-2">
                {isDetailsOpen ? (
                  <div className="flex flex-col gap-3">
                    <div>
                      <LabeledInput
                        id={titleId}
                        label="Project name"
                        placeholder="Forest Road 43 repair, Tahoe NF"
                        className={cn(
                          GLASS_INPUT_CLASS,
                          isError?.projectTitle && FIELD_ERROR_CLASS,
                        )}
                        value={data.projectTitle}
                        hasError={isError?.projectTitle}
                        aria-invalid={isError?.projectTitle || undefined}
                        aria-describedby={
                          isError?.projectTitle ? titleErrorId : undefined
                        }
                        disabled={isRedirecting}
                        onChange={(event) => {
                          const projectTitle = event.target.value;
                          setHasEditedTitle(true);
                          setData((prev) => ({ ...prev, projectTitle }));
                        }}
                        onKeyDown={handleFieldKeyDown}
                      />
                      {isError?.projectTitle && (
                        <FieldError id={titleErrorId}>
                          Enter a project name.
                        </FieldError>
                      )}
                    </div>

                    <div>
                      {/* The label sits above the textarea, not floating over
                          it: a long prompt scrolls inside the textarea and
                          would otherwise run under the label. */}
                      <div
                        className={cn(
                          "glass-inset relative rounded-xl px-3 pt-2 pb-11 focus-within:outline-solid focus-within:outline-2 focus-within:outline-brand-700/40",
                          (isPromptInvalid || isError?.projectPrompt) &&
                            "outline-solid outline-2 outline-red-60 focus-within:outline-red-60",
                        )}
                      >
                        <label
                          htmlFor={promptId}
                          className="label block text-neutral-black"
                        >
                          Project prompt
                        </label>
                        <textarea
                          ref={promptRef}
                          id={promptId}
                          rows={4}
                          placeholder="Describe your project goals, location, conditions, and desired outcomes..."
                          className="block max-h-[40dvh] min-h-24 w-full resize-none bg-transparent font-inter text-base text-egray-900 outline-hidden field-sizing-content placeholder:text-egray-600 disabled:opacity-60"
                          value={projectPrompt}
                          aria-invalid={
                            isPromptInvalid ||
                            isError?.projectPrompt ||
                            undefined
                          }
                          aria-describedby={
                            isPromptInvalid || isError?.projectPrompt
                              ? promptErrorId
                              : undefined
                          }
                          disabled={isRedirecting}
                          onChange={(event) => {
                            setProjectPrompt(event.target.value);
                            resetPromptValidation();
                          }}
                        />
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                aria-label="Enhance prompt with AI"
                                className={cn(
                                  "glass press absolute right-2 bottom-2 flex size-8 items-center justify-center rounded-lg hover:bg-white/80 focus-visible:outline-2 focus-visible:outline-brand-700 disabled:opacity-50",
                                  isPromptInvalid && "animate-scale-pulse",
                                )}
                                onClick={handleEnhancePrompt}
                                hidden={!projectPrompt.trim()}
                                disabled={isEnhancing || isSubmitting}
                              >
                                {isEnhancing ? (
                                  <Loader2
                                    aria-hidden
                                    className="size-4 animate-spin text-egray-500"
                                  />
                                ) : (
                                  <BrandGradientIcon
                                    icon={Sparkles}
                                    className="size-4"
                                  />
                                )}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              Enhance prompt with AI
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      {isPromptInvalid ? (
                        <FieldError id={promptErrorId} role="alert">
                          {promptValidation?.feedback ||
                            formatMissingDetails(promptValidation?.missing)}
                        </FieldError>
                      ) : (
                        isError?.projectPrompt && (
                          <FieldError id={promptErrorId}>
                            Describe your project.
                          </FieldError>
                        )
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="glass rounded-2xl px-4 py-3">
                    {isTitlePending ? (
                      <p className="flex items-center gap-1.5 font-inter text-[14px] leading-5 text-egray-600">
                        <Loader2
                          aria-hidden
                          className="size-3.5 shrink-0 animate-spin motion-reduce:animate-none"
                        />
                        Naming your project…
                      </p>
                    ) : (
                      data.projectTitle.trim() && (
                        <p className="truncate font-inter text-[15px] font-medium leading-[22px] text-egray-900">
                          {data.projectTitle}
                        </p>
                      )
                    )}
                    <p className="mt-0.5 line-clamp-2 break-words font-inter text-[14px] leading-5 text-egray-700">
                      {projectPrompt}
                    </p>
                  </div>
                )}

                {hasAttachedDocuments && (
                  <ul
                    aria-label="Attached documents"
                    className="mt-2 flex flex-wrap gap-1.5"
                  >
                    {attachedDocuments.map((attached) => (
                      <li
                        key={attached.key}
                        title={attached.name}
                        className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full border border-white/85 bg-white/70 py-1 pr-2.5 pl-2 font-inter text-[13px] leading-5 text-egray-700"
                      >
                        <FileText
                          aria-hidden
                          className="size-3.5 shrink-0 text-brand-800"
                        />
                        <span className="truncate">{attached.name}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {!isLoggedIn && (
              <div>
                <LabeledInput
                  id={emailId}
                  label="Email address"
                  type="email"
                  name="email"
                  autoComplete="email"
                  inputMode="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="you@example.com"
                  className={cn(
                    GLASS_INPUT_CLASS,
                    isError?.email && FIELD_ERROR_CLASS,
                  )}
                  value={data.email}
                  hasError={isError?.email}
                  aria-invalid={isError?.email || undefined}
                  aria-describedby={isError?.email ? emailErrorId : undefined}
                  disabled={isRedirecting}
                  autoFocus
                  onChange={(event) => {
                    const email = event.target.value;
                    setData((prev) => ({ ...prev, email }));
                  }}
                  onKeyDown={handleFieldKeyDown}
                />
                {isError?.email && (
                  <FieldError id={emailErrorId}>
                    Enter a valid email address.
                  </FieldError>
                )}
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={isSubmitting || isEnhancing}
                className={cn(
                  PRIMARY_BUTTON_CLASS,
                  "h-11 w-full text-[15px] disabled:pointer-events-none disabled:opacity-60",
                )}
              >
                {isSubmitting && (
                  <Loader2
                    aria-hidden
                    className="size-4 animate-spin motion-reduce:animate-none"
                  />
                )}
                {busyLabel || "Create project"}
                {!isSubmitting && <ArrowRight aria-hidden className="size-4" />}
              </button>
              <p aria-live="polite" className="sr-only">
                {busyLabel}
              </p>
            </div>
          </div>

          {!isLoggedIn && (
            <p className="border-t border-white px-5 py-3 text-center font-inter text-[14px] leading-5 text-egray-700">
              Already have an account?{" "}
              <a
                href={routing.signIn()}
                className="font-medium text-brand-800 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-brand-700"
              >
                Sign in
              </a>
            </p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
};

interface FieldErrorProps {
  id: string;
  role?: "alert";
  children: ReactNode;
}

const FieldError = ({ id, role, children }: FieldErrorProps) => {
  return (
    <p
      id={id}
      role={role}
      className="mt-1.5 flex items-start gap-1.5 font-inter text-[13px] leading-5 text-error-700"
    >
      <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
};
