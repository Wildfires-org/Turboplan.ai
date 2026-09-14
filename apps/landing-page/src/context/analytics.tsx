"use client";
import React, { createContext, useContext, useEffect, useState } from "react";

import { useSearchParams } from "next/navigation";
import { posthog } from "posthog-js";

import { persistAttributionParams } from "@/lib/attribution";

interface User {
  email: string;
  id: string;
}

export interface AnalyticsContextState {
  user: User | null;
}

export interface AnalyticsContextActions {
  setUser: (user: User | null) => void;
}

type AnalyticsContextType = AnalyticsContextState & AnalyticsContextActions;

const STORAGE_KEYS = {
  EMAIL: "utm_email",
  USER_ID: "utm_uid",
};

export const AnalyticsContext = createContext<AnalyticsContextType | undefined>(
  undefined,
);

export const useAnalyticsContext = () => {
  const context = useContext(AnalyticsContext);
  if (!context)
    throw new Error(
      "useAnalyticsContext must be used within the AnalyticsContextProvider",
    );
  return context;
};

function AnalyticsContextProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  return (
    <AnalyticsContext.Provider value={{ user, setUser }}>
      {children}
    </AnalyticsContext.Provider>
  );
}

export const InitializeAnalyticsContext = () => {
  const searchParams = useSearchParams();
  const { setUser } = useAnalyticsContext();

  useEffect(() => {
    // UTM/gclid params are persisted alongside the campaign user so attribution
    // survives navigation between landing and the signup modal.
    persistAttributionParams(searchParams);

    const loadUser = () => {
      const queryCampaignEmail = searchParams.get(STORAGE_KEYS.EMAIL);
      const queryCampaignUserId = searchParams.get(STORAGE_KEYS.USER_ID);

      if (queryCampaignEmail && queryCampaignUserId) {
        return { email: queryCampaignEmail, id: queryCampaignUserId };
      }

      const storageCampaignEmail = window.sessionStorage.getItem(
        STORAGE_KEYS.EMAIL,
      );
      const storageCampaignUserId = window.sessionStorage.getItem(
        STORAGE_KEYS.USER_ID,
      );

      if (storageCampaignEmail && storageCampaignUserId) {
        return { email: storageCampaignEmail, id: storageCampaignUserId };
      }

      return null;
    };

    const saveUserToStorage = (user: User) => {
      window.sessionStorage.setItem(STORAGE_KEYS.EMAIL, user.email);
      window.sessionStorage.setItem(STORAGE_KEYS.USER_ID, user.id);
    };

    const newUser = loadUser();
    if (newUser) {
      setUser(newUser);
      saveUserToStorage(newUser);
      // Identify with the user id only — email is PII and stays out of
      // PostHog (tracking-plan decision). Same id the web app identifies
      // with, so cross-domain journeys stitch into one person.
      if (posthog.__loaded) {
        posthog.identify(newUser.id);
      }
    }
  }, []);

  return null;
};

export default AnalyticsContextProvider;
