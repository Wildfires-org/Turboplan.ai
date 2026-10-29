"use client";

import { createContext, type ReactNode, useContext } from "react";

import useSWR from "swr";

import { SessionProvider } from "@wildfires-org/turboplan-auth/client";
import type { Session } from "@wildfires-org/turboplan-auth/types";

interface ClientSessionProviderProps {
  children: ReactNode;
}

const SESSION_ENDPOINT = "/api/session";

const SessionLoadedContext = createContext(false);

const fetchSession = async (url: string): Promise<Session> => {
  const response = await fetch(url, { credentials: "same-origin" });
  if (!response.ok) {
    return null;
  }
  return response.json();
};

/**
 * Feeds `SessionProvider` from `/api/session` after hydration, so the root
 * layout doesn't read cookies and the marketing pages can be prerendered.
 * `useSession()` is null until the request settles; use `useSessionLoaded()`
 * to tell "signed out" from "not known yet".
 */
export const ClientSessionProvider = ({
  children,
}: ClientSessionProviderProps) => {
  const { data, error, isLoading } = useSWR(SESSION_ENDPOINT, fetchSession, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });
  const isLoaded = !isLoading || Boolean(error);

  return (
    <SessionLoadedContext.Provider value={isLoaded}>
      <SessionProvider session={data ?? null}>{children}</SessionProvider>
    </SessionLoadedContext.Provider>
  );
};

export const useSessionLoaded = () => useContext(SessionLoadedContext);
