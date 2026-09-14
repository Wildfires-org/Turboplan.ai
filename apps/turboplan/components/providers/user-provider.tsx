"use client";

import { createContext, type ReactNode, useContext, useEffect } from "react";

import type { User } from "next-auth";
import { posthog } from "posthog-js";

import type { Profile } from "@wildfires-org/turboplan-db/types";

interface UserContext {
  user: User | null;
  profile: Profile | null;
}

const UserContext = createContext<UserContext | undefined>(undefined);

interface UserProviderProps {
  children: ReactNode;
  user: User | null;
  profile: Profile | null;
}

export function UserProvider({ children, user, profile }: UserProviderProps) {
  useEffect(() => {
    // Identify with user id + role only — no email (PII decision in the
    // tracking plan). No-ops when PostHog is not initialized.
    if (user?.id && posthog.__loaded) {
      posthog.identify(user.id, {
        role: profile?.userRole ?? undefined,
      });
    }
  }, [user?.id, profile?.userRole]);

  return (
    <UserContext.Provider value={{ user, profile }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
}
