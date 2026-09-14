"use client";

import { useEffect } from "react";

import { useRouter, useSearchParams } from "next/navigation";

import { parseSignupAttribution } from "@/lib/signup-attribution";
import type { AuthUser } from "@/lib/types/auth";
import { checkEmailMismatch } from "./email-helpers";

interface UseUrlParamsParams {
  isAuthenticated: boolean;
  user: AuthUser | null;
}

export function useUrlParams({ isAuthenticated, user }: UseUrlParamsParams) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const urlEmail = searchParams.get("email");
  const urlProjectTitle = searchParams.get("projectTitle") || "";
  const urlProjectDescription = searchParams.get("projectDescription") || "";
  const urlOrganizationId = searchParams.get("organizationId") || "";
  const urlOfficeId = searchParams.get("officeId") || "";
  // PostHog anonymous id + campaign params handed off by the landing page.
  const attribution = parseSignupAttribution(searchParams);

  // Check if there's an email mismatch for authenticated users
  const hasEmailMismatch = checkEmailMismatch(
    isAuthenticated,
    urlEmail,
    user?.email,
  );

  // Clear email from URL if user is authenticated and emails match
  useEffect(() => {
    if (isAuthenticated && urlEmail && !hasEmailMismatch) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("email");
      const newUrl = params.toString()
        ? `/self-service?${params.toString()}`
        : "/self-service";
      router.replace(newUrl);
    }
  }, [isAuthenticated, urlEmail, hasEmailMismatch, searchParams, router]);

  return {
    urlEmail,
    urlProjectTitle,
    urlProjectDescription,
    urlOrganizationId,
    urlOfficeId,
    attribution,
    hasEmailMismatch,
  };
}
