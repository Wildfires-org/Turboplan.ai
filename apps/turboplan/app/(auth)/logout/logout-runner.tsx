"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@wildfires-org/turboplan-utils";

import { useLogout } from "@/hooks/use-logout";

type LogoutRunnerProps = {
  redirectTo: string;
  /** When false, ask for confirmation instead of signing out on mount. */
  autoRun: boolean;
};

export const LogoutRunner = ({ redirectTo, autoRun }: LogoutRunnerProps) => {
  const router = useRouter();
  const { logout } = useLogout();
  const hasStarted = useRef(false);
  const [isRunning, setIsRunning] = useState(autoRun);

  const runLogout = useCallback(() => {
    // Ref guard also covers StrictMode's double effect in dev.
    if (hasStarted.current) {
      return;
    }
    hasStarted.current = true;
    setIsRunning(true);
    logout({ redirectTo }).catch((error) => {
      // Sign-out request failed twice (see useLogout); don't spin forever.
      console.error("Logout failed:", error);
      router.replace("/login");
    });
  }, [logout, redirectTo, router]);

  useEffect(() => {
    if (autoRun) {
      runLogout();
    }
  }, [autoRun, runLogout]);

  if (isRunning) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-neutral-600">
        <Loader2 className="size-6 animate-spin" />
        <span className="text-sm">Signing you out…</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 py-6">
      <span className="text-sm text-neutral-600">
        Are you sure you want to sign out?
      </span>
      <Button onClick={runLogout}>Sign out</Button>
    </div>
  );
};
