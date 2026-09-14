"use client";

import { UserRole } from "@wildfires-org/turboplan-db/types";

import { useUser } from "@/components/providers/user-provider";

export function useIsCitizen() {
  const { profile } = useUser();
  return profile?.userRole === UserRole.CITIZEN;
}
