"use client";

import { useCallback } from "react";

import { useEventListener } from "usehooks-ts";

/**
 * Registry of custom event names used across the app.
 * Add new events here as the app grows.
 */
export enum AppEvent {
  ResearchAgentHighlight = "research-agent:highlight",
}

export const useCustomEventTrigger = (name: AppEvent) => {
  return useCallback(() => {
    window.dispatchEvent(new CustomEvent(name));
  }, [name]);
};

export const useCustomEventListener = (name: AppEvent, handler: () => void) => {
  useEventListener(name as string as keyof WindowEventMap, handler);
};
