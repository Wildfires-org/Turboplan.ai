"use client";

import { useEffect } from "react";

import { logReleaseInfo } from "@wildfires-org/turboplan-env";

export const ReleaseInfoLogger = () => {
  useEffect(() => {
    logReleaseInfo();
  }, []);

  return null;
};
