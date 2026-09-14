"use client";

import { useCallback } from "react";

import { signOut } from "next-auth/react";
import { posthog } from "posthog-js";

import { ApiClient } from "@wildfires-org/turboplan-api-client";

const apiClient = new ApiClient();

export const useLogout = () => {
  const logout = useCallback(async (options?: { redirectTo?: string }) => {
    const redirectUrl = options?.redirectTo ?? "/login";

    // Unlink the analytics identity so the next user on this browser
    // doesn't inherit it. No-ops when PostHog is not initialized.
    if (posthog.__loaded) {
      posthog.reset();
    }

    try {
      // Clear JWT token first
      apiClient.clearToken();
      // Then sign out of NextAuth session
      await signOut({ redirectTo: redirectUrl });
    } catch (error) {
      console.error("Logout error:", error);
      // Still attempt to sign out even if token clearing fails
      await signOut({ redirectTo: redirectUrl });
    }
  }, []);

  return { logout };
};
