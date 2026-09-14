import { useEffect, useRef, useState } from "react";

import { useSearchParams } from "next/navigation";

import { parseSignupAttribution } from "@/lib/signup-attribution";
import type { AuthUser } from "@/lib/types/auth";
import { checkEmailMismatch, generateAutoProcessKey } from "./email-helpers";
import { useSubmission } from "./use-submission";

interface UseAutoProcessParams {
  user: AuthUser | null;
  isAuthenticated: boolean;
}

export function useAutoProcess({
  user,
  isAuthenticated,
}: UseAutoProcessParams) {
  const searchParams = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoProcessed, setAutoProcessed] = useState(false);
  // Use ref to prevent race conditions - more reliable than state
  const submissionInProgress = useRef(false);
  const { submitForm } = useSubmission();

  // Extract URL parameters once at the top level
  const urlEmail = searchParams.get("email");
  const urlProjectTitle = searchParams.get("projectTitle");
  const urlProjectDescription = searchParams.get("projectDescription");
  const urlOrganizationId = searchParams.get("organizationId");
  const urlOfficeId = searchParams.get("officeId");
  // PostHog anonymous id + campaign params handed off by the landing page.
  const attribution = parseSignupAttribution(searchParams);

  // Generate request key once for both useEffect and render logic
  const requestKey = generateAutoProcessKey(
    user?.id,
    urlEmail,
    urlProjectTitle,
  );

  // Check for email mismatch once
  const hasEmailMismatch = checkEmailMismatch(
    isAuthenticated,
    urlEmail,
    user?.email,
  );

  useEffect(() => {
    // Check if we've already processed this exact request
    const alreadyProcessed = sessionStorage.getItem(requestKey);
    if (autoProcessed || alreadyProcessed || submissionInProgress.current) {
      return; // Only run once
    }

    // CRITICAL: Check for email mismatch - don't auto-submit if emails don't match
    if (hasEmailMismatch) {
      return; // Don't auto-submit, let user see the warning
    }

    // If all required params are present, auto-submit
    if ((isAuthenticated || urlEmail) && urlProjectTitle) {
      submissionInProgress.current = true;
      setAutoProcessed(true);

      // Trigger auto-submission
      const autoSubmit = async () => {
        setIsSubmitting(true);

        // Mark as processed in sessionStorage to prevent duplicate processing
        sessionStorage.setItem(requestKey, "true");

        const success = await submitForm(
          {
            email: urlEmail || user?.email || "",
            projectTitle: urlProjectTitle,
            projectDescription: urlProjectDescription || undefined,
            organizationId: urlOrganizationId || undefined,
            officeId: urlOfficeId || undefined,
            attribution,
          },
          isAuthenticated,
        );

        // On failure, clear the flag to allow retry
        if (!success) {
          sessionStorage.removeItem(requestKey);
          setIsSubmitting(false);
        }
      };

      autoSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoProcessed, searchParams, isAuthenticated, user?.id]);

  // Check if we should show loading state
  const wasAlreadyProcessed =
    typeof window !== "undefined" ? sessionStorage.getItem(requestKey) : null;

  const shouldAutoProcess =
    (isAuthenticated || urlEmail) &&
    urlProjectTitle &&
    !wasAlreadyProcessed &&
    !hasEmailMismatch; // Don't auto-process if there's an email mismatch

  const showLoadingState =
    (isSubmitting && autoProcessed) ||
    (shouldAutoProcess && (!isAuthenticated || user));

  return { isSubmitting, autoProcessed, showLoadingState, setIsSubmitting };
}
