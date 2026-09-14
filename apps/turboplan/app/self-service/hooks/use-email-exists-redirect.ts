import { useRouter } from "next/navigation";

import {
  appendAttributionParams,
  type SignupAttribution,
} from "@/lib/signup-attribution";
import { checkEmailExists } from "../actions";

interface UseEmailExistsRedirectParams {
  email: string;
  projectTitle: string;
  projectDescription?: string;
  attribution?: SignupAttribution;
}

/**
 * Consolidated email existence checking and redirect logic.
 * Used by both auto-process and manual form submission flows.
 *
 * Checks if email exists in the database and redirects to login
 * if it does, preserving form data in callback URL.
 *
 * @returns Promise<boolean> - true if email exists (and redirect initiated), false otherwise
 */
export function useEmailExistsRedirect() {
  const router = useRouter();

  const checkAndRedirect = async ({
    email,
    projectTitle,
    projectDescription,
    attribution,
  }: UseEmailExistsRedirectParams): Promise<boolean> => {
    const emailCheckResult = await checkEmailExists(email);

    // If email exists, redirect to login with callback
    if (emailCheckResult.exists) {
      const callbackParams = new URLSearchParams({
        email,
        projectTitle,
      });
      if (projectDescription) {
        callbackParams.set("projectDescription", projectDescription);
      }
      // Carry attribution across the login detour so a user who bounces
      // through /login and back keeps their campaign + anonymous identity.
      appendAttributionParams(callbackParams, attribution);
      const params = new URLSearchParams({
        email,
        callbackUrl: `/self-service?${callbackParams.toString()}`,
      });
      appendAttributionParams(params, attribution);
      router.push(`/login?${params.toString()}`);
      return true;
    }

    return false;
  };

  return { checkAndRedirect };
}
