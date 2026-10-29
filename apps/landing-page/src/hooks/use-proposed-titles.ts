"use client";

import { useRef, useState } from "react";

import useSWRMutation from "swr/mutation";

import { getLandingPageEnv } from "@wildfires-org/turboplan-env";

import { generateTitles } from "@/lib/generate-titles";
import { type ProposedTitles, resolveProposedTitles } from "@/lib/signup-modal";

const NO_TITLES: ProposedTitles = {
  projectTitle: "",
  organizationName: "",
  officeName: "",
};

/**
 * Names for the project a prompt will create. `propose` sets the prompt-based
 * fallback at once, so the signup modal can open without waiting, then asks
 * the server for generated names (4-7 s) and swaps them in when they arrive.
 * A result for an older prompt is dropped.
 */
export const useProposedTitles = (fallbackOfficeName?: string) => {
  const ENV = getLandingPageEnv();
  const [proposedTitles, setProposedTitles] =
    useState<ProposedTitles>(NO_TITLES);
  const latestRequestRef = useRef(0);

  const { trigger, isMutating } = useSWRMutation(
    `${ENV.SERVER_URL}/generate-titles`,
    generateTitles,
  );

  const proposeTitles = (description: string) => {
    latestRequestRef.current += 1;
    const requestId = latestRequestRef.current;

    setProposedTitles(
      resolveProposedTitles(description, undefined, fallbackOfficeName),
    );

    trigger({ description })
      .then((titles) => {
        if (requestId !== latestRequestRef.current) {
          return;
        }
        if (titles?.error) {
          console.error("Title generation error:", titles.error);
        }
        if (titles?.projectTitle) {
          setProposedTitles(
            resolveProposedTitles(description, titles, fallbackOfficeName),
          );
        }
      })
      .catch((error) => {
        console.error("Error generating titles:", error);
      });
  };

  return {
    proposedTitles,
    // SWR tracks the latest trigger only, which is the one that counts.
    isProposingTitles: isMutating,
    proposeTitles,
  };
};
